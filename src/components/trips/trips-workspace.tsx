"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { daysBetween, formatDateRange, formatIdr } from "@/lib/format";
import {
  backupFilename,
  backupInvalidMessage,
  backupTooLargeMessage,
  buildTripsBackup,
  downloadJsonBackup,
  importTripsBackup,
  readBackupFile,
  tripsBackupEmptyMessage,
  tripsImportSuccessMessage,
} from "@/lib/local-backup";
import { activateSavedTrip } from "@/lib/storage";
import {
  countTripIdConflicts,
  deleteSavedTrip,
  duplicateSavedTrip,
  getSavedTripsSnapshot,
  getServerSavedTripsSnapshot,
  renameSavedTrip,
  storageErrorMessage,
  subscribeSavedTrips,
  tripDisplayTitle,
  type DuplicateTripPolicy,
  type StorageWriteResult,
} from "@/lib/trips-storage";
import type { LocalBackup } from "@/lib/schemas";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";
import type { Itinerary } from "@/types";
import { Copy, Download, Pencil, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from "react";

export function TripsWorkspace() {
  const router = useRouter();
  const trips = useSyncExternalStore(
    subscribeSavedTrips,
    getSavedTripsSnapshot,
    getServerSavedTripsSnapshot,
  );
  const hydrated = useIsClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Itinerary | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleting, setDeleting] = useState<Itinerary | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    backup: LocalBackup;
    conflicts: number;
  } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  function reportResult(result: StorageWriteResult, successMessage: string) {
    if (result.ok) {
      setError(null);
      setFeedback(successMessage);
      return true;
    }
    setFeedback(null);
    setError(storageErrorMessage(result.reason));
    return false;
  }

  function openTrip(trip: Itinerary) {
    const result = activateSavedTrip(trip);
    if (!reportResult(result, "Trip opened for editing.")) return;
    router.push("/itinerary");
  }

  function onRenameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    const result = renameSavedTrip(renaming.id, renameDraft);
    if (reportResult(result, "Trip renamed.")) {
      setRenaming(null);
    }
  }

  function onConfirmDelete() {
    if (!deleting) return;
    const result = deleteSavedTrip(deleting.id);
    if (reportResult(result, "Trip deleted.")) {
      setDeleting(null);
    }
  }

  function onDuplicate(trip: Itinerary) {
    const result = duplicateSavedTrip(trip.id);
    if (result.ok) {
      reportResult(result, "Independent copy created.");
    } else {
      reportResult(result, "");
    }
  }

  function onExportBackup() {
    if (trips.length === 0) {
      setFeedback(null);
      setError(tripsBackupEmptyMessage());
      return;
    }
    downloadJsonBackup(buildTripsBackup(trips), backupFilename("trips"));
    setError(null);
    setFeedback(
      "Downloaded a local JSON backup of your trips. This is a file on your device — not cloud sync.",
    );
  }

  function applyTripsImport(
    backup: LocalBackup,
    onDuplicate: DuplicateTripPolicy,
  ) {
    const result = importTripsBackup(backup, { onDuplicate });
    if (!result.ok) {
      setFeedback(null);
      setError(storageErrorMessage(result.reason));
      return;
    }
    setError(null);
    setFeedback(tripsImportSuccessMessage(result));
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
    if (!parsed.backup.trips?.length) {
      setFeedback(null);
      setError(backupInvalidMessage());
      return;
    }
    const conflicts = countTripIdConflicts(parsed.backup.trips);
    if (conflicts > 0) {
      setPendingImport({ backup: parsed.backup, conflicts });
      setError(null);
      return;
    }
    applyTripsImport(parsed.backup, "skip");
  }

  const showEmpty = hydrated && trips.length === 0;

  return (
    <div className="container-page py-10 md:py-14" data-testid="trips-page">
      <p className="text-caption font-semibold uppercase tracking-[0.18em] text-deep-green">
        Library
      </p>
      <h1 className="mt-2 text-h1">My Trips</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Saved demo itineraries stay in this browser only — not synced across
        devices. Clearing site data can remove them permanently. Use a local
        JSON backup below if you want a file copy on this device.
      </p>

      {hydrated ? (
        <div
          className="mt-6 flex flex-col gap-3 rounded-[var(--radius-lg)] bg-white p-4 shadow-[var(--shadow-soft)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          data-testid="trips-backup"
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
              data-testid="trips-backup-export"
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
              data-testid="trips-backup-import"
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
              data-testid="trips-backup-file"
              aria-label="Import trips JSON backup"
              onChange={onImportFile}
            />
          </div>
        </div>
      ) : null}

      {feedback ? (
        <p
          className="mt-4 rounded-[var(--radius-md)] bg-forest/8 px-4 py-3 text-body-sm text-forest"
          role="status"
          data-testid="trips-feedback"
        >
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p
          className="mt-4 rounded-[var(--radius-md)] bg-danger/10 px-4 py-3 text-body-sm text-danger"
          role="alert"
          data-testid="trips-error"
        >
          {error}
        </p>
      ) : null}

      {!hydrated ? (
        <p className="mt-10 text-muted" data-testid="trips-loading">
          Loading saved trips…
        </p>
      ) : null}

      {showEmpty ? (
        <div
          className="mt-12 max-w-lg text-center sm:text-left"
          data-testid="trips-empty"
        >
          <h2 className="text-h2">No saved trips yet</h2>
          <p className="mt-3 text-muted">
            Generate a demo plan to start your library. Each new plan is saved
            locally so you can reopen, rename, or duplicate it later.
          </p>
          <Link
            href="/plan"
            className={cn(
              buttonVariants({ variant: "primary", size: "lg" }),
              "mt-8",
            )}
            data-testid="trips-empty-cta"
          >
            Plan your route
          </Link>
        </div>
      ) : null}

      {hydrated && trips.length > 0 ? (
        <ul className="mt-10 space-y-4" data-testid="trips-list">
          {trips.map((trip) => {
            const duration = daysBetween(trip.startDate, trip.endDate);
            const title = tripDisplayTitle(trip);
            const customTitle = Boolean(trip.title?.trim());
            return (
              <li
                key={trip.id}
                className="rounded-[var(--radius-lg)] bg-white p-5 shadow-[var(--shadow-soft)]"
                data-testid={`trip-card-${trip.id}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-h3 text-forest">{title}</h2>
                    {customTitle ? (
                      <p className="mt-1 text-body-sm text-muted">
                        {trip.destinationName}
                      </p>
                    ) : null}
                    <dl className="mt-4 grid gap-2 text-body-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted">Duration</dt>
                        <dd className="font-medium text-forest">
                          {duration} day{duration === 1 ? "" : "s"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Dates</dt>
                        <dd className="font-medium text-forest">
                          {trip.startDate && trip.endDate
                            ? formatDateRange(trip.startDate, trip.endDate)
                            : "Dates unavailable"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Travelers</dt>
                        <dd className="font-medium text-forest">
                          {trip.travelers}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Estimated budget</dt>
                        <dd
                          className="font-medium text-forest"
                          data-testid={`trip-budget-${trip.id}`}
                        >
                          {formatIdr(trip.budget.total)}{" "}
                          <span className="font-normal text-muted">
                            (demo)
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:max-w-sm lg:justify-end">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="min-h-11 grow sm:grow-0"
                      data-testid={`trip-open-${trip.id}`}
                      onClick={() => openTrip(trip)}
                    >
                      Open & edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      data-testid={`trip-rename-${trip.id}`}
                      onClick={() => {
                        setRenaming(trip);
                        setRenameDraft(tripDisplayTitle(trip));
                        setError(null);
                      }}
                    >
                      <Pencil className="mr-1.5 h-4 w-4" aria-hidden />
                      Rename
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      data-testid={`trip-duplicate-${trip.id}`}
                      onClick={() => onDuplicate(trip)}
                    >
                      <Copy className="mr-1.5 h-4 w-4" aria-hidden />
                      Duplicate
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      className="min-h-11"
                      data-testid={`trip-delete-${trip.id}`}
                      onClick={() => {
                        setDeleting(trip);
                        setError(null);
                      }}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Dialog
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title="Rename trip"
        description="This name is stored locally with the trip."
      >
        <form onSubmit={onRenameSubmit} className="space-y-4">
          <div>
            <Label htmlFor="trip-rename-input">Trip name</Label>
            <Input
              id="trip-rename-input"
              data-testid="trip-rename-input"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              maxLength={120}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" data-testid="trip-rename-save">
              Save name
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenaming(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this trip?"
        description="This removes the saved plan from this browser. It cannot be undone."
      >
        <p className="text-body-sm text-muted">
          {deleting ? tripDisplayTitle(deleting) : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="danger"
            data-testid="trip-delete-confirm"
            onClick={onConfirmDelete}
          >
            Delete trip
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleting(null)}
          >
            Cancel
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(pendingImport)}
        onClose={() => setPendingImport(null)}
        title="Replace existing trips?"
        description={
          pendingImport
            ? `${pendingImport.conflicts} trip${pendingImport.conflicts === 1 ? "" : "s"} in this file already exist in your library. Choose whether to keep yours or replace them.`
            : undefined
        }
      >
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            data-testid="trips-import-skip-duplicates"
            onClick={() => {
              if (!pendingImport) return;
              const backup = pendingImport.backup;
              setPendingImport(null);
              applyTripsImport(backup, "skip");
            }}
          >
            Keep existing
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid="trips-import-replace-duplicates"
            onClick={() => {
              if (!pendingImport) return;
              const backup = pendingImport.backup;
              setPendingImport(null);
              applyTripsImport(backup, "replace");
            }}
          >
            Replace existing
          </Button>
          <Button
            type="button"
            variant="ghost"
            data-testid="trips-import-cancel"
            onClick={() => setPendingImport(null)}
          >
            Cancel
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
