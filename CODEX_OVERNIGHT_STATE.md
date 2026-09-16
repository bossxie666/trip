# Codex Overnight Finalization State

Last updated: 2026-09-17 (Asia/Shanghai)

## Current phase

Phase A/B/C continuation: full-site read-only QA and release regression. The Preview visual/AMap gates have passed; a real cross-member Trip-cover authorization bug was found during Production smoke testing and is now fixed locally with a focused regression test. The fix must pass the gates and then flow through GitHub → Cloudflare Preview before the authorized Production mirror push. No local Wrangler deployment is permitted.

## Completed

- Homepage V3 source baseline preserved; the latest pending source change is the focused Trip-cover authorization fix in `services/media-service.server.ts` with a matching rendered-route regression test.
- `npm test` passed (80/80), `npm run lint` passed, `npm run build:self-hosted` passed, `git diff --check` passed, and `npm audit --omit=dev` reported no production vulnerabilities.
- Generated Worker configuration was verified: one `DB` binding to `trip-archive-production`, one `MEDIA` binding to `trip-archive-media`, `IMAGES` and `ASSETS` present, expected route/custom domain retained, and legacy `site-creator-d1`/`site-creator-r2` absent.
- GitHub mirror and Cloudflare Workers Builds chain produced a non-production `homepage-v3` Preview version after AMap runtime variables were restored.
- Preview `/api/amap/config` returned HTTP 200 without exposing key material.
- Preview Map page loaded AMap with real markers and AutoNavi attribution; no visible “map service not configured” state.
- Authenticated Preview Homepage showed the artistic title asset, Atlas, Next Trip, Featured wall, Guestbook, and no Homepage My Trips module.
- Authenticated Preview route matrix loaded Homepage, Trips, Map, Albums, Guestbook, Planning, Map view, Library, Budget, and Search; no horizontal overflow at 320/375/390/430px.
- Read-only AMap runtime check returned `/api/amap/config` HTTP 200 and rendered the map with real markers; no visible API-key/security-code failure.
- Trip-cover authorization now permits a ready cover to be read by members of the Trip that references it, while keeping orphaned covers private; the regression test passes.

## Bugs / findings

- Browser/AMap developer-console telemetry contains noisy extension/CSP/WebGL/`INVALID_USER_DOMAIN` messages while the visible map renders; classify during route QA and do not change Production configuration based on console noise alone.
- Preview tab attachment can be unreliable in the current desktop browser; use safe headless/read-only alternatives where available and record any remaining capture limitation.
- Cloudflare dashboard observability may be gated by Turnstile, which can hide the exact Build/Version UUID even when the live alias is healthy.

## Visual mismatches to check

- Desktop 1440×810 and Mobile 375×667 evidence were captured from the real Preview; the mobile atlas artwork was corrected to restore the reference's top-edge crop.
- Re-capture the next Preview after the Trip-cover fix and compare the final screenshots; keep the sparse wall data-driven (no fake photos/messages).

## Changes made in this run

- Added this persistent state file.
- Applied the CSS-only mobile atlas crop correction (`object-position: center top`) in `app/home-journal.css` in the prior release cycle.
- Fixed Trip-cover authorization for members of the referencing Trip and added a read-only regression test; no data, binding, migration, secret, route, or Production changes.

## Blockers

- None hard-blocking at state creation. Any ordinary browser attachment, timeout, or screenshot issue must be retried safely and logged without stopping independent checks.

## Next step

Run the final gates on the Trip-cover fix, commit and push `homepage-v3` to `github-mirror`, wait for the next Cloudflare non-production build, re-capture Desktop/Mobile evidence and AMap/API gates, then fast-forward `v2.4-r1` through the same GitHub → Cloudflare chain only after all hard gates pass.
