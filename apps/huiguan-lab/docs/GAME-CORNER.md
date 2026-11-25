# 会馆小游戏 · 守滩与网页门牌

## 试玩

- 登录 LAB 并完成形象，从顶栏「小游戏 → 省省海滩射击 · 在 LAB 游玩」进入。也可在 Godot 编辑器打开 `client/scenes/beach_shoot.tscn`，按 F6 单独启动，不需登录。
- 敌人从右侧沿几条路线逼近左侧防线。漏一个减一格防线；撞到玩家扣体力。走位时自动单发，按住空格或点「定身散射」时停步三发。移动能解除触屏定身。
- 键盘用 WASD / 方向键，也可点地面或触屏拖动。离开应用自动暂停。每波结束选一项加成，三波守完结算；可立即重打或返回会馆。
- 这是省省射击的 LAB 改编：保留横向来敌、三路散射，加入守线、波间构筑和最终守潮灵。守潮灵会在玩家脚下留出预警圈，需要解除定身躲开。使用 LAB 自带默认角色和程序绘制素材，未打包或运行被恢复的原游戏文件。网站原试玩仍可打开。
- 最高击退数存于 `user://beach_shoot_v1.cfg`，按设备/浏览器，不按账号，不发奖也不上榜。雾隐浅滩仍是原来的互动教程，两者不共享局内状态。

## 网页门牌

众生牌录、重生之门、经营、聚灵、生态、灵体互动、AEON、世界地图和原射击试玩仍使用各自的网站实现。LAB 门牌在新标签或系统浏览器打开官方默认根站点，不附带 LAB 账号、会话、OC 或存档；站点登录和站点存档仍按原有规则。灵体互动仍有 WebGPU 要求。没有改业务服务器、WebSocket 协议或数据库。

- `client/data/web_games.json`：LAB 内分组、门牌文案和既有门户模块 key；不定义域名或模块入口。
- `client/data/web_game_routes.json`：生成物。从 `apps/shell/portal.json` 核对发布模块，从 `packages/site-domains/domains.json` 解析官方默认根；卡牌、经营、生态用 `apps/cards/src/game/MODES.md` 记录的同页入口。不要手改生成物。
- 门牌改动后运行 `python apps/huiguan-lab/scripts/generate-web-game-links.py`（仓库根）。加 `--check` 可只检查，不写文件。客户端不需要新网关就能使用入口。

本轮未把旧 LAB 独立副本的棋桌、萤火接力或夜巡疑云直接覆盖进账号候选；它们是另一条源码线上的联机玩法，不是 zszm 的网页模块。

## 验收

从 `apps/huiguan-lab` 执行（`godot` 可换成本机的 Godot 4.7.2 可执行文件）：

```text
godot --headless --path client --editor --import
godot --headless --path client --script res://tests/test_beach_shoot.gd
```

实机补测：横屏、竖屏触控，短屏上升级面板滚动，三个波次难度，浏览器新标签，回到会馆后位置及 2D/3D 视图未变化。用原先保存过进度的浏览器打开牌录或经营，核对进度仍由原站恢复。测试和试玩不需要发布、改 DNS 或接真实存储。

网站门牌使用 LAB 线上所在的 .cn 根域；不改变全站默认域名或登录回调配置。
