# DESIGN_SYSTEM.md

> Official design reference for MARDALANI. Every future page, section, and component
> must follow this file so the design stays visually consistent.

---

## 1. Project overview

- **Website / product name:** MARDALANI
- **Website type:** Hybrid marketing landing + product/app travel planner
- **Surface profile:** Landing/Marketing (§B1) + App/Product UI (§B3)
- **Platform:** Web (Next.js App Router)
- **Target users:** Travelers planning Indonesia trips who want editable day plans and visible budgets
- **Main design goal:** Premium editorial travel atlas — distinctive destination DNA, clear demo estimates, calm product UX

## 2. Brand direction

- **Visual style:** Editorial travel / heritage-modern
- **Mood & tone:** Quiet confidence, exploratory, grounded in Indonesian landscapes without costume decoration
- **Design personality:** Editorial-luxury with warm human readability
- **Design concept:** *Editorial Journey Atlas* — a full-bleed photographic atlas of Indonesia routes where typography reads like a travel magazine masthead, days unfold like annotated map chapters, and gold acts as the cartographic accent (compass line, focus, budget signal) — never generic SaaS purple or temple-clipart overload.
- **Adversarial-review verdict:** Covering the brand name, the forest/cream/gold atlas + Fraunces masthead + destination-specific day DNA still reads as MARDALANI, not a generic trip SaaS. Weakness found and fixed: avoided plain 50/50 hero split; hero is full-bleed photography with scrim and compact search.
- **Reference style used:** Web gallery fetch was limited in this run — reasoned from named exemplars: Monocle travel layouts (type hierarchy + photography), Ace Hotel editorial sites (cream/forest restraint), and Linear’s product calm (forms/states). Moves adapted: full-bleed hero with legible scrim; sparse section rhythm; product surfaces stay cream/white without dashboard chrome.
- **Voice & UX copy:** Plain, specific, verb-first CTAs (“Plan your route”, “Generate itinerary”). Empty/error copy explains next action. All money/time labeled as demo estimates. Brand name only: **MARDALANI** (never LALAN / TripKita).

## 3. Color system

| Role | Color | Hex | Usage |
|---|---|---|---|
| 60% — Dominant | Cream | `#F7F4EC` | Page backgrounds, large surfaces |
| 30% — Secondary | Forest / Deep green / White | `#173D35` / `#244C42` / `#FFFFFF` | Inverse sections, raised panels, hero scrim |
| 10% — Accent | Gold | `#C9A96E` | Primary buttons, focus rings, labels, budget signal |

Supporting tokens:
- Charcoal text `#252A27`
- Muted text `#5C665F` (AA on cream)
- Danger `#8B3A2F` · Success `#2F6B4F`
- Pure white `#FFFFFF` used as raised surface (documented; cream remains page base)

**Usage rules**
- Backgrounds: cream page; white raised forms/cards; forest inverse destination rails / budget rail
- Text: charcoal body on cream; cream on forest; muted for supporting copy
- Buttons: gold primary with forest label; outline forest; secondary cream ring on dark
- Cards: white or cream with soft forest-tinted shadow — elevation via shadow/contrast, not decorative borders
- Highlights / focus: gold `:focus-visible` ring
- Separation: background contrast + soft shadow; borders only for inputs/dividers/focus
- **Dark mode:** not shipped in MVP

**Contrast (computed):** charcoal on cream 13.28:1; forest on cream 10.88:1; cream on forest 10.88:1; gold on forest 5.35:1 (AA body).

## 4. Typography system

- **Brand personality:** Editorial-luxury
- **Font family / pairing:** Fraunces (display/headings) + Plus Jakarta Sans (body/UI)
- **Why these fonts fit:** Fraunces soft optical contrast signals travel editorial; Plus Jakarta keeps forms and UI calm and readable
- **Type scale:**
  - display: `clamp(2.5rem, 5vw + 1rem, 4.5rem)`
  - h1: `clamp(2rem, 3vw + 1rem, 3rem)`
  - h2: `clamp(1.5rem, 2vw + 0.75rem, 2.125rem)`
  - h3: `clamp(1.25rem, 1vw + 0.75rem, 1.5rem)`
  - body-lg: `1.125rem` · body: `1rem` · body-sm: `0.9375rem` · caption: `0.8125rem` · button: `0.9375rem`
- **Body text:** 16px minimum
- **Line-height / line-length:** ~1.55 body; ~60–75ch prose
- **Button text style:** semibold, tracking-wide, single line
- **Responsive rules:** fluid clamp on headings; hero copy fits `min-h-svh`

## 5. Layout system

- **Container widths:** `72rem` page · `42rem` narrow
- **Section spacing:** `clamp(4rem, 8vw, 7rem)`
- **Grid rules:** 1 → 2 → 3 columns for destination cards; planner max-width 3xl; itinerary `1fr + 20rem`
- **Page anatomy (landing):** navbar → full-bleed hero → problem/solution → how-it-works → destination rail → final CTA → footer
- **Conversion / CTA flow:** Primary goal = plan a trip. Primary CTA style = gold filled. Repeats in hero, destination cards, final CTA, header.
- **App flows:** Shared header on all routes (mobile drawer: Escape closes, body scroll locked, cream chrome while open); planner form; itinerary with day tabs (`role=tablist`, arrow keys) + budget aside; My Trips library; destination wishlist; empty/loading/error states. Persistence copy: local browser only, no cross-device sync.
- **Hero composition:** Full-bleed destination photography with editorial scrim; vertically centered content; compact search panel; **not** left-text/right-image 50/50
- **Horizontal card rails:** Snap carousel for destinations — hidden scrollbars, edge mask, prev/next controls, reduced-motion friendly scroll
- **Breakpoints:** ~375 / ~768 / ~1280+
- **Alignment:** Content centered in hero; product pages left-aligned reading column

## 6. Component system

- **Component base:** Custom tokens + light shadcn-inspired primitives (native `<dialog>` / `<select>`) themed to MARDALANI — not stock shadcn defaults
- **Buttons:** primary / secondary / outline / ghost / danger · sm/md/lg/icon · hover/focus-visible (gold ring + cream offset)/active/disabled · on forest surfaces use secondary + `ring-offset-forest`
- **Cards:** borderless soft-shadow panels for destinations & activities
- **Badges:** caption uppercase gold/forest labels (sparse)
- **Navbar:** absolute transparent on landing; sticky cream elsewhere; mobile drawer
- **Footer:** forest inverse with ulos-inspired hairline accent only
- **Forms:** label above, blur validation, required markers, helper + error via `aria-describedby`
- **Feature / CTA sections:** cream/white/forest alternating; one job each

## 7. Card & section style

- **Chosen style:** Soft shadow, generous radius, photography-led
- **Radius:** sm 0.375rem · md 0.75rem · lg 1.25rem
- **Shadow:** soft / lift forest-tinted
- **Gradients:** editorial hero scrim forest; fallback image pattern forest→deep-green + gold glow
- **Glass:** light blur on sticky header / hero search only
- **Rule:** no nested card stacks; one elevation hierarchy

## 8. Icon system

- **Icon library:** lucide-react (brief requirement override of “don’t default Lucide”)
- **Icon size:** 16–24px typical
- **Icon color:** gold accent or forest/cream depending on surface
- **Usage rules:** icon-only controls always labeled

## 9. Image & asset rules

- **Logo:** PNG mark (`/logo-mardalani.png`) via `Logo` component; on dark/hero chrome use `tone="light"` (cream pill behind dark artwork)
- **Stock images:** Unsplash via `next/image` (`images.unsplash.com`)
- **Crop style:** documentary landscape / portrait destination photography
- **Radius:** large on cards/rails; hero edge-to-edge
- **Visual treatment:** hover zoom via transform; SafeImage fallback pattern if load fails
- **Cultural accents:** subtle ulos-inspired hairline geometry only — never costume decoration

## 10. Animation & interaction system

- **Animation library:** `motion` (Motion for React) — GSAP removed
- **Hover states:** brightness / opacity / image scale
- **Section reveal:** `Reveal` whileInView opacity+y
- **Horizontal-scroll:** transform-friendly snap rail + button scrollBy
- **Button interaction:** active scale 0.98; loading label + spinner
- **Cursor:** pointer on interactive elements
- **States:** default / hover / focus-visible / active / disabled
- **Async feedback:** generating spinner; itinerary skeletons; inline errors
- **Data view states:** empty itinerary CTA; loading pulse; form alerts
- **Reduced-motion:** instant visibility; springs disabled; smooth scroll → auto
- **Performance targets:** LCP/CLS/INP via prioritized hero image, route split, transform/opacity-only motion, `display: swap` fonts
- **Experience tier:** Standard (DOM + Motion)

## 11. Accessibility rules

- Aim for readable core pairs (see §3); do not claim WCAG conformance without a dedicated audit
- `:focus-visible` gold rings; skip link present
- Semantic landmarks; dialog uses native `<dialog>`
- Forms associate errors; required announced
- `prefers-reduced-motion` respected
- Never color-alone for budget over/under — text labels + tips

## 12. Anti-AI-slop rules

- **Approved palette:** `#173D35` `#244C42` `#F7F4EC` `#C9A96E` `#252A27` `#FFFFFF` `#5C665F` `#7A857D` `#8B3A2F` `#2F6B4F`
- **Pure `#000`/`#fff`:** white used as raised surface only; no pure black
- **Concept-test verdict:** Distinctive atlas concept lands via full-bleed hero + Fraunces + destination DNA
- **Project-specific exceptions:** Lucide allowed by product brief; white surfaces allowed as documented raised cards

## 13. Future page instructions

Reuse colors, type, spacing, components, icons, motion, and image rules above. Do not introduce a new visual style without updating this file. Keep brand name **MARDALANI** only.

## 14. Update policy

If tokens, components, or motion change, update this file in the same change set so it never drifts from the live UI.
