# Codex Overnight Finalization State

Last updated: 2026-09-17 (Asia/Shanghai)

## Current phase

Phase A/B/C complete: Preview and Production release regression. The cross-member Trip-cover authorization fix passed local gates, Cloudflare Preview Build/Version gates, and read-only Production smoke checks. Production is now running the validated commit through the GitHub → Cloudflare Workers Builds chain; no local Wrangler deployment was used.

## Completed

- Homepage V3 source baseline preserved; the latest pending source change is the focused Trip-cover authorization fix in `services/media-service.server.ts` with a matching rendered-route regression test.
- `npm test` passed (80/80), `npm run lint` passed, `npm run build:self-hosted` passed, `git diff --check` passed, and `npm audit --omit=dev` reported no production vulnerabilities.
- Generated Worker configuration was verified: one `DB` binding to `trip-archive-production`, one `MEDIA` binding to `trip-archive-media`, `IMAGES` and `ASSETS` present, expected route/custom domain retained, and legacy `site-creator-d1`/`site-creator-r2` absent.
- GitHub mirror and Cloudflare Workers Builds chain produced a non-production `homepage-v3` Preview version after AMap runtime variables were restored. The latest source commit `4e39bc61dbca4cc48199a42c516f3f5994d2d7b9` completed Build `7699cf68-8608-4efc-9ea6-4c0ce863c618` and Version `4ac3a341-6535-48d0-9ba8-3c3bd803d8ae` successfully.
- Preview `/api/amap/config` returned HTTP 200 without exposing key material.
- Preview Map page loaded AMap with real markers and AutoNavi attribution; no visible “map service not configured” state.
- Authenticated Preview Homepage showed the artistic title asset, Atlas, Next Trip, Featured wall, Guestbook, and no Homepage My Trips module.
- Authenticated Preview route matrix loaded Homepage, Trips, Map, Albums, Guestbook, Planning, Map view, Library, Budget, and Search; no horizontal overflow at 320/375/390/430px.
- Read-only AMap runtime check returned `/api/amap/config` HTTP 200 and rendered the map with real markers; no visible API-key/security-code failure.
- Trip-cover authorization now permits a ready cover to be read by members of the Trip that references it, while keeping orphaned covers private; the regression test passes.
- Preview Build `7699cf68-8608-4efc-9ea6-4c0ce863c618` / Version `4ac3a341-6535-48d0-9ba8-3c3bd803d8ae` completed successfully for commit `4e39bc6`.
- Production Build `52567dad-3d6a-4fd0-bf27-b0ca022ef007` / Version `397c0a57-0218-4bd1-a496-b44cadae1be2` completed successfully after the authorized fast-forward to `v2.4-r1`; read-only Production route, AMap, responsive, and unauthenticated API-protection checks pass.

## Bugs / findings

- Browser/AMap developer-console telemetry contains noisy extension/CSP/WebGL/`INVALID_USER_DOMAIN` messages while the visible map renders; classify during route QA and do not change Production configuration based on console noise alone.
- Preview tab attachment can be unreliable in the current desktop browser; use safe headless/read-only alternatives where available and record any remaining capture limitation.
- Cloudflare dashboard observability may be gated by Turnstile; the exact latest Build/Version UUIDs are recorded from the GitHub Workers Builds check run even when the dashboard UI is unavailable.

## Visual mismatches to check

- Desktop 1440×810 and Mobile 375×667 evidence were captured from the real Preview; the mobile atlas artwork was corrected to restore the reference's top-edge crop.
- The fresh `4ac3a341-6535-48d0-9ba8-3c3bd803d8ae` Preview passed read-only route, AMap, responsive, and visual checks; keep the sparse wall data-driven (no fake photos/messages).

## Changes made in this run

- Added this persistent state file.
- Applied the CSS-only mobile atlas crop correction (`object-position: center top`) in `app/home-journal.css` in the prior release cycle.
- Fixed Trip-cover authorization for members of the referencing Trip and added a read-only regression test; no data, binding, migration, secret, route, or Production changes.

## Blockers

- No hard blocker. Cloudflare dashboard UI may still be behind Turnstile, but both Build/Version IDs were recovered from the GitHub Workers Builds check run. AMap console CSP/WebGL/JSONP warnings remain non-fatal because the API gate and visible map pass.

## Next step

Persist the final release report, keep `origin` untouched, and resume only for new user-scope work; the validated Production release is complete. No migration or local Wrangler.
