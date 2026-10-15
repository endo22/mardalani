import { z } from "zod";

export const travelStyleSchema = z.enum([
  "relaxed",
  "balanced",
  "adventure",
  "cultural",
  "luxury",
]);

export const travelInterestSchema = z.enum([
  "nature",
  "culture",
  "culinary",
  "beach",
  "adventure",
  "relaxation",
]);

export const budgetTierSchema = z.enum(["budget", "moderate", "premium"]);

export const transportSchema = z.enum([
  "public",
  "private",
  "mixed",
  "walking",
]);

export const activityCategorySchema = z.enum([
  "transportation",
  "accommodation",
  "food",
  "attractions",
  "activities",
  "other",
]);

export const activityCostKindSchema = z.enum(["perPerson", "shared"]);

export const manualExpenseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  category: activityCategorySchema,
  amountIdr: z.number().min(0).max(50_000_000),
  costKind: activityCostKindSchema,
  note: z.string().max(300).optional(),
});

export const tripFormSchema = z
  .object({
    destination: z.string().min(1, "Choose a destination"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    travelers: z
      .number()
      .int("Travelers must be a whole number")
      .min(1, "At least 1 traveler")
      .max(12, "Maximum 12 travelers for this demo"),
    travelStyle: travelStyleSchema,
    budgetTier: budgetTierSchema,
    budgetAmount: z
      .number()
      .min(500_000, "Budget must be at least Rp500.000")
      .max(500_000_000, "Budget exceeds demo maximum"),
    transport: transportSchema,
    interests: z.array(travelInterestSchema).max(6).optional(),
    notes: z.string().max(500, "Keep notes under 500 characters").optional(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(`${data.startDate}T12:00:00`);
    const end = new Date(`${data.endDate}T12:00:00`);
    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Invalid start date",
      });
    }
    if (Number.isNaN(end.getTime())) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Invalid end date",
      });
    }
    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      end < start
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after start date",
      });
    }
    const days =
      !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
        ? Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
        : 0;
    if (days > 14) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Demo plans support up to 14 days",
      });
    }
  });

export type TripFormValues = z.infer<typeof tripFormSchema>;

export const activitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  durationHours: z.number().min(0.5).max(24),
  costIdr: z.number().min(0).max(50_000_000),
  category: activityCategorySchema,
  description: z.string().max(500),
  location: z.string().max(120).optional(),
  catalogId: z.string().max(80).optional(),
  /** Missing on older snapshots — demo area clustering only. */
  areaId: z.string().max(80).optional(),
  notes: z.string().max(300).optional(),
  costKind: activityCostKindSchema.optional(),
});

export const itineraryDaySchema = z.object({
  dayNumber: z.number().int().positive(),
  date: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  activities: z.array(activitySchema),
});

export const budgetBreakdownSchema = z.object({
  transportation: z.number(),
  accommodation: z.number(),
  food: z.number(),
  /** Missing on pre–Phase-3 snapshots → 0. */
  attractions: z.number().default(0),
  activities: z.number(),
  other: z.number(),
  total: z.number(),
  budgetCap: z.number(),
  remaining: z.number(),
  overBudget: z.boolean(),
});

export const itinerarySchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Missing on older snapshots → UI uses destinationName. */
  title: z.string().min(1).max(120).optional(),
  destinationSlug: z.string().min(1),
  destinationName: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  travelers: z.number().int().positive(),
  travelStyle: travelStyleSchema,
  budgetTier: budgetTierSchema,
  transport: transportSchema,
  interests: z.array(travelInterestSchema).optional(),
  notes: z.string().optional(),
  days: z.array(itineraryDaySchema).min(1),
  /** Missing on pre–Phase-3 snapshots → []. */
  manualExpenses: z.array(manualExpenseSchema).default([]),
  budget: budgetBreakdownSchema,
  isDemoEstimate: z.literal(true),
  generationNote: z.string(),
  /** Missing on older snapshots → UI treats as no extra notes. */
  constraintNotes: z.array(z.string().max(300)).max(12).optional(),
});

export const planQuerySchema = z.object({
  destination: z.string().max(80).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  travelers: z.number().int().min(1).max(12).optional(),
});

/** Versioned local library of saved trips (localStorage). */
export const savedTripsStoreSchema = z.object({
  version: z.literal(1),
  trips: z.array(itinerarySchema),
});

export type SavedTripsStore = z.infer<typeof savedTripsStoreSchema>;

/** Versioned wishlist of destination slugs only (localStorage). */
export const wishlistStoreSchema = z.object({
  version: z.literal(1),
  slugs: z.array(z.string().min(1).max(80)),
});

export type WishlistStore = z.infer<typeof wishlistStoreSchema>;

/** Portable local-file backup envelope (not cloud sync). */
export const LOCAL_BACKUP_KIND = "mardalani-local-backup" as const;

export const localBackupSchema = z.object({
  kind: z.literal(LOCAL_BACKUP_KIND),
  version: z.literal(1),
  exportedAt: z.string().min(1),
  trips: z.array(itinerarySchema).optional(),
  wishlistSlugs: z.array(z.string().min(1).max(80)).optional(),
});

export type LocalBackup = z.infer<typeof localBackupSchema>;
