# Stage 1.8.3 — Release Candidate 收口报告

日期：2026-10-18。**未发布，未重启线上服务，未改主工作树的他人改动。**

## Release Decision：NOT READY（候选包本身已验证；发布被两个阻塞项卡住）

候选包可信、可回滚；阻塞来自生产现状，不是候选包。

## Commit 与候选

- 分支 `release/stage1.8.3`（git worktree：`E:\Projects-worktrees\stage183`），基于生产 revision `779231c`，不含主分支其后的任何提交。
- **Commit：`63772b6748ac7d0ea27e61e475832480b0025911`**
- 精确文件（4 个）：
  1. `server/app/src/cards/server.py` — R6（导入边界）+ R1（会话/state 原子 pop）。**不含**同文件里并行会话的多线程 `_Server` 改动。
  2. `server/base_static.py` — R4（`import re` + `HASHED_ASSET` 正则 + immutable 分支）。**不含**同文件里并行会话的 `.ttf/.otf` TTL 与 `close_connection` 改动。
  3. `server/test_stage183_release.py` — 新增回归测试（4 项）。
  4. `docs/security/STAGE1_8_3_RELEASE_CHECKLIST.md` — 清单与风险记录。
- 说明：immutable 分支本身（R4 的前提）原为并行会话的未提交功能，本次连同修复后的正则一起提交；这是唯一"带入"的非本轮代码，已在文件级 diff 中核对仅含这三处。
- 候选：`E:\Projects-worktrees\stage183\.releases\candidate\site`（`sourceHead=63772b6`，`sourceDirty=false`，1,090 文件）。由干净 worktree 中 `git archive HEAD` 构建；门动画 `gate-scene.js` 重新构建后哈希与生产一致（可复现）。**未写入主 `.releases/candidate`**（见阻塞项 1）。构建时临时用目录联接借用 cards 的 node_modules，已移除，源 node_modules 完好。

## production 779231c → candidate 差异（按 manifest）

| 变化 | 文件 | 解释 |
| --- | --- | --- |
| 修改 | `server/app/src/cards/server.py` | R6 + R1 |
| 修改 | `server/base_static.py` | R4 |
| 新增 | `server/test_stage183_release.py` | 回归测试 |

其余 1,087 个文件哈希完全一致。无无关差异。

## 阻塞项

1. **生产磁盘已漂移（HIGH）**：`production/site/server/portal_server.py`（含 spin-guard、多线程）与 `scraping_observer.py`（安全轮转日志）是从**未提交的主工作树热拷贝**进生产的，既不在 `production.json` 清单、也不在任何 commit 中。发布本候选（基于 779231c）会用原子切换把它们**回退**到旧版，等于撤销线上热修。必须先决定：把这两处提交并纳入候选，或明确接受回退。
2. **线上 cwd 回退（HIGH）**：当前线上 Portal(47052)、Cards(58952) 的 cwd 又在 `.releases\production\site` 内（被旧方式重启，非新管家 launch）。此时发布仍会 EPERM。需用新管家 launch 重启，或确认其他启动脚本已改。
3. 分支未合入主线：主线 HEAD 已前进（`b4c7531`），发布前需合并/变基 `release/stage1.8.3`，并重做候选。

## 验证结果（全部隔离环境，真实候选 + 真实发布器 + 真实 launch()）

| 项 | 结果 |
| --- | --- |
| 回归测试（commit 内）：缓存头、正则、Cards 导入边界、会话/state 竞态 | 4/4 PASS；既有 `test_static_security.py` PASS；py_compile PASS |
| Cards session 并发（8 线程×3000 轮过期 + 500 轮 state 单次使用） | 0 错误（旧代码同压力约 12% 轮次 KeyError） |
| Cards 导入/发布边界 | 候选 Cards 在**项目根无任何 `server/*.py`** 时正常启动并服务；旧代码在同条件下无法启动 |
| 差异烟测（旧树 vs 候选树，11 个请求，含 www/huiguan/zszm Host、`/api/login`=410、`/api/user`、`/api/sso-user`、`/api/logout`=302、`/api/callback` 无效 state=400） | 状态码与响应体哈希完全一致 |
| `site-language.js` 缓存头（真实响应） | `max-age=3600`，非 immutable |
| 服务运行中切换 → 重启 | 发布器 exit 0，0 文件系统错误；切换后服务仍存活；重启后正常 |
| cwd 扫描 | 两服务 cwd=`.releases\runtime\*`，production 下 0 个；重启后仍 0 |
| 数据边界 | `users.db` 在项目根，production 树内无 `.db` |
| 回滚 | 用保存的旧树作为候选发布 → 旧 `base_static` 哈希恢复，服务重启后烟测与切换前一致 |
| SQLite WAL 备份/恢复（重跑） | 朴素拷贝 `.db` 全丢；db+wal+shm、`backup()`、`VACUUM INTO` 可恢复；旧 `-wal` 未清除会重放覆盖恢复（结论同前） |
| Spirit WebSocket（候选 `portal_server.py` 中继） | 静默 75s 存活；上游每 20s ping，130s 存活（收到 6 个 ping） |
| SSO/登录 | 旧 OAuth 登录入口 `/api/login` 本就返回 410（已停用）；生效的是会馆账户 SSO，`/api/sso-user` 在两棵树结果一致。**未用真实 SSO 账号做端到端登录**（需真实凭据） |
| 线上 8080 / 5174 | 5174 `/api/user` 200；8080 对无 Host 的请求 404（正常，按 Host 分发）；未改动线上 |

## R1–R9 最终状态

| # | 风险 | 状态 |
| --- | --- | --- |
| R1 | Cards 会话竞态 | **已修复并验证**（commit 63772b6）。附：`state_map` 从未被写入，旧 OAuth 登录已停用，state 修复为防御性加固 |
| R2 | WAL 备份/恢复 | **已验证；文档化**。线上 huiguan `users.db` 已是 WAL。现有 `backup()` 脚本安全；规则：禁止只拷 `.db`，恢复前删旧 `-wal/-shm`。恢复手册待写（deferred，非阻塞代码发布） |
| R3 | `synchronous=NORMAL` | **不在本次发布**（`server_huiguan.py` 未提交）。LOW，deferred |
| R4 | immutable 缓存 | **已修复并验证**。技术债：全小写哈希失去 immutable、驼峰可变文件名仍可能误判 |
| R5 | 60s 超时 vs WebSocket | **无问题**（中继自带 90s 空闲上限；Spirit 服务端 15s ping）。多线程 `_Server` 不在本次发布 |
| R6 | Cards 源码树导入 | **已修复并验证**（commit 内）。生效需重启 Cards |
| R7 | 脏树构建 | **本候选已解决**（clean commit 构建，`sourceDirty=false`）。但生产现盘仍含脏树热拷贝（见阻塞项 1） |
| R8 | 并行发布/并行会话 | **未解决，HIGH**：主线仍有多人未提交改动，生产被热拷贝；发布前必须冻结并行写入 |
| R9 | 生效需重启 | **已明确**：见下 |

## 剩余技术债（deferred）

R2 恢复手册；R3；R4 局限；Cards 无过期会话清理；多线程 `_Server`、server_huiguan WAL/锁外哈希、`.ttf` TTL、`close_connection`（并行会话未提交，需各自评审后发布）；`state_map` 死代码；Cards 其余模块仍从项目根读 `.env.local`（数据，非代码，可接受）。

## 回滚目标

- 备份：`ops/backups/release-1.8.3-rollback-20261018/`（`production.json` + 当前线上整棵 `production_site`，**含**上述未入库的热修文件，117MB）。
- 版本回滚：`779231c`（manifest）；若需连同热修回滚，用上面备份目录整棵恢复。
- 回滚流程已在隔离环境实测：把旧树作为候选走发布器，服务运行中即可切换，重启后行为与切换前一致。

## 真正发布时的重启与影响

- 文件切换本身**不需要停服务**（cwd 修复后）。
- `server/app/src/cards/server.py`、`server/base_static.py` 是 Python 代码，**需重启 Cards(5174) 和 Portal(8080)** 才生效（`base_static` 被两者导入）。
- 影响：约 10–20 秒中断；Cards 内存登录会话清空，zszm 用户需重新登录；Portal 的抓取观察窗口清零。cloudflared、juling、softie、数值配置不受影响。
- **重启后不会读取 dirty 源码树**：Cards 现在从自身所在的发布树导入代码（已用"项目根无 server/*.py"实测）；Portal 本来就用发布树（`CODE_ROOT`）。数据（DB、上传、`.env.local`）仍在项目根。
- 重启必须用新管家 `launch()`（cwd 在 `.releases\runtime`），否则下次发布再 EPERM。

## 证据位置

`file:///E:/External%20Projects/Iridescently%20Operations%20Archive/releases/stage1.8.3-candidate/verify.py`+`result.json`；`file:///E:/External%20Projects/Iridescently%20Operations%20Archive/releases/stage1.8.3-r2`（WAL、R5、R1 压测）；worktree `E:\Projects-worktrees\stage183`。

---

## 更新 2026-10-18 02:0x — 基于热修提交重做候选（取代上文"Commit 与候选"、差异与阻塞项 1）

来源已确认：三份生产热修文件由会话 [服务器注册高峰优化](#local_c89291a6-fed0-4821-9871-d315ffa829cd) 提交为 master `980a021`（4 个文件：`base_static.py` 仅 `close_connection` 一处、`portal_server.py`、`scraping_observer.py`、`test_connection_reset_loop.py`）。已核对：这三个文件在 `980a021` 中与生产磁盘内容**逐字节一致**（忽略 CRLF）。该会话确认之后不再改这些文件。

- 发布分支 `release/stage1.8.3`：`779231c` → `63772b6`（R1/R4/R6）→ **`88ab4e1`**（cherry-pick `980a021`，无冲突）。**最终 commit：`88ab4e13161d5dc462e396902e405e88de8a1af5`**。
- 候选：`E:\Projects-worktrees\stage183\.releases\candidate\site`，`sourceHead=88ab4e1`，`sourceDirty=false`，1,091 文件，干净 commit 构建；`gate-scene.js` 重建后与生产一致。未写入主 `.releases/candidate`。
- production（磁盘，含热修）→ candidate 的**实质内容差异**（忽略行尾）只有：
  | 文件 | 解释 |
  | --- | --- |
  | `server/app/src/cards/server.py` | R6 + R1 |
  | `server/base_static.py` | R4（immutable + 修正后的正则）；`close_connection` 已与生产相同 |
  | `server/test_stage183_release.py`（新增） | 本轮测试 |
  | `server/test_connection_reset_loop.py`（新增） | 热修的回归测试 |
  `portal_server.py`、`scraping_observer.py` 与生产磁盘内容相同（仅行尾 CRLF/LF 导致清单哈希不同）。**热修不会被回退。** 相对 `production.json` 清单为 4 个修改 + 2 个新增，全部可解释。
- 回滚备份已刷新：`ops/backups/release-1.8.3-rollback-20261018b/`（含当前生产磁盘上的热修版本，三份已 `cmp` 确认）。旧的 `…20261018/` 备份保留但含更早一版 `portal_server.py`，回滚以 `…b` 为准。

### 重新验证（新候选）
| 项 | 结果 |
| --- | --- |
| 仓内测试：`test_stage183_release`（4 项）、`test_connection_reset_loop`（8 项，全部 OK）、`test_static_security`、py_compile | 全部 PASS |
| 隔离环境：当前生产磁盘树 → 新候选，服务运行中切换 | 发布器 exit 0，0 文件系统错误，服务存活 |
| 重启后（项目根**无任何** `server/*.py`） | Cards 与 Portal 正常；旧树 vs 新树 11 个请求差分烟测完全一致 |
| cwd 扫描 | 两服务 cwd 在 `.releases\runtime\*`，production 下 0 个 |
| 数据边界 | `users.db` 在项目根；production 树内无 `.db` |
| 回滚（把含热修的旧树作为候选发布）→ 重启 | 恢复成功，烟测与切换前一致 |
| Spirit WebSocket（候选 `_Server` 空闲超时 30s） | 静默 75s 存活；上游 20s ping、130s 存活（6 个 ping） |
| WAL 备份/恢复 | 沿用前述结论（候选无 DB 代码改动） |

### Release Decision（更新）：**READY WITH LIMITS（候选）/ 发布前仍需处理 1 个阻塞项**
- 已解决：生产热修来源（已提交为 980a021）、热修被回退的风险、dirty 源码树读取风险。
- **仍阻塞：线上 cwd 回退（HIGH）。** 当前线上 Portal(53104)、Cards(17808) 的 cwd 仍在 `.releases\production\site` 内（又被旧方式重启）。此时真实发布会因 cwd 锁 EPERM 失败。发布前必须用新管家 `launch()`（cwd=`.releases\runtime\*`）重启这两个服务，并复查 cwd 扫描。因本次发布本来就要重启二者，可合并为同一个受控步骤。
- 限制：分支 `release/stage1.8.3` 基于 `779231c`，主线 `master` 已前进到 `65088a2`（含 slay/modules 等无关提交，且 modules/homepage 组件已被发布到 `b4c7531`）；本次只发布 `site` 组件，内容与主线其余提交相互独立。合并/变基分支可在发布后进行。
- 行为变化提示：`scraping_observer` 日志现为每进程一个文件 `scraping-<进程名>.log`，Stage 1.8 流量分析需读新文件；空闲连接 30s 超时（`IRIDESCENTLY_IDLE_TIMEOUT`）。

### 发布时重启与影响（更新）
文件切换不需停服务；`cards/server.py`、`base_static.py` 等 Python 改动需重启 Cards(5174) 与 Portal(8080)，一次性约 10–20 秒中断，Cards 内存登录会话清空；必须用新管家 `launch()` 重启以固定 cwd。回滚目标：`779231c` + 热修，即上述 `…20261018b` 备份。

---

## Stage 1.8.4 执行记录（2026-10-18 02:1x，已发布）

- **基线变化**：在执行前，另一会话于 18:08Z 把 `site` 发布到 `a0583b2`（已含 `980a021` 热修，且 master 已包含修正后的 `HASHED_ASSET` 与 `f57cd40` 的模块缓存策略）。我按此重做候选：分支 `release/stage1.8.4` = `a0583b2` + cherry-pick `63772b6`（`base_static.py` 冲突取 master 版本，R4 已在其中）→ **`e0f5420`**，只剩 `cards/server.py`（R1+R6）与 `test_stage183_release.py`。
- 候选 `e0f5420`（`sourceDirty=false`，1,093 文件）对 production 清单：`MODIFIED cards/server.py`、`ADDED test_stage183_release.py`，无其他差异。隔离验证（服务运行中切换、重启、无源码树、差分烟测、回滚）全部通过。
- 备份：`ops/backups/release-1.8.4-pre-20261018/`（`production.json`、整棵 `production_site`、三个 SQLite 的 `backup()` 副本，integrity ok）。
- 执行：① Cards 重启（1.9 秒）→ ② Portal 重启（2.5 秒），均经管家 `launch()`，cwd=`.releases\runtime\*`；③ **服务运行中发布** `site`：发布器 exit 0，**0 个文件系统错误，首次 rename 即成功**；④ 再次重启 Cards（2.6 秒）与 Portal（2.7 秒）加载新代码。
- 结果：`production.json` site=`e0f5420`，磁盘与清单 drift=0；cwd 扫描 production 下 0 进程；9 个域名响应与基线一致（`www` 301 无 HSTS 为既有项）；`/api/sso-user` 200、`/api/login` 410；Spirit WebSocket 握手 101；观察器日志持续写入 `scraping-portal_server.log`；重启后 Portal 日志无新 Traceback。
- 副作用：Cards 登录会话清空（预期）；`assets/thumbs` 缓存目录随切换被重建（启动时 `makedirs`，缩略图按需再生成）；两次重启各约 2–3 秒中断（远低于估计）。
- 回滚目标：`ops/backups/release-1.8.4-pre-20261018/`（含 `a0583b2` 时的生产树）；回滚流程已在隔离环境实测。
- 遗留：`release/stage1.8.3`、`release/stage1.8.4` 分支未合入 master（`e0f5420` 的改动尚未在 master 上）；`cards/server.py` 的多线程 `_Server` 与 `server_huiguan.py` 的 WAL/锁外哈希仍是主工作树未提交改动，**未发布**；WAL 恢复手册、真实 SSO 端到端登录仍待办。
