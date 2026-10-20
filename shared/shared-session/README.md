# @lxh/shared-session · 统一会话与存档

统一入口、壳与各游戏模块共享的会话（SSO）与存档命名空间。

```js
import { refreshSession, getSession } from '@lxh/shared-session/session';
import { get, set, patch, onSave } from '@lxh/shared-session/save';
import { unifiedStorage } from '@lxh/shared-session/kv.js';
import { publish, subscribe } from '@lxh/shared-session/bus.js';
```

| 文件 | 作用 |
| --- | --- |
| `session.js` | `fetchSession()` / `refreshSession()` / `getSession()`，走 `/api/sso-user` |
| `save.js` | `get/set/patch/onSave/clear`，落在 `localStorage['iridescently.save.v1']`，带 `schemaVersion` |
| `kv.js` | `unifiedStorage(<模块>)`：与 localStorage 同形，写入统一命名空间并自动迁移旧键；Node 下退回内存 |
| `bus.js` | `BroadcastChannel('iridescently')` 跨模块广播，`publish/subscribe`（Node 下 `unref` 不阻塞） |
| `game.js` / `game.d.ts` | 共同旅途：IndexedDB 事务、模式快照、角色进度、公共资源和稳定事件回执；通用 `openMode/commitMode/transact` |
| `progress.js` / `progress.d.ts` | 账户积分与排行榜上报：`reportResult`（一局结束）/ `reportProgress`（持续型，自带节流）/ `fetchLeaderboard`；走同源 `/api/progress/*`，访客不上榜。规则见 [account-progress-and-leaderboards.md](../../docs/account-progress-and-leaderboards.md) |

## 各模块接入

| 模块 | 方式 |
| --- | --- |
| management | 存档 / 账号 / 工坊 / 主题 → `unifiedStorage('management')` / `('ui')` |
| ecology | 世界持久化 → `unifiedStorage('ecology')` |
| slay | 原生同步缓存 `unifiedStorage('slay')` + 持久待写队列 → 统一 IndexedDB 的 `mode:slay`；启动/离开时同步 |
| cards | 统一 IndexedDB 的 `mode:cards` 为主，旧 `zszm-adventure-v1` 只读迁入；公共资源和角色进度归共同 profile |
| juling | 局内摘要镜像（服务端 SQLite 不变） |
| softie | 语言 / 音效 / 音量偏好 → `unifiedStorage('softie')` |

各模块旧的独立键作为恢复来源保留，首次读取时迁入统一命名空间。删除已有键写 tombstone，避免旧档复活；配额或损坏错误不会静默忽略。`save.js` 与 `kv.js` 使用同一底层命名空间读写。

共同旅途是同一 origin 下的设备进度，与账户 SSO/OC 所有权分离；尚无云同步。接入代码、资源差额规则、失败恢复和验证命令见 [共同旅途合并 README](../../docs/ai-handoff/README.md)。完整人物资料和灵卡册延迟加载，入口校验仅使用轻量 ID 索引。
