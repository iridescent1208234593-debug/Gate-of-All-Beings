# 罗小黑世界地图模块

众生之门内置的 Three.js 环形世界地图，运行时由同域路径 `/app/modules/world-map/` 提供，并通过统一模块壳 `/app/shell/m/world-map` 打开。模块使用 iframe 隔离自身的全屏样式、WebGL 生命周期与键盘事件；运行时不依赖 GitHub Pages 或其他外部站点。

源码导入自 `aaabby-w/temp` 的提交 `81758f747fa0c038fe26a13e016d707ed8f317aa`。本目录保留运行所需的 TypeScript、矢量几何数据及字体许可；原始制图母版与生成脚本继续由上游项目维护。

## 构建与发布

```powershell
npm ci
npm run check:world-map
npm run build:world-map
npm run publish:world-map
```

全模块发布时，`npm run build:modules` / `npm run publish:modules` 也会包含本模块。修改 `portal.json` 或统一壳后，另按正式流程执行 `build:site` / `publish:site` 并重启受影响的门户服务。
