# Listener Baseline

Observed 2026-10-16. The complete TCP LISTEN and UDP endpoint inventory, including PID/process/bind/owner/expected/risk/classification, is saved at `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/security/security-stage1.6/listeners.csv` (162 rows: 70 TCP listeners and 92 UDP endpoints). Windows exposes no UDP LISTEN state; UDP rows are bound endpoints and are not proof that each is receiving remote traffic.

## Project services expected on loopback

| Port | Service | Observed bind | Expected | Status |
|---:|---|---|---|---|
| 8080 | Portal / unified entry | `127.0.0.1` | `127.0.0.1` | PASS |
| 5174 | Cards OAuth | `127.0.0.1` | `127.0.0.1` | PASS |
| 5177 | Juling | `127.0.0.1` | `127.0.0.1` | PASS |
| 5178 | Cards balance | `127.0.0.1` | `127.0.0.1` | PASS |
| 4173 | Softie | `127.0.0.1` | `127.0.0.1` | PASS |
| 8765 | Python `http.server`, `--directory outputs` | `127.0.0.1` | `127.0.0.1` | Owner/purpose verified; PASS |

## Non-loopback listeners requiring review

| Port / protocol | PID / process | Bind | Owner / purpose | Expected | Risk |
|---|---|---|---|---|---|
| 5192 TCP | 2156 `python.exe` | `::` | Project Python static server serving `portal/huiguan` | Development only; loopback expected; no LAN need found | HIGH while Public Firewall is off |
| 53 TCP/UDP | 48712 `verge-mihomo` | `::` | Mihomo DNS | LAN access need UNKNOWN | HIGH; wildcard DNS bind |
| 7897 TCP/UDP | 48712 `verge-mihomo` | `::` | Mihomo proxy | LAN access need UNKNOWN | HIGH; wildcard proxy bind |
| 135 TCP | 832 `svchost` | `0.0.0.0`, `::` | Windows RPC endpoint mapper | Windows service | MEDIUM; Public profile is active and firewall is off |
| 139 TCP | PID 4 `System` | `192.168.1.8`, `192.168.77.1`, `192.168.240.1`, `198.18.0.1` | Windows NetBIOS/SMB | Windows sharing; need UNKNOWN | HIGH; bound to LAN/virtual interfaces |
| 445 TCP | PID 4 `System` | `::` | Windows SMB | Windows sharing; need UNKNOWN | HIGH; wildcard bind plus Public SMB allow rule |
| 5040 TCP | 10000 `svchost` | `0.0.0.0` | Windows service; exact service UNKNOWN | Windows service | MEDIUM |
| 49664–49678, 62795 TCP | Windows system processes (`lsass`, `wininit`, `spoolsv`, `services`, `svchost`) | IPv4/IPv6 wildcard | RPC/dynamic system endpoints | Windows system | MEDIUM; exact service mapping is incomplete |

The `5192` process command line is `python -m http.server 5192 --directory portal/huiguan`; it has no explicit bind, which explains the IPv6 wildcard. It is identifiable as a project development server, so it is not classified UNKNOWN. It was left running to preserve the existing session; restart it with an explicit loopback bind when it is no longer needed. Mihomo and Windows services were not stopped or reconfigured.

Other wildcard UDP endpoints include Windows DNS/IPsec/LLMNR/mDNS and application endpoints from Chrome, QQ, Cloudflare Tunnel, and other installed software. See the CSV for all observed rows. These are bound endpoints, not necessarily inbound listeners. Ownership/purpose for many third-party endpoints is UNKNOWN.

## Drift rule

Project web services listed above should remain loopback-only. A new project listener on `0.0.0.0` or `::` is drift until an explicit LAN requirement and firewall rule are documented. Do not automatically block or stop unknown Windows/third-party services.
