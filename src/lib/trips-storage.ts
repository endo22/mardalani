import { recalculateBudget } from "@/lib/budget";
import { itinerarySchema, savedTripsStoreSchema } from "@/lib/schemas";
import { createId } from "@/lib/utils";
import type { Activity, Itinerary, ManualExpense } from "@/types";

export const SAVED_TRIPS_KEY = "mardalani_saved_trips_v1";
/** Legacy single-trip session key — used only for one-time migration seed. */
export const LEGACY_ACTIVE_ITINERARY_KEY = "mardalani_itinerary_v1";

export type StorageFailureReason =
  | "unavailable"
  | "quota"
  | "invalid"
  | "not_found";

export type StorageWriteResult =
  | { ok: true }
  | { ok: false; reason: StorageFailureReason };

type Listener = () => void;
const listeners = new Set<Listener>();

const SERVER_TRIPS: Itinerary[] = [];

let cachedRaw: string | null | undefined = undefined;
let cachedTrips: Itinerary[] = SERVER_TRIPS;
let migratedFromSession = false;

function emitChange() {
  listeners.forEach((l) => l());
}

function canUseLocalStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const probe = "__mardalani_trips_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function normalizeItinerary(itinerary: Itinerary): Itinerary {
  const manualExpenses = itinerary.manualExpenses ?? [];
  return {
    ...itinerary,
    manualExpenses,
    budget: recalculateBudget(itinerary.days, itinerary.budget.budgetCap, {
      manualExpenses,
      travelers: itinerary.travelers,
    }),
  };
}

function parseStore(raw: string | null): Itinerary[] {
  if (!raw) return [];
  try {
    const json: unknown = JSON.parse(raw);
    const result = savedTripsStoreSchema.safeParse(json);
    if (!result.success) {
      // Tolerate a bare array of itineraries (malformed wrapper).
      if (Array.isArray(json)) {
        const trips: Itinerary[] = [];
        for (const item of json) {
          const one = itinerarySchema.safeParse(item);
          if (one.success) trips.push(normalizeItinerary(one.data));
        }
        return trips;
      }
      return [];
    }
    return result.data.trips.map(normalizeItinerary);
  } catch {
    return [];
  }
}

function readRaw(): string | null {
  if (!canUseLocalStorage()) return null;
  try {
    return localStorage.getItem(SAVED_TRIPS_KEY);
  } catch {
    return null;
  }
}

function writeStore(trips: Itinerary[]): StorageWriteResult {
  if (!canUseLocalStorage()) return { ok: false, reason: "unavailable" };
  try {
    const payload = savedTripsStoreSchema.parse({ version: 1 as const, trips });
    const raw = JSON.stringify(payload);
    localStorage.setItem(SAVED_TRIPS_KEY, raw);
    cachedRaw = raw;
    cachedTrips = trips;
    emitChange();
    return { ok: true };
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED");
    return { ok: false, reason: isQuota ? "quota" : "invalid" };
  }
}

/** One-time seed: copy legacy session trip into the library if library is empty. */
function migrateFromSessionIfNeeded(trips: Itinerary[]): Itinerary[] {
  if (migratedFromSession || trips.length > 0) return trips;
  if (typeof window === "undefined") return trips;
  migratedFromSession = true;
  try {
    const legacy = sessionStorage.getItem(LEGACY_ACTIVE_ITINERARY_KEY);
    if (!legacy) return trips;
    const parsed = itinerarySchema.safeParse(JSON.parse(legacy));
    if (!parsed.success) return trips;
    const seeded = [normalizeItinerary(parsed.data)];
    writeStore(seeded);
    return seeded;
  } catch {
    return trips;
  }
}

function refreshCache(): Itinerary[] {
  const raw = readRaw();
  if (raw === cachedRaw && cachedRaw !== undefined) {
    return migrateFromSessionIfNeeded(cachedTrips);
  }
  cachedRaw = raw;
  const parsed = parseStore(raw);
  // Clear irreparably corrupt payloads so future reads stay clean.
  if (raw && parsed.length === 0) {
    try {
      const probe = JSON.parse(raw) as unknown;
      const ok = savedTripsStoreSchema.safeParse(probe).success;
      if (!ok && !Array.isArray(probe)) {
        localStorage.removeItem(SAVED_TRIPS_KEY);
        cachedRaw = null;
      }
    } catch {
      try {
        localStorage.removeItem(SAVED_TRIPS_KEY);
      } catch {
        /* ignore */
      }
      cachedRaw = null;
    }
  }
  cachedTrips = migrateFromSessionIfNeeded(parsed);
  return cachedTrips;
}

export function tripDisplayTitle(trip: Itinerary): string {
  const custom = trip.title?.trim();
  if (custom) return custom;
  return trip.destinationName;
}

export function listSavedTrips(): Itinerary[] {
  if (!canUseLocalStorage()) return [];
  return refreshCache();
}

export function getSavedTrip(id: string): Itinerary | null {
  return listSavedTrips().find((t) => t.id === id) ?? null;
}

export function upsertSavedTrip(itinerary: Itinerary): StorageWriteResult {
  const parsed = itinerarySchema.safeParse(itinerary);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const next = normalizeItinerary(parsed.data);
  const current = listSavedTrips();
  const idx = current.findIndex((t) => t.id === next.id);
  const trips =
    idx === -1
      ? [next, ...current]
      : current.map((t, i) => (i === idx ? next : t));
  return writeStore(trips);
}

export function renameSavedTrip(
  id: string,
  title: string,
): StorageWriteResult {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 120) {
    return { ok: false, reason: "invalid" };
  }
  const current = listSavedTrips();
  const trip = current.find((t) => t.id === id);
  if (!trip) return { ok: false, reason: "not_found" };
  const updated: Itinerary = {
    ...trip,
    title: trimmed,
    updatedAt: new Date().toISOString(),
  };
  return upsertSavedTrip(updated);
}

function remapActivity(activity: Activity): Activity {
  return { ...activity, id: createId("act") };
}

function remapExpense(expense: ManualExpense): ManualExpense {
  return { ...expense, id: createId("exp") };
}

/** Deep-independent copy with fresh ids for trip, activities, and expenses. */
export function duplicateSavedTrip(id: string): StorageWriteResult & {
  trip?: Itinerary;
} {
  const source = getSavedTrip(id);
  if (!source) return { ok: false, reason: "not_found" };
  const now = new Date().toISOString();
  const baseTitle = tripDisplayTitle(source);
  const copy: Itinerary = {
    ...source,
    id: createId("trip"),
    title: `${baseTitle} (copy)`,
    createdAt: now,
    updatedAt: now,
    days: source.days.map((day) => ({
      ...day,
      activities: day.activities.map(remapActivity),
    })),
    manualExpenses: (source.manualExpenses ?? []).map(remapExpense),
  };
  const result = upsertSavedTrip(copy);
  if (!result.ok) return result;
  return { ok: true, trip: copy };
}

export function deleteSavedTrip(id: string): StorageWriteResult {
  const current = listSavedTrips();
  if (!current.some((t) => t.id === id)) {
    return { ok: false, reason: "not_found" };
  }
  return writeStore(current.filter((t) => t.id !== id));
}

export type DuplicateTripPolicy = "skip" | "replace";

export type TripMergeCounts = {
  imported: number;
  skipped: number;
  duplicatesSkipped: number;
  replaced: number;
};

/**
 * Pure merge planner: never wipes `current` on empty/invalid import.
 * Default `onDuplicate: "skip"` keeps existing trips with the same id.
 */
export function planTripMerge(
  current: Itinerary[],
  incoming: Itinerary[],
  options: { onDuplicate?: DuplicateTripPolicy } = {},
): { ok: true; trips: Itinerary[] } & TripMergeCounts {
  const onDuplicate = options.onDuplicate ?? "skip";
  const uniqueImported: Itinerary[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const item of incoming) {
    const parsed = itinerarySchema.safeParse(item);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    const next = normalizeItinerary(parsed.data);
    if (seen.has(next.id)) {
      // Last duplicate within the import file wins
      const idx = uniqueImported.findIndex((t) => t.id === next.id);
      if (idx !== -1) uniqueImported[idx] = next;
      continue;
    }
    seen.add(next.id);
    uniqueImported.push(next);
  }

  if (uniqueImported.length === 0) {
    return {
      ok: true,
      trips: current,
      imported: 0,
      skipped,
      duplicatesSkipped: 0,
      replaced: 0,
    };
  }

  const currentById = new Map(current.map((t) => [t.id, t]));
  let imported = 0;
  let duplicatesSkipped = 0;
  let replaced = 0;

  const incomingById = new Map(uniqueImported.map((t) => [t.id, t]));
  const newTrips: Itinerary[] = [];

  for (const trip of uniqueImported) {
    if (currentById.has(trip.id)) {
      if (onDuplicate === "replace") {
        replaced += 1;
      } else {
        duplicatesSkipped += 1;
      }
    } else {
      newTrips.push(trip);
      imported += 1;
    }
  }

  const merged: Itinerary[] = [
    ...newTrips,
    ...current.map((trip) => {
      if (onDuplicate === "replace" && incomingById.has(trip.id)) {
        return incomingById.get(trip.id)!;
      }
      return trip;
    }),
  ];

  return {
    ok: true,
    trips: merged,
    imported,
    skipped,
    duplicatesSkipped,
    replaced,
  };
}

/** How many distinct incoming trip ids already exist in the library. */
export function countTripIdConflicts(
  incoming: Itinerary[],
  current: Itinerary[] = listSavedTrips(),
): number {
  const currentIds = new Set(current.map((t) => t.id));
  const seen = new Set<string>();
  let conflicts = 0;
  for (const item of incoming) {
    const id = typeof item?.id === "string" ? item.id : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (currentIds.has(id)) conflicts += 1;
  }
  return conflicts;
}

/**
 * Merge imported itineraries into the library.
 * Default skips same-id trips; pass `onDuplicate: "replace"` to overwrite.
 * Invalid entries are skipped; failed writes leave existing data untouched.
 */
export function mergeImportedTrips(
  incoming: Itinerary[],
  options: { onDuplicate?: DuplicateTripPolicy } = {},
): StorageWriteResult & TripMergeCounts {
  const current = listSavedTrips();
  const planned = planTripMerge(current, incoming, options);

  if (
    planned.imported === 0 &&
    planned.replaced === 0 &&
    planned.duplicatesSkipped === 0 &&
    planned.skipped > 0
  ) {
    // Only invalid entries — do not wipe the library.
    return {
      ok: false,
      reason: "invalid",
      imported: 0,
      skipped: planned.skipped,
      duplicatesSkipped: 0,
      replaced: 0,
    };
  }

  if (planned.imported === 0 && planned.replaced === 0) {
    // Nothing to write (all duplicates skipped, or empty after dedupe).
    return {
      ok: true,
      imported: 0,
      skipped: planned.skipped,
      duplicatesSkipped: planned.duplicatesSkipped,
      replaced: 0,
    };
  }

  const result = writeStore(planned.trips);
  if (!result.ok) {
    return {
      ...result,
      imported: 0,
      skipped: planned.skipped,
      duplicatesSkipped: planned.duplicatesSkipped,
      replaced: 0,
    };
  }
  return {
    ok: true,
    imported: planned.imported,
    skipped: planned.skipped,
    duplicatesSkipped: planned.duplicatesSkipped,
    replaced: planned.replaced,
  };
}

export function subscribeSavedTrips(onStoreChange: Listener): () => void {
  listeners.add(onStoreChange);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStoreChange);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStoreChange);
    }
  };
}

export function getSavedTripsSnapshot(): Itinerary[] {
  return listSavedTrips();
}

export function getServerSavedTripsSnapshot(): Itinerary[] {
  return SERVER_TRIPS;
}

export function storageErrorMessage(reason: StorageFailureReason): string {
  switch (reason) {
    case "quota":
      return "Browser storage is full. Free space or remove another trip, then try again.";
    case "unavailable":
      return "Local storage is unavailable in this browser. Trips cannot be saved here.";
    case "not_found":
      return "That trip was not found. It may already have been removed.";
    case "invalid":
    default:
      return "Could not save that change. Check the name and try again.";
  }
}
