# MIGRATION · D 盘第 1 轮成果迁入说明（R3）

> 本目录是 **D:\Projects\new project 第 1 轮（R1）成果的只读快照**，由 R3 轮从 D 盘迁入。
> 迁入后，**工作副本统一为 E 盘**（`E:\Projects\New project\six-system-arena`）；D 盘原目录保留不删，仅作历史参考。

---

## 1. 迁入信息

| 项 | 内容 |
| --- | --- |
| 来源 | `D:\Projects\new project\`（R1 成果，含独立 git 仓库 `main` + `r1-visual`） |
| 目标 | `E:\Projects\New project\six-system-arena\legacy\d-drive-r1\` |
| 迁入时间 | 2026-10-06（R3 轮） |
| 迁入方式 | 递归复制（`robocopy /E`），**排除** `.git`、`node_modules` |
| 文件数 / 体积 | 48 个文件 / 约 3.57 MB |
| 源目录处置 | **保留不删**，标记为旧副本；其 `.git` 未被触碰 |
| 本目录性质 | **只读参考快照**，不参与 E 盘工程构建，不被任何脚本引用 |

---

## 2. 为什么是"快照"而不是"合并覆盖"

| 维度 | D 盘 R1 工程 | E 盘工程（R1+R2 已完成） |
| --- | --- | --- |
| 数值产物 | `data/character-stats.json`（六系 0-100 分 + 技能标签） | `data/generated/character_stats.json`（六系 + 境界 + hp/atk/def + 战力 + 分档） |
| 校准通道 | 外置覆盖层 `data/stats-overrides.json` + `tools/apply-overrides.mjs` | `data/manual-overrides.json`（参数级校准） |
| 溯源分级 | 三层（`official` / `db-record` / `inferred`） | `element_source` 字段（关键词 + 置信度） |
| 可视化 | `src/ui/*`（内联 SVG 图标、雷达、条形、徽章）+ `demo/` 四板块 | `ui/six-system-icons.js` + `ui/SixSystemPanel.js` |
| 卡组 / 对战 / 成就 | 未落成数据文件 | `data/decks.json`、`ui/battle-engine.js`、`data/achievements.json`、`ui/settlement.js` |
| 站点集成 | 无 | `docs/07-站点集成方案.md` |

两套产物**同源不同代**：若整体覆盖合并，会破坏 E 盘已验收的 R2 产物（卡组 / 对战 / 成就 / 审计）。
因此本轮采用 **"新增快照 + 增量吸收"**：D 盘成果整目录落进 `legacy/`，其中**尚未被 E 盘覆盖的能力**（外置校准层、三层溯源、字段级派生校验）在 R3 文档中登记为后续可吸收项（见 `docs/08` §6）。

---

## 3. 两库分叉裁定（R3 结论）

| 项 | D 盘库 | E 盘库 |
| --- | --- | --- |
| 路径 | `D:\Projects\罗小黑战记数据库\db\worldview_luoxiaohei_v4.db` | `E:\Projects\assets\罗小黑战记数据库\db\worldview_luoxiaohei_v4.db` |
| sha256 | `34EFCB0AA9CEC7FEA6801311DFA297DE73925CB8B1E33C90383509AADF26BFCA` | `EE5B2C1E68BB4579D7598E6678F37F980427B72559BB88EABE18D9C50B686ED6` |
| 定位 | 旧副本，**仅供参考** | **工作副本数据库**（唯一派生来源，只读） |

> ⚠️ 两库已分叉，**不可混用**。本项目一切派生以 E 盘库为准；D 盘库仅用于历史比对与回滚依据。

---

## 4. 快照内容地图（D 盘概念 → E 盘对应）

| D 盘 R1 概念 | 快照内路径 | E 盘工程现状对应 |
| --- | --- | --- |
| 派生数值层 | `data/character-stats.json` | `data/generated/character_stats.json` |
| 外置校准层 | `data/stats-overrides.json` | `data/manual-overrides.json`（粒度不同，待吸收） |
| 合并层 | `data/character-stats.effective.json` | 无（E 盘直接在生成时合并校准） |
| 世界层 | `src/world/`（six-systems / elements / realms / rating / schema / overrides） | `data/stat-model.json` + `data/six-systems.json` |
| 图标 / 图表 | `src/ui/system-icons.js`、`radar6.js`、`bars6.js`、`badge.js` | `ui/six-system-icons.js`、`ui/SixSystemPanel.js` |
| 示例页 | `demo/`（图标墙 / 雷达条形 / 对镜对比 / 数据健康度） | `integration/`（P7 站点集成草案） |
| 派生脚本 | `tools/derive-all-stats.mjs`（含 sha256 校验）、`apply-overrides.mjs`、`serve-demo.mjs` | `data/scripts/generate_stats.py` |
| 库审查归档 | `lxh-audit/`（库审查、素材审计、联网核实） | `docs/05-素材白名单.md` |

---

## 5. 使用约束

- ❌ 不修改本目录内任何文件（只读快照）。
- ❌ 不从本目录直接取数参与 E 盘构建（数据源为 E 盘库 + E 盘派生脚本）。
- ✅ 需要对比 R1 口径、复用覆盖层设计或 demo 版式时，可作参考阅读。
- ✅ 需要吸收某项能力时，在 E 盘工程内**另建实现**，并在 `CHANGELOG.md` 记录来源。
