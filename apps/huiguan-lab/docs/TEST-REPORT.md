# 测试报告（2026-11-06）

这里每一项结果都来自实际运行。证据目录指 `E:\Iridescently\labs\zszm-lab-v2-runtime\evidence\`（不入 Git）。

## A. 入口与安全

| 检查 | 结果 | 依据 |
|---|---|---|
| 公开域名可以访问 | PASS（不稳定） | 负责人建好 Tunnel 后，本机经外网访问首页、登录、游戏包和 WSS 都成功过（证据 `e2e-public-3`）。2026-11-07 00:15 前后，本机到 `*.iridescently.cn` 的 Cloudflare 代理入口出现 TLS 握手失败和超时，`pc-huiguan.iridescently.cn` 也一样，而同一时刻 `www.cloudflare.com` 和 `.cn` 的 CDN 入口都正常。判断是本机代理（Mihomo）到 Cloudflare 代理 `.cn` 主机这一段的线路问题，不是 LAB 本身的问题，见 KNOWN-LIMITATIONS |
| 没有测试码无法进入游戏或取得游戏资源 | PASS | pytest `test_entry_requires_code`；浏览器测试 A1 中，访问 `/play/index.pck` 被重定向回测试码页 |
| 无效测试码被拒绝 | PASS | pytest，浏览器测试 A2 |
| 有效测试码可以登录 | PASS | 浏览器测试 A3（两个独立浏览器上下文） |
| 7 天会话：Cookie Max-Age 为 7 天，过期会话被拒绝，HTTP 和 WS 都检查 | PASS | `test_valid_code_session_seven_days`、`test_expired_session_rejected` |
| 只保存摘要，数据库和安全事件里没有明文测试码与会话令牌 | PASS | `test_valid_code_session_seven_days` 直接检查 SQLite 内容 |
| 失败限流与锁定（5 次后 429 并返回 Retry-After） | PASS | `test_invalid_code_rejected_and_lockout` |
| 撤销测试码后会话失效、WebSocket 被立即断开、不能再登录 | PASS | `test_revoked_code_closes_session_and_socket` |
| 普通玩家进不了管理后台；管理台限本机、需要 CSRF 头、拒绝经过 Tunnel 的请求；监控页只对 monitor 角色开放 | PASS | `test_player_cannot_reach_admin` |
| 不能绕过认证直连 WebSocket：无会话、外站 Origin、经过 Tunnel 却没有 Origin、错误 Host 都被拒绝 | PASS | `test_ws_requires_session_origin_and_host` |

## B. 真实联机（两个独立的 Chromium 上下文，加载真实的 Godot Web 包，本机 http://127.0.0.1:18300）

证据：`e2e-local-6\e2e-result.json` 及截图。

| 检查 | 结果 |
|---|---|
| 两个独立会话进入同一个世界（不同 pid，都在 hall） | PASS |
| 玩家 A 移动后 B 能看到（B 看到的 A 位于 13.96, 15.48） | PASS |
| 玩家 B 移动后 A 能看到（A 看到的 B 位于 17.01, 15.56） | PASS |
| 聊天能送达 | PASS |
| 断线后能重连：每一步都重新加载页面，玩家回到原空间，对方列表里只有一个 A，没有幽灵 | PASS |
| 同一测试码重复连接时旧连接被替换 | PASS（pytest `test_reconnect_replaces_old_socket_without_ghost`） |
| 服务端拒绝作弊移动（瞬移会收到 `correct`） | PASS（pytest） |
| 至少一次通过外部网络验证 | PASS（部分）：`e2e-public-3` 经 `https://pc-lab.iridescently.cn`，A1–A3、C0、B1–B4、C1 全部 PASS（登录、真实上传、两人互看移动、聊天、互看 OC）。之后切换 3D 视图要重新加载页面，这一步在 300 秒内没完成，原因是隧道下行太慢，加上旧的缓存策略让每次重载都要重新下载约 10 MB；缓存策略已改为 ETag 加 304 重新验证。3D、私人空间和重连这几项在外网上 NOT TESTED（本机已 PASS）。外网 RTT 为 1.1–1.3 s（客户端和 Tunnel 都要经过本机代理，属于最坏情况） |

## C. OC

| 检查 | 结果 | 依据 |
|---|---|---|
| 透明 PNG 通过真实的浏览器文件选择器上传并显示 | PASS | 浏览器测试 C0、C1 |
| 捏人编辑器生成形象并显示 | PASS | 浏览器测试中 B 用编辑器生成，A 能看到 |
| 两个玩家能看到彼此的形象 | PASS | C1，两边 `has_oc_texture=true` |
| 伪造文件（脚本改名成 PNG）、PNG 头加垃圾数据、超过 2048 的边长都被拒绝 | PASS | `test_oc_upload_and_visibility` |
| 刷新后本地存档恢复（IndexedDB） | PASS | 浏览器测试每一步都重载页面，之后不用重新设置，OC 自动重新同步 |
| 清除浏览器个人数据不影响公共世界 | PASS（设计加部分实测）。公共状态都在服务端 SQLite；`test_persistence_across_restart` 验证了服务端状态在重启后仍在。客户端的「清除」按钮这条路径没有用自动化执行过：NOT TESTED |

## D. 世界与私人空间

| 检查 | 结果 | 依据 |
|---|---|---|
| 进入公共世界 | PASS | 浏览器测试 B1 |
| 在虹之间开辟灵质空间（对应 R4 的 snapshot 与 fork） | PASS | 浏览器测试 D1；pytest（不连 R4 的情况） |
| 邀请其他玩家，受邀者能进入 | PASS | 浏览器测试 D2；pytest |
| 未授权玩家不能进入 | PASS | pytest，返回 `space_forbidden` |
| 撤销后受邀者被送回会馆 | PASS | pytest |
| 从私人空间返回会馆 | PASS | 浏览器测试 D3；pytest |
| 私人空间与公共空间隔离（聊天不外泄） | PASS | pytest |
| 网关重启后互动物件状态和玩家位置恢复 | PASS | `test_persistence_across_restart` |
| R4 世界接入：public 分支持续推进（羊 14、狼 3 起步），并在 Stop 与 Start 之后从 SQLite 继续 | PASS | 运行中的 R4 实例，管理台和客户端顶栏显示的世界时间连续 |

## E. 双画风

| 检查 | 结果 |
|---|---|
| 2D 与 3D 都能在浏览器里运行（Godot 4.7.2 Web、WebGL 2.0、Compatibility） | PASS（截图 `A-hall-2d.png`、`debug3d.png`） |
| 两种视图连接同一个权威服务；3D 中的 B 看到的 A 位置与 A 自己上报的一致（误差小于 0.5 m） | PASS（浏览器测试 E1） |
| Web 导出没有阻断性错误 | PASS（导出日志没有 ERROR；运行时控制台只有一个无关的 404 静态资源请求） |

## F. 运维与性能

| 检查 | 结果 |
|---|---|
| Start、Stop、Restart、Status 脚本 | PASS（今天实际启动和停止多次；Stop 时网关先保存玩家位置） |
| 单实例：重复 Start 不会多开 | PASS（`Running` 检查加监督进程文件锁；网关和 R4 各自持有数据库锁） |
| 进程崩溃能被发现并有限次数重启 | 逻辑已实现；没有人为杀进程做故障注入：NOT TESTED |
| R4 调度出错后自动恢复 | PASS（实际遇到过一次 worker 清理超时，网关的调度核对把它重新启用） |
| 不与香港生产串线 | PASS（独立数据库与令牌，Host 白名单，没有任何指向生产的地址；见 SECURITY.md） |
| 新 Tunnel 与旧预览 Tunnel 不冲突 | PASS：两个 Tunnel 的 ID 不同（`zszm-lab-v2` 是 6b0a9eca…，旧预览是 b79024ab…），ingress 主机名互不重叠，旧预览的配置没有改动 |
| DNS 清理后必要入口仍在 | NOT TESTED（还没清理） |
| 服务端集成测试 | PASS，12/12（`pytest server/tests`） |

### 模拟负载（证据 `load-3\loadtest.json`）

本机临时网关，没有接 R4。每个机器人走完整的登录、WebSocket 和 OC 流程，每秒移动 12 次，偶尔聊天。机器人和网关跑在同一台机器上，RTT 是本机回环的数值。

| 玩家 | 网关 CPU 平均 / 峰值（单核 %） | 网关内存 | Tick p50 / p99 | RTT p50 / p95 | 每人每秒快照 | 每人下行 | 总下行 | 纠正 / 丢连接 |
|---|---|---|---|---|---|---|---|---|
| 2 | 1.9 / 4.7 | 64 MB | 0.08 / 0.23 ms | 1.3 / 1.9 ms | 10.4 | 10.5 kbps | 0.02 Mbps | 0 / 0 |
| 10 | 7.1 / 10.9 | 66 MB | 0.15 / 0.30 ms | 2.6 / 5.0 ms | 10.5 | 38.9 kbps | 0.39 Mbps | 10 / 0 |
| 30 | 18.6 / 24.6 | 76 MB | 0.29 / 0.54 ms | 14.2 / 19.6 ms | 10.2 | 106 kbps | 3.2 Mbps | 0 / 0 |
| 50 | 35.2 / 57.8 | 98 MB | 0.43 / 0.82 ms | 26.4 / 43.5 ms | 10.1 | 170 kbps | 8.5 Mbps | 0 / 0 |
| 100 | 84.2 / 98.8 | 113 MB | 0.73 / 1.52 ms | 71.8 / 147.7 ms | 9.1 | 302 kbps | 30.2 Mbps | 0 / 0 |

结论：100 人同时在一个空间里持续走动时，网关能连住、不掉线，但已接近单核上限：CPU 约 84%，快照频率从 10 降到 9.1 次每秒，RTT p95 约 150 ms。更现实的瓶颈是带宽：所有人挤在同一空间时，需要约 30 Mbps 上行，经 Tunnel 后还会更多，家用宽带的上行很可能不够。10 人那一级的 10 次纠正发生在机器人开始走圈的第一步，即从出生点直接跳到圆周上。100 人只能算「实测可以连接，但性能已到边缘」，不能写成稳定达标。优化方向见 ROADMAP 第 9 条：兴趣范围裁剪、静止玩家降频、二进制或增量编码、把网关拆成多进程。真实玩家的分布（会馆加多个灵质空间）会明显低于这个最坏情况。

### 客户端帧率

在 headless Chromium 的 SwiftShader 软件渲染下，2D 为 9–14 FPS，3D 为 7–9 FPS（两个页面同时运行）。这只能证明 Web 包在没有显卡的情况下也能跑；真实显卡上的帧率：NOT TESTED。

## 旧工程复测

| 测试 | 结果 |
|---|---|
| 栖风原 Phase 1C.3 `VerifyPhase1C3.ps1`，第一次重跑（21:40） | FAIL：服务端 25/25 PASS，原生客户端第 12 项 `nearby_interaction_enabled` 报 ERROR |
| 同上，第二次重跑（22:55，机器负载较低） | FAIL：同一项 `nearby_interaction_enabled`。可以复现，不是偶发，是旧工程现有的回归问题（不影响 LAB V2）。演示服务已停止 |
| R4 长时基准（`r4/run.ps1`） | NOT TESTED |

## 2026-11-07 客户端与手机控制修复

源码及构建 `lab-client-2.0.1+20261107041301` 已准备。服务端 12/12、桌面 14/14、手机触控模拟 11/11 通过，包含一次远端 OC 回复丢失后的恢复。用户已批准切换，但自动审批持续返回 blocked by policy，当前公网仍为旧客户端。现有 LAB 已启动，首页与健康检查为 200。完整范围、兼容处理、证据、回滚和人工应用步骤见 `E:\Iridescently\labs\zszm-lab-v2-runtime\evidence\client-fixes-20261107\RESULT.md`。
