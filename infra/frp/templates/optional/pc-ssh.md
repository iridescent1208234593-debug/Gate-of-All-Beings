# 可选：经 FRP 访问 C 的 Windows SSH（默认关闭）

默认配置不发布 C 的 22 端口。原因：B 是新机器，公网 22 允许密码登录（2026-11-07 实测），一旦 B 被攻破，
B 上的 visitor 就是进入 C 的直接通道；而且 C 当前没有安装 sshd。

只有负责人决定需要时才启用，并且先满足：

1. C 安装 OpenSSH Server，`sshd_config` 设置 `PasswordAuthentication no`、`PubkeyAuthentication yes`、
   `ListenAddress 127.0.0.1`、`AllowUsers <你的账号>`；防火墙不放行 22 入站（只给 FRP 走 loopback）。
2. B 的公网 SSH 改为仅密钥登录（`PasswordAuthentication no`）并确认 8080 上的 IIS 来源。
3. 优先把 visitor 放在操作者自己的机器上，而不是 B；必须放 B 时 bindAddr 只能是 127.0.0.1。

启用方法：把下面两段分别追加到 `frpc-pc.toml` 与 `frpc-b-visitor.toml`，在 values.json 加 `STCP_KEY_PC_SSH`，
用 `render.py check --allow-pc-ssh` 检查后再 render。

```toml
# frpc-pc.toml
[[proxies]]
name = "ssh"
type = "stcp"
secretKey = "{{STCP_KEY_PC_SSH}}"
allowUsers = ["ops-b"]
localIP = "127.0.0.1"
localPort = 22
transport.useEncryption = true
```

```toml
# frpc-b-visitor.toml
[[visitors]]
name = "pc-ssh"
type = "stcp"
serverUser = "pc"
serverName = "ssh"
secretKey = "{{STCP_KEY_PC_SSH}}"
bindAddr = "127.0.0.1"
bindPort = 12022
transport.useEncryption = true
```
