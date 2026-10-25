# 归档与临时工作区策略

- `E:\Projects` 是正式 Git 仓库，不是线上运行目录；候选/发布快照位于 `.releases`，必须通过显式发布脚本更改。
- `E:\Projects-worktrees` 存放正式隔离 worktree。清理前确认 Git worktree 状态、分支/SHA、未提交改动和未跟踪文件；不能因为 detached HEAD 或目录名含 release 就删除。
- `E:\Projects\work` 是临时工作区。完成的有价值资料应先确认归属并迁移至 `E:\External Projects` 或正式 worktree，校验引用及文件哈希后才可删除临时副本。
- `E:\External Projects\Iridescently Operations` 是仓库外的运维目录，含备份、日志和可能的敏感材料；除非先做独立公开审查，不得提交或公开。
- `E:\External Projects\world-courtyard-slice` 是独立实验目录，不默认是生产链路。只有明确进入产品后才评估集成和独立仓库需求。
- `assets/`、`shared/` 是项目共享资源或代码，删改前检查引用及构建路径。用户数据、上传、数据库、备份、密钥、日志不属于可清理旧代码。
- 对明确被新实现替代的 tracked 代码，先检查静态/动态引用和构建、反向代理、服务启动路径；找到可靠恢复 SHA 后才能按授权范围删除。
- 不把“整理目录”当成运行时隔离；不执行 `git clean -fdx`，不自动处理用户标记为暂不处理的未跟踪文件。
