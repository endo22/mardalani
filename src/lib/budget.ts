import type { Attraction } from "@/data/attractions";
import type {
  Activity,
  ActivityCategory,
  ActivityCostKind,
  BudgetBreakdown,
  BudgetTier,
  ItineraryDay,
  ManualExpense,
  TransportPreference,
  TravelStyle,
} from "@/types";

/**
 * Cost calculation rules (single source of truth)
 * ------------------------------------------------
 * 1. Activity.costIdr is the TRIP contribution already stored.
 *    Generation / catalog-add applies traveler × costKind ONCE via scaleDemoCost.
 *    recalculateBudget MUST NOT re-multiply activity costs by travelers.
 *
 * 2. ManualExpense.amountIdr is a BASE amount.
 *    Trip contribution = perPerson ? amount × travelers : amount (shared/group once).
 *    Scaling happens only in manualExpenseTripCost — never stored into activity costs.
 *
 * 3. Category totals = sum(activity.costIdr by category)
 *    + sum(manualExpenseTripCost by category).
 *
 * 4. Trip total = sum of all category totals. Safe zeros when empty.
 * 5. Est. cost per person (display) = trip total ÷ max(1, travelers).
 * 6. Remaining = budgetCap − total; overBudget when total > budgetCap.
 * 7. Shared costs are never multiplied by travelers at recalculation.
 * 8. Negative / non-finite amounts are clamped to 0.
 */

export const BUDGET_CATEGORIES: ActivityCategory[] = [
  "transportation",
  "accommodation",
  "food",
  "attractions",
  "activities",
  "other",
];

export const BUDGET_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  transportation: "Transportation",
  accommodation: "Accommodation",
  food: "Food and drinks",
  attractions: "Attractions / entrance tickets",
  activities: "Activities",
  other: "Other",
};

const styleCostMultiplier: Record<TravelStyle, number> = {
  relaxed: 0.95,
  balanced: 1,
  adventure: 1.08,
  cultural: 1.02,
  luxury: 1.35,
};

const budgetTierMultiplier: Record<BudgetTier, number> = {
  budget: 0.82,
  moderate: 1,
  premium: 1.28,
};

const transportMultiplier: Record<TransportPreference, number> = {
  public: 0.85,
  walking: 0.75,
  mixed: 1,
  private: 1.25,
};

function emptyCategoryTotals(): Record<ActivityCategory, number> {
  return {
    transportation: 0,
    accommodation: 0,
    food: 0,
    attractions: 0,
    activities: 0,
    other: 0,
  };
}

function safeNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Infer cost kind for older activities / templates without an explicit flag. */
export function inferCostKind(
  category: ActivityCategory,
  explicit?: ActivityCostKind,
): ActivityCostKind {
  if (explicit) return explicit;
  if (
    category === "food" ||
    category === "activities" ||
    category === "attractions"
  ) {
    return "perPerson";
  }
  return "shared";
}

/**
 * Single source for demo cost scaling at generation / catalog-add time.
 * Traveler × costKind applied once here; recalculateBudget must not re-multiply.
 */
export function scaleDemoCost(
  base: number,
  style: TravelStyle,
  tier: BudgetTier,
  transport: TransportPreference,
  travelers: number,
  category: ActivityCategory,
  costKind: ActivityCostKind,
): number {
  let cost = base * styleCostMultiplier[style] * budgetTierMultiplier[tier];

  if (category === "transportation") {
    cost *= transportMultiplier[transport];
  }

  const n = Math.max(1, travelers);

  if (costKind === "perPerson") {
    cost *= n;
  } else if (category === "accommodation") {
    cost *= Math.ceil(n / 2);
  } else if (category === "transportation" && transport === "private") {
    cost *= n > 4 ? 1.15 : 1;
  }

  return Math.round(cost / 1000) * 1000;
}

/**
 * Trip-total contribution for one manual expense.
 * Per-person bases scale by travelers; shared bases count once for the group.
 */
export function manualExpenseTripCost(
  expense: Pick<ManualExpense, "amountIdr" | "costKind">,
  travelers: number,
): number {
  const base = safeNonNegative(expense.amountIdr);
  const n = Math.max(1, Math.floor(travelers) || 1);
  if (expense.costKind === "perPerson") {
    return Math.round(base * n);
  }
  return Math.round(base);
}

export function sumByCategory(
  days: ItineraryDay[],
  manualExpenses: ManualExpense[] = [],
  travelers = 1,
): Record<ActivityCategory, number> {
  const totals = emptyCategoryTotals();

  for (const day of days) {
    for (const activity of day.activities) {
      const cost = safeNonNegative(activity.costIdr);
      totals[activity.category] += cost;
    }
  }

  for (const expense of manualExpenses) {
    totals[expense.category] += manualExpenseTripCost(expense, travelers);
  }

  return totals;
}

export interface RecalculateBudgetOptions {
  manualExpenses?: ManualExpense[];
  travelers?: number;
}

/**
 * Single source of truth for trip budget math.
 * Activities: sum stored costIdr (already scaled).
 * Manual expenses: scale by costKind × travelers here.
 */
export function recalculateBudget(
  days: ItineraryDay[],
  budgetCap: number,
  options: RecalculateBudgetOptions = {},
): BudgetBreakdown {
  const safeCap =
    Number.isFinite(budgetCap) && budgetCap >= 0 ? budgetCap : 0;
  const travelers = Math.max(1, options.travelers ?? 1);
  const manualExpenses = options.manualExpenses ?? [];
  const byCategory = sumByCategory(days, manualExpenses, travelers);
  const total = BUDGET_CATEGORIES.reduce(
    (sum, key) => sum + byCategory[key],
    0,
  );
  const remaining = safeCap - total;

  return {
    ...byCategory,
    total,
    budgetCap: safeCap,
    remaining,
    overBudget: total > safeCap,
  };
}

/** Share of trip total (0–100). Safe when total is 0. */
export function categorySharePercent(
  amount: number,
  total: number,
): number {
  const safeAmount = safeNonNegative(amount);
  const safeTotal = safeNonNegative(total);
  if (safeTotal <= 0) return 0;
  return Math.round((safeAmount / safeTotal) * 1000) / 10;
}

export function timeToMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours > 23 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 45, Math.round(totalMinutes)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Suggest a start time after existing day activities (15m buffer), capped early evening. */
export function suggestNextStartTime(
  activities: Activity[],
  fallback = "09:00",
): string {
  if (activities.length === 0) return fallback;
  let end = timeToMinutes(fallback) ?? 9 * 60;
  for (const activity of activities) {
    const start = timeToMinutes(activity.time);
    if (start === null) continue;
    const duration = Number.isFinite(activity.durationHours)
      ? Math.max(0, activity.durationHours)
      : 0;
    end = Math.max(end, start + duration * 60);
  }
  return minutesToTime(Math.min(end + 15, 20 * 60));
}

export interface DayScheduleWarning {
  type: "conflict" | "packed";
  message: string;
}

/** Non-blocking schedule warnings for a single day. */
export function getDayScheduleWarnings(
  activities: Activity[],
): DayScheduleWarning[] {
  const warnings: DayScheduleWarning[] = [];
  const timed = activities
    .map((a) => {
      const start = timeToMinutes(a.time);
      const duration = Number.isFinite(a.durationHours)
        ? Math.max(0, a.durationHours)
        : 0;
      if (start === null) return null;
      return {
        name: a.name,
        start,
        end: start + duration * 60,
        durationHours: duration,
        category: a.category,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.start - b.start);

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i]!;
      const b = timed[j]!;
      if (b.start < a.end) {
        warnings.push({
          type: "conflict",
          message: `Time overlap: “${a.name}” and “${b.name}” — warning only; you can still save.`,
        });
      }
    }
  }

  const activeHours = timed
    .filter((t) => t.category !== "accommodation")
    .reduce((sum, t) => sum + t.durationHours, 0);
  const count = activities.filter((a) => a.category !== "accommodation").length;

  if (activeHours > 10 || count > 5) {
    warnings.push({
      type: "packed",
      message: `This day looks packed (~${activeHours.toFixed(1)}h scheduled across ${count} items). Consider moving something — warning only; save is allowed.`,
    });
  }

  return warnings;
}

/** Display-only share of trip total; does not invent category-level splits. */
export function estimatedCostPerPerson(
  totalIdr: number,
  travelers: number,
): number {
  const n = Math.max(1, travelers);
  return Math.round(safeNonNegative(totalIdr) / n);
}

export interface BudgetSuggestion {
  id: string;
  kind: "replace" | "reduce" | "review";
  message: string;
  /** Optional explicit replace metadata — never auto-applied. */
  replace?: {
    dayNumber: number;
    activityId: string;
    fromName: string;
    toCatalogId: string;
    toName: string;
    estimatedSavingIdr: number;
  };
}

export interface OptimizationContext {
  days: ItineraryDay[];
  budget: BudgetBreakdown;
  catalog?: Attraction[];
  travelers?: number;
  style?: TravelStyle;
  tier?: BudgetTier;
  transport?: TransportPreference;
}

/**
 * Optional over-budget tips from existing itinerary + catalog data only.
 * Never invents live prices, discounts, or availability. Does not mutate itinerary.
 */
export function getOptimizationSuggestions(
  ctx: OptimizationContext,
): BudgetSuggestion[] {
  const { days, budget, catalog = [] } = ctx;
  if (!budget.overBudget) return [];

  const tips: BudgetSuggestion[] = [];
  const over = budget.total - budget.budgetCap;
  const travelers = Math.max(1, ctx.travelers ?? 1);
  const style = ctx.style ?? "balanced";
  const tier = ctx.tier ?? "moderate";
  const transport = ctx.transport ?? "mixed";

  tips.push({
    id: "over-summary",
    kind: "review",
    message: `You’re about ${formatOver(over)} over the demo budget. Suggestions below are optional — nothing changes until you act.`,
  });

  const expensive = days
    .flatMap((d) => d.activities.map((a) => ({ ...a, day: d.dayNumber })))
    .filter((a) => a.costIdr > 0)
    .sort((a, b) => b.costIdr - a.costIdr);

  for (const item of expensive.slice(0, 3)) {
    const cheaper =
      catalog.length > 0
        ? catalog
            .filter(
              (c) =>
                c.category === item.category &&
                c.id !== item.catalogId &&
                c.name.toLowerCase() !== item.name.toLowerCase(),
            )
            .map((c) => {
              const scaled = scaleDemoCost(
                c.baseCostIdr,
                style,
                tier,
                transport,
                travelers,
                c.category,
                c.costKind,
              );
              return { attraction: c, scaled };
            })
            .filter((c) => c.scaled < item.costIdr)
            .sort((a, b) => a.scaled - b.scaled)[0]
        : undefined;

    if (cheaper) {
      const saving = item.costIdr - cheaper.scaled;
      tips.push({
        id: `replace-${item.id}`,
        kind: "replace",
        message: `Day ${item.day}: optional swap “${item.name}” for catalog “${cheaper.attraction.name}” (demo estimate ~${formatOver(saving)} less). Not live pricing.`,
        replace: {
          dayNumber: item.day,
          activityId: item.id,
          fromName: item.name,
          toCatalogId: cheaper.attraction.id,
          toName: cheaper.attraction.name,
          estimatedSavingIdr: saving,
        },
      });
    } else {
      tips.push({
        id: `review-${item.id}`,
        kind: "reduce",
        message: `Day ${item.day}: consider reducing or removing optional “${item.name}” (demo estimate ${formatOver(item.costIdr)}).`,
      });
    }
  }

  if (budget.accommodation > budget.budgetCap * 0.45) {
    tips.push({
      id: "review-lodging",
      kind: "review",
      message:
        "Accommodation is a large share of the demo estimate — review lodging nights or mid-range stays. Estimates only.",
    });
  }
  if (budget.transportation > budget.budgetCap * 0.3) {
    tips.push({
      id: "review-transport",
      kind: "review",
      message:
        "Transport estimates look high — review private transfers vs public/mixed options. Demo estimates only.",
    });
  }
  if (budget.activities + budget.attractions > budget.budgetCap * 0.35) {
    tips.push({
      id: "review-activities",
      kind: "reduce",
      message:
        "Activities and attractions are a large share — mix free walks with paid experiences. Demo estimates only.",
    });
  }
  if (budget.food > budget.budgetCap * 0.3) {
    tips.push({
      id: "review-food",
      kind: "reduce",
      message:
        "Food and drinks are climbing — balance one special meal with local warung stops. Demo estimates only.",
    });
  }

  // Deduplicate by id, keep order, cap length
  const seen = new Set<string>();
  return tips
    .filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    })
    .slice(0, 6);
}

/** @deprecated Prefer getOptimizationSuggestions — kept for string-only callers. */
export function getSavingsTips(
  days: ItineraryDay[],
  budget: BudgetBreakdown,
): string[] {
  return getOptimizationSuggestions({ days, budget }).map((t) => t.message);
}

function formatOver(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/** Validate manual expense draft; returns error message or null. */
export function validateManualExpenseDraft(input: {
  name: string;
  amountIdr: number;
  category: ActivityCategory;
  costKind: ActivityCostKind;
}): string | null {
  if (!input.name.trim()) return "Name is required";
  if (!BUDGET_CATEGORIES.includes(input.category)) {
    return "Choose a valid category";
  }
  if (input.costKind !== "perPerson" && input.costKind !== "shared") {
    return "Choose per person or shared";
  }
  if (!Number.isFinite(input.amountIdr) || input.amountIdr < 0) {
    return "Amount must be a non-negative number";
  }
  if (input.amountIdr > 50_000_000) {
    return "Amount exceeds demo maximum";
  }
  return null;
}

export function updateActivityInDays(
  days: ItineraryDay[],
  dayNumber: number,
  activityId: string,
  patch: Partial<Activity>,
): ItineraryDay[] {
  return days.map((day) => {
    if (day.dayNumber !== dayNumber) return day;
    return {
      ...day,
      activities: day.activities.map((activity) =>
        activity.id === activityId ? { ...activity, ...patch } : activity,
      ),
    };
  });
}

export function removeActivityFromDays(
  days: ItineraryDay[],
  dayNumber: number,
  activityId: string,
): ItineraryDay[] {
  return days.map((day) => {
    if (day.dayNumber !== dayNumber) return day;
    return {
      ...day,
      activities: day.activities.filter((a) => a.id !== activityId),
    };
  });
}

export function addActivityToDays(
  days: ItineraryDay[],
  dayNumber: number,
  activity: Activity,
): ItineraryDay[] {
  return days.map((day) => {
    if (day.dayNumber !== dayNumber) return day;
    const activities = [...day.activities, activity].sort((a, b) =>
      a.time.localeCompare(b.time),
    );
    return { ...day, activities };
  });
}

export function moveActivityBetweenDays(
  days: ItineraryDay[],
  fromDayNumber: number,
  toDayNumber: number,
  activityId: string,
): ItineraryDay[] {
  if (fromDayNumber === toDayNumber) return days;
  let moving: Activity | undefined;
  const without = days.map((day) => {
    if (day.dayNumber !== fromDayNumber) return day;
    moving = day.activities.find((a) => a.id === activityId);
    return {
      ...day,
      activities: day.activities.filter((a) => a.id !== activityId),
    };
  });
  if (!moving) return days;
  return addActivityToDays(without, toDayNumber, moving);
}

export function upsertManualExpense(
  expenses: ManualExpense[],
  expense: ManualExpense,
): ManualExpense[] {
  const idx = expenses.findIndex((e) => e.id === expense.id);
  if (idx === -1) return [...expenses, expense];
  const next = [...expenses];
  next[idx] = expense;
  return next;
}

export function removeManualExpense(
  expenses: ManualExpense[],
  expenseId: string,
): ManualExpense[] {
  return expenses.filter((e) => e.id !== expenseId);
}
