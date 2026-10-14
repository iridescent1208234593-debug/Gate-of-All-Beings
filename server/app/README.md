# server/app · 统一前端壳与游戏模块

总览见根 [README.md](../../README.md) 与 [server/README.md](../README.md)。

| 路径 | 作用 |
| --- | --- |
| `shell/index.html` | 统一壳：History API 路径路由（`/app/shell/m/<名>`），七个 `embed: true` 模块挂入当前文档；非 embed 入口用独立浏览上下文；`<base>` 按模块基址解析相对资源；`window.__iridescentlyDispose` 统一卸载 |
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
| slay | 静态拷贝 | ✅ 挂载进 `#SlayTheWeb` |
| softie | Vite | ✅ `mount(container)/unmount` |

带 API 的模块经 `/app/modules/<名>/api/*` 反向代理到各自上游。

## 构建

```bash
node server/app/scripts/build-modules.mjs
```

构建只写候选目录，不覆盖运行中的 `modules/`。从根目录运行 `npm run build:modules`，验证后显式 `npm run publish:modules` 才更新生产资源；记录与回滚保护见 [发布流程](../../docs/release-workflow.md)。

## 路由与生命周期

`portal.json` 保存入口数据。统一壳处理快速切换时会取消旧请求，串行执行不可取消的 module import，并让旧 owner 清理自己的 dispose 回调、脚本节点与注入样式；同路由点击不重建模块。加载错误保留可操作的独立入口与导航。

众生之门内部的据点经营和生态仍通过 iframe 复用同一份已发布模块，并非整站都没有 iframe。不要删除这两份有效模块或相关路径。聚灵 API 上游独立运行，前台入口归入众生之门内部。

共享游戏导航使用路径 / hash 判断当前入口，不按 Host 同时高亮多个模块；在壳内所有导航节点和样式属于当前模块容器。
