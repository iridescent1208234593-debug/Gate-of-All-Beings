# OC SQL 开发验收记录

状态 DEVELOPMENT COMPLETE。未执行生产数据迁移、未删除原始 JSON、未部署。源码基线 master 387c19d5a84a3da6fa224b490b49172028abf7a0。

## 首轮实际运行（修复评审遗漏前）

`python3 tools/checks/oc-storage-regression.py --report <报告路径>`

本机 Python 3.13.15 / SQLite 3.50.4 / macOS；全部使用临时合成 test 数据。SQLite 版本存在官方 WAL-reset 风险，因此生产/staging SQL 有引擎门槛，未视为生产验收。

共 18 组检查通过，99 项可计数测试；静态安全脚本另以退出码验证。

| 检查模块 | 结果 | 测试数 |
| --- | --- | --- |
| services/platform/tests/test_oc_store.py | PASS | 15 |
| services/platform/tests/test_oc_migration_cli.py | PASS | 5 |
| services/platform/tests/test_oc_load.py | PASS | 1 |
| apps/huiguan/tests/test_oc_sql_api.py | PASS | 8 |
| apps/huiguan/tests/test_fan_owner_edit.py | PASS | 2 |
| apps/huiguan/tests/test_original_image_access.py | PASS | 10 |
| apps/huiguan/tests/test_edit_role_column.py | PASS | 1 |
| apps/huiguan/tests/test_fan_reaction_migration.py | PASS | 1 |
| apps/huiguan/tests/test_fanart_upload_limit.py | PASS | 2 |
| apps/huiguan/tests/test_fanart_volumes.py | PASS | 4 |
| apps/huiguan/tests/test_official_title_blacklist.py | PASS | 6 |
| services/platform/tests/test_account_progress.py | PASS | 16 |
| services/platform/tests/test_game_save_scope.py | PASS | 10 |
| services/platform/tests/test_huiguan_oauth_session.py | PASS | 6 |
| services/platform/tests/test_static_security.py | PASS | 脚本检查 |
| services/platform/tests/test_source_export.py | PASS | 1 |
| apps/cards/tests/test_gate_identity_scope.py | PASS | 10 |
| apps/huiguan/tests/oc-revisions.cjs | PASS | 1 |

## 合成容量样本

5000 个 owner、10000 条 OC、4 个写入进程、200 次更新：0.167 秒，单次写入 p50 0.46 ms、p95 4.27 ms、最大 62.37 ms。200 次均成功且记录数不变，SQLite integrity_check 通过。此样本不包含生产网络/登录负载，不代表 5000 同时在线承诺。

## 覆盖内容

- CRUD、同 owner 多 OC、local/usso 同 UID 隔离、伪造 owner 和他人 ID 无法操作。
- 多进程不同 OC 并发不丢记录、同 revision 只有一次成功，其他明确 409；缺版本 428。
- 旧全量名单不删除新 OC，删除后重建/改编号不接受旧 token。
- 数据库故障回滚并可恢复；公开投影、海报、登记积分失败时 OC 同时回滚。
- 导入 dry-run、重复执行、重复键/重复 code/无效 owner 拒绝、不泄露记录内容、嵌套内容与哈希保真。
- freeze/import/verify/activate、SQL 有增改删后的回滚新导出、拒绝激活旧 JSON、迁移未激活时仅能恢复未变化原 JSON。
- 现有 backup-storage 实际快照/校验与 SQLite Backup API 恢复后 OC 内容一致。
- Cards 读取当前 SQL，冻结状态返回 503，不悄悄读旧 JSON。
- 修改页面内联 JS 另经 Node vm.Script 语法检查；revision helper 有单独 Node 测试。

## 修改文件和目的

| 文件 | 主要变更 |
| --- | --- |
| services/platform/oc_store.py | SQL/JSON 单一适配层、schema、owner 索引、CRUD、OCC、事务、跨进程围栏、引擎门槛 |
| services/platform/oc_migration.py | 多来源校验、幂等导入、内容哈希、元数据检查、新文件回滚导出 |
| tools/runtime/oc-storage.py | 默认 dry-run、冻结、激活、验证、中止迁移恢复、回滚导出命令 |
| apps/huiguan/server_huiguan.py | OC API、后台、公开档案、海报、积分适配同一数据层 |
| apps/cards/server.py | 去除直接读 JSON，Gate 候选走 Store |
| apps/huiguan/migrate_characters.py | 原外置脚本走 Store，明确停写和生产授权参数 |
| services/platform/account_progress.py | award_sheet 支持外层事务 SAVEPOINT，不改积分规则 |
| apps/huiguan/index.html 及 oc-revisions.js | 单条/批量保存传版本，编辑打开时固定版本，冲突提示 |
| apps/huiguan/haibao/index.html | 海报绑定带角色 revision，并接收新 revision |
| 新增 OC Python/Node 测试和回归入口 | 实测上述场景，并运行既有依赖测试 |
| test_edit_role_column.py | 修正 macOS /var 与 /private/var 同一路径的判断，仅影响测试 |
| docs/database.md、storage-runtime-writers.md、storage/oc-sql-*.md | 数据事实源、数据库比较、配置、schema、验收、人工迁移与恢复手册 |

## 尚未进行

没有完整仓库 npm/build/release 回归，当前本机为定向源码快照，不含所有站点依赖。GitHub CI 另行执行全库检查，状态以运行结果为准。未读取真实 JSON、生产库或私人上传。香港当前 release、部署目录、外部 Operations/cron、全部真实数据来源、合格 SQLite 和异地恢复仍需负责人确认，故不是 READY FOR MANUAL PRODUCTION MIGRATION。

## 推荐合并审阅

先审 SQL 模型、owner/code 语义、公开 HTML 契约、前端版本请求、切换/回滚与现有失更新修复分支的重叠。fix/characters-json-lost-update 未合并/改写；SQL 改造已提供 JSON 围栏适配，不能在整合时把旧的整份 JSON 写回路径重新带回来。生产切换需要另行人工批准。

## 2026-10-26 评审修复复验

佳霖指出的三个问题均已用代码和新增测试确认。首轮 99 项通过不代表覆盖了这些场景：公开同编号兼容性、member 页面删除请求以及环境变量缺省值均有测试遗漏。

| 问题 | 修复与验证 |
| --- | --- |
| 不同 owner 使用相同公开编号时返回 409，包括默认 JSON 模式 | 恢复旧版首个可展示记录的选择行为。JSON 保留文件中的 owner 顺序；SQL 显式按迁移保留的 owner/记录顺序查询。新增 JSON、SQL 真实 HTTP 展示页回归；修改前两项均收到 409，修改后通过。私有资料仍检查 owner。 |
| member.html 后台删除没有传 revision | 从后台列表记录绑定并发送对应 version；遇到 409/428 刷新列表并要求重新确认，绝不先获取最新版本自动重试删除。成功后同样清除列表缓存。新增实际页面函数的 Node 测试以及后台列表→编辑→旧版本删除拒绝→重新确认删除的 HTTP 测试。修复前 Node 测试确认缺少 version。 |
| 未设置环境变量时绕过 SQLite WAL 引擎门槛 | 只有明确的 development/test 可以豁免；缺省、空白、未知值、staging、production 均检查引擎版本。新增缺省等场景回归，修复前其中四个子场景失败；测试夹具显式声明 test，修复后通过。 |

复验命令仍为 `python3 tools/checks/oc-storage-regression.py --report <报告路径>`。本次 **19 组全部通过，105 项可计数测试通过**，静态安全脚本另以退出码验证。全部使用临时合成数据。容量样本仍为 5000 owner / 10000 OC / 4 进程 / 200 次更新，本次 0.194 秒、p95 4.27 ms；这不是生产吞吐量承诺。本次未进行真实移动端后台页面点击验证；Node 测试直接执行页面的删除函数并检查按钮传参，HTTP 测试执行后端实际接口。

本轮修改位于独立 `fix/oc-sql-review` 分支，基于远程 `feat/oc-sql-storage` 的 f2caa3b36f78a50a5c35a4005cc6827b84907134；不覆盖原 SQL 分支。开发环境修复完成，生产仍以原 JSON 为事实源。没有执行生产迁移或部署。

### PR #10 与后续整合

检查时 PR #10 仍为 open、merged=false，head 为 cd8e9f351a0c4e58cfa8d807a62807ef9d5e579b；master 为 387c19d5a84a3da6fa224b490b49172028abf7a0。本轮没有合并 PR、变基、强制推送或改写其他分支。

建议先由负责人完成 PR #10 的评审与合并，再读取新的主线 SHA，将 SQL 改造和本轮修复整合到新开发分支，或在获得对共享分支变基的明确授权后变基。重点处理 server_huiguan.py、migrate_characters.py、storage-runtime-writers.md 的重叠，并保留主线新的仓库约束和恢复文档。不得为了消除冲突恢复 Store 之外的整份 JSON 写回路径。整合后重跑 PR #10 的 JSON 并发回归、OC SQL 回归和全库 merge-gate；本轮测试不代表已经验证 PR #10 与 SQL 的组合。

文件围栏只约束认识它的新进程。生产冻结时必须真正停止所有旧服务、脚本和计划任务写入者；`--confirm-stopped` 是操作员声明，不会检测或阻止旧进程。停写、备份、迁移、切换和恢复仍按操作手册由负责人分别确认。
