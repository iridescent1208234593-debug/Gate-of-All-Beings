# Git 分支策略（建议稿）

**状态：提案，尚未重命名、合并或删除任何分支。** 审计日期 2026-10-25。

## 建议结构

- `master`：当前 GitHub 默认分支；保持稳定、可发布。未获批准前不改默认分支名称。
- `zszm-batch-20261021`：当前集成开发线，临时继续承载已完成但尚未进入 `master` 的功能；完成分歧核对和验证后通过普通 merge / PR 集成。
- `feature/*`、`fix/*`：短期分支，从集成线创建；合并后再列为归档候选。
- `release/*`：仅在确有独立候选验证需要时保留一个活动发布线；发布结束后记录 SHA，之后再讨论归档。
- 不创建重复的长期 `main` 与 `master`，也不因理想模型自动创建 `develop`。

## 审计证据

- GitHub 默认分支为 `master`，远端 HEAD `561e36df7e2a747dac106679c1cfb7a86106b2d2`。
- 当前 `zszm-batch-20261021` HEAD `bb886549ab4a06f74398d93cf44446846cbf7f93` 与其远端分支一致。
- 两者已分叉：`master` 有 8 个集成线没有的提交；集成线有 40 个 `master` 没有的提交。远端包含站点主题、跨游戏任务链、WAL 并发修复及世界地图后续提交，不能用快进或重置替代审查。
- 实际仓库内的 `origin/master` 跟踪引用落后于 GitHub 远端；分支合并前须先只读核对远端最新 SHA，再建立隔离候选。
- `codex/security-ingress-20261024`、`fix/huiguan-upload-preview-url`、`codex/r2-asset-resolver` 与 `release/stage1.8.3` 含有集成线或稳定线未覆盖的提交，暂不删除。
- `codex/iridescently-update` 与 `feat/sixsys-deck-alloc` 指向同一 SHA。若与默认分支比较为零 ahead 的旧分支，仅标记为归档候选，不代表可以直接删除。

## 集成顺序建议

1. 获取远端最新 refs 到隔离审计仓库或 worktree，不重写现有 refs。
2. 建立生产当前版本、源提交与文件 hash 的映射。
3. 对 `master` 的 8 个独有提交逐项检查路径与功能，再将它们 merge 到新的集成候选。
4. 对 `zszm-batch-20261021` 的 40 个独有提交按功能簇检查、构建与数据/权限边界验证；通过后以普通 merge/PR 进入稳定分支。
5. 对 security ingress 与 Huiguan upload 分支分别比对 patch-id、文件差异和测试证据，避免重复或漏合。
6. 合并稳定且有恢复 SHA 后，列出归档分支和 worktree 清理清单，提交人工审批后再删除远端引用或工作树。

任何默认分支切换、远端分支删除、批量合并和历史改写都需独立批准。禁止强推覆盖远端历史。
