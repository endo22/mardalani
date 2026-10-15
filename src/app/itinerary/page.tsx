import { ItineraryWorkspace } from "@/components/itinerary/itinerary-workspace";
import { SiteHeader } from "@/components/layout/site-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My itinerary",
  description:
    "Review and edit your MARDALANI demo itinerary with live budget totals.",
  robots: { index: false, follow: false },
};

export default function ItineraryPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <ItineraryWorkspace />
      </main>
    </>
  );
}
