# OC SQL 存储实现与验收

本次开发状态为 DEVELOPMENT COMPLETE。生产 OC 在人工批准并实际切换以前仍以 characters.json 为事实源。本文不是生产执行授权；尚未达到 READY FOR MANUAL PRODUCTION MIGRATION。

## 现状和证据

源码基线为 master `387c19d5a84a3da6fa224b490b49172028abf7a0`，采用 apps/services/packages/tools/infra 布局。本机通过 GitHub 读取的定向源码快照实施，保留独立本地 Git 分支和可审阅 diff；不是已配置生产凭据的完整运行工作区。远程提交基于真实 master 的完整 tree，只替换本任务文件。

- `apps/huiguan/server_huiguan.py` 原来把所有账号的人设放在一份 JSON 字典：`{owner_key: [{code, data, html或html_ref, …}]}`。`local:<uid>` 明确属于本地账号，裸 UID 明确属于 USSO；两个 kind 的同号 UID 不是同一 owner。
- OC 编号 `code` 只在 owner 内唯一，原接口允许不同 owner 使用相同编号。不能把 code 直接改成全局唯一约束。新表另设稳定内部 id；现存记录带 id 时保留它，否则确定性生成导入 id。原 code、内层 data.code 和所有自定义字段均保留。
- 原 `load_data()` 和 `save_data()` 分别加锁，线程间可以各自读到旧文件，最后写回者覆盖其他人的修改。整份 JSON 的读写锁不能提供同一 OC 的版本冲突检查，也不是数据库事务。
- 仓库另有未合并的 `fix/characters-json-lost-update@cd8e9f3`，通过一个 `update_data()` 串行化整份文件，修复进程内 lost update。本次只读审阅该分支，没有合并、删除或改写；SQL 改造覆盖这些写路径，同时保留默认 JSON 兼容适配器。
- 现有会馆 `users.db` 已保存账号、会话、公开角色投影 fan_characters、海报、积分、云存档。源代码启动时非 Windows 使用 WAL，Windows 保留原 DELETE journal 兼容策略。普通 db() 的 NORMAL 同步设置保留；OC 数据层连接单独要求 FULL、foreign_keys=ON、busy_timeout=10000ms、显式事务、及时关闭。
- `docs/database.md` 中仍有旧的源码内路径；当前路径以 `storage_paths.py`、就绪标记和 `docs/storage-runtime-writers.md` 为准：`<storage-root>/<environment>/data/huiguan/{users.db,characters.json}`。图片和展示文档在独立 managed assets 中，只迁移 JSON 引用不会迁移图片字节。
- `docs/operations.md` 明确香港仍是旧布局及线上热修复，本机是新 canonical 布局。现有分支中的恢复记录把香港数据指向 `/srv/iridescently/data/portal/huiguan/`，这是待负责人核对的既有证据，未登录香港确认。不能把本机路径或旧文档路径直接用于生产命令。

## 数据库决定

采用现有会馆 users.db 的 SQLite 表，而不是新建一份平行 OC 数据库。理由是 OC、公开投影、海报绑定、账号删除和积分能够在同一连接中原子更新，且直接复用当前环境隔离、备份和恢复工具。

| 维度 | SQLite 同库实现 | PostgreSQL 候选 |
| --- | --- | --- |
| 既有集成 | 会馆账号、投影、海报、积分已在此库 | activation-core 有 pg Pool、Drizzle 和导入导出，但服务于激活码/管理员/玩家会话，不是会馆 owner 数据源；未确认它是可供 OC 复用的已运维生产数据库 |
| 一致性 | 同一事务完成 OC、公开投影、关联海报与登记积分 | 只把 OC 放进 PG，会新增与 SQLite 账号/投影之间的一致性问题；需要额外迁移或可靠事务外盒协议，本次不扩大到账号重构 |
| 并发 | 多线程/同机多进程可读写，数据库仍只有一个同时写入者；必须短事务、等待及 OCC | 适合跨主机连接、多实例写入、行锁与更高写并发；仍必须使用 revision 防止逻辑覆盖 |
| 备份恢复 | SQLite Backup API + 完整 assets/JSON 快照，按环境隔离，需异地副本与演练 | pg_dump、基础备份和 WAL 归档/PITR，需要单独运维、权限、连接池、灾备演练 |
| 增长边界 | 用户数本身不等于写吞吐；实测 5000 个合成 owner、10000 条 OC、4 进程 200 次更新，不代表 5000 人同时在线 | 如确定多服务器同时写、跨区中心数据库或高可用目标，应在扩容前采用 PG；不得共享 SQLite 文件到 NFS/跨机磁盘 |

没有实现或声称测试 PostgreSQL adapter。当前 DAL 把 owner、CRUD 和版本语义集中起来，后续 PG 迁移仍需实现同等事务接口、会馆投影/积分一致性和新一轮数据迁移验证，不能只替换一个 DSN。

参考：[SQLite 使用场景](https://www.sqlite.org/whentouse.html)、[WAL 限制与修复版本](https://sqlite.org/wal.html)、[PostgreSQL 并发控制](https://www.postgresql.org/docs/current/mvcc.html)、[PG 备份恢复](https://www.postgresql.org/docs/current/backup.html)。

### 引擎版本门槛

本次本机运行 Python 3.13.15 / SQLite 3.50.4。官方确认 3.7.0–3.51.2 有罕见 WAL-reset 损坏风险，修复版本为 3.51.3+，另有 3.50.7 与 3.44.6 回补。本次功能和并发测试通过不能证明旧引擎没有该问题。

`require_safe_wal()` 对 production/staging 的 SQL WAL 连接及 activate-sql 加门槛：未修复引擎返回 `oc_sqlite_wal_patch_required`，不继续 SQL 操作。开发/test 可运行回归；生产还必须核对实际发行版、Windows 兼容策略和所有同库服务的引擎版本，完成恢复演练。这不是自动升级任何机器。

## 模型和接口

`services/platform/oc_store.py` 是唯一 OC 数据访问层。表结构由 `initialize_schema()` 管理，增量建表，不修改原账号主键：

- `oc_records(id PRIMARY KEY, owner_kind, owner_uid, code, name, record_json, created_at, updated_at, version, position)`。
- `UNIQUE(owner_kind,owner_uid,code)`；owner/position 索引、code 查询索引。kind 限定 local/usso，record_json 校验合法 JSON，version 为正整数。
- `record_json` 保存完整原始记录，包括自定义顶层属性、嵌套 data、HTML/资产引用。迁移不拆掉未知字段；正常保存继续沿用原 API 的完整 data 替换语义。
- 可可靠识别的原时间字符串原样保存在列中；缺失时间保留 NULL，不编造历史时间。新建和修改使用服务端 UTC 时间；原资料内时间字段不重写。
- `oc_owners` 保存 owner 列表与顺序，包含原来空列表，确保导出不丢 owner 桶。
- `oc_code_revisions` 保存编号最后使用的 revision，避免删除后重建或改编号后旧页面的 token 又碰巧有效。revision 只增不减，可能跳号，不是 schema version。
- `oc_migrations` 记录源文件组合哈希、规范化内容哈希、记录数和迁移时间。

接口为 `Store.list/get/public_records/admin_rows/transaction` 和事务会话的 `save/replace/delete/delete_owner`。所有普通查询、修改和删除都带服务端认证产生的 owner。创建前还在同一 SQL 事务中检查账号存在，防止认证后恰好被管理员删除的账号重新产生孤儿 OC。

### HTTP 兼容

- 保留 `/api/get-characters`、`/api/save-character`、`/api/save-all-characters`、`/api/user/ocs`、后台、海报、公开档案和 SSO 配色接口。原资料格式及 code 不变。
- 新增 `GET /api/oc?code=…` 或 `?id=…` 获取本人完整记录；`POST /api/delete-character` 删除本人记录。
- SQL 读取附加 `_oc_id` 与 `_oc_version`，两者是传输元数据，不写入原 OC JSON。单条更新/删除提交 `version`，过期返回 409，漏传更新版本返回 428；创建可传 0。
- 批量保存提交完整 `versions: {code: revision}` 快照。它必须与服务器当前名册完全一致，防止旧列表删除别人刚在另一个页面新建的 OC。整批修改、删除、投影同步是同一事务。
- 海报绑定提交 `character_version`；海报 INSERT、OC 配色更新、公开投影刷新一起提交或回滚。
- 登记积分使用现有 award_sheet 规则；只新增 SAVEPOINT 支持，让它参加外层 OC 事务，不改其他游戏积分数值。
- Cards `_owned_ocs` 不再直接打开 JSON，同样使用 Store；OC 候选及 Gate 导入归属检查继续识别原 owner-local code。
- 原 `/api/get-character?code=…` 是公开生成展示页接口，继续只返回既有公开 HTML，不提供私有 OC JSON。同编号跨 owner 的公开展示存在歧义时返回 409，不再任意返回第一位 owner 的页面。
- 旧缓存页面在 JSON 模式继续运行；SQL 模式的旧客户端缺少版本时会被拒绝，绝不通过服务器补读最新版本后静默覆盖。部署前必须同时交付本次版本感知的 HTML/JS 并要求重新加载。

SQL 下 OC、公开投影、海报与积分的数据库写入使用同一事务。上传和内容寻址 HTML 在事务前准备；失败可能保留未引用的资产文件，但不会删除共用资产或留下半条 OC。未引入后台双写。

## 隐式依赖核对

| 路径/消费者 | 处理 |
| --- | --- |
| 会馆本人列表、保存、批量替换、缺页修复、SSO 主题、公开展示 | 统一 Store；本人读取按 owner 索引，公开 code 查询不再载入全体人设 |
| 后台人设投影、管理员删除 OC、删除账号 | SQL 投影不再按 JSON mtime 缓存；删除事务适配 |
| fan publish/check-suggest 与同步投影 | 从 Store 读本人 OC，继续保留画廊可见性和 owner 语义 |
| 海报绑定/配色更新 | 同库事务 + revision |
| Cards server.py 的 Gate OC 列表与来源校验 | 修掉直接读文件的隐式依赖，继续走受控后端 |
| migrate_characters.py 资产外置 | 改用 Store，要求停写确认；不再整份 save_data() 写回 |
| tools/runtime/storage-migrate.py | 仍把旧 JSON 作为迁移前数据源，不自动改成 SQL 真值 |
| tools/runtime/backup-storage.py | 已遍历 data/assets 并用 SQLite Backup API；users.db 新表自动被覆盖，无需新增一个不一致的独立备份器 |
| tools/build/build-site.py、静态服务与 source-export fixture | 原 runtime 排除和静态拒绝保留；现有测试复测 |
| activation-core 的数据库导入导出 | 独立激活码服务，无 OC 数据读写，不改动 |

使用已有审计/边界文档、远程 tree、当前源码缓存与定向补充下载检索。GitHub 搜索返回不完整/空结果，未用它证明无引用。仓库外 Operations、香港现用热修复和计划任务不在本机快照中，仍需要负责人逐项确认。

## 切换与回滚

配置为 `IRIDESCENTLY_OC_BACKEND=json|sqlite`，默认 json。`characters-storage-state.json` 是显式权威存储围栏，状态为 json、frozen 或 sqlite。配置和围栏不一致、处于冻结状态时拒绝 OC 访问，不自动回退，也不自动在两边导入/写入。

文件围栏同时使用进程内锁与 OS 文件锁；SQLite 业务事务使用 BEGIN IMMEDIATE、10 秒 busy timeout、FULL 同步和受 revision 条件限制的更新。冻结操作持有独占围栏，等待已进入的受控事务完成；状态文件及 JSON 原子替换并在支持的平台同步目录。

旧二进制不认识围栏，因此生产必须先真正停掉所有旧写入进程和脚本，再人工确认 freeze。`--confirm-stopped` 是操作员确认，不是程序检测。完整步骤、前置条件及 SQL 写入后的回滚对账见 [生产迁移手册](oc-sql-runbook.md)。

## 开发验证

```bash
python3 tools/checks/oc-storage-regression.py --report /绝对路径/oc-sql-regression.json
```

测试只使用新建临时 test 目录、合成账号/图片和本机随机端口；不读真实 JSON、生产库或用户上传。包含 CRUD、同 UID 不同 kind、不同用户权限、多个 OC、不同进程并发、同记录冲突、缺版本、批量快照冲突、删除重建、数据库故障回滚及恢复、积分/公开投影/海报事务、迁移与二次执行、非法 owner/重复 JSON 键/多源重复、完整规范化内容哈希、回滚导出包含切换后的增改删、Gate 读取与冻结、旧 API 和旧回归。

合成容量样本是 5000 个 owner、10000 条 OC（每个 owner 一条含约 8 KiB 自定义内容）、4 个写入进程、200 次不同 OC 保存。本机耗时和分位数以测试报告为准，不代表生产磁盘、全部登录链路、5000 同时在线或容灾性能。

未执行完整前端/全仓库 build 和 release 回归；本地为定向源码快照，未安装所有站点依赖。已运行修改页面的内联脚本语法校验与 revision helper 测试，实际 HTTP 集成与相关旧测试结果在交付报告中列明。未执行生产迁移或生产部署。
