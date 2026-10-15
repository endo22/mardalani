"use client";

import { FadeIn } from "@/components/motion/reveal";
import { SafeImage } from "@/components/ui/safe-image";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { destinations } from "@/data/destinations";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=2000&q=80";

export function LandingHero() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [destination, setDestination] = useState("bali");
  const [travelers, setTravelers] = useState("2");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("destination", destination);
    if (travelers) params.set("travelers", travelers);
    router.push(`/plan?${params.toString()}`);
  }

  return (
    <section className="relative isolate min-h-svh overflow-hidden">
      {/* Plain positioned shell — motion parents can confuse next/image `fill` */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="relative h-full w-full"
          initial={reduce ? false : { scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <SafeImage
            src={HERO_IMAGE}
            alt="Balinese rice terraces at soft daylight — editorial travel photography"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
      </div>
      <div className="editorial-scrim absolute inset-0" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-[72rem] flex-col justify-center px-4 pb-16 pt-24 md:px-6">
        <FadeIn>
          <p className="text-caption font-semibold uppercase tracking-[0.22em] text-gold">
            Indonesia route atlas
          </p>
        </FadeIn>
        <FadeIn delay={0.08}>
          <h1 className="mt-4 max-w-3xl font-display text-display text-cream">
            Map the journey.
            <span className="block text-gold">Keep the days yours.</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.16}>
          <p className="mt-5 max-w-xl text-body-lg text-cream/85">
            MARDALANI builds editable demo itineraries for Indonesia — budget
            visible, days adjustable, estimates clearly marked.
          </p>
        </FadeIn>

        <FadeIn delay={0.24} className="mt-8 max-w-2xl">
          <form
            onSubmit={onSearch}
            className="grid gap-3 rounded-[var(--radius-lg)] bg-cream/95 p-3 shadow-[var(--shadow-lift)] backdrop-blur-sm sm:grid-cols-[1.3fr_0.7fr_auto]"
            aria-label="Quick trip search"
          >
            <label className="sr-only" htmlFor="hero-destination">
              Destination
            </label>
            <Select
              id="hero-destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              {destinations.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </Select>
            <label className="sr-only" htmlFor="hero-travelers">
              Travelers
            </label>
            <Input
              id="hero-travelers"
              type="number"
              min={1}
              max={12}
              value={travelers}
              onChange={(e) => setTravelers(e.target.value)}
              aria-label="Number of travelers"
            />
            <button
              type="submit"
              className={cn(buttonVariants({ variant: "primary" }), "w-full sm:w-auto")}
            >
              Start planning
            </button>
          </form>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/plan"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Open full planner
            </Link>
            <Link
              href="/destinations"
              className="inline-flex h-9 items-center px-3 text-body-sm font-medium text-cream/90 underline decoration-gold/50 underline-offset-4 hover:text-cream"
            >
              Browse destinations
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
