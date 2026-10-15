import { getDestinationBySlug } from "@/data/destinations";
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_LABELS,
  categorySharePercent,
  estimatedCostPerPerson,
  inferCostKind,
  manualExpenseTripCost,
  recalculateBudget,
} from "@/lib/budget";
import {
  daysBetween,
  formatDateLong,
  formatDateRange,
  formatIdr,
} from "@/lib/format";
import type { Activity, Itinerary } from "@/types";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/** Brand palette (RGB) — DESIGN_SYSTEM.md */
const FOREST: [number, number, number] = [23, 61, 53];
const DEEP: [number, number, number] = [36, 76, 66];
const CREAM: [number, number, number] = [247, 244, 236];
const GOLD: [number, number, number] = [201, 169, 110];
const CHARCOAL: [number, number, number] = [37, 42, 39];
const MUTED: [number, number, number] = [92, 102, 95];
const WHITE: [number, number, number] = [255, 255, 255];

const MARGIN = 16;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 12;

const COST_KIND_LABEL = {
  perPerson: "Per orang",
  shared: "Bersama (grup)",
} as const;

export interface ExportItineraryPdfResult {
  filename: string;
  byteLength: number;
}

function safeText(value: string | undefined | null, fallback = "-"): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  // Helvetica/WinAnsi-safe: strip controls + map common punctuation
  return trimmed
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/×/g, "x")
    .replace(/·/g, "|");
}

function sortBySchedule(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => {
    const byTime = (a.time || "").localeCompare(b.time || "");
    if (byTime !== 0) return byTime;
    return a.name.localeCompare(b.name);
  });
}

function formatDurationHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "-";
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} jam`;
}

function paintContinuationPage(doc: jsPDF) {
  drawPageChrome(doc);
}

function tablePageHooks(): {
  willDrawPage: (data: { pageNumber: number; doc: jsPDF }) => void;
} {
  return {
    willDrawPage: (data) => {
      // Only paint full cream on pages autoTable creates after the first
      // (avoids wiping content already drawn above the table).
      if (data.pageNumber > 1) {
        paintContinuationPage(data.doc);
      }
    },
  };
}

function tableFinalY(doc: jsPDF, fallback: number): number {
  const last = (doc as jsPDF & { lastAutoTable?: { finalY?: number } })
    .lastAutoTable;
  return typeof last?.finalY === "number" ? last.finalY : fallback;
}

function buildFilename(itinerary: Itinerary): string {
  const slug = safeText(itinerary.destinationSlug, "trip")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const datePart = itinerary.startDate?.slice(0, 10) || "draft";
  return `mardalani-${slug || "trip"}-${datePart}.pdf`;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= FOOTER_Y - 4) return y;
  doc.addPage();
  drawPageChrome(doc);
  return MARGIN + 10;
}

function drawPageChrome(doc: jsPDF) {
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  // Top gold accent line
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, PAGE_W, 2.2, "F");
}

function drawFooter(doc: jsPDF, page: number, total: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("MARDALANI | estimasi demo | bukan booking hidup", MARGIN, FOOTER_Y);
  doc.text(`${page} / ${total}`, PAGE_W - MARGIN, FOOTER_Y, { align: "right" });
}

function sectionHeading(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...FOREST);
  doc.text(title, MARGIN, y);
  y += 2;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, MARGIN + 28, y);
  return y + 7;
}

function bodyLines(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  opts?: { size?: number; color?: [number, number, number]; bold?: boolean },
): number {
  const size = opts?.size ?? 10;
  const color = opts?.color ?? CHARCOAL;
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  for (const line of lines) {
    y = ensureSpace(doc, y, size * 0.45 + 2);
    doc.text(line, x, y);
    y += size * 0.45 + 1.2;
  }
  return y;
}

/**
 * Build and download a client-side PDF from the current itinerary snapshot.
 * Budget numbers come only from recalculateBudget / format helpers — no duplicate math.
 */
export async function exportItineraryToPdf(
  itinerary: Itinerary,
): Promise<ExportItineraryPdfResult> {
  const manualExpenses = itinerary.manualExpenses ?? [];
  const budget = recalculateBudget(itinerary.days, itinerary.budget.budgetCap, {
    manualExpenses,
    travelers: itinerary.travelers,
  });
  const perPerson = estimatedCostPerPerson(budget.total, itinerary.travelers);
  const destination = getDestinationBySlug(itinerary.destinationSlug);
  const durationDays =
    itinerary.startDate && itinerary.endDate
      ? daysBetween(itinerary.startDate, itinerary.endDate)
      : itinerary.days.length;
  const dateRange =
    itinerary.startDate && itinerary.endDate
      ? formatDateRange(itinerary.startDate, itinerary.endDate)
      : "Tanggal belum diisi";

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  drawPageChrome(doc);

  // —— Cover / trip summary ——
  doc.setFillColor(...FOREST);
  doc.rect(0, 0, PAGE_W, 52, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 52, PAGE_W, 1.4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...CREAM);
  doc.text("MARDALANI", MARGIN, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text("Your Journey, Your Story.", MARGIN, 31);

  doc.setFontSize(9);
  doc.setTextColor(...CREAM);
  doc.text("Ekspor itinerary | estimasi demo", MARGIN, 42);

  let y = 66;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...FOREST);
  const tripTitle = safeText(
    itinerary.destinationName,
    destination?.name ?? "Perjalanan",
  );
  const titleLines = doc.splitTextToSize(tripTitle, CONTENT_W) as string[];
  for (const line of titleLines) {
    doc.text(line, MARGIN, y);
    y += 7;
  }

  y += 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  y = bodyLines(doc, `Destinasi: ${tripTitle}`, MARGIN, y, CONTENT_W, {
    size: 10,
    color: CHARCOAL,
  });
  y = bodyLines(doc, `Tanggal: ${dateRange}`, MARGIN, y, CONTENT_W, {
    size: 10,
    color: CHARCOAL,
  });
  y = bodyLines(
    doc,
    `Durasi: ${durationDays} hari | ${itinerary.days.length} hari terjadwal`,
    MARGIN,
    y,
    CONTENT_W,
    { size: 10, color: CHARCOAL },
  );
  y = bodyLines(
    doc,
    `Jumlah traveler: ${Math.max(1, itinerary.travelers)}`,
    MARGIN,
    y,
    CONTENT_W,
    { size: 10, color: CHARCOAL },
  );
  y = bodyLines(
    doc,
    `Gaya perjalanan: ${safeText(itinerary.travelStyle)} | Tier anggaran: ${safeText(itinerary.budgetTier)} | Transport: ${safeText(itinerary.transport)}`,
    MARGIN,
    y,
    CONTENT_W,
    { size: 9, color: MUTED },
  );

  if (destination) {
    y += 2;
    y = bodyLines(
      doc,
      `${safeText(destination.region)} | ${safeText(destination.tagline)}`,
      MARGIN,
      y,
      CONTENT_W,
      { size: 9, color: DEEP, bold: true },
    );
    y = bodyLines(doc, safeText(destination.description), MARGIN, y, CONTENT_W, {
      size: 9,
      color: MUTED,
    });
    if (destination.highlights.length > 0) {
      y = bodyLines(
        doc,
        `Sorotan: ${destination.highlights.map((h) => safeText(h)).join(" | ")}`,
        MARGIN,
        y,
        CONTENT_W,
        { size: 9, color: MUTED },
      );
    }
  }

  y += 4;
  // Budget summary card
  y = ensureSpace(doc, y, 36);
  doc.setFillColor(...DEEP);
  doc.roundedRect(MARGIN, y, CONTENT_W, 32, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text("RINGKASAN ANGGARAN (ESTIMASI DEMO)", MARGIN + 4, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...CREAM);
  doc.text(`Batas anggaran: ${formatIdr(budget.budgetCap)}`, MARGIN + 4, y + 15);
  doc.text(`Total estimasi: ${formatIdr(budget.total)}`, MARGIN + 4, y + 22);
  doc.text(
    budget.overBudget
      ? `Melebihi anggaran: ${formatIdr(Math.abs(budget.remaining))}`
      : `Sisa anggaran: ${formatIdr(budget.remaining)}`,
    MARGIN + 4,
    y + 28,
  );
  doc.text(`Per traveler: ${formatIdr(perPerson)}`, MARGIN + CONTENT_W - 4, y + 22, {
    align: "right",
  });
  y += 40;

  if (itinerary.notes?.trim()) {
    y = sectionHeading(doc, "Catatan perjalanan", y);
    y = bodyLines(doc, itinerary.notes.trim(), MARGIN, y, CONTENT_W, {
      size: 9,
      color: MUTED,
    });
    y += 2;
  }

  // —— Daily itinerary ——
  y = sectionHeading(doc, "Itinerary harian", y);

  for (const day of itinerary.days) {
    y = ensureSpace(doc, y, 18);
    const dayDate = day.date
      ? formatDateLong(day.date)
      : "Tanggal belum tersedia";
    doc.setFillColor(...FOREST);
    doc.roundedRect(MARGIN, y - 4, CONTENT_W, 10, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...CREAM);
    const dayLabel = `Hari ${day.dayNumber} | ${dayDate}`;
    doc.text(dayLabel, MARGIN + 3, y + 2.5);
    y += 10;

    if (day.title?.trim()) {
      y = bodyLines(doc, day.title.trim(), MARGIN, y, CONTENT_W, {
        size: 10,
        color: FOREST,
        bold: true,
      });
    }
    if (day.summary?.trim()) {
      y = bodyLines(doc, day.summary.trim(), MARGIN, y, CONTENT_W, {
        size: 9,
        color: MUTED,
      });
    }

    const activities = sortBySchedule(day.activities);
    if (activities.length === 0) {
      y = bodyLines(doc, "Belum ada aktivitas pada hari ini.", MARGIN, y, CONTENT_W, {
        size: 9,
        color: MUTED,
      });
      y += 3;
      continue;
    }

    const rows = activities.map((activity) => {
      const kind = inferCostKind(activity.category, activity.costKind);
      const notes = activity.notes?.trim()
        ? activity.notes.trim()
        : activity.description?.trim()
          ? activity.description.trim()
          : "-";
      const location = activity.location?.trim()
        ? `\nLokasi: ${activity.location.trim()}`
        : "";
      return [
        safeText(activity.time, "-"),
        safeText(activity.name),
        formatDurationHours(activity.durationHours),
        BUDGET_CATEGORY_LABELS[activity.category],
        formatIdr(activity.costIdr),
        COST_KIND_LABEL[kind],
        `${safeText(notes)}${location}`,
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: MARGIN + 6, bottom: 18 },
      head: [
        [
          "Mulai",
          "Aktivitas",
          "Durasi",
          "Kategori",
          "Biaya",
          "Jenis",
          "Catatan",
        ],
      ],
      body: rows,
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2.2,
        textColor: CHARCOAL,
        overflow: "linebreak",
        valign: "top",
        lineColor: [220, 214, 200],
        lineWidth: 0.2,
        fillColor: WHITE,
      },
      headStyles: {
        fillColor: DEEP,
        textColor: CREAM,
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: CREAM },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 36 },
        2: { cellWidth: 16 },
        3: { cellWidth: 28 },
        4: { cellWidth: 24 },
        5: { cellWidth: 20 },
        6: { cellWidth: "auto" },
      },
      ...tablePageHooks(),
    });

    y = tableFinalY(doc, y) + 8;
  }

  // —— Budget report ——
  y = ensureSpace(doc, y, 20);
  y = sectionHeading(doc, "Laporan anggaran", y);

  y = bodyLines(
    doc,
    `Total estimasi perjalanan: ${formatIdr(budget.total)}`,
    MARGIN,
    y,
    CONTENT_W,
    { size: 11, color: FOREST, bold: true },
  );
  y = bodyLines(
    doc,
    `Estimasi per traveler: ${formatIdr(perPerson)} (${Math.max(1, itinerary.travelers)} traveler)`,
    MARGIN,
    y,
    CONTENT_W,
    { size: 10, color: CHARCOAL },
  );
  y = bodyLines(
    doc,
    `Batas anggaran: ${formatIdr(budget.budgetCap)}`,
    MARGIN,
    y,
    CONTENT_W,
    { size: 10, color: CHARCOAL },
  );
  y = bodyLines(
    doc,
    budget.overBudget
      ? `Status: Melebihi anggaran ${formatIdr(Math.abs(budget.remaining))}`
      : `Status: Sisa anggaran ${formatIdr(budget.remaining)}`,
    MARGIN,
    y,
    CONTENT_W,
    { size: 10, color: budget.overBudget ? [139, 58, 47] : FOREST, bold: true },
  );
  y += 2;

  const categoryRows = BUDGET_CATEGORIES.map((cat) => {
    const amount = budget[cat];
    const share = categorySharePercent(amount, budget.total);
    return [
      BUDGET_CATEGORY_LABELS[cat],
      formatIdr(amount),
      `${share}%`,
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN + 6, bottom: 18 },
    head: [["Kategori", "Jumlah (IDR)", "Porsi"]],
    body: categoryRows,
    foot: [["Total", formatIdr(budget.total), "100%"]],
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.5,
      textColor: CHARCOAL,
      overflow: "linebreak",
      lineColor: [220, 214, 200],
      lineWidth: 0.2,
    },
    headStyles: { fillColor: FOREST, textColor: CREAM, fontStyle: "bold" },
    footStyles: { fillColor: GOLD, textColor: FOREST, fontStyle: "bold" },
    alternateRowStyles: { fillColor: CREAM },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 50, halign: "right" },
      2: { cellWidth: 30, halign: "right" },
    },
    ...tablePageHooks(),
  });

  y = tableFinalY(doc, y) + 10;

  y = sectionHeading(doc, "Biaya bersama vs per orang", y);
  y = bodyLines(
    doc,
    "Aktivitas: biaya tersimpan sudah diskalakan saat dibuat. Pengeluaran manual: jumlah dasar x jenis biaya saat dihitung ulang.",
    MARGIN,
    y,
    CONTENT_W,
    { size: 8, color: MUTED },
  );
  y += 1;

  let sharedTrip = 0;
  let perPersonTrip = 0;
  for (const day of itinerary.days) {
    for (const activity of day.activities) {
      const kind = inferCostKind(activity.category, activity.costKind);
      const cost = Number.isFinite(activity.costIdr) ? Math.max(0, activity.costIdr) : 0;
      if (kind === "perPerson") perPersonTrip += cost;
      else sharedTrip += cost;
    }
  }
  for (const expense of manualExpenses) {
    const trip = manualExpenseTripCost(expense, itinerary.travelers);
    if (expense.costKind === "perPerson") perPersonTrip += trip;
    else sharedTrip += trip;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN + 6, bottom: 18 },
    head: [["Jenis biaya", "Kontribusi ke total trip"]],
    body: [
      ["Bersama (grup)", formatIdr(sharedTrip)],
      ["Per orang (sudah di total trip)", formatIdr(perPersonTrip)],
      ["Total (harus sama dengan total estimasi)", formatIdr(budget.total)],
    ],
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.5,
      textColor: CHARCOAL,
      overflow: "linebreak",
    },
    headStyles: { fillColor: DEEP, textColor: CREAM, fontStyle: "bold" },
    alternateRowStyles: { fillColor: CREAM },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 60, halign: "right" },
    },
    ...tablePageHooks(),
  });

  y = tableFinalY(doc, y) + 10;

  if (manualExpenses.length > 0) {
    y = sectionHeading(doc, "Pengeluaran manual", y);
    const expenseRows = manualExpenses.map((expense) => {
      const trip = manualExpenseTripCost(expense, itinerary.travelers);
      return [
        safeText(expense.name),
        BUDGET_CATEGORY_LABELS[expense.category],
        COST_KIND_LABEL[expense.costKind],
        formatIdr(expense.amountIdr),
        formatIdr(trip),
        safeText(expense.note, "-"),
      ];
    });
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: MARGIN + 6, bottom: 18 },
      head: [
        [
          "Nama",
          "Kategori",
          "Jenis",
          "Dasar",
          "Kontribusi trip",
          "Catatan",
        ],
      ],
      body: expenseRows,
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2.2,
        textColor: CHARCOAL,
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: { fillColor: FOREST, textColor: CREAM, fontStyle: "bold" },
      alternateRowStyles: { fillColor: CREAM },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 30 },
        2: { cellWidth: 24 },
        3: { cellWidth: 24, halign: "right" },
        4: { cellWidth: 28, halign: "right" },
        5: { cellWidth: "auto" },
      },
      ...tablePageHooks(),
    });
    y = tableFinalY(doc, y) + 10;
  } else {
    y = bodyLines(
      doc,
      "Tidak ada pengeluaran manual pada sesi ini.",
      MARGIN,
      y,
      CONTENT_W,
      { size: 9, color: MUTED },
    );
    y += 4;
  }

  // —— Notes / disclaimer ——
  y = sectionHeading(doc, "Catatan penting", y);
  const disclaimers = [
    "Semua angka biaya adalah estimasi demo MARDALANI, bukan harga booking, tiket, atau tarif langsung.",
    "Dokumen ini tidak menjamin ketersediaan, jam operasional, atau waktu tempuh antar lokasi.",
    "Tidak ada data pemesanan langsung, API berbayar, atau harga real-time yang disertakan.",
    "Itinerary disimpan di sesi browser saja; ekspor PDF mencerminkan status saat tombol Export ditekan.",
    itinerary.generationNote?.trim()
      ? `Catatan generator: ${itinerary.generationNote.trim()}`
      : "",
  ].filter(Boolean);

  for (const line of disclaimers) {
    y = bodyLines(doc, `• ${line}`, MARGIN, y, CONTENT_W, {
      size: 8,
      color: MUTED,
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  // Avoid blank trailing page (defensive — jsPDF shouldn't add empty ones here)
  const filename = buildFilename(itinerary);
  const buffer = doc.output("arraybuffer");
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength === 0) {
    throw new Error("PDF kosong — gagal membuat dokumen.");
  }

  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }

  return { filename, byteLength: bytes.byteLength };
}
