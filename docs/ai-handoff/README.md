# 众生之门 · 共同旅途数据合并

更新：2026-10-19。状态：**已实施于本地源码与 Cards 候选，未发布**。

目标是让小游戏成为同一游戏中的不同玩法。本轮把入世历练与重生之门接到同一角色资料、资源账本和玩法存档层；其他小游戏按本文的通用接口接入，不需要再次建立一套账户、角色表或资源余额。

## 已落地的范围

| 数据 | 统一落点 | 当前接入 |
|---|---|---|
| 角色事实与稳定 ID | `shared/shared-data/catalog.js`、`worldview.json` | Cards 角色名、万灵志、Slay 角色总册/详设/敌人资料/配图 |
| 演武平衡数据 | `shared/shared-data/arena/character_stats.json`、`decks.json` | 439 名有效角色的模型数值与卡组；共同旅途展示战力，两个战斗引擎继续使用各自的战斗尺度 |
| 灵卡目录 | `shared/shared-data/cards-data.js` / `cards.json` | 98 个 Cards 定义 + 70 个 Slay 定义，保留原生效果与 Slay 升级结果 |
| 资源、角色进度、玩法快照 | `shared/shared-session/game.js` → IndexedDB `iridescently-game-v1` | Cards 全存档；Slay 局内档案、魂灵、修行、图鉴、成就、结局等命名空间 |
| 对局结算与记录 | 同库的事务回执、profile.recent | 重生之门结算回流公共资源；统计页读取本项目记录 |
| 玩家可见入口 | Cards 门庭资源栏、`#journey` | 共享余额、角色名册、跨模式灵卡、共同旅途导出；Slay 开场也显示公共灵质与草药 |

角色名册展示可查阅角色，不代表 439 名角色都已经实现可操作的英雄技能。当前入世历练仍有原有三名可选同行者。各模式的战斗引擎、地图和局内状态格式继续由该模式维护。

## 角色主参考与本次合并结果

核心参考是 `assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db` 的世界观数据。本轮通过现有受限 SSH 的 **`assets-export` 只读命令**取得香港参考资料快照，在 `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/qa/cards-unification/hk-reference-20261019/library.sqlite3` 重建离线参考库后生成共享数据；没有向香港写库。

| 核对项 | 结果 |
|---|---:|
| 香港 `characters` 源记录 | 488 |
| `merged_to` 已合并旧记录 | 49 |
| 有效角色 | 439 |
| 匹配成功的详设角色 | 133 |
| 未能唯一匹配的详设记录 | 0 |
| 同一角色详设字段差异 | 1（角色 9，保留来源行与两种原文供复核） |
| 具备当前香港保留媒体引用的角色 | 230 |
| 香港 `images` 记录 | 1111 |
| `配音演员山新*` 图片记录 | 0 |
| 无角色主体的能力记录 | 1（旧 character_id=145） |

439 是有效角色数；488 是包含已合并记录的源表总行数。49 个旧 ID 通过 `redirects` 指向有效角色，名称/别名匹配只接受唯一结果，规范名称优先于别名。无法确认归属的能力不分配给其他角色，原记录列入 [consolidation.json](../../shared/shared-data/consolidation.json)，香港数据库原样保留。

SQLite 的 `character_stats` 表为空。HP、攻击、防御、稀有度、境界和 power 来自恢复的六系演武生成模型，属于游戏设定。模型与脚本从 `431f167^` 中按需恢复到 `shared/shared-data/arena/`，没有恢复旧项目入口或 UI。生成器按有效 ID 合并能力资料，剔除悬空引用并报告，图片不再从本机目录按名称猜选。

六种能力系（御灵、生灵、造物、空间、心灵、锁御）与五行是两个轴。历史演武的 `jin/mu/shui/huo/tu/kongjian` 是一组六维游戏指标，不能作为原作的六种能力系枚举。

导出记录角色资料哈希、模型/脚本哈希、香港媒体清单哈希。配图只引用当前快照媒体清单中保留的角色图库记录，经会馆 `official/img-id` 接口取图，不复制旧 Slay 本地立绘作为回退，也不发布磁盘绝对路径。没有合格引用的角色保留无图状态。

数据库元信息含社区资料来源；共享数据保留来源链接，游戏推导值有独立标签，不把所有入库描述都宣称为已由官方验证。

## 正式数据接口

### 角色

```ts
import {characters,characterById,characterByName,characterFor} from '@lxh/shared-data/catalog.js';

characterById(1);                 // 有效记录；旧 ID 自动跳转
characterByName('罗小黑');        // 规范名优先；歧义别名返回 undefined
characterFor('zszm','xiaohei');    // 使用 DB character_id_map 的显式对照
```

记录包括稳定 `id`、名称/别名、种族/阵营、能力原文、摘要、来源、详设 `profile`、可选 `imageRef` 和独立 `balance`。完整类型在 `shared/shared-data/catalog.d.ts`。仅需 ID/名称校验的代码使用轻量 `identities.js`，完整人物描述与灵卡册延迟加载。

Slay 的 `character-roster.js` 只选择核心/补充展示组；`characters-full.js` 与 `character-profiles.js` 不再保存第二份角色事实。世界观敌人与 DB 角色精确匹配时带 `characterId`，原创敌人继续作为该模式的原创内容保管。

### 灵卡

```ts
import catalogue from '@lxh/shared-data/cards-data.js';
// id / mode / sourceId / name / characterId / cost / type / text / element / school
// native: 原生结算字段；upgrade: Slay 升级后定义（若有）
```

`id` 为 `cards:<原ID>` 或 `slay:<原卡名>`。跨模式同名卡保留两个来源 ID，例如两张「金刃」；不能用名称覆盖存档中的另一张卡。图鉴统一检索，结算交由原生引擎。没有把 Slay 自定义 action、演武系数/穿透等语义强塞入 Cards 的 18 项 Effect，也没有自动替换玩家牌组。动态生态个体仍由现有兑换协议生成，不计入 168 个基础定义。

### 共同进度

```ts
import {openMode,commitMode,transact,readGame,exportGame} from '@lxh/shared-session/game.js';

const session = await openMode('my-game', legacySnapshot, {spirit:legacySnapshot.spirit}, {});
// 读取 session.record.snapshot；将该玩法管理的资源显示值覆盖为 session.profile.resources 对应余额。
const saved = await commitMode('my-game', nextSnapshot, {
  revision:session.record.revision,
  resources:{spirit:nextDisplayedSpirit},
  characters:{1:{discovered:true}},
  operationId:crypto.randomUUID(),
});
// 下一次保存使用 saved.record.revision。

await transact('my-game', {
  id:'reward:stable-run-id',       // 同一结算重试必须使用同一个 ID
  resources:{spirit:5},
  summary:'本局探索完成',
});
```

- `profile.resources` 是公共余额：`spirit`（灵质）、`herb`（草药）、`food`、`soul`、`shards`。局内金币、灵力等继续留在各模式快照中。
- `profile.characters[characters.id]` 保存已结缘、羁绊、封灵、伤势/陨落与复活时刻；牌组等模式专属状态保留在玩法快照。
- `mode:<玩法key>` 保存完整版本化 snapshot、该模式的资源基线、revision 和更新时间。模式编号不限于 Cards/Slay；新增小游戏使用自身稳定 key 即可。
- 首次 `openMode` 只迁入一次旧余额；以后读取公共余额并重设该模式的资源基线。`commitMode` 按基线差额变动公共余额，快照/资源/角色进度在同一 IndexedDB 事务里提交。
- 资源不足、非法角色字段、格式不兼容或 revision 冲突会中止整个事务。其他窗口已更新同一玩法时，旧窗口不能覆盖它。
- `transact` 用持久回执去重，处理跨玩法奖励或消费。并发小游戏通过 IndexedDB 串行写账本；禁止直接覆盖另一玩法的资源余额。
- `exportGame` 包括完整模式快照与去重回执。当前提供导出，尚未提供通用导入 UI。

## 两种卡牌玩法的迁移与联动

**入世历练：** `storage.ts` 优先读取统一模式槽。首次读取旧 `zszm-adventure-v1/saves/current` 时校验并迁入；迁入后从统一库读写完整存档。原 IndexedDB 仅作为恢复来源保留，摘要 `m:cards:summary` 不具备覆盖主存档的权力。返回页面时等待保存结束再刷新共享进度。

**重生之门：** `game/shared-progress.js` 启动时迁入已有 localStorage / `unifiedStorage('slay')` 键，并检查原生数据与统一快照的冲突。同步界面继续读写原生缓存；每次修改先持久保存待写操作，再串行写统一槽。刷新/崩溃后重放待写记录，已完成操作凭回执不重复计入余额。离开模块时等待待写队列；其他写窗口通过 Web Locks 拦截。存在冲突或损坏时保留两份资料并显示导出入口。

旧 localStorage 键保留用于恢复；清除已迁移存档使用 tombstone，避免清除后又从旧键复活。共享 KV 配额失败/损坏不再静默宣称保存成功；同源同页和其他页面都能收到状态通知。

重生之门通关带回 **20 灵质 + 2 草药**，散灵带回 **5 灵质**；魂灵与修行残片也进入公共余额。这是本轮明确新增的游戏结算规则。稳定 run ID 同时保护原有魂灵结算和公共奖励，重新渲染、刷新或重试不会重复发放。入世历练的五小时复活规则沿用；Slay 的原创修行者不会被擅自当作某位官方角色施加伤势。

`game/backend.js` 已改为本地对局记录；统计页使用公共记录格式。审查发现原第三方接口实际仍被统计页和控制台调用，现已移除这些第三方读写。

实际页面验证还发现 Slay 入口硬依赖外站 Flip 模块，离线或外站失效时整页无法启动。现改用项目已经声明的 GSAP 3.11.0 同版本 `Flip.js` 与 matrix 工具，版权头和包哈希保留在 `web_modules/gsap/FLIP-PROVENANCE.md`，不再依赖该外站脚本启动。

## 后续战斗引擎收敛：弃用重生之门旧实现

2026-10-19 用户反馈：重生之门偶发首次进入后手牌无法交互，只能点下一回合。代码中 `ui/app.js` 的 `dealCards()` 同时负责发牌动画、回合音效和 `enableDragDrop()` 交互绑定；进入房间、恢复对局和结束回合都会调用它。下一回合会重新绑定交互，与反馈现象吻合，但目前尚未复现并确定根因，不能将问题直接归因于动画、音频或存档。本次已有的启动/续玩检查也不能证明首回合出牌正常。

后续合并方向：以入世历练的 `core` 战斗逻辑为共同实现，将重生之门作为同一游戏中的轮回玩法；完成替代后删除 Slay 的旧战斗引擎和手牌交互实现。当前仍运行两套引擎，这一节是收敛方案，尚未完成替换。

| 项目 | 处理方式 |
|---|---|
| Slay 的动作队列、战斗状态、Preact 战斗界面、GSAP 拖拽出牌 | 由共同战斗逻辑与界面替代，替代验证后删除旧实现及其专属依赖 |
| 70 张原生卡与升级效果 | 迁成共同引擎的声明式定义；逐项核对目标、效果顺序、条件、持续状态和升级语义，缺少的实际机制在共同引擎实现 |
| 剧情、事件、敌人、法宝、天赋、修行与结局 | 审查后迁为轮回玩法的数据和规则；官方角色事实继续引用 DB 稳定 ID，游戏推导规则单独标识 |
| 魂灵、残片、图鉴、成就等长期进度 | 沿用已迁入的共同进度与稳定回执，迁移不得再次发放已有奖励 |
| 旧版未完成对局 | 单独定义有版本的转换方案；旧快照不能直接作为入世历练 `RunState` 读取。尚未支持的字段不得静默丢弃或伪称已恢复 |

实施顺序：先迁出旧内容定义并补齐共同引擎需要的机制，再接入轮回入口和旧档转换，验证首回合、续玩与结算后删除旧运行代码。`shared/shared-data/export_cards.mjs` 当前仍导入 Slay 的 `content/cards.js`；退役时必须改为读取迁出的定义，并清理入口、统计、存档、构建和导出脚本的旧依赖，避免保留一套隐藏的旧引擎。

首回合验收应覆盖全新开局、进入首个战斗、刷新续玩和跨房间：在不先结束回合的情况下成功选牌并出牌，覆盖鼠标点击、拖拽和触屏；同时核对消耗、目标、敌方生命和保存后的结果。长期进度迁移、重复结算去重、同名卡来源 ID、异常恢复也需继续验证。现有验证结果不包含这些新增的退役验收项。

## 其他小游戏接入步骤

1. 统一入口下加载 `/shared/shared-session/game.js` 和共享角色目录，用自身稳定 mode key。
2. 先定义旧档校验器和资源映射，再 `openMode` 导入；保留原档直到新快照成功回读。
3. 将玩法自己的完整状态写进 `snapshot`，持续用新 revision 保存；角色引用统一用有效 DB ID，OC 和生态个体仍使用各自独立实体标识。
4. 角色收集/伤势写公共 roster；公共奖励用稳定事件 ID 的 `transact`，不要按每次渲染发奖。
5. 验证重复导入、重复结算、失败回滚、多窗口和刷新恢复，再连接门庭入口。

当前经营、生态、聚灵、浅滩、射击、Softie、AEON **尚未全部迁入共同进度库**；原有生态兑换继续工作。它们已有通用的读写/结算入口，后续不必各建一套共享账本。各玩法合为同一战斗引擎、统一地图或联机经济不属于这次数据迁移的完成声明。

## 本地与账户边界

这是同一浏览器、同一 origin 的设备旅途，按现有本地旧档来源迁入；不会自动把设备旧档归给当前登录账户。SSO/Gate/OC 资料维持现有 owner 边界。不同子域或开发端口的存档不会自动互通，统一入口需将玩法加载在同一 origin。

本轮没有增加云存档写接口，没有改香港用户库，也没有把 Windows 数据推送到香港。接入账户云同步时应复用已有 `(kind, uid, scope)` 存档所有权规则、香港单主写和冲突处理；不得把本地匿名档静默覆盖到账户档。

## 生成与验证

在仓库根目录运行（参考快照不属于发布内容）：

```powershell
npm run data:world -- --db file:///E:/External%20Projects/Iridescently%20Operations%20Archive/qa/cards-unification/hk-reference-20261019/library.sqlite3 --source hong-kong:assets-export:2026-10-19 --media-manifest file:///E:/External%20Projects/Iridescently%20Operations%20Archive/qa/cards-unification/hk-reference-20261019/baseline.json
npm run data:cards
npm run verify:game-data
npm run build:cards
npm run verify:game-ui
```

生成器只读数据库，角色和演武产物可重复生成；合并报告记录旧 ID、详设匹配和悬空能力。卡牌生成器从当前两套原生定义生成共享索引，不修改原生卡池。未给媒体清单时不猜选配图。

验证包括 25 项真实浏览器数据检查、8 项实际页面检查、23 项现有战斗/生态测试与 4 项原有数值后台测试；严格类型检查和 Cards 候选构建通过。导出器另验证 6 份产物字节一致、源数据库未变。桌面/手机截图在 `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/qa/cards-unification/qa/`。所有构建只写本地候选；真正发布需同时包含 Cards、Slay、shared-data 与 shared-session，不能只上传一个前端 bundle。

## 文件入口

- [共享数据 README](../../shared/shared-data/README.md)
- [共享进度 API](../../shared/shared-session/game.js) 与 [类型](../../shared/shared-session/game.d.ts)
- [Cards 存档适配](../../server/app/src/cards/src/game/storage.ts)
- [Slay 待写队列与迁移](../../server/app/src/slay-the-web/public/game/shared-progress.js)
- [原始交接材料](./CODEX-卡牌后端数据合并对接.md)（保留作历史参考，以本文实现状态为准）
