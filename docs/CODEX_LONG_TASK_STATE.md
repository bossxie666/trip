# Codex long-task state

## Overall goal

同步当前 Homepage / Mobile / 导航 / 安全代码到 GitHub `homepage-v3`，通过 Cloudflare Workers Builds 生成 Preview，完成运行时与视觉验收；Preview 全部通过后，再评估 Production 发布。

## Current stage

Preview hard gates passed on the authenticated `homepage-v3` alias. Desktop/Mobile visual QA, AMap runtime, route smoke checks, responsive widths, and engineering gates are complete. The next stage is the authorized fast-forward Production mirror push through GitHub → Cloudflare Workers Builds.

## Completed

- 工作树检查、secret/artifact 检查
- `npm test`：79/79 passed
- `npm run lint`：passed
- `npm run build:self-hosted`：passed
- `npm audit --omit=dev`：0 vulnerabilities
- Generated config verified: one `DB`, one `MEDIA`, `IMAGES`, `ASSETS`
- Commit `38f5e1a` pushed to GitHub `homepage-v3`
- Cloudflare Build created Version `fcd6cad6-0fbe-4413-befb-c4afdfe1bfa8`
- Cloudflare CI Version command updated to use Wrangler 4.131.1 with `--keep-vars --strict`
- Checkpoint `e477c8c` pushed to GitHub `homepage-v3`; Workers Build `8359633d-61bb-4b57-a26b-5a2aa8e3331c` succeeded.
- Preview Version `45b51538-97c5-40c6-921d-ffc1dd6dcbc4` created with correct DB/R2/Images/Assets bindings.
- CSS correction commit `d6996ee9b608c48e3dd9d8b47a349eccff327fe4` pushed to `github-mirror/homepage-v3`; the live `homepage-v3` alias serves the corrected mobile atlas crop.
- Prior successful Build/Version evidence: `1b566670-2776-455e-b8d9-2259345963b4` / `fcc711d2-96fa-4f94-b3f9-4459af2277b4`. The Cloudflare dashboard is currently behind Turnstile, so the current alias refresh UUID is not exposed to read-only tooling.

## Known issues

- AMap SDK console telemetry emits non-fatal CSP/eval, JSONP MIME, WebGL constructor, and canvas-readback warnings while the visible map renders correctly.
- Cloudflare dashboard read-only inspection is currently gated by Turnstile; this hides the current CI Build/Version UUID but does not block the live alias runtime checks.

## Current blocker

No hard blocker. Exact current Cloudflare Build/Version UUID is an ordinary dashboard-observability limitation only; the alias, commit, API, map, and screenshots have been verified. Production remains unchanged until the fast-forward mirror push.

## Next actions

1. Run final engineering gates after this state/report update.
2. Fast-forward push validated `homepage-v3` to `github-mirror/v2.4-r1`; do not push `origin`.
3. Read-only smoke-test Production after the Cloudflare Build completes; do not run migration or local Wrangler.

## Safety boundary

- No local Wrangler upload/deploy.
- No Production traffic change.
- No DB/R2 identity change.
- No migration or business-data write during Preview QA.

_Last updated: 2026-09-17 (Preview hard gates passed; Production mirror push pending)_
