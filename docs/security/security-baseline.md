# Security Baseline

**Snapshot:** 2026-10-16. This describes the current evidence and the target operating baseline; it does not claim production controls that were not inspected.

## Current Evidence

- **Edge/transport:** Cloudflare DNS and Tunnel are configured. HTTPS works on the main sites. HTTP currently serves the main page with 200, and HSTS is absent.
- **Origin:** Tunnel ingress points nine hostnames to `127.0.0.1:8080`. The local dispatcher currently binds `0.0.0.0`; Juling listener was observed on IPv6 wildcard `:::`. Firewall/NAT reachability is unknown.
- **Account:** Passwords use salted scrypt with PBKDF2 fallback. Login and registration have app-layer limits. Password minimum is six characters. Session cookies are HttpOnly/SameSite=Lax and conditionally Secure, with 30-day local session lifetime and 7-day SSO token lifetime.
- **Recovery:** Verified-email tokens are random, hashed at rest, one-use and 30 minutes. Security-question recovery also exists.
- **API:** Account-sensitive handlers use identity checks; admin/editor routes have role guards. Broad endpoint authorization coverage remains unverified.
- **Static files:** Dotfiles, database/log/private suffixes, directory listing, and selected runtime folders are blocked by the static handler. Three low-frequency public sensitive-path checks returned 404.
- **Uploads:** Accepted images have declared-type/signature matching, Pillow verification, 8 MiB/5 MiB GIF and 40 MP limits. Images are stored as original bytes, not normalized derivatives.
- **Headers:** X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy observed. CSP/HSTS absent.
- **Supply chain:** `npm audit` found no advisories in the current npm lockfile at audit time. Python, OS and workflow supply chain not assessed.
- **Secrets:** Heuristic scan did not confirm a live credential; ignored environment files and external account secrets were out of scope.
- **Operations:** Website Manager, watchdog and logs are documented. Production alerting, retention, backup restoration and access review are not established.

## Target Baseline

| Area | Baseline requirement |
|---|---|
| Public ports | Only edge 80/443 public; 80 redirects to HTTPS. Origin listeners bind loopback or have documented, verified firewall allowlists. DB/cache/admin interfaces are private. |
| TLS | Valid automated certificates; TLS 1.2/1.3; HTTPS enforced; HSTS after all subdomains are ready; origin trust mode documented. |
| Cookies | `Secure; HttpOnly; SameSite` set consistently; short appropriate session lifetime; logout/password reset revokes the session server-side. |
| Passwords | Modern salted password hashing; passphrase-friendly minimum and compromised-password check; per-account plus per-IP controls; MFA for admin. |
| Recovery | Verified email or strong external identity proof; one-use short-lived tokens; no account enumeration; no weak knowledge questions as sole factor. |
| Authorization | Server derives user identity from session; owner checks on each object operation; role checks on admin/editor actions; tests cover anonymous/user/owner/admin. |
| API | Per-route input validation, output minimization, bounded body sizes, exact CORS allowlist, CSRF protection for cookie-auth writes, rate limits, generic errors. |
| Uploads | Signature and decoder verification, safe decode/re-encode, size/pixel limits, generated filenames, storage outside executable paths, quotas and abuse telemetry. |
| Frontend | No secret in `VITE_*`/client bundles; no production public source maps unless intentionally published; release excludes env, DB, logs, backups and private media. |
| CDN/content | Public derivatives by default; originals private where justified; explicit cache policy; measured rate/bot controls that preserve normal users and search engines. |
| Logging | Never log passwords, raw reset/email tokens, full cookies/JWT or Authorization values; alert on auth abuse, admin changes, 401/403 bursts and rate limits. |
| Recovery/availability | Tested database/media backups, documented restore procedure, tunnel and origin health checks, responsible alerts, capacity and proxy timeout review. |
| Supply chain | Lockfiles; regular npm/Python audit; pinned CI actions; least-privilege CI tokens; secret scanning; no blind major upgrades. |

## Prioritized Work

1. Enforce HTTPS, unconditional Secure cookies, then HSTS.
2. Verify/close direct 8080 and 5177 ingress; bind internal services to loopback.
3. Replace broad Cards API CORS and wildcard bind.
4. Raise password baseline and review account recovery factors.
5. Verify production source-map exclusion and active release contents.
6. Conduct owned-account access-control and CSRF checks in staging.
7. Verify Cloudflare WAF/rate/cache configuration, security logs/alerts and backups.
8. Normalize public uploaded images and review original Gallery exposure.

See [SECURITY_BASELINE_REPORT.md](SECURITY_BASELINE_REPORT.md) for evidence-backed findings and limits.
