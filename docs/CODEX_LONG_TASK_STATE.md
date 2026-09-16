# Codex long-task state

## Overall goal

同步当前 Homepage / Mobile / 导航 / 安全代码到 GitHub `homepage-v3`，通过 Cloudflare Workers Builds 生成 Preview，完成运行时与视觉验收；Preview 全部通过后，再评估 Production 发布。

## Current stage

CI Preview build succeeded after fixing the Cloudflare Version command; authenticated homepage visual QA passed on the current Preview, but the AMap runtime gate is still failing.

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
- Docs-only checkpoint `9e9a98d` pushed to GitHub; Preview Version `5c85ef26-e0f5-4265-ad38-bae8614e6796` predates the later restoration of the ordinary `AMAP_JS_API_KEY` runtime variable and still lacks that binding.

## Known issues

- The first CI Preview omitted `AMAP_JS_API_KEY`; the Preview map page returned HTTP 503 configuration status.
- CI Preview Version `45b51538-97c5-40c6-921d-ffc1dd6dcbc4` still lacks the ordinary `AMAP_JS_API_KEY` binding; read-only version metadata confirms the other AMap service binding names.
- The authenticated Preview homepage loaded, but `GET /api/amap/config` returned HTTP 503 because the current Preview Version has no ordinary `AMAP_JS_API_KEY` binding. Cloudflare Settings now shows the ordinary variable restored; a new CI Preview is required.

## Current blocker

The current Preview is missing AMap runtime configuration; Production release is paused. Cloudflare Settings now shows the ordinary key restored, but the Preview must be regenerated. The mobile screenshot/width checks remain pending.

## Next actions

1. Push a docs-only checkpoint to `homepage-v3` to trigger CI again now that the existing ordinary `AMAP_JS_API_KEY` runtime variable is restored.
2. After the new CI Preview is built, re-test the map/AMap runtime, responsive widths, and screenshots.
3. Do not touch `v2.4-r1` until Preview hard gates pass.

## Safety boundary

- No local Wrangler upload/deploy.
- No Production traffic change.
- No DB/R2 identity change.
- No migration or business-data write during Preview QA.

_Last updated: 2026-09-16 (homepage QA observed; AMap runtime gate and mobile matrix pending)_
