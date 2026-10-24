# ZSZM 入口修复：部署与验收记录

状态：代码已修复并在隔离环境验证；生产未激活，DNS 未恢复。不能标记“防窜站完成”。

服务器最终暂存候选：`20261024T044733Z`，基线 `20261023T184556Z`，2,101 文件，211,611,955 bytes；SHA-256 `0aae130d9539db7817dc0a4bae5a8fa7ab62ba670648b8fdb35c57713ff5941d`。远程 stage 返回 `68/68 passed`，强制 Host 隔离与 Linux 监听绑定检查先于门户回归执行并通过。七个 overlay 与工作树源码逐一哈希一致。前一次 `20261024T044358Z` 的 68/69 失败记录保留，不激活、不覆盖证据。

## 范围与实际改动

- 用户已授权生产修复及恢复必要依赖。恢复范围仅 `zszm`、apex、`huiguan`、`oc`，不批量恢复其他记录。
- `server/allowed_hosts.json` 是单一 hostname 源。由仓库 portal 站点清单、既有 DNS before 快照和已取得的 Cloudflare Tunnel 配置生成：25 个已知名称，其中 9 个 HK、9 个 PC 为登记应用入口；R2、旧 tunnel 与测试名不进入应用 allowlist。
- `host_policy.py`：严格解析 Host、合法端口、IPv6 格式；大小写规范化；尾点明确拒绝；空 Host、重复 Host、非法端口、未登记 Host 返回空 421；拒绝日志只含转义并截断的 hostname，不含 query/token。
- 门户及 PC 网关共用上述边界；HTTP 在应用路由前返回 308，保留 path/query，包括 OPTIONS 与未知 method。仅 loopback 且单值 `X-Forwarded-Proto: https` 可声明代理 HTTPS；上游替换 X-Forwarded-Host、移除客户端 Forwarded。
- 仅 zszm 的 HSTS 提升为 30 天；无 includeSubDomains/preload。启用最小强制 CSP `base-uri 'self'; object-src 'none'`，原脚本策略保留 Report-Only。尚未验证全部游戏 inline 依赖，因此未把完整 script-src 强制执行或宣称 unsafe-inline 已清零。
- zszm 静态错误页与 Server header 去除默认 Python 指纹。修复畸形请求在路径/headers 尚未建立时错误处理抛异常的问题。
- 生产既有 `verify_portal.py` 现在必跑 Host 隔离检查，失败退出非零。world-map 检查依候选 portal.json 是否登记该模块，避免安全 overlay 强行带入尚未上线的功能。
- 游戏、认证实现、角色/画廊数据、UI、现有选服 return 过滤均未修改。

## 已验证与未通过矩阵

| 测试 | 预期 | 本轮证据 |
|---|---|---|
| 合法 Host 应用入口 | 允许对应应用 | 本地 9 个 HK hostname，大小写及 :443 均通过 |
| 正式域名 HTTP | 301/308 HTTPS，path/query 不变 | 应用入口 120 项本地综合检查通过；生产 Edge 新规则未写入 |
| 非法/空/重复 Host HTTP | reject | 本地 421，通过 |
| 非法 Host HTTPS | reject | 固定 Cloudflare edge，SNI=zszm/Host=evil → 403 |
| 错误 SNI | reject | SNI=evil / Host=zszm 及双错误，实际 TLS handshake failure |
| 未登记子域 | 不返回业务页 | Cloudflare edge 返回 530；不是正常业务页面 |
| 源站 IP HTTP/HTTPS 与应用端口 | 不得返回业务 | 单一外网环境探测超时，**不作为防火墙通过证据**；远程 stage 另执行内核绑定审查 |
| X-Forwarded-Host / Forwarded | 忽略/替换 | 本地注入请求不改变合法路由；代理代码删除 Forwarded、重建 XFH |
| 证书 | 有效且 SAN 匹配 | 18 个正式/PC hostname 固定 edge 校验成功；证书覆盖 apex 与 *.iridescently.xyz，有效至 2026-12-28 |
| Tunnel hostname 映射 | 精确映射、404 fallback | 已取得的本地配置型 tunnel 快照通过，无 wildcard；仍需当前连接器配置核对 |
| 选服 return | 阻止外域 payload | 原逻辑 6 类 payload 执行通过，未修改实现 |
| Portal/Huiguan/Cards | 核心回归正常 | 生产归档 + 安全 overlay 的本地门户 68/68；Cards 原有 4 项、连接生命周期 8 项；账户/存档/管理员/图库回归 38 项通过 |
| 真实公网 / 与 /app | 正常内容、无循环 | **待恢复后验收**；当前 DNS NXDOMAIN，门禁正确失败 |
| 两个独立网络 | 公网 TLS/HTTP 均通过 | **未完成**；两个 DoH 解析器不是两个独立网络 |
| Full (strict) | 正式配置达到 strict | 控制台当前自动模式 Full；**未修改** |
| Nginx 默认 vhost/Host 守卫 | 已安装并 nginx -t 通过 | 已生成实际配置，**未安装、未声称语法/运行验证通过** |

原始结果在 `E:\CloudflareEvidence\incident-20261024-20261024T041954Z`。不重复导出 DNS before/after，不覆盖原日志。

## 生产变更精确步骤

1. 复核受限 SSH `status` 当前版本仍为 `20261023T184556Z`；候选必须基于该归档，逐文件校验发布 manifest。只 overlay 七个 server 文件，其余 2,094 个候选文件保持既有字节。不得从主工作区全量构建或捎带 world-map/玩法改动。
2. 先 `stage VERSION`。既有远程 stage 会执行 120 项 Host 隔离、实际 Linux 内核监听地址检查及 68 项门户回归。失败不激活。保留失败 stage 与日志。
3. 用有对应权限的控制面通道先读取当前 Rulesets 入口。向 `http_request_dynamic_redirect` 规则集 **追加一条** `ops/security/zszm-http-redirect.json`，保留既有 www→apex；表达式只覆盖四个恢复范围 hostname，scheme=http，308、同 hostname、preserve_query_string=true。现有 Always Use HTTPS 保持关闭，不使用 Zone 全域开关。
4. 向 `http_response_headers_transform` 追加 `zszm-edge-headers.json`，只匹配 HTTPS zszm，补齐 nginx 直接服务 select/selector 等路径的 HSTS/CSP。不能覆盖整个规则集，也不能删除原图封锁规则。
5. 将 SSL/TLS 设置受控切到 Full (strict)，记录原值与修改 ID。此设置为 Zone 级，影响范围必须明确为该 Zone；Tunnel 到 loopback HTTP 不会因此变为 HTTPS。这里无需重签当前有效 Edge certificate，也不关闭验证。原值 Full/automatic 已记录，严禁 Flexible/noTLSVerify。
6. 服务器管理通道取得 `nginx -T`、当前 cloudflared 配置和监听信息。仅当与已审查拓扑一致时，安装 generated/host-map.conf、default 与 guards；现有业务 vhost 的 server_name 由 generated/business-server-name.conf 替换。proxy snippet 的固定 `X-Forwarded-Proto https` 改为已验证的访客值；先 `nginx -t`，再 reload，失败立即恢复配置。保持 localhost:8080，不新增公网 80/443。TLS 默认黑洞示例仅供确实已有私有 TLS listener 时使用，不能为测试新开公网入口。
7. 核实其他 Page Rules、Worker Routes、Bulk Redirect 不含未知重定向；本轮 Rules 总览仅见既有 www→apex，Workers scripts 为空，但尚未完成全部控制面页面核验。
8. 用受限发布命令 `activate VERSION` 激活已通过 stage 的候选；读取 status，确认五服务 active。保留 old version 作为回滚目标。
9. 从既有 before 快照逐条恢复 apex → huiguan → oc → zszm：每次必须确认该 hostname 当前没有冲突记录，CNAME 目标为 `6c9eb0eb-26d7-451c-9dbd-878e7c14f4a7.cfargotunnel.com`，proxied=true、TTL=auto。记录本次创建的 record ID，不恢复其余记录。
10. 每条恢复后检查 HTTP 第一跳与 TLS，再运行 `python -X utf8 server/security_ingress_test.py --public --output result.json`，真实浏览器检查登录、门庭、页面导航与交互，并在第二个独立网络复验。监看边缘 3xx/5xx、未知 Host 拒绝计数及源站日志；日志不包含认证 query。

上述生产写操作均未执行；授权已具备，阻塞是控制面工具访问与未完成的运行态安全验收，不是等待再次批准。

## 回滚

- 任何关键验证失败：立即撤下本次创建的恢复范围 DNS（只用本次 record ID，不触碰原本保留的 R2/其他记录）。缓存 TTL 未必立即清空，所以同时维持 Host/HTTPS 边界。
- 若已激活代码，确认 current 正是本次版本后调用现有 `rollback`，应回到 `20261023T184556Z`，再次检查五服务；用户数据未进入代码包，不回滚数据库。
- 只移除本轮新增的 redirect/header rule ID；不要用全量 ruleset PUT 回滚以免覆盖并行修改。保留有益的 HTTPS 防护，除非它本身是失败原因。
- 网关配置用修改前的精确内容恢复，再 `nginx -t` / reload。不得清理审计、失败包、日志或历史证书证据。
- DNSSEC：当前 Cloudflare disabled，注册局未见 DS。注册商为 Alibaba/HiChina；尚未核实注册商 DS 控制台。待 DNS 稳定后单独启用 Cloudflare DNSSEC、获取真实 DS，再在注册商提交并通过独立 validating resolver 验证；本轮不生成虚构 DS、不盲目启停。

## 剩余根因与访问阻塞

历史异常证书信息目前无法复原。用户提供的安卓/夸克历史截图证明异常站访问记录存在，但不能单凭历史列表区分搜索跳转、浏览器/网络行为或站点响应。当前归档 2,098 个文件与发布清单哈希一致，未匹配截图域名；Slay 的现有 Service Worker 仅在其模块路径注册。这些证据不能排除曾发生的瞬时异常。

Chrome 自动化持续被扩展 UI 阻挡，且 Windows 页面 URL 校验安全机制已停止控制；现有 cloudflared API 凭据缺少 SSL/Rulesets 权限。未绕过安全机制或扩大凭据权限，未因有 DNS 写权限就提前恢复公网。

参考：[Nginx ssl_reject_handshake](https://nginx.org/en/docs/http/ngx_http_ssl_module.html#ssl_reject_handshake)、[Cloudflare Single Redirects](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/)、[Tunnel HTTPS origins](https://developers.cloudflare.com/tunnel/troubleshooting/https-origins/)。
