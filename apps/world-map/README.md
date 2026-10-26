# 罗小黑世界地图模块

众生之门内置的 Three.js 环形世界地图，运行时由同域路径 `/app/modules/world-map/` 提供，并通过统一模块壳 `/app/shell/m/world-map` 打开。模块使用 iframe 隔离自身的全屏样式、WebGL 生命周期与键盘事件；运行时不依赖 GitHub Pages 或其他外部站点。

源码导入自 `aaabby-w/temp` 的提交 `81758f747fa0c038fe26a13e016d707ed8f317aa`。本目录保留运行所需的 TypeScript、矢量几何数据及字体许可；原始制图母版与生成脚本继续由上游项目维护。

## 构建与发布

```powershell
npm ci
npm run check:world-map
npm run build:world-map   # 单独检查本模块构建
```

本模块随 `npm run build:modules` 进入模块候选；与 `build:site`、`build:homepage` 候选一起经 `npm run release:seal` 封存为不可变 Release 后，再重启受影响的门户服务。修改 `portal.json` 或统一壳时同样走这一完整封存流程。
