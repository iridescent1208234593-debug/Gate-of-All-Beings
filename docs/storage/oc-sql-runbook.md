# OC 人工生产迁移与恢复手册

当前仅完成开发代码与临时数据验证，不具备本次生产执行授权。生产事实源仍为原 characters.json。本机和香港不共享数据库或存储根；不能把本机测试库、测试账号或 readiness marker 复制到香港。

## 必须由佳霖确认的前提

1. 香港实际 release、Python/SQLite 版本、用户库、characters.json、uploads/store 和外部 Operations 的真实位置与服务账户权限。旧布局与 canonical 新布局的接入方式单独评审，不能直接部署本分支。
2. 核查是否只有一份正在被写的 JSON；历史备份不当作第二份实时数据。检查会馆、Cards、后台、cron、外置脚本和其他进程，确认没有遗漏的旧文件写入者。
3. 如果计划多主机共同写或高可用，先批准 PG 方案及账号/投影一致性设计，不把 SQLite 文件挂载到网络盘。香港与本机各自存储隔离。
4. production/staging WAL 引擎必须包含官方 WAL-reset 修复（3.51.3+、3.50.7 或 3.44.6 回补线），并确认项目原 Windows WAL 兼容限制。所有共用 users.db 的服务都需要合格引擎。
5. 在 staging 或获准的脱敏副本完成全流程：导入、两客户端编辑、并发保存、后台删除、画廊/海报/Gate、重启、故障注入、备份恢复、SQL 已有新数据后的回滚。生产原件不用于本机测试。
6. 确认维护窗口、通知、可接受停机时间、异地备份目的地、数据访问权限、恢复负责人和观察指标。确认版本感知的前端会随后端交付，旧缓存更新被 428 拒绝时有操作指引。

以下命令是操作模板。先把环境、绝对存储根和 Python 可执行文件核实为目标环境；不要复制本机示例路径冒充香港。工具不会 ssh、停服务、启动服务、改 DNS 或部署。

## 备份

停掉所有相关服务、后台任务和旧脚本；数据库与 JSON/资产需要同一个逻辑时间点。

在已完成 canonical 存储迁移且 readiness 校验通过的目标环境：

```bash
python tools/runtime/backup-storage.py snapshot
python tools/runtime/backup-storage.py verify <上条返回的快照目录>
```

这覆盖 data、assets，SQLite 通过 Backup API 复制，不直接只拷贝 WAL 模式的 .db 主文件。保存 users.db、原始 JSON、全部图片/HTML 引用、围栏状态及哈希清单。异地复制后再次核验并演练恢复；同服务器副本不算异地备份。

香港仍处于旧布局时，先用经批准的现有备份工具取得等价完整备份；不要对旧布局盲目运行本机存储初始化/搬迁工具。将数据安全接入当前存储契约是独立审批事项。

## 只读预检

在目标存储根已明确、环境就绪的前提下，导入默认 dry-run；不创建缺失的 DB、不建表、不写 JSON。

```bash
python tools/runtime/oc-storage.py status
python tools/runtime/oc-storage.py import --dry-run
```

确实存在多份互不重叠的活跃来源时，重复 `--source <绝对文件路径>`。工具不扫描任意磁盘、不自动导入备份。重复 owner 桶、重复 owner 内 code、重复原始全局 id、无效 JSON/嵌套数据、重复 JSON 键、非法/无对应账户 owner 都会报告并阻断整次导入，不猜归属。报告只含计数、哈希、来源序号与错误位置，不打印人设内容、姓名或 owner UID。

确认报告 valid=true，保存源文件字节哈希、规范化内容哈希与记录数。人工处理异常前保留原始文件。跨 owner 重复 code 是原接口允许的情况，不自动合并；报告的 `codes_shared_across_owners` 给出数量，这些编号的公开展示页继续指向第一个 owner。

所有写命令都要求显式设置 `IRIDESCENTLY_ENVIRONMENT`（未设置时拒绝执行，避免默认 development 绕过生产保护）。服务在 SQL 后端下，只有显式 development/test 才跳过 WAL-reset 引擎门槛，未设置按已部署环境处理。

## 冻结和正式导入

以下生产写操作只能在佳霖进一步授权后人工执行。生产环境每个写操作都需要 `--allow-production`；本说明未执行这些命令。

```bash
python tools/runtime/oc-storage.py freeze --confirm-stopped --allow-production
python tools/runtime/oc-storage.py import --apply --confirm-stopped --allow-production
python tools/runtime/oc-storage.py verify
```

新旧服务都必须保持停止。freeze 的独占围栏会等待认识围栏的事务退出，之后所有认识围栏的服务拒绝 OC 读写；它无法停止不认识围栏的老版本。不要在仅传了确认参数、但实际仍有旧进程运行时继续。

导入在一个事务中完成，保持原始 id（如存在）、owner、code、所有嵌套字段、展示/图片引用与可信原时间。新 schema 是增量表，不重建身份系统。SQL 里已有不同内容时拒绝覆盖；不能通过强制参数抹掉切换后的用户修改。

二次执行相同导入不会重复记录或重置 revision。导入后需要 valid=true、verified=true；检查记录数、owner、code、name、原 id、完整 canonical JSON/哈希、列与 JSON 一致性及 SQLite integrity_check。不要只数行。

原始 JSON 不会被工具删除、重命名或覆盖。多源导入后，激活要求服务路径上的单份 JSON 与 SQL 完全一致；如原系统确有多源，须经单独审阅把合并副本人工提升为该最终来源并重新校验，不能绕过校验直接激活。

## 切换权威存储

服务仍保持停止。正式激活前最后复核 JSON 与 SQL 完整一致：

```bash
python tools/runtime/oc-storage.py activate-sql --confirm-stopped --allow-production
```

该命令只改变围栏状态，不修改服务配置、不启动服务。由负责人在会馆、Cards 及所有 OC 消费方一致配置 `IRIDESCENTLY_OC_BACKEND=sqlite`，再使用批准的发布/启动流程。某个消费者若仍配置 json，会拒绝 OC 访问，不读取过时 JSON 掩盖配置错误。

先做获准的测试账号冒烟：本人两个 OC、不同账号隔离、编辑旧版本 409、删除、画廊、海报、Gate、刷新与重启。核对日志只记录状态/计数，无私密 OC/凭据。观察 SQLite busy/503、409/428、队列等待、错误率、数据库/资产增长和备份耗时。观察期间保留冻结前备份与原 JSON；不得启用双写。SQL 发生新修改后，原 JSON 已是历史快照，不能再次当成当前事实源。

## 切换失败与回滚

### SQL 尚未接受新修改

仍然停服务并 freeze。不要仅因 SQL 导入成功就认定可以恢复 json；必须 verify 证明 SQL 与当前 JSON 一致。若已经激活过 SQLite：

```bash
python tools/runtime/oc-storage.py freeze --confirm-stopped --allow-production
python tools/runtime/oc-storage.py activate-json --confirm-stopped --allow-production
```

确认围栏为 json，再统一配置服务 backend=json，并选择兼容本次围栏的已审阅代码版本恢复服务。旧二进制不会识别围栏，若回退旧代码，需单独核验整套停写与权限约束。

若仍冻结在 json、SQL 从未激活，可以中止迁移并恢复原事实源：

```bash
python tools/runtime/oc-storage.py resume-json --confirm-stopped --allow-production
```

它只允许 frozen 的前一状态为 json，且当前 JSON 字节哈希与 freeze 时完全一致；不会把 SQL 激活后的旧 JSON 重新设为真值。JSON 有变化时拒绝恢复，需要人工对账。不要手工删除 SQL 记录试错，没有跳过校验的强制解冻入口。

### SQL 已产生新增、编辑或删除

直接切回最初的 JSON 会丢数据，禁止这样操作。

1. 停所有写入者，freeze，并为当前 SQL/资产另做一份可恢复快照。
2. 从 SQL 一致性快照导出到**新文件**：

```bash
python tools/runtime/oc-storage.py export --output <新绝对路径/characters.rollback.json> --confirm-stopped --allow-production
```

3. 导出包含 SQL 切换后的新增、编辑和删除结果。旁边的 manifest 保留内容哈希及内部 id/revision/时间元数据；两份文件均按私密数据保管。工具拒绝覆盖已有输出，也不覆盖最初的 JSON。若导出中途失败，保留证据、换一个新输出路径重试，不用删除原件。
4. 在隔离副本核对导出哈希、记录数、owner、内容、资产引用，比较 SQL 快照；保留原始 JSON 和当前 SQL 备份。数据库的 id/code revision 历史仍保留，不随回滚删除。
5. **人工确认后**把验证过的新导出提升为服务读取的 characters.json。该提升会覆盖旧运行路径，属于需要明确授权的生产写操作，本工具没有自动执行它。
6. 执行 activate-json。工具会重新比较当前 SQL 和服务实际 JSON，旧文件未提升或内容不一致时拒绝激活；不会只相信导出 manifest。
7. 一致配置 backend=json，按批准流程恢复并冒烟。SQL 数据库及导出元数据保留，不回到旧数据库快照。以后重新进入 SQL 需要对回滚期间 JSON 新变更重新对账；现工具拒绝把不同 JSON 静默覆盖现有 SQL，不能把原始导入命令当作双向同步器。

## 当前仍未解决的生产事项

香港路径/热修复/计划任务未实时核对；未完成生产数据库备份与异地恢复演练；未在香港/staging 验证 patched SQLite 与全部消费者一致配置；未进行真实数据迁移预检。管理员删除账号的其他旧资料留存规则没有扩展为全站隐私擦除功能。跨主机 PostgreSQL 实现不在本分支。

因此本分支只交付 DEVELOPMENT COMPLETE，不能标记 READY FOR MANUAL PRODUCTION MIGRATION，更不代表获准上线。
