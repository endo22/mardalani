import { SiteFooter } from "@/components/layout/site-footer";
import { getSiteUrl, hasConfiguredSiteUrl } from "@/lib/site";
import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = getSiteUrl();
const siteDescription =
  "Plan editable Indonesia travel itineraries with live demo budgets. Destination-specific day templates — not generic copy-paste trips.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MARDALANI — Editorial Journey Atlas",
    template: "%s · MARDALANI",
  },
  description: siteDescription,
  applicationName: "MARDALANI",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "MARDALANI",
    title: "MARDALANI — Editorial Journey Atlas",
    description: siteDescription,
    images: [
      {
        url: "/logo-mardalani.png",
        width: 1536,
        height: 1024,
        alt: "MARDALANI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MARDALANI — Editorial Journey Atlas",
    description: siteDescription,
    images: ["/logo-mardalani.png"],
  },
  // Canonical only when a real public origin is configured
  ...(hasConfiguredSiteUrl()
    ? { alternates: { canonical: "/" } }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${fraunces.variable} ${plusJakarta.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-cream text-charcoal">
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-[var(--radius-md)] focus-visible:bg-gold focus-visible:px-3 focus-visible:py-2 focus-visible:font-semibold focus-visible:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
        >
          Skip to content
        </a>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
