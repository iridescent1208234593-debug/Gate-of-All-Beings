# 罗小黑世界地图模块

众生之门内置的 Three.js 环形世界地图，运行时由同域路径 `/app/modules/world-map/` 提供，并通过统一模块壳 `/app/shell/m/world-map` 打开。模块使用 iframe 隔离自身的全屏样式、WebGL 生命周期与键盘事件；运行时不依赖 GitHub Pages 或其他外部站点。

源码导入自 `aaabby-w/temp` 的提交 `81758f747fa0c038fe26a13e016d707ed8f317aa`。本目录保留运行所需的 TypeScript、矢量接缝数据、原图瓦片及字体许可；矢量制图母版仍由上游项目维护。

## 原图瓦片与坐标校准

`art-source/fantasy-world-map.jpg` 是上游已有的 8192×1900 原图，SHA-256 必须与 `atlas-regions.json.sourceSha256` 一致。运行时原图区使用无损 PNG 瓦片，不再依靠自动矢量化重画小岛。9216×1900 环形画布中右侧 1024 像素仍是既有的人工/AI 接缝补绘，不将它冒充原始地理设定。

瓦片有 2048、4096、8192 三个宽度级别，共 84 张，低级别提供底层，高清只加载视野需要的块；离开视野的高清纹理释放。每块保留相邻像素 gutter，避免插值接缝。最高级重建原图逐像素相同，无法凭空增加原图分辨率。

`map-coordinates.ts` 统一底图、节点和编辑器拾取坐标。红色参考点 07/08 经截图海岸配准修正为 `(2574,750)` 和 `(2389,842)`。西木会馆是独立命名点，不再把黑色 U24 改名；U24 恢复为未命名观测点。其他节点仍沿用原坐标，未宣称经过本次逐一人工复核。配准记录见 `art-source/node-calibration.json`。

重新生成与验证（Python 需要 Pillow；Node 22+ 使用 strip-types 运行坐标测试）。`npm run check` 同时运行类型、坐标和瓦片校验，现有 World Map CI 检查会执行它们：

```sh
python3 scripts/build-tiles.py
python3 scripts/test-tiles.py
node --experimental-strip-types --test scripts/coordinates.test.mjs
npm run check
npm run build
```

修改地图底图时必须重新校准节点、更新接缝来源并重建瓦片，不能只修改宽高常量。新增文件均为地图源码/资源；部署仍走原有候选发布流程，Git 修改或本地构建不代表生产已更新。

## 构建与发布

```powershell
npm ci
npm run check:world-map
npm run build:world-map   # 单独检查本模块构建
```

本模块随 `npm run build:modules` 进入模块候选；与 `build:site`、`build:homepage` 候选一起经 `npm run release:seal` 封存为不可变 Release 后，再重启受影响的门户服务。修改 `portal.json` 或统一壳时同样走这一完整封存流程。

## Map reading layout

The map now uses a fixed header, a map viewport and a separate location dossier. On narrow screens the dossier collapses below the map; the hall index scrolls horizontally. Map dimensions continue to come from `#screen` via `ResizeObserver`, not the window.

- Light and dark palettes share paper, ink, jade and brass tokens in `src/style.css`. Theme preferences still use the shared `XTheme` service.
- Hall descriptions keep their authored text in `nodes.ts`; the view separates paragraphs and member lists. Coordinates are available under “查看坐标”.
- “显示与工具” contains theme and coordinate-copy tools. Escape or clicking outside dismisses the menu. No server write is introduced.
- Node positions, tile assets, source registration and rendering geometry are unchanged. “总览” restores the initial view and its matching selected dossier.

For UI checks, build this module and serve its `dist/` at `/app/modules/world-map/`, with `packages/shared-ui/theme.js` served at `/shared/shared-ui/theme.js`. Check desktop and narrow widths, both themes, long descriptions, node/rail selection, drag, zoom, keyboard navigation and the collapsed dossier. Physical-device pinch gestures and the authenticated host shell should also be checked before release.
