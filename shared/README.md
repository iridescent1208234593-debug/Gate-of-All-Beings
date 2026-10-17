# shared/ · 网站与游戏公用资源

| 包 | 作用 | 版本控制 |
| --- | --- | --- |
| `shared-ui` | 设计系统 lxh-ui（真身；`portal/huiguan/design-system/ui` 反向 junction 指向它） | 本仓库 |
| `shared-types` | 三系统 JSON 契约（world / exchange / models），`npm run verify` 28 项 | 本仓库（历史独立仓库已并入） |
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

## 生产消费者与导航

会馆 `design-system/ui` 是指向 `shared-ui` 的 junction，不能当作第二份设计系统删掉。共享内容只管理稳定的视觉组件与会话契约，各页面保留自己的 Gallery、表单和游戏状态。

Intro 的进度格式、拖动生命周期和 Skip 绑定由 `shared-ui/lxh-intro.js` 统一；视觉规则在 `shared-ui/intro-controls.css`，并在会馆设计系统样式指南中展示。Cards 入口和会馆首页保留各自的场景/动画状态机，只共享可复用的控件契约。`shared-ui/lxh/ui/` 存放组件的界面参考素材；正式组件实现是 `lxh-ui.css/js`，在设计系统素材库中演示。

站群公共导航的实现位于 `portal/www/assets/shared-chrome-v2.js`，保留消费者已有的 `#authBar`。游戏导航位于 `portal/huiguan/design-system/game-nav.js`；在统一壳中挂入当前模块容器，使样式和节点随 owner 卸载。主页拥有适合全屏图库的独立 chrome；Connections 采用相同入口顺序与当前页规则。
