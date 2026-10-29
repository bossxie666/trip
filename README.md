# 跳进地理书的旅行

固定亲友团使用的私密旅行协作网站，运行于 Cloudflare Workers，使用 D1 保存旅行数据、R2 保存媒体，并通过高德地图提供地点和路线能力。

## 本地开发

使用 `.node-version` 中固定的 Node.js 24.22.1 与 pnpm，CI 使用同一版本。测试的 SQLite 数组返回接口不支持旧的 Node.js 22.13。复制 `.dev.vars.example` 为 `.dev.vars`，填写本地开发所需的会话、高德与 R2 配置；不要提交 `.dev.vars`。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

提交前运行 `pnpm lint`、`pnpm typecheck`、`pnpm test` 和 `pnpm build:self-hosted`。

## Cloudflare 绑定与环境变量

- `DB`：D1 数据库绑定
- `MEDIA`：R2 媒体桶绑定
- `IMAGES`：Cloudflare Images binding
- `TRIP_SPACE_SESSION_SECRET`：至少 32 字符的会话密钥
- `TRIP_SPACE_INVITE_CODE`：旧成员首次激活期间使用的共享暗号
- `AMAP_JS_API_KEY`、`AMAP_JS_SECURITY_CODE`、`AMAP_WEB_SERVICE_KEY`：高德地图配置
- R2 S3 凭据只用于生成浏览器直传的短期授权，不得进入客户端代码

## 数据库迁移

Wrangler 部署迁移按编号保存在 `migrations/`；`drizzle/` 保留对应的模型迁移来源。先在 Preview 数据库执行并完成迁移与权限测试；正式执行前记录 D1 Time Travel 书签并导出备份。迁移必须保持向前兼容：先加表或字段，再切换读取，最后在后续版本停用旧字段。若历史上手动执行过 SQL，先比较真实表结构、索引和数据关联，再补登记迁移记录；不要直接重复执行建表或加列。

```bash
pnpm wrangler d1 migrations apply <database> --remote
```

## 预览、发布与回滚

Pull Request 必须通过 lint、typecheck、回归测试和生产构建，并在 Cloudflare Preview 检查手机与桌面关键路径。多台电脑协作时，发布前执行 `git fetch`，确认当前提交与约定远程分支一致，并核对 Cloudflare 实际生产版本。GitHub 推送与正式流量切换分开记录，不能把上传版本当作已发布。

Cloudflare Builds 的生产分支为 `v2.4-r1`，构建命令为 `npm run build:self-hosted`。自动部署命令与版本命令均使用 `npx --yes wrangler@4.131.1 versions upload --keep-vars`：推送只上传候选版本，不切换正式流量。该后台设置已于 2026-10-29 经明确授权修改并重新加载核验；不能改回直接 `deploy` 绕过验收。性能门禁失败时保留报告并继续修复，不降低阈值或直接激活候选。

使用同一 Git 提交的独立发布快照构建、测试和部署预览，完成数据库备份与迁移后，通过 `wrangler versions upload` 上传正式候选。配置补齐后核对候选的代码摘要与绑定名称，再使用 `wrangler versions deploy <version-id>@100` 激活明确版本。密钥变更也会创建版本，应检查它继承的代码版本，避免把其他电脑上传的未验收代码一起发布。发布后检查首页、旅行书架、规划、地图、费用、相册、留言和上传授权；公开登录页冒烟不能代替登录后的检查。

应用回滚使用 Cloudflare Workers Versions 恢复到上一稳定版本。数据回滚使用发布前记录的 D1 书签；媒体恢复依赖 R2 备份与数据库对象清单。应用版本和数据库恢复必须分开判断，避免旧代码写入不兼容的数据。

## 隐私与运维

网站不面向公开注册，`robots.txt` 禁止抓取。私密 HTML、RSC、会话和权限响应使用 `no-store`。日志不得记录密码、共享暗号、照片内容或完整地点搜索词。每周数据库备份保留 90 天，并按月验证一次恢复流程。
