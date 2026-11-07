# infra/frp — 三节点 FRP（官方 frp v0.71.1，TOML）

| 文件 | 用途 |
| --- | --- |
| `templates/frps.toml` | B：FRPS，`0.0.0.0:4000`，强制 TLS + 客户端证书 + token，dashboard 只绑 127.0.0.1 |
| `templates/frpc-pc.toml` | C：外连 B，只发布只读 agent（STCP） |
| `templates/frpc-hk.toml` | A：外连 B，只发布只读 agent（STCP）；不碰香港原有服务与 Tunnel |
| `templates/frpc-b-visitor.toml` | B：STCP visitor，127.0.0.1:12410（C agent）/ 12411（A agent） |
| `templates/optional/pc-ssh.md` | 可选：经 FRP 访问 C 的 SSH（默认关闭，说明了前置条件） |
| `render.py` | `init` 生成随机值、`pki` 生成 CA 与证书、`render` 渲染到 secrets、`check` 安全检查 |
| `bundle.py` | 组装各节点安装包（只在 `secrets/ops-frp/bundles/`） |
| `install-linux-node.sh` | A/B 安装与卸载（负责人批准后运行；下载官方包并校验 sha256，先 `verify -c` 再启动） |
| `verify-mapping.py` | 从外部核验 55404 真的到达我们的 FRPS（比对证书指纹） |

所有密钥、证书、渲染结果都在 `<工作区>/secrets/ops-frp/`，不进 Git。设计与部署步骤：[docs/three-node-ops.md](../../docs/three-node-ops.md)。
