# MARDALANI

Editorial Journey Atlas — a demo Indonesia travel itinerary planner (MVP).

Plan a trip, generate destination-aware demo itineraries, edit activities, export a PDF, and keep trips/wishlist in the browser. Active editing uses `sessionStorage`; the saved-trips library and wishlist use `localStorage`. Nothing is synced to a server.

## Stack

- Next.js `16.4` (App Router) + React `19` + TypeScript + Tailwind CSS `4`
- Motion for React (`motion`)
- react-hook-form + Zod
- jspdf (+ autotable) for client-side PDF export
- lucide-react
- Playwright + `tsx --test` for QA

No backend, database, auth, or paid AI APIs in this MVP. Generation uses a mock `ItineraryGenerationService` ready to swap for a future AI provider.

**Node:** `>=20.9.0` (see `package.json` `engines`).

## Setup

```bash
npm ci
```

Copy optional env placeholders:

```bash
cp .env.example .env.local
```

For production SEO absolute URLs, set:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

Optional AI provider keys in `.env.example` are unused by the mock generator — never commit real secrets.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local development server |
| `npm run lint` | Run ESLint |
| `npm run test:unit` | Budget unit tests |
| `npm run test:e2e` | Playwright suite (starts `npm run start`) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |

**Pre-deploy gates (local):**

```bash
npm run lint
npm run test:unit
npm run build
npm run test:e2e
```

## Routes

- `/` — Landing
- `/plan` — Trip planner form (supports `destination`, `startDate`, `endDate`, `travelers` query prefill)
- `/itinerary` — Results + editable CRUD + live budget + PDF export (noindex)
- `/trips` — Saved trips library (localStorage, noindex)
- `/wishlist` — Saved destination slugs (localStorage, noindex)
- `/destinations` — Destination list
- `/destinations/[slug]` — Destination detail

## Deploy (Vercel) — manual steps

This README does **not** claim a live production deploy has been completed.

1. Push the repository to GitHub (do not commit `.env.local` or real API keys).
2. In [Vercel](https://vercel.com): **Add New Project** → import the repo.
3. Framework preset: **Next.js** (default). Build: `npm run build`. Install: `npm ci` (or Vercel default).
4. Environment variables (Production):
   - `NEXT_PUBLIC_SITE_URL` = your canonical origin (e.g. `https://mardalani.vercel.app` or custom domain)
   - Optional AI keys only when a real provider is wired (see `.env.example`)
5. Deploy. Confirm the deployment URL loads `/`.
6. Run the production smoke checklist in [`SMOKE.md`](./SMOKE.md) against that URL.

CLI alternative (requires Vercel login):

```bash
npx vercel
npx vercel --prod
```

`next.config.ts` already allows `images.unsplash.com` via `remotePatterns`. No `vercel.json` is required for the default Next.js preset.

## Design system

See [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) for colors, typography, motion, and component rules.

## Destination data

Catalog schema, how to add a destination, and source/limitation notes live in [`DATA.md`](./DATA.md). UI stays separate from `src/data/*`.

## MVP limitations

- Browser-only persistence (session + local) — no accounts / cross-device sync / cloud backup
- Demo cost & schedule estimates only — not official prices or live quotes
- No geographic optimization between stops
- PDF export is client-side demo output, not a booking document
- Third-party Unsplash images and Google Fonts (via `next/font`) require network access at build/runtime

## Accessibility note

Automated axe CI is not part of the default Playwright suite (skipped for Phase 7 to avoid tooling churn). Manual keyboard/landmarks coverage exists in e2e; do not claim full WCAG compliance without a dedicated audit.
