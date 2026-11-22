# 云存档账户归属：`(kind, uid, scope)`

状态（2026-10-17）：源码已实现并通过测试，**未发布**。线上 8080 仍运行快照中的旧实现（裸 uid JSON）。

## 问题

旧实现把会馆云存档写在 `apps/huiguan/game_saves.json`，键是裸 `uid`。

- 本地账户和 USSO 账户的编号空间各自独立。local `7` 与 usso `7` 会读写同一条记录。真实数据里 `7` 就同时存在于两种账户（usso `7` 是站长管理员）。
- `scope=softie` 没有灵体存档时，会回退返回经营存档，造成跨玩法串档。
- 整个文件每次全量重写，没有事务，也无法按玩法扩展。

## 设计

| 部分 | 说明 |
| --- | --- |
| 存储 | 会馆 `users.db` 的 `game_saves` 表，主键 `(kind, uid, scope)`；与账户表在同一 SQLite 事务域 |
| owner | 只接受 `kind ∈ {local, usso}` 且 uid 非空，否则 `ValueError`。之后新增账户种类须显式加入 `KINDS` |
| scope | `SCOPES = ("management", "softie")`。API 不带 scope 时等于 `management`（兼容现有经营客户端）；未知 scope 返回 400；scope 之间不回退 |
| 上限 | 单槽 8 MiB（与 `_read_json` 一致），超出返回 413 |
| 代码 | `services/platform/game_saves.py`（存储、迁移、CLI）；`apps/huiguan/server_huiguan.py` 的 `/api/game/save`、`/api/game/load` 只调用它 |

HTTP 契约不变：路径、`?scope=softie`、响应字段 `ok` / `savedAt` / `state`、404「暂无云存档」都保留。客户端（经营 `apps/management/src/systems/account.js`、灵体 `apps/softie/src/games/spirit-playground/view.js`）无需修改；重生之门 slay 只用本地 `game/save-system.js`，不走云存档。

## 旧存档迁移

- **触发**：`init_user_db()` 在建表后调用 `game_saves.import_legacy(conn, GAME_SAVE_FILE)`。每个源文件内容哈希只导入一次，记录在 `game_save_migrations` 表。
- **只读**：新代码**从不写** `game_saves.json`，它保留为回滚来源。
- **归属规则**（`resolve_legacy_owner`，只按正面证据判定）：

  | 情况 | 结果 |
  | --- | --- |
  | 键已带前缀 `local:` / `usso:` | 直接采用 |
  | 只有一种账户拥有该编号 | 归该账户 |
  | 两种都有 | 只有记录里的 `userName` 唯一匹配其中一方（local 的 username/nickname，或 usso 的 nickname）时才归属 |
  | 其余情况（`ambiguous-collision`、`no-matching-account`） | **隔离**：存入 `game_save_legacy`，不提供给任何账户 |

- **全量留痕**：每条旧记录（含解析结果与理由）都写入 `game_save_legacy`。
- **冲突**：账户槽已有更新的存档（按解析后的时间比较，不是字符串比较）时保留新档，计入 `kept-newer`。

2026-10-17 对真实数据的只读演练（`python services/platform/game_saves.py plan`）：

```
       7 management -> local:7        collision-resolved-by-local-name
     181 management -> local:181      only-local-account
     183 softie     -> local:183      only-local-account
```

3 条全部有归属，没有隔离项。`7` 的 `userName` 是 `iridescent`，等于 local 7 的用户名；usso 7 的昵称是「佳霖」。

## 运维与回滚

```powershell
python services/platform/game_saves.py plan      # 只读演练
python services/platform/game_saves.py import    # 手动导入（启动时也会自动执行）
python services/platform/game_saves.py status    # 计数、隔离项、迁移记录
python services/platform/game_saves.py export --out E:\backup\game_saves.rollback.json
```

`IRIDESCENTLY_PROJECT_ROOT` 指定数据根目录。

**回滚到旧代码**：

1. 停服务。
2. `export` 生成旧格式文件。旧格式无法区分 kind；同号冲突保留最新一份，并在输出的 `conflicts` 中列出。
3. 人工确认后替换 `game_saves.json`。`export` 拒绝直接覆盖它。
4. 部署旧代码。

**再次前滚**：替换后的 JSON 哈希改变，会再导入一次，但只覆盖比账户槽更旧的数据，不会抹掉前滚期间产生的新存档。

## 发布前检查

1. 备份 `users.db` 与 `game_saves.json`（`<工作区>\operations\backups` 既有流程）。
2. 在生产数据副本上运行 `plan` 和 `status`，确认隔离项为 0 或已人工处理。
3. 发布 site 快照（与 ZSZM 改动一起时，`publish:cards` 与 `publish:site` 需同步）。
4. 启动后用 `status` 确认迁移记录存在。

## 测试

`python services/platform/tests/test_game_save_scope.py`（从项目根目录运行），共 12 项。测试在导入会馆模块前把 `IRIDESCENTLY_PROJECT_ROOT` 指向临时目录，不会打开真实 `users.db`。覆盖：

- 同号不同 kind 隔离
- 账户 A/B 切换后各自存档可见，刷新/新请求后仍保持
- 未登录访客不能读写云存档
- 隔离项不可读
- scope 独立、无回退
- 未知 scope 拒绝
- softie CORS 预检
- 旧 JSON 不被写入、导入幂等
- export 冲突报告
- 回滚后再导入保留新档
- 非法 owner 拒绝

## 尚未处理（独立任务）

- 会馆 `characters.json` 的 OC 键仍是 `local:<uid>` / 裸 usso uid 的不对称约定。迁移方式可以复用本文件的归属规则，但涉及编辑权限与展示页，需单独设计。
- Cards IndexedDB、生态 localStorage、聚灵 `save.db` 仍是浏览器级或服务级存档，没有账户归属。见 [zszm-identity-and-save-map.md](zszm-identity-and-save-map.md) §5。
