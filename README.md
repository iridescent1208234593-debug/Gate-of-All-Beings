# Iridescently · 众生之门

罗小黑战记主题的站点与游戏工作区。已整合为**统一入口 + 统一壳（无 iframe 单 SPA）+ 统一存档**的多模块网站，并已上线。

## 目录结构

```
Iridescently/
├─ server/                     # 统一后端 + 前端壳 + 全部游戏源码
│  ├─ portal_server.py         # 统一入口：单进程按 Host/路径分发
│  ├─ verify_portal.py         # 统一入口自检
│  ├─ base_static.py           # 静态站点基类
│  ├─ hx_sso.py                # 跨站 SSO cookie
│  ├─ account_security.py      # 账号找回 / 限流 / 改密
│  └─ app/
│     ├─ shell/index.html      # 统一壳（History API 路径路由，7 游戏全部内嵌，无 iframe）
│     ├─ portal.json           # 门户清单（导航唯一数据源，含 embed 标记）
│     ├─ scripts/build-modules.mjs   # 构建全部游戏到 app/modules/
│     ├─ src/<名>/             # 游戏源码（根仓库统一管理）
│     └─ modules/<名>/         # 构建产物（gitignore，运行所需）
├─ shared/                     # 公用资源包（根仓库统一管理）
│  ├─ shared-ui/               # 设计系统 lxh-ui（真身）
│  ├─ shared-types/            # 三系统 JSON 契约
│  ├─ shared-data/             # 世界观只读事实导出
│  └─ shared-session/          # 统一会话 / 统一存档 / 事件总线
├─ portal/                     # 主站、会馆、人设站，以及独立的 activation-core 应用
├─ ops/网站恢复/               # 网站管家（一键重启站点 + 隧道）
├─ assets/                     # 素材：素材 / 网站素材 / 罗小黑战记数据库 / 罗小黑组件合成
├─ package.json                # 根 workspaces（shared/*）
└─ README.md
```

### 仓库边界与数据

根目录是唯一 Git 仓库；`portal/`、`server/`、`shared/` 下的源码均由根仓库追踪，不使用子模块。各应用目录代表代码归属，不代表独立仓库。

- `server/app/src/<项目>/` 是游戏/应用源码；`server/app/modules/<模块>/` 是统一入口运行所需的**构建输出**，不提交 Git。
- `node_modules/`、`dist/`、缓存、日志、`.env`、SQLite 数据库、会话导出均为本地/运行数据，不提交。部署前必须构建模块；数据库及上传内容须独立备份与恢复。
- `conversations.json` 是本地会话导出，不被项目代码引用，不属于应用配置；保留在本机并排除出仓库。
- `assets/罗小黑战记数据库/` 是本机外部数据集（约 6.16 GiB），不纳入 Git，但会馆与首页构建依赖它；部署时须单独提供该目录并校验数据库和图片路径。`assets/素材/` 是会馆可用的图片资源目录，保留在 Git；`assets/网站素材/` 是本机网站快照/提取资料，不纳入 Git。`portal/huiguan/assets/uploads` 等运行期上传内容也单独备份。
- `portal/activation-core/` 是独立 Next.js 应用，不由统一门户构建或启动；其生产部署需单独配置数据库与服务。

## 统一入口与上线状态

`server/portal_server.py` 单进程按 `Host` 与路径分发；网站管家配置由同一入口提供 `iridescently.xyz`、`www`、`huiguan`、`oc` 与 `zszm`。本轮更新了本地路由与网站管家清单，未重载隧道或部署生产。

灵体互动试验场有独立入口：[spirit.iridescently.xyz](https://spirit.iridescently.xyz/games/spirit-playground?room=forest)。该子域仍由统一门户托管，静态文件来自 `server/app/modules/softie/` 构建产物，灵体房间 WebSocket / API 代理至本机 softie 上游（4173）；项目首页和统一壳也保留内部入口。网站管家已将独立域名登记到软乎乎上游服务。账号登录通过会馆 SSO，灵体参数写入独立 `softie` 云存档范围。

| 路由                      | 目标                                                            |
| ------------------------- | --------------------------------------------------------------- |
| 主域 `/`                  | `portal/www`                                                    |
| `huiguan.*`               | `portal/huiguan`                                                |
| `oc.*`                    | `portal/oc`                                                     |
| `zszm.* /`                | 当前众生之门卡牌应用（`server/app/modules/cards/`）；`/api/sso-user` 走会馆共享 SSO，OAuth API 代理到 5174，数值配置 API 代理到 5178 |
| `spirit.*`                | 灵体互动场景（softie 构建产物；API / WebSocket 由统一入口转发） |
| `/app/shell/`             | 统一壳（SPA 路径路由 `/app/shell/m/<名>`）                      |
| `/app/modules/<名>/`      | 游戏模块（构建产物）                                            |
| `/shared/*`               | 设计系统 / 会话存档等公用资源                                   |
| `/app/modules/<名>/api/*` | 反向代理到各游戏 API 上游                                       |

旧 `lingjing.iridescently.xyz` 与 `juling.iridescently.xyz` 页面入口重定向到众生之门内的据点经营与聚灵模块；聚灵 5177 进程仍作为统一模块的 API 上游保留。

游戏 API 代理上游：`cards/OAuth→5174`、`cards/card-balance→5178`、`softie→4173`、`juling→5177`。

灵体专属域名通过 Cloudflare tunnel ingress 连接到 8080；新增子域时同时在 `server/portal_server.py` 添加 Host 路由、`portal/huiguan/server_huiguan.py` 允许对应精确 SSO CORS 来源，并在 `server/app/portal.json` 登记链接。隧道配置重载后以 `server/verify_portal.py` 和线上页面 / WebSocket 验证。

### 主站首页与节气图库

主域 `/` 现在以罗小黑战记节气贺图图库为首页主体。首页源结构与首页专属导航在 `portal/www/homepage.html`，Gallery 展示与交互接入在 `portal/www/scripts/gallery.js`，观感滑块和本地偏好在 `portal/www/scripts/appearance-controls.js`，响应式样式位于 `portal/www/styles/`。正式入口 `portal/www/index.html` 是构建产物；资源版本会随内容变化；请修改源文件后再构建，勿直接维护生成页面。

- `npm run dev:homepage` 启动首页预览，地址为 `http://127.0.0.1:5173/assets/homepage/homepage.html`。
- `npm run build:homepage` 发现图库图片、校验发布文件并更新根首页。
- `npm run build:modules` 构建游戏模块和主站首页；网站管家启动门户前会运行此构建。
- Gallery 源码位于 `New project/gallery/codrops-depth-gallery/`；实际图库来自根目录的 `assets/罗小黑战记数据库/罗小黑节气贺图（gallery素材）/`。
- 首页像素标志在 `portal/www/assets/iridescently-mark.png`；站名靠近颜文字交互在 `portal/www/scripts/brand-interaction.js`。本轮浏览器验收图见 [`docs/homepage-acceptance-assets/`](docs/homepage-acceptance-assets/)。
- 首页维护与文件职责见 [`portal/www/README.md`](portal/www/README.md)。

## 统一壳（无 iframe 单 SPA）

- 壳用 **History API 路径路由**，7 个游戏全部通过 embed 协议**直接挂载进同一文档**（无 iframe）：
  `fetch 模块 index.html → 注入 body/样式 → 执行其 module/classic/内联脚本`；`<base>` 按模块基址解析相对资源；`window.__iridescentlyDispose` 统一卸载，切换零泄漏。
- 每个模块源码暴露 `mount/unmount`（React 用 `createRoot`；原生用 `dispose`/`requestAnimationFrame` 停止；softie 提供 `mount(container)`）。
- 路由：`/app/shell/` 首页，`/app/shell/m/<key>` 模块；服务端对 `/app/shell/*` 做 SPA 回退到 `shell/index.html`。

## 统一存档与会话

- `@lxh/shared-session/session` 统一 SSO 会话；`save` 命名空间 `localStorage['iridescently.save.v1']`；`kv` 提供与 localStorage 同形的 `unifiedStorage(<模块>)`（旧键自动迁移）；`bus` 用 `BroadcastChannel('iridescently')` 跨模块同步。
- 已接入：management / ecology / slay（存档）、cards（IndexedDB 为主 + 摘要镜像）、juling（局内摘要镜像）、softie（UI 偏好）。

## 本地启动

```bash
npm ci
npm run build:modules                              # 构建主站首页与全部游戏模块
PORT=8080 python server/portal_server.py           # 统一入口（含 www/huiguan/oc + 壳 + 游戏）
python server/verify_portal.py                     # 统一入口自检
```

`npm ci` 安装共享 workspace；各 Vite 应用（cards / management / ecology / softie-webgpu）还需在对应源码目录执行 `npm ci`。主站首页构建复用 Gallery 项目的 Vite 依赖，首次缺少时在 `New project/gallery/codrops-depth-gallery/` 安装。网站管家启动统一门户前会先构建模块和首页，构建失败则不启动门户。

| 上游/单站            | 命令                                                   | 端口 |
| -------------------- | ------------------------------------------------------ | ---- |
| 卡牌 OAuth           | `cd server/app/src/cards && python server.py`          | 5174 |
| 软乎乎 预览          | `cd server/app/src/softie-webgpu && npm run preview`   | 4173 |
| 聚灵                 | `cd server/app/src/juling && PORT=5177 node server.js` | 5177 |
| 网站管家（一键全部） | `cd ops/网站恢复 && python website-manager.py`         | —    |

统一入口也可在 `8080` 直接测：壳 `http://127.0.0.1:8080/app/shell/`，会馆 `:8089` 单站仍可单独启动。

## 验证

| 目标         | 命令                                                              |
| ------------ | ----------------------------------------------------------------- |
| 统一入口     | `python server/verify_portal.py`（27/27）                         |
| 契约         | `cd shared/shared-types && npm run verify`（28）                  |
| 卡牌         | `cd server/app/src/cards && npm test && npm run check:game`（22） |
| 经营         | `cd server/app/src/management && npm test`（6）                   |
| 生态         | `cd server/app/src/ecology && npm test`（7）                      |
| 软乎乎       | `cd server/app/src/softie-webgpu && npm test`（91）               |
| AEON         | `cd server/app/src/aeon && node test/headless.mjs`                |
| 网站管家自检 | `cd ops/网站恢复 && python website-manager.py --smoke-test`       |

## 公用包

```js
import { validateEcoExchange } from "@lxh/shared-types/exchange";
import "@lxh/shared-ui/lxh-ui.css";
import facts from "@lxh/shared-data/worldview.json";
import { refreshSession } from "@lxh/shared-session/session";
import { get, set } from "@lxh/shared-session/save";
```

## 版本控制

根目录 Git 是唯一仓库。源码与文档集中由根仓库管理；构建输出、依赖、数据库、日志、密钥、会话导出和本地大型数据不纳入版本控制。部署前构建命令见上文；运行数据库、外部素材和上传内容需独立备份。

## 边界

- `shared-types` 协议标识 `eco='ecoplanet3d-js'`、`lj='lingjing-huiguan'` 与旧 localStorage 键保持不变。
- 会馆/人设站的 SSO 与设计系统走独立子域，跨域在本地会被 ORB/CORS 拦，属预期。
- 世界观库 `assets/罗小黑战记数据库` 用 `relink_db.py` 维护路径（搬移后可重链）。

## 工具与整理入口

- [统一更新流程](docs/update-system.md)：显式运行的 Git / Gallery 清单工具；不会因保存而发布。
- [目录整理记录](docs/maintenance/repository-cleanup-2026-10-10.md)：worktree 成果、迁出范围与验证边界。
- [研发工作区](New%20project/README.md)：实验、设计资料与开发参考。
- 独立创作入口：`E:\New project\README.md`，不参与网站构建。
