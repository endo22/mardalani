import { WishlistButton } from "@/components/destinations/wishlist-button";
import { SiteHeader } from "@/components/layout/site-header";
import { SafeImage } from "@/components/ui/safe-image";
import { buttonVariants } from "@/components/ui/button";
import { getAttractionCatalog } from "@/data/attractions";
import { destinations, getDestinationBySlug } from "@/data/destinations";
import { destinationTemplates } from "@/data/templates";
import { formatIdr } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return destinations.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const destination = getDestinationBySlug(slug);
  if (!destination) return { title: "Destination" };
  const title = `${destination.name} travel guide`;
  const description = `${destination.tagline}. ${destination.description}`;
  return {
    title: destination.name,
    description,
    openGraph: {
      title: `${destination.name} · MARDALANI`,
      description,
      images: [
        {
          url: destination.imageUrl,
          alt: destination.imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [destination.imageUrl],
    },
  };
}

const categoryLabel: Record<string, string> = {
  transportation: "Transport",
  accommodation: "Stay",
  food: "Food",
  attractions: "Attractions",
  activities: "Experience",
  other: "Other",
};

export default async function DestinationDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const destination = getDestinationBySlug(slug);
  if (!destination) notFound();

  const attractions = getAttractionCatalog(slug);
  const templates = destinationTemplates[slug] ?? [];
  const experienceCategories = [
    ...new Set(
      attractions
        .filter((a) => a.category === "activities" || a.category === "food")
        .flatMap((a) => a.interests),
    ),
  ];

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <section className="relative isolate min-h-[min(70svh,36rem)] overflow-hidden">
          <SafeImage
            src={destination.imageUrl}
            alt={destination.imageAlt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="editorial-scrim absolute inset-0" aria-hidden />
          <div className="relative z-10 flex min-h-[min(70svh,36rem)] items-end">
            <div className="container-page pb-12 pt-28">
              <p className="text-caption font-semibold uppercase tracking-[0.18em] text-gold">
                {destination.region}
              </p>
              {!destination.hasFullTemplate ? (
                <p className="mt-3 inline-block rounded-[var(--radius-md)] bg-gold px-3 py-1 text-caption font-semibold uppercase tracking-[0.14em] text-forest">
                  Preview scaffold
                </p>
              ) : null}
              <h1 className="mt-2 font-display text-display text-cream">
                {destination.name}
              </h1>
              <p className="mt-3 max-w-2xl text-body-lg text-cream/85">
                {destination.tagline}
              </p>
            </div>
          </div>
        </section>

        <div className="container-page grid gap-10 py-12 lg:grid-cols-[1.4fr_0.8fr]">
          <div>
            <h2 className="text-h2">About this route</h2>
            <p className="mt-4 max-w-prose text-muted">{destination.description}</p>
            <h3 className="mt-10 text-h3">Highlights</h3>
            <ul className="mt-4 space-y-2">
              {destination.highlights.map((h) => (
                <li key={h} className="flex gap-3 text-charcoal">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
                  {h}
                </li>
              ))}
            </ul>

            {experienceCategories.length > 0 ? (
              <>
                <h3 className="mt-10 text-h3">Experience themes</h3>
                <p className="mt-2 text-body-sm text-muted">
                  Supported by this destination’s attraction catalog — used when
                  you weight interests in the planner.
                </p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {experienceCategories.map((interest) => (
                    <li
                      key={interest}
                      className="rounded-[var(--radius-md)] bg-forest/8 px-3 py-1 text-caption font-medium capitalize text-forest"
                    >
                      {interest}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {attractions.length > 0 ? (
              <>
                <h3 className="mt-10 text-h3">Attraction catalog</h3>
                <p className="mt-2 text-body-sm text-muted">
                  Durations and costs are demo estimates for planning only — not
                  official prices, ratings, or operating hours. Routes are not
                  geographically optimized.
                </p>
                <ul className="mt-6 space-y-4" data-testid="attraction-catalog">
                  {attractions.map((a) => (
                    <li
                      key={a.id}
                      className="border-b border-forest/10 pb-4 last:border-0"
                      data-attraction-id={a.id}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-forest">{a.name}</p>
                        <p className="text-caption text-muted">
                          {categoryLabel[a.category] ?? a.category} ·{" "}
                          {a.durationHours}h · demo ~
                          {formatIdr(a.baseCostIdr)}
                        </p>
                      </div>
                      <p className="mt-1 text-body-sm text-muted">{a.description}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {templates.length > 0 ? (
              <>
                <h3 className="mt-10 text-h3">Day template outline</h3>
                <p className="mt-2 text-body-sm text-muted">
                  {templates.length}-day building blocks that reference this
                  destination’s registered attractions only.
                </p>
                <ol className="mt-4 list-decimal space-y-3 pl-5">
                  {templates.map((day) => (
                    <li key={day.title} className="text-body-sm text-charcoal">
                      <span className="font-medium">{day.title}</span>
                      <span className="text-muted"> — {day.summary}</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : null}

            {!destination.hasFullTemplate ? (
              <div
                className="mt-8 rounded-[var(--radius-md)] border border-gold/40 bg-gold/15 px-4 py-4 text-body-sm text-forest"
                role="status"
              >
                <p className="font-semibold">Not a verified full itinerary</p>
                <p className="mt-2 text-muted">
                  {destination.name} is a preview scaffold destination. Generated
                  days, timings, and costs are illustrative fallbacks so you can
                  explore the planner — not a complete, verified
                  destination-specific template.
                </p>
              </div>
            ) : null}
          </div>

          <aside className="h-fit rounded-[var(--radius-lg)] bg-white p-6 shadow-[var(--shadow-soft)]">
            <p className="text-caption font-semibold uppercase tracking-[0.16em] text-deep-green">
              Quick facts
            </p>
            <dl className="mt-4 space-y-4 text-body-sm">
              <div>
                <dt className="text-muted">Best season</dt>
                <dd className="mt-1 font-medium text-forest">
                  {destination.bestSeason}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Demo avg daily spend</dt>
                <dd className="mt-1 font-medium text-forest">
                  ~{formatIdr(destination.avgDailyBudgetIdr)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Template coverage</dt>
                <dd className="mt-1 font-medium text-forest">
                  {destination.hasFullTemplate
                    ? "Full destination template"
                    : "Preview scaffold"}
                </dd>
              </div>
              {attractions.length > 0 ? (
                <div>
                  <dt className="text-muted">Catalog size</dt>
                  <dd className="mt-1 font-medium text-forest">
                    {attractions.length} attractions · {templates.length} day
                    templates
                  </dd>
                </div>
              ) : null}
            </dl>
            <Link
              href={`/plan?destination=${destination.slug}`}
              className={cn(
                buttonVariants({ variant: "primary" }),
                "mt-6 w-full",
              )}
            >
              Plan this route
            </Link>
            <WishlistButton slug={destination.slug} className="mt-3 w-full [&>button]:w-full" />
            <Link
              href="/destinations"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-3 w-full",
              )}
            >
              All destinations
            </Link>
          </aside>
        </div>
      </main>
    </>
  );
}
