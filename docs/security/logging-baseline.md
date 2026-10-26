# Logging and Alert Baseline — Stage 1.6

Checked 2026-10-16 (Asia/Singapore). `E:\External Projects\Iridescently Operations\网站恢复/logs/` contains process logs including `portal.log` (3,938,401 bytes), `tunnel.log` (3,509,642 bytes), `zszm-oauth.log` (261,241 bytes), `juling.log` (3,216 bytes), and `softie.log` (2,725 bytes) at observation time. A sample of the last 200 lines of each of the five newest logs (all lines for shorter files) was checked for field patterns indicating Authorization, Cookie/Set-Cookie, session IDs, password, reset/recovery token, verification token, and full email query parameters. No such field names were found in the sampled lines. This is a bounded sample, not a full-history guarantee.

Retention, rotation, ACLs, centralized collection, and deletion schedule are UNKNOWN. Logs are process/application stdout files; no dedicated security log store or SIEM was verified. `ALERTING NOT IMPLEMENTED`.

| Security event | Baseline requirement | Current evidence |
|---|---|---|
| Login failure | Record timestamp, account reference hash, source/rate-limit outcome; never password | Dedicated event logging UNKNOWN |
| Rate limit | Record endpoint, count/window, action | Dedicated event logging UNKNOWN |
| Password reset request | Record generic result and request ID; never token/email query value | Dedicated event logging UNKNOWN |
| Password reset success | Record account reference hash and session invalidation result | Dedicated event logging UNKNOWN |
| Email change | Record actor/account reference hash and outcome | Dedicated event logging UNKNOWN |
| Admin/editor action | Record actor, action, target ID, outcome | Dedicated event logging UNKNOWN |
| 401/403 burst | Aggregate endpoint/status/count without sensitive query strings | Dedicated event logging UNKNOWN |
| Service crash/restart | Preserve process name, timestamp, exit/restart outcome | Process logs exist; retention/alerts UNKNOWN |
| Cloudflare Tunnel disconnect | Record connector health transition and recovery | `tunnel.log` exists; alert delivery UNKNOWN |

Do not log Authorization, Cookie, raw session IDs, passwords, reset/verification tokens, or full sensitive query strings. Add a security event sink and alerting only under a separate scoped change; no SIEM requirement was introduced here.
