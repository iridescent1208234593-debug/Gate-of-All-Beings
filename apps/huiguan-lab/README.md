# 众生之门—西木会馆 LAB V2

在负责人的 Windows 主机上运行的独立游戏测试世界。玩家打开 `https://pc-lab.iridescently.cn`，输入各自的测试码，首次进入时设置昵称和 OC（上传透明底图片，或用内置捏人编辑器），然后进入 Godot 网页游戏。在公共的西木会馆里，玩家能看到彼此的 OC 和移动，可以聊天、做表情、和物件互动。玩家还可以在「虹之间」开辟自己的灵质空间（R4 世界的一条独立历史分支），邀请别人进来，或者收回邀请。2D 视图和 3D 像素视图连接的是同一个权威世界。

这是测试环境，不是生产：不连接香港正式服务，不使用任何正式数据和密钥。电脑开机、LAB 运行时可以访问；电脑关机时 LAB 下线。

## 快速开始

1. `Install-LAB.cmd`：安装依赖（首次）。
2. `Setup-LAB-Tunnel.cmd`：建立 LAB 专用外网入口（首次，需要负责人运行）。
3. `Start-LAB.cmd`。之后可以用 `Status-LAB.cmd`、`Stop-LAB.cmd`、`Restart-LAB.cmd`、`Backup-LAB.cmd`、`Restore-LAB.cmd`、`Update-LAB.cmd`。
4. 打开本机管理台 http://127.0.0.1:18302/ （密码在 `E:\Iridescently\secrets\lab-v2\admin-password.txt`），生成测试码发给玩家。

## 文档

| 文档 | 内容 |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 进程、端口、数据归属、空间与 R4 分支、实时协议 |
| [docs/EXISTING-PROJECT-AUDIT.md](docs/EXISTING-PROJECT-AUDIT.md) | 旧工程、环境审计和复测结果 |
| [docs/CLOUDFLARE-DNS-AUDIT.md](docs/CLOUDFLARE-DNS-AUDIT.md) | 三个 Zone、27 条 pc-* 记录的盘点与分类 |
| [docs/DNS-CHANGELOG.md](docs/DNS-CHANGELOG.md) | DNS 与 Tunnel 变更记录 |
| [docs/OPEN-SOURCE-ASSETS.md](docs/OPEN-SOURCE-ASSETS.md) | 依赖、素材来源与许可 |
| [docs/SECURITY.md](docs/SECURITY.md) | 认证、OC 安全与生产隔离 |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | 部署、运行、备份、自启动 |
| [docs/TEST-REPORT.md](docs/TEST-REPORT.md) | 测试结果与证据 |
| [docs/KNOWN-LIMITATIONS.md](docs/KNOWN-LIMITATIONS.md) | 已知限制 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 下一阶段 |

## 目录

`server/` 网关、监督进程、labctl、测试与负载测试 · `client/` Godot 4.7.2 工程 · `web/` 测试码页、管理台、监控页、美术上传页 · `scripts/` 控制、构建与 Cloudflare 脚本 · `docs/`。运行数据在 `../zszm-lab-v2-runtime/`，密钥在工作区的 `secrets/lab-v2/`，两者都不在源码目录里。
