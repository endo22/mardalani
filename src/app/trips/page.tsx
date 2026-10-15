import { SiteHeader } from "@/components/layout/site-header";
import { TripsWorkspace } from "@/components/trips/trips-workspace";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Trips",
  description:
    "Open, rename, duplicate, or delete locally saved MARDALANI demo trips.",
  robots: { index: false, follow: false },
};

export default function TripsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <TripsWorkspace />
      </main>
    </>
  );
}
