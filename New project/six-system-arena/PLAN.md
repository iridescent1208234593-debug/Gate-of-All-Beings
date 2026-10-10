---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_87196d06c3ef11f1b45c525400cd780f
    ReservedCode1: jc2a7JRxrvzfH1Ki25ScoxE3oj2U8+CCI1qQwgd56MSDIkCb2WGe9lSLpaeewBlNiKij7oPK+wLBOrJW3UxmnRTWTOdcfSmvAqGSAqQ4Dcuq7OeFq6Tcy0lkKP9dfC7XIOpRRoX+XZFpunWrQBlk9155zt7bqIXG1M2BZAvuik9hee/RINIrrqWz6sc=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_87196d06c3ef11f1b45c525400cd780f
    ReservedCode2: jc2a7JRxrvzfH1Ki25ScoxE3oj2U8+CCI1qQwgd56MSDIkCb2WGe9lSLpaeewBlNiKij7oPK+wLBOrJW3UxmnRTWTOdcfSmvAqGSAqQ4Dcuq7OeFq6Tcy0lkKP9dfC7XIOpRRoX+XZFpunWrQBlk9155zt7bqIXG1M2BZAvuik9hee/RINIrrqWz6sc=
---

---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_9b8df889c15111f1884b525400cd780f
    ReservedCode1: DWyGGnyVnZuPoj5EsEoELdBR0Icw8VFTaZJg+LhDn7bzw2oxMxBNHkB1oBbZy6t4taB//jDkucCFosDl2lsMAs4b8sZy4h5rxpOfLMsrs9JDO7YdnD9nmr8rduhkXd8I+qO6apimW1PR6BqTJxxmtxL0LIaWB1t/Y9X78UjoXgoEApMJqLA4sG9v5Do=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_9b8df889c15111f1884b525400cd780f
    ReservedCode2: DWyGGnyVnZuPoj5EsEoELdBR0Icw8VFTaZJg+LhDn7bzw2oxMxBNHkB1oBbZy6t4taB//jDkucCFosDl2lsMAs4b8sZy4h5rxpOfLMsrs9JDO7YdnD9nmr8rduhkXd8I+qO6apimW1PR6BqTJxxmtxL0LIaWB1t/Y9X78UjoXgoEApMJqLA4sG9v5Do=
---

---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_2cf8da04c0ee11f1884b525400cd780f
    ReservedCode1: nmgaKA2Tk2tO8axnIjhKDWgt3/Ve9jHQSzw1kCvAGZEufzZ8ihDSLeUp1kp18ykSJbnbDYfmYHzxh9UWqF6KZBDJdGbqX652KYFFxo0xF4BKB7gk5SeH4rGfk+BFobX80UBMBJixDzy3XZn0eyHHP29ri31EpZ7I+MGvTimL/VCPSPbzLk3DBiI6gGo=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_2cf8da04c0ee11f1884b525400cd780f
    ReservedCode2: nmgaKA2Tk2tO8axnIjhKDWgt3/Ve9jHQSzw1kCvAGZEufzZ8ihDSLeUp1kp18ykSJbnbDYfmYHzxh9UWqF6KZBDJdGbqX652KYFFxo0xF4BKB7gk5SeH4rGfk+BFobX80UBMBJixDzy3XZn0eyHHP29ri31EpZ7I+MGvTimL/VCPSPbzLk3DBiI6gGo=
---

# PLAN · 分阶段计划与任务划分

> 核心原则：**主线优先**（罗小黑 / 无限 / 风息 / 老君 / 谛听 / 玄离 / 比丢等主线角色先赋数值与卡组），
> 其余角色按批次铺开；每阶段可独立验收，不阻塞其他阶段。

---

## 阶段总览

| 阶段 | 名称 | 产出 | 依赖 | 状态 |
| --- | --- | --- | --- | --- |
| P0 | 目录骨架与规划文档 | `README / PLAN / AUTOMATION / BRANCHING / CHANGELOG` | — | ✅ 完成 |
| P1 | 六系图标接入 | `ui/six-system-icons.js`、`ui/SixSystemPanel.js`、补丁脚本 | P0 | ✅ 完成 |
| P2 | 数值模型与推导脚本 | `data/stat-model.json`、`data/six-systems.json`、`generate_stats.py` | P1 | ✅ 完成 |
| P3 | 主线角色试跑 | `data/generated/character_stats.json`（主线 100% 覆盖） | P2 | ✅ 完成 |
| P4 | 全量角色铺开 | 488 角色数值 + 卡组分配 | P3 | ✅ R5 完成（技能卡完善 + 非数值稀有度校准） |
| P5 | 对战系统落地 | 与官方角色 / 自身对战，卡组平衡调优 | P4 | 🔷 R2 完成（内核已交付，胜率调优待实测） · R25 复核维持 |
| P6 | 收集类成就玩法 | 胜 / 负 / 平三轨反馈 + 表情包台账 | P4 | 🔷 R5 完成（专项采集待补） · R25 复核维持 |
| P7 | 站点集成（zszm 端口） | UI 组件 + 图标在卡牌 / 经营 / 模拟三系统上线 | P5、P6 | 🔷 R4 集成包交付（integration/），待站点挂载 |
| P8 | 工作副本切换与现有数值登记 | `legacy/d-drive-r1/`、`docs/08`、`data/demo-baseline.json` | P0 | ✅ R3 完成 |
| P9 | 端到端联调链路 | `data/scripts/e2e_flow.js`、`data/generated/e2e/*`、`docs/12` | P5、P6 | ✅ R8 完成 |

> **R3 迭代（2026-10-06）**：工作副本正式切至 E 盘；D 盘 `D:\Projects\new project` 保留为旧副本，
> 其 R1 成果快照至 `legacy/d-drive-r1/`；登记站点现有 demo 数值为参考基线（`docs/08` + `data/demo-baseline.json`），
> 确认六系分值为新增维度、**不改动站点既有数值框架**。

> **R4 迭代（2026-10-05）**：交付 `integration/` 集成包（运行时 JS + TS 接入层 + 数据 + 样式 + 校验工具 + 交付级安装指南 `INTEGRATION-ZSZM.md`），
> 修复同步脚本路径缺陷与校验器三处误报，静态自检 18/18、运行时冒烟 11/11 全通过。
> 站点侧挂载**尚未执行**（涉及正式工程写入，待拍板）；详见 [`CHANGELOG.md`](CHANGELOG.md) 的 R4 一节。

> **R5 迭代（2026-10-07）**：三分轮收口——① 角色技能分配与卡组生成：`data/decks.json` 升 v1.1.0（技能卡同名去重 + `tags` / `source_kind` + 卡组级 `skill_element_mix` / `skill_source_split`；R2 遗留的稀有度分布以「获得节奏分层」非数值手段落地 P4/P3/P2/P1，实测 5/44/146/293，数值字段零漂移）；② 对战结算与收集成就：结算三轨 + 成就错峰 + 冒烟/校验强化（`validate_achievements.py` 25 项 / `smoke_test.js` 10 段）；③ 胜负反馈与表情包：`ui/settlement.js` v1.1.0 平局独立轨（1800ms / 不判负 / 不惩罚）+ 表情包素材台账 `data/emoticons.json` 与 `docs/10`（5 官方渠道 / comfort 3 + entrance 3 / 逐张审查留痕 6 条）。 技能卡三来源 `character_ability` 131 / `primary_fallback` 177 / `generic_fallback` 742（共 1050 张）、补位同名去重 41 例 → **0 例**；`run_all.ps1` 6/6 PASS。

> **R2 迭代（2026-10-05）**：完成 `data/decks.json`、`data/achievements.json`、`ui/battle-engine.js`、
> `ui/achievement-system.js`、`ui/settlement.js`、`scripts/run_all.ps1`、`data/audit/r2-audit.md`，
> 并新增 `data/scripts/{generate_decks.py, validate_achievements.py, audit_r2.py, smoke_test.js}`。
> 详见 [`CHANGELOG.md`](CHANGELOG.md) 的 R2 一节。

> **R7 迭代（2026-10-08）**：**土系系统性偏差修正** —— 用户指出强土系角色「池年」（妖灵会馆长老 · 十五仙之一）被低估；
> 核查确认 R7 规则已写入 `data/stat-model.json` v1.1.0，但产物长期停留 v1.0.0 基线（规则未生效）。
> 修正三项缺陷：**FIX-1** 并列系切段精确认系（`element.segmentMatch`）、**FIX-2** 高位身份补正境界（`realm.identityRules`，只升不降）、
> **FIX-3** 消除主属性顺序偏置；随后全量重跑数值（488 角色）与卡组（488 套）。
> 结果：土系主属性角色 **7 名**（不变；`systems` 含土系者 11 名）、**C 档以上 0 → 1 名（池年 · 化神）**；池年 E → C（power 1791 → 3729、R → SR、金丹 → 化神）；`ach_system_001`「土系静态不可达成」结论**推翻**，
> `element_gate.status = resolved`；稀有度同步为 R 413 / SR 71 / SSR 3 / UR 1。
> 详见 [`CHANGELOG.md`](CHANGELOG.md) R7 一节与 [`docs/11-六系归属与境界身份修正记录.md`](docs/11-六系归属与境界身份修正记录.md)。

> **下一轮计划（R8）**：① 打通「对战内核 → 战斗日志契约 → 成就判定 → 收集图鉴」的**端到端可跑通链路**
> （补 `toLogRecord` 落盘样例 / 成就判定全 15 条覆盖验证 / 图鉴四视图渲染自检），并对镜像战（mode=mirror）不计入角色收藏的规则做回归；
> ② 推进站点侧 P7 挂载（`integration/INTEGRATION-ZSZM.md` 三方案，推荐零侵入 A 方案，须用户拍板）；③ 表情包专项目录采集（联网 → 逐张人工审查 → 登记台账）。
> 仍不改动数值框架与既有卡组规则，仅新增联调与验证产物。

> **R8 迭代（2026-10-08）**：**端到端联调链路补全** —— 以 `data/scripts/e2e_flow.js` 打通
> 「对战内核 → 战斗日志契约 → 落盘样例 → 成就判定 → 收集图鉴」，补齐 R5 / R7 连续挂账的三项待补：
> ① `toLogRecord` 落盘样例（`data/generated/e2e/battle-log-sample.jsonl`，8 条）；
> ② **全 15 条成就逐条覆盖**（真实对局 106 场、合成 0 条，逐条标注首次触发阶段）；
> ③ **图鉴四视图渲染自检**（by_element 7 / by_rarity 4 / by_tier 6 / by_mainline 2，全 PASS）。
> 另追加**镜像战不计入角色收藏**回归（`pass`）与**六系取证代表角色**实测（土系 = 池年 · C 档，真实取胜）。
> `scripts/run_all.ps1` 扩展为 **7 步**（新增第 7 步，JS 语法自检同步覆盖新脚本），一键链路 7/7 PASS。
> 本轮**未改动任何数值**；新增平衡观察 `BAL-R8-01`（顶级主将「无限」近乎不可战胜）转 R9 评估。
> 详见 [`CHANGELOG.md`](CHANGELOG.md) R8 一节与 [`docs/12-端到端联调记录.md`](docs/12-端到端联调记录.md)。

> **R16 迭代（2026-10-09）**：**三分轮完成度核实与 AIGC 元数据收口** —— 用户指令按 README 分轮计划推进「角色技能分配与卡组生成 → 对战结算与收集成就 → 胜负反馈与表情包」；核实确认该三分轮已于 R5 全部完成并合入主线，R16 计划 8 项全部待用户拍板。本轮收口 `docs/17` / `docs/18` / `docs/19` 的 AIGC 元数据补录（各 +12 行，无业务变更），回归校验 `validate_achievements.py` 25/25 PASS、`smoke_test.js` 全绿；8 项待拍板事项原样挂账至 R17；数值 / 素材 / 引擎零改动。

> **R17 迭代（2026-10-10）**：**集成包同步与主线健康复核** —— 用户指令按 README 分轮计划推进三分轮；核实确认三分轮已于 R5 全部完成并合入主线（git 链复验一致），R17 计划 8 项全部待用户拍板、无可本地独立执行项。本轮修复集成包 R5 后遗留的 **2 处副本漂移**（`integration/data/achievements.json` / `emoticons.json` 与真源对齐，R13 v1.2.0 增量），刷新 manifest 24 文件哈希；`verify_integration.py` 全项 PASS、`smoke_integration.mjs` 12/12 PASS、`validate_achievements.py` 25/25 PASS；新增 [`docs/20-R17集成包同步与主线健康复核.md`](docs/20-R17集成包同步与主线健康复核.md)；8 项待拍板事项原样挂账至 R18；数值 / 素材 / 引擎零改动。

> **R18 迭代（2026-10-10）**：**三分轮状态复核与 R17 提交遗漏收口** —— 用户指令按 README 分轮计划推进三分轮；核实确认三分轮已于 R5 全部完成并合入主线（git 链复验：`master = 68e535c`），R18 计划 8 项全部待用户拍板。本轮收口 `docs/20` 缺失的 12 行 AIGC 元数据补录，`validate_achievements.py` 25/25 PASS、`smoke_test.js` 全绿；8 项待拍板事项原样挂账至 R19；数值 / 素材 / 引擎零改动。

> **R19 迭代（2026-10-10）**：**A 类 10 张独立复审与拍板证据补强** —— 用户指令按 README 分轮计划推进三分轮；核实确认三分轮已于 R5 全部完成并合入主线（git 链复验：`master = 5db4d45`），R19 计划 8 项全部待用户拍板、无可本地独立执行项。本轮按「未拍板前继续证据补强」对 A 类 10 张做独立视觉复审 + 只读尺寸测算：官方性 10/10 通过（无 AI / 同人痕迹）；**A1~A8 角色识别与 docs/14 初审存在分歧**（两轮均为视觉模型判定、均不替代用户终审）；**水印覆盖面扩大**（A1~A8 共 8 张含七点 GAME 水印，docs/14 仅记 A1/A7）；尺寸层面支持 docs/19 §3 去向分配，但卡面候选归属以人工终审角色为准。新增 [`docs/21-A类10张独立复审与尺寸测算.md`](docs/21-A类10张独立复审与尺寸测算.md)，收口 `verify_report.json` 本地刷新；`validate_achievements.py` 25/25 PASS、`smoke_test.js` 全绿、`verify_integration.py` 全项 PASS、`smoke_integration.mjs` 12/12 PASS；8 项待拍板事项原样挂账至 R20，并新增提请用户对 A1~A8 做角色终审；数值 / 素材 / 引擎零改动。

---

## P0 · 目录骨架与规划文档 ✅

**任务划分**

- [x] 建立 `six-system-arena/` 目录树（`ui / data / docs / vendor`）
- [x] 撰写项目总览 `README.md`（目标、红线、目录、快速开始、每轮记录入口）
- [x] 撰写本计划 `PLAN.md`
- [x] 撰写自动化清单 `AUTOMATION.md`
- [x] 撰写分支策略 `BRANCHING.md`
- [x] 建立 `CHANGELOG.md` 并记录本轮清单

**验收标准**：文档齐备、中文、路径准确、红线明确。

---

## P1 · 六系图标接入 ✅

**任务划分**

- [x] 读取官方 `cards\{metal,wood,water,fire,earth,space}.svg`
- [x] 生成自包含模块 `ui/six-system-icons.js`，统一 key：`jin / mu / shui / huo / tu / kongjian`
- [x] 渐变色 `id="bg"` 去重（重命名为 `ssBg-<key>`），避免多实例内联时相互覆盖
- [x] 提供 `registerIcons()` 零侵入注入 `window.LXHUI.ICONS`
- [x] 交付 `data/scripts/patch_lxh_icons.py`（物理补丁能力：备份 + 只增 6 键 + 校验 + 回滚）
- [x] 交付 `ui/SixSystemPanel.js`（复用 `wuxingSVG()` / `radar6()`）

**验收标准**：`window.LXHUI.ICONS['jin']` 等六键可取用；原 21 键一字未动；面板可独立渲染。

---

## P2 · 数值模型与推导脚本 ✅

**任务划分**

- [x] 定义 `data/six-systems.json`（六系名称、图标 key、颜色、能力域、克制关系）
- [x] 定义 `data/stat-model.json`（hp/attack/defense 基线、element 推导词表、realm 分档、稀有度分层）
- [x] 编写 `data/scripts/generate_stats.py`（只读 v4，输出标准 JSON）

**数据源（只读）**

| 表 | 行数 | 用途 |
| --- | --- | --- |
| `characters` | 488 | 角色主表（`abilities_summary` 483 条有值） |
| `character_abilities` | 191 | 能力明细（77 个角色有明细） |
| `ability_branches` | 8 | 能力体系分支（御灵 / 生灵 / 造物 / 空间 / 心灵 / 锁御 / 强化 / 治愈） |
| `cultivation_realm` | 6 | 境界（练气 / 筑基 / 金丹 / 元婴 / 化神 / 渡劫） |

**验收标准**：脚本可重复执行，同输入同输出（确定性），不写库。

---

## P3 · 主线角色试跑 ✅

**主线名单（type ∈ 主角 / 核心角色 / 重要角色）**

| id | 角色 | 体系 | 六系归属 |
| --- | --- | --- | --- |
| 1 | 罗小黑 | 御灵系·金 + 空间系·传送（原双空间系） | 金 / 空间 |
| 2 | 无限 | 御灵系·金 + 空间系·吞噬 | 金 / 空间 |
| 3 | 风息 | 御灵系·木 + 生灵系·豪夺 | 木 |
| 4 | 老君 | 六大系皆有涉猎，主修心灵系，锁御系为佼佼者 | 全系 |
| 6 | 阿根 | 御冰御火 | 水 / 火 |
| 7 | 谛听 | 御灵系·火 | 火 |
| 12 | 玄离 | 御灵系·火 + 冰（双属性） | 火 / 水 |
| 13 | 洛竹 | 御灵系·木 | 木 |
| 14 | 哪吒 | 御灵系（火）+ 生灵系 + 锁御系 | 火 |
| 15 | 虚淮 | 御灵系（水 / 冰） | 水 |
| 18 | 比丢 | 吞噬 | 空间 |
| 23 | 潘靖 | 生灵系 + 心灵系 | 无（辅助型） |
| 31 | 花轮 | 空间系·蕴藏 | 空间 |
| 139 | 羽夕 | 生灵系·隐匿 + 强化系 | 无（辅助型） |

**验收标准**：主线角色 100% 生成数值，无非空字段，试跑抽样 3 例人工可核对。

---

## P4 · 全量角色铺开 ✅ R5 完成

- [x] 488 角色全量数值生成（`data/generated/character_stats.json`，scope=all）
- [x] 卡组分配：`data/decks.json`，1 主将 + 技能（R2 / SR3 / SSR4 / UR4 上限）+ 1 羁绊，主系卡 ≥ 60%
- [x] 产出数值与卡组审计报告（`data/audit/r2-audit.md`：极值、断层、稀有度分布、主系占比）
- [x] **稀有度分布校准落地（R5 · 非数值手段）**：不改 `hp/atk/def/power/tier/rarity`，以「获得节奏分层」收敛玩家侧稀缺度 ——
      按 `power` 降序切分 P4 5（UR1/SSR3/SR1，里程碑 3）/ P3 44（SR44，里程碑 2）/ P2 146（SR21/R125，里程碑 1）/ P1 293（R293，初始）；
      规则固化于 `decks.json` 的 `rules.acquisition_pacing`，实得投放节奏违规 **0 例**，稀有度×节奏单调性由校验器硬约束。
- [x] **技能卡完善（R5）**：三来源分层（`character_ability` 131 / `primary_fallback` 177 / `generic_fallback` 742，共 1050 张）、
      逐张 `tags` 标注、组内同名保序去重（补位池每系扩至 3–4 条，池尽追加 `·改N`），修复 41 例组内同名缺陷 → 现 **0 例**
- [x] **数值零漂移验证（R5）**：`validate_achievements.py` 逐条比对 488 套卡组与数值产物的 hp/attack/defense/power/tier/rarity，差异 **0 处**
- [ ] 待拍板：稀有度分布是否需在后续轮次追加「卡面分级展示」以进一步贴近 60/30/9/1 感知（当前仅以投放节奏校准）

---

## P5 · 对战系统落地 🔷 R2 完成（内核）

- [x] `ui/battle-engine.js`：确定性内核（种子复现）、回合上限 30、能量、暴击、领域终极技
- [x] 六系克制环生效（金→木→土→水→火→金，×1.25 / ×0.85；空间系免克制 + 穿透 20% 防御）
- [x] 与官方角色对战（按 tier 抽选，story / arena / challenge 三模式）
- [x] 与自身镜像对战（对手为卡组精确副本，回合上限 20、能量上限 12）
- [ ] 平衡性调优：胜率区间目标 45%~55%（需在站点实测样本上回归）
- [x] R13：胜率本地模拟回归先行（`data/scripts/sampled_winrate_regression.js` + `data/generated/winrate/` 报告，抽样 300 场 + 镜像 20 场，复跑可复现；结论仅记录不改数值）——主战 99.00% / 镜像 60.00%，偏离目标，站点实测样本回收仍需 P7 挂载后执行
- [x] R24：三分轮状态复核 + R23 提交遗漏收口（4 文件 AIGC 元数据补录合入）+ 主线健康复核（四套回归全绿，数值框架零改动）
- [x] R25：三分轮状态复核 + 主线健康复核 + 提交遗漏收口检查（四套回归全绿，数值框架零改动；新增 docs/24 收口记录）
- [x] R26：三分轮状态复核 + 主线健康复核 + 提交遗漏收口检查（四套回归全绿，数值框架零改动；docs/24 外层 AIGC 元数据补录与 sampled_winrate_regression.js 误删恢复收口；新增 docs/25 收口记录）
- [x] R14：胜率报告独立复核（`docs/18 §2`：独立脚本复现 300 场 99.00% / 镜像 60.00% / 分档逐项一致，报告可信可复现；结论仅记录不改数值）
- [x] R15：待拍板决策总览（`docs/19`：8 项逐项证据 + 方案 + 建议；6 张源图只读尺寸测算；`validate_achievements.py` 25/25 / `smoke_test.js` 全绿；拍板入口 §9；未替用户拍板、数值零改动）
- [x] R16：三分轮完成度核实与 AIGC 元数据收口（docs/17/18/19 各 +12 行补录纳入主线；validate 25/25 / smoke 全绿；数值零改动）
- [x] R17：集成包同步与主线健康复核（docs/20；integration/data 2 处漂移收口；verify 全项 PASS / smoke_integration 12/12；数值零改动）

---

## P6 · 收集类成就玩法 🔷 R5 完成 / R9 素材扩容（端侧授权采集待补）

- [x] `data/achievements.json`：15 条收集类成就（角色 4 / 六系 3 / 战斗 4 / 稀有度 4），含条件、奖励、进度字段
- [x] `ui/achievement-system.js`：读战斗日志契约字段判定 + 收集图鉴（六系 / 稀有度 / 分档 / 主线四视图）
- [x] 胜利结算 `ui/settlement.js`：罗小黑 + 比丢登场（3s 时间轴）+ 正向反馈文案池
- [x] 失败结算：小黑安慰表情包（官方图）+ 不惩罚 + 一键「再来一次」
- [x] 素材合规校验（对照 `docs/05` 白名单，排除 ai-art / 同人图）
- [x] R5：平局独立轨 `buildDraw()`（1800ms / 不判负 / 不惩罚 / 无素材引用），结算三轨齐备
- [x] R5：表情包素材台账 `data/emoticons.json` + 说明 `docs/10`（5 官方渠道 / comfort 3 + entrance 3 / 逐张审查留痕 / 未决挂账 4 项）
- [x] R5：结算表情图改为台账驱动（`loadEmoticons()` / `isOfficialPath()` 官方路径白名单，未登记或不合规图不入池）
- [x] R9：表情包专项本地库复用扩容（`emoticons.json` v1.1.0，comfort 3→6 / celebration 0→1，`docs/10` 审查留痕 6→11 条；联网核实 QQ 表情商城官方专辑「罗小黑1」免费可下载，非官方一手转载站全部排除、零采图）
- [x] R10：通用图集 61 张逐张视觉初审（`docs/14`：A 通过 10 / B 待人工复核 39 / C 排除 12；同人 / AI 生成 / 第三方署名按红线排除；数值框架零漂移）
- [x] R11：通用图集 B 类 39 张两轮 AI 复核（`docs/15`：一致 33 / 存疑 4 / 不一致 2；入池与存疑终审均待用户拍板；数值框架零漂移）
- [x] R12：存疑 4 + 不一致 2 第三轮终审（`docs/16`：B3 黑熊精 / B5 冠萤 / B12 老君 / B32 风息 / B1 疑似谛听 / B36 场景特写，画面角色全部查实；改名 / 裁切方案待用户拍板；数值框架零漂移）
- [x] R13：表情素材复审留痕收口（`emoticons.json` v1.2.0：通用图集首批 5 张判定不适配、娘化 gif 维持 pending；comfort 6 / entrance 3 / celebration 1 不变）；`achievements.json` v1.2.0 新增 `alt_paths`（BAL-R8-01 非对抗替代路径 3 条，成就保持 15 条、数值零改动）；详见 `docs/17`
- [x] R14：升 A 候选 6 张终审对照（`docs/18 §1`：B8 / B26 / B30 / B38 / B39 角色对应获佐证、B26 漏标「虚淮」、B37 实为「并肩同行」预告封面文案不符；全部官方画面无 AI 痕迹、无同人 / 第三方署名；入池 / 改名 / 裁切待用户拍板；数值框架零改动）
- [x] R15：待拍板决策总览（`docs/19`：8 项待拍板逐项证据 + 方案 + 建议；6 张源图只读尺寸测算；`validate_achievements.py` 25/25 / `smoke_test.js` 全绿；未替用户拍板、数值框架零改动）
- [x] R16：三分轮完成度核实与 AIGC 元数据收口（docs/17/18/19 各 +12 行补录纳入主线；validate 25/25 / smoke 全绿；数值零改动）
- [x] R17：集成包同步与主线健康复核（docs/20；integration/data 2 处漂移收口；verify 全项 PASS / smoke_integration 12/12；数值零改动）
- [x] R18：三分轮状态复核与 R17 提交遗漏收口（docs/20 AIGC 元数据补录；validate 25/25 / smoke 全绿；数值零改动）
- [x] R19：A 类 10 张独立复审与拍板证据补强（docs/21：官方性 10/10 通过、A1~A8 角色识别分歧待人工终审、水印覆盖面扩大；只读尺寸测算；validate 25/25 / smoke 全绿 / verify 全项 PASS / smoke_integration 12/12；数值零改动）
- [ ] **官方表情包专项目录（端侧授权部分）待采集**：QQ / 微信表情商城官方表情包须端侧授权导出；`罗小黑_娘化形象.gif` 带文字文案、通用图集 B 类 39 张人工复核与 A 类 10 张入池去向，均待用户拍板（台账 `pending` 5 项）。

---

## P7 · 站点集成（zszm 端口）🔷 R4 集成包交付（待站点挂载）

- [x] 定位 zszm 端口游戏 UI，产出 `docs/07-站点集成方案.md`（UI 地图 + 接入点 + 三方案 + 短分支 + 回滚）
- [x] 确认零映射成本：站点 `Element`（jin/mu/shui/huo/tu）与 `AbilitySystem.kongjian` 与图标 key 同名
- [ ] 卡牌游戏：数值 + 六系图标接入（方案 A/B，分支 `feat/sixsys-icon-mount`）
- [ ] 经营游戏：六系属性作为经营加成维度（分支 `feat/sixsys-radar-panel`）
- [ ] 模拟游戏：六系雷达面板接入角色详情页（分支 `feat/sixsys-radar-panel`）
- [ ] 集成前完整回归，确保不触碰参考仓库既有变更
- [x] R4：集成包落盘 `integration/`（js / src / data / styles / verify / tools / README / INTEGRATION-ZSZM）
- [x] R4：`sync_from_arena.ps1` 源路径修复并验证；`manifest.json` 哈希刷新 23 文件
- [x] R4：`verify_integration.py` 18/18 通过；`smoke_integration.mjs` 11/11 通过
- [x] R4：`docs/09-站点集成安装手册.md` 编号规范化（原时间戳副本）
- [ ] **待站点侧挂载**：复制 4 组文件 + 入口引两行（方案 A，零侵入，约 0.5 天）
- [x] R5：集成包同步 R5 增量（24 文件；`verify_integration.py` 22 项 / `smoke_integration.mjs` 12 项全通过；`src/sixsys-assets.ts` 官方白名单扩至 6 张，新增 `luoxiaohei_face_03`）
- [x] R17：集成包同步与主线健康复核（docs/20；integration/data 2 处漂移收口——R13 v1.2.0 增量（achievements alt_paths / emoticons 复审留痕）；manifest 刷新 24 文件；verify 全项 PASS / smoke_integration 12/12；数值零改动）

---

## P8 · 工作副本切换与现有数值登记 ✅ R3 完成

- [x] 工作副本裁定：E 盘 `E:\Projects\New project\six-system-arena\` 为唯一工作副本
- [x] D 盘第 1 轮成果迁入 `legacy/d-drive-r1/`（48 文件 / 3.57 MB，排除 `.git` / `node_modules`），含 `MIGRATION.md`
- [x] D 盘目录保留不删，标记为旧副本；两库 sha256 分叉裁定写入 README §0
- [x] README 更新：工作副本声明、数据库指向（E 盘 v4）、目录树、参考表
- [x] 站点现有 demo 数值登记：`docs/08-现有游戏数值基线登记.md` + `data/demo-baseline.json`
- [x] 字段对照结论：`Element` / `Card.school` 零映射可复用；六系分值为新增维度；不改动站点数值框架
- [ ] **待站点发版重登记**：站点若发布新平衡版本，需重跑 `docs/08 §7` 复核命令并更新 `demo-baseline.json`

---

## P9 · 端到端联调链路 ✅ R8 完成

- [x] 联调脚本 `data/scripts/e2e_flow.js`（零依赖 Node；只读 `data/` + `ui/`，只写 `data/generated/e2e/`）
- [x] 战斗日志契约落盘样例：`data/generated/e2e/battle-log-sample.jsonl`（8 条，字段与顺序逐字比对 `docs/04 §5`）
- [x] 全 15 条成就逐条覆盖验证（角色 4 / 六系 3 / 战斗 4 / 稀有度 4；真实对局优先，本轮 106 场全真实、合成 0）
- [x] 图鉴四视图渲染自检（分组数 / 组内条目 / label / pct / 合计 = 488 五项校验，全 PASS）
- [x] 镜像战（`opponent_type = mirror`）不计入角色收藏的回归
- [x] 一键链路并联：`scripts/run_all.ps1` 扩展为 7 步，`7/7 PASS`
- [x] 文档 `docs/12-端到端联调记录.md`
- [ ] R9 议题：`BAL-R8-01` 顶级档位落差评估 / 「击败无限」非对抗类替代路径（待拍板）
- [x] R13：`BAL-R8-01` 替代路径数据定义已入库（`achievements.json` v1.2.0 `alt_paths`，3 条非对抗替代路径，成就保持 15 条、数值零改动）；**是否启用待用户拍板**
- [ ] R9 议题：站点实测胜率样本回收，回归 P5 的 45%~55% 平衡目标
- [x] R13：胜率本地模拟回归先行（`data/generated/winrate/winrate-regression-report.json`，主战 99.00% / 镜像 60.00% 偏离目标，仅记录不改数值）；站点实测样本回收仍需 P7 挂载后执行
- [x] R16：三分轮完成度核实与 AIGC 元数据收口（docs/17/18/19 各 +12 行补录纳入主线；validate 25/25 / smoke 全绿；数值零改动）

---

## 里程碑与依赖图

```
P0 ──► P1 ──► P2 ──► P3 ──► P4 ──┬──► P5 ──┐
                                  └──► P6 ──┴──► P7
P5 + P6 ──► P9（端到端联调 · R8）
```

## 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| 六系归属推导误判 | 卡组/克制错误 | 保留 `element_source` 字段，记录命中关键词与置信度，支持人工覆写 |
| 数据库中 `character_stats` 为空 | 无现成数值基线 | 由 `stat-model.json` 规则推导，产出全部落在本目录，不写库 |
| 共享 UI 文件被改动 | 污染参考仓库 | 默认零侵入注入；物理补丁需显式执行 `--apply` 且自动备份 |
| 素材合规风险 | 侵权 / 违规 | 严格执行 `docs/05` 白名单，AI 目录一律排除 |
| 主仓库工作区较脏 | 分支操作风险 | 见 `BRANCHING.md`：本轮不切分支，产物落盘待提交 |
| 主库分叉误用（D / E 两库） | 派生数据不可比对 | R3 已裁定 **E 盘库为工作副本唯一数据源**；D 盘库仅历史比对，禁止混用 |
| 站点 demo 基线漂移 | 登记结论过期 | 站点发版后重跑 `docs/08 §7` 复核命令并更新 `data/demo-baseline.json` |
| D 盘快照被误当数据源 | 数据双源冲突 | `legacy/d-drive-r1/` 标记为只读快照，`MIGRATION.md §5` 明令不参与构建 |
| 站点侧挂载未执行（R4） | 集成包无法在线上验证 | 按 `integration/INTEGRATION-ZSZM.md` §2–§5 挂载；未挂载期间对现有站点零影响、可一键回滚 |
| 稀有度实得分布偏离设计目标（R 85.7% vs 60%） | 玩家感知「全是普通卡」 | R5 以**非数值手段**收敛：按获得节奏分层投放（P4 5 / P3 44 / P2 146 / P1 293）+ 里程碑前置，数值字段零改动 |
| 获得节奏分层被误用为数值改动 | 破坏「不改既有数值框架」红线 | `validate_achievements.py` 新增「数值框架零漂移」硬校验（逐条比对 488 套卡组六字段）+ 「校准声明未触碰数值字段」声明校验，任一漂移即失败退出 |
| 技能卡组内同名（补位未去重） | 卡组出现重复技能、观感与结算异常 | 补位池扩至每系 3–4 条并采用确定性 `next_pool_name` 去重（池尽追加 `·改N`）；校验器新增同名去重硬校验，现 0 例 |
| 顶级档位落差过大（R8 实测） | 主线收官「击败无限」只能经自身对战达成，玩法单薄 | 记 `BAL-R8-01` 转 R9：评估 A 档（无限 · power 6189）与次强档位落差，或补非对抗类替代路径；**不在 R8 改动数值** |
| 联调 / 冒烟职责重叠 | 维护双份断言、结论不一致 | 分工固化：冒烟 = 模块级抽样快检（12 段），端到端 = 契约 / 全量成就 / 四视图全量自检；两者同入 `run_all.ps1` 链路，任一失败即整体失败 |
*（内容由AI生成，仅供参考）*
*（内容由AI生成，仅供参考）*
*（内容由AI生成，仅供参考）*
