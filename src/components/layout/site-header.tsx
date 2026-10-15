"use client";

import { Logo } from "@/components/layout/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/destinations", label: "Destinations" },
  { href: "/plan", label: "Plan a trip" },
  { href: "/trips", label: "My Trips" },
  { href: "/wishlist", label: "Wishlist" },
];

interface SiteHeaderProps {
  transparent?: boolean;
}

export function SiteHeader({ transparent = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  /** Solid cream chrome while the drawer is open so links stay readable on hero. */
  const onDark = transparent && !open;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      className={cn(
        "z-50 w-full",
        transparent && !open
          ? "absolute inset-x-0 top-0"
          : "sticky top-0 border-b border-forest/10 bg-cream/90 backdrop-blur-md",
        transparent && open && "absolute inset-x-0 top-0",
      )}
    >
      <div className="container-page flex h-[4.25rem] items-center justify-between gap-4 md:h-[4.75rem]">
        <Logo size="nav" tone={onDark ? "light" : "dark"} />

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-sm text-body-sm font-medium transition-colors",
                  onDark
                    ? "text-cream/85 hover:text-cream"
                    : "text-forest/75 hover:text-forest",
                  active &&
                    (onDark
                      ? "text-gold"
                      : "text-forest underline decoration-gold/70 underline-offset-8"),
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/plan"
          className={cn(
            buttonVariants({ variant: "primary", size: "sm" }),
            "hidden md:inline-flex",
          )}
        >
          Plan your route
        </Link>

        <button
          type="button"
          className={cn(
            "inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[var(--radius-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 md:hidden",
            onDark
              ? "text-cream focus-visible:ring-offset-transparent"
              : "text-forest focus-visible:ring-offset-cream",
          )}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <X className="h-5 w-5" aria-hidden />
          ) : (
            <Menu className="h-5 w-5" aria-hidden />
          )}
        </button>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-forest/10 bg-cream px-4 py-4 md:hidden"
        >
          <nav className="flex flex-col gap-2" aria-label="Mobile">
            {links.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-[var(--radius-md)] px-3 py-3 text-forest hover:bg-forest/5",
                    active && "bg-forest/5 font-semibold",
                  )}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/plan"
              className={cn(buttonVariants({ variant: "primary" }), "mt-2")}
              onClick={() => setOpen(false)}
            >
              Plan your route
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
