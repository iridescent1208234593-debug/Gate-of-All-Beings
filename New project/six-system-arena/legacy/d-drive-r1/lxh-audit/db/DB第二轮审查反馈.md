---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_1363adddc10311f1887c525400de85a5
    ReservedCode1: hLHj56tHUP60yZElsS+Y+pQb4hjb6hVGD61yPf91w8gBwJDruiuhPO2FqlVIWtnTmFNcR9tEWigoAlVuSAH7hdWF2MmliSuIZ7LwMH6ggSXs/n4EP9jYrFJ1INWA7gKy28SzoMIeucnpisyZg1MQdM+Jol5+Q9/UONNc29BvScNFvrmq2+I+gfsfh5o=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_1363adddc10311f1887c525400de85a5
    ReservedCode2: hLHj56tHUP60yZElsS+Y+pQb4hjb6hVGD61yPf91w8gBwJDruiuhPO2FqlVIWtnTmFNcR9tEWigoAlVuSAH7hdWF2MmliSuIZ7LwMH6ggSXs/n4EP9jYrFJ1INWA7gKy28SzoMIeucnpisyZg1MQdM+Jol5+Q9/UONNc29BvScNFvrmq2+I+gfsfh5o=
---

# 数据库审查说明 · 第二轮反馈（2026-10-05）

- **审查对象**：`worldview_luoxiaohei_v4.db`（主库 2.28 MB，41 张表）
- **本轮方式**：① 对第一轮 H/M/L 问题**只读全表复核**；② 因图库优化联动，对**路径类字段做了必要写入**（明细见 §四）
- **改库前备份**：`db\backup\worldview_luoxiaohei_v4.db.bak-20261005_202309`（**任何进一步改动前请先另存副本**）
- **配套文件**：`DB第一轮审查报告.md`、`待联网核实清单.md`、`联网核实结果.md`、`reports\图库优化执行报告_20261005.md`
- **审查日期**：2026-10-05 ｜ **轮次**：第 2 轮

---

## 一、结论速览

| 上轮问题 | 本轮状态 | 说明 |
|---|---|---|
| H-1 `characters.avatar_id` 语义混用/失效 | 🟡 **未修复（仍存）** | 71 条非空：整数 34（含 `0` 11 条）、文本路径 26 条（全部为旧根 `E:\罗小黑战记数据库\...`，磁盘不存在）。**待用户裁定语义后再动手** |
| H-2 `character_images.character_id` 文本混用 | 🟡 **未修复（仍存）** | 仍为 16 行角色名文本（一凡/哪吒/山新/无限/李清凝/比丢/潘靖/玄离/皇受/罗小白/罗小黑/老君/谛听/阿根/风息/鸠老）；本轮仅同步了这 16 行所涉图片路径 |
| H-3 `images.file_path` 失效/旧根 | 🟢 **部分修复** | 失效由 22 条**降为 22 条**但内容变化：21 条旧根（多为萌娘百科界面图标 CC/GFDL/保护/投票/支持 等）+ 1 条 `images\朱婧.png`（**磁盘从无此文件**，仅存在 `pages\朱婧.md`）；旧根记录已作为待清理项保留 |
| H-4 `characters.id = 16` 悬空引用 | 🟡 **未修复（仍存）** | `character_sources` 37、`character_relations` 6、`character_abilities` 1、`char_votes` 1 |
| H-5 `character_images` 同图多角色 | 🟡 **未修复（仍存）** | 复核：**98 组**存在多角色共用同一图，涉及 **222 行**；最高仍为 `images\哪吒\哪吒_005.jpg` 被 **17 个角色**引用 |
| M-1 ~ M-14 / L-1 ~ L-6 | 🟡 **维持第一轮结论** | 本轮未处理（超出图库联动范围），留待后续轮次 |

> **新增发现（M 级）**：`images` 表中混入 **21 条萌娘百科界面 / 模板图标**（CC、GFDL、公有领域、商标、各种保护状态、投票支持/反对等）与 **1 条 `images\朱婧.png`**。前者是**数据源页面元素**被误当素材收录，后者为**从未落盘的记录**。建议下一轮从 `images` 表清理或标记来源。

---

## 二、H 级问题复核详情

### H-5（重点）同图被多角色重复挂载

- 复核口径：按 `image_path` 分组、统计 `COUNT(DISTINCT character_id) > 1`。
- 结果：**98 组 / 222 行**。分布最高为 `哪吒_005.jpg`（17 角色）、`小白妈妈.webp`（4）、`images\图片目录\岩烬\岩烬_群像.jpg`（4）。
- 判断依据：多角色共用同图**可能是真实合照/群像**，也可能是**批量误挂**，需**逐组视觉复核**（图像理解）后决定保留或拆分——属内容判定，本轮**不做自动清理**，避免误删正确关联。
- 已为本项准备逐组清单（含路径与被引用角色列表），可支撑下一轮"视觉复核 → 定向删除误挂行"。

### H-2 文本型 `character_id`

- 16 行的角色名文本**与 `characters.name` 完全对应**，回填映射关系明确、风险低；本轮未执行回填是**为避免在没有用户确认的情况下改动关联语义**。
- 建议下一轮：按 `name → id` 精确回填（`UPDATE ... WHERE character_id = '<角色名>'`），并对该列加类型约束。

### H-1 头像语义

- 现状：整数 34 + 文本路径 26 + `0` 值 11 = 71 条非空。
- 建议方案（择一，需用户裁定）：
  1. **统一为 `images.id`**：为 26 条文本路径头像在 `images` 表定位（多数图实际存在于图库），回填对应 id；`0` 值置空。
  2. **统一为绝对路径**：与 `characters.image_path` 合并为一个字段，废弃语义重复。
- 注意：`relink_db.py`（路径重链脚本）**不覆盖 `avatar_id`**，故旧根 26 条不会被其自动修复。

### H-3 路径修复（本轮图库联动）

- 全库绝对路径引用 2,490 条：失效由 **184 → 49 条（98.0% 有效）**。
- 剩余 49 条 = `characters.avatar_id` 26（旧根）+ `images.file_path` 22（旧根 21 + `朱婧.png` 1）+ `spirit_lifecycle_images.image_path` 1（旧根）。

### H-4 悬空 `id=16`

- 与第一轮一致，未见变化。建议：确认 id=16 原角色身份 → 回填正确 ID；若无对应角色则清理这 45 行引用。

---

## 三、联网核实结论的使用（V-1 ~ V-15）

详见同目录《联网核实结果.md》。**本轮未按核实结论改库**，建议下一轮按下述优先级落地（均需先备份）：

| 采信等级 | 条目 | 建议改库动作 |
|---|---|---|
| ✅ 可直接采信 | V-6 双系合技、V-7 一级执行者、V-12 括号变体**不合并**、V-13 音乐用途、V-14 STAFF | 回填 `music.usage`、`staff` 岗位；**确认角色括号变体保持独立** |
| ⚠️ 需修正 | V-4 六大系（强化/治愈应挂到生灵系下）、V-8 剧集口径、V-9 会馆补全、V-11 作品表比对、V-15 时间线补节点 | 调整 `ability_branches` 层级；重建剧集分类口径；补会馆/作品/时间线 |
| ❌ 疑非官方 | V-5 境界体系（练气→渡劫） | 标注 `is_official=0` 或剥离，改列官方口径（生灵→精灵→妖精→仙→神） |
| ❓ 待二次核验 | V-1 具体日期、V-10 春妹妹/谭哥哥 | 暂不改动，标注「待核验」 |

> 原则：**只有 A/B/C/D 级来源支撑的结论才写入库**；仅 E 级（自媒体）来源的内容一律标注来源域名并标「待二次确认」。

---

## 四、本轮对数据库的实际写入（共 202 行）

> 均为**路径类字段**的同步更新，不涉及语义/事实内容变更；写入前已备份。

| # | 表 / 字段 | 行数 | 原因 |
|---|---|---|---|
| 1 | `characters.image_path` / `character_images.image_path` / `images.file_path` / `unclassified_images.image_path` | 143 | 技术命名文件重命名前**先改引用**（含 `fan_huiguan` 33 个、`img_*`、`moegirl_og` 等）|
| 2 | `character_images.image_path` | 23 | 23 个 `img_*` 改名后误落 `images\` 根 → 归位角色夹后同步引用 |
| 3 | `shared_assets.path` | 35 | `ai-art\` 迁入候审目录后同步路径 |
| 4 | `character_images.image_path` | 1 | 补漏：`清凝_moegirl_og_20260813.jpg` → `清凝_萌娘百科立绘.jpg` |
| 5 | `images.filename` | 35 | 与 `file_path` 的 basename 不一致 → 同步 |

- 写入均使用参数化 `UPDATE`，逐条执行并记录成功/失败，全部成功。
- 回滚：还原备份文件即可（备份含写入前完整状态）。

---

## 五、下一轮修复优先级建议

1. **H-5 定向清理**：按逐组视觉复核结果删除误挂行（保留真实合照）——先小批试点。
2. **H-2 回填**：16 行角色名文本 → 整数 id，并加约束。
3. **H-1 裁定**：统一 `avatar_id` 语义，处理 26 条旧根 + 11 条 `0`。
4. **H-4 清理**：`id=16` 悬空引用 45 行。
5. **新增项**：清理 `images` 表 21 条百科界面图标 + 1 条 `朱婧.png` 空记录。
6. **V-5 / V-4**：按联网核实结论修正体系表（疑非官方内容显式标注）。
7. 其余 M/L 级：分批补数据或裁剪空列。

---

## 六、复核方法

- 本轮所有结论由 `sqlite3` **只读查询**产生（`SELECT` 统计 + `os.path.exists` 实盘校验），可复现。
- 表结构、行数、空表清单与第一轮一致（41 表 / 空表 3：`artifacts`、`character_stats`、`sticker_uploads`），说明本轮写入未破坏 schema。

---
*生成时间：2026-10-05 ｜ 审查轮次：第 2 轮*
*（内容由AI生成，仅供参考）*
*（内容由AI生成，仅供参考）*
