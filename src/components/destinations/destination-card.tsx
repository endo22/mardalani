"use client";

import { WishlistButton } from "@/components/destinations/wishlist-button";
import { SafeImage } from "@/components/ui/safe-image";
import { buttonVariants } from "@/components/ui/button";
import { formatIdr } from "@/lib/format";
import type { Destination } from "@/types";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function DestinationCard({
  destination,
  showWishlist = true,
}: {
  destination: Destination;
  /** Hide toggle when the parent page already exposes remove controls. */
  showWishlist?: boolean;
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-soft)]">
      <Link
        href={`/destinations/${destination.slug}`}
        className="relative aspect-[16/11] overflow-hidden"
      >
        <SafeImage
          src={destination.imageUrl}
          alt={destination.imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-caption font-semibold uppercase tracking-[0.16em] text-gold">
          {destination.region}
        </p>
        <h2 className="mt-1 text-h3">
          <Link href={`/destinations/${destination.slug}`}>{destination.name}</Link>
        </h2>
        <p className="mt-2 flex-1 text-body-sm text-muted">{destination.tagline}</p>
        <p className="mt-3 text-caption text-muted">
          From ~{formatIdr(destination.avgDailyBudgetIdr)}/day demo avg
        </p>
        {!destination.hasFullTemplate ? (
          <p className="mt-2 inline-flex rounded-[var(--radius-md)] bg-gold/20 px-2.5 py-1 text-caption font-semibold text-deep-green">
            Preview scaffold — not a full verified template
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/plan?destination=${destination.slug}`}
            className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
          >
            Plan this route
          </Link>
          <Link
            href={`/destinations/${destination.slug}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Details
          </Link>
          {showWishlist ? <WishlistButton slug={destination.slug} /> : null}
        </div>
      </div>
    </article>
  );
}
