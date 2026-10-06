---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_1436bc48c10311f1887c525400de85a5
    ReservedCode1: usxAeV5307h+PpEML2cVQ6wsJMYmmjrqzpB2u8804DWNrFxCu6WN6qiUsvwP6JE7SGHPNviDcaM6NplmP42vJQ8V2QoIfIocxAmtEDoQxygIFKl602qEOHGpfnDGV5qAGiSAuLCU9n3ckmAkRc9h30PXJFLUdtYhAKwY4qLzrVzYMICTYo1CFet2nk8=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_1436bc48c10311f1887c525400de85a5
    ReservedCode2: usxAeV5307h+PpEML2cVQ6wsJMYmmjrqzpB2u8804DWNrFxCu6WN6qiUsvwP6JE7SGHPNviDcaM6NplmP42vJQ8V2QoIfIocxAmtEDoQxygIFKl602qEOHGpfnDGV5qAGiSAuLCU9n3ckmAkRc9h30PXJFLUdtYhAKwY4qLzrVzYMICTYo1CFet2nk8=
---

---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_3ac2e197c0e711f1884b525400cd780f
    ReservedCode1: baqMgl3+p8Laqp7ZruO1zCSQlcqVDk5lx0nbFJ4oFnTU3XPXsLnJdcTjfVJRxBDXLU2LVq/PV7RJTMZ4TJ/yR8omR9F1KyLFJA7RSYINWEB0pjaEGk4t8bnDing+mm3t3jvQgbSEtc3jA0NoIy32u5ggcE1RKQRKDkVxWb6lOKf/qQ3nPhySc4SAN1E=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_3ac2e197c0e711f1884b525400cd780f
    ReservedCode2: baqMgl3+p8Laqp7ZruO1zCSQlcqVDk5lx0nbFJ4oFnTU3XPXsLnJdcTjfVJRxBDXLU2LVq/PV7RJTMZ4TJ/yR8omR9F1KyLFJA7RSYINWEB0pjaEGk4t8bnDing+mm3t3jvQgbSEtc3jA0NoIy32u5ggcE1RKQRKDkVxWb6lOKf/qQ3nPhySc4SAN1E=
---

# 数据库审查说明（README / Feedback）

本目录存放 `worldview_luoxiaohei_v4.db` 的审查产物。本文件用于**说明审查进度与使用方法**，便于用户逐项复核。

> **当前进度：第 1 轮（只读诊断）✅ 完成 ｜ 第 2 轮（复核 + 图库联动路径写入）✅ 完成 ｜ 第 3 轮（修复）⏳ 待用户授权**
> **备份**：`db\backup\worldview_luoxiaohei_v4.db.bak-20261005_202309`（第 2 轮写入前状态）

## 一、已完成内容

### 第 1 轮（DB 结构审查，只读）

- 对象：`worldview_luoxiaohei_v4.db`（主库 2.28 MB）
- 方式：**只读**连接全表扫描，未对数据库做任何写入或修改
- 覆盖：41 张表（业务表 40 + 系统表 1）的结构、记录数、空值、重复、外键、路径、表间冲突

### 第 2 轮（复核 + 图库联动，含有限写入）

- 对 H-1 ~ H-5、M/L 级问题做**全表复核**，状态记录于 `DB第二轮审查反馈.md`
- 因图库优化（去重 / 合并 / 改名 / 候审）联动，同步 **202 行路径类字段**（不涉语义变更，写入前已备份）
- 全库绝对路径引用有效率：184 条失效 → **49 条失效（98.0% 有效）**
- 新增发现：`images` 表混入 **21 条百科界面/模板图标** + **1 条从未落盘的 `朱婧.png`**

## 二、产物文件

| 文件 | 内容 |
|---|---|
| `DB第一轮审查报告.md` | 全部表用途与记录数、问题清单（含严重程度与修复建议）、修复优先级 |
| `DB第二轮审查反馈.md` | 新一轮复核结论、本轮写入明细、下一轮修复优先级 |
| `待联网核实清单.md` | 需与官方/权威站比对的 15 条待核实项（含回填结论） |
| `联网核实结果.md` | V-1 ~ V-15 逐条核实结论、来源分级与来源清单 |
| `backup\` | 改库前备份（勿覆盖） |

## 三、核心结论速览

- 🔴 高危 5 项：`characters.avatar_id` 语义混用且几乎全失效；`character_images.character_id` 数字ID与角色名混用；`images.file_path` 失效 22 条 + 旧根路径；`characters.id=16` 悬空引用波及 4 张表；`character_images` 同图被多角色重复挂载（98 组 / 222 行，最多 17 个角色）。
- 🟡 中危 14 项：关系表/来源表重复、`character_relations_ext` 外键整列空、`character_info` 空壳且与 characters 冗余、episodes/lxz_episodes/timeline_v2/music 多列整列空置、3 张空表等。
- 🟢 低危 6 项：属性列稀疏、角色名全角括号变体等。
- **澄清**：全库扫描**未发现** `E::` 前缀异常；此前记录的该问题应为路径旧根问题（详见报告 H-3）。
- **联网核实已采信**：V-6（画灵/灵誓）、V-7（一级执行者）、V-12（括号变体**不合并**）、V-13（音乐用途）、V-14（STAFF）；**疑非官方**：V-5（练气→渡劫，建议标注或剥离）。

## 四、复核建议

1. 打开 `DB第一轮审查报告.md`，按第五节"优先级修复顺序"逐项复核。
2. 打开 `DB第二轮审查反馈.md`，确认 §四 本轮写入明细是否接受。
3. 对报告中的路径失效条目，可在资源管理器中直接验证。
4. 联网核实结论请对照 `联网核实结果.md` 的来源清单复核。
5. **任何进一步修改前先另存数据库副本**（勿覆盖 `backup\` 内文件）。

## 五、后续轮次待办（第 3 轮，需用户授权）

1. H-5 定向清理误挂行（先视觉复核，再小批试点）。
2. H-2 文本 `character_id` 回填（16 行，映射明确）。
3. H-1 `avatar_id` 语义统一（26 条旧根 + 11 条 `0`）。
4. H-4 `id=16` 悬空引用清理（45 行）。
5. 清理 `images` 表 21 条百科界面图标 + 1 条 `朱婧.png` 空记录。
6. 按 `联网核实结果.md` 修正 V-4 / V-5 / V-8 / V-9 / V-11 / V-15。

---
*生成时间：2026-10-05（第 2 轮更新）｜ 审查轮次：第 1、2 轮*
*（内容由AI生成，仅供参考）*
*（内容由AI生成，仅供参考）*
