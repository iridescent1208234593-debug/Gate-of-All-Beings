# Stage 1 — Security Baseline Remediation Report

**Date:** 2026-10-16 (Asia/Singapore)  
**Scope:** Only evidence-backed Stage 1 baseline items. No penetration testing, broad scanning, fuzzing, production account mutation, production restart, deployment, or firewall-rule changes were performed.

## Summary

Source changes and isolated local checks are complete. The live production environment was not restarted or deployed because the checkout already contained unrelated dirty work and the running services are user-managed. Public checks therefore show the current production behavior, not the new source fallback. The most important work remains partially fixed until the production change is released and every hostname meets the requested redirect behavior.

## Fixed

| Finding | Status | Evidence |
| --- | --- | --- |
| SEC-001 — HTTP, cookies, HSTS | **PARTIALLY FIXED** | The unified entry source now redirects HTTP for the nine named production hosts unless the peer is loopback and `X-Forwarded-Proto` is exactly `https`; it does not trust that header from a remote peer. Production `session` and `hx_sso` setters use explicit environment policy and always set `Secure; HttpOnly; SameSite=Lax`; logout clearing also sets these attributes. Isolated source test passed. Public HTTP still returns 200 on five hosts; no Cloudflare edge rule was evidenced. HSTS is deferred. |
| SEC-002 — Wildcard listeners / firewall | **PARTIALLY FIXED** | Source now binds portal `8080`, Cards OAuth `5174`, and Juling `5177` to loopback. The running portal still listens on `0.0.0.0:8080`; Juling still listens on `0.0.0.0:5177` and `[::]:5177`. Windows Firewall profiles and read-only rule checks are recorded below. No firewall rule was altered. |
| SEC-003 — Security headers / CSP | **PARTIALLY FIXED** | Shared responses now include the initial `Content-Security-Policy-Report-Only` policy; isolated response check passed. The policy includes observed inline requirements, known CDN and owned-subdomain origins, WebSocket, `blob:` and `data:` sources. No CSP collector is configured and production has not been redeployed. HSTS remains deferred. |
| SEC-004 — Passwords / security-question recovery | **PARTIALLY FIXED** | Registration, password change, security-question reset, and verified-email reset now enforce 12–128 characters without mechanical complexity rules. Existing login/hash verification paths were left intact. Isolated registration, password-change, and legacy-login checks passed. Legacy question recovery is deliberately retained; the aggregate snapshot and migration plan are in `security-question-migration.md`. |
| SEC-005 — Cards OAuth CORS / listener | **PARTIALLY FIXED** | Cards OAuth no longer emits `Access-Control-Allow-Origin: *`; its listener source is loopback. Cards frontend calls use same-origin `/api` paths and the Vite proxy targets `127.0.0.1:5174`. An isolated OAuth process returned `/api/user` without `Access-Control-Allow-Origin` when sent an untrusted `Origin`; runtime port 5174 was not listening in production during the smoke test. |
| SEC-006 — Production source maps | **FIXED** | The active local `.releases/production/site` artifact contained 0 `.map` files across 38 HTML files. Candidate/development source maps were not deleted. This confirms the inspected artifact only; it does not prove every CDN cache or alternate deployment contains the same bytes. |

## Verification Evidence

### Public hostname requests

Low-frequency `GET /` and `HEAD /` checks were run on 2026-10-16 with automatic redirects disabled. They returned the same status/destination for each host. The HTTPS column is the first HTTPS response. A redirect to another owned hostname is shown explicitly and does not count as a same-host redirect.

| Hostname | HTTP result | HTTPS result | HSTS on HTTPS |
| --- | --- | --- | --- |
| `iridescently.xyz` | **200** — fails required redirect | 200 | Absent |
| `www.iridescently.xyz` | 301 → `https://iridescently.xyz/` | 301 → `https://iridescently.xyz/` | Absent on canonical response |
| `huiguan.iridescently.xyz` | **200** — fails required redirect | 200 | Absent |
| `oc.iridescently.xyz` | **200** — fails required redirect | 200 | Absent |
| `spirit.iridescently.xyz` | **200** — fails required redirect | 200 | Absent |
| `zszm.iridescently.xyz` | **200** — fails required redirect | 200 | Absent |
| `game.iridescently.xyz` | 308 → `https://zszm.iridescently.xyz/#home` | 308 → same canonical destination | Absent |
| `juling.iridescently.xyz` | 308 → `https://zszm.iridescently.xyz/app/shell/m/juling` | 308 → same canonical destination | Absent |
| `lingjing.iridescently.xyz` | 308 → `https://zszm.iridescently.xyz/#management` | 308 → same canonical destination | Absent |

These public results do not satisfy the requested per-host `http://host/` → `https://same-host/` rule for all nine hosts. Local Cloudflare Tunnel configuration proves origin routing to `127.0.0.1:8080`; no Cloudflare Edge Redirect Rule configuration was available in the repository or connected dashboard evidence. The new application fallback is source-only until a controlled production release.

### Cookie and isolated authentication checks

An isolated temporary database and local portal process were used; no production account data was read or modified.

| Check | Result |
| --- | --- |
| HTTP request to a named production Host with `X-Forwarded-Proto: http` | 308 to the same-host HTTPS URL |
| Production `session` and `hx_sso` Set-Cookie on registration | `Secure; HttpOnly; SameSite=Lax` on both |
| Logout cookie clearing | Both auth cookies cleared with `Secure; HttpOnly; SameSite=Lax` |
| Other authentication cookie source | Activation Core admin `token`/cleared cookies already set `HttpOnly`, `Secure` when `NODE_ENV=production`, and `SameSite=Strict` in production; no change was needed |
| New registration with 6-character password | Rejected with 400 |
| New registration with 12+ character passphrase | Accepted in temporary database |
| Password change with short password / 12+ passphrase | Short password rejected; long passphrase accepted in temporary database |
| Existing short-password login compatibility | A temporary legacy 6-character account logged in successfully |
| Verified-email status endpoint after local registration | HTTP 200 |
| CSP response header | Report-Only header present on isolated portal HTML response |

This validates the local source path. It does not claim that live production cookies or headers have changed.

### Listener and Windows Defender Firewall audit

Listener snapshot (`netstat -ano` / `Get-NetTCPConnection`) and read-only `netsh advfirewall show allprofiles` / rule text review:

| Port | Process | Current bind address | Firewall rule evidence | Profile state | Expected |
| ---: | --- | --- | --- | --- | --- |
| 8080 | `python.exe` PID 48368 | `0.0.0.0` | No matching port-specific allow rule found in the local `netsh` output; local firewall-rule store reports GPO-managed/N/A | Domain ON; Private OFF; Public OFF | `127.0.0.1` only; Cloudflare Tunnel origin |
| 5174 | None listening | — | No matching port-specific allow rule observed | Same profiles | `127.0.0.1` only when OAuth proxy runs |
| 5177 | `node.exe` PID 46860 | `0.0.0.0` and `[::]` | No matching port-specific allow rule found in local `netsh` output; GPO-managed/N/A caveat | Same profiles | `127.0.0.1` only; internal proxy |
| 5178 | `node.exe` PID 46620 (Cards preview) | `127.0.0.1` | No matching port-specific allow rule observed | Same profiles | Loopback only |
| 4173 | `node.exe` PID 6604 (Softie preview) | `127.0.0.1` | No matching port-specific allow rule observed | Same profiles | Loopback only |
| 8765 | `python.exe` PID 50992 | `127.0.0.1` | No matching port-specific allow rule observed | Same profiles | Loopback only; identify owner before changing |
| 5173 | None listening | — | No matching port-specific allow rule observed | Same profiles | Loopback only if a development server is started |
| 8000, 8088, 8089, 8090 | None listening | — | No matching port-specific allow rule observed | Same profiles | Closed unless a documented service is started |

Domain profile policy is `BlockInbound,AllowOutbound`; Private and Public profiles are **OFF**, so Windows Firewall cannot be relied on to enforce their listed inbound policy on those profiles. Rule visibility is incomplete because local rules are reported as GPO-managed/N/A. No rule was removed or modified. Router/NAT and external ingress remain unknown.

### CORS

The Cards app uses same-origin `/api/sso-user` and `/api/card-balance` paths; Vite proxies the OAuth API to `127.0.0.1:5174`. An isolated OAuth process returned `/api/user` without `Access-Control-Allow-Origin` when sent an untrusted `Origin`. Port 5174 was not listening during the operational smoke test, so no live production preflight was attempted.

### Other artifact and content checks

- Active local production snapshot `.releases/production/site`: 38 HTML files and 0 `.map` files. No source map was deleted from development/candidate material.
- Gallery/media is publicly delivered browser content. The inspected architecture did not establish whether every Gallery item has a lower-resolution public derivative or whether highest-resolution originals are served directly. No bulk conversion was run. Proposed private-original → derivative pipeline is documented here as a follow-up design, not an implemented migration.
- Local read-only database snapshot: 207 local accounts, 1 configured security question, 1 verified-email account, 0 overlap. No recovery answer was read or printed. The count is not asserted to be current production data.

## Regression Tests

| Test | Result |
| --- | --- |
| Python compile check for portal, shared static handler, Huiguan, recovery/security modules, and Cards OAuth | Passed |
| Node syntax check for Juling service | Passed |
| Isolated portal HTTP fallback, Report-Only CSP, registration/change bounds, legacy short-password login, auth cookies, email status, logout | Passed |
| Isolated Cards OAuth `/api/user` and untrusted-Origin CORS check | Passed; no wildcard or reflected `Access-Control-Allow-Origin` header |
| Softie/WebSocket package suite (`npm test`) | 91 passed, 0 failed |
| Cards backend suite (`npm run test:backend`) | 4 passed, 0 failed |
| Website Manager read-only smoke test | Exit 0; 4 services returned HTTP 200; OAuth 5174 not listening; optional `psyche` not deployed; no process started |
| Cloudflare Tunnel status (`cloudflared tunnel info main`) | One connector with four active edge connections |
| Nine public HTTP/HTTPS hostname checks | Completed; detailed outcomes above; five hosts still serve HTTP 200 |

No real account was used. Gallery and public page verification consisted of the operational smoke result and low-frequency host checks; a full interactive browser login/Gallery workflow was not exercised. The OAuth process was stopped, so no OAuth login flow was attempted. No production WebSocket/API was mutated.

## Remaining Unknowns

- Cloudflare Edge Redirect Rules, SSL/TLS mode, WAF, Bot Management, and Rate Limit configuration: **UNKNOWN**. Tunnel ingress alone does not prove edge policy.
- Origin firewall, router/NAT rules, and external reachability of wildcard listeners: **UNKNOWN**. Windows Private/Public firewall profiles are off; do not infer perimeter protection.
- Backup coverage/location, restore method for databases/uploads/Gallery originals, and last restore test: **UNKNOWN**.
- Production application/security log location, redaction, retention, alert routing, and log integrity: **UNKNOWN**.
- Current production deployment state of these uncommitted source changes: **NOT DEPLOYED / UNKNOWN**.
- Gallery highest-resolution original versus derivative exposure by content item: **UNKNOWN**.
- CSP violation collection and representative browser console findings: **UNKNOWN**; only local Report-Only header presence was verified.

See [`security-question-migration.md`](security-question-migration.md), [`csp-migration-plan.md`](csp-migration-plan.md), and [`operations-security.md`](operations-security.md) for the detailed plans and baseline notes.

## Git Worktree

Security-related edits in this stage are limited to `server/portal_server.py`, `server/base_static.py`, `portal/huiguan/server_huiguan.py`, `portal/huiguan/index.html`, `portal/huiguan/security.html`, `server/account_recovery.py`, `server/account_security.py`, `server/app/src/cards/server.py`, `server/app/src/juling/server.js`, `server/app/src/management/index.html`, `E:\External Projects\Iridescently Operations\网站恢复/website-manager.py`, and the Stage 1 security documents. `server/portal_server.py` also contains a pre-existing unrelated `/ozmtree` route; it was preserved. Other pre-existing dirty changes and deletions shown by `git status` were not reset, cleaned, staged, committed, or overwritten.

## Next Recommended Stage

Complete a controlled production release of the loopback binds, proxy trust behavior, cookie policy, password limits, CORS removal, and Report-Only header; configure and evidence Cloudflare HTTPS redirects; rerun the nine exact HTTP checks and verify production auth cookies. Resolve the firewall-profile/GPO ownership and verify backups/restore. Do not proceed to Stage 2 penetration testing in this report.
