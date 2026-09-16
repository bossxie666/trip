# Codex Overnight Finalization State

Last updated: 2026-09-17 (Asia/Shanghai)

## Current phase

Phase A/B/C continuation: Preview read-only route, interaction, responsive and visual acceptance. Engineering gates and the AMap runtime gate have passed on the current Preview baseline; one mobile atlas crop correction is queued for the next GitHub → Cloudflare Preview build. No local Wrangler deployment is permitted.

## Completed

- Homepage V3 source baseline preserved; no pending source changes at handoff.
- `npm test` passed (79/79), `npm run lint` passed, `npm run build:self-hosted` passed, `git diff --check` passed, and `npm audit --omit=dev` reported no production vulnerabilities.
- Generated Worker configuration was verified: one `DB` binding to `trip-archive-production`, one `MEDIA` binding to `trip-archive-media`, `IMAGES` and `ASSETS` present, expected route/custom domain retained, and legacy `site-creator-d1`/`site-creator-r2` absent.
- GitHub mirror and Cloudflare Workers Builds chain produced a non-production `homepage-v3` Preview version after AMap runtime variables were restored.
- Preview `/api/amap/config` returned HTTP 200 without exposing key material.
- Preview Map page loaded AMap with real markers and AutoNavi attribution; no visible “map service not configured” state.
- Authenticated Preview Homepage showed the artistic title asset, Atlas, Next Trip, Featured wall, Guestbook, and no Homepage My Trips module.
- Authenticated Preview route matrix loaded Homepage, Trips, Map, Albums, Guestbook, Planning, Map view, Library, Budget, and Search; no horizontal overflow at 320/375/390/430px.
- Read-only AMap runtime check returned `/api/amap/config` HTTP 200 and rendered the map with real markers; no visible API-key/security-code failure.

## Bugs / findings

- Browser/AMap developer-console telemetry contains noisy extension/CSP/WebGL/`INVALID_USER_DOMAIN` messages while the visible map renders; classify during route QA and do not change Production configuration based on console noise alone.
- Preview tab attachment can be unreliable in the current desktop browser; use safe headless/read-only alternatives where available and record any remaining capture limitation.

## Visual mismatches to check

- Desktop 1440×810 and Mobile 375×667 evidence were captured from the real Preview; the mobile atlas artwork needed a top-edge crop correction to restore the reference's wood desk/blank paper above the map.
- Re-capture the next Preview after the CSS correction and compare the final screenshots; keep the sparse wall data-driven (no fake photos/messages).

## Changes made in this run

- Added this persistent state file.
- Queued one CSS-only mobile atlas crop correction (`object-position: center top`) in `app/home-journal.css`; no data, binding, migration, secret, route, or Production changes.

## Blockers

- None hard-blocking at state creation. Any ordinary browser attachment, timeout, or screenshot issue must be retried safely and logged without stopping independent checks.

## Next step

Commit and push the validated CSS/state change to `github-mirror` branch `homepage-v3`, wait for the next Cloudflare non-production build, re-capture Desktop/Mobile evidence, then proceed through the existing GitHub → Cloudflare chain only after all hard gates pass.
