# 数据库与存储

## 1. 世界观库（只读事实）· SQLite

- 路径：`assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db`
- 消费方：`portal/huiguan/server_huiguan.py`（`WV_DB`），只读直查；图片经 `/api/official/*`、`/api/assets/*` 分发。
- 图片根：`assets/罗小黑战记数据库`（`WV_ROOT_DIR`），另允许 `assets/素材`。
- 主要表（40 张）：`characters`、`character_images`、`images`、`unclassified_images`、`spirit_lifecycle(_images)`、`character_info`、`shared_assets`、`timeline_v2`、`episodes`、`staff`、`cultivation_realm` 等。
- **路径列**存绝对路径（`image_path` / `file_path` / `path`）。目录搬移后需重链：

  ```bash
  # 预演；加 --apply 执行（会先备份）
  python "assets/罗小黑战记数据库/relink_db.py" [--apply]
  ```

  规则：旧前缀替换 → 候选（`images\` 嵌套）→ 唯一文件名匹配；`http(s)` 外链与真实缺失项不动。

- 导出事实给前端：`shared/shared-data/export_worldview.py` → `worldview.json`。

## 2. 会馆用户库 · SQLite

- 路径：`portal/huiguan/users.db`（`STATIC_DIR/users.db`）。
- 表：
  - 账号：`users`（USSO 用户）、`local_users`（站内用户名/密码，`role`/`status`）、`sessions_db`（登录态持久化）、`user_flags`（封禁/管理员）。
  - 账号找回：`account_recovery`、`security_attempts`（`server/account_security.py` 建表）。
  - 内容：`elder_requests`、`exempt_requests`、`fan_characters`、`color_schemes`、`posters`、`sticker_uploads`、`char_favorites`、`char_votes` 等。
- 云存档：`/api/game/save`、`/api/game/load`（management 使用）。

## 3. 卡牌 · 浏览器 IndexedDB

- 库名 `zszm-adventure-v1`，对象仓 `saves`，键 `current`（`server/app/src/cards/src/game/storage.ts`）。
- 含 run、meta（角色羁绊、年表）、生态个体与交换队列（最多 512/100）。
- 统一存档镜像：每次写档把进度摘要写入 `m:cards:summary`。

## 4. 聚灵 · SQLite / JSON

- `server/app/src/juling/data/save.db`（Node ≥22.5 `node:sqlite`），表 `save_state(key TEXT PRIMARY KEY, value TEXT)`；旧环境退回 JSON。
- 前端把局内摘要镜像到 `m:juling:summary`。

## 5. 软乎乎 · 服务端 JSON + 统一偏好

- 设置：`server/app/src/softie-webgpu/server/spirit-settings.js` 的 Vite 中间件（dev/preview），落 `spirit-settings.json`，接口 `/api/spirit-settings`。
- 语言/音效/音量：`unifiedStorage('softie')`。

## 6. 统一存档 · localStorage

- 键：`iridescently.save.v1`，含 `schemaVersion` 与各模块 `m:<模块>:<key>`。
- 适配器：`@lxh/shared-session/kv.js` 的 `unifiedStorage(<模块>)`（同 localStorage 接口，自动迁移旧键；Node 退回内存）。
- 各模块旧键（如 `lingjing-huiguan-save`、`lxz-rebirth-*`、`softie-*`）保持不变，首次读取迁移。

## 连接速查

| 存储 | 路径/键 | 只读/读写 |
| --- | --- | --- |
| 世界观库 | `assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db` | 只读（会馆） |
| 会馆用户库 | `portal/huiguan/users.db` | 读写 |
| 卡牌存档 | 浏览器 IndexedDB `zszm-adventure-v1` | 读写 |
| 聚灵存档 | `server/app/src/juling/data/save.db` | 读写 |
| 软乎乎设置 | `spirit-settings.json`（preview 目录） | 读写 |
| 统一存档 | `localStorage['iridescently.save.v1']` | 读写 |
