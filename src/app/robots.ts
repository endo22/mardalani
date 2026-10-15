import { getSiteUrl, hasConfiguredSiteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Client-local tool surfaces — thin/empty without browser storage
      disallow: ["/itinerary", "/trips", "/wishlist"],
    },
    // Only advertise sitemap when a real public origin is configured
    ...(hasConfiguredSiteUrl() || process.env.VERCEL_URL
      ? { sitemap: `${base}/sitemap.xml` }
      : {}),
  };
}
