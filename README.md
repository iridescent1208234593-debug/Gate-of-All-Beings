# Iridescently · 众生之门

罗小黑战记主题的站点与游戏工作区。统一入口、统一存档、统一设计系统，逐步把独立站点与游戏整合为一个网站。

## 目录结构

```
Iridescently/
├─ server/                     # 统一后端 + 前端壳 + 全部游戏源码
│  ├─ portal_server.py         # 统一入口：按 Host/路径分发（单进程单端口）
│  ├─ verify_portal.py         # 统一入口自检
│  ├─ base_static.py           # 静态站点基类
│  ├─ hx_sso.py                # 跨站 SSO cookie
│  ├─ account_security.py      # 账号找回 / 限流 / 改密
│  └─ app/
│     ├─ shell/index.html      # 统一壳：路由 + iframe 内嵌各游戏（hash 路由 #/m/<名>）
│     ├─ portal.json           # 门户清单（导航唯一数据源）
│     ├─ scripts/build-modules.mjs   # 构建全部游戏到 app/modules/
│     ├─ src/                  # 游戏源码（各自的 git 仓库）
│     │  ├─ cards/             # 众生之门·卡牌（原 zszm）
│     │  ├─ management/        # 灵境会馆·据点经营
│     │  ├─ ecology/           # 生态进化
│     │  ├─ juling/            # 聚灵（Node + SQLite）
│     │  ├─ slay-the-web/      # 重生之门
│     │  ├─ softie-webgpu/     # 软乎乎（WebGPU）
│     │  └─ aeon/              # AEON 文明模拟
│     └─ modules/              # 构建产物（gitignore，运行所需）
├─ shared/                     # 公用资源（git 仓库）
│  ├─ shared-ui/               # 设计系统 lxh-ui（真身）
│  ├─ shared-types/            # 三系统 JSON 契约（独立 git）
│  ├─ shared-data/             # 世界观只读事实导出
│  └─ shared-session/          # 统一会话 / 统一存档 / 事件总线
├─ portal/                     # 站点
│  ├─ www/                     # 主站 Iridescently
│  ├─ huiguan/                 # 西木会馆（设计系统真身目录已被 shared-ui 取代 → 反向 junction）
│  ├─ oc/                      # 三足乌·虹 人设站
│  └─ activation-core/         # Next.js 应用
├─ ops/                        # 运维
│  ├─ 网站恢复/                # 网站管家（一键重启全部站点 + 隧道）
│  └─ _verification/           # 验证脚本
├─ assets/                     # 素材：素材 / 网站素材 / 罗小黑战记数据库 / 罗小黑组件合成
├─ _archive/                   # 归档（历史状态、旧 public 归档）
└─ _quarantine/                # 隔离区（可疑/临时文件，可删）
```

根 `package.json` 用 npm workspaces 管理 `shared/*`，导入用包名 `@lxh/shared-*`（根 `npm install` 维护链接）。

## 统一入口（推荐）

单进程按 `Host` 与路径分发，规划中的"一个网站"：

```bash
PORT=8080 python server/portal_server.py     # 统一入口
python server/verify_portal.py               # 自检（27 项）
```

| 路径 / Host | 目标 |
| --- | --- |
| `/`（主域） | `portal/www` |
| `huiguan.*` | `portal/huiguan` |
| `oc.*` | `portal/oc` |
| `/app/shell/` | 统一壳（各游戏导航） |
| `/app/modules/<名>/` | 各游戏模块 |
| `/shared/shared-ui`、`/shared/shared-session` | 设计系统 / 会话存档 |
| `/management/`、`/ecology/` | 兼容 cards 内嵌的根别名 |

游戏 API 通过 `/app/modules/<名>/api/*` 反向代理到各自上游：

| 模块 | 上游 |
| --- | --- |
| cards（登录/存档） | `127.0.0.1:5174` |
| softie（设置保存） | `127.0.0.1:4173` |
| juling（游戏逻辑） | `127.0.0.1:5177` |

## 本地启动

```bash
# 构建全部游戏模块（源码 → server/app/modules/）
node server/app/scripts/build-modules.mjs
```

| 目标 | 命令 | 端口 |
| --- | --- | --- |
| 统一入口 | `PORT=8080 python server/portal_server.py` | 8080 |
| 主站 | `cd portal/www && python server.py` | 8088 |
| 西木会馆 | `cd portal/huiguan && python server_huiguan.py` | 8089 |
| 人设站 | `cd portal/oc && python server.py` | 8090 |
| 卡牌 | `cd server/app/src/cards && npm run dev` | 5173 |
| 卡牌 OAuth | `cd server/app/src/cards && python server.py` | 5174 |
| 经营 | `cd server/app/src/management && npm run dev` | 5179 |
| 生态 | `cd server/app/src/ecology && npm run dev` | 5173* |
| 聚灵 | `cd server/app/src/juling && PORT=5177 node server.js` | 5177 |
| 重生之门 | `cd server/app/src/slay-the-web && npx vite` | 5176 |
| 软乎乎 | `cd server/app/src/softie-webgpu && npm run preview` | 4173 |
| AEON | 静态，由统一入口 `/app/modules/aeon/` 提供 | — |
| 网站管家（一键全部） | `cd ops/网站恢复 && python website-manager.py` | — |

\* 多个 Vite 默认端口相同，勿同时启动。

## 公用包

```js
import { validateEcoExchange } from '@lxh/shared-types/exchange';   // JSON 契约
import '@lxh/shared-ui/lxh-ui.css';                                  // 设计系统
import facts from '@lxh/shared-data/worldview.json';                 // 世界观
import { refreshSession } from '@lxh/shared-session/session';        // 统一会话
import { get, set } from '@lxh/shared-session/save';                 // 统一存档
```

- `shared-ui` 为真身；`portal/huiguan/design-system/ui` 是指向它的反向 junction。
- 统一存档落 `localStorage['iridescently.save.v1']`，各模块经 `shared-session/kv.js` 的 `unifiedStorage(<模块>)` 读写，旧键自动迁移；`BroadcastChannel('iridescently')` 跨模块同步。

## 验证

| 目标 | 命令 |
| --- | --- |
| 统一入口 | `python server/verify_portal.py` |
| 契约 | `cd shared/shared-types && npm run verify`（28） |
| 卡牌 | `cd server/app/src/cards && npm test && npm run check:game`（22） |
| 经营 | `cd server/app/src/management && npm test`（6） |
| 生态 | `cd server/app/src/ecology && npm test`（7） |
| 软乎乎 | `cd server/app/src/softie-webgpu && npm test`（64） |
| AEON | `cd server/app/src/aeon && node test/headless.mjs` |
| 网站管家自检 | `cd ops/网站恢复 && python website-manager.py --smoke-test` |

## 部署（生产，尚未切换）

生产站点由 `ops/网站恢复/website-manager.py` 的 `SITES` 与 `~/.cloudflared/config.yml` 管理，目前仍是独立单站（www 8088 / huiguan 8089 / oc 8090 / zszm 5173 …）。统一入口（8080）尚未接入隧道。

## 版本控制

`shared/`、`server/` 为根级 git 仓库；`server/app/src/*`、`shared/shared-types` 保留各自仓库。`server/app/modules/`、`server/app/src/`、`node_modules/` 已在相应仓库忽略。

## 边界说明

- `shared-types` 的协议标识 `eco='ecoplanet3d-js'`、`lj='lingjing-huiguan'` 与各模块 localStorage 键保持不变。
- 会馆/人设站的 SSO、设计系统走独立子域，跨域在本地会被 ORB/CORS 拦，属预期。
- 根目录 `conversations.json`、`罗小黑素材引用关系排查报告.md` 为用户资料，未纳入仓库。
