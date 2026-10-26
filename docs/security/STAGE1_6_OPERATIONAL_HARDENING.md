# Stage 1.6 — Operational Hardening & Evidence Closure

Date: 2026-10-16 (Asia/Singapore)  
Scope: operational baseline and evidence closure only. No Stage 2 application security testing was started.

## Firewall Status

**Public Firewall: OFF — HIGH risk.** Domain profile is ON; Private and Public are OFF. Default policy is inbound Block / outbound Allow, but the Public profile is disabled while Ethernet, WLAN, and Meta are categorized Public. No firewall profile or rule was changed.

Status: **BLOCKED_BY_GPO / insufficient privilege for this run.** The current shell is not elevated (`BUILTIN\Administrators` is deny-only). `netsh advfirewall show allprofiles` reports `LocalFirewallRules: N/A (GPO-store only)`, while `Get-NetFirewallRule -PolicyStore ActiveStore` returns 585 enabled inbound Allow rules (177 include Public; 289 use Any). The available source evidence conflicts, so the profile policy authority is unresolved; no elevation or GPO bypass was attempted.

Confirmed Public inbound allowances include:

- `文件和打印机共享(受限)(SMB-In)`: System TCP 445, Public, remote address Any. This matches the active `System` `::445` listener.
- `e管家远程桌面服务`: `WinVNC.exe`, TCP and UDP, Public, any local port and remote address Any. That executable was not observed as a current listener, but its enabled rule is a broad future exposure.
- Other Public/Any app rules exist. They were not removed or altered because they belong to Windows and other installed software, not this project.

The browser-facing project services remain loopback-only. Firewall detail and full listener inventory are in [listener-baseline.md](listener-baseline.md) and `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.6/listeners.csv`.

## Listener Baseline

**The six expected project ports passed loopback checks:** 8080 Portal, 5174 OAuth, 5177 Juling, 5178 Balance, 4173 Softie, and 8765 the existing Python static server (`--directory outputs`). Each listened on `127.0.0.1`.

Additional findings:

- `::5192`, PID 2156 `python.exe`, runs `python -m http.server 5192 --directory portal/huiguan`. It is a project development static server with no explicit bind; no LAN requirement was found. It remains running to preserve the existing session. HIGH while the Public firewall is off.
- Mihomo PID 48712 listens on `::53` (TCP/UDP DNS) and `::7897` (TCP/UDP proxy). Whether LAN access is needed is UNKNOWN. HIGH exposure until the bind/firewall posture is reviewed.
- Windows `System` exposes TCP 445 on `::` and TCP 139 on the LAN/virtual interfaces. RPC/System services also bind wildcard addresses, including TCP 135, 5040, and dynamic RPC ports. No unknown service was stopped.
- Inventory: 70 TCP LISTEN rows and 92 UDP bound endpoints. Windows provides no UDP LISTEN state, so the UDP rows do not alone prove remote reachability. Full rows include PORT, PROTOCOL, PID, PROCESS, BIND, OWNER, EXPECTED, RISK, and classification in `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.6/listeners.csv`.

## Backup

**Off-host backup = UNKNOWN.** The known snapshot `E:\External Projects\Iridescently Operations\backups/security-pre-stage1.5-20261016-1700/` remains on the same workstation, approximately 581,843,391 bytes across 3,056 files. `C:\Users\hp\OneDrive` exists; the local ACL grants user/SYSTEM/Administrators full control and `CodexSandboxUsers` read/execute. The OneDrive sync process was not running and cloud account sharing/sync status could not be verified. No database was uploaded to cloud storage.

## Restore Drill

**RESTORE TESTED — 2026-10-16, local snapshot only.** An isolated restore copied 8 files / 1,362,372 bytes: Huiguan, Cards, and Juling SQLite databases; three upload samples; `production_record.json`; and `server/base_static.py` from the production snapshot. Source/copy SHA-256 values matched. All three `PRAGMA integrity_check` results were `ok`; expected tables were present (`users` / session and account tables, Cards `users`, Juling `save_state`); the production release record parsed; required paths existed. No service connected to production write paths.

The temporary copies remain under `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/restore-drill` for review and are excluded through local `.git/info/exclude`. A recursive cleanup attempt was rejected by the automatic safety review, so the copy was retained and is called out here rather than claimed deleted. Hash/table evidence is in `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.6/restore-drill-evidence.json`.

## CSP

The production policy remains `Content-Security-Policy-Report-Only`; no header or allowlist was changed. Playwright/Chrome observed 5 distinct page/directive/resource combinations (8 events across repeated Huiguan/Login and Cards loads): three shared apex assets requested from subdomains (the logo, `shared-chrome-v2.js`, and `site-language.js`). They are classified **REAL REQUIRED RESOURCE** and show that the current subdomain wildcard does not cover the apex host. The Spirit WebSocket page produced no CSP violation in the clean, non-polling observation.

Spirit WebSocket connected to `wss://spirit.iridescently.xyz/app/modules/softie/api/spirit-room/ws`, received `joined` and `snapshot` frames, then closed. A diagnostic using Playwright `wait_for_function` produced 472 synthetic `/games/eval` events; a clean run without evaluator polling produced zero. Those are classified **UNUSED / NOISE**, excluded from application findings. No `unsafe-eval` or broad `*` source was added. The per-page evidence and migration note are in [csp-observation-stage1.6.md](csp-observation-stage1.6.md).

## Cloudflare

Proven locally: `C:\.cloudflared\config.yml` has all nine production hostnames mapped to `http://127.0.0.1:8080`; `cloudflared tunnel info main` and Website Manager smoke reported one connected connector/four edge connections. Public HTTP behavior was also checked directly below.

Cloudflare dashboard/API settings remain **UNKNOWN**: SSL/TLS mode, Always Use HTTPS / Redirect Rule configuration, WAF, Rate Limiting, Bot Management, and DNS proxy state. No Cloudflare API token was present in the current environment variable set; no dashboard change was made.

The `www` HTTPS edge 301 to the apex still has no HSTS header. `CLOUDFLARE CONFIG UNKNOWN`; its canonical redirect was left unchanged. No `includeSubDomains` or `preload` was deployed.

### Production hostname evidence

| Hostname | HTTP result | HTTPS result | HTTPS HSTS |
|---|---|---|---|
| `iridescently.xyz` | HTTP/1.1 308 Permanent Redirect → https://iridescently.xyz/ | HTTP/1.1 200 OK → — | max-age=86400 |
| `www.iridescently.xyz` | HTTP/1.1 301 Moved Permanently → https://iridescently.xyz/ | HTTP/1.1 301 Moved Permanently → https://iridescently.xyz/ | MISSING |
| `huiguan.iridescently.xyz` | HTTP/1.1 308 Permanent Redirect → https://huiguan.iridescently.xyz/ | HTTP/1.1 200 OK → — | max-age=86400 |
| `oc.iridescently.xyz` | HTTP/1.1 308 Permanent Redirect → https://oc.iridescently.xyz/ | HTTP/1.1 200 OK → — | max-age=86400 |
| `spirit.iridescently.xyz` | HTTP/1.1 308 Permanent Redirect → https://spirit.iridescently.xyz/ | HTTP/1.1 200 OK → — | max-age=86400 |
| `zszm.iridescently.xyz` | HTTP/1.1 308 Permanent Redirect → https://zszm.iridescently.xyz/ | HTTP/1.1 200 OK → — | max-age=86400 |
| `game.iridescently.xyz` | HTTP/1.1 308 Permanent Redirect → https://game.iridescently.xyz/ | HTTP/1.1 308 Permanent Redirect → https://zszm.iridescently.xyz/#home | max-age=86400 |
| `juling.iridescently.xyz` | HTTP/1.1 308 Permanent Redirect → https://juling.iridescently.xyz/ | HTTP/1.1 308 Permanent Redirect → https://zszm.iridescently.xyz/app/shell/m/juling | max-age=86400 |
| `lingjing.iridescently.xyz` | HTTP/1.1 308 Permanent Redirect → https://lingjing.iridescently.xyz/ | HTTP/1.1 308 Permanent Redirect → https://zszm.iridescently.xyz/#management | max-age=86400 |

`www` is the only host whose HTTPS response omitted HSTS. The other eight responses carried `max-age=86400`.

## Logging

A bounded sample of the newest five process logs (up to their last 200 lines each) found no Authorization, Cookie, session ID, password, reset/verification token, or full email-query field names. This is not a full-history guarantee. The Portal, Tunnel, OAuth, Juling, and Softie process logs exist; retention/rotation, access controls, and a centralized security log are UNKNOWN.

`ALERTING NOT IMPLEMENTED`. Event-by-event status for login failures, rate limits, password reset request/success, email change, admin/editor actions, 401/403 bursts, service crashes, and Tunnel disconnection is recorded in [logging-baseline.md](logging-baseline.md); dedicated security event collection was not verified.

## Remaining Risks

- **HIGH:** Public Firewall is OFF on active Public networks; Public SMB 445 allow rule is present and a Public WinVNC all-port allow rule exists.
- **HIGH:** `::5192` project static server and Mihomo `::53` / `::7897` are wildcard listeners with no established LAN need.
- **HIGH:** No verified off-host backup or retention; the available snapshot is same-device only.
- **MEDIUM:** Security-event collection and alerting are not implemented/verified; retention and rotation are UNKNOWN.
- **MEDIUM:** Windows RPC/SMB and application wildcard UDP endpoints remain; many third-party owners/purposes are UNKNOWN.
- **LOW:** Cloudflare Tunnel binary `2026.7.3` reported that a newer release is recommended; no upgrade was attempted in this stage.
- **UNKNOWN:** Cloudflare edge policy settings and the `www` HSTS response source; backup sync/remote access state.

## Verification Evidence

- Website Manager `--smoke-test`: exit 0; 5 deployed services healthy (Portal, OAuth, Balance, Juling, Softie), 0 errors, optional `psyche` undeployed; Tunnel connected with four edge connections.
- Public host HTTP/HTTPS checks: all nine hosts returned HTTPS redirects or HTTPS content as shown above; `www` canonicalized to apex; no redirect loop observed.
- Cards `/api/user`: HTTP 200.
- Juling `/app/modules/juling/api/state`: HTTP 200.
- Spirit WebSocket: connected; `joined` and `snapshot` frames received; socket closed.
- Listener recheck after smoke test: 8080/5174/5177/5178/4173/8765 still `127.0.0.1`; 5192 and the listed system/Mihomo binds remain.
- No user account, password, or persistent user record was created. The only interactive browser state was a temporary anonymous Spirit test room.

## Git Change Protection

- Reversible Stage 1 / Stage 1.5 security patch: [`file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1-stage1.5.patch`](file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1-stage1.5.patch), 96213 bytes, SHA-256 `7EAE3D5754D638D7CBCCBF5066EBCB04C2CA3BAEE474E416178305F441F5630A`. It contains security-related hunks and the 11 existing Stage 1/1.5 security Markdown files. The mixed `server/portal_server.py` patch retains the security redirect/listener hunks and excludes the unrelated `/ozmtree` route. `git apply --cached --check` passed; no files were staged by that check.
- Recorded working-tree snapshots: `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.6/git-status-baseline.txt` and `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.6/git-diff-stat-baseline.txt`; final snapshots are `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.6/git-status-final.txt` and `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.6/git-diff-stat-final.txt`. Baseline branch was `master...origin/master [ahead 10]`; tracked diff statistic at baseline was 145 files, 146 insertions, 359 deletions. Final snapshot recorded 158 status lines; the tracked diff is 147 files, 289 insertions, 363 deletions. These totals include unrelated/external workspace changes and exclude untracked files such as `docs/security/`.
- Pre-existing unrelated dirty work includes Huiguan redesign files, shared Cards/LXH asset deletions and additions, Cards/UI changes, `New project/six-system-arena` review notes, and existing backup/source files. Additional paths absent from the baseline snapshot appeared by the final snapshot: `portal/huiguan/account.html`, `portal/huiguan/avatar-cropper.css`, `portal/huiguan/avatar-cropper.js`, `portal/huiguan/image-upload.js`, and `server/account_profile.py`. Attribution is unknown; they were left untouched. No application source or production config was changed by Stage 1.6. The final Git status and diff-stat snapshots are also saved in `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.6` for comparison.
- No commit was created. The Stage 1 / 1.5 patch remains an uncommitted recovery artifact.

## Stage 2 Readiness

**NOT READY**. The Public firewall is disabled while the workstation is on Public networks, Public SMB/remote-control allow rules are present, wildcard development/proxy listeners remain, and no off-host backup is proven. Complete those infrastructure controls and close the `www` HSTS issue before treating the operational baseline as closed.

Stage 1.6 is complete to the extent permitted by the current host policy and available evidence. **Stop here; Stage 2 was not started.**

