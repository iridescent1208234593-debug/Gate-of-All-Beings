# Attack Surface Inventory

**Snapshot:** 2026-10-16. This inventory combines checked-in documentation/routing, the local Cloudflare Tunnel ingress config (host/service lines only), a local TCP listener snapshot, and low-frequency public DNS/HTTP observations. “Public” means intended through Cloudflare; it does not prove direct origin reachability.

## Domain and Service Inventory

| Domain / host | Service / purpose | Port / protocol | Public / private | Source → destination | Auth | Status / evidence |
|---|---|---|---|---|---|---|
| `iridescently.xyz` | Main Gallery/homepage, shared API and shell | Edge 80/443 → tunnel → 8080 HTTP | Public | Cloudflare → `127.0.0.1:8080` | Public pages; SSO for account actions | Tunnel ingress + `server/portal_server.py`; HTTP returned 200, HTTPS 200 |
| `www.iridescently.xyz` | Main site alias | 80/443 → 8080 | Public | Cloudflare → `127.0.0.1:8080` | Same as main | Ingress and DNS observed; direct HTTP behavior not separately checked |
| `huiguan.iridescently.xyz` | Account service, profiles, character Gallery, uploads | 80/443 → 8080 → Huiguan handler | Public | Cloudflare → `127.0.0.1:8080` | Account APIs vary; admin/editor role checks | HTTPS root and `/api/sso-user` 200; `/.git/config`, `/.env`, `/backup.zip` 404 |
| `oc.iridescently.xyz` | OC/reference site | 80/443 → 8080 | Public | Cloudflare → `127.0.0.1:8080` | Public; SSO status read | HTTPS root 200; `portal/oc` source |
| `zszm.iridescently.xyz` | 众生之门, module shell and APIs | 80/443 → 8080 | Public | Cloudflare → dispatcher; Cards API defaults to 5174; card-balance API to 5178 | OAuth/session for account APIs; static modules public | Ingress + route source; HTTPS root 200 |
| `spirit.iridescently.xyz` | Public spirit interaction and WebSocket | 80/443 → 8080; room upstream 4173 | Public | Cloudflare → dispatcher → localhost 4173 for room/API | Public room; account save requires Huiguan session | Ingress + `server/portal_server.py`; public DNS A/AAAA |
| `game.iridescently.xyz` | Legacy alias → 众生之门 | 80/443 → 8080 | Public redirect | Cloudflare → `127.0.0.1:8080` → 308 to zszm | N/A | Ingress + `route()`; DNS A/AAAA |
| `juling.iridescently.xyz` | Legacy alias / Juling API | 80/443 → 8080 → 5177 for `/api/*` | Public | Cloudflare → dispatcher → localhost 5177 | API-specific; source auth not fully dynamically verified | Ingress + `route()`; DNS A/AAAA |
| `lingjing.iridescently.xyz` | Legacy alias → management | 80/443 → 8080 | Public redirect | Cloudflare → `127.0.0.1:8080` → 308 | N/A | Ingress + `route()`; DNS A/AAAA |
| `psyche.iridescently.xyz` | Listed historically; no current ingress mapping found | DNS 80/443 at edge; backend unknown | Unknown | DNS to Cloudflare; absent from local ingress and current route alias list | Unknown | DoH A/AAAA; README/older ops docs mention it; actual route unknown |
| `psy.iridescently.xyz` | Listed historically; no current ingress mapping found | DNS 80/443 at edge; backend unknown | Unknown | DNS to Cloudflare; absent from current tunnel ingress | Unknown | DoH A/AAAA; account CORS allowlist includes it |
| `feather.iridescently.xyz` | Historical/unknown service | DNS 80/443 at edge; backend unknown | Unknown | DNS to Cloudflare; absent from current ingress | Unknown | DoH A/AAAA only |
| `assets.iridescently.xyz` | Potential asset/CDN host | DNS 80/443 at edge; backend unknown | Unknown | DNS to Cloudflare; absent from current ingress | Unknown | DoH A/AAAA; docs describe as possible CDN base, not proof of active object storage |
| `sso.umrc.cn` | External OAuth/OIDC identity provider | HTTPS | Third party | Browser/backend OAuth flows | Provider account | Dependency only; explicitly out of scan scope |

## Port Inventory

| Port | Service | Binding observed / configured | Classification | Action / status |
|---|---|---|---|---|
| 80 | Cloudflare public HTTP | Edge | EXPECTED edge; currently serves HTTP 200 | Redirect to HTTPS required |
| 443 | Cloudflare public HTTPS | Edge | EXPECTED | Active on primary domains |
| 8080 | Python unified dispatcher | Local snapshot `0.0.0.0`; tunnel target `127.0.0.1` | EXPECTED internal-only; **external reachability UNKNOWN** | Bind loopback or prove host/network firewall blocks direct traffic |
| 8088 | Optional main single-site server | Not listening in snapshot | SHOULD NOT be public | Keep closed unless intentionally used |
| 8089 | Optional Huiguan single-site server | Not listening in snapshot | SHOULD NOT be public | Keep closed unless intentionally used |
| 8090 | Optional OC single-site server | Not listening in snapshot | SHOULD NOT be public | Keep closed unless intentionally used |
| 4173 | Softie preview/API/room upstream | Snapshot `127.0.0.1` | INTERNAL ONLY | Loopback observed |
| 5173 | Cards Vite dev | Not listening in snapshot; configured `0.0.0.0` dev host | SHOULD CLOSE in production | Development only |
| 5174 | Cards OAuth proxy | Not listening in snapshot; code binds `0.0.0.0` | INTERNAL ONLY if started | Bind loopback; firewall evidence absent |
| 5176 | Legacy redirect dev server | Not listening | SHOULD CLOSE in production | Development/legacy only |
| 5177 | Juling API | Snapshot `:::` wildcard | INTERNAL ONLY; **external reachability UNKNOWN** | Bind loopback; confirm IPv6 firewall too |
| 5178 | Card-balance API | Snapshot `127.0.0.1` | INTERNAL ONLY | Loopback observed |
| 5179 | Management Vite dev | Not listening | SHOULD CLOSE in production | Development only |
| 8123 | Aeon dev/serve entry | Not listening in snapshot | SHOULD CLOSE unless deployed intentionally | Static source says port 8123 |
| 8765 | Local utility | Snapshot `127.0.0.1` | PRIVATE / unrelated to production site | Loopback observed; purpose not established in this audit |
| DB / Redis / SSH / panel | No service inventory from deployed host | UNKNOWN | UNKNOWN | Need firewall/host-level evidence; no port scan performed |

### Local TCP Snapshot

At audit time, `Get-NetTCPConnection -State Listen` showed `0.0.0.0:8080` (Python), `:::5177` (Node), `127.0.0.1:5178` (Node), `127.0.0.1:4173` (Node), and `127.0.0.1:8765` (Python). This is the current Windows machine snapshot, not a cloud-provider firewall report. No process was listening on 5174 at that instant.

## Request and Data Flow

```text
Browser
  -> Cloudflare DNS (A + AAAA; observed edge addresses)
  -> Cloudflare edge (WAF / SSL mode / rate rules UNKNOWN)
  -> cloudflared Tunnel ingress (nine mapped names -> 127.0.0.1:8080)
  -> Python dispatcher :8080
      -> static site/module files
      -> Huiguan / www / OC handlers
      -> Cards OAuth :5174 / Card Balance :5178 / Softie :4173 / Juling :5177
      -> WebSocket room relay :4173
  -> SQLite and filesystem runtime data, user uploads and public assets
```

## Public Routes / API Inventory

See [API reference](../api.md) for current source inventory. Main groups are account/register/login/logout/SSO/security/email, game save/load, public character/asset lists and images, member and admin management, poster/fan content, Cards OAuth, card balance, Juling state/start/action, and Softie settings/room WebSocket. Static module bundles and assets are public by design.

## Public Observation Notes

- DoH A/AAAA answers for all 13 names above were Cloudflare IPv4/IPv6 Anycast; no origin address identified.
- Apex nameservers observed: `irena.ns.cloudflare.com`, `junade.ns.cloudflare.com`.
- No A/AAAA/CNAME/TXT/CAA answer was returned for CAA/TXT/CNAME lookups on the queried hostnames; absence is not equivalent to full-zone audit or DNSSEC verification.
- Local DNS returned `198.18.x.x` synthetic addresses from Mihomo; those are not authoritative DNS results.
- HTTP main page returned 200; HTTPS primary pages returned 200. Only a small sample of sensitive file paths was checked.
- No port scan, origin bypass, TLS downgrade probe, or external firewall test was performed.
