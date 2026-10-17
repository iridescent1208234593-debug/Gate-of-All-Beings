# Stage 1.8.3 — 受控发布预检清单与待发布改动风险

日期：2026-10-17。状态：**未发布**。本文只记录事实与检查项，不授权发布。

## 1. 当前状态（实测）

- 候选 `.releases/candidate/site` 与生产 `production.json` 的 site 组件完全相同（均为 `779231c`，builtAt 2026-10-17T15:24:08Z，1,089 文件，0 新增/删除/修改）。**按现状没有可发布内容。** 发布需要先重新构建候选。
- 生产在今日已被多次发布（11:50Z、15:24Z），说明有其他人/会话在并行发布。
- Portal PID 61024、Cards OAuth PID 12196 的 cwd 为 `.releases\runtime\*`，生产树下无 cwd 占用进程。
- 未见 `.releases/.promotion` 残留。

## 2. 发布前检查清单

每项发布前都要重新做，不沿用本文旧结果。

1. **确认没有并行发布/构建**：检查 `.releases/.promotion` 不存在；问清是否有其他会话正在发布或编辑 `server/`、`portal/`。
2. **冻结发布内容**：固定一个 commit（工作树目前 `sourceDirty=true`，生产也一直是脏树构建）。建议先把要发布的改动提交，使 `sourceHead` 可追溯。
3. **构建候选**：`build:site`（及需要时 `build:cards`/`build:modules`），不使用 work/ 下的临时脚本。
4. **候选 vs 生产差异表**：逐文件列出新增/删除/修改；与第 3 节"预期改动"逐条对照，出现未预期文件则中止。
5. **候选清单校验**：manifest SHA-256 全部通过（发布器自带校验）。
6. **cwd 扫描**：确认没有进程 cwd 位于 `.releases\production`（脚本见 STAGE1_8_2 报告）。当前满足。
7. **备份**：`production.json`、`.releases/production/site`（回滚用，发布器会保留 `.promotion/previous`）、`users.db`、`juling/data/save.db`；若采用 WAL（见风险 R2），备份须包含 `-wal`/`-shm` 或先 checkpoint。
8. **本地验证**：Python 语法编译、`server/test_static_security.py`、`verify_portal.py`、Website Manager health 测试。
9. **回滚方案**：旧版本保留位置、回滚命令、是否需要重启服务；明确谁来执行。
10. **发布窗口**：避开高峰；预计服务不中断（rename 不需停服），但若改动了 Python 代码，**需重启 Portal/Cards 才生效**，会有约 10–20 秒中断且 Cards 登录会话清空（会话在内存中）。
11. **发布后验证**：8080/5174 返回 200；经 Cloudflare 的 9 个 hostname 抽查；`scraping.log` 仍在写入；`production.json` 记录；响应头（HSTS/CSP-Report-Only）不回退；错误日志无新增。
12. **用户明确确认后才执行发布命令。**

## 3. 工作树中未提交、尚未上线的改动（相对生产 779231c）

| 文件 | 改动 | 与安全阶段关系 |
| --- | --- | --- |
| `server/portal_server.py` | 自定义 `ThreadingHTTPServer`：`daemon_threads`、backlog 1024、连接 60s 超时 | 抗慢连接/连接耗尽，偏稳定性；安全相关 |
| `server/app/src/cards/server.py` | 由单线程 `HTTPServer` 改为 Threading，backlog 512、60s 超时 | 同上；见 R1 |
| `server/base_static.py` | 哈希资源 `immutable` 一年缓存、字体缓存、异常后 `close_connection=True` | 性能为主；缓存头变化 |
| `portal/huiguan/server_huiguan.py` | SQLite `timeout=30`、`synchronous=NORMAL`、`journal_mode=WAL`；注册时在锁外做 scrypt；导入 `valid_asset_url` | 稳定性/抗注册突发；见 R2、R3 |
| `portal/huiguan/watchdog.py`、`ops/网站恢复/website-manager.py`（及其 README） | cwd 移出 production（本阶段 1.8.2 的修改） | 发布架构修复 |
| `portal/www/connections.html`、`styles/connections.css`、`shared/shared-types/world.js` | 页面/样式/注释 | 非安全，内容改动 |
| `New project/six-system-arena/docs/*.md` 等 | 文档 | 无关 |

注：这些大部分不是本安全阶段产生，属于并行会话的性能/稳定性工作；归属未逐一确认。

## 4. 风险

- **R1 Cards 线程安全（中）**：`cards/server.py` 的 `sessions` 是全局 dict（`server.py:95`），改为多线程后并发读写；单个 dict 操作在 CPython 下基本安全，但"检查再删除"（如 `if sid in sessions` 后 `del`）存在竞态，可能 KeyError。需要代码审查或加锁后再发。
- **R2 WAL 模式持久化（中高）**：`PRAGMA journal_mode=WAL` 会改写数据库文件的持久模式并产生 `-wal`/`-shm`。影响：①所有备份/拷贝（含本阶段的还原演练、ops/backups 脚本）必须带上这些文件或先 checkpoint，否则丢最近写入；②回滚到旧代码后旧代码仍可读 WAL 库，但**拷贝单个 .db 文件会丢数据**；③数据库在网络/同步盘上不安全（OneDrive 同步风险）。需要先确认 `users.db` 所在位置与备份流程。
- **R3 `synchronous=NORMAL`（低）**：WAL 下断电可能丢最近事务，但不损坏库；账户注册数据可接受性需确认。
- **R4 `immutable` 缓存（中）**：正则只匹配 `/assets/<name>-<8位hash>.<ext>`；若有同名不变更内容的资源，浏览器与 Cloudflare 会缓存一年，无法在不改文件名的情况下修复。需确认构建产物确为内容哈希命名，且 Cloudflare 缓存规则不会放大。
- **R5 60 秒连接超时（低中）**：会掐断空闲 > 60s 的长连接；Spirit WebSocket 代理（`WebSocketProxyHandler`）走 Portal，必须验证 WebSocket 空闲/心跳是否会被误断。
- **R6 源码树与发布快照不一致（中）**：Cards 从 `IRIDESCENTLY_PROJECT_ROOT/server` 导入 `base_static`/`hx_sso`/`account_profile`（源码树，非发布快照）。因此源码树里的 `base_static.py` 改动在 Cards 重启时**立即生效，绕过发布流程**。
- **R7 脏树构建（中）**：生产多次从 `sourceDirty=true` 构建，无法保证"发布内容 = 某个提交"，回溯与回滚依据弱。
- **R8 并行发布（中）**：同一天内多次发布，可能互相覆盖；发布前必须确认没有其他会话在改同一批文件。
- **R9 重启需求**：上述 Python 改动需重启才生效；发布 ≠ 生效，需明确生效时点。

## 5. 仍未确认

Cloudflare 的 WAF/Bot/限速/Hotlink/缓存配置；线上 robots.txt 实际响应；`scraping.log` 流量分析与限速阈值；R1–R5 的实际测试；上述改动的归属。

## 6. 建议顺序

1. 先审查 R1、R2、R5（必要时只发布无风险子集）；2. 把确认要发的改动提交；3. 构建候选并产出差异表；4. 你确认后发布；5. 按第 2 节第 11 项验证。

---

## 7. 风险验证结果（2026-10-18，全部在隔离环境，未发布、未重启线上服务）

证据位于 `work/stage1.8.3-r2/`（`drill.py`/`result.json`、`r1_stress.py`、`r5.py`/`r5b.py`、`r6/`）。

### R2 WAL 备份 — 已验证，附带发现
- **线上 `portal/huiguan/users.db` 已经是 WAL 模式**（文件头标志=2，存在 `-wal`/`-shm`；cards `users.db`、juling `save.db` 仍是 delete 模式）。也就是说 R2 不是"发布后才会出现"的风险，现在就存在。
- 写入中的 WAL 库演练（持续写入，WAL 约 2.2MB，主文件仅 4KB）：
  | 方法 | 结果 |
  | --- | --- |
  | 只拷 `.db`（朴素文件备份） | **完全失效**：恢复后"no such table"，数据全丢 |
  | 同时拷 db+wal+shm（写入中） | 可恢复，integrity ok，少于拷贝瞬间提交数 2 行 |
  | sqlite3 `backup()` API | 可恢复，integrity ok |
  | `VACUUM INTO` | 可恢复，integrity ok |
  | 恢复时旧 `-wal`/`-shm` 仍在目录里 | **危险**：旧 WAL 被重放，"恢复"后数据变回写入时的状态，备份被悄悄覆盖 |
- 现有备份脚本（`work/stage15_backup.py`）对 SQLite 用 `backup()` API，是安全的。对真实 `portal/huiguan/users.db` 做了只读 `backup()`：integrity ok，26 张表，users 行数一致。
- 结论：备份必须用 `backup()`/`VACUUM INTO`；**恢复前必须先删除目标旁的 `-wal`/`-shm`**；任何 rsync/OneDrive/复制 `*.db` 的流程都不可用于该库。该点需写入恢复手册。

### R6 Cards 从源码树导入 — 已修复（未提交、未上线）
- 修改 `server/app/src/cards/server.py`：`sys.path` 改为来自本文件所在树的 `CODE_ROOT`（`parents[4]`），`IRIDESCENTLY_PROJECT_ROOT` 只用于数据；不再把项目根加入 `sys.path`（所导入的模块均在 `server/` 下）。
- 对照实验：源码树放一个会抛异常的 `base_static.py`——旧代码启动即崩（"POISON"），新代码正常监听。数据路径（`users.db`、头像资源）仍由环境变量决定，行为未变。
- 仍待办：该修复需随发布生效并重启 Cards。在此之前，线上 Cards 仍从源码树 `server/` 导入。

### R1 sessions 竞态 — 已复现并修复（未提交、未上线）
- 复现：8 线程同时访问同一个过期会话，20,000 轮中 **2,448 轮抛 KeyError**（`_get_session` 的 `del`）。
- 修复：过期删除、`/api/logout` 改为 `pop(..., None)`；OAuth `state` 改为在校验处原子 `pop`（单次使用，同时去掉了回调末尾会 KeyError 的 `del`）。修复后同压力 0 错误。
- 未解决/新发现：①`state_map` 在代码里**从未被写入**（只读和删除），OAuth 回调的 state 校验总会失败，登录流程可能走的是别的路径或已失效，需确认；②`sessions` 没有过期清理，长期运行内存只增不减（匿名请求不创建会话，风险较低）。③未对真实 OAuth 回调做压测（需要外部 SSO）。

### R5 60 秒超时与 Spirit WebSocket — 无问题
- 用真实 `WebSocketProxyHandler` + 与 `portal_server.py` 相同的 `_Server`：静默 75s 仍存活；静默 110s 在 **90s** 被代理关闭（这是既有的 `select(..., 90)` 空闲上限，不是新的 60s 超时，因为升级后代理会重设超时）；上游每 20s ping，连接 200s 仍存活（收到 10 个 ping）。
- Spirit 服务端每 15s `ping`（`spirit-multiplayer.js:232`），远小于 90s，正常使用不会被断。浏览器端重连未测。

### R4 immutable 缓存 — 发现确切缺陷，未改（按你的顺序后处理）
- `HASHED_ASSET` 正则 `-[A-Za-z0-9_-]{8}\.<ext>` 会误匹配以 8 个字母结尾的普通文件名。生产树中已有实例：`/assets/site-language.js`（"language"恰好 8 位）——它不是内容哈希文件，却会得到一年 `immutable`，改了内容用户也拿不到新版。
- 建议：改正则要求哈希段含数字/大写/下划线之一（Vite 的 8 位哈希几乎都满足；不满足时只是不 immutable，安全失败），或只对构建产物目录启用；HTML/manifest 永不 immutable（当前正则已不覆盖 HTML）。

### 当前发布结论
R2 不阻塞代码发布，但阻塞"恢复手册"；R6、R1 的修复已在源码树中，需随一次受控发布（含 Cards 重启）上线；R4 的正则在修复前不应发布 `base_static.py` 的缓存改动。

### R4 修复结果（2026-10-18，未发布）
- `server/base_static.py` 的 `HASHED_ASSET` 现要求 8 位哈希段含数字、大写字母或下划线（正向预查）。
- 单元用例 7/7：`site-language.js`、`white-tiger.svg`、`chunk-abcdefgh.js` 不匹配；`index-DWinRAgE.js`、`style-a1b2c3d4.css`、`x-Ab_cD-eF.js` 匹配。
- 在 944 个真实 `/assets/` 文件（生产树、候选、Softie dist、modules）上对比：旧规则命中 306，新规则 296，**无新增命中**；被排除的 10 个路径（5 个唯一文件）全是非哈希的可变文件：`site-language.js`、`oc-avatar-q.svg`、`wechat-group-qr.png`（旧规则会给它们一年 immutable，含微信群二维码）。全部真实 Vite 哈希文件仍保持 immutable。
- 局限：全小写字母、不含数字/下划线的真实哈希（概率约 0.07%）会失去 immutable，仅损失缓存，不会出错。驼峰命名的可变文件（如 `chart-Settings.js`）仍可能误判；当前树中没有这类文件，新增资源时需留意。
