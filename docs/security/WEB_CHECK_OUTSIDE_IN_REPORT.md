# Executive Summary

本报告记录 Stage 1.65 的只读、outside-in 检查。检查目标仅为下列九个获授权 hostname。未执行账户越权、爆破、fuzz、全端口/UDP 扫描、traceroute，也未扫描从结果中发现的其他 hostname；未对生产做任何修改。

使用 Lissy93/Web-Check 官方上游 **v2.3.7**（2026-10-16 检查时最新发布版本）。本机 Docker Engine 不可用，因此从独立临时目录安装依赖并以当前普通用户运行 API-only 实例。服务绑定 `127.0.0.1:3000`，没有映射公网端口；目标 hostname allowlist 与 `/ports` apex-only 限制已验证。第一轮配置关闭 `ports`、`trace-route`；第一轮完成后只对 apex 执行一次工具自带 common TCP port 检查。扫描期间使用 Cloudflare DoH 校验的 Cloudflare A 记录绕开本机 Mihomo Fake-IP DNS。Web-Check 实例已停止，端口 3000 当前无监听。

**结论：** 九个 hostname 的 HTTP→HTTPS 与 Cloudflare 边缘服务得到确认；证书有效且使用 TLS 1.3 建连。但 Web-Check 在 Cloudflare edge 观察到 TLS 1.0 和 1.1 也可协商，这是新的边缘 TLS 配置发现，建议在 Stage 2 前评估是否将最低版本提高到 TLS 1.2，或记录兼容性接受决定。apex common-port 结果全部属于 **Cloudflare edge 观察**，不能证明 origin 端口开放。未证实新的 origin 暴露、应用漏洞或 Stage 2 阻塞项。已有 Stage 1.6 的 Stage 2 `NOT READY` 运维阻塞仍然有效。

分类用语：`CONFIRMED` 表示本轮直接观察到；`LIKELY` 表示有证据支持但未完全验证；`INFORMATIONAL` 表示信息或配置差异；`FALSE POSITIVE` 表示工具解释不成立；`EDGE-ONLY` 表示仅能归因于 Cloudflare 公网边缘；`UNKNOWN` 表示证据不足。

# Scanned Hosts

| Hostname | HTTP / HTTPS 结果 | 本轮执行 |
|---|---|---|
| `iridescently.xyz` | 308→HTTPS；HTTPS 200 | 完整首轮；唯一执行 common TCP ports 的 hostname |
| `www.iridescently.xyz` | 301→HTTPS apex；HTTPS 301→apex | 完整首轮；注意 redirect 响应未带 HSTS |
| `huiguan.iridescently.xyz` | 308→同 hostname HTTPS；HTTPS 200 | 完整首轮 |
| `oc.iridescently.xyz` | 308→同 hostname HTTPS；HTTPS 200 | 完整首轮 |
| `spirit.iridescently.xyz` | 308→同 hostname HTTPS；HTTPS 200 | 完整首轮 |
| `zszm.iridescently.xyz` | 308→同 hostname HTTPS；HTTPS 200 | 完整首轮 |
| `game.iridescently.xyz` | 308→同 hostname HTTPS；HTTPS 308→`zszm.iridescently.xyz/#home` | 完整首轮 |
| `juling.iridescently.xyz` | 308→同 hostname HTTPS；HTTPS 308→`zszm.iridescently.xyz/app/shell/m/juling` | 完整首轮 |
| `lingjing.iridescently.xyz` | 308→同 hostname HTTPS；HTTPS 308→`zszm.iridescently.xyz/#management` | 完整首轮 |

# DNS

- **CONFIRMED：** Cloudflare DoH 查询的九个目标均使用同一组 A 记录 `104.21.6.184`、`172.67.155.44`，以及 AAAA 记录 `2606:4700:3037::ac43:9b2c`、`2606:4700:3036::6815:6b8`。这是 DNS 返回的 Cloudflare edge 地址，不是 origin 地址。
- **CONFIRMED：** NS 为 `irena.ns.cloudflare.com`、`junade.ns.cloudflare.com`。
- **INFORMATIONAL：** apex CAA、DS、DNSKEY 查询无记录；Web-Check DNSSEC 检查没有观察到 DNSKEY/DS/RRSIG，`AD=false`，因此当前证据表明该区未启用 DNSSEC。此前四份阶段报告未发现明确相反结论；不代表发现了可直接利用的漏洞。
- 本机默认解析曾返回 Mihomo Fake-IP 地址 `198.18.0.x`。为避免把代理合成地址当作目标，扫描解析仅对九个 allowlist hostname 固定到上述 DoH 校验的 Cloudflare A 记录。TXT/MX 未见记录；不据此推断邮件或域名配置完整性。

# TLS

- **CONFIRMED / EDGE-ONLY：** 九个 hostname 均可通过 TLS 1.3 建立连接，密码套件 `TLS_AES_256_GCM_SHA384`，ALPN `h2`；Web-Check 报告证书链授权有效。
- 证书链为 `iridescently.xyz → WE1 → GTS Root R4`；SAN 包含 `iridescently.xyz` 与 `*.iridescently.xyz`；有效期 **2026-09-29 至 2026-12-28**。检查时证书有效。
- **CONFIRMED / EDGE-ONLY，新发现：** Web-Check 的 TLS versions 探测显示 Cloudflare edge 接受 TLS 1.0、TLS 1.1、TLS 1.2、TLS 1.3。它同时使用 TLS 1.3 成功，不意味着低版本未启用。该结果不揭示 origin TLS 配置。
- **建议：** Stage 2 前评估将 Cloudflare zone 的最低 TLS 版本设为 TLS 1.2；若业务兼容性需要保留 TLS 1.0/1.1，应把它作为明确的边缘兼容性风险接受。此报告只提出决策项，不更改 Cloudflare 设置。Cloudflare 对协议与最低版本的说明：[TLS protocols](https://developers.cloudflare.com/ssl/reference/protocols/)、[minimum TLS version](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/minimum-tls/)。

# HTTP / HTTPS

- **CONFIRMED：** 九个 hostname 的 HTTP 请求都会重定向到 HTTPS。
- **CONFIRMED：** `www.iridescently.xyz` 的 HTTPS 请求 canonical redirect 至 apex；与既有 `www` canonical redirect 结论一致。
- **CONFIRMED：** `game`、`juling`、`lingjing` 的 HTTPS 页面分别继续重定向到 ZSZM 应用对应路径/锚点；其余内容 hostname 返回 HTTPS 200。
- **CONFIRMED：** apex 返回 HTTP 308 至 `https://iridescently.xyz/`，随后 HTTPS 200。`www` 的 HTTP 301 先跳 HTTPS apex，其 HTTPS 响应也为 301 至 apex。
- HTTP→HTTPS 与 www canonical 行为符合既有 Stage 1.6 结论；本轮未发现回归。

# Security Headers

八个直接提供内容的 hostname 响应可见：

- `Strict-Transport-Security: max-age=86400`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- CSP 为 `Content-Security-Policy-Report-Only`，未观察到强制执行的 `Content-Security-Policy`。

`www` 作为 redirect 响应未带 HSTS。Stage 1.6 已记录 www 缺少 HSTS、其余 hostname 使用 `max-age=86400`，以及 CSP 为 Report-Only；因此这些是**已知状态/配置差异，不是本轮新回归**。Web-Check 将 Report-Only CSP 按缺少强制 CSP 标示，不能单凭这个标示推断可利用漏洞。HSTS 的一天期限也低于 Web-Check 当前采用的一年阈值，但与既有 baseline 一致。

# Cookies

- **CONFIRMED：** 本轮匿名根路径 GET 的九个 hostname 均未返回 `Set-Cookie`；Web-Check 对部分 hostname 的浏览器 cookie 检查为空或超时/失败。
- 这仅说明匿名请求没有观察到 cookie。匿名视角看不到登录态 cookie 是正常现象，**不能据此判断生产 session cookie 缺少安全属性**。
- Stage 1.5 已通过实际生产登录验证 session cookie 为 `Secure=True; HttpOnly=True; SameSite=Lax`。Web-Check 本轮没有执行登录，也没有检查认证后 cookie。

# CDN / WAF

- **CONFIRMED / EDGE-ONLY：** 九个目标均被 Web-Check 识别为 Cloudflare；HTTP 响应的 `Server: cloudflare` 与 `CF-RAY` 与此一致。工具报告 `hasWaf=true`、WAF 名称 Cloudflare。
- **UNKNOWN：** 仅凭被识别为 Cloudflare/WAF，不能确认具体 WAF 规则、模式、覆盖路径或 origin 防护状态。Stage 1.6 已将 Cloudflare 规则设置和 origin firewall 列为未知/待处理。
- 未见 `X-Powered-By`。Server 标识是边缘响应信息，不代表 origin 软件标识。

# Open Ports

第一轮 ports 检查关闭。之后仅对 `iridescently.xyz` 的 Cloudflare A 记录执行 Web-Check 自带 common TCP port 检查；没有 UDP、全端口、traceroute 或其他 hostname 的端口检查。

| 归属 | 结果 | 解释 |
|---|---|---|
| Cloudflare edge | 工具报告开放 TCP：20, 21, 22, 23, 25, 53, 67, 68, 69, 80, 110, 119, 123, 143, 156, 161, 162, 179, 194, 389, 443, 587, 993, 995, 3000, 3306, 3389, 5060, 5900, 8000, 8080, 8888；32 个 common ports 均报告开放 | **EDGE-ONLY。** 目标地址是 Cloudflare anycast edge。Cloudflare 文档说明其任播网络上非标准端口可能因 Cloudflare 为其他客户提供服务而呈现开放：[Network ports](https://developers.cloudflare.com/fundamentals/reference/network-ports/)。不能由此得出这些服务属于本域名 origin。 |
| Possible origin | 本轮未直接连接 origin IP，也未对 origin 地址扫描 | **UNKNOWN。** 现有 Stage 1.6 关于 origin firewall、公开监听器的运维发现仍适用，但本轮 edge 端口结果没有新增 origin 证据。 |
| Unknown | 其他目标 hostname 与 origin 的端口状态 | 未测试。 |

# Technology Exposure

- Web-Check apex tech-stack 检查识别到 Cloudflare、HSTS、HTTP/3。浏览器分析在页面关闭时以 `Target closed` 错误结束，因此结果不完整。
- **UNKNOWN：** 本轮没有可靠确认 origin framework、runtime 或服务器版本；不要把边缘检测结果解释为 origin 技术栈。
- 没有观察到 `X-Powered-By`。Cloudflare Server/CF-RAY 标识为已观察的 edge 信息。

# Associated Hosts

- Web-Check 对 apex 的子域名检查返回 `assets.iridescently.xyz`（来源 CertSpotter）。该 hostname 已在 `docs/security/attack-surface.md` 中登记，故不是新发现。
- 未提供 Shodan API key，Web-Check 的 Shodan/associated-hosts 查询不可用；结果不完整，不能视为不存在其他关联 hostname。
- 从未授权范围中发现的 hostname 没有进一步扫描。`psyche`、`psy`、`feather` 等 inventory 中历史/其他用途 hostname 未纳入本轮目标。

# Public Files

| 资源 | 观察结果 |
|---|---|
| `robots.txt`（apex） | 200；内容允许所有 user-agent 抓取，列出 `/.git/`、`/__pycache__/`、`/assets/store/`、`/assets/uploads/` 为 Disallow。robots 规则只是爬虫提示，不是访问控制；本轮未尝试访问这些目录。 |
| `robots.txt`（www） | 跟随 redirect 后得到 apex robots 内容。 |
| `robots.txt`（huiguan、oc） | 允许抓取并声明 `Sitemap: https://iridescently.xyz/sitemap.xml`。 |
| `robots.txt`（spirit、zszm） | 未发现 robots 文件。 |
| `robots.txt`（game、juling、lingjing） | 因 redirect / 检查结果未提供独立规则；未知。 |
| `sitemap.xml` | apex 声明的 URL 直接 GET 返回 404；Web-Check 未找到 sitemap。**CONFIRMED / INFORMATIONAL：** robots 中 sitemap 声明当前指向不存在的资源，属于内容/爬虫配置不一致，不是安全漏洞证据。 |
| `security.txt` | `/.well-known/security.txt` 返回 404；Web-Check 九个 hostname 均未发现。**INFORMATIONAL：** 未发布协调披露联系文件；是否需要发布由项目策略决定。 |

# New Findings

| Severity | Confidence | Evidence | Web-Check result | Existing Stage result | Interpretation | Action |
|---|---|---|---|---|---|---|
| Medium（配置决策） | **CONFIRMED / EDGE-ONLY** | 九个 hostname 的 TLS version 探测均报告 TLS 1.0、1.1、1.2、1.3；当前连接 TLS 1.3。 | 低版本协议可在 Cloudflare edge 协商。 | 前四份报告未记录最低协议版本或该发现。 | 新的 Cloudflare edge 配置发现；不是 origin TLS 证据，也不是已证明可利用的攻击。 | Stage 2 前评估 Cloudflare 最低 TLS 1.2；若有旧客户端兼容性约束，明确记录接受理由。此轮不改生产。 |
| Informational | **CONFIRMED** | apex 及 huiguan/oc robots 声明 sitemap；直接请求 apex sitemap 为 404。 | 未找到 sitemap。 | 既有报告未记录该不一致。 | 新的公开内容配置不一致，不是访问控制或漏洞事实。 | 内容负责人决定修复 sitemap 或移除失效声明。 |
| Informational | **CONFIRMED** | apex DNS 查询无 DS/DNSKEY/RRSIG，AD=false。 | DNSSEC 检查未确认已签名。 | 既有报告未记载 DNSSEC 状态。 | 新的 DNS 配置状态记录；未证明存在可利用问题。 | 如采用 DNSSEC，另行评估并按变更流程启用；本次不改 DNS。 |
| Informational | **CONFIRMED** | 九个 hostname 的 `/.well-known/security.txt` 未找到；apex 404。 | security.txt 缺失。 | 既有报告未记载此项。 | 披露流程信息缺失；不是漏洞。 | 按维护策略决定是否发布标准联系信息。 |
| Low / 已知差异 | **CONFIRMED** | `www` 的 HTTP/HTTPS 301 redirect 响应无 HSTS；其他八个目标 HSTS 为 `max-age=86400`。 | Web-Check 跟随 www redirect 后可能展示 apex 最终 headers；直接响应检查未带 HSTS。 | Stage 1.6 已记录 www 缺少 HSTS，其余 max-age=86400。 | 已知状态，不是本轮新回归；本报告保留原始响应证据以免 redirect-follow 产生误判。 | 纳入既有 header hardening 决策；不因本报告单独改生产。 |
| Informational / edge context | **CONFIRMED / EDGE-ONLY** | apex 单次 common TCP port 检查对 32 个默认端口均报开放；解析目标为 Cloudflare A 记录。 | 全部 common TCP ports open。 | Stage 1.6 已知 Cloudflare 前置与 origin firewall/监听器待核验。 | Cloudflare edge 观察，不能认定 origin 服务暴露。 | 不基于此结果改 origin 防火墙；如需确认 origin，沿既有 Stage 1.7/运维路径做范围明确的核验。 |

# False Positives / Edge Effects

- **`www` HSTS：** Web-Check headers endpoint 会跟随 redirect，可能呈现 apex 最终响应的 HSTS；直接查看 `www` 的 redirect 响应可确认它本身没有 HSTS。该缺失是 Stage 1.6 已知状态。
- **CSP：** 只有 `Content-Security-Policy-Report-Only` 时，Web-Check 的“CSP missing”式结果表示未见强制 CSP；这不是可利用漏洞的证明，且符合既有报告。
- **HSTS 低于一年：** 工具的兼容阈值告警与既有配置 `max-age=86400` 相符，不能当作新回归。
- **匿名 cookie 为空：** 不能推断认证 session cookie 属性；Stage 1.5 有独立登录态证据。
- **开放端口：** 扫描 IP 属于 Cloudflare edge；结果为 **EDGE-ONLY**。不等于 origin 对外开放，也不等于这些端口由该网站租户承载。
- **证书/协议：** 证书与握手验证的是 edge 终止的 TLS；origin 至 Cloudflare 的 TLS 模式及证书不由本轮证明。
- **技术栈：** Cloudflare、HTTP/3 等指纹是边缘特征；浏览器探测异常退出，origin stack 为 UNKNOWN。
- **DNS resolver：** 本机 Mihomo Fake-IP 会污染默认 DNS 观察，因此使用经 DoH 交叉校验的结果作为本报告 DNS/连接目标证据。

# What Web-Check Cannot Test

本轮工具检查不验证下列应用逻辑或授权属性，也没有访问账号或执行攻击用例：

- Authorization / 授权边界
- IDOR
- CSRF
- Account ownership / 账户所有权校验
- OAuth business logic
- Password reset logic
- Upload ownership / 上传文件所有权

这些项目属于后续有授权、按范围设计的应用测试；本轮不能给出通过或失败结论。

# Stage 2 Impact

**本轮没有发现已证实的 origin 或应用层新阻塞项。** 新增一项 Stage 2 前的边缘配置决策：Cloudflare edge 仍接受 TLS 1.0/1.1，应评估最低 TLS 1.2 或记录兼容性风险接受。Common-port 结果仅限 Cloudflare edge，不能作为 origin 暴露结论。

这不改变 [Stage 1.6 运维加固报告](STAGE1_6_OPERATIONAL_HARDENING.md) 中的 Stage 2 `NOT READY` 结论：origin firewall/公开监听器和 off-host backup 等既有事项仍须按原报告处理。HSTS 的 `www` 差异与 CSP Report-Only 也是已知项，不是本轮新发现。未因 Web-Check 的 warning 修改生产；至本报告完成时 Web-Check 本地实例已停止。
