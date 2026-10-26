# 架构

## 分层

```
浏览器
  └─ 统一入口 services/platform/portal_server.py :8080   （按 Host / 路径分发）
       ├─ Host=huiguan.*        → portal/huiguan      （会馆，含账号/素材 API）
       ├─ Host=oc.*             → portal/oc           （人设站）
       ├─ Host=主域 /           → portal/www          （主站）
       ├─ 路径 /app/shell/*     → 统一壳（SPA，回退 index.html）
       ├─ 路径 /app/modules/<名>/* → 各游戏构建产物
       ├─ 路径 /shared/*        → shared/*（设计系统、会话等）
       └─ /app/modules/<名>/api/* → 反向代理到各游戏上游
```

各处理类由 `services/platform/base_static.py` 的 `BaseStaticHandler` 派生，请求时按 `parse_request` 动态切换类；**每个 keep-alive 请求都会重新分发**（见 `Dispatcher.handle_one_request` 的 try/finally）。

## 统一壳（embed模块同页挂载）

- 壳页面 `server/app/shell/index.html`，History API 路径路由：
  - `/app/shell/` 首页；`/app/shell/m/<key>` 某模块。
  - 服务端对无扩展名的 `/app/shell/*` 回退到 `shell/index.html`（`portal_server.route` 的 `spa` 配置）。
- **embed 协议**（`mountEmbed`）：
  1. `fetch(<模块 url>/index.html)`，用 `DOMParser` 解析；
  2. 复制其 `<link rel=stylesheet>` / `<style>` 到壳 head；
  3. 注入 `<body>` 内容到容器，并把相对 `src` / `link href` 转为绝对模块路径；
  4. 设置 `<base href="<模块 url>">`（让运行期动态创建的相对资源也按模块解析）；
  5. 依次执行模块脚本：`type=module src` 用动态 `import`（带 `?embed=<ts>` 触发热重跑），classic `src` 用新建 `<script>`，内联脚本用 `textContent` 执行；
  6. 挂载方通过 `window.__iridescentlyEmbed`（容器）与 `window.__iridescentlyDispose`（卸载函数）对接壳。
- 切换模块时壳先调用 `embedDispose()` 再渲染新模块，避免循环/监听泄漏。

各模块的挂载实现：

| 模块 | 挂载/卸载 |
| --- | --- |
| cards | React `createRoot`（入口即挂载，无需改壳） |
| management | `main.js` 暴露 `window.__iridescentlyDispose = dispose` |
| ecology | `main.js` 的 RAF 循环加 `disposed` 闸门 |
| aeon | `main.js` 帧循环加 `__aeonDisposed` 闸门 |
| juling | 内联脚本包 IIFE，暴露 `window.__iridescentlyDispose` |
| slay | 渲染进 `#SlayTheWeb`（壳处理脚本与 base） |
| softie | `src/app.js` 导出 `mount(container)/unmount` |

## 构建管线

`server/app/scripts/build-modules.mjs` 把 `server/app/src/<名>` 构建/拷贝到 `server/app/modules/<名>`：

| 模块 | 方式 |
| --- | --- |
| management / ecology / cards / softie | Vite `--base /app/modules/<名>/` |
| juling / slay / aeon | 静态拷贝；slay 额外修正根绝对 `/ui/` 图标；`ui/images`（场景图 / 光标 / 小图标）为可选美术，来源由 `server/app/module-assets.json` 的 `slay.images` 或 `IRIDESCENTLY_SLAY_IMAGES_DIR` 指定，未配置时不带美术构建，缺图在页面中隐藏 |

`server/app/modules/` 为产物（gitignore），运行所需。

## 公用包

根 `package.json` workspaces 管理 `shared/*`：

- `@lxh/shared-ui`：设计系统（真身；`portal/huiguan/design-system/ui` 为反向 junction）。
- `@lxh/shared-types`：JSON 契约与校验。
- `@lxh/shared-data`：世界观只读事实。
- `@lxh/shared-session`：统一会话 / 存档 / 事件总线。

## 数据流（跨模块）

- 生态 → 主入口：`shared-types` 的 eco-harvest 包 + cards 的 exchangeQueue（IndexedDB）。
- 经营 ← 主入口：iframe 消息（现仍在 cards 内嵌 management/ecology 时用 postMessage）；统一壳下为同文档挂载，可逐步替换为直接的模块调用。
- 统一存档：`shared-session` 命名空间键，跨模块可读。

## 当前入口与发布边界（2026-10-25 审计）

- 正式域名由统一门户 `services/platform/portal_server.py` 按 Host / 路径分发；网站管家配置的主门户端口为 8080。域名映射以 `portal.json` 和外置网站管家清单为准。
- 构建候选位于 `.releases/candidate`，本机发布快照位于 `.releases/production/site`，服务运行目录位于 `.releases/runtime`。只有显式发布流程会提升候选；本机快照不等同于香港当前线上版本。
- `IRIDESCENTLY_PROJECT_ROOT` 当前指向 `E:\Projects`，部分 SQLite 数据、上传目录和共享媒体因而与源码仓库同根。它们被 Git 忽略不代表物理隔离；禁止对该树运行会清除 ignored files 的清理命令。
- 审计时香港发布控制器报告五个受管服务 active；本机未发现项目门户/应用服务进程。生产数据标记为香港权威维护，线上运行身份应以远端发布控制器为准。
- `server/app/src/cards/server.py` 从代码快照所在目录导入服务模块，而 `IRIDESCENTLY_PROJECT_ROOT` 用于数据路径；不要把工作区源码改动当成已部署代码。
- 统一壳中 `embed: true` 模块需实现 dispose；非 embed 试玩仍使用 iframe。共享会话、设计系统和类型契约的 canonical 目录是 `shared/*`。

审计时本机发布清单、香港当前版本指针和候选构建记录存在时间及提交来源差异。发布前必须记录同一候选的 Git SHA、dirty 状态、逐文件校验和以及线上激活版本，不能依赖旧的本机指针推断线上版本。详见 [环境隔离审计](architecture/ENVIRONMENT_BOUNDARIES.md)、根 README 与 [release-workflow](release-workflow.md)。
