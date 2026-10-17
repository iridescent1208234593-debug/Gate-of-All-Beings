# CSP Migration Plan

## Stage 1 observation policy

`server/base_static.py` sends `Content-Security-Policy-Report-Only`; it does not enforce blocking. The initial policy is based on the active production snapshot's HTML resource references and the source bundle checks made for this stage:

| Directive | Initial sources and reason |
| --- | --- |
| `script-src` | `'self'`, `'unsafe-inline'` for observed inline scripts, `cdnjs.cloudflare.com`, `static.cloudflareinsights.com`, and owned `*.iridescently.xyz` subdomains. No `unsafe-eval` added; no production bundle evidence required it. |
| `style-src` | `'self'`, `'unsafe-inline'` for observed inline styles, `cdn.jsdelivr.net`, and owned subdomains. |
| `img-src` | `'self'`, `data:`, `blob:`, owned subdomains; dynamic Gallery/user content may use generated URLs. |
| `font-src` | `'self'`, `data:`, `cdn.jsdelivr.net`, owned subdomains. |
| `connect-src` | `'self'`, HTTPS and WSS owned subdomains for APIs/WebSockets, and Cloudflare Insights. |
| `media-src` | `'self'`, `data:`, `blob:`, owned subdomains for media and generated content. |
| `frame-src` | `'self'` and owned subdomains. |
| `worker-src` | `'self'` and `blob:` for observed blob-backed workers. |

The active snapshot contained 38 HTML files, 40 inline script blocks, and 30 inline style blocks. Resource references included `cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `static.cloudflareinsights.com`, and owned Huiguan/site hosts. Blob URLs were present in production JavaScript. This is an initial inventory, not a browser-complete dependency trace.

## Observation and tightening sequence

1. Deploy the report-only header and inspect browser console violations across representative pages: login/recovery, Cards, Gallery, Spirit/WebSocket, and media-heavy content.
2. Add a report collector only after choosing an approved privacy-aware endpoint; no collector is configured by this change, so violations are visible in browser developer tools and are not centrally aggregated.
3. Correct the source list only when a real page dependency is confirmed. Avoid broad wildcard sources and do not add `unsafe-eval` merely to silence a report.
4. After representative browser and regression coverage, introduce an enforced policy in a separate change. Remove inline allowances only after replacing or nonce/hash-authorizing the observed inline code.

Do not add HSTS `includeSubDomains` or `preload` until every production hostname has verified HTTPS and HTTP redirect behavior.
