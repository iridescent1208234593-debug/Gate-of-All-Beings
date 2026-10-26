# 雾隐浅滩

众生之门内的轻量探索模式，入口 `#shore`，退出返回门庭 `#home`。迁自用户验收的 `E:\External Projects\original-ui-version\src\world-screen.js`；`shore-background.png` 是同一原型的 `src/media/bg.png`。本目录不包含原型开场和初始化流程。

- `ShoreMode.tsx` 是 React owner，读取 `PlayerProfileProvider` 的 Gate Identity，经 `getProfile` 注入场景。
- `world-screen.js` 保留三个灵息点、E 探索、J 日志、任务与本地进度；`dispose()` 中止 listener 并清除所有 timer。无 RAF、WebGL 或页面级字号修改。
- `shore.css` 只作用于 `.shore-mode`；不写全局 `html`、`body`、字体大小或通用组件样式。
- 存档键 `zszm.shore.v1:<kind>:<uid>`（匿名为 `zszm.shore.v1:anonymous`），位于同源 `sessionStorage`；记录三处节点、灵息和日志。该模式尚未接入云存档，不占用账号头像、OC、玩家身份或卡牌/经营存档。
- 模式读玩家形象但不修改身份，账户切换后重新挂载各自进度。保存失败时本次内存游玩仍可继续。

入口目录的已发布游戏数据继续由 `apps/shell/portal.json` 管理。新增成熟模块时修改该清单；不要在本模式复制另一份游戏注册表。
