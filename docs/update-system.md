# 统一更新流程

本地源码和公开静态资产共用一个更新入口：`npm run update`。资源范围见 [assets.md](assets.md)。

命令分工：`npm run update:status` 只读状态；`npm run update:check` 做完整 dry-run；`npm run update:code` 检查、构建、测试、按明确文件清单提交并在安全门通过后等待推送确认；`npm run update:assets` 检查资产同步。`npm run update` 按代码再资产的顺序编排。所有命令均无 watcher/daemon，也不会因保存而发布。

## 顺序

1. 确认当前分支和工作区干净，读取当前提交。
2. 运行 `npm run build:modules` 与 `npm run test:portal`；任一失败即停止。
3. 对 outgoing Git 历史扫描环境文件、密钥、数据库、备份和会话附件路径；发现风险就禁止推送。
4. 生成 Gallery manifest，列出相对对象键、大小、SHA-256 和 MIME 类型。
5. 检查 Wrangler/R2 状态。R2 不可用时停止，不执行后续远程操作。
6. 后续 R2 同步必须先显示 NEW、CHANGED、UNCHANGED、REMOTE_ONLY、文件数和总上传字节，并在上传前等待人工确认。只复制 NEW/CHANGED；保留 REMOTE_ONLY；不删除本地素材或远端对象。
7. 验证 Pilot 对象和 CDN URL 后才能规划其余 Gallery 对象。Custom domain/DNS 修改、订阅和远程删除不属于自动步骤。

只有执行更新的命令才把状态写入忽略目录 `.updates/<timestamp>.json`，记录分支、前后提交、构建、测试、Git 推送状态、manifest 版本、上传/替换/跳过项目及警告；不写入 token 或其他凭据。报告保存在本机，不进入 Git。`update:status` 和 `update:check` 不创建报告文件，也不修改文件或远端状态。

在独立 worktree 中，根目录的外部素材不随 Git 检出。运行构建或清单命令前设置 `GALLERY_DIR` 指向本机的 `assets/罗小黑战记数据库/罗小黑节气贺图（gallery素材）/`。

## 整合状态（2026-10-10）

从 `infra/repo-cloud-pipeline` worktree 的原型整合到主分支。早期 R2 订阅、DNS 和 ahead 数值是旧现场，不能作为当前结论。

- 清单支持本地生成与 `--check` 校验；脚本不上传素材。
- `update:status` / `update:check` 会执行只读网络查询；本轮整理只验证本地部分，没有运行云查询或发布。
- 远端清单差异与同步仍未实现，`update:assets` 明确阻止上传。已有 Pilot 不代表整库迁移获准。
- `update:code` 只接受脚本内的明确文件清单，Git 推送需要终端人工确认。此次整理不运行此发布命令。
- Wrangler 依赖和锁文件随原型保留，尚未在主目录安装；使用云查询前按锁文件安装并单独核实账号状态。
- `.updates/` 只存本地报告；生产服务、Tunnel、DNS 和远端 Git 均未修改。
