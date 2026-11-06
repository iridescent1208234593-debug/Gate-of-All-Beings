# 安全、认证与生产隔离

## 与香港生产的隔离

- LAB 有自己的 SQLite（`labs/zszm-lab-v2-runtime/`）、自己的 R4 世界数据库和随机 R4 令牌（`secrets/lab-v2/r4-tokens.json`）。LAB 不读也不写 `runtime/production`，不使用任何生产密钥、生产数据库、生产 OAuth 或 SSO。
- 对外只有一个入口 `pc-lab.iridescently.cn`，走独立的 Tunnel `zszm-lab-v2`（凭据在 `secrets/lab-v2/tunnel.json`），不复用旧 PC 预览 Tunnel，也不复用香港 Tunnel。Tunnel 的 ingress 只有这一个主机名，其余一律 404。
- 网关会拒绝 Host 不在白名单内的请求（返回 421），白名单只有 `pc-lab.iridescently.cn` 和本机地址。
- 监督进程启动子进程前会清除 `WORLD_LAB_*`、`CLOUDFLARE*`、`CF_*` 等环境变量，避免继承外部凭据。

## 测试码与会话

- 测试码格式为 `ZSZM-XXXX-XXXX-XXXX-XXXX`，16 位随机字符（约 79 bit），字符表去掉了 0/O/1/I/L。服务端只保存 `HMAC-SHA256(pepper, 规范化后的测试码)`。pepper 是 `secrets/lab-v2/pepper.key` 里的 32 字节随机数，文件权限只给当前用户和 SYSTEM。
- 明文测试码只在生成时显示一次，显示在管理台屏幕上，或由 `labctl code-create --out` 写入 secrets 目录。数据库、日志和安全事件里都没有明文（测试 `test_valid_code_session_seven_days` 会实际检查）。
- 登录成功后发放 256 bit 随机会话令牌，Cookie 名 `zszm_lab_session`，属性为 HttpOnly、SameSite=Strict、Path=/；经 HTTPS 访问时加 Secure，有效期 7 天（Max-Age=604800）。服务端只保存令牌的 SHA-256。过期会话会被拒绝并删除。
- 失败限流：同一地址 10 分钟内失败 5 次，锁定 15 分钟；全局每分钟超过 60 次失败时，所有登录暂停 60 秒。失败响应统一延迟 0.4 秒，未知测试码和已停用测试码在时间上无法区分。
- 停用或撤销测试码：立即删除该码的全部会话，网关主动断开它的 WebSocket（管理台操作）。用命令行操作时，最迟 60 秒内由会话巡检断开。已撤销的测试码不能恢复。
- 地址只记录加盐哈希的前 12 位，CF-Connecting-IP 只在请求来自本机 cloudflared 时才采信。
- 角色分三种：`player`（游戏）、`monitor`（`/monitor` 只读视图，不显示测试码、地址和个人数据）、`art`（美术测试素材上传）。测试码没有任何管理员权限。

## 管理员

- 管理台只监听 `127.0.0.1:18302`，不在 Tunnel 的 ingress 里。即使请求来自本机，只要带有 `CF-Ray` 头或 Host 不是本机地址，一律返回 403。
- 管理员认证与测试码无关：密码用 scrypt（N=2^15, r=8, p=1）存在 `secrets/lab-v2/admin.json`。初始随机密码在 `secrets/lab-v2/admin-password.txt`，只有你的账户能读，用 `labctl.py admin-password` 修改。管理员会话 12 小时，Cookie 为 SameSite=Strict、HttpOnly。15 分钟内失败 5 次锁定。
- 所有写操作都要求自定义请求头 `X-Lab-Admin: 1`，Origin 也必须是本机管理台（防 CSRF）。影响公共会馆的暂停和恢复需要再输入空间 ID 确认。管理员操作写入 `audit` 表。

## WebSocket

握手时依次检查：Host 白名单、Origin（必须是 `https://pc-lab.iridescently.cn` 或本机地址；经过 Tunnel 而没有 Origin 的直接拒绝）、会话 Cookie、角色、在线人数上限（120）。被拒绝的握手记入安全事件，关闭码为 4401 或 4403。所有位置、聊天、空间访问和互动都在服务端校验，见 ARCHITECTURE.md。每个连接每秒最多处理 60 条消息。跟不上下发速度的客户端（发送队列超过 400 条）会被断开，然后自动重连。

## OC 图片

- 只接受 PNG 和 WebP。先看文件头魔数，再用 Pillow 读取实际格式，两者必须一致；扩展名不起作用。大小不超过 5 MB，边长 16–2048，并开启 Pillow 的解压炸弹保护。
- 图片会完整解码，只取第一帧，转成 RGBA，裁掉透明边，缩到 512 px 以内后重新编码为 PNG。元数据和文件尾部附带的任何内容都被丢弃，下发给其他玩家的只有这份新编码的图。
- 上传不涉及任何路径：服务端按随机 pid 写入 `oc-cache/<pid>.png`。
- 只发给同一空间内已认证的玩家。客户端没有下载或导出别人 OC 的功能。浏览器层面无法彻底防止截图，这一点写在 KNOWN-LIMITATIONS.md。
- 缓存会自动清理：玩家离线 10 分钟后删除，最长保留 6 小时，总量上限 256 MB（超出时先删最旧的）。没有永久素材库，也不会自动发布到档案室。

## 页面头

所有页面都带 CSP：`script-src 'self' 'wasm-unsafe-eval'`，外加 Godot 页面内联脚本的 sha256 哈希，不使用 unsafe-eval，也不允许其他内联脚本。另有 `frame-ancestors 'none'`、`X-Frame-Options: DENY`、nosniff、`Referrer-Policy: no-referrer`、COOP same-origin，经 HTTPS 访问时加 HSTS。

## 密钥位置（都不进 Git）

`secrets/lab-v2/`：`pepper.key`、`admin.json`、`admin-password.txt`、`r4-tokens.json`、`tunnel.json`、`cloudflared.yml`。Cloudflare API Token 仍由网站管家保存在 Windows 凭据管理器中，LAB 脚本只在内存中读取，不打印也不落盘。
