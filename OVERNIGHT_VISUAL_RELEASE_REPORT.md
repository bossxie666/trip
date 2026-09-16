# Trip Archive Overnight Visual Release Report

## Current decision

The GitHub → Cloudflare Workers Builds `homepage-v3` Preview served the validated Homepage V3 source, including the focused Trip-cover authorization fix. Authenticated AMap, responsive, Preview, and Production runtime gates pass. Production traffic was intentionally released through the same GitHub → Workers Builds chain. No migration, resource identity, route, or secret value was changed.

## Preview and CI

- Preview alias: `homepage-v3`
- Preview Version: `4ac3a341-6535-48d0-9ba8-3c3bd803d8ae`
- Preview Version URL: https://4ac3a341-trip-archive.bossxie666.workers.dev
- Preview URL: https://homepage-v3-trip-archive.bossxie666.workers.dev/
- Source branch: `homepage-v3`
- Source commit: `4e39bc61dbca4cc48199a42c516f3f5994d2d7b9` (runtime fix); state-only follow-up commit `299dac2a1179624ccd71b3f370aabe4af818e679` produced the same runtime successfully.
- State-only Preview Build: `dcd8e9a5-fc96-4b4b-b9d3-f61a8db15989` / Version `16fd0a01-5a88-4307-899d-af0d78525f04` (no runtime source changes)
- Cloudflare Build: `7699cf68-8608-4efc-9ea6-4c0ce863c618` (GitHub Workers Builds check: success)
- Prior successful CI Build evidence: `1b566670-2776-455e-b8d9-2259345963b4` produced Version `fcc711d2-96fa-4f94-b3f9-4459af2277b4`.
- Production traffic: intentionally released through the authorized `v2.4-r1` mirror fast-forward; no local Wrangler upload/deploy, `versions deploy`, or trigger deployment was run.

## Engineering gates

- `npm test`: **80/80 passed** (includes Trip-cover member authorization regression)
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

## Functional bug fix

- Fixed ready `trip_cover` media authorization so every member of the referencing Trip can read the cover while unrelated members cannot; orphaned covers remain uploader-scoped.
- The fix is source-only and has no schema, migration, R2 object, or Production data impact.

## Release gate

Preview hard gates passed on Version `4ac3a341-6535-48d0-9ba8-3c3bd803d8ae`. The validated commit `4e39bc61dbca4cc48199a42c516f3f5994d2d7b9` was fast-forwarded to `github-mirror/v2.4-r1`; Production Build `52567dad-3d6a-4fd0-bf27-b0ca022ef007` and Version `397c0a57-0218-4bd1-a496-b44cadae1be2` succeeded. Read-only Production route, AMap, responsive, and unauthenticated API-protection smoke checks pass. No migration or local Wrangler command was used.

## Final status

**COMPLETED** — Homepage/Trip/Map/Album/Guestbook route smoke, AMap 200/map render, Desktop 1440×810, Mobile 375×667, responsive 320/375/390/430, local engineering gates, Preview, and Production release all passed. No Production data write or migration was performed.
