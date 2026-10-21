# Anti-Scraping and Security Recheck — 2026-10-19

## Executive summary

Read-only reassessment of the current public site and available deployment evidence. No Web-Check run, broad scan, offensive fuzzing, configuration change, code change, or production release was performed.

The main confirmed regression is that five canonical production hostnames serve the home page over plain HTTP with status 200. Only four of nine canonical hostnames redirect HTTP to HTTPS. The Cloudflare edge still accepts TLS 1.0 and 1.1. Anti-scraping remains observation-only: the available 43,245 records are from the retired Windows Portal logging path, not the active Hong Kong production release, and current production request logs could not be inspected. Three source-map files are publicly reachable in the current public site. Cloudflare WAF, bot, and rate-limit configuration remains unknown.

## Scope and evidence boundary

- Public checks were low-frequency requests to known production hostnames and selected documented routes. HTTP/TLS checks were pinned to a separately resolved Cloudflare edge address where noted; results describe edge behavior, not origin exposure.
- Deployment status was read through the existing server-control status interface. Active Hong Kong release: `20261019T051405Z`; the five listed Hong Kong services reported active. The Windows PC preview gateway and its tunnel reported offline.
- No SSH login, origin port scan, password-based action, authenticated user session, or real-user account was used.
- The current Hong Kong production request logs and active release file manifest were not available through the read-only status interface. Local Windows logs and local snapshots are labeled separately below.
- Prior Stage 1.65 evidence is treated as historical context only; public results below were rechecked on 2026-10-19.

## Findings

### 1. HTTP to HTTPS — CONFIRMED REGRESSION

Direct HTTP requests to the Cloudflare edge returned:

| Hostname | HTTP `/` | HTTPS `/` |
|---|---:|---:|
| `iridescently.xyz` | 200 | 200 |
| `www.iridescently.xyz` | 301 → `https://iridescently.xyz/` | 301 → apex |
| `huiguan.iridescently.xyz` | 200 | 200 |
| `oc.iridescently.xyz` | 200 | 200 |
| `spirit.iridescently.xyz` | 200 | 200 |
| `zszm.iridescently.xyz` | 200 | 200 |
| `game.iridescently.xyz` | 308 → HTTPS `zszm` route | 308 → HTTPS `zszm` route |
| `juling.iridescently.xyz` | 308 → HTTPS `zszm` route | 308 → HTTPS `zszm` route |
| `lingjing.iridescently.xyz` | 308 → HTTPS `zszm` route | 308 → HTTPS `zszm` route |

Five canonical hosts (apex, `huiguan`, `oc`, `spirit`, `zszm`) served a page over HTTP. This contradicts the earlier Stage 1 requirement that all production HTTP requests redirect. HSTS does not compensate for this response: browsers ignore HSTS received over insecure HTTP. No setting was changed during this audit.

### 2. TLS and response headers — EDGE OBSERVATION

- TLS handshakes to the Cloudflare edge succeeded for TLS 1.0, 1.1, 1.2, and 1.3. TLS 1.0/1.1 acceptance remains confirmed.
- HTTPS responses observed `Strict-Transport-Security: max-age=86400` on tested host responses that served content. No `includeSubDomains` or `preload` was observed. The `www` redirect response did not itself include HSTS; its apex destination did.
- The policy is `Content-Security-Policy-Report-Only`, so it is not enforced. It contains inline script/style allowances, Cloudflare Insights, jsDelivr fonts, production subdomain connections, `data:`/`blob:` image or media sources, `blob:` workers, and secure WebSocket origins. No `unsafe-eval` was observed in the sampled policy. These are observations, not a dependency-complete CSP audit.
- Other sampled headers included `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- Headers confirm Cloudflare edge delivery; they do not prove WAF, bot, or rate-limit rules are enabled.

### 3. Anti-scraping controls and logs — PARTIALLY KNOWN

- The production source snapshot's scraping observer is `OBSERVE_ONLY`; its `would_limit` field is `UNASSESSED_NO_THRESHOLD`. The code records GET/HEAD observations and does not establish an enforced production throttle.
- A single unauthenticated request to the documented `/api/official/characters?limit=9999` route returned 200 and 60 character records, consistent with the current source's `limit` clamp to 60. This is a pagination/resource bound, not evidence of rate limiting or bot mitigation.
- Three rotated local Windows Portal logs contained 43,245 records total (42,875 marked trusted-edge) spanning 2026-10-17T15:49:35Z through 2026-10-19T02:09:22Z. They belong to the prior local Windows Portal path. They are not evidence of traffic observed by the active Hong Kong deployment and were not used to set thresholds.
- Current Hong Kong production request logs: **UNKNOWN / not exposed by the available status interface**. No current-production client-volume or scraper classification conclusion is made.
- Cloudflare Bot Fight Mode / Super Bot Fight Mode, custom WAF rules, rate-limiting rules, and Hotlink Protection: **UNKNOWN**. Edge delivery alone does not establish their configuration.

### 4. Public source maps — CONFIRMED PUBLIC

The following current public URLs returned HTTP 200:

- `https://zszm.iridescently.xyz/app/modules/slay/web_modules/gsap.js.map`
- `https://zszm.iridescently.xyz/app/modules/slay/web_modules/gsap/Draggable.js.map`
- `https://zszm.iridescently.xyz/app/modules/slay/web_modules/immer.js.map`

This confirms that source maps are publicly retrievable. Their contents were not downloaded or inspected. Public source maps can expose source paths and implementation details; no secret disclosure was established by this check. If production error monitoring needs maps, retain private maps and exclude public copies from the release artifact. Development source maps need not be removed.

### 5. Robots and sitemap — CURRENT/CACHED RESPONSE MISMATCH

- A cache-bypassing apex `robots.txt` request returned the current two-line `User-agent: *` / `Allow: /` content, with no `Disallow` and no `Sitemap` declaration.
- The ordinary cached apex response returned older additional `Disallow` directives and was marked `CF-Cache-Status: HIT`, while the bypassed response was a cache miss. This is consistent with a stale cached object; the current origin response itself was not accessed independently.
- `huiguan` and `oc` robots responses contained no sitemap declaration in the sampled responses.
- Apex `/sitemap.xml` returned 404. The current cache-bypassed robots response makes no sitemap declaration, so the earlier declaration/404 inconsistency is not present in that response. A stale cached robots object may still be served temporarily.
- `robots.txt` is crawler guidance, not an access-control or anti-scraping security control. Do not add sensitive or undiscoverable internal paths as a security measure.

### 6. Selected exposure and adjacent controls

- Selected requests for environment, VCS, database, server-source, and storage paths returned 404 at the edge. This is a small sample only; it is not a comprehensive path audit.
- Source review of the available production snapshot shows session and `hx_sso` cookies default to `Secure` unless `IRIDESCENTLY_ENVIRONMENT=development`, with `HttpOnly` and `SameSite=Lax`; Cards uses the same secure default. Live `Set-Cookie` headers were not captured because no login was performed against a real account. Wire-level production cookie state is therefore **UNVERIFIED**.
- Source review found no wildcard credentialed CORS configuration in the sampled Cards OAuth path. Static media has wildcard CORS without credentials for cross-origin display. This was a source check, not an exhaustive runtime CORS matrix.
- PC preview's local gateway and tunnel report offline; its public preview hostnames returned Cloudflare 530 in the sampled checks. This is consistent with an offline preview tunnel, not evidence of origin port exposure.
- Cloudflare-edge common-port results from prior Web-Check work remain `EDGE-ONLY` and were not used as origin evidence or repeated here.

## Evidence status summary

| Area | Current result | Evidence class |
|---|---|---|
| HTTP → HTTPS | 5/9 canonical hosts return HTTP 200; 4 redirect | Confirmed edge response |
| TLS 1.0 / 1.1 | Accepted | Confirmed edge handshake |
| HSTS | `max-age=86400` observed on content responses | Confirmed sampled headers |
| CSP | Report-Only | Confirmed sampled headers |
| Scraping enforcement | Observer source is observe-only; no threshold assessed | Source evidence |
| Current HK request logs | Unknown | Not exposed in status interface |
| Historical local observer logs | 43,245 records; retired Windows path | Local historical evidence |
| Pagination cap | `limit=9999` returned 60 records | Confirmed single public request + source |
| Public source maps | Three tested maps return 200 | Confirmed public responses |
| Cloudflare WAF / bot / rate limits | Unknown | Dashboard/config access unavailable |
| Apex sitemap | 404; current cache-bypassed robots has no sitemap line | Confirmed sampled responses |
| Production Set-Cookie | Not captured | Unknown at runtime; secure default in source |
| Origin exposure from edge port results | No conclusion | Edge-only; excluded |

## Recommended follow-up

1. Restore HTTP-to-HTTPS redirects for the five confirmed failing hostnames at the Cloudflare edge (or the appropriate trusted application fallback), then verify all nine hosts over HTTP and HTTPS.
2. Set the Cloudflare minimum TLS version to TLS 1.2 if no documented legacy-client requirement exists, then run only normal TLS/HTTPS regression checks.
3. Inspect Cloudflare's actual Bot/WAF/rate-limit/Hotlink settings and obtain a safe read-only view or export of active Hong Kong request logs before defining thresholds.
4. Decide whether production source maps are required publicly. If not, exclude them from the production artifact; if needed for monitoring, keep private copies.
5. Purge or allow expiry of the stale apex `robots.txt` cache object after confirming the intended canonical content. Keep robots as crawler guidance only.
6. Capture `Set-Cookie` headers through a non-destructive test account or staging flow to verify `Secure; HttpOnly; SameSite=Lax` on production authentication cookies.

## Change and test record

- Code/configuration changes: **none**.
- Cloudflare or origin mutations: **none**.
- Web-Check: **not run**, as requested.
- Broad scans / offensive fuzzing: **not performed**.
- Public checks performed: known-host HTTP/HTTPS root checks; TLS version handshake checks; selected security-header, robots/sitemap, source-map, and blocked-path requests; one documented pagination-boundary request.
- Git: no staging, commit, reset, clean, or checkout operation performed. The pre-existing dirty worktree was preserved; this report is the only new file from this recheck.
