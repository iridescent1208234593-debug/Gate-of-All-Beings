# 恢复手册

每一类可恢复的东西放在哪、怎么恢复、怎么验证。路径中的 `<工作区>`、`<runtime>` 见 [工程工作区](workspace.md)。生产（香港）的数据与备份由香港侧维护，恢复香港属于生产操作，需要负责人授权，不在本手册的本机步骤里。

## 清单

| 对象 | 权威位置 | 副本 | 恢复方式 |
| --- | --- | --- | --- |
| Git 历史（含本机独有的 `refs/archive/*` 与 stash） | 本机 Git 数据库 + GitHub | 换盘 bundle：`D:\Iridescently-backups\git\*.bundle`（`--all`） | `git clone --mirror <bundle> restored.git`，或在现有仓库 `git fetch <bundle> 'refs/*:refs/restored/*'` |
| 已退役分支 | GitHub tag `archive/<分支名>` | bundle | `git switch -c <分支名> archive/<分支名>` |
| 本机运行数据（数据库、上传、原图） | `<runtime>/<environment>/{data,assets}` | `<runtime>/<environment>/backups/snapshots/<时间>`（`backup-storage.py snapshot`） | 停服务 → 校验快照 → 把快照的 `data/`、`assets/` 复制回对应根 → `local-runtime.py start` + `local-smoke.py` |
| Batch 6 迁移前的原始文件 | `<runtime>/production/backups/batch6-migration-20261025/original-source/` + `manifest.json` | — | `python tools/runtime/storage-migrate.py restore-source --manifest <manifest.json>`（只复制、拒绝覆盖较新数据） |
| 本机 Release | `<runtime>/<environment>/releases/store/<id>`（不可变） | 可由 trunk 提交重建 | `npm run release:rollback -- <release-id>`（只移动 channel） |
| 运维工具代码 | `<工作区>/operations`（本地 Git） | 无远端（含敏感材料，不推送） | `git -C <工作区>/operations log` / `checkout` |
| 原始资产与协作原件 | 工作区之外的 `E:\资产`（`众生之门项目组原件资产`） | 目前只有这一份 | — |

## 演练与校验命令

```powershell
# Git：bundle 完整且能还原所有 ref
git bundle verify D:\Iridescently-backups\git\<bundle>
git clone --mirror D:\Iridescently-backups\git\<bundle> <工作区>\scratch\restore-drill.git
git -C <工作区>\scratch\restore-drill.git fsck --no-dangling

# 运行数据：快照逐文件 sha256 与数据库完整性
python tools/runtime/backup-storage.py verify <runtime>\production\backups\snapshots\<时间>
```

## 香港生产数据的备份现状（2026-10-26 依据仓库与本机证据核对，未登录香港验证）

香港是生产数据的唯一权威位置。能找到的自动保护只有 DSH 采集的 `iridescently-db-snapshot.sh`（分支 `infra/server-ops-assets` `f8f8256`，生产路径 `/usr/local/sbin/`，cron 04:15）：

| 生产数据（旧布局路径 `/srv/iridescently/data/...`） | 每日快照 | 说明 |
| --- | --- | --- |
| `portal/huiguan/users.db`（账户、会话、云存档、积分、公开人设镜像 `fan_characters`） | 是 | `sqlite3 .backup` + `integrity_check`，保留 14 天 |
| `data/homepage-gallery.sqlite3`、`worldview_luoxiaohei_v4.db`、`cards/update-feedback.sqlite3` | 是 | 同上 |
| `portal/huiguan/characters.json`（全部 OC 人设表，权威来源） | **否** | 脚本只处理 SQLite |
| `portal/huiguan/game_saves.json`、聚灵 `save.db`、Cards `users.db`、卡牌数值 `config.json`、首页 `links/thanks.json` | **否** | |
| 会馆上传与展示页 store（`uploads/`、`store/`，人设表里的 `html_ref` 与图片都指向这里） | **否** | 只有 10-24～26 的一次性全量资产副本 `/root/dsh-backups/`（854 MB） |

- 快照写在同一台服务器的 `/root/dsh-backups/daily/`：同机、同盘，机器或磁盘丢失时与数据一起丢失，不是异地备份。
- 没有找到把香港数据定期拉到另一处的任务、脚本或记录。Cloudflare 里名为 `backup-hk` 的 Tunnel 是已退役的回源入口（down，0 连接，见 `evidence/hk-readiness-20261026`），与数据备份无关。
- 没有任何一次"从香港备份恢复到另一台机器并核对"的演练记录。在演练之前，任何副本都只能算"存在"，不能算"可恢复"。
- 本机 `runtime/production` 是 10-25 迁移时的旧数据（人设表 534 KB），远早于香港当前数据（4000+ 用户），不能当作生产备份。

需要负责人授权后在香港执行（本仓库不执行）：把 `characters.json`、`game_saves.json`、其余 SQLite 与 `uploads/`、`store/` 纳入每日快照；把快照定期复制到香港以外的位置；做一次异机恢复演练并在 `evidence/` 留记录。

## 已知缺口

- 香港生产没有异地副本，人设表与用户上传没有自动快照（见上一节）。
- 本机没有异地副本：运行数据、原件、运维备份都只在本机 E: 盘；D: 上只有仓库 bundle，而且 D: 几乎已满。
- `E:\资产` 下的原始资产与协作原件没有第二份。
- 本机快照包含 6 GiB 的只读原图，每次快照都整份复制；需要一个只备份可变数据（data、managed 上传）的轻量快照，或改为增量。
