import {
  LOCAL_BACKUP_KIND,
  itinerarySchema,
  localBackupSchema,
  savedTripsStoreSchema,
  wishlistStoreSchema,
  type LocalBackup,
} from "@/lib/schemas";
import {
  listSavedTrips,
  mergeImportedTrips,
  type DuplicateTripPolicy,
  type StorageWriteResult,
  type TripMergeCounts,
} from "@/lib/trips-storage";
import {
  listWishlistSlugs,
  mergeImportedWishlist,
  type WishlistWriteResult,
} from "@/lib/wishlist-storage";
import type { Itinerary } from "@/types";

/** Hard cap before reading backup file contents into memory. */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export type BackupParseResult =
  | { ok: true; backup: LocalBackup }
  | { ok: false; reason: "invalid" | "too_large" };

export type TripsImportResult = StorageWriteResult & TripMergeCounts;

export type WishlistImportResult = WishlistWriteResult & {
  imported: number;
  skipped: number;
  duplicatesSkipped: number;
};

function stamp(): string {
  return new Date().toISOString();
}

function toBackupTrip(trip: Itinerary): NonNullable<LocalBackup["trips"]>[number] {
  return {
    ...trip,
    manualExpenses: trip.manualExpenses ?? [],
  };
}

export function buildTripsBackup(trips: Itinerary[] = listSavedTrips()): LocalBackup {
  return {
    kind: LOCAL_BACKUP_KIND,
    version: 1,
    exportedAt: stamp(),
    trips: trips.map(toBackupTrip),
  };
}

export function buildWishlistBackup(
  slugs: string[] = listWishlistSlugs(),
): LocalBackup {
  return {
    kind: LOCAL_BACKUP_KIND,
    version: 1,
    exportedAt: stamp(),
    wishlistSlugs: slugs,
  };
}

/**
 * Accept the portable envelope, or legacy bare store / trip-array shapes.
 */
export function parseLocalBackup(raw: unknown): BackupParseResult {
  const envelope = localBackupSchema.safeParse(raw);
  if (envelope.success) {
    const data = envelope.data;
    if (
      (data.trips?.length ?? 0) === 0 &&
      (data.wishlistSlugs?.length ?? 0) === 0
    ) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, backup: data };
  }

  const tripsStore = savedTripsStoreSchema.safeParse(raw);
  if (tripsStore.success && tripsStore.data.trips.length > 0) {
    return {
      ok: true,
      backup: {
        kind: LOCAL_BACKUP_KIND,
        version: 1,
        exportedAt: stamp(),
        trips: tripsStore.data.trips,
      },
    };
  }

  const wishStore = wishlistStoreSchema.safeParse(raw);
  if (wishStore.success && wishStore.data.slugs.length > 0) {
    return {
      ok: true,
      backup: {
        kind: LOCAL_BACKUP_KIND,
        version: 1,
        exportedAt: stamp(),
        wishlistSlugs: wishStore.data.slugs,
      },
    };
  }

  if (Array.isArray(raw) && raw.length > 0) {
    if (raw.every((item) => typeof item === "string")) {
      return {
        ok: true,
        backup: {
          kind: LOCAL_BACKUP_KIND,
          version: 1,
          exportedAt: stamp(),
          wishlistSlugs: raw as string[],
        },
      };
    }

    const trips: NonNullable<LocalBackup["trips"]> = [];
    for (const item of raw) {
      const one = itinerarySchema.safeParse(item);
      if (one.success) trips.push(one.data);
    }
    if (trips.length > 0) {
      return {
        ok: true,
        backup: {
          kind: LOCAL_BACKUP_KIND,
          version: 1,
          exportedAt: stamp(),
          trips,
        },
      };
    }
  }

  return { ok: false, reason: "invalid" };
}

export function downloadJsonBackup(
  backup: LocalBackup,
  filename: string,
): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function backupFilename(part: "trips" | "wishlist"): string {
  const day = new Date().toISOString().slice(0, 10);
  return `mardalani-${part}-${day}.json`;
}

export async function readBackupFile(file: File): Promise<BackupParseResult> {
  if (file.size > MAX_BACKUP_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  try {
    const text = await file.text();
    const json: unknown = JSON.parse(text);
    return parseLocalBackup(json);
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function importTripsBackup(
  backup: LocalBackup,
  options: { onDuplicate?: DuplicateTripPolicy } = {},
): TripsImportResult {
  const trips = backup.trips ?? [];
  if (trips.length === 0) {
    return {
      ok: false,
      reason: "invalid",
      imported: 0,
      skipped: 0,
      duplicatesSkipped: 0,
      replaced: 0,
    };
  }
  return mergeImportedTrips(trips, options);
}

export function importWishlistBackup(
  backup: LocalBackup,
): WishlistImportResult {
  const slugs = backup.wishlistSlugs ?? [];
  if (slugs.length === 0) {
    return {
      ok: false,
      reason: "invalid",
      imported: 0,
      skipped: 0,
      duplicatesSkipped: 0,
    };
  }
  return mergeImportedWishlist(slugs);
}

export function tripsBackupEmptyMessage(): string {
  return "No saved trips to export yet. Generate a plan first.";
}

export function wishlistBackupEmptyMessage(): string {
  return "No wishlist items to export yet.";
}

export function backupInvalidMessage(): string {
  return "That file is not a valid MARDALANI local backup. Choose a JSON export from this app.";
}

export function backupTooLargeMessage(): string {
  return "That backup file is too large (max 5 MB). Choose a smaller MARDALANI JSON export.";
}

export function tripsImportSuccessMessage(result: TripsImportResult): string {
  const parts: string[] = [];
  if (result.imported > 0) {
    parts.push(
      `Restored ${result.imported} trip${result.imported === 1 ? "" : "s"} from local file.`,
    );
  }
  if (result.replaced > 0) {
    parts.push(
      `Replaced ${result.replaced} existing trip${result.replaced === 1 ? "" : "s"}.`,
    );
  }
  if (result.duplicatesSkipped > 0) {
    parts.push(
      `Kept ${result.duplicatesSkipped} existing trip${result.duplicatesSkipped === 1 ? "" : "s"} (skipped duplicates).`,
    );
  }
  if (result.skipped > 0) {
    parts.push(
      `Skipped ${result.skipped} invalid entr${result.skipped === 1 ? "y" : "ies"}.`,
    );
  }
  if (parts.length === 0) {
    return "No trips were added from that file.";
  }
  return parts.join(" ");
}

export function wishlistImportSuccessMessage(
  result: WishlistImportResult,
): string {
  const parts: string[] = [];
  if (result.imported > 0) {
    parts.push(
      `Restored ${result.imported} wishlist item${result.imported === 1 ? "" : "s"} from local file.`,
    );
  }
  if (result.duplicatesSkipped > 0) {
    parts.push(
      `Kept ${result.duplicatesSkipped} existing item${result.duplicatesSkipped === 1 ? "" : "s"} already on your wishlist.`,
    );
  }
  if (result.skipped > 0) {
    parts.push(
      `Skipped ${result.skipped} unknown destination${result.skipped === 1 ? "" : "s"}.`,
    );
  }
  if (parts.length === 0) {
    return "No wishlist items were added from that file.";
  }
  return parts.join(" ");
}
