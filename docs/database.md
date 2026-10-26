# 数据库与存储

## 1. 世界观库（只读事实）· SQLite

- 路径：`assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db`
- 消费方：`apps/huiguan/server_huiguan.py`（`WV_DB`），只读直查；图片经 `/api/official/*`、`/api/assets/*` 分发。
- 图片根：`assets/罗小黑战记数据库`（`WV_ROOT_DIR`），另允许 `assets/素材`。
- 主要表（40 张）：`characters`、`character_images`、`images`、`unclassified_images`、`spirit_lifecycle(_images)`、`character_info`、`shared_assets`、`timeline_v2`、`episodes`、`staff`、`cultivation_realm` 等。
- **路径列**存绝对路径（`image_path` / `file_path` / `path`）。目录搬移后需重链：

  ```bash
  # 预演；加 --apply 执行（会先备份）
  python "assets/罗小黑战记数据库/relink_db.py" [--apply]
  ```

  规则：旧前缀替换 → 候选（`images\` 嵌套）→ 唯一文件名匹配；`http(s)` 外链与真实缺失项不动。

- 导出事实给前端：`packages/shared-data/export_worldview.py` → `worldview.json`。

## 2. 会馆用户库 · SQLite

- 路径：`apps/huiguan/users.db`（`STATIC_DIR/users.db`）。
- 表：
  - 账号：`users`（USSO 用户）、`local_users`（站内用户名/密码，`role`/`status`）、`sessions_db`（登录态持久化）、`user_flags`（封禁/管理员）。
  - 账号找回：`account_recovery`、`security_attempts`（`services/platform/account_security.py` 建表）。
  - 内容：`elder_requests`、`exempt_requests`、`fan_characters`、`color_schemes`、`posters`、`sticker_uploads`、`char_favorites`、`char_votes` 等。
- 云存档：`/api/game/save`、`/api/game/load`（management 使用）。

## 3. 共同旅途 · 浏览器 IndexedDB

- 统一库 `iridescently-game-v1`，对象仓 `records`：`profile` 存公共余额/角色进度，`mode:<key>` 存各模式完整快照，`receipt:<mode>:<event-id>` 保存结算去重回执。实现为 `packages/shared-session/game.js`。
- Cards 的 run、meta、生态个体与交换队列（最多 512/100）整体存入 `mode:cards`；Slay 的原生存储通过持久待写队列进入 `mode:slay`。
- 旧 `zszm-adventure-v1/saves/current` 为只读迁入来源，`m:cards:summary` 为摘要。均不会覆盖统一主档。
- 当前是同源设备进度，不自动归属于登录账户，也不提供云同步。迁移、资源事务及其他小游戏接入见 [共同旅途](ai-handoff/README.md)。

## 4. 聚灵 · SQLite / JSON

- `apps/juling/data/save.db`（Node ≥22.5 `node:sqlite`），表 `save_state(key TEXT PRIMARY KEY, value TEXT)`；旧环境退回 JSON。
- 前端把局内摘要镜像到 `m:juling:summary`。

## 5. 软乎乎 · 服务端 JSON + 统一偏好

- 设置：`apps/softie/server/spirit-settings.js` 的 Vite 中间件（dev/preview），落 `spirit-settings.json`，接口 `/api/spirit-settings`。
- 语言/音效/音量：`unifiedStorage('softie')`。

## 6. 统一存档 · localStorage

- 键：`iridescently.save.v1`，含 `schemaVersion` 与各模块 `m:<模块>:<key>`。
- 适配器：`@lxh/shared-session/kv.js` 的 `unifiedStorage(<模块>)`（同 localStorage 接口，自动迁移旧键；Node 退回内存）。
- 各模块旧键（如 `lingjing-huiguan-save`、`lxz-rebirth-*`、`softie-*`）保持不变，首次读取迁移。

## 连接速查

| 存储 | 路径/键 | 只读/读写 |
| --- | --- | --- |
| 世界观库 | `assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db` | 只读（会馆） |
| 会馆用户库 | `apps/huiguan/users.db` | 读写 |
| 卡牌/共同旅途存档 | 浏览器 IndexedDB `iridescently-game-v1` | 按模式版本和公共资源事务读写；旧 Cards 库只读迁入 |
| 聚灵存档 | `apps/juling/data/save.db` | 读写 |
| 软乎乎设置 | `spirit-settings.json`（preview 目录） | 读写 |
| 统一存档 | `localStorage['iridescently.save.v1']` | 读写 |

## OC SQL 数据层 2026-10-26

OC 已有可选的统一 SQLite 实现：`services/platform/oc_store.py`，复用环境内 `data/huiguan/users.db` 的 `oc_*` 表。默认配置仍为 JSON；生产切换以前 `characters.json` 继续是事实源。SQL 保存使用 owner 隔离与 record revision，不与 JSON 双写。Cards 的 OC 候选也通过同一个后端数据层读取。

数据库比较、schema、HTTP 兼容及开发测试见 [OC SQL 存储](storage/oc-sql-storage.md)，人工备份、冻结、迁移、验证与回滚对账见 [迁移手册](storage/oc-sql-runbook.md)。生产/staging WAL 必须使用已包含官方 WAL-reset 修复的 SQLite；本次未执行生产切换。
