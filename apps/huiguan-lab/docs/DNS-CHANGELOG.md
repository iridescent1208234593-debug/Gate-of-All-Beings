# DNS 与 Tunnel 变更记录

记录格式：时间（UTC+8）、操作、对象（Zone、名称、记录 ID）、执行人、验证结果、回滚方法。

| 时间 | 操作 | 对象 | 执行人 | 结果 |
|---|---|---|---|---|
| 2026-11-06 22:37 | 只读快照 | 三个 Zone 的全部 49 条记录，账号下 4 个 Tunnel 及其 ingress | Claude | PASS，`evidence/lab-v2-cloudflare-20261106/cloudflare-snapshot-20261106T143734Z.json` |
| 2026-11-06 22:38 | 新建 Tunnel `zszm-lab-v2` 和 CNAME `pc-lab.iridescently.cn` | iridescently.cn | Claude | BLOCKED：本机自动权限拦截 DNS 写操作，没有向 Cloudflare 发出任何请求，所以 Cloudflare 侧没有任何变化 |

待执行：

- 负责人运行 `Setup-LAB-Tunnel.cmd`。执行后在这里补一行，填 Tunnel ID 和记录 ID（脚本会打印出来）。回滚方法：在 Cloudflare 删除这条记录和 Tunnel `zszm-lab-v2`，并删除 `secrets/lab-v2/tunnel.json` 与 `cloudflared.yml`。
- pc-* 清理：选定方案后，由负责人运行 `server\.venv\Scripts\python.exe scripts\cloudflare_lab.py delete-records docs\dns-plan-A.json --yes`（方案 A：18 条）。脚本会把实际删除的记录逐条打印出来，请把输出贴到这里。回滚方法：`cloudflare_lab.py restore-records <快照文件> <记录ID…> --yes`，按快照里的原始类型、目标和代理状态重建。删除之后，还要把 `operations/local-workspace.json` 的 `pcPreviewRoots` 改成 `["iridescently.xyz"]`，否则网站管家下次运行 pc-configure 会重建这些记录。
