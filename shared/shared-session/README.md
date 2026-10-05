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

## 各模块接入

| 模块 | 方式 |
| --- | --- |
| management | 存档 / 账号 / 工坊 / 主题 → `unifiedStorage('management')` / `('ui')` |
| ecology | 世界持久化 → `unifiedStorage('ecology')` |
| slay | 成就 / 图鉴 / 结局 / 魂灵 / BGM → `unifiedStorage('slay')` |
| cards | IndexedDB 为主，进度摘要镜像到 `unifiedStorage('cards')` |
| juling | 局内摘要镜像（服务端 SQLite 不变） |
| softie | 语言 / 音效 / 音量偏好 → `unifiedStorage('softie')` |

各模块旧的独立键保持不变，首次读取时自动迁移到统一命名空间。
