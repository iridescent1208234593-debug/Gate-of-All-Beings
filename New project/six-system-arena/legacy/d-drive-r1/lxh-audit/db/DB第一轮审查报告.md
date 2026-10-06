---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_391d8302c0e711f1884b525400cd780f
    ReservedCode1: YJvx16xVm3aiUbWKZaI5OQWruzIPUKvuREdAFNpym3bxTB0jBs+KBD00IKHc0X5w+C8htCTj6NKeffjmexwhJUVBodih5IL8WhL8okdq/gNlYKOJKnKfgGNWyQbowxp8ZRYCuqtXrhKk85xdaIyMJgRpY5MYRDvDCFUfr/yBLyhGvJUR2TDpD7PBSs0=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_391d8302c0e711f1884b525400cd780f
    ReservedCode2: YJvx16xVm3aiUbWKZaI5OQWruzIPUKvuREdAFNpym3bxTB0jBs+KBD00IKHc0X5w+C8htCTj6NKeffjmexwhJUVBodih5IL8WhL8okdq/gNlYKOJKnKfgGNWyQbowxp8ZRYCuqtXrhKk85xdaIyMJgRpY5MYRDvDCFUfr/yBLyhGvJUR2TDpD7PBSs0=
---

# 罗小黑战记数据库 v4 —— 第一轮审查报告

- **审查对象**：`E:\Projects\assets\罗小黑战记数据库\db\worldview_luoxiaohei_v4.db`（主库 2.28 MB）
- **库内自述**：meta.version = `3.0`，meta.schema_version = `v4+integration1`，meta.source = `萌娘百科`
- **审查方式**：只读（`mode=ro`）连接 + 全表扫描；路径有效性用 `os.path.exists` 实盘校验
- **审查范围**：41 张表（含系统表 `sqlite_sequence`）的结构、记录数、空值、重复、外键、路径、表间冲突
- **审查日期**：2026-10-05

> 说明：本报告只做**只读诊断**，未对数据库做任何写入或修改。

---

## 一、总览

| 指标 | 数值 |
|---|---|
| 表总数 | 41（业务表 40 + 系统表 1） |
| 空表 | 3（`artifacts`、`character_stats`、`sticker_uploads`） |
| 最大表 | `character_sources` 3298 行 |
| 记录数前三 | character_sources(3298) > images(1134) > character_images(1078) |
| 发现异常类别 | 悬空外键、语义外键混用、重复行、路径失效、字段异常、占位记录、表间冗余 |

---

## 二、全部表用途与记录数

### 2.1 角色域

| 表 | 记录数 | 用途 |
|---|---|---|
| characters | 488 | 角色主表（27 列，含姓名/别名/种族/能力概述/头像/合并标记等） |
| character_info | 134 | 角色信息**快照表**，与 characters 同名冗余（详见问题 M-6） |
| character_abilities | 191 | 角色能力（简称串） |
| character_abilities_ext | 83 | 角色能力扩展（带描述与来源页） |
| character_events | 74 | 角色相关事件 |
| character_relations | 133 | 角色关系（按名字记录） |
| character_relations_ext | 136 | 角色关系扩展（含 relation_type 与来源页） |
| character_friends | 3 | 角色好友 |
| character_sources | 3298 | 角色出处/来源链接池 |
| character_images | 1078 | 角色—图片关联 |
| character_id_map | 3 | 外部系统角色 ID 映射 |
| char_favorites | 4 | 角色收藏 |
| char_votes | 15 | 角色投票 |
| character_stats | **0** | 角色数值属性（空表，预留） |
| unclassified_images | 38 | 未归类角色图片 |

### 2.2 作品/剧情域

| 表 | 记录数 | 用途 |
|---|---|---|
| episodes | 135 | 剧集（21 列，多数列空置） |
| lxz_episodes | 134 | 《蓝溪镇》条漫剧集 |
| episode_characters | 832 | 剧集—角色关联 |
| series_works | 15 | 系列作品 |
| timeline / timeline_v2 | 19 / 21 | 时间线（两代并存） |
| articles | 9 | 文章/词条 |
| music | 21 | 音乐 |
| staff | 24 | 制作人员 |
| locations | 91 | 地点 |
| organizations / org_branches | 10 / 7 | 组织 / 组织分支 |
| spirit_lifecycle / spirit_lifecycle_images | 99 / 4 | 灵质生命周期概念及其配图 |

### 2.3 能力/设定域

| 表 | 记录数 | 用途 |
|---|---|---|
| ability_systems / ability_branches | 3 / 8 | 能力体系（灵质力/六大系/双系合技）与分支 |
| dual_skills | 2 | 双系合技（画灵、灵誓） |
| cultivation_realm | 6 | 境界（练气→渡劫） |
| artifacts | **0** | 法宝/道具（空表，预留） |

### 2.4 资产/索引域

| 表 | 记录数 | 用途 |
|---|---|---|
| images | 1134 | 图片总库（绝对路径 + 语义关联） |
| shared_assets | 56 | 共享素材 |
| page_index / page_summaries | 516 / 516 | 抓取页面索引与摘要 |
| sticker_uploads | **0** | 表情上传（空表，预留） |
| meta | 6 | 元信息 |
| sqlite_sequence | 30 | 系统自增序号 |

---

## 三、问题清单（含严重程度与修复建议）

严重程度：🔴 高（影响正确性/数据不可用）｜🟡 中（结构缺陷或大规模缺失）｜🟢 低（稀疏、可容忍）

### 🔴 高严重度

| 编号 | 问题 | 证据 | 修复建议 |
|---|---|---|---|
| H-1 | **`characters.avatar_id` 语义混用且整体失效** | 45 条为整数、26 条为文本路径；整数中仅 **1 条**能在 `images.id` 命中；26 条文本路径全部指向旧根 `E:\罗小黑战记数据库\图片\...`，实盘 **0 存在**；另有 11 条值为 `0` | 统一 avatar_id 语义（建议只存 `images.id`）；旧路径头像重新映射到 images 表或迁移为新路径 |
| H-2 | **`character_images.character_id` 混用数字 ID 与角色名文本** | 1062 条为整数 ID，**16 条为文本角色名**（一凡/哪吒/山新/无限/李清凝/比丢/潘靖/玄离/皇受/罗小白/罗小黑/老君/谛听/阿根/风息/鸠老），这 16 行按 ID 校验全部悬空 | 将 16 条文本值按角色名回填为对应 `characters.id`；列上加类型约束 |
| H-3 | **`images.file_path` 路径失效与旧根混用** | 1134 条中 **22 条实盘不存在**；根前缀分布：1113 条 `E:\Projects\assets\罗小黑战记数据库\...`，**21 条为旧根 `E:\Projects\罗小黑战记数据库\images\...`（缺 assets 段）** | 21 条旧根路径批量替换前缀；22 条失效路径重定位或标记 |
| H-4 | **悬空外键集中于不存在的 `characters.id = 16`** | `character_sources` 37 条、`character_relations` 6 条、`character_abilities` 1 条、`char_votes` 1 条、`unclassified_images` 1 条引用 id=16，但 characters 中**无 id=16** | 确认 id=16 原角色（疑似被合并/误删），回填正确 ID 或清理 |
| H-5 | **`character_images` 同图被多角色重复挂载，疑批量误挂** | 按 image_path 去重：**100 组重复、涉及 225 行**；最严重 `哪吒_005.jpg` 被 **17 个不同角色**引用 | 逐组人工/视觉复核，剔除误挂关联，保留真实多角色合影 |

### 🟡 中严重度

| 编号 | 问题 | 证据 | 修复建议 |
|---|---|---|---|
| M-1 | `images.associated_type='character'` 存在悬空 | 342 条中 **4 条** associated_id 不在 characters | 修正或清空这 4 条关联 |
| M-2 | `character_relations_ext.related_character_id` **整列为空** | 136/136 全为 NULL，关系目标仅存文本名，无真实外键 | 按 related_name 回填 related_character_id，建立外键 |
| M-3 | `character_relations` 重复行 | (character_id, relation_name) 有 **14 组重复、涉及 30 行** | 去重或合并 relation_desc |
| M-4 | `character_sources` 大规模重复与空值 | 按 (character_id,source_url) **207 组重复、454 行**；character_id 空 50、character_name 空 245、source_desc 空 172、round_no 空 171、**created_at 空 988** | 去重；补全或裁剪沉余来源记录 |
| M-5 | `character_info` 近乎空壳 | 134 行中 gender/race/ability/identity/personality/appearance/voice_actor 各 **122 行空**，img_path **12 行全为 `''`**，voice_actor 有 200 行为空串 | 与 characters 比对后决定补齐或废弃该表 |
| M-6 | **`character_info` 与 `characters` 表冗余** | 134 条 character_name **全部**能在 characters 命中；characters 另有 354 条不在其中 | 明确二者主从关系，避免双写冲突 |
| M-7 | `episodes` 多列整列空置 | director/screenwriter/episode_num/series/staff_cast/music_used/page_title/source_file **8 列全部为空** | 补数据或从表结构移除，避免误导 |
| M-8 | `lxz_episodes` 半数行为占位 + summary 全空 | 134 行中 episode_num/release_date/page_count/writer/artist 各 **79 行为空**；summary **134 行全空** | 核实 55 条有效 + 79 条占位行的真实性 |
| M-9 | `timeline_v2.year` 整列空 | 21/21 全空 | 补年份或并入 timeline |
| M-10 | `music.usage` 整列空 | 21/21 全空（另有 publisher 空 15、album 空 8） | 补用途字段 |
| M-11 | `spirit_lifecycle` 关键字段大量空缺 | detailed_description 空 70/99；source_episodes/source_pages/animation_notes/related_terms 各空 84/99 | 补来源以支撑可复核性 |
| M-12 | `page_summaries.summary_text` 空 99/516 | 99 条摘要为空 | 重抓或标记 |
| M-13 | 记录未被引用 | characters **188 条无任何图片**、**412 条无 ability**；images **770 条未被引用**；episodes **12 条无角色关联** | 分批判定是"真无数据"还是"关联缺失" |
| M-14 | 3 张空表 | artifacts / character_stats / sticker_uploads 均为 0 行 | 保留（预留）或从 schema 移除 |

### 🟢 低严重度

| 编号 | 问题 | 证据 | 修复建议 |
|---|---|---|---|
| L-1 | characters 属性列整体稀疏 | age 空 319/488、birthday 空 460/488、master 空 380/488、eye_color 空 383/488 等 | 属正常稀疏，按需补 |
| L-2 | 角色名含全角括号变体 | 9 条：大志（TV版）、小黑（猫田）、府先生（TV版）、李清凝（清凝仙子）、苍梧（林苍）、蛋蛋（TV版）、蛋蛋（妖灵簿）、闵先生（闵翔）、雅婷（七刀） | 拆分别名、归一化括号（与图库重命名联动） |
| L-3 | `character_abilities_ext.description` 空 70/83 | — | 补描述 |
| L-4 | `cultivation_realm.description` 整列空 | 6/6 | 补描述 |
| L-5 | `unclassified_images.reason` 空 37/38 | — | 补未归类原因 |
| L-6 | 其他零星空值 | locations.type 空 1；staff 各列空 4~16；character_images.description 空 70、sort_order 空 177 | 逐步补全 |

---

## 四、关于"字段异常 E:: 前缀"的核实结论

对全库 41 张表所有列做 `LIKE '%::%'` 全量扫描：**未发现任何 `::` 异常值**。

结论：此前资产盘点中记录的"21 条 `E::` 前缀异常"**在当前 v4 主库中不成立**。最接近的历史问题应为 **H-3**（21 条路径使用旧根 `E:\Projects\罗小黑战记数据库\images`，缺少 `assets` 层级），建议以本报告 H-3 为准复核。

---

## 五、优先级修复顺序建议

1. **H-5 / H-2**：先修 `character_images` 的重复挂载与 ID/名字混用（直接影响图片与角色映射，是图库优化的前置）。
2. **H-1 / H-3**：头像与图片路径的语义统一与失效修复。
3. **H-4**：清理 `id=16` 悬空引用。
4. **M-2 / M-4 / M-3**：关系表与来源表去重、补外键。
5. **M-6 / M-5**：裁定 `character_info` 去留。
6. 其余按严重程度补数据。

> 需与官方设定比对的条目已单独整理为《待联网核实清单》，见同目录 `待联网核实清单.md`。
*（内容由AI生成，仅供参考）*
