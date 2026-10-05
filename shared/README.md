# shared/ · 网站与游戏公用资源

| 包 | 作用 | 版本控制 |
| --- | --- | --- |
| `shared-ui` | 设计系统 lxh-ui（真身；`portal/huiguan/design-system/ui` 反向 junction 指向它） | 本仓库 |
| `shared-types` | 三系统 JSON 契约（world / exchange / models），`npm run verify` 28 项 | 独立 git 仓库（本仓库忽略） |
| `shared-data` | 世界观只读事实导出（`worldview.json` + `export_worldview.py`） | 本仓库 |
| `shared-session` | 统一会话 / 统一存档 / 事件总线 | 本仓库 |

根 `package.json` 声明 workspaces（`shared/*`），导入用包名：

```js
import { validateEcoExchange } from '@lxh/shared-types/exchange';
import '@lxh/shared-ui/lxh-ui.css';
import facts from '@lxh/shared-data/worldview.json';
import { refreshSession } from '@lxh/shared-session/session';
import { get, set } from '@lxh/shared-session/save';
```

## 统一存档说明

- 命名空间：`localStorage['iridescently.save.v1']`，带 `schemaVersion`。
- `shared-session/kv.js` 的 `unifiedStorage(<模块>)` 提供与 localStorage 同形的接口，并自动迁移各模块旧键。
- `shared-session/bus.js` 用 `BroadcastChannel('iridescently')` 跨模块同步（Node 下 `unref` 不阻塞进程）。
- 各模块旧的独立存档键保持不变，统一层不覆盖。
