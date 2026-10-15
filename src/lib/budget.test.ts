import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categorySharePercent,
  estimatedCostPerPerson,
  getOptimizationSuggestions,
  manualExpenseTripCost,
  recalculateBudget,
  scaleDemoCost,
  sumByCategory,
  validateManualExpenseDraft,
} from "./budget";
import type { ItineraryDay, ManualExpense } from "../types";

const emptyDays: ItineraryDay[] = [
  {
    dayNumber: 1,
    date: "2030-01-01",
    title: "Day 1",
    summary: "",
    activities: [],
  },
];

describe("budget calculation rules", () => {
  it("safe zero totals for empty itinerary", () => {
    const budget = recalculateBudget(emptyDays, 1_000_000, {
      travelers: 2,
      manualExpenses: [],
    });
    assert.equal(budget.total, 0);
    assert.equal(budget.attractions, 0);
    assert.equal(budget.remaining, 1_000_000);
    assert.equal(budget.overBudget, false);
    assert.equal(categorySharePercent(0, 0), 0);
  });

  it("does not re-multiply stored activity costs by travelers", () => {
    const days: ItineraryDay[] = [
      {
        dayNumber: 1,
        date: "2030-01-01",
        title: "Day 1",
        summary: "",
        activities: [
          {
            id: "a1",
            name: "Shared van",
            time: "09:00",
            durationHours: 2,
            costIdr: 400_000,
            category: "transportation",
            description: "",
            costKind: "shared",
          },
          {
            id: "a2",
            name: "Lunch",
            time: "12:00",
            durationHours: 1,
            costIdr: 300_000,
            category: "food",
            description: "",
            costKind: "perPerson",
          },
        ],
      },
    ];
    const forTwo = recalculateBudget(days, 5_000_000, { travelers: 2 });
    const forFour = recalculateBudget(days, 5_000_000, { travelers: 4 });
    assert.equal(forTwo.total, 700_000);
    assert.equal(forFour.total, 700_000);
  });

  it("scales manual per-person vs shared correctly", () => {
    const expenses: ManualExpense[] = [
      {
        id: "e1",
        name: "SIM",
        category: "other",
        amountIdr: 50_000,
        costKind: "perPerson",
      },
      {
        id: "e2",
        name: "Tip pool",
        category: "other",
        amountIdr: 100_000,
        costKind: "shared",
      },
    ];
    assert.equal(manualExpenseTripCost(expenses[0]!, 1), 50_000);
    assert.equal(manualExpenseTripCost(expenses[0]!, 3), 150_000);
    assert.equal(manualExpenseTripCost(expenses[1]!, 3), 100_000);

    const budget = recalculateBudget(emptyDays, 1_000_000, {
      travelers: 3,
      manualExpenses: expenses,
    });
    assert.equal(budget.other, 250_000);
    assert.equal(budget.total, 250_000);
  });

  it("category totals and percentages", () => {
    const days: ItineraryDay[] = [
      {
        dayNumber: 1,
        date: "2030-01-01",
        title: "Day 1",
        summary: "",
        activities: [
          {
            id: "a1",
            name: "Hotel",
            time: "15:00",
            durationHours: 1,
            costIdr: 600_000,
            category: "accommodation",
            description: "",
            costKind: "shared",
          },
          {
            id: "a2",
            name: "Ticket",
            time: "10:00",
            durationHours: 2,
            costIdr: 400_000,
            category: "attractions",
            description: "",
            costKind: "perPerson",
          },
        ],
      },
    ];
    const totals = sumByCategory(days);
    assert.equal(totals.accommodation, 600_000);
    assert.equal(totals.attractions, 400_000);
    const budget = recalculateBudget(days, 2_000_000);
    assert.equal(budget.total, 1_000_000);
    assert.equal(categorySharePercent(budget.accommodation, budget.total), 60);
    assert.equal(categorySharePercent(budget.attractions, budget.total), 40);
  });

  it("over-budget flag and per-person display", () => {
    const days: ItineraryDay[] = [
      {
        dayNumber: 1,
        date: "2030-01-01",
        title: "Day 1",
        summary: "",
        activities: [
          {
            id: "a1",
            name: "Tour",
            time: "09:00",
            durationHours: 4,
            costIdr: 2_000_000,
            category: "activities",
            description: "",
          },
        ],
      },
    ];
    const budget = recalculateBudget(days, 500_000, { travelers: 2 });
    assert.equal(budget.overBudget, true);
    assert.equal(budget.remaining, -1_500_000);
    assert.equal(estimatedCostPerPerson(budget.total, 2), 1_000_000);
    const tips = getOptimizationSuggestions({ days, budget });
    assert.ok(tips.length > 0);
    assert.ok(tips.every((t) => typeof t.message === "string"));
  });

  it("rejects invalid manual expense amounts", () => {
    assert.equal(
      validateManualExpenseDraft({
        name: "x",
        amountIdr: -1,
        category: "other",
        costKind: "shared",
      }),
      "Amount must be a non-negative number",
    );
    assert.equal(
      validateManualExpenseDraft({
        name: "",
        amountIdr: 10,
        category: "other",
        costKind: "shared",
      }),
      "Name is required",
    );
    assert.equal(
      validateManualExpenseDraft({
        name: "OK",
        amountIdr: 10_000,
        category: "food",
        costKind: "perPerson",
      }),
      null,
    );
  });

  it("scaleDemoCost multiplies per-person once at generation", () => {
    const one = scaleDemoCost(
      100_000,
      "balanced",
      "moderate",
      "mixed",
      1,
      "food",
      "perPerson",
    );
    const four = scaleDemoCost(
      100_000,
      "balanced",
      "moderate",
      "mixed",
      4,
      "food",
      "perPerson",
    );
    assert.equal(four, one * 4);

    const sharedOne = scaleDemoCost(
      200_000,
      "balanced",
      "moderate",
      "mixed",
      1,
      "transportation",
      "shared",
    );
    const sharedFour = scaleDemoCost(
      200_000,
      "balanced",
      "moderate",
      "mixed",
      4,
      "transportation",
      "shared",
    );
    assert.equal(sharedOne, sharedFour);
  });
});
