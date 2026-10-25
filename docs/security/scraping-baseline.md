# Stage 1.7 — Scraping Baseline and Remediation

Checked 2026-10-16 (Asia/Singapore). Scope was limited to source review, a bounded read-only log sample, and one local derivative proof of concept. No production deployment, Cloudflare change, high-rate request, large download, or mass image conversion was performed.

## Fixed

- Official character list accepted `limit=500`; `limit=-1` passed a negative SQLite `LIMIT`, which means no limit. It now defaults to 30, clamps to 1–60, rejects malformed paging values with 400, clamps negative pages to page 1, and rejects page numbers over 100000.
- Public fan list had the same negative-limit behavior despite a nominal 60 maximum. It now clamps to 1–60, rejects malformed values and page numbers over 100000, and keeps its existing default of 12.
- The public fan list selected `SELECT *`, exposing internal `user_kind` and `user_uid` fields not used by the checked public UI callers. Those response fields are retained as empty strings for compatibility.
- `/api/official/unclassified` returned absolute `image_path`, source character ID, and timestamp although its public UI only uses `id` and `reason`. The response now returns only those two fields.
- Exact scoped changes are in `portal/huiguan/server_huiguan.py`. Other existing modifications in that file predate this stage and remain untouched.

## Request and Log Evidence

- Read-only sample: last 3000 lines of `E:\External Projects\Iridescently Operations\网站恢复/logs/portal.log` (file was modified 2026-10-16 19:17 local time). The sample contained 2764 GET/HEAD request-shaped lines. Only 170 had timestamps and a client-address field; all 170 were local `127.0.0.1` requests spanning 2026-10-15 17:23:15 to 2026-10-16 18:57:12. Of these, 50 returned 404 and 0 returned 429. The other 2594 were proxy route lines without per-client identity or reliable request timestamps.
- Among those 3000 lines, 172 mentions matched the selected content route families (`/api/official/*`, `/api/fan/*`, `/api/assets/*`, `/assets/uploads/*`, `/gallery-files/*`). The strongest path counts were `/api/official/img` 85, `/api/official/characters` 22, `/api/fan/list` 16, `/api/fan/check-suggest` 12, `/api/official/unclassified-img` 9, and `/api/assets/avatar` 9. Query strings were stripped before reporting, and no IPs or account values were emitted.
- The mixed logger format does not reliably link requests to a client or time window. Sequential IDs per client, requests/minute, image bursts, crawler session continuity, and true edge 404/429 rates therefore remain **UNKNOWN**. A single `/wp-admin/install.php` probe appeared in the reviewed tail; it is not evidence of a sustained crawler pattern.
- Application source review found no content-specific GET rate limit on the mapped list, detail, or image routes. Cloudflare Bot/WAF/Rate Limiting/Hotlink settings are **UNKNOWN**; no dashboard/API credential was available in the Stage 1.6 evidence.

## Content and Media Evidence

- `E:\External Projects\Iridescently Operations\assets/gallery-manifest.json` lists 384 Gallery images totalling 319,169,642 bytes. `portal/www/gallery-engine/gallery-plugin.js` copies the discovered originals into the public `gallery-files/` output without resizing. The current live deployment artifact path could not be identified from this checkout, so actual deployed bytes remain **UNKNOWN**.
- Three local Gallery samples (700×1012 PNG, 1670×2334 JPEG, and 1800×3800 PNG) had no EXIF keys, GPS, or software fields. This small sample does not establish that all 384 assets or user uploads are metadata-free.
- One local proof of concept used `2026年雨水贺图.png` (1800×3800, 4,406,036 bytes) without modifying the source. Generated outputs are under `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.7/poc/`: `display-1600.webp` (758×1600, 104,864 bytes) and `thumbnail-400.webp` (189×400, 15,924 bytes). Both reopen successfully and contain no EXIF keys. The display is capped on its longest edge at 1600px; visual acceptance in the live Gallery has not been performed.
- Full originals remain available without authentication from official image and shared asset APIs, and the original upload URLs are stable. Whether every upload is intended public is **UNKNOWN**; do not blanket-block the shared upload directory.

## Rate-Limit and Edge Plan

1. Keep ordinary HTML and thumbnail traffic loose. Collect edge request logs with privacy-safe client identifiers, path class, status, timestamp, and rate action before selecting numeric thresholds.
2. At Cloudflare, first deploy log-only rules for `huiguan.iridescently.xyz` list/search/detail paths and original-media paths separately. Use hostname + path + method and verified-bot signals where available; do not trust a spoofable User-Agent as an allow signal.
3. After observing a normal-user baseline, apply differentiated limits: moderate for list/search/detail APIs, stricter for original media and upload/download paths. Prefer short Retry-After/429 or Managed Challenge with recovery windows; avoid permanent blocks and broad homepage challenges.
4. Keep HTML search-engine crawling available where desired while deciding separately whether search engines need original media. The current `robots.txt` disallows `/assets/uploads/`, but this is crawler guidance, not access control.
5. Do not add an origin IP limiter until the trusted proxy/client identity chain is proven. Current app logging largely sees shared proxy routes or loopback traffic; treating that address as each visitor would throttle unrelated users together.

Cloudflare plan capabilities, verified-bot signals, existing WAF/rate rules, hotlink policy, and current cache rules remain **UNKNOWN**. The plan above is a proposal only; no Cloudflare rule was created.

## Verification

- Parsed the edited Python source and exercised the paging block without importing the live server or touching its databases: default limits, negative limits, maximum clamping, negative pages, malformed values, malformed filters, and excessive page numbers (13 boundary cases).
- Ran isolated in-memory SQLite checks for the public-only fan-list filter and response shape, blank owner identifiers, and the reduced unclassified-list fields.
- Checked the two generated WebP files by reopening them and reading dimensions, byte sizes, and EXIF-key lists.
- No production endpoint, authenticated account, large media request, 429 behavior, or Cloudflare rule was exercised. Those remain deployment verification tasks.

## Git and Change Attribution

- Initial and final snapshots are in `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.7/git-status-baseline.txt`, `git-diff-stat-baseline.txt`, `git-status-final.txt`, and `git-diff-stat-final.txt`.
- The branch remains `master...origin/master [ahead 10]`. `portal/huiguan/server_huiguan.py` was already dirty before Stage 1.7 because of earlier account/avatar/security work. Comparing the saved pre-stage diff with the current diff shows this stage added 28 lines and removed 8 lines in that file; these are the pagination clamps and two public-field minimizations described above. All other pre-existing edits were left alone.
- The two reports and two POC images live under `docs/security/` and `work/`, directories already untracked at the baseline. No files were staged and no commit was created. `git diff --check` reported no whitespace errors; it printed existing LF-to-CRLF warnings for unrelated dirty files.
