# server/app · 统一前端壳与游戏模块

总览见根 [README.md](../README.md) 与 [services/platform/README.md](../services/platform/README.md)。

| 路径 | 作用 |
| --- | --- |
| `shell/index.html` | 统一壳：History API 路径路由（`/app/shell/m/<名>`），七个 `embed: true` 模块挂入当前文档；世界地图等非 embed 入口用同域 iframe 隔离；`<base>` 按模块基址解析相对资源；`window.__iridescentlyDispose` 统一卸载 |
| `portal.json` | 门户清单（站点/游戏分组、URL、图标、`embed` 标记），导航唯一数据源 |
| `scripts/build-modules.mjs` | 把 `src/` 下各游戏构建/拷贝到 `.releases/candidate/modules/`，同时生成首页候选 |
| `src/<名>/` | 游戏源码（由项目根目录 Git 统一管理） |
| `modules/<名>/` | 构建产物（gitignore，运行所需） |

## 模块与挂载方式

| 模块 | 构建 | embed（无 iframe） |
| --- | --- | --- |
| cards | Vite（base `/app/modules/cards/`） | ✅ React `createRoot` |
| management | Vite | ✅ `window.__lingjing.dispose` |
| ecology | Vite | ✅ 停止 RAF 循环 |
| juling | 静态拷贝 | ✅ 内联脚本包 IIFE + 卸载 |
| aeon | 静态拷贝 | ✅ 停止帧循环 |
| world-map | Vite | ❌ 同域 iframe 隔离全屏 WebGL 与事件生命周期 |
| slay | 静态拷贝 | ✅ 挂载进 `#SlayTheWeb` |
| softie | Vite | ✅ `mount(container)/unmount` |

带 API 的模块经 `/app/modules/<名>/api/*` 反向代理到各自上游。

## 构建

```bash
node tools/build/build-modules.mjs
```

构建只写外部 Release 根的候选目录，不覆盖任何运行中的 Release。从根目录运行 `npm run build:modules`，与 site、homepage 候选一起经 `npm run release:seal` 封存后才可运行；记录与回滚保护见 [发布流程](../docs/release-workflow.md)。

## 前端缓存策略与回退

`/app/modules/` 下**未带内容哈希**的 JS / CSS（如 `slay/ui/cards.js`、`slay/service-worker.js`）默认返回
`Cache-Control: no-cache, max-age=0, must-revalidate`：浏览器和 Cloudflare 每次先向源站验证（`Last-Modified` 命中则 304），
所以切换到新 Release 之后用户下次打开即是新版，不必再手动清 CDN。Vite 带哈希的 `/assets/*-xxxxxxxx.js` 仍是一年 `immutable`，图片、字体缓存不变。
实现：`services/platform/portal_server.py` 的 `MODULE_CODE_MAX_AGE` 与 `services/platform/base_static.py` 的 `code_max_age`。

**回退到旧的 4 小时缓存**（出现带宽/回源压力时）：给门户进程设环境变量后重启，不需要改代码。

```powershell
$env:IRIDESCENTLY_MODULE_CODE_MAX_AGE = "14400"   # 秒；0 或不设 = 每次验证（默认）
# 然后按现有方式重启 portal_server.py（8080），不要动 5194 / 5195
```

回退后每次发布需在 Cloudflare 手动清缓存（Caching → Purge Cache → Custom Purge，前缀 `zszm.iridescently.xyz/app/modules/` 与
`iridescently.xyz/app/modules/`），或等缓存过期。要完全撤销本策略，删除 `portal_server.py` 里设置 `code_max_age` 的那一行即可。

注意：改动需要重启门户进程后才生效；Cloudflare 的 Browser Cache TTL 若设为"覆盖源站"，仍会把 `no-cache` 改写成固定时长，需在面板里改为 *Respect Existing Headers*。

## 路由与生命周期

`portal.json` 保存入口数据。统一壳处理快速切换时会取消旧请求，串行执行不可取消的 module import，并让旧 owner 清理自己的 dispose 回调、脚本节点与注入样式；同路由点击不重建模块。加载错误保留可操作的独立入口与导航。

众生之门内部的据点经营和生态仍通过 iframe 复用同一份已发布模块，并非整站都没有 iframe。不要删除这两份有效模块或相关路径。聚灵 API 上游独立运行，前台入口归入众生之门内部。

共享游戏导航使用路径 / hash 判断当前入口，不按 Host 同时高亮多个模块；在壳内所有导航节点和样式属于当前模块容器。

PC 新版的 `/app/shell/m/<key>` 必须回到 `apps/shell/index.html`，不能使用 `server/app/index.html`。所有玩法仍由同一 `portal.json` 和既有模块壳加载。错误页统一提供换服务器、重新加载、返回门庭，保留真实 HTTP 状态；API 与静态资源错误不替换成游戏页面。共享组件规则见 [server-recovery.md](../packages/shared-ui/server-recovery.md)，本轮验收和待发布状态见 [报告](../docs/access-and-bandwidth-20261019.md)。
