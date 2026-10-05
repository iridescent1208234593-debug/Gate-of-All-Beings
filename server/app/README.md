# server/app · 统一前端壳与游戏模块

总览见根 [README.md](../../README.md) 与 [server/README.md](../README.md)。

| 路径 | 作用 |
| --- | --- |
| `shell/index.html` | 统一壳：History API 路径路由（`/app/shell/m/<名>`），7 游戏全部内嵌，无 iframe；`<base>` 按模块基址解析相对资源；`window.__iridescentlyDispose` 统一卸载 |
| `portal.json` | 门户清单（站点/游戏分组、URL、图标、`embed` 标记），导航唯一数据源 |
| `scripts/build-modules.mjs` | 把 `src/` 下各游戏构建/拷贝到 `modules/` |
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
