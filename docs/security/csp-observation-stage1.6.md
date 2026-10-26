# CSP Report-Only Observation — Stage 1.6

Observation date: 2026-10-16 (Asia/Singapore). Browser: installed Chrome 155.0.8059.40 controlled by the installed Python Playwright 1.64.0. This was normal page navigation only. The deployed header remained `Content-Security-Policy-Report-Only`; no policy change was made. A browser-side `securitypolicyviolation` listener and console listener were installed before navigation. Repeated events were deduplicated by page, directive, blocked URI, source file, line, and disposition. Raw browser output was not used as a source of account data.

## Pages observed

| Page | URL / route | Result | Notes |
|---|---|---:|---|
| Apex | `https://iridescently.xyz/` | 200 | Main Gallery/homepage shell |
| Huiguan | `https://huiguan.iridescently.xyz/` | 200 | Root page |
| Login | `https://huiguan.iridescently.xyz/?openauth=1` | 200 | Login entry page loaded; modal did not open in this headless pass |
| Recovery | `https://huiguan.iridescently.xyz/security.html?mode=recover` | 200 | Recovery UI route |
| Gallery | `https://iridescently.xyz/#gallery` | 200 | Gallery section on the apex page; `/gallery.html` returned 404 and was excluded as a non-existent route |
| Cards | `https://zszm.iridescently.xyz/` | 200 | Cards/public entry |
| Spirit / WebSocket | `https://spirit.iridescently.xyz/games/spirit-playground` | 200 | Separate temporary test-room pass established WSS and received `joined`; connection closed afterward |
| ZSZM | `https://zszm.iridescently.xyz/app/shell/` | 200 | Unified app shell |
| Juling | `https://juling.iridescently.xyz/app/shell/m/juling` | 200 | Canonicalized to the ZSZM shell route |

The full page result JSON is `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.6/csp-observation.json`; the WebSocket capture is `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.6/csp-spirit-websocket.json`. A stable room label was used only for this temporary anonymous connection; no account or persistent user data was created.

## Deduplicated violations

All were `disposition=report`; Report-Only did not block page behavior. Five distinct page/directive/resource combinations were observed (eight events across Huiguan/Login and Cards page loads):

| Classification | Page | Directive | Blocked URI | Source | Count | Interpretation |
|---|---|---|---|---|---:|---|
| REAL REQUIRED RESOURCE | Huiguan/Login | `img-src` | `https://iridescently.xyz/assets/iridescently-mark.png` | Huiguan document | 2 | Shared apex logo is requested by subdomain pages; apex host is not covered by the `*.iridescently.xyz` source expression. |
| REAL REQUIRED RESOURCE | Huiguan/Login | `script-src-elem` | `https://iridescently.xyz/assets/shared-chrome-v2.js` | Huiguan document | 2 | Shared site chrome script is loaded from the apex. |
| REAL REQUIRED RESOURCE | Huiguan/Login | `script-src-elem` | `https://iridescently.xyz/assets/site-language.js` | `shared-chrome-v2.js:124` | 2 | Language script is dynamically loaded by shared chrome from the apex. |
| REAL REQUIRED RESOURCE | Cards | `img-src` | `https://iridescently.xyz/assets/iridescently-mark.png` | ZSZM document | 1 | Shared apex logo is requested by the Cards entry. |
| REAL REQUIRED RESOURCE | Cards | `script-src-elem` | `https://iridescently.xyz/assets/site-language.js` | ZSZM document | 1 | Shared language script is loaded from the apex. |

No application-origin CSP violations were captured on Apex, Recovery, Gallery, ZSZM shell, Juling, or the connected Spirit page during this pass. This observation is a sample, not proof that no other resources or code paths violate policy. No `unsafe-eval`, broad `*`, or new source was added. The cross-apex dependencies are evidence for a future narrow policy update; this stage intentionally left the deployed header untouched.

A separate diagnostic attempt that repeatedly used Playwright `wait_for_function` generated 472 `script-src` events for a synthetic `/games/eval` URI. The same Spirit route observed without polling generated no such event, while the WebSocket still connected. Those 472 events are classified `UNUSED / NOISE` (automation-evaluation noise) and excluded from application findings. No `LEGACY INLINE` or `POTENTIAL SECURITY ISSUE` event was confirmed in the clean observation. No `unsafe-eval` change is recommended from them.

Console observations included a repeated Three.js SVGLoader deprecation warning, one Chrome WebGPU power-preference warning, and one ZSZM 404 resource error. They were not CSP violations. The Gallery 404 from the initial incorrect `/gallery.html` route was also corrected by testing the existing homepage `#gallery` section.

## Policy remains Report-Only

Keep the current directive inventory and `unsafe-inline` allowances in Report-Only pending review of the required apex shared assets. Do not add `unsafe-eval` to silence the Playwright artifact. Reobserve normal pages after any narrow source update; do not enforce CSP in this stage.
