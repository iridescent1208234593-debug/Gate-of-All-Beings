# Stage 1.8 — Anti-Scraping Production Rollout & Traffic Observation

Checked: 2026-10-16 (Asia/Singapore). Scope: bounded production checks, source and release-artifact review, five local derivative samples, and a candidate release. No Web-Check rerun, penetration test, high-rate request, mass download, mass image conversion, or Cloudflare rule change was performed.

## Final status

**NOT READY — production rollout is blocked.** The Stage 1.7 candidate passed its manifest validation, but the existing atomic publisher failed three times with Windows `EPERM` while renaming `.releases/production/site`; each attempt rolled back. The previous production snapshot is restored and the unified portal is listening on `127.0.0.1:8080`. The publisher was not bypassed. No Stage 1.7 or Stage 1.8 application change is active in production.

## Deployment

- Candidate `.releases/candidate/site` contains the Stage 1.7 pagination/privacy edits, the Stage 1.8 observe-only logger and response hook, and the robots cleanup described below. Candidate manifest verification passed for 1,371 files.
- The active production snapshot does not contain `server/scraping_observer.py`; its `portal/huiguan/server_huiguan.py` remains the pre-Stage-1.7 version. The stage changes are **candidate-only**, not deployed.
- Before-deployment production boundary evidence from Stage 1.7 remains the applicable behavior: official characters `limit=61` returned 61 rows; `limit=-1` and `-100` each returned all 439 rows. Fan list `limit=-1` and `-100` were echoed as negative values (16 public rows existed at the time); its response still included `user_kind` and `user_uid`. No post-deployment checks are possible until the candidate is published.
- Three safe publisher attempts ended in the same `EPERM` rename failure and automatic rollback. No non-atomic file copy was attempted. Original production and candidate snapshots are preserved under `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.8/release-backup/`.

## Real Client Logging

- Added candidate-only `server/scraping_observer.py` and a `BaseStaticHandler.end_headers()` hook. It records GET/HEAD request time, client identity, `CF-Ray`, method, coarse path category, response status/Content-Length when present, 10/60-second counts, distinct resource/page counts, and observe state.
- It does not record query strings, request bodies, cookies, authorization headers, passwords, email/reset tokens, or session values. Operational logs retain the client IP and Ray ID; this report contains no full client IP.
- Cloudflare forwarding identity is accepted only when `IRIDESCENTLY_ENVIRONMENT=production`, the origin peer is loopback, the Host matches one of the nine explicit production hostnames, `CF-Ray` is syntactically valid, and `CF-Connecting-IP` parses as an IP address. Other requests use the socket peer. This is an origin-path trust boundary, not cryptographic validation against a separate local process able to connect to the origin and forge the same headers.
- Rotation is size-bounded: 5 MiB current file plus five rotated files (about 30 MiB maximum); no calendar-day retention is configured. In-memory windows are capped at 2,048 client/category keys and 60 seconds.
- Local isolated smoke evidence passed for the trust conditions, production/development distinction, response status/size extraction, `CHARACTER_LIST` categorization, observe-only state, and omission of query values. This is not evidence of production logging.
- **Production real edge identity: NOT VERIFIED. Production scraping log samples: 0.** Existing Stage 1.7 log review found 170 timestamped client-address lines in a 3,000-line tail, all `127.0.0.1`; those records could not establish per-client request windows. No new production sample can exist until deployment.

## Traffic Sample and Observation

- Real production sample for this stage: **0 attributable edge requests**. p50/p90/p95/p99 requests per minute and per-category rates are **UNKNOWN / INSUFFICIENT SAMPLE**.
- Candidate code reports `rate_limit_state=OBSERVE_ONLY` and `would_limit=UNASSESSED_NO_THRESHOLD`; it does not enforce or return 429. No numeric threshold was invented.
- Endpoint categories are separated for page, gallery/list, character list/detail, search, thumbnail, display, original media, and other mapped public APIs. Image classes are not combined with list API counts.
- No production human, slow-crawler, fast-pagination, or original-download test was run. No 429, challenge, or automatic recovery behavior is claimed.

## Cloudflare and edge state

| Control | Status | Evidence |
|---|---|---|
| Bot Fight Mode | UNKNOWN | No authorized dashboard/API view available |
| Super Bot Fight Mode | UNKNOWN | No authorized dashboard/API view available |
| WAF custom rules | UNKNOWN | No authorized dashboard/API view available |
| Rate Limiting Rules | UNKNOWN | No authorized dashboard/API view available |
| Hotlink Protection | UNKNOWN | No authorized dashboard/API view available |
| Browser Integrity Check | UNKNOWN | No authorized dashboard/API view available |
| Security Level | UNKNOWN | No authorized dashboard/API view available |
| Cache Rules | UNKNOWN | No authorized dashboard/API view available |
| Minimum TLS Version | UNKNOWN | No Cloudflare configuration access; no change made |
| Edge TLS versions | TLS 1.0/1.1 and TLS 1.3 observed in Stage 1.65 | User-supplied outside-in result; Web-Check was not rerun |

The recommended minimum TLS version is TLS 1.2 if legacy-client requirements permit. This is separate edge hardening and does not block Stage 1.8. Origin TLS was not changed. User-supplied HTTP→HTTPS evidence covers all nine production hostnames; no Web-Check rerun was made. Edge-only common-port findings were excluded from origin exposure conclusions and no Windows/origin firewall rules were changed.

## robots.txt and sitemap

- Current public `https://iridescently.xyz/robots.txt` returned 200 and contains no sitemap line. The public root sitemap URL returned 404.
- Current public `huiguan` and `oc` robots files each returned 200 and declared `https://iridescently.xyz/sitemap.xml`, which returned 404. The source files and candidate copies now omit that stale declaration.
- The main-site robots file previously disallowed `/.git/`, `/__pycache__/`, `/assets/store/`, and `/assets/uploads/`; each corresponding public root URL returned 404. These stale entries were removed from source and candidate. No hidden API or sensitive path was added. Robots rules are crawler guidance, not access control.
- The robots changes are **not live** because release publication is blocked. Once publishing is restored, verify apex, Huiguan and OC robots plus the sitemap URL again.
- `security.txt` absence is informational per the Stage 1.65 result.

## Gallery Originals and Public Data

- The source manifest `ops/assets/gallery-manifest.json` lists 384 Gallery files totaling 319,169,642 bytes. Source pipeline review of `portal/www/gallery-engine/gallery-plugin.js` shows original bytes copied to public `gallery-files/` without a resize/derivative step; source filenames are used in the generated client manifest.
- The active production snapshot has no `portal/www/gallery-engine/` or `portal/www/gallery-files/`. Therefore the live Gallery build output and direct public URL mapping are **UNKNOWN**; source behavior alone does not prove those originals are currently deployed at that path.
- Stage 1.7 route review documents unauthenticated stable-ID original responses through official image and shared asset APIs, with `t=1` as a smaller thumbnail variant and no content-specific rate limit. These APIs serve public display/game assets; whether direct full-resolution download is an intentional product feature is **UNKNOWN**. Do not remove the endpoint. Proposed follow-up: route normal page display through generated derivatives, and decide original-download access per asset family before adding authorization or short-lived URLs.
- Public production HTML/JS/JSON inclusion of the complete Gallery manifest and live original URL mapping are **UNKNOWN** because the active release snapshot does not include the Gallery engine output. The source manifest itself enumerates 384 assets.
- Stage 1.7 source review also found single-response inventory endpoints such as `/api/assets/manifest`, `/api/official/graph`, and `/api/official/stickers`; whether the active production frontend/API snapshot includes those exact source versions was not re-established in this blocked rollout.

## Derivative Pipeline v1 POC

A local-only page at `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.8/derivatives-final/index.html` displays five representative sample derivatives. Thumbnail clicks link only to 1600px-bounded display WebP files; no original source URL is linked. The POC is not deployed.

| Sample | Source dimensions / bytes | Display WebP | Thumbnail WebP | Source SHA-256 unchanged |
|---|---:|---:|---:|---|
| 2026 Rain | 1800×3800 / 4,406,036 | 758×1600 / 87,660 | 189×400 / 12,800 | Yes |
| 2012 Children’s Day | 600×491 / 476,970 | 600×491 / 55,360 | 400×327 / 30,872 | Yes |
| 2015–2017 Autumn Equinox | 360×360 / 136,926 | 360×360 / 12,384 | 360×360 / 11,462 | Yes |
| 2018 Jingzhe JPEG | 800×1545 / 133,013 | 800×1545 / 52,780 | 207×400 / 7,344 | Yes |
| 2021 Chushu | 1052×2216 / 1,530,525 | 760×1600 / 78,230 | 190×400 / 12,918 | Yes |

Across these samples, display files total 286,414 bytes (about 4.3% of the 6,683,470 source bytes); thumbnails total 75,396 bytes. Reopened outputs are WebP and have no EXIF payload. Two selected source images had RGBA channels but alpha extrema were `(255,255)`; the five samples contain no actual transparent pixels, so RGB output has no visual alpha loss. The contact sheet was visually reviewed for gross scaling/composition issues; static link targets were verified. The POC HTML was not browser-rendered, and this is not live Gallery acceptance. Full per-file evidence and hashes are in `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.8/derivatives-final/derivative-evidence.json`.

## Cache, Rate Limit, and False Positives

- Candidate logger is observation-only. **No endpoint is enforced** and no production 429/Retry-After result was tested.
- Threshold evidence: none. Every endpoint category remains `OBSERVE ONLY`; p50/p95/p99 and proposed threshold are `UNKNOWN`; action is `OBSERVE ONLY`; confidence is `INSUFFICIENT SAMPLE`.
- Live thumbnail/display `Cache-Control` and `CF-Cache-Status` were not tested because no verified deployed derivative URL exists. Cache behavior for private/authenticated originals is also **UNKNOWN**.
- No production false-positive or normal Gallery interaction check was run. The local POC link graph was checked, but does not establish UI/API/Gallery/WebSocket regression status.

## Verification Evidence

| Check | Result |
|---|---|
| Candidate manifest | Passed, 1,371 files |
| Atomic production publish | Blocked; three `EPERM` failures, each rolled back |
| Restored origin listener | `127.0.0.1:8080` listening; old production service restored |
| Observer source/candidate syntax | Passed via compile-only check |
| Observer identity/logging smoke | Passed with synthetic test handler; not production traffic |
| Derivative source integrity | All five source hashes unchanged before/after |
| Derivative output | Five display + five thumbnail WebPs reopened; dimensions/bytes/EXIF recorded |
| Derivative POC links | Five thumbnail links map to existing display derivatives; no original URLs linked |
| Live apex robots | 200; no sitemap declaration |
| Live Huiguan/OC robots | 200; both declare the apex sitemap |
| Live apex sitemap | 404 |
| Cloudflare configuration | UNKNOWN; no setting changed |
| Production 429/rate-limit | Not run; no threshold or policy exists |
| Web-Check | Not rerun, per instruction |

## Remaining Risks

- Stage 1.7 API pagination/privacy fixes and Stage 1.8 logger are not in production; previously observed negative-limit behavior remains until deployment.
- No reliable real-client production log or traffic distribution exists. Keep limits at observe-only until real normal-user samples support endpoint-specific thresholds.
- Cloudflare bot, WAF, rate-limit, hotlink, cache, and minimum TLS settings remain UNKNOWN.
- Two production subdomain robots files still advertise a missing apex sitemap until the candidate can be published.
- Original media and manifest exposure at the live edge remain partly UNKNOWN; source code provides stable public original routes and an untransformed Gallery copy pipeline.
- No production derivative path, cache policy, 429 behavior, or regression test was verified.

## Next Recommended Stage

Resolve the Windows file-lock/atomic rename blocker without bypassing the publisher, then publish this exact validated candidate. Verify the Stage 1.7 limit boundaries and public-field changes, confirm real `CF-Connecting-IP` attribution from production edge traffic, collect ordinary traffic before setting thresholds, inspect Cloudflare configuration through an authorized management path, and verify the live Gallery build/URLs and derivative behavior. Keep enforcement disabled until those observations support it. Do not proceed to Stage 2 in this report.

## Git and Change Attribution

- Stage 1.8 source changes: stale crawler directives removed from `portal/www/robots.txt`, `portal/huiguan/robots.txt`, and `portal/oc/robots.txt`; observe hook added to the already-dirty `server/base_static.py`; new `server/scraping_observer.py`; this report added. The same file's HSTS/CSP header edits predate Stage 1.8 and are not attributed to this stage.
- The existing worktree contains many unrelated uncommitted files and deletions. They were not reset, cleaned, staged, committed, or copied into the candidate. `portal/huiguan/server_huiguan.py` already contained Stage 1.7 edits and other pre-existing account/profile work; this turn did not rewrite that source file.
- Candidate-only release artifacts and derivative evidence remain under `.releases/candidate/` and `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.8`; complete pre-attempt release snapshots remain under `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.8/release-backup/`.
- No commit was created. `git diff --check` reported no whitespace errors in the reviewed files; Git emitted an existing LF-to-CRLF notice for `portal/www/robots.txt`.
