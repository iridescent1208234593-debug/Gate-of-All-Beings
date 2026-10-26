# OC SQL 开发验收记录

状态 DEVELOPMENT COMPLETE。未执行生产数据迁移、未删除原始 JSON、未部署。源码基线 master 387c19d5a84a3da6fa224b490b49172028abf7a0。

## 实际运行

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
