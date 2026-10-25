# softie-webgpu

## 按任务定位
- Vite + 原生 JavaScript + Three.js，现有服务可用 TEST_URL 指定；不要为测试重复启动服务。
- 路由：src/app.js；首页：src/main.js、src/physics.js、src/slime.js。
- 灵体试验场：src/games/spirit-playground/view.js / controller.js / pointer-interaction.js。
- 可替换外观：spirit-instance.js、skins/softie.js；原 softie 模型在 src/slime.js，首页默认细分保留。
- 参数：settings.js；本机保存 API 在 server/spirit-settings.js，由现有 Vite 服务承接。
- 消消气已移除，不重新接入。

## 项目约束
- 首页状态保留，非活动场景停止真实渲染循环；渲染生命周期集中在 src/scene-animation.js。
- 保留原生 WebGPU 初始化和物理核心，不新增渲染通道或 WebGL 回退。
- 灵体皮肤可替换，所有可见部件跟随统一软体形变。
- 输入、失焦、捕获丢失和离开场景时清理 WASD 与抓取。
- 参数保存写统一外置存储的 data/spirit/spirit-settings.json；本机配置不纳入 Git。

## 验证
- 相关轻单测：node --test tests/<name>.test.js。
- 跨模块交付：npm test、npm run build、TEST_URL 指向已有服务后 npm run test:spirit。
- 首页受影响时 npm run test:browser；查看桌面与窄屏截图，说明性能门槛实际结果。
- 浏览器 GPU 验证串行运行，避免重复 Chrome 占用资源；不杀用户其它浏览器进程。
- 真实交互、参数保存刷新、导入导出、错误配置与路由暂停均需验收。

## 完成与边界
- 修复本次导致的问题，报告实际验证范围；不能把模拟触摸当作真机验证。
- 保留无关未提交改动；提交、推送、部署按用户授权执行。
