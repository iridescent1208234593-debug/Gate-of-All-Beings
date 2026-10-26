# 账户等级、每日任务与玩法排行榜（2026-10-20 源码，未发布）

账户只有一套：会馆 `users.db` 的 `(kind, uid)`（见 [zszm-identity-and-save-map.md](zszm-identity-and-save-map.md)）。本功能不新建账户系统，所有表都以 `(kind, uid)` 为 owner，排行榜只显示昵称，不返回 uid。

## 1. 规则

**等级曲线**：第 1 级需要 1 分，之后每级比上一级多 1 分；第 n 级累计 `n(n+1)/2` 分（1、3、6、10、15……）。新账户 Lv.0，无上限。积分按 0.1 记账（库里存整数 `points_x10`）。

**积分来源**（`services/platform/account_progress.py` 的 `RULES`）：

| 规则 | 积分 | 每天上限 |
| --- | --- | --- |
| 某玩法今天第一次游玩 | 0.5 | 每玩法 1 次 |
| 完成一局 | 0.2 | 每玩法 5 次 |
| 胜利 / 通关 | 0.3 | 每玩法 3 次 |
| 刷新个人最佳 | 0.5 | 每玩法 1 次（首次成绩不算） |
| 每日任务：完成任意一局 | 1 | 1 次 |
| 每日任务：今天玩三种不同玩法 | 1 | 1 次 |
| 会馆登记**新**角色设表（修改已有设表不计） | 1 | 2 张 |
| 新设表使用自定义配色 | 0.5 | 1 次 |
| **账户总计** | — | **每天 8 分** |

"一天"按北京时间 00:00 切换。按上限计算，新玩家第 1 天最多 Lv.3（8 分），第 2 天 Lv.5（16 分），Lv.10（55 分）至少要 7 天。旧规则（设表 +20、配色 +10、每 10 分一级）已删除。

## 2. 各玩法排行榜

| board | 玩法 | 排名依据 | 上报位置 |
| --- | --- | --- | --- |
| `cards` | 众生牌录 · 入世历练 | 单次最深层数 | `cards/src/world/progressReport.ts`（由 `JournalApp.tsx` 的 commit 调用） |
| `slay` | 重生之门（独立版 + 众生牌录内） | 最高层数 | `apps/slay/public/ui/app.js`；牌录内由 progressReport（带 receipt 的导入结算不重复计） |
| `lingzhi` | 灵质回路（独立版 + 众生牌录内） | 最高层数 | `apps/slay/public/ui/lingzhi-xiuxing.js`；牌录内由 progressReport |
| `shore` | 雾隐浅滩 | 单次探索节点（全部 3 处 = 完成） | `cards/src/game/shore/world-screen.js` |
| `juling` | 聚灵 | 修行评分 =（成仙 100 / 未成仙 20×境界序）× 难度 | `juling/public/index.html`（魂灵是全服共享值，不用作个人分） |
| `management` | 灵境会馆经营 | 已建成建筑数 | `management/src/systems/saveGame.js` |
| `ecology` | 灵境生态 | 同存物种数 | `ecology/src/ui/spacePanel.js` |
| `softie` | 灵体互动 | 累计相处分钟（每天最多计 120） | `apps/softie/.../spirit-playground/view.js` |
| `aeon` | AEON | 最高演化代数 | `aeon/src/main.js` |
| `shengsheng-shoot` | 省省海滩射击 | 最高得分 | `apps/www/playtest/shengsheng-shoot/game.js` |
| `level` | 账户等级 | 积分 | — |

同分时按胜场多者、先达到者、owner 排序（"你的名次"与列表顺序一致）。访客可照常游玩，上报返回 `ranked:false`，服务器不写任何数据。

## 3. 数据与接口

`users.db` 新表（`account_progress.init_schema`，会馆启动和每次 API 调用时建表，只建不删）：

- `account_points (kind, uid, points_x10, display_name, updated_at)`：账户积分总额。
- `account_point_events`：只追加的发分流水，`UNIQUE(kind, uid, rule, game, ref)` 保证客户端重试不重复发分。
- `game_scores (kind, uid, game, best_score, runs, wins, ...)`：每玩法个人最佳。
- `game_score_daily`：每天每玩法的上报次数（每天 ≤ 300）和累计型玩法的当日分钟数。
- `game_runs (kind, uid, game, ref, ...)`：完成的局，同一 ref 只计一次。
- `account_points_legacy`、`account_progress_migrations`：重置迁移的归档与记录。

旧的 `local_users.points` / `user_flags.points` 列不再被读写，仅供迁移归档和回滚。

接口挂在 `portal_server` 的所有站点（同源，`/api/progress/*` 优先于其他路由）：

- `GET /api/progress/boards`：榜单清单。
- `GET /api/progress/leaderboard?board=<key>&limit=50`：前 N 名 + 当前账户名次。
- `GET /api/progress/me`：等级、升级进度、今日积分 / 上限、每日任务、各玩法最佳。
- `POST /api/progress/report`：`{game, score, finished?, won?, ref?}`；`finished`/`won` 必须带 `ref`。要求 `Content-Type: application/json`、Origin 为 `*.iridescently.xyz` 或本机，身份只认 `hx_sso`（经 `resolve_sso_identity` 复核账户状态，封禁/失效 = 访客）。

客户端：`packages/shared-session/progress.js`（`reportResult` 一局结束、`reportProgress` 持续型玩法自带 5 分钟节流、局末小提示链接到排行榜）。会馆 `/api/user` 与设表保存的 `points/level` 字段改由本模块计算，并新增 `next_level_at`。

排行榜页面：`/shared/shared-ui/leaderboard/index.html?board=<key>`，各站点都可访问。入口：模块壳顶栏"排行榜"（默认当前玩法）、局末提示、会馆账户页"查看排行榜"。

## 4. 防刷与已知边界

- 每账户每天 8 分总上限 + 每规则上限 + 局编号去重；伪造分数最多影响一个榜，不能刷等级。
- 每玩法有分数合理上限（`GAMES[*].max`），超出返回 400。
- **成绩由浏览器上报，服务器无法验证对局真实性**（与现有玩法存档一致，都在客户端运行）。如需可信榜单，要把对应玩法的结算搬到服务端，属于后续工作。
- 排行榜页面需要登录态 cookie；本机 `localhost` 拿不到 `.iridescently.xyz` cookie，本地只能看到访客视图（测试用自签 token）。

## 5. 积分清零迁移（需要负责人批准后执行）

部署新代码后，所有账户读到的积分已经是新表里的 0；迁移负责清掉旧列并留档，保证没有旧值残留，也可回滚。

```bash
python services/platform/account_progress.py reset-legacy           # 预演：显示将清零的账户数与积分，不写入
python services/platform/account_progress.py reset-legacy --apply   # 归档旧积分 → 旧列清零 → 清空新积分与流水；重复执行会拒绝
python services/platform/account_progress.py restore-legacy --apply # 回滚：把归档的旧积分写回旧列（旧代码读的位置）
```

在 2026-10-20 的 `users.db` **临时副本**上预演 + 执行：254 个账户、合计 41,760 旧积分被归档并清零，第二次执行被拒绝；副本已删除。真实 `users.db` 未执行。玩法排行榜成绩（`game_scores`）不受重置影响。

建议顺序：备份 `users.db` → 发布代码并重启 portal → 运行 `reset-legacy` 预演核对数字 → `--apply`。

## 6. 测试

- `python services/platform/tests/test_account_progress.py`（临时数据根）：等级曲线、发分与去重、每日上限与跨日、(kind, uid) 隔离、累计型上限、参数校验、同分名次、设表只计新表、重置/拒绝重复/回滚、HTTP 访客/封禁/伪造 cookie/跨站/非 JSON。
- `python services/platform/tests/verify_portal.py`：新增 6 项（各站点 `/api/progress/*`、排行榜页、progress.js）。
