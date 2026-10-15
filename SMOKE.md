# MARDALANI production smoke checklist

Repeatable post-deploy checks. Run against the **production URL** after deploy.
Mark each item pass/fail. Do not claim production smoke succeeded unless every item was executed against that URL.

**Production URL:** _(fill after deploy)_  
**Date / tester:** _

| # | Check | Pass? |
|---|---|---|
| 1 | Landing (`/`) loads: brand, hero photography, primary CTA to plan/destinations | ☐ |
| 2 | Destinations list + one detail page (e.g. Bali) render images and CTAs | ☐ |
| 3 | Plan → Generate itinerary succeeds; lands on `/itinerary` with day activities | ☐ |
| 4 | Edit an activity (or add manual expense); budget total updates | ☐ |
| 5 | Reload `/itinerary` — active trip still present (sessionStorage) | ☐ |
| 6 | Export PDF downloads; file opens; totals look consistent with on-screen budget | ☐ |
| 7 | My Trips: trip appears; open / rename works; data survives reload (localStorage) | ☐ |
| 8 | Wishlist: add destination → appears on `/wishlist` → survives reload | ☐ |
| 9 | Unknown slug (e.g. `/destinations/not-a-place`) shows branded 404 | ☐ |
| 10 | Mobile width (~375px): no horizontal page overflow on `/`, `/plan`, `/itinerary` | ☐ |
| 11 | Copy never claims cloud backup/sync; costs labeled as demo estimates | ☐ |

## Optional SEO spot-checks

- `/robots.txt` allows `/` and `/destinations`, disallows `/itinerary`, `/trips`, `/wishlist`
- `/sitemap.xml` lists home, plan, destinations (+ slugs)
- Document `<title>` / OG tags look sane in view-source (set `NEXT_PUBLIC_SITE_URL` in Vercel)

## Status

- Local gates (lint / unit / e2e / build): run via README scripts before deploy
- Production smoke: **PENDING** until this checklist is completed against a live URL
