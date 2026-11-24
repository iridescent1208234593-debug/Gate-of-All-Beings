# 命名与公共契约规则

本文件解决“同一个概念被不同开发者、不同 AI 用不同名字实现”的问题。原则是：先统一语义，再统一新代码命名；历史公共字段通过边界归一与迁移逐步收敛，禁止无计划全局替换。

## 1. 命名层级

同一个概念在不同技术层允许采用该层惯用形式，但必须保持语义一一对应。

| 层 | 推荐形式 | 示例 |
| --- | --- | --- |
| Python | `snake_case` | `user_id`, `avatar_asset_id` |
| JSON / HTTP API | `snake_case` | `expected_owner`, `player_id` |
| SQL 列 | `snake_case` | `user_id`, `created_at` |
| TypeScript / JavaScript 内部变量 | `camelCase` | `userId`, `avatarAssetId` |
| TypeScript 类型/React 组件 | `PascalCase` | `GateIdentity`, `PlayerProfile` |
| 环境变量 | `UPPER_SNAKE_CASE` | `IRIDESCENTLY_STORAGE_ROOT` |
| 文件/目录 | 延续所在子系统既有规则 | 不为统一格式大规模改名 |

注意：形式转换不等于语义重命名。例如 API `user_id` 在 TS 中映射为 `userId` 是正常层间映射；把同一个账户 ID 另命名为 `memberId` 则属于新增语义别名，原则上禁止。

## 2. 账户身份的 canonical 语义

跨系统持久化 owner 不使用裸 ID。账户 owner 的 canonical 语义是：

```text
(kind, uid)
```

在当前部分 API/归一层中可表达为：

```json
{
  "kind": "local | usso | ...",
  "user_id": "..."
}
```

这里 `uid` 与 `user_id` 在部分现有边界上表达同一账户标识位，但它们是历史接口兼容关系，不授权开发者在任意位置随意互换。

规则：

- 认证/SSO 返回 `uid` 的既有接口可以继续返回，除非有正式迁移。
- 新的内部归一对象优先采用现有该子系统已经使用的 `user_id` / `userId`，并始终携带 `kind`。
- 不新增 `account_id` 来悄悄替代 `(kind, uid)`；若未来引入真正独立的全局 Account ID，必须做架构决策与迁移。
- 比较账户 owner 时比较 `kind + id`，不得只比较裸数字/字符串。

## 3. `player_id` 的边界

仓库中已有 activation-core / player session 等历史接口使用 `player_id`。它不是全仓库统一账户主键。

因此：

- 既有 API、数据库列和导入导出格式中的 `player_id` 不做无计划重命名。
- 新代码只有在语义确实是该 activation/player-session 领域中的 Player 时才可继续使用 `player_id`。
- 如果实际语义是 Account owner，应在边界层转换为明确的 `{kind, user_id}` 或对应内部类型。
- 禁止因为看到 `player_id` 就把 Gate Identity、OC、Actor、Controller 的 ID 都叫 `player_id`。

## 4. 角色/身份命名

禁止使用模糊的跨系统 `character_id` 作为新公共契约，除非文档明确规定其对象类型。

推荐：

- OC：`oc_id` / `ocId`
- Gate Identity：若需要独立记录 ID，使用明确的 `gate_identity_*` 命名；当前主要 owner 仍是 Account owner
- 世界 Actor：`actor_id` / `actorId`
- Controller：`controller_id` / `controllerId`
- world branch：`branch_id` 仅在上下文明确时使用；跨领域接口优先 `world_branch_id`
- Git branch：文档中写 `Git branch`，不与模拟分支混写

## 5. 布尔、时间与计数

- 布尔变量优先 `is_*` / `has_*` / `can_*` / `should_*`，不要使用含糊的 `flag`。
- 时间戳字段统一以 `_at` 结尾，例如 `created_at`, `updated_at`, `revoked_at`。
- 持续时长使用明确单位后缀，如 `_ms`, `_seconds`, `_minutes`；禁止裸 `timeout = 5` 而不说明单位。
- 数量使用 `_count`，上限使用 `max_*`，不要在同一契约中混用 `num`, `total`, `amount` 表示同一计数。

## 6. API 契约

修改公共 API 前必须先判断它属于：

1. 新增向后兼容字段；
2. 行为变更；
3. 字段重命名；
4. 字段删除；
5. 新版本契约。

字段重命名/删除不得直接完成。至少需要：

- 确认所有调用方；
- 兼容读取旧字段或兼容返回窗口；
- 测试旧客户端与新客户端；
- 更新 `docs/api.md` 或更具体的模块契约文档；
- 在 PR 里说明移除旧字段的条件。

## 7. 数据库契约

- 表名/列名属于持久契约，不能为了代码风格直接重命名。
- ORM/TS 属性可以映射数据库现有列，例如 `playerId` → `player_id`。
- 改 schema 必须显式说明 migration、现有数据兼容、回滚与旧程序行为。
- 任何涉及真实用户数据的迁移都不因合并 PR 自动获得生产执行授权。

## 8. 环境变量

新增环境变量前先搜索整个仓库和运维文档。

新环境变量要求：

- `IRIDESCENTLY_` 前缀，除非子项目已有不可变外部约定；
- 名称表达“配置是什么”，不要表达某台机器或个人目录；
- 文档写清是否必填、默认值、允许环境和敏感性；
- 密钥只记录变量名，不记录真实值；
- 若存在 `.env.example` 或模块 example 配置，应同步更新。

## 9. 禁止模式

新代码原则上禁止出现：

```text
uid / user_id / player_id / account_id 随意互换
character_id 表示多个不同对象
同一状态同时存在 status / state / phase 三套枚举
同一时间单位无后缀混用
复制一份 shared type 到模块内部再自行改字段
为兼容问题长期保留两套可写真值
```

确需例外时必须在代码附近或相关契约文档解释原因。

## 10. 新增核心字段检查清单

提交前逐项确认：

- 这个概念是否已经有名字？
- 字段属于哪个 owner？
- 是内部变量还是公共 Contract？
- 是否跨模块/跨进程/跨数据库？
- 是否需要兼容旧字段？
- 是否需要 Schema/类型同步？
- 是否需要更新 GLOSSARY/API/数据库文档？
- 是否有测试证明旧行为没有被误伤？

## 10. 共创名录与会馆 LAB 认证

- 复用 Account `(kind, uid)`，不按昵称或邮箱合并。共创身份、职责、LAB 测试资格及后台权限各自独立。
- 私有路由用于有权限的组织管理与成员授权；公开路由通过显式投影返回数据，不返回账户 ID、邮箱、登录记录或权限细节。
- 名录、数据和回滚见 [HUIGUAN_CREATOR_ROLLOUT.md](HUIGUAN_CREATOR_ROLLOUT.md)；会馆与 LAB 认证协议见 [LAB_ACCOUNT_BROKER.md](LAB_ACCOUNT_BROKER.md)。


## 11. 同人画廊历史与公开排序

- 画廊卡片 ID 属于 `fan_characters.id`，不能和账号 ID、OC 编号互换；历史与点赞都绑定此 ID。
- `like_count` 是 `fan_char_votes.vote=1` 的计数，不是喜欢、踩或旧综合 `reaction_score`；`published_at` 与 `updated_at` 是不同时间。
- 审核操作记录、版本留存、API 与回滚见 [FAN_GALLERY_HISTORY.md](FAN_GALLERY_HISTORY.md)。

- 管理员送回复审使用原画廊卡片 ID、当前复审版本及必填理由，事件名为 `moderation_reopen`。保留独立的复审与审核通过动作，详见 [同人画廊契约](FAN_GALLERY_HISTORY.md)。
- 作者修改复审的保存响应字段为 `fan_review_pending`；审核队列以 `needs_independent_review` 表示卡片须独立复审、以 `can_approve` 表示当前审核员能否通过该版本。复用现有审核状态、画廊卡片 ID 和版本，不引入新的 owner 或状态。见 [同人画廊契约](FAN_GALLERY_HISTORY.md)。
- 版本归属使用管理员历史中的 `snapshot.approval`、`current_approval` 与既有留存稿编号 `snapshot_id`；审核人来自受信会话的 `(kind, uid)`，只对管理员投影已核实昵称和不透明代号，未确证时留空。见 [同人画廊契约](FAN_GALLERY_HISTORY.md)。
