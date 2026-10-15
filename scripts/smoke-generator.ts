import { MockItineraryGenerationService } from "../src/lib/itinerary-service";
import {
  addActivityToDays,
  recalculateBudget,
  removeActivityFromDays,
  updateActivityInDays,
} from "../src/lib/budget";
import { daysBetween } from "../src/lib/format";
import { itinerarySchema } from "../src/lib/schemas";
import { createId } from "../src/lib/utils";

async function main() {
  const svc = new MockItineraryGenerationService();
  const base = {
    destination: "bali",
    destinationSlug: "bali",
    startDate: "2026-11-01",
    endDate: "2026-11-04",
    travelers: 2,
    travelStyle: "balanced" as const,
    budgetTier: "moderate" as const,
    budgetAmount: 7_500_000,
    transport: "mixed" as const,
  };

  const expectedDays = daysBetween(base.startDate, base.endDate);
  const bali = await svc.generate(base);
  const yogya = await svc.generate({
    ...base,
    destination: "yogyakarta",
    destinationSlug: "yogyakarta",
  });
  const labuan = await svc.generate({
    ...base,
    destination: "labuan-bajo",
    destinationSlug: "labuan-bajo",
  });
  const singleDay = await svc.generate({
    ...base,
    endDate: base.startDate,
  });

  // CRUD + budget recompute (simulates session edit cycle)
  let days = bali.days;
  const day1 = days[0]!;
  const firstId = day1.activities[0]?.id;
  if (firstId) {
    days = updateActivityInDays(days, day1.dayNumber, firstId, {
      costIdr: 999_000,
      name: "Edited activity",
    });
  }
  days = addActivityToDays(days, day1.dayNumber, {
    id: createId("act"),
    name: "New activity",
    time: "21:00",
    durationHours: 1,
    costIdr: 50_000,
    category: "other",
    description: "Smoke-test add",
  });
  const added = days[0]!.activities.find((a) => a.name === "New activity");
  if (added) {
    days = removeActivityFromDays(days, day1.dayNumber, added.id);
  }
  const afterEdit = recalculateBudget(days, bali.budget.budgetCap);

  // sessionStorage round-trip shape (Zod parse = reload gate)
  const roundTrip = itinerarySchema.safeParse(
    JSON.parse(JSON.stringify({ ...bali, days, budget: afterEdit })),
  );

  const sumCats =
    afterEdit.transportation +
    afterEdit.accommodation +
    afterEdit.food +
    afterEdit.activities +
    afterEdit.other;

  const result = {
    expectedDays,
    baliDays: bali.days.length,
    dayCountMatches: bali.days.length === expectedDays,
    singleDayCount: singleDay.days.length === 1,
    datesAligned:
      bali.days[0]?.date === base.startDate &&
      bali.days[bali.days.length - 1]?.date === base.endDate,
    distinctDestinations: bali.days[0]?.title !== yogya.days[0]?.title,
    fallback: labuan.generationNote.includes("not available"),
    crudEdited: days[0]?.activities.some((a) => a.name === "Edited activity"),
    crudRemoved: !days[0]?.activities.some((a) => a.name === "New activity"),
    budgetSumOk: sumCats === afterEdit.total,
    sessionReloadParseOk: roundTrip.success,
    overBudgetFlagConsistent:
      afterEdit.overBudget === afterEdit.total > afterEdit.budgetCap,
  };

  console.log(JSON.stringify(result, null, 2));

  const failed = Object.entries(result)
    .filter(([, v]) => v === false)
    .map(([key]) => key);
  if (failed.length) {
    console.error("SMOKE FAILED", failed);
    process.exit(1);
  }
  console.log("SMOKE OK");
}

main();
