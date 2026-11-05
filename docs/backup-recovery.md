# 数据库备份与恢复

## 真实状态与边界

2026-11-05 核验发现，最近一次 Weekly D1 backup（运行 41357042863）在 2026-11-01 因未配置 GitHub Actions 的 `CLOUDFLARE_API_TOKEN` 而失败；备份桶 `trip-archive-backups` 存在，r2.dev 公开访问关闭、无自定义域名，实际 `d1/` 前缀已启用 90 天自动清理。不能据此认定已有定期备份或已完成恢复演练。补好凭据后，必须手动运行并确认导出、恢复检查、R2 回读全部成功。

数据库 SQL 含私密旅行、成员密码摘要和会话摘要。它只能保存在受控本机忽略目录、临时 CI 环境和私有备份桶；不进 Git、不作为 GitHub artifact、不在日志中打印。数据库 SQL 不含 R2 照片文件，不能用它恢复已永久删除的原图。媒体独立备份尚需核验，不能把 D1 Time Travel 说成照片回收站。

## 配置与验收

1. 在该 Cloudflare 账号创建专门供备份使用的 API Token，授权 D1 导出与私有备份桶对象读写需要的权限；限定本账号，不使用 Global API Key 或本机 OAuth 登录令牌。具体权限以 Cloudflare 当前导出/R2 API 提示为准。
2. 将其保存到 GitHub 仓库 Settings → Secrets and variables → Actions → Secrets，名称 `CLOUDFLARE_API_TOKEN`。不要将令牌发到聊天。账号与正式 D1 ID 由明确指定的 `wrangler.jsonc` 提供，无需重复配置账号 Secret。
3. 手动执行 Weekly D1 backup，检查整条任务成功。脚本先把 SQL 导入隔离内存库，验证当前全部表/列、索引、外键声明、外键数据完整性和 SQLite 完整性，将原始交错 SQL 整理为先建全部表和索引、再插入数据的恢复文件，再上传 R2；下载后再次恢复并比对 SHA-256、大小及逐表行数。仅验证通过的 JSON 报告保留为 artifact，原 SQL 在任务退出时删除。
4. 成功标记为 `d1/trip-<UTC时间>-<run-id>.verified.json`。同名 SQL 没有 verified 报告时，不能仅凭对象存在认定备份成功。报告只有校验值、大小和表计数，不含记录内容。
5. 2026-11-05 已通过 Wrangler 实际核验 `d1/` 前缀的 90 天清理规则启用；`config/backup-lifecycle.json` 是对应模板。后续变更仍须核验真实桶配置，不能只看仓库模板。按月做一次独立恢复演练。

## 隔离恢复演练

- 使用获准访问的环境下载 SQL 和 verified JSON 到被 Git 忽略的 `work/` 或 `backups/`。验证命令：`node scripts/verify-d1-backup.mjs input.sql report.json expected.verified.json`。此命令仅在内存中还原，不连接正式数据库；输出不包含行内容。实际导出必须先得到资料持有人的明确许可。
- 本地 SQLite 恢复是第一道检查，不能替代 D1 实机恢复。`pnpm test:backup` 会在两个全新本地 D1 中完成合成数据的导出、排序、恢复、再次导出，并要求完整导出校验值一致；该测试已加入 CI。需要时在全新、无正式媒体写权限的独立 D1 中，通过 `wrangler d1 execute <独立恢复库> --remote --file <SQL>` 验证兼容性，核对表计数、成员权限、行程和相册引用。不能导入已有正式库或直接覆盖共用预览库。
- 下载文件、校验报告和临时数据库有独立的清理记录。演练结束删除私密导出及临时数据库；仅留下不含记录内容的校验结论。

## 真实故障恢复

1. 先判断是代码故障还是数据破坏。代码故障优先恢复上一稳定 Worker Version，避免无理由回滚数据。
2. 数据恢复先记录当前 Worker Version、D1 ID 和当前 Time Travel bookmark；停止可能继续产生错误写入的操作，明确要恢复的时间点及期间会丢失的新写入。恢复正式数据前须经负责人确认。
3. 短期误操作优先评估 D1 Time Travel 的实际可用窗口；不得假定所有套餐保留相同天数。长期恢复优先先在独立库验证备份，再单独制定绑定切换和会话撤销方案。
4. 数据库恢复与 R2 对象恢复分别核对。旧数据库可能引用已删除原图或旧会话；核对媒体对象，撤销恢复出来的旧会话。不能只看到首页能打开就宣告恢复成功。
5. 验收旅行、相册可见成员、照片原地址、留言、费用和登录权限，记录恢复耗时、缺失数据区间和回退步骤。

官方参考：[D1 导入导出](https://developers.cloudflare.com/d1/best-practices/import-export-data/)、[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)、[R2 认证](https://developers.cloudflare.com/r2/api/tokens/)。
