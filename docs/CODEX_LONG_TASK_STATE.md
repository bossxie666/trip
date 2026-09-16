# Codex long-task state

## Overall goal

同步当前 Homepage / Mobile / 导航 / 安全代码到 GitHub `homepage-v3`，通过 Cloudflare Workers Builds 生成 Preview，完成运行时与视觉验收；Preview 全部通过后，再评估 Production 发布。

## Current stage

CI Preview rebuild after fixing variable propagation.

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

## Known issues

- The first CI Preview omitted `AMAP_JS_API_KEY`; the Preview map page returned HTTP 503 configuration status.
- A new CI run is required after the Version command update.

## Current blocker

None yet; waiting for the rebuilt non-production Version and runtime checks.

## Next actions

1. Push this checkpoint to `github-mirror/homepage-v3`.
2. Wait for the Cloudflare Workers Build check.
3. Inspect the resulting Version bindings without exposing secret values.
4. Re-test Preview homepage, map/AMap runtime, navigation, responsive widths, and screenshots.
5. Do not touch `v2.4-r1` until Preview hard gates pass.

## Safety boundary

- No local Wrangler upload/deploy.
- No Production traffic change.
- No DB/R2 identity change.
- No migration or business-data write during Preview QA.

_Last updated: 2026-09-16_
