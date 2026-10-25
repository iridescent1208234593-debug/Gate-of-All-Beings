# Stage 1.5 — Controlled Production Security Deployment

**Date:** 2026-10-16 (Asia/Singapore)  
**Scope:** Deploy and verify only the evidence-backed Stage 1 security changes. No penetration testing, broad scanning, fuzzing, firewall changes, or Stage 2 work was performed.

## Fixed

| Finding | Status | Evidence |
| --- | --- | --- |
| SEC-001 — HTTP, auth cookies, HSTS | **PARTIALLY FIXED** | All nine HTTP host checks now return 301/308 to HTTPS. `www` is canonically redirected by the edge to `https://iridescently.xyz/`, not preserved as `www`; Cloudflare rule configuration is UNKNOWN. Production login/registration returned `session` and `hx_sso` cookies with `Secure; HttpOnly; SameSite=Lax`. Origin HSTS `max-age=86400` is deployed on eight checked host responses; the `www` edge redirect response omitted HSTS. No `includeSubDomains` or `preload` is set. |
| SEC-002 — Wildcard listeners / firewall | **PARTIALLY FIXED** | 8080, 5174, and 5177 now bind only to `127.0.0.1`; 5178, 4173, and 8765 were also loopback-bound. The active Windows network profiles were Public while Windows Firewall Public and Private profiles were OFF. Firewall rule ownership is GPO-managed and could not be fully inspected. This is a HIGH PRIORITY gap; rules/profiles were not changed. |
| SEC-003 — CSP / HSTS headers | **PARTIALLY FIXED** | Production returns `Content-Security-Policy-Report-Only`; HSTS is `max-age=86400`. Tabbit's real-browser observation timed out before returning CSP events or console output, so CSP findings remain inconclusive. Keep Report-Only. |
| SEC-004 — Password policy / recovery | **PARTIALLY FIXED** | Production rejected a six-character registration password (400), accepted a 33-character passphrase, allowed login/logout, and returned the authenticated email-status response. `session` and `hx_sso` cookie flags were verified. Test account and its sessions were removed. Existing security-question recovery remains for legacy users; the migration plan is documented. The available local snapshot had 207 accounts, one configured question, one verified email, and no overlap; it is not a current production account count. |
| SEC-005 — Cards OAuth CORS / listener | **FIXED** | OAuth 5174 is listening on `127.0.0.1`; `/api/user` responds 200. A public request with `Origin: https://evil.example` returned no `Access-Control-Allow-Origin`. Same-origin Cards and balance APIs returned 200. |
| SEC-006 — Production source maps | **FIXED** | The active `.releases/production/site` contains 38 HTML files and zero `*.map` files. Development/candidate source maps were not removed. |

## Verification Evidence

Public low-frequency requests used automatic-redirect following disabled. `HTTPS` records are the first response to `/`; the three legacy module hosts retain their existing business destinations.

| Hostname | HTTP result | HTTPS result | HSTS |
| --- | --- | --- | --- |
| `iridescently.xyz` | 308 → `https://iridescently.xyz/` | 200 | `max-age=86400` |
| `www.iridescently.xyz` | 301 → `https://iridescently.xyz/` | 301 → `https://iridescently.xyz/` | Missing on edge 301 |
| `huiguan.iridescently.xyz` | 308 → same host HTTPS | 200 | `max-age=86400` |
| `oc.iridescently.xyz` | 308 → same host HTTPS | 200 | `max-age=86400` |
| `spirit.iridescently.xyz` | 308 → same host HTTPS | 200 | `max-age=86400` |
| `zszm.iridescently.xyz` | 308 → same host HTTPS | 200 | `max-age=86400` |
| `game.iridescently.xyz` | 308 → same host HTTPS | 308 → `https://zszm.iridescently.xyz/#home` | `max-age=86400` |
| `juling.iridescently.xyz` | 308 → same host HTTPS | 308 → `https://zszm.iridescently.xyz/app/shell/m/juling` | `max-age=86400` |
| `lingjing.iridescently.xyz` | 308 → same host HTTPS | 308 → `https://zszm.iridescently.xyz/#management` | `max-age=86400` |

| Check | Result |
| --- | --- |
| Origin fallback | Production Host without forwarded HTTPS returned 308. A loopback request with `X-Forwarded-Proto: https` returned 200, so the Tunnel's HTTPS origin path avoids a redirect loop. The app trusts this header only from a loopback peer. |
| Auth cookies | Actual production registration and login responses: `session Secure=True HttpOnly=True SameSite=Lax`; `hx_sso Secure=True HttpOnly=True SameSite=Lax`. Logout completed; a following `/api/user` response had no authenticated user. The temporary account and its sessions were deleted. |
| Password UI | Deployed Huiguan registration/login field now accepts up to 128 characters and states the 12-character new-registration minimum. Password change/reset fields use `minlength=12 maxlength=128`; Management login accepts up to 128 characters. Existing layout was retained. |
| Listener | `8080 python`, `5174 python`, `5177 node`, `5178 node`, `4173 node`, `8765 python`: every listener bound to `127.0.0.1`. Tunnel ingress remains `127.0.0.1:8080`. |
| CORS | Public Cards `/api/user` with an untrusted Origin returned 200 without `Access-Control-Allow-Origin`; same-origin API calls succeeded. |
| CSP | `Content-Security-Policy-Report-Only` was observed on apex, Huiguan, and ZSZM responses. Full browser violation evidence is in `csp-observation-20261016.md` and is inconclusive. |
| Firewall | Domain profile ON; Private and Public OFF. Active Ethernet, WLAN, and Meta profiles were Public. Local firewall rules report `N/A (GPO-store only)`; no rule was changed. See `operations-security.md`. |
| Backup | `E:\External Projects\Iridescently Operations\backups/security-pre-stage1.5-20261016-1700/`: 3,056 files, 581,843,391 bytes, SHA-256 manifest. Huiguan, Cards, and Juling SQLite snapshots passed `PRAGMA quick_check`. Same-device only; restore not tested. |
| Cloudflare Tunnel | One connector with four edge connections in the Website Manager smoke check; local ingress to port 8080 responded. Edge redirect/WAF configuration was not inspected. |

## Regression Tests

- Public GET/HEAD checks for all nine production hostnames: HTTP redirects observed; HTTPS returned 200 or the existing canonical 301/308 destinations shown above.
- Portal root, Huiguan, OC, Spirit, ZSZM, Gallery `scripts/gallery.js`, Cards `/api/user`, card-balance API, Juling `/api/state`, and email-status API returned expected responses (200 when authenticated; 401 without auth for email status).
- A disposable production test account: six-character registration rejected; long-passphrase registration and login succeeded; auth cookies verified; logout invalidated the session; account and session rows removed.
- Production Spirit WebSocket: 101 handshake and successful join to a temporary room; socket closed after verification.
- Untrusted Cards Origin check returned no CORS allow header.
- Website Manager smoke test exited 0: portal, OAuth, balance, Juling, Softie, and Tunnel healthy; optional `psyche` remains undeployed.
- Active production artifact source-map count: zero.
- CSP browser-console/event capture did **not** complete. No full interactive browser walkthrough, email delivery/reset, OAuth provider login, or existing-user account was used.

## Remaining Unknowns

- Cloudflare Edge Redirect Rules, SSL/TLS mode, WAF, Bot Management, and Rate Limiting configuration. Public redirect behavior is observed, but configuration is not evidenced from the repository or Tunnel config.
- Origin firewall, router/NAT, and external network policy. Windows Public/Private firewall profiles are OFF on Public-classified network adapters; local rules are GPO-managed. HIGH PRIORITY.
- Backup off-host copy, schedule, retention, owner, and restore exercise.
- Production security-log retention/redaction, monitoring, and alert delivery.
- CSP browser violations across Gallery, login/recovery, Cards, Spirit/WebSocket, and media-heavy pages.
- Which Gallery assets are private originals versus public derivatives/thumbnails, and whether highest-resolution originals are directly served.
- Current production aggregate for security-question and verified-email recovery adoption; the existing count is from a local snapshot only.
- The `www` edge redirect response currently omits HSTS. Its Cloudflare configuration is UNKNOWN.

## Deployment and Git State

Production was published with the atomic `npm run publish:site` flow from a candidate derived from the backed-up active production snapshot. Only the Stage 1 security backend, the 12–128 password form bounds/hints, and the one-day HSTS header were overlaid. The unrelated `/ozmtree` working-tree change was not copied into production. The original candidate directory and manifest were restored afterward.

Website Manager launch configuration restarted portal, OAuth, and Juling. OAuth's Manager entry now sets `PYTHONUTF8=1` and explicit production mode; this was necessary because its first Manager launch exited on a cp1252 startup-log encoding error. All three target listeners are loopback-only.

Security changes remain uncommitted. Pre-existing unrelated dirty files/deletions (including Huiguan redesign files, Cards UI, shared assets, and six-system-arena docs) were left untouched. No reset, clean, staging, commit, or broad restore was run. The working source `server/portal_server.py` contains an unrelated `/ozmtree` route; it was excluded from the production overlay. The original `.releases/candidate/site` and its manifest were restored; this run's temporary candidate copy and helper scripts remain under untracked `work/`. See `git status` and `git diff` for the current separation.

## Next Recommended Stage

Observe `max-age=86400` behavior before considering a separate `max-age=31536000; includeSubDomains` deployment. Resolve the `www` HSTS edge response and HIGH PRIORITY firewall gap, collect representative CSP browser evidence, and test backup restore before expanding security policy. Do not add `preload`. Stop here; do not enter Stage 2 penetration testing.
