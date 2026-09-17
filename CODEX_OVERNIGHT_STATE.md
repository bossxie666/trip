# Codex Overnight Finalization State

Last updated: 2026-09-17 (Asia/Shanghai)

## Current phase

Phase C route and visual gate: Homepage V3 and the shared scrapbook surfaces are running on the non-production `homepage-v3` branch. Production remains untouched during this pass.

## Completed

- Homepage V3 source baseline preserved; the focused Trip-cover authorization fix in `services/media-service.server.ts` and its matching rendered-route regression test are validated and released.
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
- The reference-locked visual pass was published to `homepage-v3` at commit `07579480d6cf6cccd309233adcfcf2632ac71b83`. Cloudflare Build `04e8d3cd-63e6-4084-a918-c51e97082352` produced Preview Version `d71b186b-e1f5-4e99-9c37-d135cd8a180b` at `https://d71b186b-trip-archive.bossxie666.workers.dev` and refreshed the `homepage-v3` alias.
- The latest visual source commit is `8828b1c2fea3f9d7b0bd641d0d0eb70d7a530f42` (`fix mobile title and stats spacing`). GitHub Workers Builds completed Build `85179b35-6acd-4ed8-806c-554458c29c9a` and Preview Version `f72dedd7-9274-4115-8cbc-12923658e51f`; the alias remains `https://homepage-v3-trip-archive.bossxie666.workers.dev`.
- Read-only authenticated Preview route checks passed for `/`, `/trips`, `/map`, `/albums`, `/messages`, `/search`, `/trips/new`, and the real planning route `/trips/gogogo-2026/plan`; all returned the expected page rather than the unlock screen. GET health checks for `/api/trips`, `/api/albums`, `/api/guestbook`, and `/api/amap/config` returned 200 (method-specific 405 responses for POST-only endpoints are expected).
- After the Preview hard gates passed, the same commit was fast-forwarded to `v2.4-r1`. Cloudflare Production Build `7c5c9d29-2f37-4d07-bd24-a794cc8377bc` completed successfully with Version `0f467a93-862a-4a57-b7e9-59672efd1037`; authenticated Production Homepage and `/api/amap/config` returned normally, with the desktop/mobile title and Atlas assets served from the new release.
- Production Build `52567dad-3d6a-4fd0-bf27-b0ca022ef007` / Version `397c0a57-0218-4bd1-a496-b44cadae1be2` completed successfully after the authorized fast-forward to `v2.4-r1`; read-only Production route, AMap, responsive, and unauthenticated API-protection checks pass.

## Bugs / findings

- Browser/AMap developer-console telemetry contains noisy extension/CSP/WebGL/`INVALID_USER_DOMAIN` messages while the visible map renders; classify during route QA and do not change Production configuration based on console noise alone.
- Preview tab attachment can be unreliable in the current desktop browser; use safe headless/read-only alternatives where available and record any remaining capture limitation.
- Cloudflare dashboard observability may be gated by Turnstile; the exact latest Build/Version UUIDs are recorded from the GitHub Workers Builds check run even when the dashboard UI is unavailable.

## Visual mismatches to check

- Desktop 1440×810 and Mobile 375×667 evidence were captured from the real Preview; the mobile atlas artwork was corrected to restore the reference's top-edge crop and the title/stats overlap was removed.
- The fresh `4ac3a341-6535-48d0-9ba8-3c3bd803d8ae` Preview passed read-only route, AMap, responsive, and visual checks; keep the sparse wall data-driven (no fake photos/messages).
- The latest Preview screenshot now keeps the title/stats on blank paper above the Atlas, shows the supplied stamp/compass layers, separates nearby Shanghai/Hangzhou labels, keeps the desktop 30/43/27 hero geometry, and remains overflow-free at 320/375/390/430px. AMap config returned HTTP 200 with key material redacted.

## Changes made in this run

- Added this persistent state file.
- Applied the CSS-only mobile atlas crop correction (`object-position: center top`) in `app/home-journal.css` in the prior release cycle.
- Fixed Trip-cover authorization for members of the referencing Trip and added a read-only regression test; no data, binding, migration, secret, route, or Production changes.
- Started a new reference-locked visual pass using the user-provided assets in `/Users/bossxie/Desktop/网站资产`; no replacement business imagery was generated.
- Re-layered the mobile Atlas so its watercolor map begins below the title/stats paper area, reduced the mobile chrome scale, and added the supplied stamp/compass assets as non-interactive decoration.
- Kept Homepage Atlas city-only and removed a tempting cross-Trip route overlay rather than implying a route that is not present in the data model.
- Added a CSS-only whole-site reference lock using the existing assets in `public/assets/homepage-v3`: Trips now use two-column paper-note cards with polaroid covers, Albums use paper-note cards and polaroid photo frames, Guestbook composer uses a paper note, and Map keeps its paper-note trip entries. Mobile subpages collapse to one column without changing data or controls.
- Real Preview screenshots exposed a mobile first-paint/layout issue: the title asset could paint one frame late and the old 375px title size pushed stats into the Atlas edge. The final mobile override now caps the title artwork, moves the Atlas start line down, and keeps the stats on the blank paper area; the override remains overflow-free in the simulated 375px check.
- Corrected the remaining mobile title/stat spacing in the final override (`margin-top: 8px`), then reran the self-hosted build and 80/80 test suite before publishing the Preview update.

## Blockers

- No hard blocker. Cloudflare dashboard UI may still be behind Turnstile, but Build/Version IDs were recovered from the GitHub Workers Builds check runs. AMap console CSP/WebGL/JSONP warnings remain non-fatal because the API gate and visible map pass. Destructive UI actions (delete/write) were not replayed against real Production records; their API and ownership paths remain covered by the 80/80 automated suite.

## Next step

Release hard gates are complete for the current code baseline. Keep the evidence under `/Users/bossxie/Desktop/codex/旅行/visual-evidence`, preserve `origin` and the D1/R2 identities, and only open a new task for later visual refinements or additional user-acceptance coverage.
