import type { Destination } from "@/types";

export const destinations: Destination[] = [
  {
    slug: "danau-toba",
    name: "Danau Toba",
    region: "North Sumatra",
    tagline: "Crater lake mornings and Batak highland quiet",
    description:
      "Southeast Asia’s largest volcanic lake — slow ferry crossings, lakeside villages, and cool highland air around Samosir Island.",
    highlights: [
      "Samosir Island circumnavigation",
      "Batak cultural villages",
      "Hot springs at Pangururan",
    ],
    bestSeason: "May–September",
    avgDailyBudgetIdr: 850_000,
    imageUrl:
      "https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Misty lake shoreline with green hills around Danau Toba",
    hasFullTemplate: true,
  },
  {
    slug: "yogyakarta",
    name: "Yogyakarta",
    region: "Central Java",
    tagline: "Court culture, batik lanes, and temple dawn light",
    description:
      "Java’s cultural heart — palace courtyards, dawn at Borobudur, night markets, and craft neighborhoods that reward unhurried walking.",
    highlights: ["Borobudur sunrise", "Kraton & Taman Sari", "Malioboro evenings"],
    bestSeason: "April–October",
    avgDailyBudgetIdr: 750_000,
    imageUrl:
      "https://images.unsplash.com/photo-1584810359583-96fc3448beaa?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Borobudur temple silhouetted at sunrise near Yogyakarta",
    hasFullTemplate: true,
  },
  {
    slug: "bali",
    name: "Bali",
    region: "Bali",
    tagline: "Rice terraces, temple rituals, and coastal rhythm",
    description:
      "From Ubud’s canopy walks to southern cliff temples — Bali balances ceremony, craft, and sea air in one compact island.",
    highlights: ["Tegallalang terraces", "Uluwatu sunset", "Canggu cafe coast"],
    bestSeason: "April–October",
    avgDailyBudgetIdr: 1_100_000,
    imageUrl:
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Lush green rice terraces in Bali under soft daylight",
    hasFullTemplate: true,
  },
  {
    slug: "bandung",
    name: "Bandung",
    region: "West Java",
    tagline: "Highland cool, factory outlets, and crater weekends",
    description:
      "A creative highland city — art deco streets, valley viewpoints, and easy day trips to volcanic landscapes and tea estates.",
    highlights: ["Tangkuban Perahu", "Braga Street", "Lembang highland loop"],
    bestSeason: "May–September",
    avgDailyBudgetIdr: 700_000,
    imageUrl:
      "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Mountain mist and green hills near Bandung highlands",
    hasFullTemplate: true,
  },
  {
    slug: "lombok",
    name: "Lombok",
    region: "West Nusa Tenggara",
    tagline: "Quiet beaches and Rinjani’s blue horizon",
    description:
      "Bali’s calmer neighbor — white-sand coves, Sasak villages, and island hops to the Gilis without the same density.",
    highlights: ["Kuta Lombok beaches", "Gili day hop", "Sasak village visit"],
    bestSeason: "April–October",
    avgDailyBudgetIdr: 900_000,
    imageUrl:
      "https://images.unsplash.com/photo-1570789210967-2cac24afeb00?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Turquoise water and tropical coastline in Lombok",
    hasFullTemplate: true,
  },
  {
    slug: "labuan-bajo",
    name: "Labuan Bajo",
    region: "Nusa Tenggara Timur",
    tagline: "Komodo gateway and island-hopping horizons",
    description:
      "Harbor town launching pad for Komodo National Park — pink beaches, manta channels, and dramatic limestone islets. Boat days dominate the rhythm; build in weather buffers.",
    highlights: ["Komodo dragons", "Padar viewpoint", "Pink Beach snorkel"],
    bestSeason: "April–November",
    avgDailyBudgetIdr: 1_400_000,
    imageUrl:
      "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Island cliffs and turquoise sea near Labuan Bajo",
    hasFullTemplate: true,
  },
  {
    slug: "raja-ampat",
    name: "Raja Ampat",
    region: "Papua Barat Daya",
    tagline: "Karst islets and world-class reef quiet",
    description:
      "A remote archipelago of limestone pinnacles and living reefs — best approached with patience, boat days, and soft footprints. Logistics from Sorong set the pace more than city sightseeing.",
    highlights: ["Piaynemo viewpoint", "Reef snorkeling", "Homestay island nights"],
    bestSeason: "October–April",
    avgDailyBudgetIdr: 2_200_000,
    imageUrl:
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Karst islands rising from blue water in Raja Ampat",
    hasFullTemplate: true,
  },
  {
    slug: "jakarta",
    name: "Jakarta",
    region: "DKI Jakarta",
    tagline: "City layers, museums, and night food circuits",
    description:
      "Indonesia’s capital in motion — Old Town heritage, contemporary galleries, and neighborhoods that reward a curated urban plan. Traffic shapes timing more than distance.",
    highlights: ["Kota Tua walk", "Museum day", "Kemang evening food"],
    bestSeason: "Year-round (drier Jun–Sep)",
    avgDailyBudgetIdr: 950_000,
    imageUrl:
      "https://images.unsplash.com/photo-1752040698501-95c45309d3b2?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Jakarta skyline at dusk with warm city lights",
    hasFullTemplate: true,
  },
];

export function getDestinationBySlug(slug: string): Destination | undefined {
  return destinations.find((d) => d.slug === slug);
}

export function getDestinationByName(name: string): Destination | undefined {
  const normalized = name.trim().toLowerCase();
  return destinations.find(
    (d) =>
      d.slug === normalized ||
      d.name.toLowerCase() === normalized ||
      d.slug.replace(/-/g, " ") === normalized,
  );
}

export const FULL_TEMPLATE_SLUGS = destinations
  .filter((d) => d.hasFullTemplate)
  .map((d) => d.slug);
