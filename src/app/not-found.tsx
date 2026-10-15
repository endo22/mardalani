import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <section className="container-page flex min-h-[60svh] flex-col items-start justify-center py-16">
          <p className="text-caption font-semibold uppercase tracking-[0.18em] text-gold">
            404
          </p>
          <h1 className="mt-3 font-display text-h1 text-forest">
            This route is not on the map
          </h1>
          <p className="mt-4 max-w-lg text-body text-muted">
            That page does not exist in MARDALANI. Choose a destination or start
            a new demo itinerary.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/destinations"
              className={cn(buttonVariants({ variant: "primary" }))}
            >
              Browse destinations
            </Link>
            <Link
              href="/plan"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Plan a trip
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
