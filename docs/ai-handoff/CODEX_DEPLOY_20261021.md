# Codex 交接：把 `zszm-batch-20261021` 发布到线上（2026-10-21，Claude）

用户已审完并批准这条提交链，要求由 Codex 发布到线上。本文只写发布需要的事实；背景见 [DIRTY_WORK_MAP](DIRTY_WORK_MAP.md) 顶部「2026-10-21 收敛」和 [CURRENT_PRIORITIES](CURRENT_PRIORITIES.md)。

**SSH 连接信息（2026-10-21 更新）**：香港生产 SSH 已确认使用 `154.222.26.70:43012`，账户 `iridescently-deploy`，本机专用密钥 `.releases/hk-full-migration/deploy_ed25519`。`ops/hk-release.py` 是服务器管家、status 与发布入口共用的固定配置；保持 `IdentitiesOnly=yes`、`StrictHostKeyChecking=yes`，不使用 root 或密码登录。

## 0. 前置：先确认已经 push

Claude 的 `git push` 被本机自动模式拦截，需要用户自己推送：

```
git push origin zszm-batch-20261021
```

开始前核对：`git fetch origin && git rev-parse origin/zszm-batch-20261021` 应等于本地 HEAD（不早于 `68ab14f`，本文所在提交在其后）。不一致就停下问用户，不要自己 force push。

## 1. 这次发布的内容

以 `b88faf0`（多会话混合 checkpoint，保持原样）为基础，之后的提交：

| 提交 | 影响线上的部分 |
| --- | --- |
| `b88faf0` | 众生牌录（原手记）成为主界面；灵卡五行 / 类型印章；灵质回路奖励改为灵质（贯通 30、散灵 5）；共同旅途名册里老君显示为「老君（节能模式）」；门庭旧版入世历练入口改为「即将下线」 |
| `8647984`、`ef75e55`、`e7f8cd5`、`1fd1766` | 改名 Gate of All Beings、根 package 改名、积分 / 排行榜文档、主站时间线 |
| `4deee6c` | 旧入世历练的 5 小时复活计时只在 `#adventure` 里运行，不再改写众生牌录的同行者状态 |
| `7d13815`、`39c7799`、`c9a5f7f` | 只有文档 |
| `8085ff9`、`68ab14f` | 删除 management、slay 里没人引用的带时间戳旧副本；slay 的 `public/` 会随模块发布，所以重建模块后线上会少这两个死文件 |

涉及的发布单元：**cards 前端、modules（management、slay）、site（主站时间线等）**。

## 2. 发布前必须做的

1. **快照滞后陷阱**：`ops/hk-release.py prepare/publish` 从本地 `.releases/production/site` 重新打包 `server/ portal/ shared/`，这份快照落后于其他会话已经手工推到香港的文件（10-19 起有多个热修文件只在线上归档里）。`prepare` 之后，必须把新归档和线上 `current` 归档**逐文件比对 sha256**，每一处差异都要能对上本节第 1 节的改动才发布。对不上时，以线上归档为底只替换本次文件，再 `stage` / `activate` 那个归档（`hk-release.py` 里 `remote('stage <ver>', archive)`、`remote('activate <ver>')`）。
2. **cards 与 site 一起发**：新前端调用 `/api/gate/identity`、`/api/gate/ocs`，依赖新的 `cards/server.py` 和 `server/account_profile.py`。先确认线上是否已有这两个接口；没有就必须和 site 同一窗口发布，否则身份接口 404。
3. **slay 从构建产物提供**：`/app/modules/slay/` 读的是 `server/app/modules/slay`，不是 `slay-the-web/public`。发布前跑 `npm run build:modules`。
4. **EPERM**：本地 `publish:site` 需要同时停掉 5174 与 8080（[release-architecture-v2.md](../release-architecture-v2.md) 第 7 节）。
5. **存档迁移**：发布后跑 `python server/game_saves.py status` 确认 `(kind, uid, scope)` 迁移状态。
6. **回滚**：动手前记下线上 `current` 归档版本号，出问题就 `activate` 回去。

## 3. 不要做的

- 不要提交或依赖工作区里未提交的 `ops/hk-release.py` 改动（`ZSZM_HK_SSH_TARGET` 覆盖发布 SSH 目标）。自动模式把它判为放宽发布安全边界，等用户决定；发布用已提交版本的默认部署账户和密钥。
- 不要改、不要复制外传任何数据库：`portal/huiguan/users.db`、`server/app/src/cards/users.db`、`ops/backups/` 里的生产库副本。
- 不要把 `work/`、`ops/backups/`、`assets/字体/`、`.bak`、画师截图入库。
- 不要删除旧实现：旧入世历练入口、`#adventure`、`#hall`，以及旧重生之门 slay 模块，都是用户决定暂时保留的（等重生之门迁完剧情回想、长期进度、结局、旧档转换）。

## 4. 发布后验收（zszm.iridescently.xyz）

- `#journal`（众生牌录）能打开；出行、重生之门、灵质回路入口都在。
- 灵卡顶部有彩色印章，例如「攻击 · 御灵 · 金」是金色、「技能」无五行时是墨色。
- 灵质回路开局文字是「贯通带回灵质 30；散灵带回灵质 5」。
- `#journey` 同行名册里老君显示「老君（节能模式）」，战力等数值不变；太上老君仍是另一个角色。
- 门庭里旧版入世历练入口还在，二次确认后能进入。
- `/app/shell/m/slay` 旧重生之门仍能打开、进战斗。
- 主站、西木会馆首页和登录正常（site 一起发布时）。

## 5. 本地已验证 / 未验证

已验证（HEAD `68ab14f`）：cards `check:game`、全量 `tsc`、`npm test` 61/61、后端 4/4；统一存档浏览器验证 25/25；management 测试 6/6；cards 与 management 的 Vite 生产构建（输出到临时目录，没有覆盖 `.releases/candidate`）；浏览器里 9 个主模块加载和上面几项界面检查。

未验证：`test:portal`（会复制真实 `users.db`，按约束跳过）；slay 测试（`ava` 未安装，原本如此）；需要登录资料的页面没有在本地点进去（本地 API 会用 `users.db`，没有启动）。发布后的线上验收要补上这几块。

## 6. 2026-10-23 追加（HEAD 上比 `68ab14f` 多出的改动）

用户后来又决定：魂灵和修行残片从界面去掉，旧版入世历练归档下线。对应两个提交：

- `e263562`：共同旅途和众生牌录的资源条、见闻里不再显示魂灵 / 修行残片（它们仍留在共享账本里，旧重生之门页面还会写入，账本校验要求这两项存在，已有余额不能丢）。
- `2045553`：下线 `#adventure`、旅途手札 `#timeline`、门庭里的「旧版」入口；旧链接回到门庭。旧代码在本地标签 `archive/legacy-adventure-20261023`（指向 `e263562`），说明见 [legacy-adventure-20261023.md](../archive/legacy-adventure-20261023.md)。

所以：**如果发布的是这两个提交之后的 HEAD，第 3 节「不要删除旧实现：旧入世历练入口、`#adventure`」和第 4 节「旧版入世历练入口还在」都不再适用**。改为验收：门庭没有「旧版」入口；访问 `#adventure` 回到门庭；资源条只有灵质 / 草药 / 食物。`#hall` 会馆日常、旧重生之门 slay 模块仍然保留。标签需要 `git push origin archive/legacy-adventure-20261023` 才会到远端。
