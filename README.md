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
│     ├─ src/<名>/             # 游戏源码（各自 git 仓库）
│     └─ modules/<名>/         # 构建产物（gitignore，运行所需）
├─ shared/                     # 公用资源（git 仓库）
│  ├─ shared-ui/               # 设计系统 lxh-ui（真身）
│  ├─ shared-types/            # 三系统 JSON 契约
│  ├─ shared-data/             # 世界观只读事实导出
│  └─ shared-session/          # 统一会话 / 统一存档 / 事件总线
├─ portal/                     # 站点：www（主站）· huiguan（会馆）· oc（人设）· activation-core
├─ ops/网站恢复/               # 网站管家（一键重启站点 + 隧道）
├─ assets/                     # 素材：素材 / 网站素材 / 罗小黑战记数据库 / 罗小黑组件合成
├─ package.json                # 根 workspaces（shared/*）
└─ README.md
```

## 统一入口与上线状态

`server/portal_server.py` 单进程按 `Host` 与路径分发；**生产已切换**：`iridescently.xyz`、`www`、`huiguan`、`oc` 四个域名由 Cloudflare 隧道指向本进程。

| 路由 | 目标 |
| --- | --- |
| 主域 `/` | `portal/www` |
| `huiguan.*` | `portal/huiguan` |
| `oc.*` | `portal/oc` |
| `/app/shell/` | 统一壳（SPA 路径路由 `/app/shell/m/<名>`） |
| `/app/modules/<名>/` | 游戏模块（构建产物） |
| `/shared/*` | 设计系统 / 会话存档等公用资源 |
| `/app/modules/<名>/api/*` | 反向代理到各游戏 API 上游 |

游戏 API 代理上游：`cards→5174`、`softie→4173`、`juling→5177`。

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
node server/app/scripts/build-modules.mjs          # 构建全部游戏模块
PORT=8080 python server/portal_server.py           # 统一入口（含 www/huiguan/oc + 壳 + 游戏）
python server/verify_portal.py                     # 统一入口自检
```

| 上游/单站 | 命令 | 端口 |
| --- | --- | --- |
| 卡牌 OAuth | `cd server/app/src/cards && python server.py` | 5174 |
| 软乎乎 预览 | `cd server/app/src/softie-webgpu && npm run preview` | 4173 |
| 聚灵 | `cd server/app/src/juling && PORT=5177 node server.js` | 5177 |
| 网站管家（一键全部） | `cd ops/网站恢复 && python website-manager.py` | — |

统一入口也可在 `8080` 直接测：壳 `http://127.0.0.1:8080/app/shell/`，会馆 `:8089` 单站仍可单独启动。

## 验证

| 目标 | 命令 |
| --- | --- |
| 统一入口 | `python server/verify_portal.py`（27/27） |
| 契约 | `cd shared/shared-types && npm run verify`（28） |
| 卡牌 | `cd server/app/src/cards && npm test && npm run check:game`（22） |
| 经营 | `cd server/app/src/management && npm test`（6） |
| 生态 | `cd server/app/src/ecology && npm test`（7） |
| 软乎乎 | `cd server/app/src/softie-webgpu && npm test`（64） |
| AEON | `cd server/app/src/aeon && node test/headless.mjs` |
| 网站管家自检 | `cd ops/网站恢复 && python website-manager.py --smoke-test` |

## 公用包

```js
import { validateEcoExchange } from '@lxh/shared-types/exchange';
import '@lxh/shared-ui/lxh-ui.css';
import facts from '@lxh/shared-data/worldview.json';
import { refreshSession } from '@lxh/shared-session/session';
import { get, set } from '@lxh/shared-session/save';
```

## 版本控制

根级仓库（`README/package/ops/.gitignore`）+ `server/`、`shared/`，以及 `server/app/src/*`、`shared/shared-types`、`portal/*` 各自仓库。`server/app/modules/`、`server/app/src/`、`node_modules/`、`assets/` 在相应仓库忽略。

## 边界

- `shared-types` 协议标识 `eco='ecoplanet3d-js'`、`lj='lingjing-huiguan'` 与旧 localStorage 键保持不变。
- 会馆/人设站的 SSO 与设计系统走独立子域，跨域在本地会被 ORB/CORS 拦，属预期。
- 世界观库 `assets/罗小黑战记数据库` 用 `relink_db.py` 维护路径（搬移后可重链）。
