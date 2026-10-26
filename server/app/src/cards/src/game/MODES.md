# 众生之门门庭与模式

本轮将正式开场之后的目的地改为「玩家初始化 → 门庭」，不再把卡牌冒险或原型浅滩场景当作唯一终点。

## 维护入口

- `ModeHall.tsx` / `mode-hall.css`：门庭布局、玩家形象展示、空间入口与案头辅助入口。
- 发布模块的名称、描述、真实 URL 和加载方式继续由 `server/app/portal.json` 唯一管理。门庭直接 import 此清单；`cards → journal`、`management → management`、`ecology → ecosystem` 是现有同页路由映射，不是第二份模块注册表。
- `GameApp.tsx`：hash 路由及会馆日常、图鉴、万灵志的 owner；众生牌录（出行、重生之门、灵质回路）在 `journal/`。旧版入世历练（`#adventure`）和旅途手札（`#timeline`）已于 2026-10-23 下线，旧链接回到门庭；代码保存在 git 标签 `archive/legacy-adventure-20261023`。
- `ShoreMode.tsx` / `shore/`：原型最后的雾隐浅滩独立为探索小游戏，退出回门庭。
- `server/app/shell/index.html`：成熟独立模块继续使用现有壳生命周期。顶部是站点全局栏（`packages/shared-ui/site-nav.js`），其下一条米白本地栏：「门庭」回到众生之门 `/#home`，其余为模块页签（重生之门、聚灵、灵境会馆、生态进化、灵体互动、AEON）。壳根路径 `/app/shell/` 不再展示独立入口页，直接回门庭。

## 当前路由

| 入口 | 内容 | 状态 / 存档所有者 |
| --- | --- | --- |
| `#home` | 统一门庭、当前玩家形象 | `PlayerProfileProvider` 只读展示身份 |
| `#shore` | 雾隐浅滩、三处灵息、日志 | `zszm.shore.v1:<scope>` 会话存档 |
| `#journal` | 众生牌录：出行、重生之门、灵质回路 | 统一存档 `mode:world` + 共享账本 |
| `#management` | 灵境会馆、据点经营 | 原经营模块；iframe/receipt/outbox 保持原协议 |
| `#ecosystem` | 灵境生态 | 原生态模块及收获交换协议 |
| `#hall` | 会馆日常、默契、封灵 | 卡牌 meta；不等同三维据点 |
| `#collection` | 灵卡图鉴与已有数值工具 | 原卡牌配置 API |
| `#world` | 万灵志资料 | 共享 worldview.json，不是独立小游戏 |
| `/app/shell/m/juling` | 聚灵 | 原聚灵模块 |
| `/app/shell/m/slay` | 重生之门 | 原 Slay 模块 |
| `/app/shell/m/softie` | 灵体互动 | 原 Softie 模块，不在本轮改动 |
| `/app/shell/m/aeon` | AEON | 原 AEON 模块 |
| `/app/shell/m/shengsheng-shoot` | 省省海滩射击试玩 | 现有壳承载静态试玩，保留返回门庭 |
| `/app/shell/m/world-map` | 罗小黑世界地图 | 内置 `/app/modules/world-map/`；由同域 iframe 隔离全屏 WebGL 页面，不依赖外站 |
| `/playtest/shengsheng-shoot/` | 射击试玩旧直达书签 | 继续有效；统一代理显式转到主站 Handler |

小游戏继续保留各自存档与账号能力。此次统一的是入口和玩家资料读取边界，没有把所有玩法数据合并到 Gate Identity。

## 来源与资源

门庭复用共享 `lxh-ui.css` 的纸色与墨色规则及现有 `PlayerAvatar.tsx` 渲染器。门庭森林图来自 `packages/shared-ui/lxh/scenes/deep-forest-moss.png`，通过相对源码 import 由 Vite 构建。

浅滩的三个热点、灵息、任务、日志、E/J 交互与背景来自用户验收的 `E:\External Projects\original-ui-version\src\world-screen.js` / `src/media/bg.png`。必要实现已复制进正式源码 `shore/`，运行时不依赖外部项目绝对路径。背景保留为真实图片，未重新生成简化场景。来源是项目现有素材复用，不因此宣称新增资产版权或发布授权。

正式开场由 `src/gate/EntryGate.tsx` 保留；原型的 `opening-animation.js`、重复门景、开场 DOM 和主入口 `main.js` 不进入这份模式实现。初始化组件另见 `src/onboarding/README.md`。

## 生命周期与验证边界

React 卸载 `ShoreMode` 时清除本模式所有 listener / timer 和 DOM；无持续 JS RAF、WebGL 或全局字号写入。切后台暂停场景 CSS 动画，减少动态效果时关闭装饰运动。`sessionStorage` 按匿名/账号 scope 隔离，暂未接云存档。

构建和检查使用 Cards 既有 `npm run check:game` / `npm run build`；工作区正式候选经 `npm run build:modules` 生成到 `.releases/candidate/`。本轮不 publish、不 commit、不 push。
