import { SiteHeader } from "@/components/layout/site-header";
import { TripForm } from "@/components/planner/trip-form";
import { planQuerySchema } from "@/lib/schemas";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plan a trip",
  description:
    "Set destination, dates, travelers, style, and budget to generate a MARDALANI demo itinerary.",
};

interface PlanPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const raw = await searchParams;
  const travelersRaw =
    typeof raw.travelers === "string" ? Number(raw.travelers) : undefined;
  const parsed = planQuerySchema.safeParse({
    destination:
      typeof raw.destination === "string" ? raw.destination : undefined,
    startDate: typeof raw.startDate === "string" ? raw.startDate : undefined,
    endDate: typeof raw.endDate === "string" ? raw.endDate : undefined,
    travelers:
      travelersRaw !== undefined && Number.isFinite(travelersRaw)
        ? travelersRaw
        : undefined,
  });

  const defaults = parsed.success
    ? {
        destination: parsed.data.destination,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        travelers: parsed.data.travelers,
      }
    : undefined;

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="container-page py-10 md:py-14">
          <div className="mx-auto max-w-3xl">
            <p className="text-caption font-semibold uppercase tracking-[0.18em] text-deep-green">
              Trip planner
            </p>
            <h1 className="mt-2 text-h1">Shape the route before you go</h1>
            <p className="mt-3 max-w-2xl text-muted">
              Tell us where and how you travel. We’ll generate a destination-aware
              demo itinerary with editable days and a live IDR budget.
            </p>
            <div className="mt-8">
              <TripForm defaults={defaults} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
