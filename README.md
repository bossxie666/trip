# 跳进地理书的旅行

固定亲友团使用的私密旅行协作网站，运行于 Cloudflare Workers，使用 D1 保存旅行数据、R2 保存媒体，并通过高德地图提供地点和路线能力。

## 本地开发

需要 Node.js 22.13+ 与 pnpm。复制 `.dev.vars.example` 为 `.dev.vars`，填写本地开发所需的会话、高德与 R2 配置；不要提交 `.dev.vars`。

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

迁移文件按编号保存在 `drizzle/`。先在 Preview 数据库执行并完成迁移与权限测试；正式执行前记录 D1 Time Travel 书签并导出备份。迁移必须保持向前兼容：先加表或字段，再切换读取，最后在后续版本停用旧字段。

```bash
pnpm wrangler d1 migrations apply <database> --remote
```

## 预览、发布与回滚

Pull Request 必须通过 lint、typecheck、回归测试和生产构建，并在 Cloudflare Preview 检查手机与桌面关键路径。正式分支由 Cloudflare 自动发布。发布后检查首页、旅行书架、规划、地图、费用、相册、留言和上传授权。

应用回滚使用 Cloudflare Workers Versions 恢复到上一稳定版本。数据回滚使用发布前记录的 D1 书签；媒体恢复依赖 R2 备份与数据库对象清单。应用版本和数据库恢复必须分开判断，避免旧代码写入不兼容的数据。

## 隐私与运维

网站不面向公开注册，`robots.txt` 禁止抓取。私密 HTML、RSC、会话和权限响应使用 `no-store`。日志不得记录密码、共享暗号、照片内容或完整地点搜索词。每周数据库备份保留 90 天，并按月验证一次恢复流程。
