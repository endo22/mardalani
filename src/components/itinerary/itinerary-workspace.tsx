"use client";

import { AnimatedIdr } from "@/components/ui/animated-number";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getAdjacentAreas,
  getAttractionCatalog,
  type Attraction,
} from "@/data/attractions";
import {
  addActivityToDays,
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_LABELS,
  categorySharePercent,
  estimatedCostPerPerson,
  getDayScheduleWarnings,
  getOptimizationSuggestions,
  inferCostKind,
  manualExpenseTripCost,
  moveActivityBetweenDays,
  recalculateBudget,
  removeActivityFromDays,
  removeManualExpense,
  scaleDemoCost,
  updateActivityInDays,
  upsertManualExpense,
  validateManualExpenseDraft,
} from "@/lib/budget";
import { exportItineraryToPdf } from "@/lib/export-itinerary-pdf";
import { formatDateLong, formatDateRange, formatIdr } from "@/lib/format";
import {
  getItinerarySnapshot,
  getServerItinerarySnapshot,
  saveItinerary,
  subscribeItinerary,
} from "@/lib/storage";
import { useIsClient } from "@/lib/use-is-client";
import { cn, createId } from "@/lib/utils";
import type {
  Activity,
  ActivityCategory,
  ActivityCostKind,
  Itinerary,
  ManualExpense,
} from "@/types";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FileDown, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export function ItineraryWorkspace() {
  const hydrated = useIsClient();
  const itinerary = useSyncExternalStore(
    subscribeItinerary,
    getItinerarySnapshot,
    getServerItinerarySnapshot,
  );
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [adding, setAdding] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Activity | null>(null);
  const [expenseEditing, setExpenseEditing] = useState<ManualExpense | null>(
    null,
  );
  const [expenseAdding, setExpenseAdding] = useState(false);
  const [pendingExpenseDelete, setPendingExpenseDelete] =
    useState<ManualExpense | null>(null);
  const [budgetCapDraft, setBudgetCapDraft] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const exportInFlight = useRef(false);
  const reduce = useReducedMotion();

  const resolvedDay =
    activeDay ?? itinerary?.days[0]?.dayNumber ?? 1;

  const persist = useCallback((next: Itinerary) => {
    const expenses = next.manualExpenses ?? [];
    const withBudget: Itinerary = {
      ...next,
      manualExpenses: expenses,
      updatedAt: new Date().toISOString(),
      budget: recalculateBudget(next.days, next.budget.budgetCap, {
        manualExpenses: expenses,
        travelers: next.travelers,
      }),
    };
    const result = saveItinerary(withBudget);
    if (!result.active.ok) {
      setPersistError(
        result.active.reason === "quota"
          ? "Browser storage is full — this edit could not be saved in the active session."
          : "Could not save this edit in the active session.",
      );
      return;
    }
    if (!result.library.ok) {
      setPersistError(
        result.library.reason === "quota"
          ? "Active session updated, but My Trips library could not be saved (storage full)."
          : "Active session updated, but My Trips library could not be saved.",
      );
      return;
    }
    setPersistError(null);
  }, []);

  const day = itinerary?.days.find((d) => d.dayNumber === resolvedDay);
  const manualExpenses = itinerary?.manualExpenses ?? [];
  const catalog = itinerary
    ? getAttractionCatalog(itinerary.destinationSlug)
    : [];
  const suggestions = useMemo(() => {
    if (!itinerary) return [];
    const destCatalog = getAttractionCatalog(itinerary.destinationSlug);
    return getOptimizationSuggestions({
      days: itinerary.days,
      budget: itinerary.budget,
      catalog: destCatalog,
      travelers: itinerary.travelers,
      style: itinerary.travelStyle,
      tier: itinerary.budgetTier,
      transport: itinerary.transport,
    });
  }, [itinerary]);
  const scheduleWarnings = useMemo(() => {
    if (!day || !itinerary) return [];
    const slug = itinerary.destinationSlug;
    return getDayScheduleWarnings(day.activities, {
      destinationSlug: slug,
      transport: itinerary.transport,
      getAdjacentAreas: (areaId) => getAdjacentAreas(slug, areaId),
    });
  }, [day, itinerary]);
  const isScaffold =
    Boolean(itinerary?.generationNote?.toLowerCase().includes("scaffold"));
  const perPerson = itinerary
    ? estimatedCostPerPerson(itinerary.budget.total, itinerary.travelers)
    : 0;

  if (!hydrated) {
    return (
      <div
        className="container-narrow py-20"
        data-testid="itinerary-loading"
        aria-busy="true"
      >
        <p className="text-muted">Loading itinerary…</p>
      </div>
    );
  }

  if (!itinerary) {
    return (
      <div className="container-narrow py-20 text-center">
        <h1 className="text-h1">No itinerary in this session</h1>
        <p className="mt-4 text-muted">
          Generate a demo plan or open one from My Trips. The active editor uses
          this tab’s session; saved trips stay in local browser storage only —
          not synced across devices.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/plan"
            className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
          >
            Plan your route
          </Link>
          <Link
            href="/trips"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            data-testid="empty-open-trips"
          >
            Open My Trips
          </Link>
        </div>
      </div>
    );
  }

  function onSaveActivity(activity: Activity) {
    if (!itinerary || !day) return;
    const days = editing
      ? updateActivityInDays(itinerary.days, day.dayNumber, activity.id, activity)
      : addActivityToDays(itinerary.days, day.dayNumber, activity);
    persist({ ...itinerary, days });
    setEditing(null);
    setAdding(false);
  }

  function onConfirmDelete() {
    if (!itinerary || !day || !pendingDelete) return;
    const days = removeActivityFromDays(
      itinerary.days,
      day.dayNumber,
      pendingDelete.id,
    );
    persist({ ...itinerary, days });
    setPendingDelete(null);
  }

  function onMoveToDay(activityId: string, toDayNumber: number) {
    if (!itinerary || !day) return;
    const days = moveActivityBetweenDays(
      itinerary.days,
      day.dayNumber,
      toDayNumber,
      activityId,
    );
    persist({ ...itinerary, days });
  }

  function onAddFromCatalog(attraction: Attraction) {
    if (!itinerary || !day) return;
    const costKind = attraction.costKind;
    const activity: Activity = {
      id: createId("act"),
      catalogId: attraction.id,
      name: attraction.name,
      time: attraction.defaultTime ?? "10:00",
      durationHours: attraction.durationHours,
      costIdr: scaleDemoCost(
        attraction.baseCostIdr,
        itinerary.travelStyle,
        itinerary.budgetTier,
        itinerary.transport,
        itinerary.travelers,
        attraction.category,
        costKind,
      ),
      category: attraction.category,
      description: attraction.description,
      location: attraction.location,
      areaId: attraction.areaId,
      costKind,
    };
    const days = addActivityToDays(itinerary.days, day.dayNumber, activity);
    persist({ ...itinerary, days });
    setCatalogOpen(false);
  }

  function onSaveExpense(expense: ManualExpense) {
    if (!itinerary) return;
    persist({
      ...itinerary,
      manualExpenses: upsertManualExpense(manualExpenses, expense),
    });
    setExpenseAdding(false);
    setExpenseEditing(null);
  }

  function onConfirmExpenseDelete() {
    if (!itinerary || !pendingExpenseDelete) return;
    persist({
      ...itinerary,
      manualExpenses: removeManualExpense(
        manualExpenses,
        pendingExpenseDelete.id,
      ),
    });
    setPendingExpenseDelete(null);
  }

  function onApplyBudgetCap() {
    if (!itinerary || budgetCapDraft === null) return;
    const next = Number(budgetCapDraft);
    if (!Number.isFinite(next) || next < 0) return;
    persist({
      ...itinerary,
      budget: { ...itinerary.budget, budgetCap: next },
    });
    setBudgetCapDraft(null);
  }

  function onApplyReplaceSuggestion(suggestionId: string) {
    if (!itinerary) return;
    const tip = suggestions.find((s) => s.id === suggestionId);
    if (!tip?.replace) return;
    const attraction = catalog.find((c) => c.id === tip.replace!.toCatalogId);
    if (!attraction) return;
    const costKind = attraction.costKind;
    const patch: Partial<Activity> = {
      catalogId: attraction.id,
      name: attraction.name,
      durationHours: attraction.durationHours,
      costIdr: scaleDemoCost(
        attraction.baseCostIdr,
        itinerary.travelStyle,
        itinerary.budgetTier,
        itinerary.transport,
        itinerary.travelers,
        attraction.category,
        costKind,
      ),
      category: attraction.category,
      description: attraction.description,
      location: attraction.location,
      areaId: attraction.areaId,
      costKind,
    };
    const days = updateActivityInDays(
      itinerary.days,
      tip.replace.dayNumber,
      tip.replace.activityId,
      patch,
    );
    persist({ ...itinerary, days });
  }

  async function onExportPdf() {
    if (!itinerary || exportInFlight.current) return;
    exportInFlight.current = true;
    setExportingPdf(true);
    setExportError(null);
    try {
      // Recalculate once so PDF matches the live budget panel after edits.
      const expenses = itinerary.manualExpenses ?? [];
      const snapshot: Itinerary = {
        ...itinerary,
        manualExpenses: expenses,
        budget: recalculateBudget(itinerary.days, itinerary.budget.budgetCap, {
          manualExpenses: expenses,
          travelers: itinerary.travelers,
        }),
      };
      await exportItineraryToPdf(snapshot);
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : "Gagal mengekspor PDF. Coba lagi dari browser yang sama.";
      setExportError(message);
    } finally {
      exportInFlight.current = false;
      setExportingPdf(false);
    }
  }

  const capValue =
    budgetCapDraft ?? String(itinerary.budget.budgetCap);

  return (
    <div className="container-page py-10 md:py-14">
      <div className="flex flex-col gap-4 border-b border-forest/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.18em] text-deep-green">
            Demo itinerary
          </p>
          <h1 className="mt-2 text-h1">{itinerary.destinationName}</h1>
          <p className="mt-2 text-muted">
            {formatDateRange(itinerary.startDate, itinerary.endDate)} ·{" "}
            {itinerary.travelers} traveler
            {itinerary.travelers > 1 ? "s" : ""} · {itinerary.travelStyle}
            {(itinerary.interests?.length ?? 0) > 0
              ? ` · ${itinerary.interests!.join(", ")}`
              : ""}
          </p>
          <p className="mt-3 max-w-2xl text-body-sm text-muted">
            {itinerary.generationNote}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => void onExportPdf()}
              disabled={exportingPdf}
              aria-busy={exportingPdf}
              data-testid="export-pdf"
              className="min-h-11 min-w-[10.5rem]"
            >
              <FileDown className="h-4 w-4" aria-hidden />
              {exportingPdf ? "Menyiapkan PDF…" : "Export PDF"}
            </Button>
            <Link
              href="/plan"
              className={buttonVariants({ variant: "outline" })}
            >
              Plan another trip
            </Link>
            <Link
              href="/trips"
              className={buttonVariants({ variant: "ghost" })}
              data-testid="itinerary-my-trips"
            >
              My Trips
            </Link>
          </div>
          {exportError ? (
            <p
              className="max-w-sm text-body-sm text-danger"
              role="alert"
              data-testid="export-pdf-error"
            >
              {exportError}
            </p>
          ) : (
            <p className="max-w-sm text-caption text-muted" data-testid="export-pdf-hint">
              Unduh ringkasan itinerary + anggaran (estimasi demo) dari trip
              aktif di sesi ini saja.
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 rounded-[var(--radius-md)] bg-gold/15 px-4 py-3 text-body-sm text-forest">
        Edits update the active session and the matching saved trip in this
        browser. Data is local only — not synced across devices.
      </p>
      {persistError ? (
        <p
          className="mt-3 rounded-[var(--radius-md)] bg-danger/10 px-4 py-3 text-body-sm text-danger"
          role="alert"
          data-testid="persist-error"
        >
          {persistError}
        </p>
      ) : null}

      {isScaffold ? (
        <p
          className="mt-3 rounded-[var(--radius-md)] border border-deep-green/25 bg-deep-green/10 px-4 py-3 text-body-sm text-forest"
          role="status"
        >
          Preview scaffold itinerary — days and costs are illustrative fallbacks,
          not a verified full template for this destination. Adjust manually if
          needed.
        </p>
      ) : null}

      {(itinerary.constraintNotes?.length ?? 0) > 0 ? (
        <div
          className="mt-4 rounded-[var(--radius-md)] border border-forest/10 bg-white px-4 py-3 shadow-[var(--shadow-soft)]"
          data-testid="constraint-notes"
          role="region"
          aria-label="How this plan was built"
        >
          <p className="text-caption font-semibold uppercase tracking-[0.14em] text-deep-green">
            How this plan was built
          </p>
          <ul className="mt-2 space-y-1.5 text-body-sm text-muted">
            {itinerary.constraintNotes!.map((note) => (
              <li key={note}>· {note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div>
          <div
            role="tablist"
            aria-label="Itinerary days"
            className="hide-scrollbar flex gap-2 overflow-x-auto overflow-y-hidden pb-2"
          >
            {itinerary.days.map((d) => {
              const selected = resolvedDay === d.dayNumber;
              return (
                <button
                  key={d.dayNumber}
                  type="button"
                  role="tab"
                  id={`day-tab-${d.dayNumber}`}
                  aria-selected={selected}
                  aria-controls={`day-panel-${d.dayNumber}`}
                  tabIndex={selected ? 0 : -1}
                  className={`min-h-11 cursor-pointer whitespace-nowrap rounded-[var(--radius-md)] px-4 py-2 text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${
                    selected
                      ? "bg-forest text-cream"
                      : "bg-white text-forest ring-1 ring-forest/15 hover:bg-forest/5"
                  }`}
                  onClick={() => setActiveDay(d.dayNumber)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                    e.preventDefault();
                    const idx = itinerary.days.findIndex(
                      (dayItem) => dayItem.dayNumber === d.dayNumber,
                    );
                    const delta = e.key === "ArrowRight" ? 1 : -1;
                    const next =
                      itinerary.days[
                        (idx + delta + itinerary.days.length) %
                          itinerary.days.length
                      ];
                    if (!next) return;
                    setActiveDay(next.dayNumber);
                    queueMicrotask(() => {
                      document
                        .getElementById(`day-tab-${next.dayNumber}`)
                        ?.focus();
                    });
                  }}
                >
                  Day {d.dayNumber}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {day ? (
              <motion.div
                key={day.dayNumber}
                id={`day-panel-${day.dayNumber}`}
                role="tabpanel"
                aria-labelledby={`day-tab-${day.dayNumber}`}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="mt-6"
              >
                <h2 className="text-h2">{day.title}</h2>
                <p className="mt-1 text-body-sm text-muted">
                  {formatDateLong(day.date)} · {day.summary}
                </p>

                {scheduleWarnings.length > 0 ? (
                  <ul
                    className="mt-4 space-y-2"
                    data-testid="schedule-warnings"
                    role="status"
                  >
                    {scheduleWarnings.map((w) => (
                      <li
                        key={`${w.type}-${w.message}`}
                        className="rounded-[var(--radius-md)] border border-gold/40 bg-gold/10 px-3 py-2 text-caption text-forest"
                      >
                        {w.message}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <ul className="mt-6 space-y-3">
                  <AnimatePresence initial={false}>
                    {day.activities.map((activity) => (
                      <motion.li
                        key={activity.id}
                        layout={!reduce}
                        initial={reduce ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0, height: 0 }}
                        className="rounded-[var(--radius-lg)] bg-white p-4 shadow-[var(--shadow-soft)]"
                        data-catalog-id={activity.catalogId ?? undefined}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-caption font-semibold uppercase tracking-wider text-gold">
                              {activity.time} · {activity.durationHours}h ·{" "}
                              {BUDGET_CATEGORY_LABELS[activity.category]}
                            </p>
                            <h3 className="mt-1 text-h3">{activity.name}</h3>
                            <p className="mt-1 text-body-sm text-muted">
                              {activity.description}
                            </p>
                            {activity.location ? (
                              <p className="mt-1 text-caption text-muted-soft">
                                {activity.location}
                              </p>
                            ) : null}
                            {activity.notes ? (
                              <p className="mt-2 text-caption italic text-forest/80">
                                Note: {activity.notes}
                              </p>
                            ) : null}
                            {itinerary.days.length > 1 ? (
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Label
                                  htmlFor={`move-${activity.id}`}
                                  className="text-caption text-muted"
                                >
                                  Move to day
                                </Label>
                                <Select
                                  id={`move-${activity.id}`}
                                  aria-label={`Move ${activity.name} to another day`}
                                  value={String(day.dayNumber)}
                                  onChange={(e) =>
                                    onMoveToDay(
                                      activity.id,
                                      Number(e.target.value),
                                    )
                                  }
                                  className="max-w-[8rem]"
                                >
                                  {itinerary.days.map((d) => (
                                    <option
                                      key={d.dayNumber}
                                      value={d.dayNumber}
                                    >
                                      Day {d.dayNumber}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="font-semibold tabular-nums text-forest">
                              {formatIdr(activity.costIdr)}
                            </p>
                            <div className="mt-2 flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit ${activity.name}`}
                                onClick={() => {
                                  setEditing(activity);
                                  setAdding(false);
                                }}
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove ${activity.name}`}
                                onClick={() => setPendingDelete(activity)}
                              >
                                <Trash2 className="h-4 w-4 text-danger" aria-hidden />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                {day.activities.length === 0 ? (
                  <p
                    className="mt-6 rounded-[var(--radius-md)] bg-cream px-4 py-6 text-center text-muted"
                    data-testid="empty-day"
                  >
                    No activities on this day. Add from the catalog or create a
                    custom activity.
                  </p>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2">
                  {catalog.length > 0 ? (
                    <Button
                      variant="primary"
                      onClick={() => setCatalogOpen(true)}
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Add from catalog
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAdding(true);
                      setEditing(null);
                    }}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Add custom activity
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <aside
          className="h-fit rounded-[var(--radius-lg)] bg-forest p-5 text-cream shadow-[var(--shadow-lift)] lg:sticky lg:top-24"
          data-testid="budget-panel"
        >
          <p className="text-caption font-semibold uppercase tracking-[0.16em] text-gold">
            Budget snapshot
          </p>
          <p className="mt-3 text-body-sm text-cream/75">Demo estimates · IDR</p>

          <dl className="mt-4 space-y-3 text-body-sm">
            <div>
              <dt className="text-cream/75">Total estimated trip cost</dt>
              <dd
                className="mt-1 font-display text-h2 text-cream"
                data-testid="budget-total"
              >
                <AnimatedIdr value={itinerary.budget.total} />
              </dd>
            </div>
            <div>
              <Label
                htmlFor="budget-cap"
                className="text-cream/75"
              >
                Your budget limit
              </Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="budget-cap"
                  type="number"
                  min={0}
                  step={100_000}
                  value={capValue}
                  onChange={(e) => setBudgetCapDraft(e.target.value)}
                  onBlur={onApplyBudgetCap}
                  className="border-cream/20 bg-deep-green/60 text-cream ring-cream/25 placeholder:text-cream/45 hover:ring-cream/40 focus-visible:ring-gold"
                  aria-describedby="budget-cap-hint"
                  data-testid="budget-cap-input"
                />
                {budgetCapDraft !== null &&
                budgetCapDraft !== String(itinerary.budget.budgetCap) ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onApplyBudgetCap}
                    data-testid="budget-cap-apply"
                    className="shrink-0 focus-visible:ring-offset-forest"
                  >
                    Apply
                  </Button>
                ) : null}
              </div>
              <p id="budget-cap-hint" className="mt-1 text-caption text-cream/55">
                Demo limit only — does not remove activities automatically.
              </p>
            </div>
            <div className="flex justify-between gap-3 border-t border-cream/15 pt-3">
              <dt className="text-cream/75">Travelers</dt>
              <dd className="tabular-nums font-medium">
                {itinerary.travelers}
              </dd>
            </div>
            {itinerary.travelers >= 1 && itinerary.budget.total >= 0 ? (
              <div className="flex justify-between gap-3">
                <dt className="text-cream/75">Est. cost per traveler</dt>
                <dd
                  className="tabular-nums font-medium"
                  data-testid="budget-per-person"
                >
                  {formatIdr(perPerson)}
                </dd>
              </div>
            ) : null}
          </dl>
          {itinerary.travelers >= 1 && itinerary.budget.total >= 0 ? (
            <p className="mt-2 text-caption text-cream/55">
              Per traveler = trip total ÷ travelers (display only). Activity line
              items may be per-person or shared; generation scales once into
              stored costs. Manual expenses scale by their cost basis at
              recalculation.
            </p>
          ) : null}

          <h3 className="mt-5 text-caption font-semibold uppercase tracking-[0.14em] text-gold">
            Category breakdown
          </h3>
          <ul
            className="mt-3 space-y-2 text-body-sm"
            data-testid="budget-categories"
          >
            {BUDGET_CATEGORIES.map((cat) => {
              const amount = itinerary.budget[cat];
              const share = categorySharePercent(
                amount,
                itinerary.budget.total,
              );
              return (
                <li
                  key={cat}
                  className="flex justify-between gap-3"
                  data-testid={`budget-cat-${cat}`}
                >
                  <span className="text-cream/75">
                    {BUDGET_CATEGORY_LABELS[cat]}
                    <span className="ml-1 tabular-nums text-cream/45">
                      ({share}%)
                    </span>
                  </span>
                  <span className="tabular-nums">{formatIdr(amount)}</span>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 border-t border-cream/15 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-caption font-semibold uppercase tracking-[0.14em] text-gold">
                Manual expenses
              </h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setExpenseAdding(true);
                  setExpenseEditing(null);
                }}
                data-testid="add-manual-expense"
                className="focus-visible:ring-offset-forest"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add
              </Button>
            </div>
            {manualExpenses.length === 0 ? (
              <p
                className="mt-3 text-caption text-cream/60"
                data-testid="manual-expenses-empty"
              >
                No manual expenses yet. Add tips, SIM cards, or other demo costs.
              </p>
            ) : (
              <ul className="mt-3 space-y-2" data-testid="manual-expenses-list">
                {manualExpenses.map((expense) => {
                  const tripCost = manualExpenseTripCost(
                    expense,
                    itinerary.travelers,
                  );
                  return (
                    <li
                      key={expense.id}
                      className="rounded-[var(--radius-md)] bg-cream/10 px-3 py-2"
                      data-testid={`manual-expense-${expense.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-cream">{expense.name}</p>
                          <p className="text-caption text-cream/65">
                            {BUDGET_CATEGORY_LABELS[expense.category]} ·{" "}
                            {expense.costKind === "perPerson"
                              ? "per person"
                              : "shared"}{" "}
                            · trip {formatIdr(tripCost)}
                          </p>
                          {expense.note ? (
                            <p className="mt-1 text-caption italic text-cream/55">
                              {expense.note}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-9 w-9 focus-visible:ring-offset-forest"
                            aria-label={`Edit expense ${expense.name}`}
                            onClick={() => {
                              setExpenseEditing(expense);
                              setExpenseAdding(false);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-9 w-9 text-cream/90 hover:bg-danger/35 hover:text-cream focus-visible:ring-offset-forest"
                            aria-label={`Remove expense ${expense.name}`}
                            onClick={() => setPendingExpenseDelete(expense)}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-5 border-t border-cream/15 pt-4">
            {itinerary.budget.overBudget ? (
              <div>
                <p
                  className="font-semibold text-gold"
                  role="status"
                  data-testid="over-budget"
                >
                  Over budget by{" "}
                  {formatIdr(Math.abs(itinerary.budget.remaining))}
                </p>
                <p className="mt-1 text-caption text-cream/65">
                  Activities were not removed. Review optional suggestions below.
                </p>
                <ul
                  className="mt-3 space-y-2 text-caption text-cream/80"
                  data-testid="budget-suggestions"
                >
                  {suggestions.map((tip) => (
                    <li key={tip.id} className="space-y-1">
                      <span>• {tip.message}</span>
                      {tip.replace ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="mt-1 focus-visible:ring-offset-forest"
                          onClick={() => onApplyReplaceSuggestion(tip.id)}
                          data-testid={`apply-suggestion-${tip.id}`}
                        >
                          Apply swap (optional)
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p
                className="font-semibold text-gold"
                role="status"
                data-testid="budget-remaining"
              >
                Remaining: {formatIdr(itinerary.budget.remaining)}
              </p>
            )}
          </div>
        </aside>
      </div>

      {(adding || editing) && (
        <ActivityDialog
          key={editing?.id ?? "new-activity"}
          activity={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={onSaveActivity}
        />
      )}

      {(expenseAdding || expenseEditing) && (
        <ManualExpenseDialog
          key={expenseEditing?.id ?? "new-expense"}
          expense={expenseEditing}
          travelers={itinerary.travelers}
          onClose={() => {
            setExpenseAdding(false);
            setExpenseEditing(null);
          }}
          onSave={onSaveExpense}
        />
      )}

      {catalogOpen ? (
        <CatalogDialog
          catalog={catalog}
          onClose={() => setCatalogOpen(false)}
          onPick={onAddFromCatalog}
        />
      ) : null}

      {pendingDelete ? (
        <Dialog
          open
          onClose={() => setPendingDelete(null)}
          title="Remove activity?"
          description={`Delete “${pendingDelete.name}” from this day? This cannot be undone in this session.`}
        >
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={onConfirmDelete}
              data-testid="confirm-delete"
            >
              Remove activity
            </Button>
          </div>
        </Dialog>
      ) : null}

      {pendingExpenseDelete ? (
        <Dialog
          open
          onClose={() => setPendingExpenseDelete(null)}
          title="Remove manual expense?"
          description={`Delete “${pendingExpenseDelete.name}”? This cannot be undone in this session.`}
        >
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingExpenseDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={onConfirmExpenseDelete}
              data-testid="confirm-expense-delete"
            >
              Remove expense
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function CatalogDialog({
  catalog,
  onClose,
  onPick,
}: {
  catalog: Attraction[];
  onClose: () => void;
  onPick: (attraction: Attraction) => void;
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add from destination catalog"
      description="Only attractions for this destination. Demo estimates — not live prices."
    >
      <ul className="max-h-80 space-y-2 overflow-y-auto" data-testid="catalog-list">
        {catalog.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="w-full cursor-pointer rounded-[var(--radius-md)] bg-cream px-3 py-3 text-left transition-colors hover:bg-forest/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              onClick={() => onPick(item)}
              data-testid={`catalog-item-${item.id}`}
            >
              <p className="font-medium text-forest">{item.name}</p>
              <p className="mt-1 text-caption text-muted">
                {item.durationHours}h · {BUDGET_CATEGORY_LABELS[item.category]} ·{" "}
                {formatIdr(item.baseCostIdr)} base
              </p>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-end pt-3">
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}

function ActivityDialog({
  activity,
  onClose,
  onSave,
}: {
  activity: Activity | null;
  onClose: () => void;
  onSave: (activity: Activity) => void;
}) {
  const [name, setName] = useState(activity?.name ?? "");
  const [time, setTime] = useState(activity?.time ?? "09:00");
  const [durationHours, setDurationHours] = useState(
    activity?.durationHours ?? 1,
  );
  const [costIdr, setCostIdr] = useState(activity?.costIdr ?? 0);
  const [category, setCategory] = useState<ActivityCategory>(
    activity?.category ?? "activities",
  );
  const [costKind, setCostKind] = useState<ActivityCostKind>(
    inferCostKind(activity?.category ?? "activities", activity?.costKind),
  );
  const [description, setDescription] = useState(activity?.description ?? "");
  const [notes, setNotes] = useState(activity?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setError("Time must use HH:MM");
      return;
    }
    const duration = Number(durationHours);
    if (!Number.isFinite(duration) || duration < 0.5 || duration > 24) {
      setError("Duration must be between 0.5 and 24 hours");
      return;
    }
    const cost = Number(costIdr);
    if (!Number.isFinite(cost) || cost < 0) {
      setError("Cost must be a non-negative number");
      return;
    }
    submitting.current = true;
    onSave({
      id: activity?.id ?? createId("act"),
      name: name.trim(),
      time,
      durationHours: duration,
      costIdr: Math.max(0, cost),
      category,
      description: description.trim(),
      location: activity?.location,
      catalogId: activity?.catalogId,
      notes: notes.trim() || undefined,
      costKind,
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={activity ? "Edit activity" : "Add activity"}
      description="Costs are demo estimates in Indonesian Rupiah."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="act-name">Name</Label>
          <Input
            id="act-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="act-time">Start time</Label>
            <Input
              id="act-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="act-duration">Duration (hours)</Label>
            <Input
              id="act-duration"
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="act-cost">Cost (IDR)</Label>
            <Input
              id="act-cost"
              type="number"
              min={0}
              step={1000}
              value={costIdr}
              onChange={(e) => setCostIdr(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="act-cost-kind">Cost kind</Label>
            <Select
              id="act-cost-kind"
              value={costKind}
              onChange={(e) =>
                setCostKind(e.target.value as ActivityCostKind)
              }
            >
              <option value="perPerson">Per person (already scaled)</option>
              <option value="shared">Shared / group</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="act-cat">Category</Label>
          <Select
            id="act-cat"
            value={category}
            onChange={(e) => {
              const next = e.target.value as ActivityCategory;
              setCategory(next);
              if (!activity?.costKind) {
                setCostKind(inferCostKind(next));
              }
            }}
          >
            {BUDGET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {BUDGET_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="act-desc">Description</Label>
          <Textarea
            id="act-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </div>
        <div>
          <Label htmlFor="act-notes">Personal notes</Label>
          <Textarea
            id="act-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
            placeholder="Optional reminder for this stop"
          />
        </div>
        {error ? (
          <p role="alert" className="text-caption text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {activity ? "Save changes" : "Add activity"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ManualExpenseDialog({
  expense,
  travelers,
  onClose,
  onSave,
}: {
  expense: ManualExpense | null;
  travelers: number;
  onClose: () => void;
  onSave: (expense: ManualExpense) => void;
}) {
  const [name, setName] = useState(expense?.name ?? "");
  const [category, setCategory] = useState<ActivityCategory>(
    expense?.category ?? "other",
  );
  const [amountIdr, setAmountIdr] = useState(expense?.amountIdr ?? 0);
  const [costKind, setCostKind] = useState<ActivityCostKind>(
    expense?.costKind ?? "shared",
  );
  const [note, setNote] = useState(expense?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  const previewTrip = manualExpenseTripCost(
    { amountIdr: Number(amountIdr) || 0, costKind },
    travelers,
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    const amount = Number(amountIdr);
    const validationError = validateManualExpenseDraft({
      name,
      amountIdr: amount,
      category,
      costKind,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    submitting.current = true;
    onSave({
      id: expense?.id ?? createId("exp"),
      name: name.trim(),
      category,
      amountIdr: Math.max(0, amount),
      costKind,
      note: note.trim() || undefined,
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={expense ? "Edit manual expense" : "Add manual expense"}
      description="Demo estimates only. Per-person amounts scale by traveler count; shared amounts count once."
    >
      <form onSubmit={submit} className="space-y-4" data-testid="manual-expense-form">
        <div>
          <Label htmlFor="exp-name">Name</Label>
          <Input
            id="exp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            data-testid="exp-name"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="exp-amount">Amount (IDR)</Label>
            <Input
              id="exp-amount"
              type="number"
              step={1000}
              value={amountIdr}
              onChange={(e) => setAmountIdr(Number(e.target.value))}
              data-testid="exp-amount"
              aria-describedby="exp-amount-hint"
            />
            <p id="exp-amount-hint" className="mt-1 text-caption text-muted">
              Must be zero or positive (demo IDR).
            </p>
          </div>
          <div>
            <Label htmlFor="exp-cost-kind">Cost basis</Label>
            <Select
              id="exp-cost-kind"
              value={costKind}
              onChange={(e) =>
                setCostKind(e.target.value as ActivityCostKind)
              }
              data-testid="exp-cost-kind"
            >
              <option value="perPerson">Per person</option>
              <option value="shared">Shared / group</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="exp-cat">Category</Label>
          <Select
            id="exp-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as ActivityCategory)}
            data-testid="exp-cat"
          >
            {BUDGET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {BUDGET_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="exp-note">Note (optional)</Label>
          <Textarea
            id="exp-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            data-testid="exp-note"
          />
        </div>
        <p className="text-caption text-muted" data-testid="exp-trip-preview">
          Trip contribution preview: {formatIdr(previewTrip)}
          {costKind === "perPerson"
            ? ` (${travelers} traveler${travelers > 1 ? "s" : ""} × base)`
            : " (shared once)"}
        </p>
        {error ? (
          <p role="alert" className="text-caption text-danger" data-testid="exp-error">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="exp-submit">
            {expense ? "Save expense" : "Add expense"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
