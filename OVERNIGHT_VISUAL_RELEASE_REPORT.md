# Trip Archive Overnight Visual Release Report

## Current decision

**Production release is paused.** The GitHub → Cloudflare Workers Builds Preview was created successfully, but the authenticated AMap runtime gate is not passing. No Production traffic, route, resource identity, migration, or secret value was changed.

## Preview and CI

- Preview Version: `45b51538-97c5-40c6-921d-ffc1dd6dcbc4`
- Preview alias: `homepage-v3`
- Preview URL: https://homepage-v3-trip-archive.bossxie666.workers.dev/
- Source branch: `homepage-v3`
- Source commit: `e477c8c30a7aeb3bdcbee1417a79039f33f8d4ea`
- Cloudflare Build: succeeded (`8359633d-61bb-4b57-a26b-5a2aa8e3331c`)
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

- Authenticated Preview homepage: loaded successfully; current desktop screenshot was captured from the real Preview window.
- Homepage structure: Header, artistic title asset, Atlas, Next Trip, Featured wall, and Guestbook rendered; no Homepage My Trips module.
- Live data is intentionally sparser than the supplied artwork (one real featured image and one real guestbook note); no fake records were added.
- Mobile screenshot and width matrix are **not claimed complete** in this run because the Mac became locked during the remaining browser checks.

## AMap hard-gate failure

- Authenticated `GET /api/amap/config` on the Preview returned HTTP 503 with `{"error":"地图服务尚未配置。"}`.
- The map page consequently rendered the fallback “地图服务尚未配置。” instead of initializing AMap.
- Code reads the ordinary runtime variable `AMAP_JS_API_KEY`; the current Preview Version metadata does not contain that variable. Existing AMap service secret names remain present, and no secret value was printed or changed.
- The Dashboard variable visible during recovery was `AMAP_JS_SECURITY_CODE`; that is a different binding and does not satisfy the browser-map key check.

## Release gate

**Not released.** The missing `AMAP_JS_API_KEY` binding must be restored through the existing Cloudflare configuration/CI path, then a new Preview must be built and rechecked. Until the AMap endpoint returns configuration and the responsive screenshot matrix is completed, do not sync `homepage-v3` to `v2.4-r1` or change Production traffic.
