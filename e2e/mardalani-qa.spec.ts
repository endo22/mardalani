import { expect, type Download, type Page, test } from "@playwright/test";
import fs from "node:fs/promises";
import { PDFParse } from "pdf-parse";

const STORAGE_KEY = "mardalani_itinerary_v1";
const SAVED_TRIPS_KEY = "mardalani_saved_trips_v1";
const WISHLIST_KEY = "mardalani_wishlist_v1";

const MAIN_DESTINATIONS = [
  "danau-toba",
  "yogyakarta",
  "bali",
  "bandung",
  "lombok",
  "labuan-bajo",
  "raja-ampat",
  "jakarta",
] as const;

const PHASE2_DESTINATIONS = [
  "labuan-bajo",
  "raja-ampat",
  "jakarta",
] as const;

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
  expect(
    overflow.scrollWidth,
    `horizontal overflow: scrollWidth=${overflow.scrollWidth} > innerWidth=${overflow.innerWidth}`,
  ).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

async function readBudgetTotalText(page: Page): Promise<string> {
  const dd = page.getByTestId("budget-total");
  await expect(dd).toBeVisible();
  return (await dd.innerText()).trim();
}

/** Source-of-truth trip total from sessionStorage (matches recalculateBudget). */
async function readStoredBudgetTotalFormatted(page: Page): Promise<string> {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    if (!raw) return "";
    const data = JSON.parse(raw) as { budget?: { total?: number } };
    const total = data.budget?.total ?? 0;
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Math.round(total));
  }, STORAGE_KEY);
}

async function generatePlan(
  page: Page,
  opts: {
    destination: string;
    startDate?: string;
    endDate?: string;
    travelers?: string;
    budgetAmount?: string;
    interests?: string[];
    travelStyle?: string;
    transport?: string;
  },
) {
  // Prefill destination via search params (stable under React remounts).
  await page.goto(`/plan?destination=${encodeURIComponent(opts.destination)}`);
  await expect(page.locator("#destination")).toHaveValue(opts.destination);
  await page.locator("#startDate").fill(opts.startDate ?? "2030-06-10");
  await page.locator("#endDate").fill(opts.endDate ?? "2030-06-13");
  await page.locator("#travelers").fill(opts.travelers ?? "2");
  if (opts.budgetAmount) {
    await page.locator("#budgetAmount").fill(opts.budgetAmount);
  }
  if (opts.travelStyle) {
    await page.locator("#travelStyle").selectOption(opts.travelStyle);
  }
  if (opts.transport) {
    await page.locator("#transport").selectOption(opts.transport);
  }
  if (opts.interests?.length) {
    for (const interest of opts.interests) {
      const box = page.getByTestId(`interest-${interest}`);
      await box.check({ force: true });
      await expect(box).toBeChecked();
    }
  }
  await page.getByRole("button", { name: /Generate itinerary/i }).click();
  await expect(page).toHaveURL(/\/itinerary/, { timeout: 15_000 });
}

function normalizeMoneyText(value: string): string {
  return value.replace(/\s+/g, "").replace(/\u00a0/g, "");
}

async function readDownloadBuffer(download: Download): Promise<Buffer> {
  const failure = await download.failure();
  expect(failure, `download failed: ${failure}`).toBeNull();
  const stream = await download.createReadStream();
  expect(stream, "download stream missing").toBeTruthy();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function exportPdfAndRead(page: Page): Promise<{
  buffer: Buffer;
  filename: string;
  text: string;
}> {
  const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByTestId("export-pdf").click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  expect(filename).toMatch(/\.pdf$/i);
  const buffer = await readDownloadBuffer(download);
  expect(buffer.byteLength).toBeGreaterThan(500);
  expect(buffer.subarray(0, 4).toString("utf8")).toBe("%PDF");

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { buffer, filename, text: result.text };
  } finally {
    await parser.destroy();
  }
}

test.describe("MARDALANI browser QA", () => {
  test("1. Landing loads with key CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Map the journey/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Start planning/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Open full planner/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Browse destinations/i }),
    ).toBeVisible();
  });

  test("2. Phase-2 destinations are full catalogs (no scaffold badge)", async ({
    page,
  }) => {
    await page.goto("/destinations");
    await expect(
      page.getByRole("heading", { name: "Destinations", exact: true }),
    ).toBeVisible();

    for (const name of ["Labuan Bajo", "Raja Ampat", "Jakarta"]) {
      const card = page.locator("article").filter({ hasText: name });
      await expect(card).toBeVisible();
      await expect(card.getByText(/Preview scaffold/i)).toHaveCount(0);
    }
  });

  test("3. Bali detail CTA prefills planner destination", async ({ page }) => {
    await page.goto("/destinations/bali");
    await expect(page.getByRole("heading", { name: "Bali" })).toBeVisible();
    await page.getByRole("link", { name: /Plan this route/i }).click();
    await expect(page).toHaveURL(/\/plan\?destination=bali/);
    await expect(page.locator("#destination")).toHaveValue("bali");
  });

  test("4–7. Plan → itinerary edit → reload → empty state", async ({
    page,
  }) => {
    await page.goto("/plan");
    await expect(
      page.getByRole("heading", { name: /Shape the route/i }),
    ).toBeVisible();

    // Invalid submit: end before start
    await page.locator("#destination").selectOption("bali");
    await page.locator("#startDate").fill("2030-06-10");
    await page.locator("#endDate").fill("2030-06-01");
    await page.locator("#travelers").fill("2");
    await page.getByRole("button", { name: /Generate itinerary/i }).click();
    await expect(page.locator("#endDate-error")).toContainText(
      /End date must be on or after start date/i,
    );
    await expect(page).toHaveURL(/\/plan/);

    // Valid submit
    await page.locator("#endDate").fill("2030-06-13");
    await page.getByRole("button", { name: /Generate itinerary/i }).click();
    await expect(page).toHaveURL(/\/itinerary/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Bali" })).toBeVisible();
    await expect(page.getByText("Budget snapshot")).toBeVisible();

    const budgetBefore = await readBudgetTotalText(page);
    expect(budgetBefore.length).toBeGreaterThan(0);

    // Add activity with cost → budget should change
    await page.getByRole("button", { name: /Add custom activity/i }).click();
    await expect(
      page.getByRole("heading", { name: /Add activity/i }),
    ).toBeVisible();
    await page.locator("#act-name").fill("QA Cafe Stop");
    await page.locator("#act-time").fill("15:30");
    await page.locator("#act-duration").fill("1");
    await page.locator("#act-cost").fill("250000");
    await page.locator("#act-cat").selectOption("food");
    await page.locator("#act-desc").fill("Playwright QA activity");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Add activity$/i })
      .click();
    await expect(page.getByRole("heading", { name: "QA Cafe Stop" })).toBeVisible();

    await expect
      .poll(async () => readBudgetTotalText(page), { timeout: 8_000 })
      .not.toBe(budgetBefore);

    const budgetAfterAdd = await readBudgetTotalText(page);

    // Edit that activity cost + duration + notes
    await page.getByRole("button", { name: /Edit QA Cafe Stop/i }).click();
    await page.locator("#act-cost").fill("500000");
    await page.locator("#act-duration").fill("2");
    await page.locator("#act-notes").fill("QA personal note");
    await page.getByRole("button", { name: /Save changes/i }).click();
    await expect
      .poll(async () => readBudgetTotalText(page), { timeout: 8_000 })
      .not.toBe(budgetAfterAdd);
    await expect(page.getByText(/Note: QA personal note/i)).toBeVisible();

    const budgetAfterEdit = await readBudgetTotalText(page);

    // Delete activity with confirm → budget should change again
    await page.getByRole("button", { name: /Remove QA Cafe Stop/i }).click();
    await page.getByTestId("confirm-delete").click();
    await expect(page.getByRole("heading", { name: "QA Cafe Stop" })).toHaveCount(
      0,
    );
    await expect
      .poll(async () => readBudgetTotalText(page), { timeout: 8_000 })
      .not.toBe(budgetAfterEdit);

    // Reload: sessionStorage should keep itinerary
    await page.reload();
    await expect(page.getByRole("heading", { name: "Bali" })).toBeVisible();
    await expect(page.getByText("Budget snapshot")).toBeVisible();
    const stored = await page.evaluate(
      (key) => sessionStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(stored).toBeTruthy();

    // Empty state after clearing storage
    await page.evaluate((key) => sessionStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /No itinerary in this session/i }),
    ).toBeVisible();
    await expect(
      page.locator("#main").getByRole("link", { name: /Plan your route/i }),
    ).toBeVisible();
  });

  test("8. Unknown destination slug returns 404", async ({ page }) => {
    const response = await page.goto("/destinations/does-not-exist-xyz");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByText(/This page could not be found|404|Not Found/i).first(),
    ).toBeVisible();
  });

  test("9–10. No horizontal overflow at 375 / 768 / desktop", async ({
    page,
  }) => {
    const viewports = [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ] as const;
    const paths = ["/", "/plan", "/destinations", "/trips", "/wishlist"] as const;

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const path of paths) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await assertNoHorizontalOverflow(page);
      }
    }
  });

  test("11. Generate all full destinations — catalog-only + day split", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const foreignSamples: Record<string, string[]> = {
      "danau-toba": [
        "Borobudur",
        "Uluwatu",
        "Tangkuban Perahu",
        "Mawun Beach",
        "Padar Island",
        "Piaynemo",
        "Kota Tua",
      ],
      yogyakarta: [
        "Tegallalang",
        "Samosir",
        "Tangkuban Perahu",
        "Gili Trawangan",
        "Komodo",
        "Piaynemo",
      ],
      bali: [
        "Borobudur",
        "Ambarita",
        "Tangkuban Perahu",
        "Mawun Beach",
        "Padar Island",
        "Monas",
      ],
      bandung: [
        "Borobudur",
        "Uluwatu",
        "Samosir",
        "Gili Trawangan",
        "Pink Beach snorkel",
        "Arborek",
      ],
      lombok: [
        "Borobudur",
        "Tegallalang",
        "Ambarita",
        "Gedung Sate",
        "Padar Island",
        "Museum Nasional",
      ],
      "labuan-bajo": [
        "Borobudur",
        "Tegallalang",
        "Samosir",
        "Piaynemo",
        "Kota Tua",
        "Mawun Beach",
      ],
      "raja-ampat": [
        "Borobudur",
        "Padar Island",
        "Uluwatu",
        "Kota Tua",
        "Tangkuban Perahu",
        "Mawun Beach",
      ],
      jakarta: [
        "Borobudur",
        "Padar Island",
        "Piaynemo",
        "Uluwatu",
        "Samosir",
        "Mawun Beach",
      ],
    };

    for (const slug of MAIN_DESTINATIONS) {
      await generatePlan(page, {
        destination: slug,
        startDate: "2031-03-01",
        endDate: "2031-03-03",
      });
      const heading = await page.locator("h1").first().innerText();
      expect(heading.length).toBeGreaterThan(0);

      const body = await page.locator("#main").innerText();
      for (const foreign of foreignSamples[slug] ?? []) {
        expect(body, `${slug} should not include ${foreign}`).not.toContain(
          foreign,
        );
      }

      // Generated activities come from destination catalog (no invented lodging)
      await expect(page.locator("[data-catalog-id]").first()).toBeVisible();
      expect(body).not.toContain("Overnight stay");

      // Day split across duration (3 calendar days → Day 1–3 tabs)
      await expect(page.getByRole("tab", { name: "Day 1" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Day 2" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Day 3" })).toBeVisible();

      const counts: number[] = [];
      for (const day of [1, 2, 3] as const) {
        await page.getByRole("tab", { name: `Day ${day}` }).click();
        counts.push(
          await page.locator("li").filter({ has: page.locator("h3") }).count(),
        );
      }
      expect(
        counts.some((n) => n > 0),
        `${slug} should place activities on at least one day`,
      ).toBe(true);
      const nonempty = counts.filter((n) => n > 0).length;
      expect(nonempty).toBeGreaterThanOrEqual(2);
    }
  });

  test("12. Interests influence generation when catalog allows", async ({
    page,
  }) => {
    await generatePlan(page, {
      destination: "bali",
      interests: ["beach", "relaxation"],
      startDate: "2031-04-01",
      endDate: "2031-04-03",
    });
    await expect(page.getByText(/beach|relaxation/i).first()).toBeVisible();
    const note = await page
      .locator("p")
      .filter({ hasText: /Demo itinerary for Bali/i })
      .first()
      .innerText();
    expect(note.toLowerCase()).toMatch(/beach|relaxation|interests weighted/);
  });

  test("13. Move activity between days + empty day state", async ({ page }) => {
    await generatePlan(page, {
      destination: "yogyakarta",
      startDate: "2031-05-01",
      endDate: "2031-05-03",
    });
    await expect(
      page.getByRole("heading", { name: "Yogyakarta", exact: true }),
    ).toBeVisible();

    const firstCard = page.locator("li").filter({ has: page.locator("h3") }).first();
    const name = await firstCard.locator("h3").innerText();
    const moveSelect = firstCard.locator("select[id^='move-']").first();
    await moveSelect.selectOption("3");

    await page.getByRole("tab", { name: "Day 3" }).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();

    // Empty day 1 by moving every remaining activity to day 3
    await page.getByRole("tab", { name: "Day 1" }).click();
    for (let guard = 0; guard < 20; guard++) {
      const movers = page.locator("select[id^='move-']");
      if ((await movers.count()) === 0) break;
      await movers.first().selectOption("3");
      await page.waitForTimeout(150);
    }
    await expect(page.getByTestId("empty-day")).toBeVisible();
  });

  test("14. Time conflict warning does not block save", async ({ page }) => {
    await generatePlan(page, {
      destination: "bandung",
      startDate: "2031-06-01",
      endDate: "2031-06-02",
    });

    await page.getByRole("button", { name: /Add custom activity/i }).click();
    await page.locator("#act-name").fill("Overlap A");
    await page.locator("#act-time").fill("10:00");
    await page.locator("#act-duration").fill("3");
    await page.locator("#act-cost").fill("10000");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Add activity$/i })
      .click();
    await expect(page.getByRole("heading", { name: "Overlap A" })).toBeVisible();

    await page.getByRole("button", { name: /Add custom activity/i }).click();
    await page.locator("#act-name").fill("Overlap B");
    await page.locator("#act-time").fill("11:00");
    await page.locator("#act-duration").fill("2");
    await page.locator("#act-cost").fill("10000");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Add activity$/i })
      .click();
    await expect(page.getByRole("heading", { name: "Overlap B" })).toBeVisible();

    await expect(page.getByTestId("schedule-warnings")).toContainText(
      /Time overlap|packed/i,
    );
    // Still persisted
    await page.reload();
    await expect(page.getByRole("heading", { name: "Overlap A" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Overlap B" })).toBeVisible();
  });

  test("15. Budget updates for 1 vs many travelers + over-budget", async ({
    page,
  }) => {
    await generatePlan(page, {
      destination: "lombok",
      travelers: "1",
      budgetAmount: "50000000",
      startDate: "2031-07-01",
      endDate: "2031-07-03",
    });
    const totalOne = await readBudgetTotalText(page);

    await generatePlan(page, {
      destination: "lombok",
      travelers: "4",
      budgetAmount: "50000000",
      startDate: "2031-07-01",
      endDate: "2031-07-03",
    });
    const totalFour = await readBudgetTotalText(page);
    // With per-person food/activities, 4 travelers should generally cost more
    expect(totalFour).not.toBe(totalOne);

    await generatePlan(page, {
      destination: "bali",
      travelers: "2",
      budgetAmount: "500000",
      startDate: "2031-08-01",
      endDate: "2031-08-03",
    });
    await expect(page.getByTestId("over-budget")).toBeVisible();
  });

  test("16. Add from catalog + invalid storage cleared safely", async ({
    page,
  }) => {
    await generatePlan(page, {
      destination: "danau-toba",
      startDate: "2031-09-01",
      endDate: "2031-09-03",
    });

    await page.getByRole("button", { name: /Add from catalog/i }).click();
    await expect(page.getByTestId("catalog-list")).toBeVisible();
    await page.locator("[data-testid^=catalog-item-]").first().click();

    // Corrupt storage → app should not crash; empty or recovered
    await page.evaluate((key) => {
      sessionStorage.setItem(key, "{not-valid-json");
    }, STORAGE_KEY);
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: /No itinerary in this session|Danau Toba/i,
      }),
    ).toBeVisible();
  });

  test("17. Clear → empty after generate", async ({ page }) => {
    await generatePlan(page, {
      destination: "bali",
      startDate: "2031-10-01",
      endDate: "2031-10-02",
    });
    await page.evaluate((key) => sessionStorage.removeItem(key), STORAGE_KEY);
    await page.goto("/itinerary");
    await expect(
      page.getByRole("heading", { name: /No itinerary in this session/i }),
    ).toBeVisible();
  });

  test("18. Phase-2 detail slugs show catalog + no scaffold", async ({
    page,
  }) => {
    const titles: Record<(typeof PHASE2_DESTINATIONS)[number], string> = {
      "labuan-bajo": "Labuan Bajo",
      "raja-ampat": "Raja Ampat",
      jakarta: "Jakarta",
    };
    for (const slug of PHASE2_DESTINATIONS) {
      await page.goto(`/destinations/${slug}`);
      await expect(
        page.getByRole("heading", { name: titles[slug], exact: true }),
      ).toBeVisible();
      await expect(page.getByText(/Preview scaffold/i)).toHaveCount(0);
      await expect(page.getByTestId("attraction-catalog")).toBeVisible();
      const attractionCount = await page.locator("[data-attraction-id]").count();
      expect(attractionCount).toBeGreaterThanOrEqual(10);
      await page.getByRole("link", { name: /Plan this route/i }).click();
      await expect(page).toHaveURL(
        new RegExp(`/plan\\?destination=${slug}`),
      );
      await expect(page.locator("#destination")).toHaveValue(slug);
    }
  });

  test("19. Generated catalogIds stay within destination relations", async ({
    page,
  }) => {
    const expectedPrefixes: Record<
      (typeof PHASE2_DESTINATIONS)[number],
      string
    > = {
      "labuan-bajo": "lbj-",
      "raja-ampat": "raja-",
      jakarta: "jkt-",
    };

    for (const slug of PHASE2_DESTINATIONS) {
      await generatePlan(page, {
        destination: slug,
        startDate: "2032-01-10",
        endDate: "2032-01-12",
      });
      const ids = await page.locator("[data-catalog-id]").evaluateAll((nodes) =>
        nodes
          .map((n) => n.getAttribute("data-catalog-id"))
          .filter((v): v is string => Boolean(v)),
      );
      expect(ids.length).toBeGreaterThan(0);
      const prefix = expectedPrefixes[slug];
      for (const id of ids) {
        expect(id.startsWith(prefix), `${slug} got foreign id ${id}`).toBe(
          true,
        );
      }
      const body = await page.locator("#main").innerText();
      expect(body.toLowerCase()).not.toContain("preview scaffold");
      expect(body).toMatch(/demo itinerary|attraction catalog/i);
    }
  });

  test("20. Phase-3 budget categories, shares, and zero-safe empty costs", async ({
    page,
  }) => {
    await generatePlan(page, {
      destination: "bali",
      travelers: "2",
      budgetAmount: "50000000",
      startDate: "2032-02-01",
      endDate: "2032-02-02",
    });

    await expect(page.getByTestId("budget-panel")).toBeVisible();
    await expect(page.getByTestId("budget-categories")).toBeVisible();
    for (const cat of [
      "transportation",
      "accommodation",
      "food",
      "attractions",
      "activities",
      "other",
    ]) {
      await expect(page.getByTestId(`budget-cat-${cat}`)).toBeVisible();
      await expect(page.getByTestId(`budget-cat-${cat}`)).toContainText(/%/);
    }

    // Clear day activities via storage mutation → zero-ish category math safe
    await page.evaluate((key) => {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        days: { activities: unknown[] }[];
        budget: { budgetCap: number };
        travelers: number;
        manualExpenses?: unknown[];
      };
      data.days = data.days.map((d) => ({ ...d, activities: [] }));
      data.manualExpenses = [];
      sessionStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    await page.reload();
    await expect(page.getByTestId("budget-total")).toContainText(/Rp\s*0|Rp0/i);
    await expect(page.getByTestId("budget-cat-activities")).toContainText("(0%)");
    await expect(page.getByTestId("manual-expenses-empty")).toBeVisible();
  });

  test("21. Phase-3 manual expenses per-person vs shared + persistence", async ({
    page,
  }) => {
    await generatePlan(page, {
      destination: "yogyakarta",
      travelers: "3",
      budgetAmount: "50000000",
      startDate: "2032-03-01",
      endDate: "2032-03-02",
    });

    const totalBefore = await readBudgetTotalText(page);

    await page.getByTestId("add-manual-expense").click();
    await expect(page.getByTestId("manual-expense-form")).toBeVisible();
    await page.getByTestId("exp-name").fill("QA SIM cards");
    await page.getByTestId("exp-amount").fill("50000");
    await page.getByTestId("exp-cost-kind").selectOption("perPerson");
    await page.getByTestId("exp-cat").selectOption("other");
    await page.getByTestId("exp-note").fill("Phase 3 QA");
    await page.getByTestId("exp-submit").click();

    await expect(page.getByText("QA SIM cards")).toBeVisible();
    await expect
      .poll(async () => readBudgetTotalText(page), { timeout: 8_000 })
      .not.toBe(totalBefore);

    // Per person × 3 travelers → +150000 to other category
    await expect(page.getByTestId("budget-cat-other")).toContainText(/150\.000|150000/);

    const afterPerPerson = await readBudgetTotalText(page);

    // Shared expense counts once (use attractions — usually empty on generated plans)
    await page.getByTestId("add-manual-expense").click();
    await page.getByTestId("exp-name").fill("QA Shared tip");
    await page.getByTestId("exp-amount").fill("100000");
    await page.getByTestId("exp-cost-kind").selectOption("shared");
    await page.getByTestId("exp-cat").selectOption("attractions");
    await page.getByTestId("exp-submit").click();
    await expect(page.getByText("QA Shared tip")).toBeVisible();
    await expect
      .poll(async () => readBudgetTotalText(page), { timeout: 8_000 })
      .not.toBe(afterPerPerson);
    await expect(page.getByTestId("budget-cat-attractions")).toContainText(
      /100\.000|100000/,
    );

    // Edit expense
    await page.getByRole("button", { name: /Edit expense QA Shared tip/i }).click();
    await page.getByTestId("exp-amount").fill("200000");
    await page.getByTestId("exp-submit").click();
    await expect(page.getByTestId("budget-cat-attractions")).toContainText(
      /200\.000|200000/,
    );

    // Invalid / negative rejected
    await page.getByTestId("add-manual-expense").click();
    await page.getByTestId("exp-name").fill("Bad");
    await page.getByTestId("exp-amount").fill("-5000");
    await page.getByTestId("exp-submit").click();
    await expect(page.getByTestId("exp-error")).toContainText(/non-negative/i);
    await page.getByRole("button", { name: /^Cancel$/i }).click();

    // Reload persistence
    await page.reload();
    await expect(page.getByText("QA SIM cards")).toBeVisible();
    await expect(page.getByText("QA Shared tip")).toBeVisible();
    await expect(page.getByText(/Phase 3 QA/i)).toBeVisible();

    // Delete
    await page
      .getByRole("button", { name: /Remove expense QA SIM cards/i })
      .click();
    await page.getByTestId("confirm-expense-delete").click();
    await expect(page.getByText("QA SIM cards")).toHaveCount(0);
  });

  test("22. Phase-3 over-budget suggestions without silent removals", async ({
    page,
  }) => {
    await generatePlan(page, {
      destination: "lombok",
      travelers: "2",
      budgetAmount: "500000",
      startDate: "2032-04-01",
      endDate: "2032-04-03",
    });

    await expect(page.getByTestId("over-budget")).toBeVisible();
    await expect(page.getByTestId("budget-suggestions")).toBeVisible();
    const activityCount = await page
      .locator("li")
      .filter({ has: page.locator("h3") })
      .count();
    expect(activityCount).toBeGreaterThan(0);

    // Lowering budget further should not remove activities
    await page.getByTestId("budget-cap-input").fill("100000");
    await page.getByTestId("budget-cap-apply").click();
    await expect(page.getByTestId("over-budget")).toBeVisible();
    const after = await page
      .locator("li")
      .filter({ has: page.locator("h3") })
      .count();
    expect(after).toBe(activityCount);
  });

  test("23. Phase-3 malformed storage + mobile budget panel", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await generatePlan(page, {
      destination: "bandung",
      startDate: "2032-05-01",
      endDate: "2032-05-02",
    });
    await expect(page.getByTestId("budget-panel")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    // Pre–Phase-3 snapshot missing attractions + manualExpenses still loads
    await page.evaluate((key) => {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const data = JSON.parse(raw) as Record<string, unknown>;
      const budget = data.budget as Record<string, unknown>;
      delete budget.attractions;
      delete data.manualExpenses;
      sessionStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Bandung", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("budget-cat-attractions")).toBeVisible();

    // Truly malformed → empty state
    await page.evaluate((key) => {
      sessionStorage.setItem(key, "{broken");
    }, STORAGE_KEY);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /No itinerary in this session/i }),
    ).toBeVisible();
  });

  test("24. Phase-4 Export PDF visible, a11y, download, and budget match", async ({
    page,
  }) => {
    await generatePlan(page, {
      destination: "bali",
      travelers: "2",
      budgetAmount: "50000000",
      startDate: "2033-01-10",
      endDate: "2033-01-12",
    });

    const exportBtn = page.getByTestId("export-pdf");
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();
    await expect(exportBtn).toHaveAttribute("type", "button");
    await expect(exportBtn).toContainText(/Export PDF/i);
    await expect(page.getByTestId("export-pdf-hint")).toBeVisible();

    const storedTotal = await readStoredBudgetTotalFormatted(page);
    await expect(page.getByTestId("budget-total")).toContainText(
      new RegExp(storedTotal.replace(/\s+/g, "\\s*").replace(/\./g, "\\.")),
    );
    const uiPerPerson = (
      await page.getByTestId("budget-per-person").innerText()
    ).trim();

    const { buffer, filename, text } = await exportPdfAndRead(page);
    expect(filename).toMatch(/mardalani-bali-2033-01-10\.pdf/i);
    expect(buffer.byteLength).toBeGreaterThan(1_000);
    expect(text).toMatch(/MARDALANI/i);
    expect(text).toMatch(/Your Journey, Your Story/i);
    expect(text).toMatch(/Bali/i);
    expect(text).toMatch(/estimasi demo|Estimasi/i);
    expect(normalizeMoneyText(text)).toContain(normalizeMoneyText(storedTotal));
    expect(normalizeMoneyText(text)).toContain(normalizeMoneyText(uiPerPerson));
  });

  test("25. Phase-4 export after activity edit + manual expense", async ({
    page,
  }) => {
    await generatePlan(page, {
      destination: "yogyakarta",
      travelers: "3",
      budgetAmount: "40000000",
      startDate: "2033-02-01",
      endDate: "2033-02-03",
    });

    await page.getByRole("button", { name: /Add custom activity/i }).click();
    await page.locator("#act-name").fill("PDF Export QA Walk");
    await page.locator("#act-time").fill("16:00");
    await page.locator("#act-duration").fill("1.5");
    await page.locator("#act-cost").fill("175000");
    await page.locator("#act-cat").selectOption("activities");
    await page.locator("#act-desc").fill("Edited later for PDF QA");
    await page.locator("#act-notes").fill("Catatan panjang untuk PDF export QA");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Add activity$/i })
      .click();
    await expect(
      page.getByRole("heading", { name: "PDF Export QA Walk" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Edit PDF Export QA Walk/i }).click();
    await page.locator("#act-cost").fill("225000");
    await page.locator("#act-name").fill("PDF Export QA Walk Edited");
    await page.getByRole("button", { name: /Save changes/i }).click();
    await expect(
      page.getByRole("heading", { name: "PDF Export QA Walk Edited" }),
    ).toBeVisible();

    await page.getByTestId("add-manual-expense").click();
    await page.getByTestId("exp-name").fill("PDF QA Shared Fee");
    await page.getByTestId("exp-amount").fill("120000");
    await page.getByTestId("exp-cost-kind").selectOption("shared");
    await page.getByTestId("exp-cat").selectOption("other");
    await page.getByTestId("exp-note").fill("Manual expense for PDF");
    await page.getByTestId("exp-submit").click();
    await expect(page.getByText("PDF QA Shared Fee")).toBeVisible();

    const storedTotal = await readStoredBudgetTotalFormatted(page);
    await expect(page.getByTestId("budget-total")).toContainText(
      new RegExp(storedTotal.replace(/\s+/g, "\\s*").replace(/\./g, "\\.")),
    );
    const { text } = await exportPdfAndRead(page);
    // jsPDF may wrap long activity names across lines in extracted text
    expect(text).toMatch(/PDF Export QA Walk[\s\S]*?Edited/i);
    expect(text).toMatch(/PDF QA Shared Fee/i);
    expect(text).toMatch(/Yogyakarta/i);
    expect(normalizeMoneyText(text)).toContain(normalizeMoneyText(storedTotal));
    // Shared manual expense base appears in the manual-expense table
    expect(normalizeMoneyText(text)).toMatch(/120\.?000/);
  });

  test("26. Phase-4 multi-day long itinerary PDF + empty-state export hidden", async ({
    page,
  }) => {
    await generatePlan(page, {
      destination: "lombok",
      travelers: "2",
      budgetAmount: "60000000",
      startDate: "2033-03-01",
      endDate: "2033-03-07",
    });

    await expect(page.getByRole("tab", { name: /Day 7/i })).toBeVisible();
    const { buffer, text } = await exportPdfAndRead(page);
    expect(buffer.byteLength).toBeGreaterThan(2_000);
    expect(text).toMatch(/Hari 1/i);
    expect(text).toMatch(/Hari 7|Day 7|Lombok/i);
    expect(text).toMatch(/Laporan anggaran|RINGKASAN ANGGARAN/i);
    expect(text).not.toMatch(/[A-Za-z]:\\/);
    expect(text).not.toMatch(/sessionStorage|node_modules/i);

    await page.evaluate((key) => sessionStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /No itinerary in this session/i }),
    ).toBeVisible();
    await expect(page.getByTestId("export-pdf")).toHaveCount(0);
  });

  test("27. Phase-4 mobile export button usability", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await generatePlan(page, {
      destination: "bandung",
      startDate: "2033-04-01",
      endDate: "2033-04-03",
    });

    const exportBtn = page.getByTestId("export-pdf");
    await expect(exportBtn).toBeVisible();
    const box = await exportBtn.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(40);
    await assertNoHorizontalOverflow(page);

    const { buffer, text } = await exportPdfAndRead(page);
    expect(buffer.byteLength).toBeGreaterThan(500);
    expect(text).toMatch(/Bandung/i);
    expect(text).toMatch(/MARDALANI/i);
  });

  test("28. Phase-5 My Trips: multi-trip open/rename/duplicate/delete", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(
      ([active, trips, wish]) => {
        sessionStorage.removeItem(active);
        localStorage.removeItem(trips);
        localStorage.removeItem(wish);
      },
      [STORAGE_KEY, SAVED_TRIPS_KEY, WISHLIST_KEY],
    );

    await generatePlan(page, {
      destination: "bali",
      startDate: "2034-01-10",
      endDate: "2034-01-12",
      travelers: "2",
    });
    await generatePlan(page, {
      destination: "yogyakarta",
      startDate: "2034-02-01",
      endDate: "2034-02-03",
      travelers: "3",
    });

    await page.goto("/trips");
    await expect(page.getByTestId("trips-page")).toBeVisible();
    await expect(page.getByTestId("trips-list")).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible();
    await expect(page.getByText(/browser only|not synced/i).first()).toBeVisible();

    const cards = page.locator("[data-testid^=trip-card-]");
    await expect(cards).toHaveCount(2);

    // Rename Yogyakarta trip
    const yogyaCard = page
      .locator("[data-testid^=trip-card-]")
      .filter({ hasText: "Yogyakarta" })
      .first();
    const yogyaId = (await yogyaCard.getAttribute("data-testid"))!.replace(
      "trip-card-",
      "",
    );
    await page.getByTestId(`trip-rename-${yogyaId}`).click();
    await page.getByTestId("trip-rename-input").fill("QA Yogya Escape");
    await page.getByTestId("trip-rename-save").click();
    await expect(page.getByRole("heading", { name: "QA Yogya Escape" })).toBeVisible();

    // Open Bali trip and edit — must not overwrite Yogyakarta library entry
    const baliCard = page
      .locator("[data-testid^=trip-card-]")
      .filter({ hasText: "Bali" })
      .first();
    const baliId = (await baliCard.getAttribute("data-testid"))!.replace(
      "trip-card-",
      "",
    );
    await page.getByTestId(`trip-open-${baliId}`).click();
    await expect(page).toHaveURL(/\/itinerary/);
    await expect(page.getByRole("heading", { name: "Bali" })).toBeVisible();

    await page.getByRole("button", { name: /Add custom activity/i }).click();
    await page.locator("#act-name").fill("Phase5 Bali Only");
    await page.locator("#act-time").fill("17:00");
    await page.locator("#act-duration").fill("1");
    await page.locator("#act-cost").fill("111000");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Add activity$/i })
      .click();
    await expect(
      page.getByRole("heading", { name: "Phase5 Bali Only" }),
    ).toBeVisible();

    await page.goto("/trips");
    await expect(page.getByRole("heading", { name: "QA Yogya Escape" })).toBeVisible();
    await page.getByTestId(`trip-open-${yogyaId}`).click();
    await expect(
      page.getByRole("heading", { name: "Yogyakarta", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Phase5 Bali Only" })).toHaveCount(
      0,
    );

    // Duplicate independence
    await page.goto("/trips");
    await page.getByTestId(`trip-duplicate-${baliId}`).click();
    await expect(page.getByTestId("trips-feedback")).toContainText(/copy/i);
    await expect(page.locator("[data-testid^=trip-card-]")).toHaveCount(3);
    const copyCard = page
      .locator("[data-testid^=trip-card-]")
      .filter({ hasText: /\(copy\)/i })
      .first();
    const copyId = (await copyCard.getAttribute("data-testid"))!.replace(
      "trip-card-",
      "",
    );
    expect(copyId).not.toBe(baliId);

    await page.getByTestId(`trip-open-${copyId}`).click();
    await expect(page.getByRole("heading", { name: "Phase5 Bali Only" })).toBeVisible();
    await page.getByRole("button", { name: /Edit Phase5 Bali Only/i }).click();
    await page.locator("#act-name").fill("Phase5 Copy Edited");
    await page.getByRole("button", { name: /Save changes/i }).click();
    await expect(
      page.getByRole("heading", { name: "Phase5 Copy Edited" }),
    ).toBeVisible();

    await page.goto("/trips");
    await page.getByTestId(`trip-open-${baliId}`).click();
    await expect(page.getByRole("heading", { name: "Phase5 Bali Only" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Phase5 Copy Edited" }),
    ).toHaveCount(0);

    // Delete with confirmation
    await page.goto("/trips");
    await page.getByTestId(`trip-delete-${copyId}`).click();
    await page.getByTestId("trip-delete-confirm").click();
    await expect(page.getByTestId(`trip-card-${copyId}`)).toHaveCount(0);
    await expect(page.locator("[data-testid^=trip-card-]")).toHaveCount(2);

    // Reload persistence
    await page.reload();
    await expect(page.locator("[data-testid^=trip-card-]")).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "QA Yogya Escape" })).toBeVisible();
  });

  test("29. Phase-5 wishlist add/remove + reload + invalid prune", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(
      ([wish]) => localStorage.removeItem(wish),
      [WISHLIST_KEY],
    );

    await page.goto("/wishlist");
    await expect(page.getByTestId("wishlist-empty")).toBeVisible();

    await page.goto("/destinations/bali");
    await page.getByTestId("wishlist-toggle-bali").click();
    await expect(page.getByTestId("wishlist-toggle-bali")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.goto("/wishlist");
    await expect(page.getByTestId("wishlist-item-bali")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("wishlist-item-bali")).toBeVisible();

    await page.getByTestId("wishlist-remove-bali").click();
    await expect(page.getByTestId("wishlist-empty")).toBeVisible();

    // Seed invalid slug — should prune on load
    await page.evaluate(
      ([key]) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 1,
            slugs: ["bali", "does-not-exist-xyz"],
          }),
        );
      },
      [WISHLIST_KEY],
    );
    await page.reload();
    await expect(page.getByTestId("wishlist-item-bali")).toBeVisible();
    await expect(page.getByTestId("wishlist-item-does-not-exist-xyz")).toHaveCount(
      0,
    );
    const stored = await page.evaluate(
      (key) => localStorage.getItem(key),
      WISHLIST_KEY,
    );
    expect(stored).toBeTruthy();
    expect(stored!).not.toContain("does-not-exist-xyz");
  });

  test("30. Phase-5 migration + malformed library + quota feedback", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(
      ([active, trips]) => {
        sessionStorage.removeItem(active);
        localStorage.removeItem(trips);
      },
      [STORAGE_KEY, SAVED_TRIPS_KEY],
    );

    // Legacy session-only trip migrates into empty library
    await generatePlan(page, {
      destination: "lombok",
      startDate: "2034-05-01",
      endDate: "2034-05-03",
    });
    await page.evaluate((key) => localStorage.removeItem(key), SAVED_TRIPS_KEY);
    // Keep session trip, clear library → My Trips should migrate
    await page.goto("/trips");
    await expect(page.getByTestId("trips-list")).toBeVisible();
    await expect(
      page.locator("[data-testid^=trip-card-]").filter({ hasText: "Lombok" }),
    ).toBeVisible();

    // Malformed library cleared safely
    await page.evaluate(
      (key) => localStorage.setItem(key, "{not-json"),
      SAVED_TRIPS_KEY,
    );
    await page.reload();
    await expect(
      page.getByTestId("trips-empty").or(page.getByTestId("trips-list")),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible();

    // Quota / write failure surfaces on rename path (simulate by stubbing setItem)
    await generatePlan(page, {
      destination: "bandung",
      startDate: "2034-06-01",
      endDate: "2034-06-02",
    });
    await page.goto("/trips");
    await expect(page.getByTestId("trips-list")).toBeVisible();
    const firstCard = page.locator("[data-testid^=trip-card-]").first();
    const firstId = (await firstCard.getAttribute("data-testid"))!.replace(
      "trip-card-",
      "",
    );
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === "mardalani_saved_trips_v1") {
          const err = new DOMException(
            "QuotaExceededError",
            "QuotaExceededError",
          );
          throw err;
        }
        return original.call(this, key, value);
      };
      (window as unknown as { __mardalaniRestoreSetItem?: typeof original }).__mardalaniRestoreSetItem =
        original;
    });
    await page.getByTestId(`trip-rename-${firstId}`).click();
    await page.getByTestId("trip-rename-input").fill("Quota Fail Name");
    await page.getByTestId("trip-rename-save").click();
    await expect(page.getByTestId("trips-error")).toContainText(/storage is full/i);
    await page.evaluate(() => {
      const restore = (
        window as unknown as { __mardalaniRestoreSetItem?: typeof Storage.prototype.setItem }
      ).__mardalaniRestoreSetItem;
      if (restore) Storage.prototype.setItem = restore;
    });
  });

  test("31. Phase-5 PDF uses active trip only + budget still matches", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(
      ([active, trips]) => {
        sessionStorage.removeItem(active);
        localStorage.removeItem(trips);
      },
      [STORAGE_KEY, SAVED_TRIPS_KEY],
    );

    await generatePlan(page, {
      destination: "bali",
      travelers: "2",
      budgetAmount: "50000000",
      startDate: "2034-07-01",
      endDate: "2034-07-03",
    });
    await generatePlan(page, {
      destination: "jakarta",
      travelers: "2",
      budgetAmount: "40000000",
      startDate: "2034-08-01",
      endDate: "2034-08-03",
    });

    // Active session is Jakarta — PDF must reflect Jakarta, not Bali
    await expect(page.getByRole("heading", { name: "Jakarta" })).toBeVisible();
    const storedTotal = await readStoredBudgetTotalFormatted(page);
    const { text } = await exportPdfAndRead(page);
    expect(text).toMatch(/Jakarta/i);
    expect(text).not.toMatch(/Bali/i);
    expect(normalizeMoneyText(text)).toContain(normalizeMoneyText(storedTotal));
    await expect(page.getByTestId("budget-total")).toContainText(
      new RegExp(storedTotal.replace(/\s+/g, "\\s*").replace(/\./g, "\\.")),
    );

    // Open Bali from library → PDF switches with active trip
    await page.goto("/trips");
    const baliCard = page
      .locator("[data-testid^=trip-card-]")
      .filter({ hasText: "Bali" })
      .first();
    const baliId = (await baliCard.getAttribute("data-testid"))!.replace(
      "trip-card-",
      "",
    );
    await page.getByTestId(`trip-open-${baliId}`).click();
    await expect(page.getByRole("heading", { name: "Bali" })).toBeVisible();
    const baliPdf = await exportPdfAndRead(page);
    expect(baliPdf.text).toMatch(/Bali/i);
    expect(baliPdf.text).not.toMatch(/Jakarta/i);
  });

  test("32. Phase-5 generation + destination prefill + nav still work", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "My Trips" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Wishlist" }).first()).toBeVisible();

    await page.goto("/destinations/raja-ampat");
    await page.getByRole("link", { name: /Plan this route/i }).click();
    await expect(page).toHaveURL(/\/plan\?destination=raja-ampat/);
    await expect(page.locator("#destination")).toHaveValue("raja-ampat");
    await page.locator("#startDate").fill("2034-09-01");
    await page.locator("#endDate").fill("2034-09-03");
    await page.getByRole("button", { name: /Generate itinerary/i }).click();
    await expect(page).toHaveURL(/\/itinerary/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Raja Ampat", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("budget-panel")).toBeVisible();

    await page.goto("/trips");
    await expect(
      page.locator("[data-testid^=trip-card-]").filter({ hasText: "Raja Ampat" }),
    ).toBeVisible();
  });

  test("33. Phase-6 a11y landmarks, day tabs, and responsive screenshots", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /Skip to content/i }),
    ).toBeAttached();
    await expect(page.locator("main#main")).toBeVisible();

    await page.goto("/plan");
    await expect(page.locator("#destination")).toHaveAttribute(
      "aria-required",
      "true",
    );
    await expect(page.getByLabel(/Destination/i)).toBeVisible();

    await generatePlan(page, {
      destination: "bali",
      startDate: "2035-01-10",
      endDate: "2035-01-12",
    });
    await expect(page.getByTestId("export-pdf")).toBeVisible();
    await expect(page.getByTestId("budget-panel")).toBeVisible();
    await expect(page.getByRole("tablist", { name: /Itinerary days/i })).toBeVisible();
    const dayTab = page.getByRole("tab", { name: /Day 1/i });
    await expect(dayTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toBeVisible();

    // Durable path for Phase-6 visual review (also mirrored under test output).
    const shotDir = "e2e/artifacts/phase6-viewports";
    const viewports = [
      { name: "375", width: 375, height: 812 },
      { name: "390", width: 390, height: 844 },
      { name: "768", width: 768, height: 1024 },
      { name: "1280", width: 1280, height: 800 },
    ] as const;
    const paths = [
      "/",
      "/plan",
      "/itinerary",
      "/trips",
      "/wishlist",
      "/destinations",
    ] as const;

    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      for (const path of paths) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        if (path === "/itinerary") {
          await expect(
            page
              .getByRole("heading", { name: "Bali", exact: true })
              .or(page.getByRole("heading", { name: /No itinerary/i })),
          ).toBeVisible();
        }
        await assertNoHorizontalOverflow(page);
        const fileName = `${viewport.name}${path === "/" ? "-home" : path.replace(/\//g, "-")}.png`;
        await page.screenshot({
          path: `${shotDir}/${fileName}`,
          fullPage: true,
        });
        await page.screenshot({
          path: testInfo.outputPath("phase6-viewports", fileName),
          fullPage: true,
        });
      }
    }

    // Mobile menu open/close + Escape
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.getByRole("button", { name: /Open menu/i }).click();
    await expect(page.locator("#mobile-nav")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#mobile-nav")).toHaveCount(0);
  });

  test("34. Phase-8 Bali constraint notes or same-area tendency", async ({
    page,
  }) => {
    await generatePlan(page, {
      destination: "bali",
      travelStyle: "balanced",
      startDate: "2036-03-01",
      endDate: "2036-03-03",
    });
    await expect(page.getByRole("heading", { name: "Bali", exact: true })).toBeVisible();

    const constraint = page.getByTestId("constraint-notes");
    const hasConstraintNotes = (await constraint.count()) > 0;
    if (hasConstraintNotes) {
      await expect(constraint).toContainText(
        /area clustering|transfer buffer|pacing|Demo/i,
      );
    }

    // Soft assert: generation note mentions demo transfer / style soft caps
    const note = await page
      .locator("p")
      .filter({ hasText: /Demo itinerary for Bali/i })
      .first()
      .innerText();
    expect(note.toLowerCase()).toMatch(
      /transfer|soft cap|area clustering|attraction catalog/,
    );

    // Soft same-area tendency: among catalog activities, majority share a
    // dominant areaId when present (demo clustering, not hard geography).
    const areaStats = await page.evaluate((key) => {
      const raw = sessionStorage.getItem(key);
      if (!raw) return { withArea: 0, dominantShare: 0 };
      const data = JSON.parse(raw) as {
        days: {
          activities: { areaId?: string; category: string }[];
        }[];
      };
      const counts = new Map<string, number>();
      let withArea = 0;
      for (const day of data.days) {
        for (const a of day.activities) {
          if (
            a.category !== "activities" &&
            a.category !== "food" &&
            a.category !== "attractions"
          ) {
            continue;
          }
          if (!a.areaId) continue;
          withArea += 1;
          counts.set(a.areaId, (counts.get(a.areaId) ?? 0) + 1);
        }
      }
      const max = Math.max(0, ...counts.values());
      return {
        withArea,
        dominantShare: withArea > 0 ? max / withArea : 0,
      };
    }, STORAGE_KEY);

    expect(areaStats.withArea).toBeGreaterThan(0);
    // Soft: at least ~40% of area-tagged stops share the dominant cluster
    // OR constraint notes explain clustering (either signal is enough).
    expect(
      areaStats.dominantShare >= 0.4 || hasConstraintNotes,
      `expected same-area tendency or constraint notes (share=${areaStats.dominantShare})`,
    ).toBe(true);
  });

  test("35. Phase-8 relaxed vs adventure day density (soft)", async ({
    page,
  }) => {
    await generatePlan(page, {
      destination: "bali",
      travelStyle: "relaxed",
      startDate: "2036-04-01",
      endDate: "2036-04-03",
      budgetAmount: "50000000",
    });
    const relaxedCounts = await page.evaluate((key) => {
      const raw = sessionStorage.getItem(key);
      if (!raw) return [] as number[];
      const data = JSON.parse(raw) as {
        days: { activities: { category: string }[] }[];
      };
      return data.days.map(
        (d) =>
          d.activities.filter(
            (a) =>
              a.category === "activities" ||
              a.category === "food" ||
              a.category === "attractions",
          ).length,
      );
    }, STORAGE_KEY);

    await generatePlan(page, {
      destination: "bali",
      travelStyle: "adventure",
      startDate: "2036-04-10",
      endDate: "2036-04-12",
      budgetAmount: "50000000",
    });
    const adventureCounts = await page.evaluate((key) => {
      const raw = sessionStorage.getItem(key);
      if (!raw) return [] as number[];
      const data = JSON.parse(raw) as {
        days: { activities: { category: string }[] }[];
      };
      return data.days.map(
        (d) =>
          d.activities.filter(
            (a) =>
              a.category === "activities" ||
              a.category === "food" ||
              a.category === "attractions",
          ).length,
      );
    }, STORAGE_KEY);

    const relaxedMax = Math.max(0, ...relaxedCounts);
    const adventureMax = Math.max(0, ...adventureCounts);
    // Soft: adventure should not be thinner than relaxed on peak day
    expect(adventureMax).toBeGreaterThanOrEqual(relaxedMax);
    // Soft: relaxed peak stays within relaxed soft-cap ballpark
    expect(relaxedMax).toBeLessThanOrEqual(4);

    await expect(page.getByTestId("constraint-notes")).toContainText(
      /pacing|transfer|area/i,
    );
  });

  test("36. Phase-8 old snapshot without areaId still loads", async ({
    page,
  }) => {
    await page.goto("/itinerary");
    await page.evaluate((key) => {
      const legacy = {
        id: "trip_legacy_phase8",
        createdAt: "2030-01-01T00:00:00.000Z",
        updatedAt: "2030-01-01T00:00:00.000Z",
        destinationSlug: "bali",
        destinationName: "Bali",
        startDate: "2036-05-01",
        endDate: "2036-05-02",
        travelers: 2,
        travelStyle: "balanced",
        budgetTier: "moderate",
        transport: "mixed",
        interests: [],
        days: [
          {
            dayNumber: 1,
            date: "2036-05-01",
            title: "Legacy day",
            summary: "Pre-areaId snapshot",
            activities: [
              {
                id: "act_legacy_1",
                name: "Legacy walk",
                time: "10:00",
                durationHours: 2,
                costIdr: 50_000,
                category: "activities",
                description: "No areaId field",
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
          activities: 50_000,
          other: 0,
          total: 50_000,
          budgetCap: 5_000_000,
          remaining: 4_950_000,
          overBudget: false,
        },
        isDemoEstimate: true,
        generationNote: "Demo itinerary for Bali (legacy snapshot).",
      };
      sessionStorage.setItem(key, JSON.stringify(legacy));
    }, STORAGE_KEY);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Bali", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Legacy walk" })).toBeVisible();
    // Optional constraintNotes absent — panel may be hidden
    await expect(page.getByTestId("constraint-notes")).toHaveCount(0);
  });

  test("37. Phase-8 conflict warnings stay non-blocking with transfer types", async ({
    page,
  }) => {
    await generatePlan(page, {
      destination: "bandung",
      startDate: "2036-06-01",
      endDate: "2036-06-02",
    });

    await page.getByRole("button", { name: /Add custom activity/i }).click();
    await page.locator("#act-name").fill("Phase8 Overlap A");
    await page.locator("#act-time").fill("10:00");
    await page.locator("#act-duration").fill("3");
    await page.locator("#act-cost").fill("10000");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Add activity$/i })
      .click();
    await expect(
      page.getByRole("heading", { name: "Phase8 Overlap A" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Add custom activity/i }).click();
    await page.locator("#act-name").fill("Phase8 Overlap B");
    await page.locator("#act-time").fill("11:00");
    await page.locator("#act-duration").fill("2");
    await page.locator("#act-cost").fill("10000");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Add activity$/i })
      .click();
    await expect(
      page.getByRole("heading", { name: "Phase8 Overlap B" }),
    ).toBeVisible();

    await expect(page.getByTestId("schedule-warnings")).toContainText(
      /Time overlap|packed/i,
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Phase8 Overlap A" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Phase8 Overlap B" }),
    ).toBeVisible();
  });

  test("38. Local JSON backup export/import for trips and wishlist", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(
      ([active, trips, wish]) => {
        sessionStorage.removeItem(active);
        localStorage.removeItem(trips);
        localStorage.removeItem(wish);
      },
      [STORAGE_KEY, SAVED_TRIPS_KEY, WISHLIST_KEY],
    );

    await generatePlan(page, {
      destination: "bali",
      startDate: "2036-07-01",
      endDate: "2036-07-03",
      travelers: "2",
    });

    await page.goto("/trips");
    await expect(page.getByTestId("trips-backup")).toBeVisible();
    await expect(page.getByText(/Local file backup only/i).first()).toBeVisible();

    const tripDownloadPromise = page.waitForEvent("download");
    await page.getByTestId("trips-backup-export").click();
    const tripDownload = await tripDownloadPromise;
    expect(tripDownload.suggestedFilename()).toMatch(/mardalani-trips-.*\.json/);
    const tripPath = await tripDownload.path();
    expect(tripPath).toBeTruthy();
    await expect(page.getByTestId("trips-feedback")).toContainText(
      /local JSON backup|not cloud sync/i,
    );

    // Clear library + active session so Phase-5 session→library migration
    // cannot reseed before import.
    await page.evaluate(
      ([active, trips, wish]) => {
        sessionStorage.removeItem(active);
        localStorage.removeItem(trips);
        localStorage.removeItem(wish);
      },
      [STORAGE_KEY, SAVED_TRIPS_KEY, WISHLIST_KEY],
    );
    await page.reload();
    await expect(page.getByTestId("trips-empty")).toBeVisible();

    await page.getByTestId("trips-backup-file").setInputFiles(tripPath!);
    await expect(page.getByTestId("trips-feedback")).toContainText(/Restored/i);
    await expect(page.getByTestId("trips-list")).toBeVisible();
    await expect(
      page.locator("[data-testid^=trip-card-]").filter({ hasText: "Bali" }),
    ).toBeVisible();

    await page.goto("/destinations");
    await page.getByTestId("wishlist-toggle-bandung").click();
    await page.goto("/wishlist");
    await expect(page.getByTestId("wishlist-item-bandung")).toBeVisible();
    await expect(page.getByTestId("wishlist-backup")).toBeVisible();

    const wishDownloadPromise = page.waitForEvent("download");
    await page.getByTestId("wishlist-backup-export").click();
    const wishDownload = await wishDownloadPromise;
    expect(wishDownload.suggestedFilename()).toMatch(
      /mardalani-wishlist-.*\.json/,
    );
    const wishPath = await wishDownload.path();
    expect(wishPath).toBeTruthy();

    await page.evaluate((wish) => localStorage.removeItem(wish), WISHLIST_KEY);
    await page.reload();
    await expect(page.getByTestId("wishlist-empty")).toBeVisible();

    await page.getByTestId("wishlist-backup-file").setInputFiles(wishPath!);
    await expect(page.getByTestId("wishlist-feedback")).toContainText(
      /Restored/i,
    );
    await expect(page.getByTestId("wishlist-item-bandung")).toBeVisible();
  });

  test("39. Local backup rejects bad/oversized imports without wiping trips", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await page.evaluate(
      ([active, trips, wish]) => {
        sessionStorage.removeItem(active);
        localStorage.removeItem(trips);
        localStorage.removeItem(wish);
      },
      [STORAGE_KEY, SAVED_TRIPS_KEY, WISHLIST_KEY],
    );

    await generatePlan(page, {
      destination: "yogyakarta",
      startDate: "2036-08-01",
      endDate: "2036-08-03",
      travelers: "2",
    });

    await page.goto("/trips");
    await expect(page.getByTestId("trips-list")).toBeVisible();
    await expect(
      page.locator("[data-testid^=trip-card-]").filter({ hasText: "Yogyakarta" }),
    ).toBeVisible();

    const seededTitle = await page
      .locator("[data-testid^=trip-card-] h2")
      .first()
      .innerText();

    // Malformed JSON must not wipe the library
    const malformedPath = testInfo.outputPath("backup-malformed.json");
    await fs.writeFile(malformedPath, "{not-valid-json", "utf8");
    await page.getByTestId("trips-backup-file").setInputFiles(malformedPath);
    await expect(page.getByTestId("trips-error")).toContainText(
      /not a valid MARDALANI local backup/i,
    );
    await expect(
      page.locator("[data-testid^=trip-card-]").filter({ hasText: seededTitle }),
    ).toBeVisible();

    // Wrong kind: wishlist-only file on trips page
    const wishOnlyPath = testInfo.outputPath("backup-wishlist-only.json");
    await fs.writeFile(
      wishOnlyPath,
      JSON.stringify({
        kind: "mardalani-local-backup",
        version: 1,
        exportedAt: "2036-08-01T00:00:00.000Z",
        wishlistSlugs: ["bali"],
      }),
      "utf8",
    );
    await page.getByTestId("trips-backup-file").setInputFiles(wishOnlyPath);
    await expect(page.getByTestId("trips-error")).toContainText(
      /not a valid MARDALANI local backup/i,
    );
    await expect(
      page.locator("[data-testid^=trip-card-]").filter({ hasText: seededTitle }),
    ).toBeVisible();

    // Oversized file (>5 MB) rejected with clear error; library intact
    const oversizedPath = testInfo.outputPath("backup-oversized.json");
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 64, 0x61);
    await fs.writeFile(oversizedPath, oversized);
    await page.getByTestId("trips-backup-file").setInputFiles(oversizedPath);
    await expect(page.getByTestId("trips-error")).toContainText(/too large/i);
    await expect(
      page.locator("[data-testid^=trip-card-]").filter({ hasText: seededTitle }),
    ).toBeVisible();

    // Duplicate id: keep existing by default (confirm dialog)
    const tripId = (await page
      .locator("[data-testid^=trip-card-]")
      .first()
      .getAttribute("data-testid"))!.replace("trip-card-", "");
    const rawLibrary = await page.evaluate(
      (key) => localStorage.getItem(key),
      SAVED_TRIPS_KEY,
    );
    expect(rawLibrary).toBeTruthy();
    const store = JSON.parse(rawLibrary!) as {
      version: 1;
      trips: Array<Record<string, unknown>>;
    };
    const clone = structuredClone(store.trips[0]!);
    clone.title = "Should Not Replace";
    const dupPath = testInfo.outputPath("backup-duplicate-id.json");
    await fs.writeFile(
      dupPath,
      JSON.stringify({
        kind: "mardalani-local-backup",
        version: 1,
        exportedAt: "2036-08-01T00:00:00.000Z",
        trips: [clone],
      }),
      "utf8",
    );
    await page.getByTestId("trips-backup-file").setInputFiles(dupPath);
    await expect(
      page.getByRole("heading", { name: /Replace existing trips/i }),
    ).toBeVisible();
    await page.getByTestId("trips-import-skip-duplicates").click();
    await expect(page.getByTestId("trips-feedback")).toContainText(
      /Kept .+ existing trip/i,
    );
    await expect(page.getByTestId(`trip-card-${tripId}`)).toBeVisible();
    await expect(
      page.getByTestId(`trip-card-${tripId}`).getByRole("heading"),
    ).not.toContainText("Should Not Replace");
  });
});
