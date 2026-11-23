---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_c9d8cf27a0e211f1a65b525400826444
    ReservedCode1: GNVYihS7DhNLlAMAm3pgyH2U9lBeKAymYLJrbJzxDAULdbaxrl7ba4B1nihyTrPj6fegJCmGOkevIB8YUlYFCFg9U4XNGVzJx23w4rvjCG3w+cyX+dyvrpiwfCnyT3DKXOEZV7Znu288lbl+8zNg430A6ZzasCz17rCqhdDlvSVYdrDU2DFZd9/79Vs=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_c9d8cf27a0e211f1a65b525400826444
    ReservedCode2: GNVYihS7DhNLlAMAm3pgyH2U9lBeKAymYLJrbJzxDAULdbaxrl7ba4B1nihyTrPj6fegJCmGOkevIB8YUlYFCFg9U4XNGVzJx23w4rvjCG3w+cyX+dyvrpiwfCnyT3DKXOEZV7Znu288lbl+8zNg430A6ZzasCz17rCqhdDlvSVYdrDU2DFZd9/79Vs=
---

# 灵境会馆（Lingjing Huiguan）

新成员完整环境、非生产存储、启动/停止命令和实测矩阵见[本地开发环境与启动矩阵](../../docs/development/local-onboarding.md)。

《罗小黑战记》世界观 · 灵质空间经营模拟（网页端 Demo）

## 技术栈

- 纯 JavaScript ES Modules + Canvas 2D
- Vite（开发服务器 / 构建）
- 单向数据流：Action → reducer → GameState → 渲染

## 核心设计

- 固定 tick 模拟：4 tick/秒（250ms），每帧 requestAnimationFrame 渲染
- 变速：1x / 2x / 3x（倍速加速 tick 推进），可暂停
- 模块分层：
  - `src/ui`       UI 层（HUD / 建造面板 / 小妖列表 / 事件日志）
  - `src/render`   渲染层（Canvas 2D 绘制）
  - `src/core`     核心层（gameLoop / reducer / gameState / eventSystem / actionTypes / util）
  - `src/systems`  模拟子系统（spiritSpace / colonist / jobAI / building / combat / tech / relations / expedition / dailyReport）
  - `src/content`  内容数据层（纯数据：建筑 / 小妖 / 五行 / 工作 / 需求）

## 已实现（M0 + M1 + M2 + M3）

- 工程骨架与分层装配（main.js 组装单向数据流）
- 灵质空间基地本体：24x16 网格、灵质池再生、祭坛自动产出、地块占用校验
- 小妖系统：五行御灵系（金木水火土，各带工作/衰减加成）、5 项需求条（灵质/饱食/睡眠/社交/领地感）、心情红黄绿脸（加权评分）
- 建造：放置校验（资源/边界/占用）、拆除返还 50%、建筑数据与工人槽位
- 基础经营循环：需求衰减 → jobAI 按最低需求派活 → 小妖移动到建筑工作 → 产出资源/恢复需求 → 自动进食
- 种植/收获（M2）：灵田（farmland）+ 灵谷/灵草作物，farming 子系统推进生长进度、优先收获/补种，工作完成按作物产出资源并复位灵田，渲染层绘制作物进度条
- 随机事件（M2）：content/events.js 定义 6 种事件（灵质潮汐/野味串门/灵泉涌出/妖气缠身/妖兽夜袭/不速之客），randomEvents 子系统按权重概率触发、buff/debuff 即时或驻留结算、attack 型事件调起战斗，事件日志可见
- 袭击战斗（M2）：content/enemies.js 定义 4 种妖物（木兕/石妖獾/妖面蛛/狼妖），combat 子系统生成敌人潮、小妖轮战，五行相克（金克木、木克土、土克水、水克火、火克金）计算伤害倍率，小妖新增 hp/maxHp，胜利掉落灵质、失败被劫掠扣资源，渲染层绘制敌人标记与血条
- 研究科技（M2 + M3）：content/research.js 共 11 项研究（聚落时代 5 项：御灵启蒙/五行共鸣/仓库技艺/守望结界/会馆雏形；结盟时代 3 项：结界加固/法器锻造/人妖外交；会馆时代 3 项：传送阵/信息中枢/聚灵工业化），tech 子系统在小妖于研究台工作时推进进度，完成解锁新建筑；灵田/研究台默认可建，其余需研究解锁
- 存档读档（M2）：systems/saveGame.js 基于 localStorage 存读档（含版本校验），页面启动自动读档，UI 提供存档按钮
- 仓库上限（M2 + M3）：基础灵质/食物上限 400/300，每座灵仓 +200/+150/+法器+50；五行碑（wuxingbei）全员需求衰减放缓，结界石（jieshishi）降低随机事件/袭击触发概率
- 时代体系（M3）：content/eras.js 定义三时代（聚落 tribal→结盟 alliance→会馆 hall），跃迁条件=关键研究+建筑数+事件/声望，reducer 新增 ERA_ADVANCE，满足条件顺次跃迁并写日志
- 新建筑（M3）：结界塔（防御被动）、锻造坊（forge 产出法器）、传信塔（diplomacy 提升人类聚落声望+2）、传送枢纽（被动，解锁远征）、信息中枢（被动）；法器（faqi）资源加入存储上限体系
- 人类聚落关系（M3）：systems/relations.js 维护 settlements（默认「兴国边村」rep30），每 50 tick 声望衰减 0.5、声望>=80 自动结盟、声望>=50 每 100 tick 进贡（灵质+10 食物+5）
- 远征（M3）：systems/expedition.js 三阶段 tick 驱动（行路 60→目标事件 30→归途 60），需传送枢纽与 2~5 只小妖、单队限制；成功率 70%，成功灵质+50 声望+10，失败小妖 hp-30 声望-5
- 时代切换 UI（M3 第二批）：时代面板显示当前时代与三时代 tab，查看未来时代展示跃迁条件明细（研究/建筑/事件/声望），满足时显示「跃迁至」按钮并派发 ERA_ADVANCE，不满足时逐项标记缺失
- 关系面板 UI（M3 第二批）：人类聚落列表渲染名称/声望条/结盟标记/进贡状态（可进贡/冷却中/进贡中），随 tick 定时刷新
- 远征界面 UI（M3 第二批）：远征面板展示当前队状态（阶段/进度百分比/队员）、勾选 2~5 只空闲小妖并输入目标名派发（EXPEDITION_START），进行中禁止再派发，归来后展示凯旋/受挫日志
- 新建筑渲染与建造（M3 第二批）：结界塔/锻造坊/传信塔/传送枢纽/信息中枢按既有色块+图标风格绘制，建造面板全部新建筑可锁定/解锁，forge/diplomacy 工作进度条随工人推进
- 信息中枢日报（M3 第二批）：systems/dailyReport.js 在中枢建成后每 100 tick 生成汇总日志（灵质/食物/法器、小妖心情分布、建筑数、最高声望、远征状态），写入 eventLog
- HUD 法器显示（M3 第二批）：顶栏资源条新增法器 pill，与灵质/食物同排实时刷新

## 启动

```bash
npm install
npm run dev
```

默认端口 5179（被占用时 Vite 自动顺延 5180/5181...）。

## 验证

```bash
npm run verify          # 端到端主循环验证（长模拟 + 极端场景）
npm run verify:core     # 核心层（reducer / gameLoop / gameState / eventSystem）
npm run verify:content  # 内容数据层
npm run verify:spirit   # 灵质空间
npm run verify:colonist # 小妖系统
npm run verify:jobai    # 工作 AI
npm run verify:building # 建造系统
npm run verify:farming  # 种植/收获子系统（M2）
npm run verify:events   # 随机事件 + 袭击战斗（M2）
npm run verify:research # 研究科技 + 存档读档 + 仓库上限 + 被动建筑（M2）
npm run verify:m3      # M3 时代跃迁：时代体系 + 研究树 + 新建筑 + relations + expedition（新增）
npm run verify:m3-ui   # M3 第二批：时代面板数据绑定 + 信息中枢日报 + 远征派发流转 + 2000 tick 回归
npm run verify:e2e     # M0+M1 浏览器端到端（playwright，dev server 5179）
npm run verify:e2e:m3  # M3 第二批 UI 浏览器冒烟（时代/关系/远征面板 + HUD 法器，无 JS 报错）
npm run verify:stubs   # 里程碑标记：combat/tech/relations/expedition 已实现（M2+M3）
```

验证脚本位于 `temp/`，通过 `pathToFileURL` 动态 import 源码模块，在 Node 中做功能级验证。
*（内容由AI生成，仅供参考）*

---

## 在统一工作区中的位置

> 本仓库位于统一工作区 `apps/management/`。总览见 [根 README](../../README.md)，架构/数据库/API 见 [docs/](../../docs/)。

- 运行：`npm run dev`（5179）。
- 构建挂载：Vite base `/app/modules/management/`；统一壳内挂载，卸载用 `window.__lingjing.dispose`。
- 存档：统一存档（`@lxh/shared-session`）+ 会馆云存档 `/api/game/save|load`。
- 测试：`npm test`。

### 固定 tick 长程回归

运行 `npm test --prefix apps/management`；目前没有 Management 的 `npm run verify` 入口。单独运行：
`node --test apps/management/tests/long-run.test.js`。测试使用临时内存状态，以固定种子 38491
执行同一组动作及 5,001 个 reducer tick 两次；逐 tick 检查资源、建筑占用、人口需求和生命值、科研、
事件、远征及游戏时间，并对完整轨迹作比较。测试还独立检查时代进阶的门槛，不依赖一个固定种子恰好升级。

地形生成器有自己的种子工具；当前运行时的实际初始资源点和性格、闲逛和精神状态、随机事件和战斗、
空间扩张和资源再生、远征目标与结算仍消耗 `Math.random`。测试仅在同步回放范围内临时用项目的
`createRng` 替换这个来源并恢复原函数。因此结果验证的是同一随机序列驱动的 reducer 轨迹，
不保证默认浏览器、生产存档恢复、渲染帧率或不同引擎间的可重放性；本测试不改变运行时随机来源、
存档格式或游戏数值。`Date.now()` 的存档时间戳和 RAF 时序不在此回归范围内。
