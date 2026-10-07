---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_9c4b56d5c15111f1887c525400de85a5
    ReservedCode1: w9j3ax+36CinUBigp4bGdUNLrta1p49jXrV6t2kH/U3hjGh36LzXHc6iU7dWDKhr8QHHtDgqThCE87X0n+9nTqrq6Rk9MWooLpp+Fe5lUtqSJ6tFayMHiEmZs62cQXIFijklJk3ueuiGcr/G0WjISvZYm4jCkyTXUj+ZcSsxDJPuC01zfzx9JGpM1jE=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_9c4b56d5c15111f1887c525400de85a5
    ReservedCode2: w9j3ax+36CinUBigp4bGdUNLrta1p49jXrV6t2kH/U3hjGh36LzXHc6iU7dWDKhr8QHHtDgqThCE87X0n+9nTqrq6Rk9MWooLpp+Fe5lUtqSJ6tFayMHiEmZs62cQXIFijklJk3ueuiGcr/G0WjISvZYm4jCkyTXUj+ZcSsxDJPuC01zfzx9JGpM1jE=
---

---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_2f363280c0ee11f1884b525400cd780f
    ReservedCode1: U2FCD7fEUS/97kKH2LbQbFynNvOBpNwVPYVl77SnC8SJ/HTiuTvhPv/+lvCYdklNNBFSRns6LiL2kfr0MsBGVatT8WuI2MyUZC7q+rtB2Yg/dXWFjVgfGcJ+orRKvTPhMK3JgHzXRDDctpumHKEAju406dWnUZazoZdBEP4Jam8IAZPgxdKnKBm1Z1I=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_2f363280c0ee11f1884b525400cd780f
    ReservedCode2: U2FCD7fEUS/97kKH2LbQbFynNvOBpNwVPYVl77SnC8SJ/HTiuTvhPv/+lvCYdklNNBFSRns6LiL2kfr0MsBGVatT8WuI2MyUZC7q+rtB2Yg/dXWFjVgfGcJ+orRKvTPhMK3JgHzXRDDctpumHKEAju406dWnUZazoZdBEP4Jam8IAZPgxdKnKBm1Z1I=
---

# CHANGELOG · 六系演武

> 每轮迭代结束必须在此追加一节，并同步勾选 `PLAN.md` 的阶段进度。

---

## R1 · 2026-10-05 · 第一轮基础建设

**范围**：在 `E:\Projects\New project\six-system-arena\` 内完成目录骨架、六系图标接入、数值模型试跑、设计文档六篇。
**约束遵守**：所有新建内容均在本目录内；`D:\Projects\zszm` 与 `E:\Projects` 既有未提交变更（各 7 处）未被触碰；`worldview_luoxiaohei_v4.db` 全程只读。

### 1. 规划文档（根目录）

| 文件 | 说明 |
|---|---|
| `README.md` | 项目总览、目标、六系红线、目录说明、快速开始、每轮记录入口 |
| `PLAN.md` | 分阶段计划与任务划分（主线优先：小黑 / 无限 / 风息等） |
| `AUTOMATION.md` | 自动化脚本清单、用法、建议调度 |
| `BRANCHING.md` | 短 git 分支策略 `feat/sixsys-<topic>`、脏工作区处理约定 |

### 2. 六系图标接入

| 文件 | 说明 |
|---|---|
| `ui/six-system-icons.js`（4,953 B） | 六系图标自包含模块；统一 key `jin/mu/shui/huo/tu/kongjian`；加载后零侵入注册到 `window.LXHUI.ICONS` |
| `ui/SixSystemPanel.js`（10,715 B） | 数值面板组件：六系雷达 + 五行星图 + 图标 + 属性条；复用 `LXHUI.radar6()` / `wuxingSVG()`，缺失时内置降级 |
| `data/scripts/patch_lxh_icons.py`（8,692 B） | `lxh-ui.js` 六键增量补丁工具（dry-run / apply / rollback，含 sha256 备份与写回校验） |
| `vendor/backup/lxh-ui.js.bak-20261005-192017.js`（25,566 B） | 补丁前快照，sha256 前缀 `78c96f2b544c4d19` |
| `vendor/backup/lxh-ui.backup-index.json` | 备份索引 |

**补丁执行结果**：`E:\Projects\shared\shared-ui\lxh-ui.js` 由 25,566 B → 29,848 B（+4,270 字符；diff 7 增 1 改）。原 21 键完好、新增 6 键；`node --check` 语法通过。回滚命令：`python data\scripts\patch_lxh_icons.py --rollback`。

### 3. 数值模型

| 文件 | 说明 |
|---|---|
| `data/stat-model.json`（6,759 B） | 境界档位、系别偏向、定位加成、能力加成、战力公式、分档阈值、稀有度映射、人工校准接口 |
| `data/six-systems.json`（4,468 B） | 六系定义、图标 key、颜色映射、世界观写法 |
| `data/scripts/generate_stats.py`（15,480 B） | 只读 v4 数据库 → 推导六系 / 境界 / hp / atk / def / 战力 / 分档；确定性扰动 |
| `data/manual-overrides.json`（540 B） | 人工校准表（已录入老君、潘靖两条纠偏） |
| `data/generated/character_stats.json`（353,533 B） | **全量 488 名角色**数值产物 |

**首轮产数分布**：境界 `练气 234 / 筑基 110 / 金丹 74 / 元婴 51 / 化神 14 / 渡劫 5`；分档 `F 344 / E 74 / D 51 / C 15 / B 3 / A 1`；六系覆盖 `金 33 / 木 29 / 水 27 / 火 21 / 土 9 / 空间 47`。
**主线样例**：无限（渡劫 / A / 6189）、老君（化神 / B / 4818）、玄离（化神 / C / 4547）、罗小黑（化神 / C / 4457）、比丢（元婴 / D / 3027）。

### 4. 设计文档（docs/）

| 文件 | 主题 |
|---|---|
| `docs/01-数值模型.md` | 五要素、境界档位、公式、分档、置信度、人工校准、扩展点 |
| `docs/02-六系图标接入.md` | 图标来源、统一 key、三个接入点、补丁四道防线、组件 API |
| `docs/03-对战系统.md` | 六系克制环、卡组分配（主将 + 技能 + 羁绊）、官方角色对战与镜像战、结算 |
| `docs/04-成就系统.md` | 收集类成就目录；胜利"小黑 + 比丢"登场正向反馈；失败小黑表情包安慰 |
| `docs/05-素材白名单.md` | 官方素材白名单（镜像 1,557 张 / character_img 26 / 节气贺图 384）与排除清单（ai-art、ai-avatars、AI image、同人图） |
| `docs/06-数据源与回滚.md` | 主库只读说明、表结构、回滚点、回滚操作、数据血缘 |

### 5. 本轮已知问题 / 待办

1. **系别判定精度**：`罗小白`、`山新` 等无系角色存在启发式误判风险；`低置信度`角色建议在 P2 批量人工复核并写入 `manual-overrides.json`。
2. **官方表情包缺位**：失败结算所需的小黑安慰表情包尚未采集，`docs/05` 已给出审查流程；到位前用官方立绘裁切兜底。
3. **共享库变更待处理**：`lxh-ui.js` 现处已修改未提交状态，是否提交由用户决定。
4. **卡组分配算法**：`docs/03` 已给出规则，尚未落成数据文件（P1 产出 `data/decks.json`）。
5. **成就数据文件**：`data/achievements.json` 待建（P1）。

---

## R2 · 2026-10-05 · 第二轮系统落地（数值 → 卡组 → 对战 → 成就 → 结算 → 审计）

**范围**：把 R1 的数值与设计文档落成可运行的**卡组数据 + 对战内核 + 成就判定 + 胜负结算 + 一键自动化 + 审计报告**。
**约束遵守**：所有新建内容均在本目录内；`E:\Projects\shared\shared-ui`、`D:\Projects\zszm`、`E:\Projects\assets` 全程只读，未做任何写入；`worldview_luoxiaohei_v4.db` 只读访问；未做任何联网表情包采集（沿用官方立绘，红线不触碰）。

### 1. 交付物清单

| 文件 | 大小 | 说明 |
|---|---|---|
| `data/decks.json` | 1,497,334 B | 488 名角色卡组：主将 + 技能 + 羁绊，含 `rules` / `skill_profiles` / `generic_skills` / `bonds` / `faction_bonds` / `ultimates` 规则表 |
| `data/achievements.json` | 12,921 B | 收集类成就全量定义 15 条（角色 4 / 六系 3 / 战斗 4 / 稀有度 4），含条件、奖励、进度 metric、图鉴结构 |
| `ui/battle-engine.js` | 23,492 B | 确定性对战内核：`simulate` / `createMirrorBattle` / `runToEnd` / `elementFactor` / `toLogRecord` / `verifyDeterminism` / `indexDecks` |
| `ui/achievement-system.js` | 18,369 B | 成就判定（只读战斗日志契约字段）+ 收集图鉴四视图 + 解锁统计 |
| `ui/settlement.js` | 11,657 B | 胜负结算：胜 = 小黑 + 比丢 3s 登场 + 正向文案池；负 = 安慰表情包 + 不惩罚 + 一键再来 |
| `scripts/run_all.ps1` | 9,836 B | 一键串联 6 步：数值生成 → 卡组生成 → 成就校验 → 审计 → JS 语法自检 → 冒烟测试 |
| `data/audit/r2-audit.md` | 10,067 B | 数值与卡组审计报告（极值 / 分档 / 稀有度 / 断层 / 六系 / 卡组 / 素材 / 成就可达性 / 结论） |
| `data/scripts/generate_decks.py` | 18,457 B | 卡组生成器（规则表驱动，确定性） |
| `data/scripts/validate_achievements.py` | 10,824 B | 成就定义 / 卡组规则 / 素材路径三合一校验 |
| `data/scripts/audit_r2.py` | 21,954 B | 审计报告生成器（零依赖，含成就可达性静态检查） |
| `data/scripts/smoke_test.js` | 8,513 B | 三模块联动冒烟测试（Node，零依赖，26 项断言） |

### 2. 关键实现口径

- **卡组结构**：`1 主将 + N 技能 + 1 羁绊`，`deck_size = 6`；技能槽按稀有度上限 **R2 / SR3 / SSR4 / UR4**；主线 30 名 `unlocked = total`（`mainline_full`），非主线初始解锁 2 张。
- **主系卡占比**：`primary_skill_ratio ≥ 0.6`，实测有主系角色最低 **67%**、平均 98.1%、违规 **0 例**。
- **克制环**：金→木→土→水→火→金（克制 ×1.25 / 被克 ×0.85）；空间系双向 ×1.00 且**穿透 20% 防御**（`KONGJIAN_PIERCE = 0.20`）；`none` 恒 ×1.00。
- **确定性**：全部随机取自 `seed` 派生的 PRNG，`verifyDeterminism()` 对同输入 3 次模拟结果一致；同种子同卡组必然复现同一场战斗。
- **镜像战**（docs/03 §5.2）：对手为自身卡组精确副本，回合上限 **20**、能量上限 **12**，`opponent_type = 'mirror'`，不计入「角色胜利收藏」。
- **判定前置**：败局 `judged = false`，不触发成就判定、不改收集进度（docs/04 §6）。
- **结算时序**：胜利 3000ms（比丢 0.5s 入场 → 罗小黑 1.5s 入场 → 2.0s 文案 + 收集品入账），成就解锁挂在 `duration_ms` 之后，避免两段动画打架。
- **领域终极技**：docs/03 §8 待确认项 1 按建议**引入**，每场限一次，488 套卡组全覆盖（模板 8 条）。
- **素材**：`罗小黑_全身_085.jpg`（胜方登场）、`比丢.png` / `比丢.gif`（比丢登场）、`罗小黑_表情_087/088.jpg`（失败安慰），**全部为官方白名单原图**，路径经审计脚本存在性核验通过；无 AI 生图、无同人图、无外链。

### 3. 审计结论要点（R2）

| 项 | 结果 |
|---|---|
| 角色 / 卡组规模 | 488 / 488，一一对应，无缺漏 |
| 战力区间 | 636 ~ 6,189（中位 1,002；无限居首 6,189） |
| 分档分布 | F 344 / E 74 / D 51 / C 15 / B 3 / A 1（各档均有覆盖） |
| 稀有度分布 | R 418（85.7%）/ SR 66 / SSR 3 / UR 1 —— **R 占比高于模型目标 60%**，属世界观样本特征，建议用解锁节奏平衡 |
| 六系主属性 | 金 33 / 木 27 / 水 26 / 火 16 / 土 7 / 空间 7 / 无系 372 |
| 断层 | 5 处档位边界断层（最大 D→C 间隔 757），匹配时需按档位抽选规避「跳档」 |
| 立绘覆盖 | 128 / 488（26.2%）命中官方图库，其余回退六系图标占位 |
| 成就可达性 | 15 条中 **1 条静态不可达成**（`金木水火土`：土系最高档仅 D），已报备待拍板 |

### 4. 验证方式与结果

```powershell
powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1"
```

**实测结果：6/6 步全部 PASS，总耗时 1.44s，退出码 0。**
包含：数值生成 0.17s → 卡组生成 0.39s → 成就校验 0.14s → 审计 0.13s → JS 语法自检 5 文件全通过 → 冒烟测试 26 项断言全通过。
**幂等性**：重跑后 `decks.json` 与 `character_stats.json` 除 `meta` 内的时间戳与源库指纹外，内容逐字节一致。

### 5. 本轮已知问题 / 待办

1. **`金木水火土` 成就静态不可达成**：土系 7 名角色最高档仅 D，`min_tier = C` 无法满足。二选一：提升土系角色档位，或放宽该成就门槛。**本轮未改定义，仅报备**。
2. **稀有度分布与模型目标偏差**：R 档 +25.7pp。建议以「非主线初始只开放 2 张技能卡」的解锁节奏平衡，而非改数值。
3. **官方表情包专项目录仍缺位**：失败结算暂用 `images\罗小黑\罗小黑_表情_08x.jpg` 官方表情立绘；若需专用表情包，须走 `docs/05` §5 审查流程并登记来源凭证（本轮**未做任何联网采集**）。
4. **立绘覆盖偏低**：360 名角色未在官方图库命中立绘，卡面需回退六系图标占位，等待 P3 素材增补。
5. **平衡性未实测**：内核已交付，胜率区间 45%~55% 的调优需站点实测样本回归（P7 前）。
6. **对局日志未落盘**：按 docs/03 §6 约定，战斗日志由经营 / 模拟子系统写入，本子系统只定义字段契约，尚未接入。
*（内容由AI生成，仅供参考）*


---

## R2 · 补充 · P7 站点集成方案（2026-10-05）

**范围**：定位 zszm 端口游戏 UI，产出六系数值/图标可视化的可实行方案并落盘 docs/07-站点集成方案.md。

- **UI 定位**：正式站点 E:\Projects\server\app\src\cards\src\game\（D:\Projects\zszm\src\game 为同源参考副本）。
- **关键结论**：站点 Element = 'jin'|'mu'|'shui'|'huo'|'tu'，AbilitySystem 含 kongjian，与六系图标 key **完全同名** → 零映射成本，<LxhIcon name={card.element}/> 可直出。
- **接入点**：LxhIcon.tsx（图标唯一入口，读 window.LXHUI.ICONS）；GameApp.tsx L32 卡面已渲染系名文字；WorldGuide.tsx L17 已有六系词表；core/types.ts 已预留 school/element 字段。
- **三套方案**：A 零侵入（静态资源，0.5 天，推荐先做）／B 组件化（图标徽章 + 六系雷达，1–2 天）／C 数据驱动（卡组 + 成就贯通，3–5 天）。
- **短分支**：eat/sixsys-r2、eat/sixsys-icon-mount、eat/sixsys-radar-panel、eat/sixsys-deck-bind、eat/sixsys-achievement、eat/sixsys-battle-settle。
- **待拍板**：土系成就 ch_system_001 门槛、稀有度分布（R 85.7%）、立绘覆盖（26.2%）、胜率实测回归。
- **红线遵守**：仅官方图、禁 AI 生图；参考仓库只读；git add 精确到 New project/six-system-arena，禁用 -A。

---

## R3 · 2026-10-06 · 工作副本切换至 E 盘 + 现有游戏系统数值登记

**范围**：① 工作副本正式切到 `E:\Projects\New project\six-system-arena\`，D 盘第 1 轮成果迁入 `legacy/d-drive-r1/`；② 更新 README 工作副本声明与数据库指向；③ 登记 zszm 站点现有 demo 数值为参考基线；④ 核对 R1 派生结果与站点 demo 数值的字段关系；⑤ 更新分轮计划与未决项。
**约束遵守**：D 盘目录**保留不删**（仅标记为旧副本）；站点工程 `E:\Projects\server\app\src\cards\` 全程只读，未做任何写入；未触碰既有未提交变更；未做任何联网采集。

### 1. 交付物清单

| 文件 | 大小 | 说明 |
|---|---|---|
| `legacy/d-drive-r1/`（48 文件 / 3.57 MB） | — | D 盘第 1 轮成果只读快照（排除 `.git` / `node_modules`） |
| `legacy/d-drive-r1/MIGRATION.md` | 4,424 B | 迁入说明：来源、时间、文件数、两库分叉裁定、内容地图、使用约束 |
| `docs/08-现有游戏数值基线登记.md` | 9,223 B | 站点 8 文件 / 3 池卡牌 / 18 效果字段 / 战斗经营常量的登记与字段对照 |
| `data/demo-baseline.json` | 5,443 B | 站点 demo 数值结构化登记（供脚本读取，含复用结论与校准路径） |
| `README.md`（更新） | — | 新增「§0 工作副本声明（R3 裁定）」；目录树补 `legacy/`、`docs/07~08`、`data/demo-baseline.json`；参考表补站点工程与旧副本 |

### 2. 关键结论

- **两库分叉裁定**：D 盘 `34EFCB0A…` / E 盘 `EE5B2C1E…`，判定 **E 盘库为工作副本唯一数据源**（只读），D 盘库仅作历史比对；两者**不可混用**。
- **迁入方式**：整目录快照至 `legacy/`，**未覆盖** E 盘 R2 已验收产物（`data/generated/character_stats.json`、`decks.json`、`achievements.json`、`ui/battle-engine.js` 等）；D 盘的外置覆盖层与三层溯源登记为 R4+ 可选吸收项。
- **站点数值性质**：站点 25 基础卡 + 70 legacy 卡 + 3 生态卡、3 名英雄（hp 72/80/76）、18 项效果字段**均为未精校 demo**，且 **无 0–100 六系分值**；`school` / `element` 仅为归属标签。
- **零映射可复用**：`Element`（`jin/mu/shui/huo/tu`）与六系图标 key 同名；`Card.school` 与 `AbilitySystem` 六系 id 同名（`yuling/suoyu/zaowu/xinling/shengling/kongjian`）→ `<LxhIcon name={card.element}/>` 可直出，卡组沿用 `pool()` 过滤语义。
- **需新增**：角色 0–100 六系分值、境界/分档/稀有度/战力（站点均无）；**不改动**站点效果字段上限、英雄 hp、敌人公式与经济常量。
- **legacy 卡标签实测**：`school` 御灵 34 / 生灵 14 / 心灵 6 / 空间 6 / 造物 4 / 锁御 4 / 无 2；`element` 土 8 / 木 7 / 火 7 / 金 6 / 水 6 / 无 36。

### 3. 分轮计划更新

| 轮次 | 主题 | 状态 |
|---|---|---|
| R0 / R1 / R2 | 基础盘点 / 图标与数值 / 卡组·对战·成就·结算 | 已完成 |
| **R3** | **工作副本切换 + 现有数值登记** | **本轮完成** |
| R4 | 站点 P7 接入执行（方案 A 先行）+ 土系成就门槛拍板 + 表情包专项目录 | 待启动 |

### 4. 本轮已知问题 / 待办

1. **土系成就 `ach_system_001` 静态不可达成**：站点侧土系同样偏弱（legacy 卡土系仅 8 张、六系分值维度缺失），R2 已报备的门槛问题维持待用户拍板。
2. **D 盘快照为静态参考**：`legacy/d-drive-r1/` 不随 E 盘演进；如需吸收其外置覆盖层与三层溯源能力，须在 E 盘另建实现。
3. **demo 基线需随站点发版重登记**：站点发布新平衡版本后，应重跑 `docs/08 §7` 复核命令并更新 `data/demo-baseline.json`。
*（内容由AI生成，仅供参考）*

---

## R4 · 2026-10-05 · zszm 集成包交付（交付级安装指南 + 全绿自检）

**范围**：在 `six-system-arena\` 内新增 `integration/` 交付包（运行时 JS + TS 接入层 + 数据 + 样式 + 校验工具 + 安装指南），修复同步脚本路径缺陷，修正校验器误报，收口文档编号。
**约束遵守**：所有新建均在 `E:\Projects\New project\six-system-arena\` 内；站点工程 `E:\Projects\server\app\src\cards\`、`D:\Projects\zszm`、`shared-ui`、v4 数据库全程只读，未做任何写入；未联网采集素材；未提交 git。

### 1. 交付物清单（`integration/`）

| 文件 | 大小 | 说明 |
|---|---|---|
| `INTEGRATION-ZSZM.md` | 8,746 B | **交付级安装指南**：前置检查 / 零映射对照 / 四步安装 / 官方素材安装 / 验证 / 回滚 / FAQ / 短分支建议 |
| `README.md` | 12,716 B | 包结构、API、契约、红线 |
| `js/six-system-icons.js` | 5,040 B | 六系图标自包含模块（六键注册 `window.LXHUI.ICONS`） |
| `js/settlement.js` | 11,959 B | 胜负结算引擎（胜：小黑 + 比丢；负：安慰 + 不惩罚） |
| `data/character_stats.json` | 353,533 B | 488 角色六系数值 |
| `data/decks.json` | 1,497,334 B | 488 套卡组 |
| `data/achievements.json` | 16,706 B | 15 条收集类成就 + `element_gate` 拍板段 |
| `data/six-systems.json` / `data/stat-model.json` | 4,586 / 6,874 B | 六系定义 / 数值模型 |
| `src/*.tsx` + `src/*.ts` | 6 文件 | `SettlementStage` / `SixSystemPanel` / `AchievementBanner` / 数据与类型适配层 |
| `styles/sixsys-integration.css` | 4,718 B | 接入层样式（`sixsys-` 前缀，零冲突） |
| `verify/` | 6 文件 | `verify_integration.py` / `smoke_integration.mjs` / `sync_from_arena.ps1` / `install_assets.ps1` / `assets.source.json` / `verify_report.json` |
| `tools/decide_ach_system_001.py` | 9,711 B | 土系成就缺口决策工具（A/B/C 三方案） |

### 2. 本轮修复

1. **同步脚本数据源路径**：`character_stats.json` 真源位于 `data\generated\`，原脚本从 `data\` 直取导致漏拷 → 改为 `name → rel` 映射表，7 文件全量同步成功。
2. **校验器三处误报**：① 外链守卫把 `www.w3.org`（SVG 命名空间）判为外链；② 禁词守卫把"严禁 AI 生图 / 同人图"的声明句与官方图标目录 `shared-ui/AI image` 判为违规引用；③ 档位比较用字符串比较导致 `D ≥ C` 误判。分别以 URL 白名单、否定语境标记 + 合规来源白名单、`TIER_ORDER` 序数比较修正。
3. **溯源注释去绝对路径**：`ui/six-system-icons.js` 中 `E:\Projects\shared\...` 改为 `shared-ui/AI image/cards/`。
4. **文档编号规范化**：`docs/07-站点集成方案_20261005_234411_344.md` → `docs/09-站点集成安装手册.md`（方案地图与安装手册双文档并存，编号连续）。

### 3. 验证结果

| 校验 | 项数 | 结果 |
|---|---|---|
| `verify_integration.py` | 18 项静态自检 | **18/18 PASS**（清单 23/23 在位、零漂移、零红线命中） |
| `smoke_integration.mjs` | 11 项运行时冒烟 | **11/11 PASS**（图标注册零污染、结算契约、克制环确定性、成就判定） |
| 清单哈希 | 23 文件 | 已刷新至 `manifest.json` |

### 4. 本轮待办

1. **站点侧挂载未执行**：涉及正式工程写入，按中风险处理，待用户拍板后执行（命令见 `integration/INTEGRATION-ZSZM.md` §2–§5，可一键回滚）。
2. **土系成就 `ach_system_001` 门槛**：`element_gate` 已以 `proposed` 态落盘（主方案 A：数据侧补土系 C 档；备选 C：替代路径；方案 B 已驳回），待拍板。
3. **官方表情包专项目录仍缺位**：失败结算继续复用官方表情立绘（合规），专项采集须走 `docs/05 §5` 审查流程。
*（内容由AI生成，仅供参考）*
