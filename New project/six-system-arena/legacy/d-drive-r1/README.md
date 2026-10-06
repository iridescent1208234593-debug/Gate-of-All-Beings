---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_bc878739c14711f1887c525400de85a5
    ReservedCode1: dkx21Fp6Qw6yWWxhZLHc+isV+EraBqk6jDfIOvYyfstxCQ8Tp862wUooRflmc7K5DTyj+KSavb/e6iY2KRhikUQ5T4XIWNQ/BychBDEX99kRMBU80srdGVaNWkIb6HedMCAFWNnlGET18+oGi7ysrWZvHFVlOVgN8Ktvx6uMeGqCgc5uKuN0AFzGa3E=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_bc878739c14711f1887c525400de85a5
    ReservedCode2: dkx21Fp6Qw6yWWxhZLHc+isV+EraBqk6jDfIOvYyfstxCQ8Tp862wUooRflmc7K5DTyj+KSavb/e6iY2KRhikUQ5T4XIWNQ/BychBDEX99kRMBU80srdGVaNWkIb6HedMCAFWNnlGET18+oGi7ysrWZvHFVlOVgN8Ktvx6uMeGqCgc5uKuN0AFzGa3E=
---

# 六系演武 · 数值可视化（six-systems-stats）

> 项目根目录：`D:\Projects\new project`
> 定位：为 zszm 侧的卡牌 / 经营 / 模拟游戏提供一套**可引用、可派生、可校准、可回滚**的六大系能力数值层与 UI 可视化层。
> 本轮：**第 1 轮（R1）数值可视化落地**。

---

## 1. 项目定位与边界

| 维度 | 内容 |
| --- | --- |
| 做什么 | 把 v4 库里的角色能力记录，派生成 **100 分制六大系数值 + 技能标签**，并提供图标组件、雷达/条形可视化、示例页、可重复执行的脚本 |
| 不做什么 | 不修改任何既有游戏工程（`D:\Projects\zszm` 等）；不移动 / 删除 v4 数据库；不重新定义能力体系 |
| 输出形态 | 一个与 `shared-types` / `shared-ui` 平级的可引用模块（`package.json` 已配置 exports） |
| 引用关系 | 六系口径直接沿用 `shared-types/world.js#ABILITY_SYSTEMS`，本项目不另造体系，两侧键名完全一致，无需映射表 |

---

## 2. 快速开始

```powershell
cd "D:\Projects\new project"

# 1) 查看派生数据是否与 v4 库一致（sha256 校验 + 数值比对）
node tools/derive-all-stats.mjs --check

# 2) 应用外置覆盖层（人工校准通道），产出 effective 数据
node tools/apply-overrides.mjs
node tools/apply-overrides.mjs --check     # 只校验、不写文件

# 3) 启动本地示例页
node tools/serve-demo.mjs                  # 默认 http://127.0.0.1:5399/demo/
```

---

## 3. 六系口径（锁定，不可另造）

展示顺序与 id 保持一致，均为 zszm `AbilitySystem` 定义：

| 顺序 | id | 名称 | 固有 | 代表分支 |
| --- | --- | --- | --- | --- |
| 1 | `yuling` | 御灵系 | 否 | 金 / 木 / 水 / 火 / 土 |
| 2 | `suoyu` | 锁御系 | 否 | 灵御 / 制灵 / 法宝 / 法器 / 阵法 |
| 3 | `zaowu` | 造物系 | 否 | 重构 / 改变性质 / 改变样貌 / 无中生有 |
| 4 | `xinling` | 心灵系 | 否 | 传音 / 傀儡 / 戏梦 / 摄心 / 读心 |
| 5 | `shengling` | 生灵系 | 否 | 洞察 / 观灵 / 豪夺 / 隐匿 / 治愈 / 追毫（含强化系、治愈系） |
| 6 | `kongjian` | 空间系 | **是**（无法后天习得） | 吞噬 / 传送 / 转移 / 蕴藏 / 领域 |

- 雷达图轴序另见 `RADAR_AXIS_ORDER`（对齐 shared-ui `radar6` 默认轴序）：御灵 → 心灵 → 空间 → 锁御 → 造物 → 生灵。
- 空间系为先天系：派生算法在无文本证据时强制归零（忠于世界观；当前数据中无全零角色）。
- 口径锁定落在 `data/character-stats.json#scopeLock`，绑定三处来源：v4 库 `ability_systems#2`、`shared-types/world.js#ABILITY_SYSTEMS`、本项目 `src/world/six-systems.js`。

---

## 4. 数据源分层与溯源规则（**前提：无权威对照**）

> **本节是全文最重要的红线，请先读这里。**

### 4.1 前提

- **D 盘与 E 盘的 v4 库都不是权威数据源**：两库已出现分叉（D 盘 sha256 `34efcb0…`，E 盘 `ee5b2c…`），仅可作参考。
- **本项目不存在权威对照表**，因此**任何数值都不得被表述为「官方权威值」**。
- 所有派生值默认标记 **推定基线（inferred）**，UI 必须同时展示溯源等级，禁止出现「官方 / 权威 / 正确」字样。

### 4.2 三层溯源等级

| source | 含义 | 判定依据 |
| --- | --- | --- |
| `official` | 官方设定可直接引用的数值或明确强度表述 | 必须在 `evidence` 写明出处（卷/话/页或官方链接），且经**人工确认** |
| `db-record` | 由 v4 库结构化记录直接支撑 | `character_abilities` / `character_abilities_ext` 中存在该角色该系条目（即派生时的 `confidence=tagged`） |
| `inferred` | 由文本证据或派生规则推断，含全部未校准基线分 | `confidence=textual` / `baseline` 统一映射为此级 |

映射关系（脚本内置，见 `src/world/overrides.js#CONFIDENCE_TO_SOURCE`）：
`tagged → db-record`、`textual → inferred`、`baseline → inferred`。

### 4.3 数据流（派生层与校准层分离）

```
v4 库（只读，非权威）
      │  tools/derive-all-stats.mjs（sha256 校验 + 派生规则）
      ▼
data/character-stats.json          派生层：只读，任何人不手改
      │  tools/apply-overrides.mjs
      ▲
data/stats-overrides.json          校准层：唯一允许人工编辑的文件（默认为空）
      ▼
data/character-stats.effective.json  合并层：实际供 UI / 游戏引用
```

- 派生层与校准层**物理分离**，用户可整体替换覆盖表完成全局校准，或直接删除覆盖表回到纯派生状态。
- 覆盖表为空时，effective 数据与派生数据**分值与数量完全一致**，仅补齐 `source` / `sourceLabel` 溯源字段（可验证：`node tools/apply-overrides.mjs --check`）。

### 4.4 覆盖项字段规范

```jsonc
{
  "overrides": {
    "1": {
      "source": "db-record",          // official | db-record | inferred（official 必须带 evidence）
      "confidence": "manual-reviewed", // 可选
      "evidence": "出处说明",           // official 必填
      "note": "校准理由",               // 可选
      "systems": { "kongjian": 88 },   // 可选，只覆盖列出的系，未列出保留派生值
      "skillTags": []                  // 可选，提供则整体替换
    }
  }
}
```

校验规则（`validateOverrides`）：id 必须为正整数；系别 id 必须在六系内；分值必须为 `0..100` 数字；任何越界或非法字段会**直接报错并拒绝应用**。填写参考见 `data/stats-overrides.json#exampleOverride`（默认禁用）。

---

## 5. 目录结构

```
D:\Projects\new project\
├─ README.md                        本文件
├─ package.json                     模块声明 + 自动任务入口（scripts）
├─ data\
│  ├─ character-stats.json          派生层（488 行 / 431 有效角色 / 六系 0-100 分 + 技能标签）
│  ├─ stats-overrides.json          校准层（外置可覆盖配置，默认空）
│  └─ character-stats.effective.json 合并层（由脚本生成）
├─ src\
│  ├─ world\                        世界层：six-systems / elements / realms / rating / schema / overrides
│  ├─ ui\                           图标与图表：system-icons（内联 SVG）/ icons / radar6 / bars6 / badge
│  │  └─ react\SystemIcon.tsx       React 封装
│  ├─ data\characters.json          原始角色快照 + _provenance.json
│  └─ index.js
├─ demo\                            示例页：图标墙 / 角色雷达条形 / 对镜对比 / 数据健康度
├─ tools\                           可重复执行脚本：derive-all-stats / apply-overrides / serve-demo / derive-from-db
├─ docs\01-六大系数值方案.md         方案文档
└─ lxh-audit\                       库审查与素材审计记录（历史归档，只读）
```

---

## 6. 数值派生规则（v4 → 100 分制）

六大系分值 = 六项加分之和，裁剪到 `0..100`：

| 计分项 | 规则 |
| --- | --- |
| 基础分 base | 每系默认基线（`baseMin=6`） |
| 存在分 presence | 该系在库中存在能力记录即得分（`presence=30`） |
| 复现分 repeat | 同一系多次出现按次累计（`repeatEach=5`，有上限） |
| 具名分 named | 出现「X系·分支」结构化具名标签（`namedEach=8`） |
| 分支分 branch | 命中已知分支额外加分 |
| 叙事分 span | 叙事描述强度（跨度 `baseSpan=14` 的量级控制） |

- 技能标签：从能力条目原文用「X系·分支」正则抽取，保留 `raw` 与 `rawVariants`（兼容 `·`、`–`、`-` 三种分隔符）。
- 综合战力：`composite = peak*0.42 + average*0.38 + secondary*0.2`（**不看六系总分**，避免「多修一系白送分」）；评级 S/A/B/C/D/E 阈值 85 / 70 / 55 / 38 / 20 / 0。
- 统计快照：`total 488 / active 431 / merged 49 / 非角色 8 / 带技能标签 60 / 双标签 3`；溯源分布 `tagged 60 / textual 160 / baseline 268`。
- 派生脚本对 v4 库做 sha256 校验，`--check` 通过（true/true）后方可采信派生结果。

---

## 7. 图标与可视化

| 组件 | 文件 | 说明 |
| --- | --- | --- |
| 六大系图标 | `src/ui/system-icons.js` | **内联 SVG**（真实可用资源：来源为 `D:\Projects\huiguan\design-system\ui\AI image\cards` 的官方 card SVG，23 个文件；键映射 `SYSTEM_ICON_KEYS` → metal / lock / artifact / mind / spirit / space）。provenance 见 `src/data/_provenance.json` |
| 雷达图 | `src/ui/radar6.js` | 六轴雷达（遵循 `RADAR_AXIS_ORDER`） |
| 条形图 | `src/ui/bars6.js` | 六系横条对比 |
| 徽章 | `src/ui/badge.js` | 评级徽章着色 |
| React 封装 | `src/ui/react/SystemIcon.tsx` | 供宿主工程直接引用（**已知问题：内部 `decorateIcon` 引用缺失，R2 待修**） |

**示例页**（`demo/`，四板块）：

1. 图标墙 —— 六大系图标 + 名称 + 分支；
2. 角色雷达 / 条形 —— 选择角色读取 `character-stats.json` 实时渲染，数字不写死；
3. 对镜对比 —— 任意两名角色对比，**支持同一角色自身对战预览**；
4. 数据健康度 —— 展示 counts / 溯源分布 / 派生规则摘要。

访问：`node tools/serve-demo.mjs` → `http://127.0.0.1:5399/demo/`（服务已内置端口占用提示与 `../` 路径逃逸拦截）。

**图标 provenance 声明**：六大系图标来自现有官方 card SVG 资源，**未使用 AI 生成的角色形象**；若后续需要新增纯 UI 图形，允许 AI 生成，但仅限 UI 装饰图形，严禁 AI 生成角色形象。

---

## 8. 分轮计划与自动任务

### 8.1 轮次划分

| 轮次 | 主题 | 状态 | 主要产出 |
| --- | --- | --- | --- |
| R0 | 基础盘点与派生 | 已完成（半成品） | `data/character-stats.json`、`src/ui/system-icons.js`、demo 页骨架、tools |
| **R1** | **数值可视化落地** | **本轮** | 外置覆盖层、溯源分级、README、覆盖应用脚本、git 初始化 |
| R2 | 对战与反馈系统 | 待启动 | 对战数值结算（含「与自身对战」）、胜负反馈素材接入（小黑/比丢表情包）、通关成就 |
| R3 | 卡组与技能分配 | 待启动 | 按六系 + 技能标签自动分配卡组、角色数值 → 卡牌强度映射 |
| R4 | 收集类成就玩法 | 待启动 | 图鉴收集、成就解锁、正向反馈链路 |

### 8.2 自动任务划分（可重复执行，幂等）

| 任务 | 命令 | 频率建议 | 作用 |
| --- | --- | --- | --- |
| 派生校验 | `node tools/derive-all-stats.mjs --check` | 每次改动数据后 | 校验 v4 库 sha256 与派生结果一致性 |
| 覆盖校验 | `node tools/apply-overrides.mjs --check` | 每次编辑覆盖表后 | 校验覆盖表合法性 + 预览生效差异 |
| 覆盖应用 | `node tools/apply-overrides.mjs` | 校准提交前 | 产出 `character-stats.effective.json` |
| 示例页 | `node tools/serve-demo.mjs` | 需要预览时 | 本地起服务看可视化效果 |

> 以上任务在 `package.json#scripts` 中登记（`stats:check` / `stats:overrides` / `stats:overrides:check` / `demo`），可直接 `npm run` 调用。
> **所有脚本只读派生层，写操作仅限 `data/character-stats.effective.json`，不触碰 v4 数据库。**

### 8.3 git 分支策略

- 主分支 `main`：承载已验收的主线内容；
- 每轮一条**短分支**（如 `r1-visual`），完成后合回 `main` 并保留分支便于查看 diff；
- 本轮：`main` 记录 R0 半成品基线，`r1-visual` 承载 R1 新增，合并后主线即包含全部 R1 成果。

---

## 9. 未决项与待用户校准项

### 9.1 待校准（按优先级）

| 档 | 优先级 | 范围 | 数量 | 说明 |
| --- | --- | --- | --- | --- |
| Tier 1 | P0 | 主线角色：罗小黑(id 1) / 无限(id 2) / 风息(id 3) | 3 | 对战与示例页默认出战方，最先需要人工确认 |
| Tier 2 | P1 | `confidence=tagged` 角色 | 60 | 已有库记录支撑，校准成本最低 |
| Tier 3 | P2 | `confidence=textual` 角色 | 160 | 有原文线索，需判断是否提级 |
| Tier 4 | P3 | `confidence=baseline` 角色 | 268 | 仅存在性证据，建议长期维持 `inferred` |

### 9.2 未决项

1. **数值口径最终裁决**：D / E 两库分叉，需用户明确以哪一侧为工作副本（当前以 D 盘 v4 为准）。
2. **`baseline` 角色是否进入正式对战**：268 名推定基线角色是否可用于卡组分配，需产品确认。
3. **图标覆盖度**：现有官方 card SVG 23 个，六大系映射已通；若未来扩展到分支级图标（如金木水火土），需补充素材。
4. **React 封装修复**：`src/ui/react/SystemIcon.tsx` 缺失 `decorateIcon`，影响宿主工程引用，R2 处理。
5. **素材合规**：胜负反馈素材必须为《罗小黑战记》官方图（可联网采集但需严格审查），**禁止 AI 生成角色形象**；该项属 R2 范围，需在接入前建立审查清单。

---

## 10. 下一轮（R2）建议

1. **对战数值结算**：以 `composite / peak / balance` 为输入设计回合制结算，支持「与官方角色对战」与「与自身对战（镜像）」两种模式；世界观表述须忠于原作设定，避免自造能力。
2. **胜负反馈链路**：胜 → 小黑 + 比丢 + 胜利文案（正向反馈）；负 → 小黑呆滞表情 + 「下次再来」；素材优先复用现有 asset，联网采集必须逐张人工审查。
3. **成就系统**：先做「收集类」轻量成就（如解锁 N 名角色、集齐六系标签），再接 K 卡组分配。
4. **卡组自动分配**：按 `systems` 峰值系 + `skillTags` 生成初始卡组，规则写入 `tools/`，保证可重复执行。
5. **文档同步**：每轮结束更新本 README 的轮次表、未决项与新增脚本命令。
*（内容由AI生成，仅供参考）*
