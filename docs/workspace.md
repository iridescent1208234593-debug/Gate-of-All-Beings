# 工程工作区

仓库之外的本机工程环境按同一套约定组织：一个工作区根目录，里面按"是什么"分目录。根目录下的 `iridescently-workspace.json` 用**相对路径**登记各角色目录；代码从检出目录向上查找这个文件（或读 `IRIDESCENTLY_WORKSPACE_ROOT`），所以整个工作区可以整体搬到另一块盘或另一台机器而不改代码和配置。

## 布局

| 角色（清单键） | 默认目录 | 内容 | 规则 |
| --- | --- | --- | --- |
| `repo` | `repo/` | canonical 检出，本机唯一的 `.git` 数据库 | 只放源码 |
| `worktrees` | `worktrees/<分支名>` | `repo` 的短期 worktree，一个分支一个目录 | 分支合并或放弃后退役 |
| `runtime` | `runtime/` | 外部存储父目录：`<environment>/{data,assets,cache,releases,backups}` | 只由存储契约与发布工具写；搬迁只能用 `tools/runtime/relocate-storage.py` |
| `operations` | `operations/` | 本机运维工具（不在本仓库） | 本地 Git，只跟踪代码；状态、日志、备份不入库 |
| `secrets` | `secrets/` | 密钥、Tunnel 凭据、环境原件 | 只有当前用户与 SYSTEM 可读；不进 Git、证据或普通备份 |
| `originals` | `originals/` | 原始资产与协作原件（美术/音乐原档、生成素材原集） | 不可再生；只增不改 |
| `promo` | `promo/` | 推广物料（视频封面、标题文案、对比截图） | |
| `evidence` | `evidence/<主题-日期>/` | 验证证据、事故记录、迁移清单 | 只追加，不改写 |
| `backups` | `backups/` | 时间点副本（仓库 bundle、运维 DB 快照） | 敏感 |
| `archive` | `archive/` | 退役的树：旧独立仓库、退役 worktree、旧根目录 | 不再运行；删除前要有校验过的副本 |
| `labs` | `labs/` | 研究、原型、上游克隆 | 不构建、不部署 |
| `scratch` | `scratch/` | 临时文件 | 随时可清空 |

与本项目无关的个人资料不放进工作区。

## 清单格式

```json
{
  "schema": 1,
  "roots": {
    "repo": "repo",
    "runtime": "runtime",
    "operations": "operations"
  }
}
```

- 值必须是工作区内的相对路径（不允许绝对路径、`..`、盘符）；未登记的键视为不存在。
- 解析实现：`services/platform/storage_paths.py` 的 `workspace_root()` / `workspace_path()` 与 `services/platform/runtime-paths.cjs` 的 `workspaceRoot` / `workspacePath()`，由 `test_storage_paths.py` 保持一致。

## 谁用它

- 存储根：`IRIDESCENTLY_STORAGE_ROOT` 优先；否则用清单的 `runtime`；都没有时回退到 `~/.local/share/iridescently`。`test` 环境永远要求显式的临时根，不读清单。
- 运维目录：`IRIDESCENTLY_OPS_ROOT` 优先；否则用清单的 `operations`；都没有时 `tools/ops/run-ops.mjs` 直接报错，不猜路径。
- 本机启动：`tools/runtime/local-runtime.py` 用同一套解析得到存储根，并把它原样传给子进程。

## 搬迁 runtime

就绪标记 `.storage-ready.json` 与迁移清单记录绝对路径，直接剪切目录会让所有服务拒绝启动（这是有意的失败关闭）。先停本机服务，再：

```powershell
python tools/runtime/relocate-storage.py plan  --to <新存储根>
python tools/runtime/relocate-storage.py apply --to <新存储根>
```

`apply` 在移动前后逐文件比对大小与 sha256，同盘重命名、跨盘复制后校验（跨盘时保留原目录供人工确认后再处理），然后检查每个数据库的完整性，最后才改写标记与迁移清单里的根和 `recovery` 路径。`source`（迁移来源）与 `legacy_asset_roots`（世界观库里旧绝对路径的换算规则）是历史记录，保持不变。改写前的两份记录和清单存在 `<backups>/relocations/<时间>/`。之后若工作区清单的 `runtime` 指向新位置，就不再需要设置 `IRIDESCENTLY_STORAGE_ROOT`。

## 新开发机：从零到本机运行

只需要本仓库与这份约定，不需要任何计划任务、外部运维目录或旧路径。

```powershell
# 1. 工作区与检出
mkdir <工作区>; cd <工作区>
git clone https://github.com/iridescent1208234593-debug/Gate-of-All-Beings.git repo
# 按上面"清单格式"写 <工作区>\iridescently-workspace.json（至少 repo、runtime、worktrees、scratch）

# 2. 依赖（Node 版本见 .nvmrc，Python 见 .python-version）
cd repo
npm ci
foreach ($m in 'cards','softie','management','ecology') { npm ci --prefix "apps/$m" }
npm ci --prefix apps/www/gallery-engine

# 3. 一个空的开发存储（development 允许没有迁移清单；production/staging 不允许）
$env:IRIDESCENTLY_ENVIRONMENT = 'development'
python -c "import sys; sys.path.insert(0, 'services/platform'); import storage_paths as s; print(s.initialize_storage()['roots'])"

# 4. 构建、封存、启动、验证、停止
npm run build:site; npm run build:release; npm run release:seal
python tools/runtime/local-runtime.py start
python tools/checks/local-smoke.py
python tools/runtime/local-runtime.py stop

# 5. 回归（只用临时 test 存储，不碰上面的开发存储）
python tools/checks/regression.py
```

真实数据不随仓库分发：需要时按 [恢复手册](recovery.md) 把快照恢复到 `production` 环境，而不是复制进检出。

## Windows 与 Linux

目录名全 ASCII、无空格，两边一一对应。Windows 本机为 `E:\Iridescently`；Linux 开发机建议 `~/iridescently`。香港生产使用自己的部署布局（`/srv/iridescently/...`），不是开发工作区。
