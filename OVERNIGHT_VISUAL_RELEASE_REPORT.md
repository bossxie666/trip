# Trip Archive Overnight Visual Release Report

## Current decision

The GitHub → Cloudflare Workers Builds `homepage-v3` Preview is serving the validated Homepage V3 source. The authenticated AMap and responsive runtime gates now pass. Production traffic remains unchanged until the final release push is intentionally performed through the same GitHub → Workers Builds chain. No migration, resource identity, route, or secret value was changed.

## Preview and CI

- Preview alias: `homepage-v3`
- Preview Version: current alias build for commit `d6996ee9b608c48e3dd9d8b47a349eccff327fe4` (exact UUID is not exposed while the Cloudflare dashboard is behind Turnstile)
- Preview URL: https://homepage-v3-trip-archive.bossxie666.workers.dev/
- Source branch: `homepage-v3`
- Source commit: `d6996ee9b608c48e3dd9d8b47a349eccff327fe4`
- Prior successful CI Build evidence: `1b566670-2776-455e-b8d9-2259345963b4` produced Version `fcc711d2-96fa-4f94-b3f9-4459af2277b4`; the current alias was subsequently refreshed by the pushed CSS correction.
- Production traffic: unchanged; no local Wrangler upload/deploy, `versions deploy`, `wrangler deploy`, or trigger deployment was run.

## Engineering gates

- `npm test`: **79/79 passed**
- `npm run lint`: **passed**
- `npm run build:self-hosted`: **passed**
- `git diff --check`: **passed**
- `npm audit --omit=dev`: **0 vulnerabilities**

Generated config: `dist/server/wrangler.json`

- D1: exactly one `DB` binding → `trip-archive-production` (`ef4a9fb0-6a3c-492a-a905-a285f47e92f0`)
- R2: exactly one `MEDIA` binding → `trip-archive-media`
- `IMAGES`: present
- `ASSETS`: present
- Route: `trip.bossxie.win`, custom domain unchanged
- Compatibility: `2026-05-15`, `nodejs_compat`
- `site-creator-d1` / `site-creator-r2`: absent

## Runtime visual QA

- Authenticated Preview homepage: loaded successfully; real Desktop 1440×810 and Mobile 375×667 screenshots were captured from the Preview runtime.
- Homepage structure: Header, artistic title asset, Atlas, Next Trip, Featured wall, and Guestbook rendered; no Homepage My Trips module.
- Live data is intentionally sparser than the supplied artwork (one real featured image and one real guestbook note); no fake records were added.
- Mobile Homepage contains only the Top Bar, artistic title, stats, Atlas, primary Atlas photo, and four-item bottom navigation. Next Trip, Gallery, My Trips, Guestbook, Trip.Bossxie copy, and decorative English copy are hidden at mobile widths.
- Responsive matrix at 320/375/390/430px: `document.documentElement.scrollWidth === document.documentElement.clientWidth` for each width.

## AMap hard-gate status

- Authenticated Preview `GET /api/amap/config` returned HTTP 200 with the expected `key`, `version`, and `serviceHost` fields (key material was not logged).
- The planning Map view initialized AMap, rendered a canvas with real itinerary markers and AutoNavi attribution, and showed no visible key/security-code failure.
- Existing AMap variable/secret binding names remain in place; no secret value was printed or changed.
- Console telemetry still contains non-fatal CSP/eval, JSONP MIME, WebGL constructor, and canvas-readback warnings from the AMap SDK; the visible map and API gate are healthy, so Production configuration was not changed.

## Release gate

Preview hard gates are passed. The next release action is a fast-forward push of the validated `homepage-v3` commit to `github-mirror/v2.4-r1`, allowing the existing Cloudflare Production Build to run. No local Wrangler command or migration is permitted.
