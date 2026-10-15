/**
 * Public site origin for absolute SEO URLs (canonical, sitemap, OG).
 * Prefer NEXT_PUBLIC_SITE_URL in production (e.g. https://mardalani.vercel.app).
 * Falls back to Vercel’s host when present; otherwise localhost for local build.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin;
      }
    } catch {
      /* ignore invalid */
    }
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }

  return "http://localhost:3000";
}

/** True when an explicit production origin was configured (not a localhost fallback). */
export function hasConfiguredSiteUrl(): boolean {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return false;
  try {
    const url = new URL(configured);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
