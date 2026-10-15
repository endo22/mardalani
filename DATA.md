# MARDALANI data catalog

Static TypeScript data only — no runtime DB, auth, or external APIs. All costs and durations are **demo estimates** for planning UX, not official prices, ratings, coordinates, or operating hours.

## Schema overview

| File | Role |
|---|---|
| `src/data/destinations.ts` | Destination cards + detail metadata (`slug`, region, copy, image, `hasFullTemplate`) |
| `src/data/attractions.ts` | Per-slug attraction catalogs (stable `id`, category, duration, demo cost, interests/styles) |
| `src/data/templates.ts` | Per-slug day templates; activity **names must match** catalog attraction names |
| `src/types/index.ts` | Shared `Destination`, `TravelStyle`, `TravelInterest`, itinerary types |

### Destination

- `slug` — URL + generator key (kebab-case, unique)
- `hasFullTemplate` — set `true` only when this slug has a non-empty attraction catalog **and** destination-specific day templates (not the shared fallback seed)
- Images — Unsplash/curated URLs with `SafeImage` fallback; verify HTTP 200 when adding new ones

### Attraction

- `id` — stable, unique within the destination catalog (prefix by place, e.g. `lbj-padar`)
- Linked to **one** destination only via the `attractionCatalogs[slug]` key
- `baseCostIdr` / `durationHours` — demo estimates; label honestly in copy
- `interests` / `styles` — optional; generator weights results only when data supports it

### Day templates

- Keyed by the same destination `slug`
- Each template activity `name` should equal a registered attraction `name` so the Smart Builder can resolve `catalogId`
- Do **not** reuse another region’s template block

## How to add a new destination

1. Add a `Destination` row in `destinations.ts` (`hasFullTemplate: false` until steps 2–3 are done).
2. Add `attractionCatalogs["your-slug"]` with ≥ ~10–15 items covering transport, stay, food, and experiences. Unique `id`s; no cross-destination IDs.
3. Add `destinationTemplates["your-slug"]` with sensible multi-day outlines whose activity names match the catalog.
4. Set `hasFullTemplate: true` only when catalog + templates are honest and complete enough for full planner use.
5. Confirm the generator picks this slug’s catalog (no foreign attraction names) and extend Playwright if it is a priority route.
6. Document any externally checked copy facts below (source + date). No runtime fetch.

## Generator rules (summary)

- Catalog present + destination templates → Smart Builder path (`catalogId` on activities)
- Missing catalog or templates → fallback scaffold note; preferences may not apply
- No geographic optimization; travel times between stops are not modeled

## Sources & limitations (Phase 2)

Checked for **editorial copy accuracy only** (place names, region labels, typical trip rhythm). Costs remain invented demo estimates.

| Topic | Note | Checked |
|---|---|---|
| Labuan Bajo / Komodo pacing | Harbor gateway; Padar, Pink Beach, ranger walks are widely documented visitor patterns — not ticket verification | 2026-10-14 |
| Raja Ampat logistics | Sorong → Waisai / island boat days; Piaynemo & Arborek are commonly cited stops — schedules/prices not verified | 2026-10-14 |
| Jakarta urban circuit | Kota Tua, Museum Nasional, Monas, Glodok, Kemang are standard visitor areas — hours/fees not verified | 2026-10-14 |
| Region labels | Nusa Tenggara Timur; Papua Barat Daya; DKI Jakarta | 2026-10-14 |

**Limitations:** no live park fees, ferry times, weather windows, or booking inventory. Image URLs are Unsplash stock (verified HTTP 200 at catalog time for Labuan Bajo, Raja Ampat, Jakarta heroes).
