# Cloudflare DNS 与 Tunnel 审计（2026-11-06）

数据来源：2026-11-06 22:37（UTC+8）用网站管家保存的 Token 只读调用 Cloudflare API。完整导出在 `E:\Iridescently\evidence\lab-v2-cloudflare-20261106\cloudflare-snapshot-20261106T143734Z.json`，回滚时以它为准。Token 有 Zone Read、DNS Read、Tunnel Read 和 Tunnel 配置读取权限，均实测可用。写权限没有测：本机的自动权限把 DNS 与 Tunnel 写操作拦了下来，见文末。

## 三个 Zone

| Zone | ID | 类型 | 状态 | 记录数 |
|---|---|---|---|---|
| iridescently.cn | 508706d88270cdb7b3a01b7db9545ce0 | full（NS 在 Cloudflare） | active | 20 |
| iridescently.dpdns.org | 3a8ef36ef4b3cc9be88427c1c3f0bff1 | full | active | 14 |
| iridescently.xyz | 877486776bed7d0555c6c3b23eb9a454 | full | active | 15 |

三个 Zone 同属账号 `7144e252e82ff7d91ca3019201697b11`，合计 49 条记录。

## 账号下的 Tunnel

| Tunnel | ID | 当前状态 | 用途（由 ingress 判断） |
|---|---|---|---|
| iridescently-pc-preview | b79024ab-6d94-49f8-9583-5b32c8f55264 | down，0 连接 | 旧 PC 预览。27 个 pc-* 主机全部转到 `127.0.0.1:18190`（网站管家的 pc-preview 网关） |
| zszm-hk-ecsvkdu0 | 6c9eb0eb-26d7-451c-9dbd-878e7c14f4a7 | down，0 连接 | 香港生产。`.xyz` 与 `.dpdns.org` 的正式主机指向它 |
| main | 4c3072da-ee08-4c0c-b13d-cfca9c51dc05 | down，0 连接 | 早期本机生产（`~/.cloudflared/config.yml`），已不在使用 |
| backup-hk | b777559c-ab1d-4538-9673-97e081ff4df2 | down，0 连接 | 早期香港备份入口 |

**需要你留意（只读发现，未做任何改动）**：四个 Tunnel 在检查时都没有连接器，其中包括香港生产的 `zszm-hk-ecsvkdu0`。`.cn` 正式站走 CDN CNAME（`*.cnmnmsl.top`，不经 Tunnel），所以不受影响。`.xyz` 与 `.dpdns.org` 的正式主机在 DNS 上仍指向这个 Tunnel。这属于生产范围，本轮只报告、不处理。另外，`pc-*.iridescently.xyz` 当前返回 403，说明 `.xyz` Zone 上有一条拦截规则。`.cn` 与 `.dpdns.org` 的 pc-* 返回 530，即 Tunnel 不在线。

## 27 条 pc-* 记录

三个 Zone 各 9 条，全部是 CNAME，指向 `b79024ab-6d94-49f8-9583-5b32c8f55264.cfargotunnel.com`，全部开启代理。旧 Tunnel 的 ingress 正好包含这 27 个主机名，没有多也没有少。

| 前缀 | 对应正式服务 | .xyz 记录 ID | .cn 记录 ID | .dpdns.org 记录 ID |
|---|---|---|---|---|
| pc | 主站 | 3500b961f31e23319be36fca4f51db73 | 270e7d5c7baa9b84ec112f825424b064 | 7591410b336716fa22198567584888b8 |
| pc-www | 主站 www | fc9ccab316a671698be5db602f659496 | fb128c69a9c0f98c089aa22356a58a4f | a043d1bb121cc5c8ec68781c8cc54a96 |
| pc-huiguan | 西木会馆 | 954a3074f872b84ebc48102031dbb5a2 | 76aa9db6c5b8c9cbdc45e2daa05f514e | 5ea4bc85f335693e3264b1de22f107a1 |
| pc-oc | OC 站 | 830cbb6fb1c8c0c8d89d3170cd32d6d1 | bd41cc7f11bf64eb20afc248806493ee | f2f5cec6b35c0f9680def2e8b1bcb5ce |
| pc-zszm | 众生之门 | edf98f10f277e851475a45595de289d0 | 886fb2cc7d8f6f0624f27443c1b70cc8 | f2787dbc785b5a796d1808a2991566d8 |
| pc-spirit | 灵体 | d350fcb885976e5f271f713f05aebe17 | 5f4edf91788bfed89d80df65bbb37e9c | c6597d8a1d44b67e131b3c202109faeb |
| pc-game | 游戏 | 577b6ed54b43a05ed1c659f537bcc6e7 | 974dcd8296dfe08ca4c8312c28356686 | 0528d9f888a542d144f333bd42e622d2 |
| pc-juling | 聚灵 | 00b6f7e0e879729d1ba3920c6e773467 | 7c33ab40a621cf642d78ed5a5cfd0586 | bf433c070d6a234cb19a026540cc6c85 |
| pc-lingjing | 灵境 | d9a066e244cd1ec5c7505353983ba5b7 | d58bdd8d5497473f9eb864a31cafaaf6 | 68b99e4fb2eacbde2e66e5a668d40a14 |

本机回源：旧 Tunnel 的连接器（网站管家「PC 预览」，`operations/server-control.py pc-start`）启动后，全部转到 `127.0.0.1:18190` 的 `operations/pc-preview.py`。这个网关按 `operations/local-workspace.json` 的 `pcPreviewData`（当前为 `hk`）把 `/api` 代理到同根域的香港正式服务，页面用本机封存的 Release。所以 pc-* 是「正式站的本机预览」，与新游戏 LAB 无关。

依赖：
- 代码依赖：`operations/pc-preview.py` 由 `pcPreviewRoots`（当前三个根域都在）生成主机表，`server-control.py pc-configure` 为每个根域建 9 条记录。删除记录前，应把 `pcPreviewRoots` 改成只剩保留的根域，否则下次 pc-configure 会把记录重建出来。
- 运行依赖：当前没有。Tunnel 不在线，27 个主机都无法正常访问（`.xyz` 403，其余 530）。
- 生产依赖：没有。pc-* 不出现在香港生产 Tunnel 的 ingress 里，生产主机也没有指向旧预览 Tunnel。

## 分类与去向

| 分类 | 记录 | 理由 |
|---|---|---|
| 必须保留 | 无 | LAB 不依赖任何 pc-* 记录 |
| 可以统一到新入口 | 无 | LAB 只用 `pc-lab.iridescently.cn` 一个主机，与正式站预览不是同一用途 |
| 可以通过重定向替代 | 无 | 都是同一服务的预览入口，没有需要保留的外链 |
| 已无用途，可以删除 | `.cn` 9 条，`.dpdns.org` 9 条 | `.cn` 正式站已迁到 CDN，`.cn` 预览会和 CDN 方案并行出现第二套入口。`.dpdns.org` 的预览接口本来就返回香港的「站点已迁移」页 |
| 用途不明，保留并标记 | `.xyz` 9 条 | 网站管家「PC 预览」仍能使用的唯一一组，`.xyz` 仍是 canonical。是否还需要整个 PC 预览功能，由你决定 |

推荐方案 A：删除 18 条（`.cn` 与 `.dpdns.org`），保留 `.xyz` 9 条给 PC 预览，并新增 `pc-lab.iridescently.cn` 1 条。记录总数从 49 变为 32，pc-* 从 27 变为 9，另有 1 条 LAB 入口。
方案 B：PC 预览整体退役，删除全部 27 条，并删除旧 Tunnel 的 ingress。记录总数变为 23，另有 1 条 LAB 入口。
方案 C：全部保留。

不建议使用通配符：三个 Zone 都有正式子域名，`*.iridescently.cn` 会接住所有未定义名字。`.cn` 正式主机是不经代理的 CDN CNAME，通配符一旦开启代理就会把拼错的主机名送进 Tunnel。Universal SSL 只覆盖一级子域，记录本来就不多，精确记录更安全。

## 执行状态

- 只读快照：PASS（见上方 evidence 文件）。
- 新入口 `pc-lab.iridescently.cn` 与 Tunnel `zszm-lab-v2`：BLOCKED。本机的自动权限拦截了「DNS / Domain / Cert Changes」类操作，不是 Cloudflare 权限不足。负责人双击 `Setup-LAB-Tunnel.cmd` 即可完成。
- 旧记录清理：NOT TESTED，等你在方案 A/B/C 中选择。删除由 `scripts/cloudflare_lab.py delete-records <plan.json> --yes` 执行。它逐条校验记录 ID、名称和目标与计划一致，并只接受 pc 开头的名字。恢复用 `restore-records <快照> <记录ID…> --yes`。执行结果写入 `DNS-CHANGELOG.md`。
