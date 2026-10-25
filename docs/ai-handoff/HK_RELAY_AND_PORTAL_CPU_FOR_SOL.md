# 交接：香港中继绕开代理节点 + 门户 CPU 突增排查（给 sol6.1）

> 2026-10-19 已新增独立[服务器管家](file:///E:/External%20Projects/Iridescently%20Operations/服务器管家/README.md)：正式域名仍为香港稳定版，pc-* 域名提供本机新版页面 / 客户端，API 和玩家数据统一由香港提供；代码和参考资产库使用不同的发布 / 回滚通道。新本机入口不使用本文历史的 SSH 反向中继，也不向香港同步旧 Windows DB。

> 2026-10-18 18:30 后架构已更新：九个正式域名与全部后端、账户、存档和媒体已迁移到香港，nginx 上游为香港 `127.0.0.1:18180`，本机五个网站服务已停止。以下中继架构和 DNS 回退办法属于历史记录，不应恢复到冻结的本机数据库。最新部署、发布与回滚方式见 [DEPLOYMENT.md](file:///E:/External%20Projects/Iridescently%20Operations/hk-bandwidth/DEPLOYMENT.md)，管理入口为 Windows 网站管家的「发布到香港 / 回滚版本」。

时间基准：历史观测为 2026-10-18 00:10 左右。目标：`https://zszm.iridescently.xyz` 稳定、低延迟。

## 2026-10-21 SSH 诊断更新

香港正式 SSH 端口已更新为 `43012`。经 Mihomo/TUN 时 TCP 曾建立但没有 SSH banner；经物理以太网时 `OpenSSH_9.6p1` banner、host key 严格校验、deploy 公钥认证和只读 `status` 均通过。服务器端正常。旧的 `rxITxsewevGf` 规则组件不是当前激活 profile 使用的规则组件；当前运行配置需使用 active profile 的规则组件，并在 Mihomo runtime 中验证 `154.222.26.70/32 → DIRECT`。
你只做「任务」一节。其余一律不动。

## 当前架构（GPT 已部署，Claude 已验收）

```
zszm.iridescently.xyz -> Cloudflare -> 香港独立隧道 -> ecsvkdu0 (154.222.26.70) nginx
  -> 静态资源：香港磁盘缓存
  -> HTML / API / 缓存未命中：HK 回环 127.0.0.1:18080
  -> SSH 反向通道（计划任务 Iridescently-HK-Origin，ssh.exe，免密钥） -> Windows 门户 127.0.0.1:8080
```

细节见 [`DEPLOYMENT.md`](file:///E:/External%20Projects/Iridescently%20Operations/hk-bandwidth/DEPLOYMENT.md)。历史回滚命令：`python "E:\External Projects\Iridescently Operations\hk-bandwidth\cf_control.py" rollback`。
历史验收命令：`python "E:\External Projects\Iridescently Operations\hk-bandwidth\verify.py" --targets https://zszm.iridescently.xyz --require-hk`；当时 28 项无失败。

## Claude 今晚已改的东西（不要回滚）

均已同步到 `E:\Projects\.releases\production\site`，门户（8080）和 OAuth 代理（5174）已重启。

| 文件 | 改动 |
| --- | --- |
| `server/app/src/cards/server.py` | 单线程 `HTTPServer` 改为 `ThreadingHTTPServer`，队列 512，空闲连接 60 秒超时 |
| `server/portal_server.py` | 监听队列 1024，空闲连接超时（环境变量 `IRIDESCENTLY_IDLE_TIMEOUT`，默认 60，0 为关闭） |
| `portal/huiguan/server_huiguan.py` | 注册时 scrypt 哈希移出 `DB_LOCK`；`users.db` 开 WAL，`timeout=30`；补上缺失的 `valid_asset_url` 导入 |
| `server/base_static.py` | 带内容哈希的 `/assets/*` 设为 `max-age=31536000, immutable`；补 `.ttf/.otf` 缓存 |
| `server/scraping_observer.py` | 日志按进程分文件（`scraping-<进程名>.log`），轮转失败时静默跳过。原来两个进程抢同一个 `scraping.log`，轮转报 `PermissionError`，每个请求都打印整段堆栈，白烧 CPU |

另外：
- 线上快照与发布清单的哈希已不一致，下次正规发布会消除。
- 旧的 `E:\External Projects\Iridescently Operations\网站恢复/logs/scraping.log*` 保留未删。
- 备份在 Claude 的 scratchpad，不需要你处理。

## 已确认的事实

- 本机 Clash Verge 开着 TUN（`Meta` 网卡，`gvisor`，fake-ip）。节点选择当前是「新加坡SG11-HY2」。
- 运行时规则里 `cloudflared.exe`、`argotunnel.com`、`cloudflare.com` 已经 `DIRECT`，主隧道连接已确认直连。
- **历史观测时香港中继 `ssh.exe -> 154.222.26.70:22` 命中 `Match`，链路是「新加坡SG11-HY2 > 节点选择」；该端口已被 43012 取代。**
  也就是 Windows 到香港这一段绕了新加坡代理节点。到香港的 ping 平均 67 ms。
- 公网 API 延迟约 1 到 2 秒，本机 8080 直连只要几毫秒。差的那一秒多在公网路径上。
- 门户（8080）有间歇性 CPU 突增，约 2 核，持续几十秒，之后回落到接近 0。
  突增时本机响应仍是几毫秒，没有直接拖慢请求。
  Claude 的发现：突增时进程每秒约 11 万次 socket 系统调用；大量线程在等 GIL。没有找到触发源。
- 日志里有重复的 `GET /assets/cards/*.svg` 404（`wood/sword/spirit/...`）和 `POST /app/shell/api/action` 返回 501。
  那些图标原在已删除的 `shared/shared-ui/AI image/cards/`，备份在 `E:\External Projects\Iridescently Operations\backups/release-deploy-20261017-140239/production_site/shared/shared-ui/AI image/cards/`。
- Claude 没有管理员权限，无法加主机路由，也无法让 Clash 重新应用配置。

## 任务

### 任务 1：让香港中继直连（最重要）

Claude 已经把规则写进了持久配置，但 Clash Verge 还没重新应用，运行时还没有这两条：

文件：`%APPDATA%\io.github.clash-verge-rev.clash-verge-rev\profiles\rxITxsewevGf.yaml`（`prepend` 里已加）

```
- 'PROCESS-NAME,ssh.exe,DIRECT'
- 'IP-CIDR,154.222.26.70/32,DIRECT,no-resolve'
```

备份：同目录 `rxITxsewevGf.yaml.bak_20261018_000505`；上级目录 `clash-verge.yaml.bak_20261018_000505`。

步骤：
1. 让用户在 Clash Verge 里重新应用当前订阅（刷新或重新选择该配置）。如果你有办法让 Clash Verge 自己重新生成运行时配置，也可以用，但不要手改 `ProgramData` 下的运行时文件（路径受保护）。
2. 通过 mihomo 管道查询连接，确认 `154.222.26.70:43012` 命中 `IP-CIDR,154.222.26.70/32,DIRECT,no-resolve`，链路为 `DIRECT`。
   - 管道名：`\\.\pipe\verge-mihomo-production-1d0738970a87ca890680ef0135e03eb7100734193d838daa64379ba334c62684`
   - 在 PowerShell 里用 `System.IO.Pipes.NamedPipeClientStream` 发 HTTP 请求，`GET /connections`。
   - 注意 `clash-verge.yaml` 里写的 `sidecar-release` 管道是旧的，实际是 `production`。
3. 现有 ssh 连接要重连才会走新规则：结束 `ssh.exe`，计划任务里的脚本 5 秒后会自动重启它（`start-origin-relay.ps1` 里有重试循环）。这期间 zszm 会有几秒 502，动手前先告诉用户。
4. 复测：
   - `ping 154.222.26.70`，对比 67 ms。
   - `curl --noproxy '*' -w "%{time_total}" https://zszm.iridescently.xyz/api/sso-user` 连测 5 次。
   - 跑 `verify.py`。

如果规则应用失败或用户的代理出问题：还原上面的 `.bak_*` 并让 Clash Verge 重新应用。

### 任务 2：找出门户 CPU 突增的触发源（可选，不要影响线上）

已有工具：`pip install --target <临时目录> py-spy` 已装在 Claude 的 scratchpad（路径 `C:\Users\hp\AppData\Local\Temp\claude\E--Projects-worktrees\61bbf54a-22b4-48a8-9ed6-c48efc9b081e\scratchpad\pyspy\bin\py-spy.exe`），只读，不改进程。

建议方向：
- 突增发作时，用 `py-spy dump --locals --pid <8080 的 PID>` 抓热线程的 `client_address`，同时记录对应时刻的 `/connections` 或 cloudflared、ssh 的连接情况。
- 对比突增时段与 `portal.log` 里的请求，重点看 `POST /app/shell/api/action`（501）和 `/ecology/index.html`。
- 区分「GIL 争用的线程风暴」和「某个长连接在小块收发」。进程 IO 计数器（`Win32_PerfRawData_PerfProc_Process`）可用来量化。
- 可疑项：HTTP/1.0 的 `www.Handler` 每请求一条新连接、一个新线程。

### 任务 3：修两个功能性问题（先问用户再改）

- `POST /app/shell/api/action` 返回 501：路径落到了静态处理器。确认这个接口应当由哪个上游处理，在 `server/portal_server.py` 的 `route()` 里补路由。
- `/assets/cards/*.svg` 404：确认哪个页面还在引用，决定是恢复文件还是改引用。恢复文件之前先确认这些素材是否属于用户的「复审删除」范围。

## 不要做的事

- 不要重启 cloudflared 主隧道或香港隧道。
- 不要改 `~/.cloudflared/config.yml`。
- 不要往 `.releases/production` 写入，不要 commit、push、publish。
- 不要杀用户的其他进程，不要限速其他程序。
- 不要把任何密钥、密码、cookie 写进文件或回报。
- 用户曾在聊天里贴出香港服务器 root 密码，**不要使用它**。需要登录时用已装好的受限密钥通道，或让用户自己操作。

## 回报

做完后在 `E:\Projects\docs\ai-handoff\LOCAL_AGENT_REPORT.md` 追加一节，写明：

- 任务 1 的结果：`ssh.exe` 的链路、ping、5 次 curl 延迟、`verify.py` 结果。
- 任务 2 如果有结论：触发源、证据。
- 改了哪些文件，备份名，回滚方法。
