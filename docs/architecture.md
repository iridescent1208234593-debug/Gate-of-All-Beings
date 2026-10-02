# 架构

## 分层

```
浏览器
  └─ 统一入口 server/portal_server.py :8080   （按 Host / 路径分发）
       ├─ Host=huiguan.*        → portal/huiguan      （会馆，含账号/素材 API）
       ├─ Host=oc.*             → portal/oc           （人设站）
       ├─ Host=主域 /           → portal/www          （主站）
       ├─ 路径 /app/shell/*     → 统一壳（SPA，回退 index.html）
       ├─ 路径 /app/modules/<名>/* → 各游戏构建产物
       ├─ 路径 /shared/*        → shared/*（设计系统、会话等）
       └─ /app/modules/<名>/api/* → 反向代理到各游戏上游
```

各处理类由 `server/base_static.py` 的 `BaseStaticHandler` 派生，请求时按 `parse_request` 动态切换类；**每个 keep-alive 请求都会重新分发**（见 `Dispatcher.handle_one_request` 的 try/finally）。

## 统一壳（单 SPA，无 iframe）

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
| juling / slay / aeon | 静态拷贝；slay 额外修正根绝对 `/ui/` 图标并把 `ui/images` 联接到 `shared/shared-ui/AI image/images` |

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
