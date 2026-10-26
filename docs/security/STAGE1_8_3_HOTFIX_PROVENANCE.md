# Stage 1.8.3 — 生产热修文件来源审计

日期：2026-10-18 01:2x（本地）。只读审计，未改任何文件、未回退、未覆盖。

## 结论

生产 `production/site/server/` 下现有 **3 个**与 `production.json` 清单不符的文件（审计开始时是 2 个，01:21 又新增 1 个）。三者均可归属到同一个**仍在运行**的会话 [服务器注册高峰优化](#local_c89291a6-fed0-4821-9871-d315ffa829cd)（"注册高峰/CPU 空转"优化）。它们不是随机脏改动，而是该会话有意热部署的修复；但**尚未提交到任何 commit、分支、worktree 或 stash**，且该会话仍在持续修改，内容在审计期间已变化。

## 逐文件

| 文件 | 生产 mtime（本地） | 与主工作树 | 在任何 commit/分支/stash？ |
| --- | --- | --- | --- |
| `server/base_static.py` | 2026-10-18 01:21:45 | 不同（主树还含 R4 的 immutable 改动） | 否（仅主树未提交） |
| `server/portal_server.py` | 2026-10-18 01:22:02（此前 00:59 一版，内容已变） | **相同** | 否（仅主树未提交） |
| `server/scraping_observer.py` | 2026-10-17 23:49:06 | **相同** | 否（仅主树未提交） |

检查范围：全部 14 个本地分支、`git worktree list`（仅主树 + 本轮 `stage183`）、`stash@{0}`（`r5-carry`，内容为 six-system 文档，无关）。`git log` 中这三个文件最近的提交（`0d924fa`、`b567749`）都早于这些改动。

## 精确 diff（基线 = 生产清单版本 779231c；已忽略 CRLF）

### `server/base_static.py` — 1 处
```
-            pass
+            self.close_connection = True      # in handle_one_request: except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)
```
功能：**CPU 空转的根因修复**。对端 reset 后旧代码吞掉异常但不关闭长连接，`handle()` 立刻再次 `handle_one_request`，在 Windows 上每次 `recv` 立即再抛，形成紧循环（约 5 万次 socket 调用/秒，每个被 reset 的对端占一个线程）。对应回归测试 `server/test_connection_reset_loop.py`（未跟踪，01:21:21 创建）。

**注意：这正是我在 commit `63772b6` 里排除的那一处**。生产现已带这个修复；若按 63772b6 候选发布，会把它回退，空转问题会复发。

### `server/portal_server.py` — 3 处
1. `import threading`、`import time`。
2. `Dispatcher` 请求循环后的 **spin-guard**：同一连接 1 秒内循环 >100 次则打印 `[spin-guard]` 并置 `close_connection=True`（注释写明：根因已在 base_static 修复，这是兜底）。
3. `__main__`：`ThreadingHTTPServer` → 自定义 `_Server`：`daemon_threads=True`、`request_queue_size=1024`、`get_request` 里按 `IRIDESCENTLY_IDLE_TIMEOUT`（默认 **30**）设置空闲超时。

功能：注册高峰（突发连接）时防止监听队列溢出、空闲 keep-alive 连接占满线程（cloudflared 持有大量空闲连接）、以及空转兜底。

### `server/scraping_observer.py` — 2 处
1. 新增 `_SafeRotatingHandler`：日志滚动失败（Windows 下另一进程占用文件）时静默跳过，并推迟下次滚动，避免每个请求都重试失败的 rollover 并打印 traceback；`handleError` 吞掉。
2. 日志文件改为**每进程一个**：`scraping-<argv0 stem>.log`（如 `scraping-portal_server.log`）。

功能：观察器不得拖累响应路径。线上日志目录已出现 `scraping-portal_server.log`，且旧的共享 `scraping.log` 不再更新——**这会改变 Stage 1.8 的日志位置**，后续流量分析需读新文件名（多进程各一个）。

## 与其他会话的对应关系

- 会话 **服务器注册高峰优化**（`local_c89291a6…`，运行中）：其转录里包含 `[spin-guard] closing … after 301 loops/s`、`IRIDESCENTLY_IDLE_TIMEOUT … "15" deployed`（现盘上是 30，说明之后又改过）、`doRollover` traceback（对应 `_SafeRotatingHandler` 的成因）。三份文件都能对应到它。`scraping-%s.log` 字面量搜索无命中，属于转录检索限制，不影响归属判断（日志文件名、时间线和同一问题域一致）。
- 同会话还负责主树里另外几处**未提交**改动：`server/app/src/cards/server.py` 的多线程 `_Server`、`portal/huiguan/server_huiguan.py` 的 WAL/锁外哈希。这些在本轮候选中均**未**包含。
- 其他会话（会馆头像 `local_58f8a265`、重生之门卡牌 `local_2eea8f22` 等）的改动对应 `779231c` 及主线提交，与这三个文件无关。
- 我自己（安全收口会话）没有修改这三个生产文件；本会话写入的是 `cards/server.py`、`base_static.py`（R4 正则）、watchdog、管家等，且均不在生产磁盘上。

## 建议（不执行，等你定）

1. **这三份是应保留的修复，不应被发布回退。** 尤其 `base_static` 的 `close_connection` 是 CPU 空转的根因修复。
2. 但内容仍在变（portal_server 一小时内改了 3 版，超时 15→30、guard 重写），**现在冻结会冻到半成品**。应让 `服务器注册高峰优化` 会话先收口并**自己提交**它的文件集（含 `test_connection_reset_loop.py`），再由我基于该提交重做候选：`779231c` + 它的提交 + `63772b6`（R1/R4/R6）。
3. 重做候选时 `base_static.py` 的合并只需叠加：它的 `close_connection` 一行 + 我的 R4 三处，二者不冲突。
4. `scraping_observer` 的日志改名需要在 Stage 1.8 的流量分析与文档中同步。
5. 在这之前保持 NOT READY；不回退、不覆盖。

## 其他已知阻塞（不变）

线上 Portal/Cards 当前 cwd 又落在 `production\site` 内；`release/stage1.8.3` 与主线未合并。
