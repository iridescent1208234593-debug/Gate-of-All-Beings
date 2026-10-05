---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a56f9206a4d0ca36c9be567d4febd43b_2db343c9c0ee11f1887c525400de85a5
    ReservedCode1: rSlCBbk5oH0upQFRlLPW7D/fJ4TDcvvOF3/Uq5WYLjOP1/rt7ACXh1PB+KWUrZif4HMWxyxcG2r+1oprcXgEx0UFKOYwDBKmFe06K56kqBn3Mgi7dks/n03TqJhHQK9K6fNV29o8YioIJiW3QqP4wzLAwFOJFJmc8NpVXCeOIW8MCxDfPxoRRdSUw64=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a56f9206a4d0ca36c9be567d4febd43b_2db343c9c0ee11f1887c525400de85a5
    ReservedCode2: rSlCBbk5oH0upQFRlLPW7D/fJ4TDcvvOF3/Uq5WYLjOP1/rt7ACXh1PB+KWUrZif4HMWxyxcG2r+1oprcXgEx0UFKOYwDBKmFe06K56kqBn3Mgi7dks/n03TqJhHQK9K6fNV29o8YioIJiW3QqP4wzLAwFOJFJmc8NpVXCeOIW8MCxDfPxoRRdSUw64=
---

# AUTOMATION · 自动化任务与脚本清单

> 所有脚本均为**幂等、可重复执行**；对参考仓库与数据库**只读**（唯一例外：`patch_lxh_icons.py --apply` 需显式授权）。

---

## 1. 脚本清单

| # | 脚本 | 作用 | 输入 | 输出 | 是否写外部 |
| --- | --- | --- | --- | --- | --- |
| 1 | `scripts/run_all.ps1` | **R2 一键串联** 6 步流水线（数值 → 卡组 → 成就校验 → 审计 → JS 自检 → 冒烟） | 本目录产物 | 刷新各产物 + 审计报告 | 否 |
| 2 | `data/scripts/generate_stats.py` | 从 v4 数据库推导角色六系数值 | `worldview_luoxiaohei_v4.db`（只读） | `data/generated/character_stats.json` | 否 |
| 3 | `data/scripts/generate_decks.py` | 按 `docs/03` §4 规则生成 488 名卡组（规则表驱动） | `character_stats.json` | `data/decks.json` | 否 |
| 4 | `data/scripts/validate_achievements.py` | 成就定义 / 卡组规则 / 素材路径三合一校验 | `achievements.json`、`decks.json` | 控制台校验结论（非 0 退出即失败） | 否 |
| 5 | `data/scripts/audit_r2.py` | 生成数值与卡组审计报告（含成就可达性） | 上述两份产物 | `data/audit/r2-audit.md` | 否 |
| 6 | `data/scripts/smoke_test.js` | 三模块联动冒烟测试（Node，零依赖） | `ui/*.js` + 两份产物 | 控制台断言结论 | 否 |
| 7 | `data/scripts/patch_lxh_icons.py` | 为 `lxh-ui.js` 的 ICONS 增量补 6 个键 | `shared-ui/lxh-ui.js` | 备份 + 补丁后文件 | **是（仅 `--apply`）** |

---

## 2. 用法

### 2.1 `run_all.ps1`（R2 推荐入口）

```powershell
# 全链路
powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1"

# 常用变体
powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1" -DryRun          # 只打印将执行的命令
powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1" -Stage checks    # 只跑校验链
powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1" -SkipStats       # 跳过数值重算（复用现有产物）
powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1" -Scope mainline  # 主线快跑
powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1" -KeepGoing       # 单步失败不中断，跑完汇总
```

**参数**

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `-Stage` | `all` | `all` = 全链 6 步；`data` = 只跑数值 + 卡组生成；`checks` = 只跑校验 / 审计 / 自检 / 冒烟 |
| `-Scope` | `all` | 传给 `generate_stats.py` 的范围（`all` / `mainline`） |
| `-SkipStats` | 关 | 跳过数值生成，直接复用现有 `character_stats.json` |
| `-DryRun` | 关 | 只打印命令，不实际执行 |
| `-KeepGoing` | 关 | 单步失败继续执行后续步骤 |

**行为保证**

- 退出码：全链通过 `0`，任一步失败 `1`（便于接 CI / 计划任务）。
- **不写外部**：脚本内**不含** `patch_lxh_icons.py --apply`，对参考仓库零写入。
- 每步打印耗时与退出码，失败即定位到具体步骤。

### 2.2 `generate_stats.py`

```powershell
# 全量生成（默认）
python "data\scripts\generate_stats.py"

# 指定范围：mainline（主线优先，type ∈ 主角/核心角色/重要角色）| all（全部 488）
python "data\scripts\generate_stats.py" --scope mainline --out "temp\stats_mainline.json"

# 自定义输出路径
python "data\scripts\generate_stats.py" --scope all --out "data\generated\character_stats.json"

# 指定数据库（默认取 v4 主库）
python "data\scripts\generate_stats.py" --db "E:\Projects\assets\罗小黑战记数据库\db\worldview_luoxiaohei_v4.db"
```

**参数**

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--db` | v4 主库绝对路径 | 数据库路径，以 `mode=ro` 只读打开 |
| `--scope` | `all` | `all` / `mainline` |
| `--out` | `data/generated/character_stats.json` | 输出路径 |
| `--model` | `data/stat-model.json` | 数值模型配置 |
| `--systems` | `data/six-systems.json` | 六系定义配置 |

**行为保证**

- 确定性：角色随机扰动由 `id` 派生（`hash(id)` 固定），同输入必然同输出。
- 只读：连接串固定 `file:<db>?mode=ro`，无任何 `INSERT/UPDATE/DELETE`。
- 可审计：输出含 `meta.generated_at`、`meta.scope`、`meta.source_db`、`meta.model_version`。

### 2.3 卡组 / 校验 / 审计 / 冒烟（R2 新增）

```powershell
# 生成 488 名角色卡组（依赖 character_stats.json）
python "data\scripts\generate_decks.py"

# 成就定义 + 卡组规则 + 素材路径校验（失败时退出码非 0）
python "data\scripts\validate_achievements.py"

# 生成审计报告 → data\audit\r2-audit.md
python "data\scripts\audit_r2.py"

# 三模块联动冒烟测试（Node，零依赖）
node "data\scripts\smoke_test.js"
```

**行为保证**

- 三个 Python 脚本均**零第三方依赖**（标准库），确定性输出。
- `validate_achievements.py` 同时校验 `docs/05` 白名单内的素材路径是否真实存在，防止引用失效。
- `audit_r2.py` 只读产物，不改动任何数据；报告可重复生成，除生成时间外内容一致。
- `smoke_test.js` 覆盖：对战确定性、克制环系数、空间穿透、镜像战规则、成就判定前置、结算不惩罚、官方素材路径存在性。

### 2.4 `patch_lxh_icons.py`

```powershell
# 1) 预览差异（默认行为，绝对不写文件）
python "data\scripts\patch_lxh_icons.py" --dry-run

# 2) 实际应用：自动备份 → 只增 6 键 → 校验原 21 键完好
python "data\scripts\patch_lxh_icons.py" --apply

# 3) 回滚到备份
python "data\scripts\patch_lxh_icons.py" --rollback
```

**安全设计**

1. 应用前自动备份到 `vendor/backup/lxh-ui.js.bak-<时间戳>.js`（项目内），并记录哈希。
2. 只在 `ICONS` 对象闭合括号前追加 6 个键，**其余内容逐字节不变**。
3. 应用后自动校验：原 21 键全部存在、新 6 键全部存在、行数增量符合预期；任一不符立即自动回滚。
4. 保留换行风格（源文件为 CRLF）。

> ⚠️ 本项目默认采用**零侵入**接入（加载 `ui/six-system-icons.js` 即自动注册六键），
> **无需**执行 `--apply`。仅当站点希望把六键固化进共享 UI 文件时，才显式执行并同步 D 盘副本。

---

## 3. 建议调度

| 任务 | 频率 | 触发方式 | 说明 |
| --- | --- | --- | --- |
| **全链回归（`run_all.ps1`）** | 每次改动产物 / 脚本后 | 手动 | 一条命令跑完 6 步，退出码可直接用于 CI 判定 |
| 数值重算 | 数据库更新后 / 每周 | 手动 或 任务计划程序 | v4 库有新角色时重跑 `generate_stats.py` |
| 卡组重算 | 数值或 `docs/03` §4 规则变更后 | 手动 | 重跑 `generate_decks.py`，须复核主系占比 ≥ 60% |
| 主线试跑校验 | 每次提交前 | 手动 | `--scope mainline`，快速回归 |
| 一致性校验 | 每日 | 任务计划程序 | 比对 `character_stats.json` 的 `meta.source_db_hash` 与库文件哈希 |
| 成就 / 卡组校验 | 每次改动 `achievements.json` / `decks.json` 后 | 手动 | `validate_achievements.py` |
| 审计报告刷新 | 每个迭代收尾 | 手动 | `audit_r2.py`，结论写入 `CHANGELOG.md` |
| 素材合规扫描 | 每次新增素材 | 手动 | 校验新图片不在 `docs/05` 黑名单目录内 |

Windows 任务计划程序示例（每周一 09:00 重算）：

```powershell
$action  = New-ScheduledTaskAction -Execute "python" `
  -Argument '"E:\Projects\New project\six-system-arena\data\scripts\generate_stats.py" --scope all' `
  -WorkingDirectory "E:\Projects\New project\six-system-arena"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 9am
Register-ScheduledTask -TaskName "sixsys-generate-stats" -Action $action -Trigger $trigger
```

> 注：注册计划任务属于对系统的变更，执行前需明确确认；本项目当前**未注册**任何计划任务。

---

## 4. 环境依赖

| 依赖 | 版本要求 | 说明 |
| --- | --- | --- |
| Python | 3.9+ | 仅使用标准库（`sqlite3` / `json` / `argparse` / `hashlib`） |
| Node.js | 可选 | 仅用于对 `lxh-ui.js` 做语法自检（`node --check`） |
| 无需第三方包 | — | `generate_stats.py` 零依赖，便于在站点侧直接运行 |
*（内容由AI生成，仅供参考）*
