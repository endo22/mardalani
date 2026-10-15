import { recalculateBudget } from "@/lib/budget";
import { itinerarySchema } from "@/lib/schemas";
import {
  LEGACY_ACTIVE_ITINERARY_KEY,
  type StorageWriteResult,
  upsertSavedTrip,
} from "@/lib/trips-storage";
import type { Itinerary } from "@/types";

const STORAGE_KEY = LEGACY_ACTIVE_ITINERARY_KEY;

/** Stable server snapshot — must be the same reference every call. */
const SERVER_SNAPSHOT: Itinerary | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

/** Cached client snapshot — re-parse only when the stored string changes. */
let cachedRaw: string | null | undefined = undefined;
let cachedItinerary: Itinerary | null = null;

function emitChange() {
  listeners.forEach((l) => l());
}

function canUseSessionStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const probe = "__mardalani_probe__";
    sessionStorage.setItem(probe, "1");
    sessionStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function readRaw(): string | null {
  if (!canUseSessionStorage()) return null;
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Recompute category totals so migrated snapshots stay consistent. */
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

function parseRaw(raw: string | null): Itinerary | null {
  if (!raw) return null;
  try {
    const json: unknown = JSON.parse(raw);
    const result = itinerarySchema.safeParse(json);
    if (!result.success) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return null;
    }
    return normalizeItinerary(result.data);
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

function refreshCacheFromStorage(): Itinerary | null {
  const raw = readRaw();
  if (raw === cachedRaw) {
    return cachedItinerary;
  }
  cachedRaw = raw;
  cachedItinerary = parseRaw(raw);
  return cachedItinerary;
}

function setCache(itinerary: Itinerary | null, raw: string | null) {
  cachedRaw = raw;
  cachedItinerary = itinerary;
}

export type SaveItineraryResult = {
  active: StorageWriteResult;
  library: StorageWriteResult;
};

function writeActive(itinerary: Itinerary): StorageWriteResult {
  if (!canUseSessionStorage()) return { ok: false, reason: "unavailable" };
  try {
    const parsed = itinerarySchema.parse(itinerary);
    const raw = JSON.stringify(parsed);
    sessionStorage.setItem(STORAGE_KEY, raw);
    setCache(parsed, raw);
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

/**
 * Persist the active trip in sessionStorage and upsert the same snapshot
 * into the localStorage saved-trips library (by itinerary id).
 */
export function saveItinerary(itinerary: Itinerary): SaveItineraryResult {
  const active = writeActive(itinerary);
  const library = active.ok
    ? upsertSavedTrip(itinerary)
    : ({ ok: false, reason: "invalid" } as StorageWriteResult);
  return { active, library };
}

/** Load a saved trip into the active session editor (sessionStorage only). */
export function activateSavedTrip(itinerary: Itinerary): StorageWriteResult {
  return writeActive(itinerary);
}

export function loadItinerary(): Itinerary | null {
  if (!canUseSessionStorage()) return null;
  return refreshCacheFromStorage();
}

export function clearItinerary(): void {
  if (!canUseSessionStorage()) {
    setCache(null, null);
    emitChange();
    return;
  }
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  setCache(null, null);
  emitChange();
}

export function subscribeItinerary(onStoreChange: Listener): () => void {
  listeners.add(onStoreChange);
  // sessionStorage is per-tab; still listen for same-origin storage events
  // in case a future migration uses localStorage for cross-tab sync.
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

export function getItinerarySnapshot(): Itinerary | null {
  return loadItinerary();
}

export function getServerItinerarySnapshot(): Itinerary | null {
  return SERVER_SNAPSHOT;
}
