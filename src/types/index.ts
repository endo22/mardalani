export type TravelStyle =
  | "relaxed"
  | "balanced"
  | "adventure"
  | "cultural"
  | "luxury";

export type TravelInterest =
  | "nature"
  | "culture"
  | "culinary"
  | "beach"
  | "adventure"
  | "relaxation";

export type BudgetTier = "budget" | "moderate" | "premium";

export type TransportPreference =
  | "public"
  | "private"
  | "mixed"
  | "walking";

export type ActivityCategory =
  | "transportation"
  | "accommodation"
  | "food"
  | "attractions"
  | "activities"
  | "other";

/** How generation scales base cost by travelers. Stored costs are already scaled. */
export type ActivityCostKind = "perPerson" | "shared";

/**
 * Manual trip expense (not a day activity).
 * `amountIdr` is the base amount; trip contribution is scaled by `costKind`
 * at budget recalculation time (unlike Activity.costIdr which is pre-scaled).
 */
export interface ManualExpense {
  id: string;
  name: string;
  category: ActivityCategory;
  amountIdr: number;
  costKind: ActivityCostKind;
  note?: string;
}

export interface Destination {
  slug: string;
  name: string;
  region: string;
  tagline: string;
  description: string;
  highlights: string[];
  bestSeason: string;
  avgDailyBudgetIdr: number;
  imageUrl: string;
  imageAlt: string;
  hasFullTemplate: boolean;
}

export interface TripFormInput {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelStyle: TravelStyle;
  budgetTier: BudgetTier;
  budgetAmount: number;
  transport: TransportPreference;
  interests?: TravelInterest[];
  notes?: string;
}

export interface Activity {
  id: string;
  name: string;
  time: string;
  durationHours: number;
  costIdr: number;
  category: ActivityCategory;
  description: string;
  location?: string;
  /** Stable catalog reference when sourced from destination attractions. */
  catalogId?: string;
  /**
   * Demo area cluster copied from catalog when known.
   * Older snapshots omit this — schedule warnings stay safe without it.
   */
  areaId?: string;
  /** Personal note — optional, migrated safely for older snapshots. */
  notes?: string;
  /** Present when known; older itineraries may omit (inferred by category). */
  costKind?: ActivityCostKind;
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  title: string;
  summary: string;
  activities: Activity[];
}

export interface BudgetBreakdown {
  transportation: number;
  accommodation: number;
  food: number;
  attractions: number;
  activities: number;
  other: number;
  total: number;
  budgetCap: number;
  remaining: number;
  overBudget: boolean;
}

export interface Itinerary {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Optional display name for My Trips; falls back to destinationName. */
  title?: string;
  destinationSlug: string;
  destinationName: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelStyle: TravelStyle;
  budgetTier: BudgetTier;
  transport: TransportPreference;
  interests?: TravelInterest[];
  notes?: string;
  days: ItineraryDay[];
  /** Optional manual expenses — default [] when migrating older snapshots. */
  manualExpenses?: ManualExpense[];
  budget: BudgetBreakdown;
  isDemoEstimate: true;
  generationNote: string;
  /**
   * Optional demo trade-off notes (pacing, area clustering, budget trim).
   * Missing on older snapshots — treat as [].
   */
  constraintNotes?: string[];
}

export interface ItineraryGenerationRequest extends TripFormInput {
  destinationSlug: string;
}

export interface ItineraryGenerationService {
  generate(request: ItineraryGenerationRequest): Promise<Itinerary>;
}
