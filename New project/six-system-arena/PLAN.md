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
| P4 | 全量角色铺开 | 488 角色数值 + 卡组分配 | P3 | 🔷 R2 完成（稀有度校准待 P3 平衡） |
| P5 | 对战系统落地 | 与官方角色 / 自身对战，卡组平衡调优 | P4 | 🔷 R2 完成（内核已交付，胜率调优待实测） |
| P6 | 收集类成就玩法 | 胜利放小黑与比丢 + 正向反馈；失败小黑安慰 | P4 | 🔷 R2 完成（官方表情包待采集） |
| P7 | 站点集成（zszm 端口） | UI 组件 + 图标在卡牌 / 经营 / 模拟三系统上线 | P5、P6 | 🔷 R4 集成包交付（integration/），待站点挂载 |
| P8 | 工作副本切换与现有数值登记 | `legacy/d-drive-r1/`、`docs/08`、`data/demo-baseline.json` | P0 | ✅ R3 完成 |

> **R3 迭代（2026-10-06）**：工作副本正式切至 E 盘；D 盘 `D:\Projects\new project` 保留为旧副本，
> 其 R1 成果快照至 `legacy/d-drive-r1/`；登记站点现有 demo 数值为参考基线（`docs/08` + `data/demo-baseline.json`），
> 确认六系分值为新增维度、**不改动站点既有数值框架**。

> **R4 迭代（2026-10-05）**：交付 `integration/` 集成包（运行时 JS + TS 接入层 + 数据 + 样式 + 校验工具 + 交付级安装指南 `INTEGRATION-ZSZM.md`），
> 修复同步脚本路径缺陷与校验器三处误报，静态自检 18/18、运行时冒烟 11/11 全通过。
> 站点侧挂载**尚未执行**（涉及正式工程写入，待拍板）；详见 [`CHANGELOG.md`](CHANGELOG.md) 的 R4 一节。

> **R2 迭代（2026-10-05）**：完成 `data/decks.json`、`data/achievements.json`、`ui/battle-engine.js`、
> `ui/achievement-system.js`、`ui/settlement.js`、`scripts/run_all.ps1`、`data/audit/r2-audit.md`，
> 并新增 `data/scripts/{generate_decks.py, validate_achievements.py, audit_r2.py, smoke_test.js}`。
> 详见 [`CHANGELOG.md`](CHANGELOG.md) 的 R2 一节。

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

## P4 · 全量角色铺开 🔷 R2 完成

- [x] 488 角色全量数值生成（`data/generated/character_stats.json`，scope=all）
- [x] 卡组分配：`data/decks.json`，1 主将 + 技能（R2 / SR3 / SSR4 / UR4 上限）+ 1 羁绊，主系卡 ≥ 60%
- [x] 产出数值与卡组审计报告（`data/audit/r2-audit.md`：极值、断层、稀有度分布、主系占比）
- [ ] **稀有度分布校准未达标**：实得 R 418 / SR 66 / SSR 3 / UR 1（R 占 85.7%，目标 60%）——源于世界观样本中大量低战力条目；审计报告建议以「非主线初始只开放 2 张技能卡」的解锁节奏平衡，而非改数值，待 P3 拍板。

---

## P5 · 对战系统落地 🔷 R2 完成（内核）

- [x] `ui/battle-engine.js`：确定性内核（种子复现）、回合上限 30、能量、暴击、领域终极技
- [x] 六系克制环生效（金→木→土→水→火→金，×1.25 / ×0.85；空间系免克制 + 穿透 20% 防御）
- [x] 与官方角色对战（按 tier 抽选，story / arena / challenge 三模式）
- [x] 与自身镜像对战（对手为卡组精确副本，回合上限 20、能量上限 12）
- [ ] 平衡性调优：胜率区间目标 45%~55%（需在站点实测样本上回归）

---

## P6 · 收集类成就玩法 🔷 R2 完成（素材待补）

- [x] `data/achievements.json`：15 条收集类成就（角色 4 / 六系 3 / 战斗 4 / 稀有度 4），含条件、奖励、进度字段
- [x] `ui/achievement-system.js`：读战斗日志契约字段判定 + 收集图鉴（六系 / 稀有度 / 分档 / 主线四视图）
- [x] 胜利结算 `ui/settlement.js`：罗小黑 + 比丢登场（3s 时间轴）+ 正向反馈文案池
- [x] 失败结算：小黑安慰表情包（官方图）+ 不惩罚 + 一键「再来一次」
- [x] 素材合规校验（对照 `docs/05` 白名单，排除 ai-art / 同人图）
- [ ] **官方表情包专项目录待采集**：当前失败结算复用 `images\罗小黑\罗小黑_表情_08x.jpg` 官方表情立绘；专项采集须走 `docs/05` §5 审查流程并登记来源凭证。

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

## 里程碑与依赖图

```
P0 ──► P1 ──► P2 ──► P3 ──► P4 ──┬──► P5 ──┐
                                  └──► P6 ──┴──► P7
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
*（内容由AI生成，仅供参考）*
*（内容由AI生成，仅供参考）*
