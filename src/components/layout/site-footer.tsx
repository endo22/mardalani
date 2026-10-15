import { Logo } from "@/components/layout/logo";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-forest/10 bg-forest text-cream">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo size="footer" />
          <p className="mt-4 max-w-sm text-body-sm text-cream/75">
            Editorial itineraries for Indonesia — plan a route, tune the days,
            and keep every cost marked as a demo estimate.
          </p>
        </div>
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.16em] text-gold">
            Explore
          </p>
          <ul className="mt-4 space-y-2 text-body-sm">
            <li>
              <Link
                href="/destinations"
                className="rounded-sm hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                Destinations
              </Link>
            </li>
            <li>
              <Link
                href="/plan"
                className="rounded-sm hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                Plan a trip
              </Link>
            </li>
            <li>
              <Link
                href="/trips"
                className="rounded-sm hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                My Trips
              </Link>
            </li>
            <li>
              <Link
                href="/wishlist"
                className="rounded-sm hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                Wishlist
              </Link>
            </li>
            <li>
              <Link
                href="/itinerary"
                className="rounded-sm hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                Active itinerary
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.16em] text-gold">
            Note
          </p>
          <p className="mt-4 text-body-sm text-cream/75">
            Trips and wishlist stay in this browser only — not synced across
            devices. Clearing site data can remove them.
          </p>
        </div>
      </div>
      <div className="ulos-accent h-px w-full opacity-60" aria-hidden />
      <div className="container-page flex flex-col gap-2 py-5 text-caption text-cream/55 sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} MARDALANI. Demo travel planner.</p>
        <p>Built for editorial journey planning — not live bookings.</p>
      </div>
    </footer>
  );
}
