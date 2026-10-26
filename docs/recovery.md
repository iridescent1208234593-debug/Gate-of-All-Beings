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
| 原始资产与协作原件 | `<工作区>/originals` | 目前只有这一份 | — |

## 演练与校验命令

```powershell
# Git：bundle 完整且能还原所有 ref
git bundle verify D:\Iridescently-backups\git\<bundle>
git clone --mirror D:\Iridescently-backups\git\<bundle> <工作区>\scratch\restore-drill.git
git -C <工作区>\scratch\restore-drill.git fsck --no-dangling

# 运行数据：快照逐文件 sha256 与数据库完整性
python tools/runtime/backup-storage.py verify <runtime>\production\backups\snapshots\<时间>
```

## 已知缺口

- 没有异地副本：运行数据、原件、运维备份都只在本机 E: 盘；D: 上只有仓库 bundle，而且 D: 几乎已满。
- `originals` 没有第二份。
- 本机快照包含 6 GiB 的只读原图，每次快照都整份复制；需要一个只备份可变数据（data、managed 上传）的轻量快照，或改为增量。
