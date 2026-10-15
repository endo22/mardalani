"use client";

import { SiteHeader } from "@/components/layout/site-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Digest only — never log request bodies, tokens, or storage payloads
    console.error("MARDALANI route error", error.digest ?? error.name);
  }, [error]);

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <section className="container-page flex min-h-[60svh] flex-col items-start justify-center py-16">
          <p className="text-caption font-semibold uppercase tracking-[0.18em] text-gold">
            Something went wrong
          </p>
          <h1 className="mt-3 font-display text-h1 text-forest">
            We hit an unexpected detour
          </h1>
          <p className="mt-4 max-w-lg text-body text-muted">
            Your locally saved trips should still be in this browser. Try again,
            or return home to continue planning.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="button" variant="primary" onClick={() => reset()}>
              Try again
            </Button>
            <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
              Back to home
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
