# 环境边界与当前审计

审计时间：2026-10-25。此文记录仓库可核实的路径与风险；不表示所有生产节点均已完成物理隔离。

| 区域 | 当前路径 / 来源 | 作用与边界 |
| --- | --- | --- |
| 正式源码仓库 | `E:\Projects` | Git 工作区。不要在此直接编辑正在运行的快照。当前主工作树为 `zszm-batch-20261021`。 |
| Git worktree | `E:\Projects-worktrees` | 隔离的分支或候选工作树。多个 worktree 仍含未提交改动，不能清理或回收。 |
| 构建候选 | `E:\Projects\.releases\candidate` | 未发布构建输出。审计时部分候选由 dirty tree 构建，不能作为可重复发布凭据。 |
| 本机发布快照 | `E:\Projects\.releases\production\site` | 本机显式发布后的源码快照；不等同于远端当前激活版本。 |
| 本机运行目录 | `E:\Projects\.releases\runtime` | 网站管家启动服务使用的稳定工作目录。 |
| 运行数据 | `IRIDESCENTLY_PROJECT_ROOT` 当前解析为 `E:\Projects` | SQLite、用户资料、角色数据、上传资源等部分数据仍位于仓库树下。数据被 Git 忽略不等于与开发区物理隔离。不要运行 `git clean -x` 或删除 `.releases`。 |
| 运维工具 | `E:\External Projects\Iridescently Operations` | 网站恢复、发布和备份脚本。当前不属于独立 Git 仓库；目录含敏感备份，禁止加入主仓库或公开仓库。 |
| 独立实验 | `E:\External Projects\world-courtyard-slice` | 实验项目，当前没有 Git 仓库；需单独决定是否建立仓库，不纳入主项目发布。 |
| 香港生产 | 由外置 `hk-release.py` 管理 | 审计时状态命令报告 `20261025T083534Z` active、五个受管服务 active；本机当前版本记录较旧，线上 SHA 与本地快照映射尚未证实。生产数据库由香港权威维护。 |

## 已确认的边界

- 构建脚本写入候选目录，`publish:*` 是单独显式动作。
- Portal/OAuth 从本机 `.releases/production/site` 启动；Cards 服务从运行中的代码快照加载 Python 模块，数据路径另由 `IRIDESCENTLY_PROJECT_ROOT` 指定。
- 门户集成测试默认使用临时数据根；测试不得直接连接真实生产数据库。
- 发布状态检查是只读操作；GitHub push 不会自动发布生产。

## 风险与发布门槛

1. 源码仓库与本机运行数据同根，清理、备份和测试脚本必须明确排除数据库、上传、媒体与密钥目录。将数据物理迁出属于数据迁移，需先完成路径依赖审计、备份/恢复演练和单独批准。
2. `.releases/candidate` 中 homepage/modules/cards/world-map 候选记录 `sourceDirty=true`；本机 `production.json` 也记录 dirty source heads。需重建从已审查提交产生的候选，或提供逐文件 hash 与提交来源证明。
3. 本机 `.releases/hk-production.json` 与远端状态命令给出的激活版本不一致。每次 release 必须以远端状态为准，并保存激活版本与构建 SHA 的映射。
4. 香港反向代理的请求体上限未能从本机配置证明。大图保存上线前必须检查实际代理层设置并在真实移动端验证。

## 禁止事项

- 不在生产目录开发或运行集成测试。
- 不对仓库树执行可清除 ignored runtime data 的清理命令。
- 不把 `.releases/runtime`、`.releases/production`、备份、数据库、上传文件、密钥、日志或外置 Ops 内容提交到 Git。
- 不把构建、Git push 或本地状态报告当成生产部署完成证明。
