import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

/** Canonical public URL (alias of `public/Logo Mardalani.png`). */
const LOGO_SRC = "/logo-mardalani.png";
const LOGO_WIDTH = 1536;
const LOGO_HEIGHT = 1024;

interface LogoProps {
  className?: string;
  /**
   * `light` = mark sits on a dark/hero surface (cream pill behind dark PNG).
   * `dark` = mark on cream/white chrome (no pill).
   */
  tone?: "light" | "dark";
  href?: string;
  size?: "nav" | "footer";
}

export function Logo({
  className,
  tone = "dark",
  href = "/",
  size = "nav",
}: LogoProps) {
  const isNav = size === "nav";
  const onDarkSurface = tone === "light";

  const content = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center",
        onDarkSurface &&
          "rounded-[var(--radius-md)] bg-cream/95 px-2 py-1 shadow-[var(--shadow-soft)] ring-1 ring-cream/40",
        className,
      )}
    >
      <Image
        src={LOGO_SRC}
        alt="MARDALANI"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className={cn(
          "object-contain",
          // Tall mark (icon + wordmark + tagline); keep within header/footer bars
          isNav ? "h-10 w-auto md:h-12" : "h-14 w-auto md:h-[4.5rem]",
        )}
        sizes={isNav ? "120px" : "180px"}
        priority={isNav}
      />
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-flex" aria-label="MARDALANI home">
      {content}
    </Link>
  );
}
