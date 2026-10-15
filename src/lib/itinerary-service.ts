import {
  getAttractionCatalog,
  hasAttractionCatalog,
  type Attraction,
  type AttractionCostKind,
} from "@/data/attractions";
import {
  destinationTemplates,
  fallbackDaySeed,
  type ActivityTemplate,
  type DayTemplate,
} from "@/data/templates";
import { getDestinationBySlug } from "@/data/destinations";
import {
  inferCostKind,
  recalculateBudget,
  scaleDemoCost,
  suggestNextStartTime,
} from "@/lib/budget";
import { addDays, daysBetween } from "@/lib/format";
import { createId } from "@/lib/utils";
import type {
  Activity,
  BudgetTier,
  Itinerary,
  ItineraryDay,
  ItineraryGenerationRequest,
  ItineraryGenerationService,
  TransportPreference,
  TravelInterest,
  TravelStyle,
} from "@/types";

/** Soft cap on scheduled hours per day (excludes overnight accommodation block). */
const MAX_DAY_HOURS = 10;
/** Soft cap on non-logistics activities per day. */
const MAX_DAY_ACTIVITIES = 5;

const interestStyleHint: Partial<Record<TravelInterest, TravelStyle>> = {
  culture: "cultural",
  adventure: "adventure",
  relaxation: "relaxed",
};

function attractionScore(
  item: Attraction,
  interests: TravelInterest[],
  style: TravelStyle,
): number {
  let score = 0;
  if (interests.length > 0) {
    const hits = item.interests.filter((i) => interests.includes(i)).length;
    score += hits * 10;
    if (hits === 0 && item.interests.length > 0) score -= 2;
  }
  if (item.styles?.includes(style)) score += 3;
  else if (item.styles && item.styles.length > 0) score -= 1;
  for (const interest of interests) {
    const hinted = interestStyleHint[interest];
    if (hinted && item.styles?.includes(hinted)) score += 1;
  }
  // Stable tie-break via id length bias — final sort uses id string
  return score;
}

function compareByScoreThenId(
  a: { score: number; id: string },
  b: { score: number; id: string },
): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.id.localeCompare(b.id);
}

function filterTemplateActivities(
  activities: ActivityTemplate[],
  style: TravelStyle,
): ActivityTemplate[] {
  return activities.filter(
    (a) => !a.styles || a.styles.length === 0 || a.styles.includes(style),
  );
}

function pickDayTemplates(
  slug: string,
  dayCount: number,
): { templates: DayTemplate[]; usedFallback: boolean } {
  const full = destinationTemplates[slug];
  const source = full && full.length > 0 ? full : fallbackDaySeed;
  const usedFallback = !full || full.length === 0;

  const templates: DayTemplate[] = [];
  for (let i = 0; i < dayCount; i++) {
    templates.push(source[i % source.length]!);
  }
  return { templates, usedFallback };
}

function findCatalogMatch(
  catalog: Attraction[],
  template: ActivityTemplate,
): Attraction | undefined {
  const byName = catalog.find(
    (a) => a.name.toLowerCase() === template.name.toLowerCase(),
  );
  return byName;
}

function toActivityFromAttraction(
  attraction: Attraction,
  destinationSlug: string,
  dayNumber: number,
  style: TravelStyle,
  tier: BudgetTier,
  transport: TransportPreference,
  travelers: number,
  timeOverride?: string,
): Activity {
  const costKind: AttractionCostKind = attraction.costKind;
  return {
    id: `act_${destinationSlug}_d${dayNumber}_${attraction.id}`,
    catalogId: attraction.id,
    name: attraction.name,
    time: timeOverride ?? attraction.defaultTime ?? "09:00",
    durationHours: attraction.durationHours,
    costIdr: scaleDemoCost(
      attraction.baseCostIdr,
      style,
      tier,
      transport,
      travelers,
      attraction.category,
      costKind,
    ),
    category: attraction.category,
    description: attraction.description,
    location: attraction.location,
    costKind,
  };
}

function toActivityFromTemplate(
  template: ActivityTemplate,
  destinationSlug: string,
  dayNumber: number,
  index: number,
  style: TravelStyle,
  tier: BudgetTier,
  transport: TransportPreference,
  travelers: number,
): Activity {
  const costKind = inferCostKind(template.category);
  const slugPart = template.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return {
    id: `act_${destinationSlug}_d${dayNumber}_t${index}_${slugPart}`,
    name: template.name,
    time: template.time,
    durationHours: template.durationHours,
    costIdr: scaleDemoCost(
      template.baseCostIdr,
      style,
      tier,
      transport,
      travelers,
      template.category,
      costKind,
    ),
    category: template.category,
    description: template.description,
    location: template.location,
    costKind,
  };
}

function dayActiveHours(activities: Activity[]): number {
  return activities
    .filter((a) => a.category !== "accommodation")
    .reduce((sum, a) => sum + a.durationHours, 0);
}

function trimPackedDay(activities: Activity[]): Activity[] {
  let next = [...activities].sort((a, b) => a.time.localeCompare(b.time));
  const isLogistics = (a: Activity) =>
    a.category === "transportation" ||
    a.category === "accommodation" ||
    a.category === "other";

  while (
    (dayActiveHours(next) > MAX_DAY_HOURS ||
      next.filter((a) => !isLogistics(a)).length > MAX_DAY_ACTIVITIES) &&
    next.length > 2
  ) {
    // Drop lowest-priority optional: free/low-cost activities last in day first
    const candidates = next
      .map((a, index) => ({ a, index }))
      .filter(({ a }) => !isLogistics(a))
      .sort((x, y) => {
        if (x.a.costIdr !== y.a.costIdr) return x.a.costIdr - y.a.costIdr;
        return y.index - x.index;
      });
    const drop = candidates[0];
    if (!drop) break;
    next = next.filter((_, i) => i !== drop.index);
  }
  return next;
}

function buildSmartDaysFromCatalog(
  request: ItineraryGenerationRequest,
  templates: DayTemplate[],
): { days: ItineraryDay[]; limitation: string | null } {
  const catalog = getAttractionCatalog(request.destinationSlug);
  const interests = request.interests ?? [];
  const usedCatalogIds = new Set<string>();
  const dayCount = templates.length;
  let limitation: string | null = null;

  if (catalog.length < 4) {
    limitation =
      "Attraction catalog for this destination is limited — adjust days manually from the catalog or add custom activities.";
  }

  const scored = catalog
    .map((item) => ({
      item,
      score: attractionScore(item, interests, request.travelStyle),
      id: item.id,
    }))
    .sort(compareByScoreThenId);

  let skippedCatalogSlots = 0;
  let missingLodging = false;

  const days: ItineraryDay[] = templates.map((tmpl, index) => {
    const dayNumber = index + 1;
    const preferred = scored.filter(
      (s) =>
        !s.item.preferredDay ||
        s.item.preferredDay === ((index % 3) + 1) ||
        Math.abs((s.item.preferredDay ?? 1) - ((index % 3) + 1)) <= 1,
    );

    const slotTemplates = filterTemplateActivities(
      tmpl.activities,
      request.travelStyle,
    );

    const activities: Activity[] = [];

    for (let slot = 0; slot < slotTemplates.length; slot++) {
      const slotTmpl = slotTemplates[slot]!;
      const matched = findCatalogMatch(catalog, slotTmpl);

      let chosen: Attraction | undefined = matched;

      // Prefer a higher-scoring unused catalog item of same category when interests set
      if (interests.length > 0 && slotTmpl.category === "activities") {
        const alt = preferred.find(
          (s) =>
            s.item.category === "activities" &&
            !usedCatalogIds.has(s.item.id) &&
            s.score >
              (matched
                ? attractionScore(matched, interests, request.travelStyle)
                : -999),
        );
        if (alt) chosen = alt.item;
      }

      if (chosen && usedCatalogIds.has(chosen.id)) {
        const replacement = preferred.find(
          (s) =>
            s.item.category === chosen!.category &&
            !usedCatalogIds.has(s.item.id),
        );
        chosen = replacement?.item;
      }

      // Catalog-only path: never invent template attractions / prices.
      if (!chosen) {
        const sameCategory = preferred.find(
          (s) =>
            s.item.category === slotTmpl.category &&
            !usedCatalogIds.has(s.item.id),
        );
        chosen = sameCategory?.item;
      }

      if (chosen) {
        usedCatalogIds.add(chosen.id);
        activities.push(
          toActivityFromAttraction(
            chosen,
            request.destinationSlug,
            dayNumber,
            request.travelStyle,
            request.budgetTier,
            request.transport,
            request.travelers,
            slotTmpl.time,
          ),
        );
      } else {
        skippedCatalogSlots += 1;
      }
    }

    // Fill thin days from leftover high-scoring attractions, sequenced by duration
    const nonLogistics = activities.filter(
      (a) => a.category === "activities" || a.category === "food",
    );
    if (nonLogistics.length < 2) {
      for (const s of preferred) {
        if (usedCatalogIds.has(s.item.id)) continue;
        if (
          s.item.category !== "activities" &&
          s.item.category !== "food"
        ) {
          continue;
        }
        if (dayActiveHours(activities) + s.item.durationHours > MAX_DAY_HOURS) {
          continue;
        }
        usedCatalogIds.add(s.item.id);
        activities.push(
          toActivityFromAttraction(
            s.item,
            request.destinationSlug,
            dayNumber,
            request.travelStyle,
            request.budgetTier,
            request.transport,
            request.travelers,
            suggestNextStartTime(activities, s.item.defaultTime ?? "09:00"),
          ),
        );
        if (
          activities.filter(
            (a) => a.category === "activities" || a.category === "food",
          ).length >= 3
        ) {
          break;
        }
      }
    }

    // Lodging: reuse catalog accommodation across nights — do not invent stays.
    const hasStay = activities.some((a) => a.category === "accommodation");
    if (!hasStay && index < dayCount - 1) {
      const stay =
        catalog.find((a) => a.category === "accommodation") ??
        scored.find((s) => s.item.category === "accommodation")?.item;
      if (stay) {
        activities.push(
          toActivityFromAttraction(
            stay,
            request.destinationSlug,
            dayNumber,
            request.travelStyle,
            request.budgetTier,
            request.transport,
            request.travelers,
            "20:00",
          ),
        );
      } else {
        missingLodging = true;
      }
    }

    const trimmed = trimPackedDay(activities);
    trimmed.sort((a, b) => a.time.localeCompare(b.time));

    return {
      dayNumber,
      date: addDays(request.startDate, index),
      title: tmpl.title,
      summary: tmpl.summary,
      activities: trimmed,
    };
  });

  if (skippedCatalogSlots > 0 || missingLodging) {
    limitation =
      (limitation ? `${limitation} ` : "") +
      "Some day slots could not be filled from the destination catalog alone — adjust manually from the catalog or add custom activities.";
  }

  // Clean extended-day titles when cycling templates
  const sourceLen =
    destinationTemplates[request.destinationSlug]?.length ||
    fallbackDaySeed.length;
  const cleaned = days.map((day, index) => {
    if (index < sourceLen) return day;
    return {
      ...day,
      title: `Extended day · ${day.title.replace(/ \(cycle.*\)$/, "")}`,
    };
  });

  // Soft budget trim: if over cap, drop lowest-score optional activities
  const budgetOpts = { travelers: request.travelers };
  const budget = recalculateBudget(
    cleaned,
    request.budgetAmount,
    budgetOpts,
  );
  if (budget.overBudget) {
    const catalogIdsByScore = new Map(
      scored.map((s) => [s.item.id, s.score] as const),
    );
    let working = cleaned.map((d) => ({
      ...d,
      activities: [...d.activities],
    }));
    let guard = 0;
    while (
      recalculateBudget(working, request.budgetAmount, budgetOpts)
        .overBudget &&
      guard < 20
    ) {
      guard += 1;
      const droppable = working
        .flatMap((d) =>
          d.activities.map((a) => ({
            dayNumber: d.dayNumber,
            activity: a,
            score: a.catalogId
              ? (catalogIdsByScore.get(a.catalogId) ?? 0)
              : 0,
          })),
        )
        .filter(
          ({ activity }) =>
            activity.category === "activities" ||
            activity.category === "attractions" ||
            activity.category === "other" ||
            activity.category === "food",
        )
        .sort((a, b) => {
          if (a.score !== b.score) return a.score - b.score;
          return b.activity.costIdr - a.activity.costIdr;
        });
      const target = droppable[0];
      if (!target) break;
      working = working.map((d) =>
        d.dayNumber === target.dayNumber
          ? {
              ...d,
              activities: d.activities.filter(
                (a) => a.id !== target.activity.id,
              ),
            }
          : d,
      );
    }
    return { days: working, limitation };
  }

  return { days: cleaned, limitation };
}

function buildFallbackDays(request: ItineraryGenerationRequest): {
  days: ItineraryDay[];
  usedFallback: boolean;
} {
  const dayCount = daysBetween(request.startDate, request.endDate);
  const { templates, usedFallback } = pickDayTemplates(
    request.destinationSlug,
    dayCount,
  );

  const days: ItineraryDay[] = templates.map((tmpl, index) => {
    const dayNumber = index + 1;
    const activities = filterTemplateActivities(
      tmpl.activities,
      request.travelStyle,
    ).map((t, slot) =>
      toActivityFromTemplate(
        t,
        request.destinationSlug,
        dayNumber,
        slot,
        request.travelStyle,
        request.budgetTier,
        request.transport,
        request.travelers,
      ),
    );

    const hasStay = activities.some((a) => a.category === "accommodation");
    if (!hasStay && index < dayCount - 1) {
      activities.push({
        id: `act_${request.destinationSlug}_d${dayNumber}_overnight`,
        name: "Overnight stay",
        time: "20:00",
        durationHours: 10,
        costIdr: scaleDemoCost(
          request.budgetTier === "premium"
            ? 900_000
            : request.budgetTier === "budget"
              ? 350_000
              : 600_000,
          request.travelStyle,
          request.budgetTier,
          request.transport,
          request.travelers,
          "accommodation",
          "shared",
        ),
        category: "accommodation",
        description: "Demo overnight lodging allocated for this night.",
        costKind: "shared",
      });
      activities.sort((a, b) => a.time.localeCompare(b.time));
    }

    return {
      dayNumber,
      date: addDays(request.startDate, index),
      title: tmpl.title,
      summary: tmpl.summary,
      activities: trimPackedDay(activities),
    };
  });

  const sourceLen =
    destinationTemplates[request.destinationSlug]?.length ||
    fallbackDaySeed.length;
  const cleaned = days.map((day, index) => {
    if (index < sourceLen) return day;
    return {
      ...day,
      title: `Extended day · ${day.title.replace(/ \(cycle.*\)$/, "")}`,
    };
  });

  return { days: cleaned, usedFallback };
}

function buildDays(request: ItineraryGenerationRequest): {
  days: ItineraryDay[];
  usedFallback: boolean;
  limitation: string | null;
  usedCatalog: boolean;
} {
  const dayCount = daysBetween(request.startDate, request.endDate);
  const { templates, usedFallback } = pickDayTemplates(
    request.destinationSlug,
    dayCount,
  );

  if (hasAttractionCatalog(request.destinationSlug) && !usedFallback) {
    const { days, limitation } = buildSmartDaysFromCatalog(request, templates);
    return {
      days,
      usedFallback: false,
      limitation,
      usedCatalog: true,
    };
  }

  const fallback = buildFallbackDays(request);
  return {
    days: fallback.days,
    usedFallback: fallback.usedFallback,
    limitation: fallback.usedFallback
      ? `Preview scaffold for this destination — not a verified full itinerary. Destination-specific attraction catalog is not available yet; days and costs are illustrative fallbacks only. You can still adjust manually.`
      : null,
    usedCatalog: false,
  };
}

export class MockItineraryGenerationService
  implements ItineraryGenerationService
{
  async generate(request: ItineraryGenerationRequest): Promise<Itinerary> {
    // Simulate light async work for loading UX (architecture-ready for real AI)
    await new Promise((resolve) => setTimeout(resolve, 650));

    const destination = getDestinationBySlug(request.destinationSlug);
    if (!destination) {
      throw new Error("Unknown destination");
    }

    const { days, usedFallback, limitation, usedCatalog } = buildDays(request);
    const now = new Date().toISOString();
    const budget = recalculateBudget(days, request.budgetAmount, {
      travelers: request.travelers,
      manualExpenses: [],
    });

    const interestNote =
      (request.interests?.length ?? 0) > 0
        ? ` Interests weighted toward: ${request.interests!.join(", ")}.`
        : "";

    const catalogNote = usedCatalog
      ? " Built from the destination attraction catalog with demo duration and cost estimates. Travel times between stops are not modeled — routes are not geographically optimized."
      : "";

    let generationNote: string;
    if (usedFallback) {
      generationNote =
        limitation ??
        `Preview scaffold for ${destination.name} — not a verified full itinerary.`;
      generationNote +=
        " Adjust days manually from the catalog or custom activities.";
    } else if (limitation) {
      generationNote = `Demo itinerary for ${destination.name}. All costs and schedules are illustrative estimates — not live bookings or quotes.${catalogNote}${interestNote} ${limitation}`;
    } else {
      generationNote = `Demo itinerary for ${destination.name}. All costs and schedules are illustrative estimates — not live bookings or quotes.${catalogNote}${interestNote}`;
    }

    return {
      id: createId("trip"),
      createdAt: now,
      updatedAt: now,
      destinationSlug: destination.slug,
      destinationName: destination.name,
      startDate: request.startDate,
      endDate: request.endDate,
      travelers: request.travelers,
      travelStyle: request.travelStyle,
      budgetTier: request.budgetTier,
      transport: request.transport,
      interests: request.interests ?? [],
      notes: request.notes,
      days,
      manualExpenses: [],
      budget,
      isDemoEstimate: true,
      generationNote,
    };
  }
}

export const itineraryGenerationService: ItineraryGenerationService =
  new MockItineraryGenerationService();
