# CSP Report-Only Browser Observation — 2026-10-16

## Result

**INCONCLUSIVE.** The production `Content-Security-Policy-Report-Only` header was verified on HTTPS responses. A browser observation was attempted against the homepage Gallery, Huiguan, Cards, and Spirit pages. The Tabbit Playwright task exceeded its 60-second hard deadline before returning page or console results; a follow-up read-only inspection also timed out. No `securitypolicyviolation` events or console violations were captured. This must not be interpreted as zero violations.

The initial policy is **Report-Only**, so it does not block these pages. No `report-uri` or `report-to` collector is configured. The header was directly observed on apex, Huiguan, and ZSZM HTTPS responses; other static hosts were not individually recorded for this header. The `www` HTTPS response is an edge 301 to the apex and did not include HSTS; its CSP header was not established in this check.

## Policy Directives Deployed

| Directive | Sources in the deployed Report-Only header |
| --- | --- |
| `script-src` | `'self'`, `'unsafe-inline'`, `https://cdnjs.cloudflare.com`, `https://static.cloudflareinsights.com`, `https://*.iridescently.xyz` |
| `style-src` | `'self'`, `'unsafe-inline'`, `https://cdn.jsdelivr.net`, `https://*.iridescently.xyz` |
| `img-src` | `'self'`, `data:`, `blob:`, `https://*.iridescently.xyz` |
| `font-src` | `'self'`, `data:`, `https://cdn.jsdelivr.net`, `https://*.iridescently.xyz` |
| `connect-src` | `'self'`, `https://*.iridescently.xyz`, `wss://*.iridescently.xyz`, `https://static.cloudflareinsights.com` |
| `media-src` | `'self'`, `data:`, `blob:`, `https://*.iridescently.xyz` |
| `frame-src` | `'self'`, `https://*.iridescently.xyz` |
| `worker-src` | `'self'`, `blob:` |

`unsafe-eval` was not added. Keep the policy in Report-Only until representative browser observations cover Gallery images, inline code/styles, Cards APIs, Huiguan login/recovery, Spirit media, and WebSocket connections. Add a privacy-reviewed collector only if centralized reporting is needed. Do not tighten or enforce from this inconclusive run.
