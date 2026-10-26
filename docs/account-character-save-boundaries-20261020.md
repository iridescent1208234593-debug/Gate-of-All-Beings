# 账户、角色与服务端存档归属（2026-10-20）

范围：依据当前工作树与既有身份/存档文档确定后续服务端存档边界；这里只制定 schema 和迁移约束，不迁移数据库或用户数据。

## 归属原则

| 数据 | owner / 主键 | 内容与边界 |
| --- | --- | --- |
| 登录账户 | `(kind, uid)`，`kind` 目前为 `local` 或 `usso` | 会馆 `users.db` 的 `local_users`、`users`、`sessions_db`；认证服务从有效会话解析 owner。裸 `uid` 不唯一。 |
| 账户资料 | `(kind, uid)` | `account_profiles` 保存账户头像与 Gate identity。Gate identity 是众生之门玩家形象，不是 OC，也不自动成为游戏角色。 |
| OC 角色 | 稳定 `character_id`；所有者为 `(owner_kind, owner_uid)` | 当前 OC 内容仍在 `characters.json`，以账户对应键保存角色列表，每条含 `code` 和 `data`。角色可有名称、种族与图片；不能因为登录账户或 Gate identity 相同就自动合并角色。 |
| 游戏存档 | `(kind, uid, scope)` | 复用已实现的 `game_saves`：账户 owner 加独立玩法 scope。当前 `management` 与 `softie` 分槽；客户端提交的 owner 不能覆盖服务端从会话解析出的 owner。 |
| 访客进度 | 浏览器当前 origin / 会话存储 | 继续留在本地，直到用户明确选择导入某个账户或角色；登录时不自动认领、拼接或覆盖云端资料。 |
| 实时房间 | 短期 `room_id` 与连接级 `self_id` | 房间成员和实时状态不等于账户或存档 owner。需要保存进度时另走经认证的存档 API。 |

## 现有源码证据

- `portal/huiguan/users.db` 同时维护本地账户、USSO 用户、会话和账户资料；共享账户主键为 `(kind, uid)`。
- `services/platform/account_profile.py` 的 `account_profiles` 主键是 `(kind, uid)`，包含 `account_avatar_url`、`gate_identity_json`，并保留 Gate identity roster 字段。
- `portal/huiguan/server_huiguan.py` 的角色保存路由先调用 `_require_ident()`，再以 `_data_key(ident)` 读写 `characters.json` 中的列表；角色保存和账户身份是有关联但不同的实体。
- `services/platform/game_saves.py` 已有 `(kind, uid, scope)` 主键和旧 JSON 归属演练；`docs/game-save-ownership.md` 记录了冲突隔离、迁移留痕和回滚规则。
- `docs/zszm-identity-and-save-map.md` 记录 Cards、生态、聚灵等仍属浏览器级或服务级的进度，不能假设它们已经是账户云存档。

## 建议的目标结构

保留现有账户表作为身份真值，不复制密码或会话到游戏表。服务端读取认证会话后得到 `(kind, uid)`，并在每次读写中检查资源 owner。

OC 后续数据库化时可采用：

```sql
CREATE TABLE characters (
  character_id TEXT PRIMARY KEY,
  owner_kind TEXT NOT NULL,
  owner_uid TEXT NOT NULL,
  legacy_code TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_kind, owner_uid, legacy_code)
);
```

迁移保留旧 `code` 供旧链接和客户端兼容；列表、读取、更新、删除均从当前认证会话取得 owner 并在 SQL 条件中同时匹配 `character_id + owner_kind + owner_uid`。如后续需要多个可选存档槽，再扩展保存表的 `slot_id`；当前不改造已经工作的单槽 API。

## 迁移约束

1. 先对 `characters.json` 做只读盘点，统计键格式、角色数、重复 `code`、无对应账户和疑似跨 owner 冲突。
2. 生成 dry-run 映射；对无法唯一确认 owner 的旧角色隔离并列出，禁止按裸 uid 猜测归属。
3. 使用稳定 `character_id`，保留原 `code` 与导入来源；迁移成功前旧 JSON 保持只读回退来源。
4. 新 API 的 owner 必须来自服务端认证；拒绝只由客户端传 `uid` 的读写请求。
5. 访客内容只通过显式导入操作归属到账户；不静默合并 Gate identity、账户头像、OC 和存档。
6. 先迁移 OC 的读写 API 与权限检查，再讨论 Cards、聚灵或其他玩法存档；每个玩法独立定义 scope 与兼容策略。

## 后续实施任务建议

将 `characters.json` 的 owner 盘点、目标表建表、dry-run 映射、API 读写切换、冲突隔离和回滚验证拆成独立实施票据。此设计不授权执行真实数据库迁移，也不改变现有用户数据。
