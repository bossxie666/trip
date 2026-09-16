# Trip Archive Overnight Visual Release Report

## Current decision

**Production release is paused.** The GitHub → Cloudflare Workers Builds Preview was created successfully, but the authenticated AMap runtime gate is not passing. No Production traffic, route, resource identity, migration, or secret value was changed.

## Preview and CI

- Preview Version: `5c85ef26-e0f5-4265-ad38-bae8614e6796`
- Preview alias: `homepage-v3`
- Preview URL: https://homepage-v3-trip-archive.bossxie666.workers.dev/
- Source branch: `homepage-v3`
- Source commit: `9e9a98d` (docs-only checkpoint after the validated source commit)
- Cloudflare Build for the validated source commit: succeeded (`8359633d-61bb-4b57-a26b-5a2aa8e3331c`); the later docs-only checkpoint generated the Preview Version above.
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

## AMap hard-gate status

- The previous authenticated `GET /api/amap/config` on the Preview returned HTTP 503 with `{"error":"地图服务尚未配置。"}`. Cloudflare Settings now shows the ordinary runtime variable `AMAP_JS_API_KEY` restored, but Preview Version `5c85ef26-e0f5-4265-ad38-bae8614e6796` predates that restoration and still has no such binding in read-only metadata.
- The map page consequently rendered the fallback “地图服务尚未配置。” instead of initializing AMap.
- Code reads the ordinary runtime variable `AMAP_JS_API_KEY`; the existing Preview must be regenerated through the GitHub → Workers Builds path before this gate can be rechecked. Existing AMap service secret names remain present, and no secret value was printed or changed.
- `AMAP_JS_SECURITY_CODE` remains a separate secret binding and is not a substitute for the browser-map key.

## Release gate

**Not released.** A new Preview must be built through the existing Cloudflare configuration/CI path and rechecked now that `AMAP_JS_API_KEY` is restored. Until the AMap endpoint returns configuration and the responsive screenshot matrix is completed, do not sync `homepage-v3` to `v2.4-r1` or change Production traffic.
