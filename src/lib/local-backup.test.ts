import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LOCAL_BACKUP_KIND } from "./schemas";
import {
  MAX_BACKUP_BYTES,
  parseLocalBackup,
  readBackupFile,
} from "./local-backup";
import { planTripMerge } from "./trips-storage";
import type { Itinerary } from "../types";

function sampleTrip(id: string, title?: string): Itinerary {
  return {
    id,
    createdAt: "2034-01-01T00:00:00.000Z",
    updatedAt: "2034-01-01T00:00:00.000Z",
    title,
    destinationSlug: "bali",
    destinationName: "Bali",
    startDate: "2034-01-10",
    endDate: "2034-01-12",
    travelers: 2,
    travelStyle: "balanced",
    budgetTier: "moderate",
    transport: "mixed",
    days: [
      {
        dayNumber: 1,
        date: "2034-01-10",
        title: "Day 1",
        summary: "",
        activities: [
          {
            id: "act_1",
            name: "Walk",
            time: "10:00",
            durationHours: 1,
            costIdr: 0,
            category: "activities",
            description: "Demo",
          },
        ],
      },
    ],
    manualExpenses: [],
    budget: {
      transportation: 0,
      accommodation: 0,
      food: 0,
      attractions: 0,
      activities: 0,
      other: 0,
      total: 0,
      budgetCap: 5_000_000,
      remaining: 5_000_000,
      overBudget: false,
    },
    isDemoEstimate: true,
    generationNote: "Demo itinerary for Bali.",
  };
}

describe("parseLocalBackup", () => {
  it("accepts the portable envelope with trips", () => {
    const result = parseLocalBackup({
      kind: LOCAL_BACKUP_KIND,
      version: 1,
      exportedAt: "2034-01-01T00:00:00.000Z",
      trips: [sampleTrip("trip_1")],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.backup.trips?.length, 1);
  });

  it("accepts bare saved-trips store shape", () => {
    const result = parseLocalBackup({
      version: 1,
      trips: [sampleTrip("trip_2")],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.backup.trips?.[0]?.id, "trip_2");
  });

  it("accepts wishlist store and slug arrays", () => {
    const store = parseLocalBackup({ version: 1, slugs: ["bali", "bandung"] });
    assert.equal(store.ok, true);
    if (!store.ok) return;
    assert.deepEqual(store.backup.wishlistSlugs, ["bali", "bandung"]);

    const bare = parseLocalBackup(["yogyakarta"]);
    assert.equal(bare.ok, true);
    if (!bare.ok) return;
    assert.deepEqual(bare.backup.wishlistSlugs, ["yogyakarta"]);
  });

  it("rejects empty or unrelated JSON", () => {
    assert.equal(parseLocalBackup({}).ok, false);
    assert.equal(
      parseLocalBackup({
        kind: LOCAL_BACKUP_KIND,
        version: 1,
        exportedAt: "2034-01-01T00:00:00.000Z",
      }).ok,
      false,
    );
    assert.equal(parseLocalBackup({ hello: "world" }).ok, false);
  });
});

describe("readBackupFile size guard", () => {
  it("exports a 5 MB max", () => {
    assert.equal(MAX_BACKUP_BYTES, 5 * 1024 * 1024);
  });

  it("rejects oversized files before parsing", async () => {
    const file = new File(["{}"], "huge.json", { type: "application/json" });
    Object.defineProperty(file, "size", { value: MAX_BACKUP_BYTES + 1 });
    const result = await readBackupFile(file);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "too_large");
  });

  it("parses a small valid trips backup", async () => {
    const payload = {
      kind: LOCAL_BACKUP_KIND,
      version: 1,
      exportedAt: "2034-01-01T00:00:00.000Z",
      trips: [sampleTrip("trip_small")],
    };
    const file = new File([JSON.stringify(payload)], "ok.json", {
      type: "application/json",
    });
    const result = await readBackupFile(file);
    assert.equal(result.ok, true);
  });
});

describe("planTripMerge non-wipe", () => {
  it("skips same-id trips by default and keeps existing title", () => {
    const current = [sampleTrip("trip_a", "Mine")];
    const incoming = [sampleTrip("trip_a", "Imported"), sampleTrip("trip_b")];
    const planned = planTripMerge(current, incoming);
    assert.equal(planned.imported, 1);
    assert.equal(planned.duplicatesSkipped, 1);
    assert.equal(planned.replaced, 0);
    assert.equal(planned.trips.length, 2);
    const kept = planned.trips.find((t) => t.id === "trip_a");
    assert.equal(kept?.title, "Mine");
    assert.ok(planned.trips.some((t) => t.id === "trip_b"));
  });

  it("replaces same-id trips when onDuplicate is replace", () => {
    const current = [sampleTrip("trip_a", "Mine")];
    const incoming = [sampleTrip("trip_a", "Imported")];
    const planned = planTripMerge(current, incoming, { onDuplicate: "replace" });
    assert.equal(planned.imported, 0);
    assert.equal(planned.replaced, 1);
    assert.equal(planned.duplicatesSkipped, 0);
    assert.equal(planned.trips[0]?.title, "Imported");
  });

  it("does not wipe current when import is all invalid", () => {
    const current = [sampleTrip("trip_keep", "Keep me")];
    const planned = planTripMerge(current, [
      { not: "an itinerary" } as unknown as Itinerary,
    ]);
    assert.equal(planned.imported, 0);
    assert.equal(planned.skipped, 1);
    assert.equal(planned.trips.length, 1);
    assert.equal(planned.trips[0]?.title, "Keep me");
  });

  it("does not wipe current when import is empty", () => {
    const current = [sampleTrip("trip_keep")];
    const planned = planTripMerge(current, []);
    assert.equal(planned.trips.length, 1);
    assert.equal(planned.imported, 0);
  });
});
