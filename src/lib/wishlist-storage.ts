import { getDestinationBySlug } from "@/data/destinations";
import { wishlistStoreSchema } from "@/lib/schemas";

export const WISHLIST_KEY = "mardalani_wishlist_v1";

export type WishlistFailureReason = "unavailable" | "quota" | "invalid";

export type WishlistWriteResult =
  | { ok: true }
  | { ok: false; reason: WishlistFailureReason };

type Listener = () => void;
const listeners = new Set<Listener>();

const SERVER_SLUGS: string[] = [];

let cachedRaw: string | null | undefined = undefined;
let cachedSlugs: string[] = SERVER_SLUGS;

function emitChange() {
  listeners.forEach((l) => l());
}

function canUseLocalStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const probe = "__mardalani_wish_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function parseStore(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const json: unknown = JSON.parse(raw);
    const result = wishlistStoreSchema.safeParse(json);
    if (!result.success) {
      if (Array.isArray(json)) {
        return json.filter(
          (s): s is string => typeof s === "string" && s.length > 0,
        );
      }
      return [];
    }
    return result.data.slugs;
  } catch {
    return [];
  }
}

/** Drop slugs that no longer exist in the catalog. */
function sanitizeSlugs(slugs: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const slug of slugs) {
    if (seen.has(slug)) continue;
    if (!getDestinationBySlug(slug)) continue;
    seen.add(slug);
    next.push(slug);
  }
  return next;
}

function readRaw(): string | null {
  if (!canUseLocalStorage()) return null;
  try {
    return localStorage.getItem(WISHLIST_KEY);
  } catch {
    return null;
  }
}

function writeStore(slugs: string[]): WishlistWriteResult {
  if (!canUseLocalStorage()) return { ok: false, reason: "unavailable" };
  try {
    const cleaned = sanitizeSlugs(slugs);
    const payload = wishlistStoreSchema.parse({
      version: 1 as const,
      slugs: cleaned,
    });
    const raw = JSON.stringify(payload);
    localStorage.setItem(WISHLIST_KEY, raw);
    cachedRaw = raw;
    cachedSlugs = cleaned;
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

function refreshCache(): string[] {
  const raw = readRaw();
  if (raw === cachedRaw && cachedRaw !== undefined) {
    return cachedSlugs;
  }
  cachedRaw = raw;
  const parsed = sanitizeSlugs(parseStore(raw));
  if (raw && parsed.length === 0) {
    try {
      const probe = JSON.parse(raw) as unknown;
      const ok = wishlistStoreSchema.safeParse(probe).success;
      if (!ok && !Array.isArray(probe)) {
        localStorage.removeItem(WISHLIST_KEY);
        cachedRaw = null;
      }
    } catch {
      try {
        localStorage.removeItem(WISHLIST_KEY);
      } catch {
        /* ignore */
      }
      cachedRaw = null;
    }
  }
  // Persist prune of invalid refs so storage stays clean.
  const original = parseStore(raw);
  if (
    raw &&
    (original.length !== parsed.length ||
      original.some((s, i) => s !== parsed[i]))
  ) {
    writeStore(parsed);
    return cachedSlugs;
  }
  cachedSlugs = parsed;
  return cachedSlugs;
}

export function listWishlistSlugs(): string[] {
  if (!canUseLocalStorage()) return [];
  return refreshCache();
}

export function isInWishlist(slug: string): boolean {
  return listWishlistSlugs().includes(slug);
}

export function addToWishlist(slug: string): WishlistWriteResult {
  if (!getDestinationBySlug(slug)) return { ok: false, reason: "invalid" };
  const current = listWishlistSlugs();
  if (current.includes(slug)) return { ok: true };
  return writeStore([slug, ...current]);
}

export function removeFromWishlist(slug: string): WishlistWriteResult {
  const current = listWishlistSlugs();
  if (!current.includes(slug)) return { ok: true };
  return writeStore(current.filter((s) => s !== slug));
}

export function toggleWishlist(slug: string): WishlistWriteResult & {
  added?: boolean;
} {
  if (isInWishlist(slug)) {
    const result = removeFromWishlist(slug);
    return result.ok ? { ok: true, added: false } : result;
  }
  const result = addToWishlist(slug);
  return result.ok ? { ok: true, added: true } : result;
}

/**
 * Union imported destination slugs into the wishlist (invalid catalog refs dropped).
 * `imported` counts only slugs that were not already present.
 */
export function mergeImportedWishlist(
  incoming: string[],
): WishlistWriteResult & {
  imported: number;
  skipped: number;
  duplicatesSkipped: number;
} {
  let skipped = 0;
  const cleanedIncoming: string[] = [];
  const seen = new Set<string>();

  for (const slug of incoming) {
    if (typeof slug !== "string" || !slug.trim()) {
      skipped += 1;
      continue;
    }
    const trimmed = slug.trim();
    if (!getDestinationBySlug(trimmed)) {
      skipped += 1;
      continue;
    }
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    cleanedIncoming.push(trimmed);
  }

  if (cleanedIncoming.length === 0) {
    return {
      ok: false,
      reason: "invalid",
      imported: 0,
      skipped,
      duplicatesSkipped: 0,
    };
  }

  const current = listWishlistSlugs();
  const currentSet = new Set(current);
  const newlyAdded = cleanedIncoming.filter((s) => !currentSet.has(s));
  const duplicatesSkipped = cleanedIncoming.length - newlyAdded.length;

  if (newlyAdded.length === 0) {
    return {
      ok: true,
      imported: 0,
      skipped,
      duplicatesSkipped,
    };
  }

  const merged = [...newlyAdded, ...current];
  const result = writeStore(merged);
  if (!result.ok) {
    return { ...result, imported: 0, skipped, duplicatesSkipped };
  }
  return {
    ok: true,
    imported: newlyAdded.length,
    skipped,
    duplicatesSkipped,
  };
}

export function subscribeWishlist(onStoreChange: Listener): () => void {
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

export function getWishlistSnapshot(): string[] {
  return listWishlistSlugs();
}

export function getServerWishlistSnapshot(): string[] {
  return SERVER_SLUGS;
}

export function wishlistErrorMessage(reason: WishlistFailureReason): string {
  switch (reason) {
    case "quota":
      return "Browser storage is full. Remove a wishlist item or free space, then try again.";
    case "unavailable":
      return "Local storage is unavailable in this browser.";
    case "invalid":
    default:
      return "Could not update the wishlist for that destination.";
  }
}
