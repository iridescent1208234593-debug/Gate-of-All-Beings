# 经营 3D 实施与接续记录

更新：2026-09-28。分支：`feat/isometric-three-renderer`。上一轮基线：`a34c0bb`。

## 当前实施

- `src/main.js` 改装配 `render/threeRenderer.js`，旧 Canvas 2D 源码仍在 `render/renderer.js`、`drawBase.js`、`drawColonists.js`，不再进入现役渲染路径。
- 正交相机俯角和方位角均为 45°；存档 x/y 精确映射 Three.js X/Z。地块、建筑、资源点、居民、敌人均读取原游戏状态。
- 单击选择/建造，拖动平移，滚轮或双指缩放；支持方向键、加减键和 Home。拖动、双指和取消手势不会误触建造。
- 保留居民 AI、建筑施工、资源、科技、配方、远征、时代和原存档。修复扩地后建筑占格仍使用旧宽度的问题。
- `ui/management.css`、`managementShell.js` 使用共享 lxh 样式及图标。窄屏通过“营造”“小妖”按钮展开面板。
- `systems/hubBridge.js` 接收同源父页收获并在保存后确认。容量不足保留整批；普通经营进度每 15 秒自动保存，切换模块/离开页面时保存。原存档无法读取时保留原数据，不自动覆盖。
- `assembly/` 保留开场实验模型，入口为“合成 → 灵体拼装 · 实验室”。支持形态预览、参数修改、草稿存取与 JSON 导出；这些模型没有用于 zszm 开场或替换经营居民。
- GPU 几何体/材质、输入事件、观察器及循环在退出时释放；渲染器独立于业务 reducer。

## 验证与入口

`npm test`：6 项通过，覆盖旧生态入库、45° 相机适配、所有建筑模型、扩地建造和存档续跑、触控防误触、库存不足原子拒绝。

`npm run build` 及 zszm 总构建通过；Three.js 构建块超过 500 KB 的提示仍存在。浏览器验证脚本及截图在 `server\app\src\cards\scripts\verify-integration.mjs`、`server\app\src\cards\docs\verification`。

独立开发：`npm run dev`（原端口 5179）；统一入口：在 zszm 运行 `npm run dev`，首次会先构建两个子模块。经营源码修改后，需在 zszm 执行 `npm run build:modules` 更新嵌入副本。

## 工作归属

独立会话 `01a0e79a-6cbc-7390-9d98-7b751955c57b` 完成了渲染器与主要界面源码后因额度限制结束，未完成验收。源会话已核实其停止，并接管后续拼装、交换接口、保存、测试与浏览器验证；当前没有两个会话同时修改本工程。

用户最新决定：zszm 开场恢复原 SVG 挤出薄片，实验球体只在此拼装实验室暂存。后续如改模型，不能据旧目标重新替换开场。
