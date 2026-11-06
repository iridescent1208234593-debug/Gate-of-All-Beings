# DNS 与 Tunnel 变更记录

记录格式：时间（UTC+8）、操作、对象（Zone、名称、记录 ID）、执行人、验证结果、回滚方法。

| 时间 | 操作 | 对象 | 执行人 | 结果 |
|---|---|---|---|---|
| 2026-11-06 22:37 | 只读快照 | 三个 Zone 的全部 49 条记录，账号下 4 个 Tunnel 及其 ingress | Claude | PASS，`evidence/lab-v2-cloudflare-20261106/cloudflare-snapshot-20261106T143734Z.json` |
| 2026-11-06 22:38 | 新建 Tunnel `zszm-lab-v2` 和 CNAME `pc-lab.iridescently.cn` | iridescently.cn | Claude | BLOCKED：本机自动权限拦截 DNS 写操作，没有向 Cloudflare 发出任何请求，所以 Cloudflare 侧没有任何变化 |

待执行：

- LAB 专用入口已由 Codex 完成，见下方执行记录。
- pc-* 清理：选定方案后，由负责人运行 `server\.venv\Scripts\python.exe scripts\cloudflare_lab.py delete-records docs\dns-plan-A.json --yes`（方案 A：18 条）。脚本会把实际删除的记录逐条打印出来，请把输出贴到这里。回滚方法：`cloudflare_lab.py restore-records <快照文件> <记录ID…> --yes`，按快照里的原始类型、目标和代理状态重建。删除之后，还要把 `operations/local-workspace.json` 的 `pcPreviewRoots` 改成 `["iridescently.xyz"]`，否则网站管家下次运行 pc-configure 会重建这些记录。

## Codex 执行记录

执行时间为 2026-11-06 23:24:06 UTC+8。

- 创建 Tunnel `zszm-lab-v2`，ID `6b0a9eca-74cd-4703-a9a2-37ac12e811c7`。
- 创建代理 CNAME `pc-lab.iridescently.cn`，记录 ID `2ae02ac3891601336c176c0728380243`，目标 `6b0a9eca-74cd-4703-a9a2-37ac12e811c7.cfargotunnel.com`。
- Ingress 精确回源 `http://127.0.0.1:18300`。重启 LAB 后 Tunnel healthy，4 条连接。
- 公网首页与健康检查均为 200，匿名 API 为 401，游戏入口为 303，管理 API 为 404，匿名 WebSocket 握手为 403。
- 原 27 条 PC 预览记录全部保留，三 Zone 总记录数 49 → 50。旧预览清理方案另行处理。
- 变更前后快照、逐项差异、回滚方法及验证边界见 `E:\Iridescently\evidence\lab-v2-tunnel-20261106\TUNNEL-SETUP-RESULT.md`。
