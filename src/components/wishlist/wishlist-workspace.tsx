"use client";

import { DestinationCard } from "@/components/destinations/destination-card";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { destinations, getDestinationBySlug } from "@/data/destinations";
import {
  backupFilename,
  backupInvalidMessage,
  backupTooLargeMessage,
  buildWishlistBackup,
  downloadJsonBackup,
  importWishlistBackup,
  readBackupFile,
  wishlistBackupEmptyMessage,
  wishlistImportSuccessMessage,
} from "@/lib/local-backup";
import { useIsClient } from "@/lib/use-is-client";
import {
  getServerWishlistSnapshot,
  getWishlistSnapshot,
  removeFromWishlist,
  subscribeWishlist,
  wishlistErrorMessage,
} from "@/lib/wishlist-storage";
import { cn } from "@/lib/utils";
import { Download, Upload } from "lucide-react";
import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from "react";

export function WishlistWorkspace() {
  const slugs = useSyncExternalStore(
    subscribeWishlist,
    getWishlistSnapshot,
    getServerWishlistSnapshot,
  );
  const hydrated = useIsClient();
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    return slugs
      .map((slug) => getDestinationBySlug(slug))
      .filter((d): d is NonNullable<typeof d> => Boolean(d));
  }, [slugs]);

  function onRemove(slug: string) {
    const result = removeFromWishlist(slug);
    if (!result.ok) {
      setFeedback(null);
      setError(wishlistErrorMessage(result.reason));
      return;
    }
    setError(null);
    setFeedback("Removed from wishlist.");
  }

  function onExportBackup() {
    if (slugs.length === 0) {
      setFeedback(null);
      setError(wishlistBackupEmptyMessage());
      return;
    }
    downloadJsonBackup(buildWishlistBackup(slugs), backupFilename("wishlist"));
    setError(null);
    setFeedback(
      "Downloaded a local JSON backup of your wishlist. This is a file on your device — not cloud sync.",
    );
  }

  async function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const parsed = await readBackupFile(file);
    if (!parsed.ok) {
      setFeedback(null);
      setError(
        parsed.reason === "too_large"
          ? backupTooLargeMessage()
          : backupInvalidMessage(),
      );
      return;
    }
    if (!parsed.backup.wishlistSlugs?.length) {
      setFeedback(null);
      setError(backupInvalidMessage());
      return;
    }
    const result = importWishlistBackup(parsed.backup);
    if (!result.ok) {
      setFeedback(null);
      setError(wishlistErrorMessage(result.reason));
      return;
    }
    setError(null);
    setFeedback(wishlistImportSuccessMessage(result));
  }

  return (
    <div className="container-page py-10 md:py-14" data-testid="wishlist-page">
      <p className="text-caption font-semibold uppercase tracking-[0.18em] text-deep-green">
        Atlas
      </p>
      <h1 className="mt-2 text-h1">Wishlist</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Destinations you save stay in this browser only — no cloud sync. We
        store destination ids, not copies of the catalog. Export a local JSON
        file below if you want a device-side copy.
      </p>

      {hydrated ? (
        <div
          className="mt-6 flex flex-col gap-3 rounded-[var(--radius-lg)] bg-white p-4 shadow-[var(--shadow-soft)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          data-testid="wishlist-backup"
        >
          <p className="max-w-xl text-body-sm text-muted">
            Local file backup only — export or restore JSON on this device. Not
            cloud sync.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              data-testid="wishlist-backup-export"
              onClick={onExportBackup}
            >
              <Download className="mr-1.5 h-4 w-4" aria-hidden />
              Export JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              data-testid="wishlist-backup-import"
              onClick={() => importInputRef.current?.click()}
            >
              <Upload className="mr-1.5 h-4 w-4" aria-hidden />
              Import JSON
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              data-testid="wishlist-backup-file"
              aria-label="Import wishlist JSON backup"
              onChange={onImportFile}
            />
          </div>
        </div>
      ) : null}

      {feedback ? (
        <p
          className="mt-4 rounded-[var(--radius-md)] bg-forest/8 px-4 py-3 text-body-sm text-forest"
          role="status"
          data-testid="wishlist-feedback"
        >
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p
          className="mt-4 rounded-[var(--radius-md)] bg-danger/10 px-4 py-3 text-body-sm text-danger"
          role="alert"
          data-testid="wishlist-error"
        >
          {error}
        </p>
      ) : null}

      {!hydrated ? (
        <p className="mt-10 text-muted" data-testid="wishlist-loading">
          Loading wishlist…
        </p>
      ) : null}

      {hydrated && items.length === 0 ? (
        <div
          className="mt-12 max-w-lg text-center sm:text-left"
          data-testid="wishlist-empty"
        >
          <h2 className="text-h2">No destinations saved</h2>
          <p className="mt-3 text-muted">
            Browse the atlas and add routes you want to revisit. Unavailable
            destinations are removed automatically.
          </p>
          <Link
            href="/destinations"
            className={cn(
              buttonVariants({ variant: "primary", size: "lg" }),
              "mt-8",
            )}
            data-testid="wishlist-empty-cta"
          >
            Browse destinations
          </Link>
        </div>
      ) : null}

      {hydrated && items.length > 0 ? (
        <ul
          className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="wishlist-list"
        >
          {items.map((destination) => (
            <li key={destination.slug} data-testid={`wishlist-item-${destination.slug}`}>
              <div className="flex h-full flex-col gap-3">
                <DestinationCard
                  destination={destination}
                  showWishlist={false}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  data-testid={`wishlist-remove-${destination.slug}`}
                  onClick={() => onRemove(destination.slug)}
                >
                  Remove from wishlist
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {hydrated ? (
        <p className="mt-10 text-caption text-muted">
          {destinations.length} destinations in the atlas · {items.length} on
          your wishlist
        </p>
      ) : null}
    </div>
  );
}
