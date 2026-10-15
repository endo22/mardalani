import { DestinationCard } from "@/components/destinations/destination-card";
import { SiteHeader } from "@/components/layout/site-header";
import { destinations } from "@/data/destinations";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Destinations",
  description:
    "Browse MARDALANI destinations across Indonesia — from Danau Toba to Raja Ampat.",
};

export default function DestinationsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="container-page py-10 md:py-14">
          <p className="text-caption font-semibold uppercase tracking-[0.18em] text-deep-green">
            Atlas
          </p>
          <h1 className="mt-2 text-h1">Destinations</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Destination-specific day templates and attraction catalogs across
            the atlas. Every cost remains a demo estimate — not a live quote.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((d) => (
              <DestinationCard key={d.slug} destination={d} />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
