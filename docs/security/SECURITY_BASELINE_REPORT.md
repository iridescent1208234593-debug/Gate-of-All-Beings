# SECURITY_BASELINE_REPORT

**审计时间：** 2026-10-16（Asia/Singapore）  
**范围：** Iridescently 主站及本工作区配置中发现的站群  
**阶段：** 第一阶段、只读防御性基线审计  
**变更：** 仅新增 `docs/security/` 审计文档；未修改应用代码、部署、DNS、账户或数据库。

## Executive Summary

**整体评级：High（有条件）**。发现一个已从公网直接验证的高风险问题：`http://iridescently.xyz/` 返回 200，未重定向至 HTTPS；HTTPS 响应也没有 HSTS。用户若经 HTTP 访问登录页或提交账户请求，存在链路窃听/篡改风险，应用会话 Cookie 的 `Secure` 属性也仅在收到 `X-Forwarded-Proto: https` 时添加。应先完成 HTTPS 强制跳转和 Cookie 修正，再评估启用 HSTS。

有利证据：公开 DNS 查询显示已配置站群的 A/AAAA 记录都指向 Cloudflare Anycast；未发现 DNS 响应泄露源站 IP。账户密码使用 scrypt（兼容回退 PBKDF2），认证与验证/找回端点有应用层限速，关键账户 API 有登录态及角色校验，上传实现限制了格式、大小及像素数。生产 HTTPS 页面有 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`。

重要未知：运行主机的外部防火墙/路由器、Cloudflare SSL/TLS 与 WAF 配置、云端隧道状态、生产源站监听状态及日志/备份/告警策略未能从本地仓库证明。当前本机只读监听快照发现统一入口 8080 监听 `0.0.0.0`、聚灵 5177 监听 `:::`；这证明绑定所有接口，但不能单凭此判断公网可达。部署隧道配置将九个主机名指向 `127.0.0.1:8080`。

### 当前公开暴露面（已观察）

- 公网 HTTPS 对外提供主站、会馆、设定页、众生之门和灵体互动；HTTP 主站仍返回页面。
- Cloudflare 边缘 DNS 有 IPv4 与 IPv6；本次未做高并发扫描，也未扫描第三方设施。
- 项目部署配置将 `iridescently.xyz`、`www`、`huiguan`、`oc`、`spirit`、`zszm`、`game`、`juling`、`lingjing` 指向本机 8080。`game`、`juling`、`lingjing` 在应用路由中重定向或代理。
- 统一入口按路径代理 Cards OAuth、Card Balance、Softie 和 Juling API 到本机上游；API 与网页都经各自站点域名暴露。
- Cloudflare DNS 同时为 `psyche`、`psy`、`feather`、`assets` 返回 Cloudflare Anycast 地址，但这些主机名未出现在本机 tunnel ingress 清单中；其实际 Cloudflare 处理规则/目的服务未知。
- 暂无证据证明 8088/8089/8090、开发服务器或数据库端口从公网开放。无证据不等于已关闭。

## Attack Surface

完整资产、来源、认证和状态见 [attack-surface.md](attack-surface.md)。当前主要访问链：

```text
Browser (HTTP or HTTPS)
  -> public DNS (Cloudflare A + AAAA)
  -> Cloudflare edge (proxy observed; WAF/settings unknown)
  -> Cloudflare Tunnel ingress
  -> 127.0.0.1:8080 unified Python dispatcher
  -> Huiguan / www / OC handlers, static modules, or localhost API upstreams
  -> SQLite / project runtime data / upload and store directories
```

Tunnel hostname routing and application routing do not fully match for four DNS names. No direct origin/IP bypass was established. The 8080 and 5177 wildcard listeners make local firewall/edge restriction verification a priority.

## Account Security

- **Positive:** salted scrypt (`n=16384,r=8,p=1`) with PBKDF2 fallback; local login limited to 8 failures per account+IP per 10 minutes; registration limited per IP; verified-email challenge and recovery links are random, hashed at rest, expire in 30 minutes, and recovery invalidates local sessions. Email recovery response avoids account enumeration.
- **Gap:** local passwords accept 6 characters; reset/change flows share this floor. Security-question reset is an additional recovery path with knowledge answers. Recommend raising password guidance/minimum and reviewing whether security questions should remain an account recovery factor.
- **Gap:** shared `session` and `hx_sso` cookies have 30-day and 7-day lifetimes respectively and add `Secure` only when the request header indicates HTTPS. The public HTTP route makes this conditional behavior material. The cookie is `HttpOnly; SameSite=Lax`.
- **Enumeration:** registration reveals an existing username with HTTP 409; recovery by verified email returns a generic response. Security-question lookup has different result for nonexistent/unconfigured accounts. Assess UX and abuse cost; do not change recovery semantics without a migration plan.
- **Not established:** independent per-account login ceiling across source IPs, MFA, full session inventory/revocation UI, session fixation regression, and security-event alerting.

## API Security

The API inventory is documented in [docs/api.md](../api.md). Static review found parameterized SQL in observed account/recovery queries, input size/type checks in account recovery, exact allowlists for account-email/recovery/security Origin checks, and role checks on administrative/editor endpoints. Public `/api/official/characters` supports pagination up to 500; fan-content pagination is capped at 60. The JSON proxy caps request bodies at 8 MiB.

The Cards OAuth upstream returns `Access-Control-Allow-Origin: *` for JSON responses and binds to `0.0.0.0:5174` when started. The wildcard is not paired with `Access-Control-Allow-Credentials`, but the broad CORS policy is unnecessary for a same-origin proxied API. The production request path, direct port reachability, and browser exploitability were not demonstrated. Confirm upstream authorization and restrict CORS/bind address.

No production mutation, fuzzing, brute force, or third-party scan was performed. Access control conclusions are static-source conclusions, not an exhaustive endpoint-by-endpoint dynamic authorization test.

## Access Control

See [access-control-matrix.md](access-control-matrix.md). The source contains owner scoping for character saves, poster ownership checks, admin/editor role guards, and current-user checks for email and account security. The route inventory is large; full resource-by-resource IDOR validation with separate owned test accounts is deferred to a controlled Stage 2 test environment.

## Domain / DNS

Low-frequency DNS-over-HTTPS checks on 2026-10-16 queried A, AAAA, CNAME, TXT, CAA, and NS for configured/known names. Apex and all listed names returned Cloudflare IPv4/IPv6 Anycast records; apex NS returned `irena.ns.cloudflare.com` and `junade.ns.cloudflare.com`. No queried CNAME, TXT, or CAA answers were returned for the names. These observations do not prove ownership, proxy settings, dangling-record absence, DNSSEC state, or complete zone inventory. Local DNS gave `198.18.0.0/15` fake addresses due to Mihomo; those are not public DNS evidence.

No origin IP was visible in these DNS answers. IPv6 is available at the Cloudflare edge; origin IPv6 behavior and firewall parity remain unknown. DNS single-provider concentration at Cloudflare is a dependency/single point of failure.

## TLS

HTTPS GETs to the five primary domains succeeded with HTTP 200 through Cloudflare. TLS certificate chain, expiry, renewal configuration, TLS 1.2/1.3 negotiation, old protocol rejection, and origin-to-edge TLS mode were not independently inspected. HTTPS responses did not include HSTS. HTTP did not redirect to HTTPS (SEC-001).

## Public Ports

Cloudflare public edge serves web traffic on 80/443. The local snapshot at audit time showed 8080 on `0.0.0.0`, 5177 on `:::` and 5178/4173/8765 on loopback. 5174 was not listening at that instant. The workspace documents 5174, 5177, 5178, 4173 and several optional/dev ports. Wildcard listeners are not proof of public reachability; firewall/NAT/tunnel-host controls were unavailable. Treat 8080 and 5177 as **UNEXPECTED external exposure until an external firewall rule is evidenced**; they should normally be loopback-only behind the tunnel.

## Frontend Exposure

Client JS, HTML, public manifests, and public Gallery/media are inherently retrievable by browsers. Project code documents `.env*`, databases, logs, backups and private keys as excluded from Git/release snapshots. A low-frequency public request returned 404 for `/.git/config`, `/.env`, and `/backup.zip` on the Huiguan domain. This is a small sample, not exhaustive path coverage.

Candidate (not production) release output contains several dependency `.map` files under `modules/slay/web_modules/`. The README identifies candidate output as unpublished. No conclusion is made about source maps in the active production snapshot.

## Secrets

A heuristic pattern scan found no common API/private-key formats in Git history across the 108 reachable commits. Current tracked-text matches were limited to documentation/test paths and were not confirmed as live credentials. This is not a complete secret scan; ignored `.env.local`, runtime configuration, external Cloudflare credentials and user data were not printed or scanned. No secret value is reproduced in this report. `npm audit` returned 0 advisories for the current lockfile at audit time.

## File Upload

Image upload code checks declared MIME against file signatures, validates with Pillow, caps images at 8 MiB (GIF 5 MiB) and 40 million pixels, and caps request bodies. It stores accepted original bytes without re-encoding. This lowers format/path risks but leaves parser/decompression and original-image exposure risks; there is no evidence of a dedicated malware/quarantine process. No malicious file was uploaded.

## Content Protection

Public images are browser-deliverable and cannot be made unsaveable. Gallery/API pagination has caps but still permits repeated page retrieval; CDN bot controls/hotlink rules and origin-resolution policy are unknown. Public upload assets are served from stable same-origin paths. Whether highest-resolution originals are directly exposed was not verified. Use resized public derivatives and reserve originals for an authorization-controlled path if licensing/creator needs require it.

## Supply Chain

`npm audit` on 2026-10-16 reported 0 vulnerabilities in the lockfile. This does not validate Python packages, stale/unmaintained packages, GitHub Actions secret exposure, package provenance, or OS dependencies. Dependency files and workflow policy need a separate review before declaring the supply chain clean.

## Logging

Source has basic request/service logs and recovery failure logging that avoids printing reset tokens. No repository evidence establishes redaction of all authorization/cookie/session values across every service, central log retention, alerting for failed logins/401/403/admin activity, or log integrity. Production logging/monitoring are **UNKNOWN**.

## Availability

The documented chain includes Cloudflare DNS/edge, Tunnel, one Windows origin, one Python dispatcher, several local API upstreams and SQLite/runtime storage. This is a single-host architecture with likely single points of failure at host, tunnel, dispatcher and local data disk. Watchdog and Website Manager exist, but current alert delivery, backup restore tests, process health, tunnel health, capacity limits and Cloudflare cache/rate-limit configuration are not confirmed. The proxy uses 30-second HTTP upstream timeouts and 90-second WebSocket idle select; broader edge/proxy timeout alignment is unknown.

## Findings

### SEC-001 — HIGH — HTTP is served without HTTPS redirect / HSTS

- **Asset:** `iridescently.xyz` account and public pages
- **Description:** HTTP request is served successfully; HTTPS response has no HSTS. Session cookies conditionally add `Secure` only if forwarded proto is HTTPS.
- **Evidence:** Live low-frequency GET on 2026-10-16: `http://iridescently.xyz/` → 200; `https://iridescently.xyz/` → 200 with no `Strict-Transport-Security`. Cookie setters: `portal/huiguan/server_huiguan.py:3810-3834`.
- **Attack Scenario:** A first-time or manually HTTP visitor on an untrusted network can be downgraded/observed; login and session traffic may be exposed before HTTPS is established.
- **Impact:** Credential/session theft or response tampering.
- **Recommended Fix:** Enforce edge HTTP→HTTPS for all hostnames; make production auth cookies unconditionally `Secure`; after validating all subdomains, deploy an appropriate HSTS policy (consider preload/includeSubDomains separately).
- **Fix Priority:** Immediate.
- **Verification Method:** Repeat one GET over HTTP per production hostname and require redirect; inspect Set-Cookie from a controlled test login for Secure/HttpOnly/SameSite; confirm HSTS on HTTPS.

### SEC-002 — MEDIUM (provisional) — Wildcard origin binds with firewall posture unknown

- **Asset:** Unified entry 8080; Juling upstream 5177; Cards OAuth 5174 when started
- **Description:** Production entry binds `0.0.0.0`; current 5177 binds IPv6 wildcard. Docs say tunnel forwards to loopback 8080. External firewall/NAT rules are unavailable.
- **Evidence:** `server/portal_server.py:292`; `server/app/src/juling/server.js` port 5177; live local listener snapshot at audit time: `0.0.0.0:8080`, `:::5177`. Cloudflare ingress config maps nine hostnames to `127.0.0.1:8080`.
- **Attack Scenario:** If host/router firewall permits direct connections, an attacker can bypass edge controls or reach an API upstream.
- **Impact:** Rate-limit/WAF bypass, direct origin attack surface, application DoS.
- **Recommended Fix:** Bind origin services to loopback unless LAN access is required; enforce host and perimeter firewall allowlists; verify direct origin connections are refused from an authorized external vantage point.
- **Fix Priority:** Before Stage 2 public testing.
- **Verification Method:** Review Windows Firewall and router/NAT rules; externally test only the exact known origin IP and required ports after authorization.

### SEC-003 — MEDIUM — HTTP security headers are incomplete

- **Asset:** Primary site responses
- **Description:** CSP and HSTS are absent on observed HTTPS pages. Other baseline headers are present.
- **Evidence:** HTTPS GETs on 2026-10-16 returned `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`; no CSP/HSTS.
- **Attack Scenario:** Missing policy leaves browser behavior less constrained if an injection bug is introduced; lack of HSTS permits downgrade before a browser has learned HTTPS policy.
- **Impact:** Increased impact of client-side injection and network downgrade risks.
- **Recommended Fix:** Address SEC-001 first; design a report-only CSP from actual inline/script/media/WebSocket needs, then enforce incrementally. Do not copy a generic strict policy.
- **Fix Priority:** Near-term after HTTPS enforcement.
- **Verification Method:** Inspect representative primary pages/API responses and CSP report-only telemetry, then validate the enforced policy against real site flows.

### SEC-004 — MEDIUM — Password policy permits 6-character passwords and knowledge-question reset

- **Asset:** Local Huiguan accounts
- **Description:** Registration, change and recovery accept passwords as short as six characters. Account recovery can also use a user-selected security-question answer.
- **Evidence:** `portal/huiguan/server_huiguan.py:1226-1244`, `server/account_security.py:86-95`; security answer setup at `server/account_security.py:78-87`.
- **Attack Scenario:** A weak password or guessable answer may be recovered/guessed; distributed attempts can avoid a per-account+IP combined limiter.
- **Impact:** Account takeover, potentially shared SSO access across subdomains.
- **Recommended Fix:** Raise minimum length (prefer passphrases; screen common/breached passwords); evaluate retiring knowledge-question recovery in favor of verified-email recovery; consider per-account and global/IP controls at the edge.
- **Fix Priority:** High within Stage 1 remediation.
- **Verification Method:** Review policy and perform only local tests with owned accounts after implementation.

### SEC-005 — MEDIUM — Cards OAuth API has broad CORS and wildcard bind

- **Asset:** Cards OAuth upstream, port 5174
- **Description:** JSON responses set `Access-Control-Allow-Origin: *`; service binds `0.0.0.0` when launched. The unified proxy uses localhost, but direct port reachability is unknown.
- **Evidence:** `server/app/src/cards/server.py:262-277`; proxy route in `server/portal_server.py:35-36, 211-217`.
- **Attack Scenario:** Direct network reachability could bypass edge controls; broad CORS may expose unauthenticated OAuth/session metadata to arbitrary origins where browser request conditions permit.
- **Impact:** Expanded API exposure and information disclosure; direct-port availability risk.
- **Recommended Fix:** Bind 5174 to loopback, remove wildcard CORS or use an exact allowlist, and verify OAuth state/session behavior.
- **Fix Priority:** High before any direct-origin exposure is possible.
- **Verification Method:** Local integration test plus firewall evidence; test CORS preflight with allowed and untrusted origins.

### SEC-006 — MEDIUM — Production source-map exposure is not established

- **Asset:** Candidate and active JS module bundles
- **Description:** Candidate release contains dependency source maps. Candidate is documented as unpublished; active production map exposure was not checked exhaustively.
- **Evidence:** `.releases/candidate/modules/slay/web_modules/*.map` exists; `README.md` says candidate output is not production. Public `/.git/config`, `/.env`, `/backup.zip` probes returned 404 on Huiguan.
- **Attack Scenario:** If maps are published, they can reveal original source, internal route names, comments and build structure (not necessarily secrets).
- **Impact:** Easier reconnaissance and accidental source/metadata disclosure.
- **Recommended Fix:** Ensure publish pipeline excludes public `.map` files or uploads maps only to private error monitoring; add a release artifact check.
- **Fix Priority:** Before next release.
- **Verification Method:** Inspect active release manifest and request only known map URLs after deployment.

### SEC-007 — LOW — Username/account enumeration signals remain

- **Asset:** Registration and security-question recovery endpoints
- **Description:** Registration identifies an already-registered username; security question lookup differentiates unknown/unconfigured names. Verified-email recovery is generic.
- **Evidence:** `portal/huiguan/server_huiguan.py:1240-1242`; `server/account_security.py:58-63`.
- **Attack Scenario:** An observer can confirm account names through repeated low-rate requests.
- **Impact:** Targeted phishing and credential stuffing become easier; no password is disclosed.
- **Recommended Fix:** Decide whether usernames are intended public identifiers; consider uniform responses where practical while preserving signup UX and existing account-recovery usability.
- **Fix Priority:** Backlog.
- **Verification Method:** Compare response status/body/timing for owned test identifiers in a local environment.

### SEC-008 — LOW/MEDIUM — Public media is retrievable and uploads retain original bytes

- **Asset:** Gallery images, character media, uploaded images
- **Description:** Public browser media can be copied; upload validation checks signatures and Pillow decoding but stores accepted bytes without re-encoding. Static media may carry `Access-Control-Allow-Origin: *`.
- **Evidence:** `server/base_static.py:83-91`; `portal/huiguan/server_huiguan.py:642-673`; public upload route `/assets/uploads/`.
- **Attack Scenario:** Automated clients can fetch public pages/images repeatedly; crafted image parser edge cases reach downstream viewers; original resolution may be exposed.
- **Impact:** Content harvesting, bandwidth/storage cost, privacy/licensing exposure; parser risk depends on consumers.
- **Recommended Fix:** Generate size-limited normalized public derivatives, keep originals private where justified, use edge bot/rate controls, monitor egress, and add watermark only where useful.
- **Fix Priority:** Plan with Gallery/content owners.
- **Verification Method:** Inspect active media dimensions/URLs and CDN controls; do not run bulk downloads.

## TOP 10 MUST FIX

1. Force HTTPS on every public hostname and verify no account flow remains on HTTP (SEC-001).
2. Set `Secure` on production authentication cookies regardless of proxy-header detection (SEC-001).
3. Review Windows Firewall/NAT and close direct ingress to 8080/5177; use loopback binds (SEC-002).
4. Remove wildcard bind and wildcard CORS from the Cards OAuth upstream (SEC-005).
5. Raise the six-character password minimum and review security-question recovery (SEC-004).
6. Add HSTS after HTTPS is correct across all subdomains (SEC-001/003).
7. Design CSP in report-only mode against actual application requirements (SEC-003).
8. Confirm active release output excludes public source maps (SEC-006).
9. Confirm backup/restore, log redaction, and account/admin security alerts (UNKNOWN operational controls).
10. Review public original image exposure and apply derivatives/edge controls where required (SEC-008).

## Next Stages

- **Stage 1:** Remediate Critical/High items; first prioritize HTTPS and direct-origin exposure validation.
- **Stage 2:** Owned-account login/session and endpoint-by-endpoint access-control tests in staging; test API authorization, CSRF and file handling with benign fixtures.
- **Stage 3:** Confirm Cloudflare WAF, bot/rate controls, cache policy, monitoring and alert routing.
- **Stage 4:** Add secret scanning, dependency review and safe security checks to CI.
- **Stage 5:** Deeper penetration testing only in an isolated test environment.

## Scope and Evidence Limits

Read-only repository/config review, a local listener snapshot, `npm audit`, DNS-over-HTTPS lookups and a small set of low-frequency HTTP requests were performed. No port scan, brute force, bulk fuzzing, malicious upload, production mutation, account login, source-origin bypass, or third-party scan was performed. The Git worktree was already dirty with unrelated edits/deletions; those were preserved. See `git status --short --branch` at audit start for that pre-existing state.
