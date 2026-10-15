"use client";

import { Reveal } from "@/components/motion/reveal";
import { SafeImage } from "@/components/ui/safe-image";
import { buttonVariants } from "@/components/ui/button";
import { destinations } from "@/data/destinations";
import { cn } from "@/lib/utils";
import { CalendarRange, MapPinned, Wallet } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

const featured = destinations.filter((d) => d.hasFullTemplate).slice(0, 5);

export function ProblemSolution() {
  return (
    <section className="section-y bg-cream">
      <div className="container-page grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <p className="text-caption font-semibold uppercase tracking-[0.18em] text-deep-green">
            The friction
          </p>
          <h2 className="mt-3 text-h2 text-forest">
            Generic trip lists ignore your pace, budget, and transport reality.
          </h2>
          <p className="mt-4 max-w-prose text-muted">
            Most planners dump the same attractions into every destination.
            MARDALANI starts from destination-specific day templates, then
            scales costs to your travelers, style, and budget ceiling.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)]">
            <SafeImage
              src="https://images.unsplash.com/photo-1584810359583-96fc3448beaa?auto=format&fit=crop&w=1400&q=80"
              alt="Temple silhouette at dawn representing intentional travel pacing"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-700 hover:scale-105"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    {
      icon: MapPinned,
      title: "Choose a destination",
      body: "Pick from curated Indonesia routes with distinct activity libraries.",
    },
    {
      icon: CalendarRange,
      title: "Set dates & style",
      body: "Travelers, transport, and travel style shape the day structure.",
    },
    {
      icon: Wallet,
      title: "Edit live budget",
      body: "Add, change, or remove activities — totals recalculate immediately.",
    },
  ];

  return (
    <section className="section-y bg-white">
      <div className="container-page">
        <Reveal>
          <p className="text-caption font-semibold uppercase tracking-[0.18em] text-deep-green">
            How it works
          </p>
          <h2 className="mt-3 max-w-2xl text-h2">Three steps. One editable atlas.</h2>
        </Reveal>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.08}>
              <div className="h-full rounded-[var(--radius-lg)] bg-cream p-6 shadow-[var(--shadow-soft)]">
                <step.icon className="h-6 w-6 text-gold" aria-hidden />
                <h3 className="mt-4 text-h3">{step.title}</h3>
                <p className="mt-2 text-body-sm text-muted">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DestinationRail() {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollByDir(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: dir * Math.min(el.clientWidth * 0.85, 420),
      behavior: reduce ? "auto" : "smooth",
    });
  }

  return (
    <section className="section-y bg-forest text-cream">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Reveal>
            <p className="text-caption font-semibold uppercase tracking-[0.18em] text-gold">
              Destinations
            </p>
            <h2 className="mt-3 text-h2 text-cream">Routes with distinct day DNA</h2>
          </Reveal>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scrollByDir(-1)}
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[var(--radius-md)] bg-cream/10 text-cream ring-1 ring-cream/25 hover:bg-cream/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              aria-label="Previous destinations"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => scrollByDir(1)}
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[var(--radius-md)] bg-cream/10 text-cream ring-1 ring-cream/25 hover:bg-cream/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              aria-label="Next destinations"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div
        role="region"
        aria-label="Featured destinations"
        className="mt-10 overflow-x-hidden overflow-y-hidden"
      >
        <div
          ref={trackRef}
          className="hide-scrollbar rail-mask container-page flex snap-x snap-mandatory gap-5 overflow-x-auto overflow-y-hidden pb-2"
        >
          {featured.map((d) => (
            <Link
              key={d.slug}
              href={`/destinations/${d.slug}`}
              className="group relative aspect-[3/4] w-[min(78vw,20rem)] shrink-0 snap-start overflow-hidden rounded-[var(--radius-lg)]"
            >
              <SafeImage
                src={d.imageUrl}
                alt={d.imageAlt}
                fill
                sizes="320px"
                className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-forest/90 via-forest/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-caption uppercase tracking-[0.16em] text-gold">
                  {d.region}
                </p>
                <h3 className="mt-1 font-display text-h3 text-cream">{d.name}</h3>
                <p className="mt-1 line-clamp-2 text-body-sm text-cream/80">
                  {d.tagline}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="container-page mt-8">
        <Link
          href="/destinations"
          className={cn(buttonVariants({ variant: "secondary" }))}
        >
          View all destinations
        </Link>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="section-y bg-cream">
      <Reveal>
        <div className="container-narrow text-center">
          <h2 className="text-h2">Ready to draft your Indonesia route?</h2>
          <p className="mt-4 text-muted">
            Open the planner, set your dates, and generate a demo itinerary you
            can edit before anything is booked.
          </p>
          <Link
            href="/plan"
            className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-8")}
          >
            Plan your route
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
