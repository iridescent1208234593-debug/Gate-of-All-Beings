---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_2be4f65dc0ee11f1887c525400de85a5
    ReservedCode1: 4giTzS1IIiqu0BvX4Ocym/i8brFqiuNAqUik6bSgSYr/F6nTLU4OAOpR2c1H+kXObskttjDdJ0lZbi34aGhP5xOfB33EjYVpvKTKdfUI4uV+49jgjqIQ4M9upvUNU3jWG3buEuSQEj8hd6oz65AGCav55z20iw7jcgC5vs/rffInVBTAdVYzkZfwJSA=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_2be4f65dc0ee11f1887c525400de85a5
    ReservedCode2: 4giTzS1IIiqu0BvX4Ocym/i8brFqiuNAqUik6bSgSYr/F6nTLU4OAOpR2c1H+kXObskttjDdJ0lZbi34aGhP5xOfB33EjYVpvKTKdfUI4uV+49jgjqIQ4M9upvUNU3jWG3buEuSQEj8hd6oz65AGCav55z20iw7jcgC5vs/rffInVBTAdVYzkZfwJSA=
---

# 六系演武 · six-system-arena

> 罗小黑战记世界观 · 六系（金 / 木 / 水 / 火 / 土 / 空间）数值与卡牌系统孵化项目
> 位置：`E:\Projects\New project\six-system-arena\`
> 建立日期：2026-10-05（第一轮基础建设）

---

## 1. 项目目标

在**不修改任何参考仓库**的前提下，为 zszm 端口（众生之门站点）的卡牌游戏 / 经营游戏 / 模拟游戏数值系统，交付一套可独立演进的「六系能力」基础设施：

| 目标 | 交付物 | R1 | R2 |
| --- | --- | --- | --- |
| 六系图标可视化接入 | `ui/six-system-icons.js`、`ui/SixSystemPanel.js` | 完成 | 保持 |
| 数值模型可执行推导 | `data/stat-model.json`、`data/scripts/generate_stats.py` | 完成 | 全量固化 |
| 角色数值产物 | `data/generated/character_stats.json`（488 名） | 试跑 | 固化 |
| 设计文档沉淀 | `docs/01 ~ 06` | 完成 | 冻结为实现依据 |
| 可重复自动化 | `AUTOMATION.md` + `scripts/run_all.ps1` | 脚本清单 | 一键串联 |
| 卡组分配 | `data/decks.json`（488 名 · 主将 + 技能 + 羁绊） | 待办 | **完成** |
| 收集类成就数据 | `data/achievements.json`（15 条 / 4 类） | 待办 | **完成** |
| 对战内核 | `ui/battle-engine.js`（确定性 · 六系克制环 · 镜像战） | 待办 | **完成** |
| 成就判定与图鉴 | `ui/achievement-system.js` | 待办 | **完成** |
| 胜负结算 | `ui/settlement.js`（胜：小黑 + 比丢 / 负：安慰表情包） | 待办 | **完成** |
| 数值与卡组审计 | `data/audit/r2-audit.md` | 待办 | **完成** |

> R2 迭代详情见 [`CHANGELOG.md`](CHANGELOG.md) 的 **R2** 一节。

### 1.1 世界观与素材红线（最高优先级）

1. **忠于《罗小黑战记》官方世界观**，能力体系严格对齐官方设定（御灵系 / 生灵系 / 造物系 / 空间系 / 心灵系 / 锁御系）。
2. **仅允许使用罗小黑战记官方图**。严禁 AI 生图，严禁使用 AI 目录素材：
   - 排除 `ai-art`、`shared-ui/lxh/ai-avatars`、`shared-ui/AI image`（**AI 生成，禁止用于对外展示**）。
   - 白名单与裁切建议见 `docs/05-素材白名单.md`。
3. **UI 组件可由 AI 生成**（仅限 UI 层）；六系图标取自官方卡片素材 `shared-ui/AI image/cards/*.svg`——已逐个核对为**纯几何图形 + 汉字的 UI 图标**（非生成式图像），并已**重绘内联**进 `ui/six-system-icons.js`，此后运行不再依赖该目录。

### 1.2 工程红线

- 所有新建内容**只落在本目录**（`E:\Projects\New project\six-system-arena\`）。
- **不修改参考仓库**：`E:\Projects\shared\shared-ui`、`D:\Projects\zszm`、`E:\Projects\assets\罗小黑战记数据库` 一律只读。
- **不触碰既有未提交变更**：`D:\Projects\zszm`（`feat/card-balance-admin`，7 处变更）与 `E:\Projects`（`master`，7 处变更）的工作区现状保持原样。
- 数据库 `worldview_luoxiaohei_v4.db` **只读访问**，任何推导结果写入本目录 `data/generated/`。
- 保持现有数据系统框架不变，**只做增量与可扩展设计**。

---

## 2. 目录说明

```
six-system-arena/
├─ README.md                 ← 本文件：项目总览 / 目标 / 目录说明 / 每轮记录入口
├─ PLAN.md                   ← 分阶段计划与任务划分（主线优先）
├─ AUTOMATION.md             ← 自动化任务与脚本清单、用法、调度建议
├─ BRANCHING.md              ← 短 git 分支策略与脏工作区处理约定
├─ CHANGELOG.md              ← 每轮记录入口（本轮新增文件清单）
├─ scripts/
│  └─ run_all.ps1            ← R2 一键串联：数值 → 卡组 → 成就校验 → 审计 → 自检 → 冒烟
├─ ui/
│  ├─ six-system-icons.js    ← 六系图标自包含模块（SVG 常量 + 统一 key + 零侵入注册）
│  ├─ SixSystemPanel.js      ← 数值面板组件（六系雷达 + 五行星图 + 图标）
│  ├─ battle-engine.js       ← R2 确定性对战内核（克制环 / 空间穿透 / 镜像战 / 种子复现）
│  ├─ achievement-system.js  ← R2 成就判定 + 收集图鉴（只读战斗日志契约字段）
│  └─ settlement.js          ← R2 胜负结算（胜：小黑 + 比丢登场；负：安慰表情包，不惩罚）
├─ data/
│  ├─ six-systems.json       ← 六系定义、图标 key、颜色映射
│  ├─ stat-model.json        ← hp/attack/defense/element/realm 取值规则与分档
│  ├─ decks.json             ← R2 卡组产物（488 名 · 主将 + 技能 + 羁绊 + 规则表）
│  ├─ achievements.json      ← R2 成就定义（15 条 · 角色 / 六系 / 战斗 / 稀有度）
│  ├─ manual-overrides.json  ← 人工校准表
│  ├─ scripts/
│  │  ├─ generate_stats.py         ← 从 v4 数据库推导角色数值（只读数据库）
│  │  ├─ generate_decks.py         ← 按 docs/03 §4 规则生成卡组（可扩展规则表驱动）
│  │  ├─ validate_achievements.py  ← 成就定义 / 卡组规则 / 素材路径校验
│  │  ├─ audit_r2.py               ← 数值与卡组审计报告生成（含成就可达性）
│  │  ├─ smoke_test.js             ← 三模块联动冒烟测试（Node，零依赖）
│  │  └─ patch_lxh_icons.py        ← lxh-ui.js 六键增量补丁（备份 / 校验 / 回滚）
│  ├─ audit/
│  │  └─ r2-audit.md         ← R2 数值与卡组审计报告
│  └─ generated/
│     └─ character_stats.json← 推导产出（全量 488 名）
├─ docs/
│  ├─ 01-数值模型.md
│  ├─ 02-六系图标接入.md
│  ├─ 03-对战系统.md
│  ├─ 04-成就系统.md
│  ├─ 05-素材白名单.md
│  └─ 06-数据源与回滚.md
└─ vendor/backup/            ← 参考文件备份区（补丁前快照，只增不改）
```

---

## 3. 快速开始

### 3.1 一键串联（R2 推荐）

```powershell
# 全链路：数值生成 → 卡组生成 → 成就校验 → 审计 → JS 语法自检 → 冒烟测试
powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1"

# 只跑校验链（复用现有数值产物，日常快速回归）
powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1" -Stage checks -SkipStats

# 空跑预览 / 失败不中断 / 主线范围快跑
powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1" -DryRun
powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1" -KeepGoing
powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1" -Scope mainline
```

退出码：全链通过 = `0`，任一步失败 = `1`。脚本**不会**调用 `patch_lxh_icons.py --apply`（外部写入需单独授权）。

### 3.2 分步执行

```powershell
# 1) 生成角色数值（只读 v4 数据库，输出到 data/generated/）
python "data\scripts\generate_stats.py" --scope all

# 2) 主线角色试跑校验（默认同样写入 data/generated/；如需不动正式产物请加 --out）
python "data\scripts\generate_stats.py" --scope mainline --out "temp\mainline_probe.json"

# 3) 生成卡组（依赖上一步产物）
python "data\scripts\generate_decks.py"

# 4) 成就 / 卡组 / 素材校验，5) 审计报告
python "data\scripts\validate_achievements.py"
python "data\scripts\audit_r2.py"

# 6) 三模块联动冒烟测试
node "data\scripts\smoke_test.js"

# 7) lxh-ui.js 六键增量补丁：dry-run 预览 → apply 写入（自动备份）→ rollback 回滚
python "data\scripts\patch_lxh_icons.py" --dry-run
python "data\scripts\patch_lxh_icons.py" --apply
python "data\scripts\patch_lxh_icons.py" --rollback
```

### 3.3 对战后端接入（R2）

```html
<script src="ui/battle-engine.js"></script>       <!-- window.SixBattle -->
<script src="ui/achievement-system.js"></script>  <!-- window.SixAchievement -->
<script src="ui/settlement.js"></script>          <!-- window.SixSettlement -->
<script>
  // 一场可复现的官方对战
  var deckIndex = SixBattle.indexDecks(decksJson)          // decks.json
  var res = SixBattle.simulate({
    mode: 'arena', seed: 20261005,
    selfDeck: deckIndex[1], opponentDeck: deckIndex[2], opponentType: 'official'
  })
  var log = SixBattle.toLogRecord(res.state)               // docs/04 §5 契约字段
  ach.judge(log)                                           // 成就判定（败局自动跳过）
  settle.render(SixSettlement.resolve({ result: log.result, /* ... */ }))
</script>
```

> `decks.json` / `achievements.json` 是纯数据，前端以 `fetch()` 或构建期内联均可加载，不依赖任何第三方库。

前端接入（**零侵入**，无需改动共享 UI 文件）：

```html
<script src="ui/lxh-ui.js"></script>
<script src="ui/six-system-icons.js"></script>   <!-- 自动注册 ICONS.jin/mu/shui/huo/tu/kongjian -->
<script src="ui/SixSystemPanel.js"></script>
<script>
  var el = SixSystemPanel.render({
    name: '罗小黑',
    stats: { hp: 3200, attack: 260, defense: 180 },
    values: [88, 62, 70, 55, 60, 95]   // 金木水火土空间
  })
  document.body.appendChild(el)
</script>
```

---

## 4. 每轮记录入口

- 迭代记录：见 [`CHANGELOG.md`](CHANGELOG.md)（每轮结束必须在其中追加一节）。
- 阶段进度：见 [`PLAN.md`](PLAN.md) 的阶段勾选表。

## 5. 相关参考（只读）

| 资源 | 路径 | 用途 |
| --- | --- | --- |
| 世界观主库 | `E:\Projects\assets\罗小黑战记数据库\db\worldview_luoxiaohei_v4.db` | 角色 / 能力 / 境界数据源 |
| 官方卡片图标 | `E:\Projects\shared\shared-ui\AI image\cards\*.svg` | 六系图标来源 |
| 共享 UI 库 | `E:\Projects\shared\shared-ui\lxh-ui.js` | `wuxingSVG()` / `radar6()` 复用对象 |
| 官方图片素材 | `E:\Projects\assets\罗小黑战记数据库\images\` | 白名单见 `docs/05` |
*（内容由AI生成，仅供参考）*
