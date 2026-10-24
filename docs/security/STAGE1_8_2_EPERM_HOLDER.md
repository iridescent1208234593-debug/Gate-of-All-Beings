# Stage 1.8.2 — EPERM 句柄/占用者定位

日期：2026-10-17。只读取证；未发布、未停止/重启任何服务、未改 ops/ 源码。

## 结论

**根因已确认（当前进程已满足"足以导致"，且可稳定复现）：进程工作目录（cwd）位于待 rename 的 `.releases/production/site` 树内。** 不是文件句柄，也不是杀毒软件。

## 实际占用者（2026-10-17 22:5x 实测，PEB 读取 cwd）

| PID | 进程 | cwd | 端口 |
| --- | --- | --- | --- |
| 9756 | `python.exe -u portal_server.py` | `E:\Projects\.releases\production\site\server\` | 127.0.0.1:8080 |
| 49492 | `python.exe -u server.py`（Cards OAuth） | `E:\Projects\.releases\production\site\server\app\src\cards\` | 127.0.0.1:5174 |

其余约 80 个相关进程（Vite 4173/5178、juling、Codex/Claude 工具、cloudflared、ssh relay 等）cwd 均不在生产目录内。两个占用者的父进程均已退出（孤立进程）。

## 为什么之前"停 portal + 等待"仍失败

Cards OAuth（5174）是独立进程，cwd 在 site 树更深处，只停 portal 时它仍存活。2026-10-17 的 `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/releases/publish-simulation-20261017` 已证明：只停 portal 或只停 oauth 均 13×EPERM/-4048，两个都停才成功。

## 复现（本次独立验证，隔离目录）

| 场景 | rename 结果 |
| --- | --- |
| 无进程 | OK |
| 进程 cwd = `site/server` | **EPERM -4048** |
| 杀掉后 | OK |
| 进程 cwd = `site/server/app/cards`（深层） | **EPERM -4048** |
| 另一进程持有子目录文件/目录句柄（cwd 在外） | 也 EPERM -4048 |

注意：句柄本身同样会导致 EPERM，所以"生产上还有无文件句柄"未被排除——见下。

## 未证明

- 无 admin 权限、无 handle.exe，无法枚举 49492/9756 的打开文件（SQLite、日志）；仅 cwd 为实测确定。
- Defender/索引的瞬时占用未排除。

## 最小修复方案

发布前停止**所有** cwd 在 production/site 下的进程（portal + zszm-oauth），而不是只停 portal；或让服务以 cwd 在 site 树外的方式启动（`cwd=.releases`，用绝对路径启动脚本）。后者可永久消除问题。

## 修复后的证明方法

发布前运行 `work/cwd.ps1`（scratchpad 同款 PEB 扫描）确认：无任何进程 cwd 位于 `.releases\production\`；如有 admin，再用 `handle.exe -a E:\Projects\.releases\production` 确认无句柄。

## 状态更新

`production.json` 显示 `publishedAt=2026-10-17T11:50Z` —— 生产已被另一流程成功发布，生产 `server_huiguan.py` 中已有 `limit=max(1,min(limit,60))`（Stage 1.7 分页修复已上线）。**因此"发布受阻"已不是当前阻塞。** 但服务在 22:16/22:19 重新启动且 cwd 又落在 production/site 内，下一次发布会再次踩同一问题。

本阶段未发布；下一次发布前须先按上述方式处理这两个进程。

---

## 补充 A：真实生产基线（2026-10-17 23:xx 实测，只读）

- 生产由 `production.json`（publishedAt 2026-10-17T11:50:11Z）描述：modules 21b9a89（10-14 构建）、cards/homepage 4cc19c5、site 2739c59（10-17 11:49Z）；四个组件均为 `sourceDirty=true`，即从有未提交改动的工作树构建。
- **Stage 1.7（分页上限、公开字段清理）：在线。** 生产 `portal/huiguan/server_huiguan.py` 与工作树逐字节一致（含 `limit=max(1,min(limit,60))`）。注意该文件与 `server/base_static.py` 在 git 中仍是未提交修改。
- **Stage 1.8（观察器）：在线且在产生真实数据。** `server/scraping_observer.py` 在生产树内，`base_static.py` 已调用 `observe()`；`ops/网站恢复/logs/scraping.log*` 共约 4.4 万行，样本含 `trusted_edge=1` 与 `cf_ray`（经 Cloudflare 的真实客户端）。仍为 `OBSERVE_ONLY`，未限速。此前"无真实样本"的结论已过时，可据此设定阈值（尚未分析）。
- **Stage 1.8 robots 清理：** `portal/www|huiguan|oc/robots.txt` 与工作树仅行尾差异，视为在线（线上 HTTP 响应未复核）。
- **Stage 1.8.1（发布器诊断）：** 发布器 `[release-fs]` 日志在今日模拟与发布中均出现，视为在线；该文件本身在 git 中的状态未核对。
- `scraping_observer.py` 的日志目录默认回退到 `<root>/ops/网站恢复/logs`；当前因启动时设置了 `IRIDESCENTLY_PROJECT_ROOT=E:\Projects`，日志在生产树之外，不会被 rename 影响。

## 补充 B：cwd 架构修复

修改的启动入口：
1. `ops/网站恢复/website-manager.py` `launch()`：portal、zszm-oauth 的 cwd 改为 `E:\Projects\.releases\runtime\<key>`，入口脚本改为 `production/site/...` 下绝对路径；新增常量 `RUNTIME_CWD`；日志头记录 cwd。
2. `portal/huiguan/watchdog.py`：cwd 改为 `.releases/runtime/portal`，脚本用绝对路径。

审计结论：portal_server.py、各 portal 子服务、cards server.py 均按 `__file__` 或 `IRIDESCENTLY_PROJECT_ROOT` 解析路径（SQLite `users.db` 在 `ROOT/server/app/src/cards/`，日志在 `ops/网站恢复/logs`），无 cwd 依赖。服务端口、URL、数据格式未改。

### 隔离验证（`file:///E:/External%20Projects/Iridescently%20Operations%20Archive/releases/stage1.8.2-cwd-fix/drive.py`，结果 `result.json`，端口 18080/15174）
真实 production 树拷贝 + 真实发布器 + 真实 `launch()`：
- 两服务运行中，cwd 均为 `.releases\runtime\*`，扫描无 cwd 位于 production 下。
- **服务保持运行时发布器 rename 成功**（exit 0，0 个文件系统错误，VERSION old→new），两服务仍存活并响应（Cards 200，Portal 对该 Host 返回 404/redirect，与切换前一致）。
- 杀进程并经 `launch()` 重启后 cwd 仍在树外；第二次切换（new→new2）同样成功、服务仍存活。
- 局限：隔离环境下 Portal 静态文件响应因 Host/https 策略返回 301/403，未能直接证明"切换后读到新文件"；Cards 的 SQLite 已创建（users.db）。未出现需要单独处理的文件句柄问题。

### 结论
- 发布前**不再需要停服务**（对已按新方式启动的进程而言）。
- **当前线上运行的 PID 9756 / 49492 仍是旧 cwd**，在它们被重启（用新管家 launch）之前，真实发布仍会 EPERM。重启会造成短暂中断，需你批准。
- 满足 Stage 1.8.3 受控发布的条件：待你批准一次受控重启（或发布窗口），之后用 cwd 扫描确认再发布。本阶段未发布、未重启线上服务。
- 另：`cards/server.py` 从 `IRIDESCENTLY_PROJECT_ROOT/server` 导入 `base_static` 等（源码树，不是发布快照），与 Portal 用发布快照不一致，留作后续观察。
