# 三服务器互联与只读运维（A 香港 / B 运维 / C 本机）

状态：**第一阶段（只读）代码与配置完成，未部署**。B 与香港的任何安装都要负责人逐项批准（见“部署步骤”）。
核对日期 2026-11-07；证据目录 `<工作区>/evidence/ops-frp-20261107/`。

## 1. 结论先行

| 项目 | 状态 |
| --- | --- |
| FRP 配置（FRPS / 两个 FRPC / B 上的 STCP Visitor）、PKI、渲染与安全检查 | 完成，`render.py check` 全部 PASS |
| 只读 Agent（A/B/C 通用）与 B 上的汇总 API、终端视图 | 完成，14 项测试 PASS；在 C 上对真实 LAB V2 实跑 PASS |
| 新服务器 B 的部署、55404→4000 映射 | **未验证**：没有 B 的登录权限；实测 55404 对 TLS 握手立即断开（0 字节） |
| 香港只读 Agent | **未部署**：需要在生产机新建用户与两个 systemd 单元，等待批准 |
| C 的 Windows SSH | **不存在**：本机没有安装 OpenSSH Server（没有 sshd 服务，22 端口没有监听）。默认方案也不再经 FRP 暴露 C 的 SSH |

## 2. 实测拓扑

```
                      公网                                    │ 只在各自 127.0.0.1
                                                              │
 C Windows ──frpc(TLS+客户端证书)──┐                          │ C: LAB 18300/18301/18302, agent 18410, frpc admin 7400
                                   │                          │
 A 香港 ─────frpc(TLS+客户端证书)──┼─► 8.148.14.4:55404 ──(服务商映射，未验证)──► B:4000 frps
                                   │                          │ B: frps dashboard 7500, visitor 12410(C agent)/12411(A agent),
 A 原有：Cloudflare Tunnel、SSH 38073、nginx、iridescently-runtime 不变      │    B agent 18410, hub 18420
                                                              │
 操作者 ──ssh -L 18420──► B ──► hub（只读 API）               │
```

管理流量只有一条入口：各节点**主动外连** B 的 55404。所有 STCP 代理只能被 B 上用户名为 `ops-b`、并且持有对应 secretKey 的 visitor 访问，visitor 只绑 127.0.0.1。

### B 的公网现状（2026-11-07 实测，见 `b-public-probe.txt`）

Mihomo TUN 下 TCP 连接本身不能说明问题，下表只列**读到了应用字节**的结果。

| 端口 | 读到的内容 | 判断 |
| --- | --- | --- |
| 22 | `OpenSSH_9.6p1 Ubuntu-3ubuntu13.20`，host key `SHA256:1sVsIK9vQKS3mTL06Imx55cF/ejKkWwovqB1AycjBLY`，允许 `publickey,password` | 这台 SSH 是 B 本身还是服务商的跳板，**未知**。允许密码登录，应改为只用密钥 |
| 8080 | `Microsoft-IIS/10.0` 默认页，`Last-Modified: 2025-10-25` | 一台 Linux 主机上出现 IIS，说明 8.148.14.4 很可能是**服务商共用的 FRP 网关**，8080 是别的 Windows 机器经 tcp 代理暴露的。与本项目无关，但说明这个 IP 不是我们独占 |
| 55404 | TLS ClientHello 后对端立即关闭，读到 0 字节 | 与“映射存在但 B:4000 上没有进程”一致，也可能是映射不存在。**未验证** |

推论（待负责人向服务商确认）：8.148.14.4 是服务商的公网中转，55404 由服务商的 frp 转到 B 的内网 4000。我们的 FRPS 跑在 B:4000，与服务商的转发是两层，互不影响。

## 3. 端口清单

| 节点 | 端口 | 进程 | 绑定 | 对外 | 来源 |
| --- | --- | --- | --- | --- | --- |
| C | 18300 | LAB 网关 | 127.0.0.1 | 经 Cloudflare Tunnel `zszm-lab-v2` 对外 `pc-lab.iridescently.cn` | 实测 |
| C | 18301 | R4 | 127.0.0.1 | 否 | 实测 |
| C | 18302 | LAB 管理台 | 127.0.0.1 | 否（拒绝带 cf-ray 的请求） | 实测 + 代码 |
| C | 20241 | cloudflared metrics | 127.0.0.1 | 否 | 实测 |
| C | 22 | — | — | 没有 sshd | 实测 |
| C | 18410 | ops agent（新） | 127.0.0.1 | 只经 STCP 给 B | 本分支 |
| C | 7400 | frpc admin（新） | 127.0.0.1 | 否 | 本分支 |
| B | 4000 | frps（新） | 0.0.0.0 | 经服务商映射为 8.148.14.4:55404 | 本分支，映射未验证 |
| B | 7500 | frps dashboard（新） | 127.0.0.1 | 否 | 本分支 |
| B | 7401 | visitor frpc admin（新） | 127.0.0.1 | 否 | 本分支 |
| B | 12410 / 12411 | STCP visitor → C agent / A agent（新） | 127.0.0.1 | 否 | 本分支 |
| B | 18410 | B 自己的 agent（新） | 127.0.0.1 | 否 | 本分支 |
| B | 18420 | ops hub（新） | 127.0.0.1 | 否，`ssh -L` 访问 | 本分支 |
| B | 17999 | 唯一允许的 tcp 代理端口，且只绑 127.0.0.1 | — | 否 | frps `allowPorts` |
| A | 38073 | sshd（friend，forced command `iridescently-control`） | 公网 | 是（原有） | `local-workspace.json` + 实测 |
| A | 8080 / 443 | iridescently-runtime / nginx | 原有 | 经 Cloudflare | 原有，未改 |
| A | 18410 / 7400 | ops agent / frpc admin（新） | 127.0.0.1 | 只经 STCP 给 B | 本分支 |

C 本机其他监听（QQ、微信、Chrome、Mihomo 等）与本项目无关，完整列表在 `c-local.txt`。另外 C 的 Windows 防火墙 Private 与 Public 两个配置文件是**关闭**的（只有 Domain 开着），见安全审查第 7 条。

## 4. 数据归属

| 数据 | 权威位置 | 本方案怎么碰它 |
| --- | --- | --- |
| 正式用户库、角色、上传、存档 | A `/srv/iridescently/runtime/production/` | 只 `stat` 大小与修改时间，**从不打开** |
| A 的 Release 与 channel | A `/srv/iridescently/runtime/production/releases/` | 用 agent 自己的普通用户读 channel JSON 与目录名 |
| LAB V2 库（lab.sqlite、world.sqlite） | C `labs/zszm-lab-v2-runtime/` | `mode=ro` 打开读 `user_version`；不做 quick_check |
| LAB 备份 | C `labs/zszm-lab-v2-runtime/backups/` | 只读最新一份的 manifest |
| 运维状态（hub 最近快照） | B `/var/lib/iridescently-ops/hub/hub-state.json` | hub 自己写；只有数值和状态，不含日志行；节点失联不清空 |
| FRP 与 hub 密钥 | C `secrets/ops-frp/`（主），各节点 `/etc/iridescently-ops/`（副本，0640） | 不进 Git；CA 私钥只在 C |

三套环境互不连库：C 的 LAB 从不连 A 的库；B 没有任何数据库；A 的生产库不经过 FRP。

## 5. 服务依赖

```
hub(B) ─► visitor(B) ─► frps(B) ◄─ frpc(A) ─► agent(A) ─► 文件 stat / systemctl is-active
   │                        ▲
   │                        └──── frpc(C) ─► agent(C) ─► LAB supervisor.json、/healthz、/api/monitor（monitor 测试码）
   └─► agent(B)、frps dashboard(B)
```

任一节点或 B 停机，影响只到“监控看不到”：A 的网站、Tunnel、数据，C 的 LAB 与 `pc-lab` Tunnel 都不依赖这条链路。

## 6. 复用了什么

| 已有能力 | 复用方式 |
| --- | --- |
| LAB 的 `monitor` 角色与 `/api/monitor` | C 的 agent 用一个 monitor 测试码登录，读在线人数、空间、tick、R4；不用管理台密码 |
| LAB supervisor 的 `supervisor.json` | 直接读，判断子进程存活、失败、重启次数 |
| LAB supervisor 的有界重启（10 分钟最多 5 次，退避 2/4/8/16/30 秒） | `opsnode/supervise.py` 按同样策略管 C 上的 frpc 与 agent；A/B 用 systemd 的 `StartLimitBurst=5`、`RestartSteps` |
| Start-LAB 用 WMI 启动 | `tools/ops/ops-node.ps1 start` 同样用 `Win32_Process.Create` |
| 香港控制命令 `status` 的数据 | `opsnode/hkrelease.py` 按同一份 `control/next.json` 读同样的文件，字段名一致；**不调用** `iridescently-control`（见安全审查第 3 条） |
| 网站管家 / 服务器管家 | 不另建账号体系；后续写操作阶段的入口仍然是服务器管家，hub 只负责看 |

## 7. 安全审查

| # | 风险 | 处理 |
| --- | --- | --- |
| 1 | 三个节点共用一个 FRP `auth.token`；frp 的 `user` 字段本身不认证，节点可以自称别的 user | frps 只支持一个 token。叠加三层：① 每个节点独立的客户端证书（frps `trustedCaFile`，没有证书的连接在 TLS 层被拒）；② 每条 STCP 代理独立 secretKey，冒名者不知道对方的 key，B 的 visitor 连不上它；③ Agent 回包用该节点的 reader 摘要对 hub 每次发出的随机 nonce 做 HMAC 签名，hub 校验不过就判为 `bad_signature`（测试 `test_hub_rejects_unsigned_or_wrongly_signed_answers`）。残余风险：持有 token 和任一证书的节点可以注册别人的代理名占位，造成那个节点“离线”的假象，但读不到数据也伪造不了数据 |
| 2 | C 的 SSH 22 经 STCP 给 B，B 被攻破就多一条进 C 的路 | 默认不发布；`render.py check` 会拒绝 C 上除 18410 之外的代理。需要时按 `infra/frp/templates/optional/pc-ssh.md` 显式启用。C 目前也没有 sshd |
| 3 | 香港 agent 用 sudo root 执行 `iridescently-control status` | 核对源码后发现该命令从 `SSH_ORIGINAL_COMMAND` 取动作，直接 `sudo … status` 会落到加部署锁的分支，并不是只读入口。现在 agent 完全不用 sudo、不调用它，改为普通用户读文件（测试 `test_hk_release_reads_files_only` 确认不写任何文件）；生产库只 `stat`（测试 `test_production_database_is_never_opened` 确认不产生 -shm/-wal） |
| 4 | 失败登录按来源地址限流，经 STCP 后都是 127.0.0.1，会变成全局计数，可用来把 hub 锁在外面 | 有效令牌永远不受限流影响；限流只拖慢失败请求（测试 `test_failed_auth_is_throttled_but_never_locks_out_the_hub`）。令牌是 256 位随机数，不存在可行的暴力猜测 |
| 5 | hub 快照落盘带日志 | 日志行在节点上脱敏（密钥类字段、Bearer、IPv4 后两段）；默认只发错误行计数和最后 5 条错误行，不发普通 tail；hub 写盘前删除所有日志行（测试断言） |
| 6 | 55404→4000 映射没验证 | `infra/frp/verify-mapping.py` 用 frpc-pc 证书做完整 TLS 握手并比对 frps 证书指纹，只有指纹一致才算 PASS。今天对公网的结果是 FAIL（对端立即断开） |
| 7 | C 的 Windows 防火墙 Private/Public 关闭 | 本方案所有新监听都绑 127.0.0.1，不依赖防火墙；但 LAB 以外的本机程序可能监听 0.0.0.0（实测有 135/445/5040/7680/49664 等系统端口）。建议负责人打开防火墙，属于系统设置，我不改 |
| 8 | B 公网 22 允许密码登录；8080 是不明来源的 IIS | 建议向服务商确认 8.148.14.4 是否共享网关、22 属于谁；B 的 sshd 改为只用密钥。B 上我们只新开 4000（经映射），不开其他公网端口 |
| 9 | Windows 上 `SO_REUSEADDR` 允许第二个进程绑定同一端口并抢走流量（实测复现：多个测试 agent 同时监听 18419） | agent 与 hub 改用 `SO_EXCLUSIVEADDRUSE`，第二个实例启动失败（测试 `test_second_agent_cannot_take_over_the_port`） |
| 10 | 密钥进 Git | 模板里只有 `{{占位符}}`；值、证书、令牌、渲染结果全在 `secrets/ops-frp/`；reader 文件只存 sha256 摘要，明文令牌会被拒绝启动 |
| 11 | 管理面 | frps dashboard、frpc admin、hub 全部只绑 127.0.0.1，配置检查强制；hub 不提供任何写接口（POST/PUT/DELETE 返回 405） |
| 12 | 运维进程拖慢生产 | A 上 agent 与 frpc 都有 `CPUQuota=10%`、`MemoryMax=128M`；agent 定时采集，请求只读缓存，外部请求不能触发采集 |

## 8. 故障隔离与恢复

- B 宕机：A、C 的 frpc 按 `loginFailExit = false` 无限重连，心跳 30 秒、90 秒超时；A 的网站与 Tunnel 不受影响。
- C 关机：hub 把 C 标成不可达，保留最后一份快照和时间，不做任何动作。
- 节点失联：hub 只标记 `node_unreachable`，从不清空、重置或替换任何数据；hub 重启后读回上次状态，但一律标为未连通，直到重新拿到签名正确的回包。
- 自动重启：A/B 用 systemd，10 分钟内最多 5 次，延迟 2 秒起逐步加到 30 秒；C 用 `opsnode/supervise.py`，策略同 LAB（测试 `test_supervisor_restart_is_bounded`）。
- 回滚：A `sudo bash install-linux-node.sh uninstall`（只删我们的单元，保留 `/etc/iridescently-ops` 供检查）；C `ops-node.ps1 stop` 后删 `runtime/ops`；B 同 A。不涉及任何原有服务。

## 9. 部署步骤（每一步都等负责人批准）

准备（在 C，非生产，可随时做）：

```powershell
python infra/frp/render.py init   --secrets E:/Iridescently/secrets/ops-frp
python infra/frp/render.py pki    --secrets E:/Iridescently/secrets/ops-frp
python infra/frp/render.py render --secrets E:/Iridescently/secrets/ops-frp
python infra/frp/bundle.py        --secrets E:/Iridescently/secrets/ops-frp
```

**B-1 核实 B（需要 B 的登录方式）**：`uname -a; ss -ltnp; ufw status`；临时 `python3 -m http.server 4000 --bind 0.0.0.0` 后从外部 `curl http://8.148.14.4:55404/` 看能否拿到目录页，结束后立刻停掉。影响：B 上开一个临时 HTTP 服务约 1 分钟。回滚：Ctrl-C。

**B-2 安装 B**：`scp -r bundles/b <B>:/tmp/ops-b && ssh <B> sudo bash /tmp/ops-b/install-linux-node.sh b /tmp/ops-b`。影响：新用户 `iridescently-ops`，四个新单元，B 上新监听 4000（公网经映射）与若干 127.0.0.1 端口。回滚：`sudo bash install-linux-node.sh uninstall`。完成后在 C 运行 `verify-mapping.py`，指纹一致才算映射验证 PASS。

**C-1 本机**：`ops-node.ps1 install-frpc`（官方 v0.71.1，sha256 固定），把 `bundles/pc` 的 `agent-readers.json` 复制到 `secrets/ops/`，复制 `services/ops/config/agent-pc.example.json` 为 `secrets/ops/agent-pc.json`，然后 `ops-node.ps1 start`。影响：本机新增两个只绑 127.0.0.1 的进程和一个外连。回滚：`ops-node.ps1 stop`。

**A-1 香港（生产机，单独批准）**：先只读确认 `agent-hk.example.json` 里标了 VERIFY 的路径与文件权限（agent 用户能读 `control/next.json` 与 channel 文件）。然后 `scp -r bundles/hk` 到 A，`sudo bash install-linux-node.sh hk <dir>`。影响：新用户、两个新单元（`iridescently-ops-agent`、`iridescently-ops-frpc`），一个外连到 55404，两个 127.0.0.1 端口；不改 nginx、cloudflared、`iridescently-runtime`、数据库、Release、sshd、防火墙。回滚：`sudo bash install-linux-node.sh uninstall`。注意：friend 账号是 forced command，只能运行 `iridescently-control`，安装需要负责人用有 sudo 的方式登录。

## 10. 测试记录

| 测试 | 结果 | 证据 |
| --- | --- | --- |
| 配置合法性（TOML 解析、只 STCP、loopback、TLS 校验、visitor 与 proxy 对应） | PASS | `python infra/frp/render.py check` |
| 用官方二进制 `frps verify` / `frpc verify` | NOT TESTED（本机不允许下载执行外部二进制；安装脚本在 B/A 上先 verify 再启动） | — |
| PKI 生成与链校验 | PASS（演练目录，非正式密钥） | `openssl verify` 输出见提交说明 |
| 映射核验脚本逻辑 | PASS（本机 TLS 端点） | `verify-mapping-dryrun.txt` |
| 公网 55404 → B:4000 | FAIL（对端立即断开，0 字节） | `b-public-probe.txt`、`verify-mapping-dryrun.txt` |
| FRP 端到端连通、断线重连 | NOT TESTED（B 未部署） | — |
| Windows 私有 SSH | NOT TESTED（C 没有 sshd；默认方案已不发布） | `c-local.txt` |
| 香港只读 Agent 连通 | NOT TESTED（未批准安装）；香港现状用原有控制命令只读核对 | `a-hk-control-status.json.txt` |
| C agent 对真实 LAB V2 | PASS：网关、supervisor、monitor 在线 1 人、两个库、备份 manifest | `c-agent-status.json` |
| C 上 agent + hub 汇总、离线标记 | PASS（hk、b 指向未开的 visitor 端口，显示 OFFLINE） | `c-local-hub-e2e.txt` |
| 错误认证、未授权、写方法 | PASS：无令牌/错令牌 401、POST 405、限流不锁有效令牌 | 测试 + `c-local-hub-e2e.txt` |
| 冒名节点、错接端口 | PASS：签名不符 `bad_signature`，节点名不符 `node_mismatch` | 测试 |
| 有界重启 | PASS | 测试 |
| 与生产、LAB 的隔离 | PASS（静态）：无代码路径写 A 或 LAB；生产库不打开；LAB 只用 monitor 角色 | 测试 + 代码 |

## 11. 尚未完成

1. B 的登录方式与 55404 映射（需要负责人或服务商）。
2. 香港安装（需要批准，并确认 VERIFY 路径与权限）。
3. C 是否需要 SSH：如需要，先装 sshd 并只允许密钥，再按可选模板启用。
4. 第二阶段（重启、发布、回滚、恢复）：放在服务器管家里，要求节点级权限、审计和二次确认；hub 不承担写操作。
5. hub 的网页视图：目前是 JSON API 加 `python -m opsnode.cli`；网站管家后续可以加一个只读面板调用它。
