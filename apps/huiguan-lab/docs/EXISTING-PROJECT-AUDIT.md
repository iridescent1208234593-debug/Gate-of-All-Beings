# 旧工程审计（2026-11-06）

## 本机环境

| 项目 | 实测 |
|---|---|
| 系统 | Windows 11 家庭中文版 10.0.26200 |
| CPU / 内存 | Intel i7-14650HX，24 逻辑核；31.7 GB 内存，检查时可用约 10 GB |
| 显卡 | NVIDIA RTX 4060 Laptop、Intel UHD，另有三块虚拟显示适配器 |
| 磁盘 | C: 剩余 38.9 GB，D: 剩余 11.1 GB，E: 剩余 35.1 GB |
| Godot | `E:\Iridescently\labs\Godot\Godot_v4.7.2-stable_win64.exe`（4.7.2.stable.official.ed1daf0bf），导出模板 `%APPDATA%\Godot\export_templates\4.7.2.stable` 已安装。没有升级或降级 |
| Python | 3.14.6（系统）；R4 研究 venv 为 3.14；LAB 网关用 uv 管理的 3.12 venv |
| Node / Git / cloudflared | Node 24.18.0，Git 2.55.0，cloudflared 2026.7.3；没有 gh CLI |
| 网络 | Mihomo TUN（verge-mihomo 占用 53、7897 端口）。本机发出的外网请求经代理出口，端口探测结论不能代表公网可达性 |
| 已占用端口 | QQ、微信、Marvis 等占用 4001–14023 中的若干端口。LAB 选用的 18300–18302 空闲 |
| 本机自启动 | 计划任务里没有 iridescently、LAB 或 cloudflared 相关项，启动文件夹为空。符合「本机自启动全部关闭」的约定 |
| cloudflared | 没有安装成 Windows 服务，没有进程在跑。`~/.cloudflared/config.yml` 属于旧本机生产 Tunnel `main`，未启用 |

## 现有工程

| 工程 | 位置 | Git | 现状 |
|---|---|---|---|
| 栖风原 Phase 1C.3 | `labs/living-world-godot` | 不是 Git 仓库（只有 `.gitignore`），有基线 zip | Godot 桌面客户端，连接 R4 加森林领域扩展，带 2.5D 试景 |
| R4 世界服务 | `labs/iridescently-labs/research/experiments/living-world/r4` | 不是 Git 仓库 | 单机权威服务：Mesa 羊狼草生态，public/private 分支，snapshot 与 fork，会话、控制租约与 fencing，checkpoint 冷恢复，调度器。只有 alice、bob、operator 三个固定账号 |
| 地图原型 | `labs/zszm-godot-map` | 不是 Git 仓库 | 基于 godot-open-rpg 的格子地图、网页桥接和 Web 导出预设 |
| fengling-godot | `labs/fengling-godot` | 不是 Git 仓库 | 另一套 Godot 原型，本轮没有复用 |
| 正式站仓库 | `E:\Iridescently\repo`（`E:\Projects\.git` 的链接 worktree） | 当前检出 `fix/huiguan-palette-xss`，有别人未提交的改动；`origin/master` 已到 `43c96ed`，本地 master 落后 129 | 本轮没有改动这个检出 |
| 候选开源库 | `labs/godot-candidates`（25 个） | 各自是 Git 克隆 | 许可证见 OPEN-SOURCE-ASSETS.md |

## 已实现与未实现对照（相对 LAB V2 的需求）

| 能力 | 旧工程状态 | LAB V2 的处理 |
|---|---|---|
| 林间场景与客户端 | 栖风原桌面版已验收 | 复用团队美术和 2.5D 视觉方案，重写为联机客户端 |
| 探索与授权交互 | 服务端校验步长、速度和障碍，使用单一 Alice 身份 | 校验思路移植到网关 Hub，支持多玩家 |
| 公共世界与私人分支 | R4 snapshot 与 fork | 直接调用：灵质空间就是一条 R4 fork |
| 独立时间操作 | R4 私人分支可暂停或推进，公共分支由调度器驱动 | 直接调用（空间拥有者可以暂停、继续、快进；管理员可以调整测试分支） |
| 生物与生态 | Mesa 羊狼 | 直接调用，映射到会馆牧场 |
| 服务端权威与 fencing | R4 的 revision/CAS、幂等回执、租约 | R4 内部保持不变。实时移动不经过 R4 事务：R4 每条命令都要整库读写，撑不住 100 人每秒 12 次的位置流 |
| 断线重连 | R4 有 epoch 与重新授权；客户端有离线缓存 | 网关实现同码替换、位置恢复和指数退避重连 |
| 多人联机 | 没有（只有单一本机身份，HTTP 轮询） | 新写的 WebSocket Hub |
| 测试码与会话 | 没有（固定 bearer） | 新写 |
| OC 上传与捏人 | 没有 | 新写 |
| Web 导出 | 栖风原未验收，地图原型有导出预设 | 新的 LAB 客户端已导出，并在 Chromium 中实测 |
| 管理后台 | 没有 | 新写 |

## 当前复测结果

| 测试 | 命令 | 结果 |
|---|---|---|
| 栖风原 Phase 1C.3 统一验收（历史报告 139/139） | `VerifyPhase1C3.ps1`（2026-11-06 21:40 重跑；重跑前已把旧证据备份到 `living-world-godot-baselines/phase1c3-evidence-before-rerun-20261106`） | **FAIL**。服务端环境检查 25/25 PASS；原生客户端检查前 11 项 PASS，第 12 项 `nearby_interaction_enabled` 报 ERROR，后面的检查没有执行。重跑时机器同时在跑 LAB 构建和浏览器测试，可能与负载有关，但未经复现不能判定为偶发 |
| R4 历史报告（62 项加 26 项 HTTP 回归） | `r4/run.ps1` 是 1,000 tick 的长时基准 | NOT TESTED。没有重跑长时基准。R4 服务本身已作为 LAB 的世界后端实际运行，从 tick 0 正常推进，并完成了多次 snapshot 与 fork |
| 历史 95/95、82/82、70/70 | 旧 Phase 报告 | NOT TESTED，只当作历史证据 |

重跑旧验收时会启动栖风原的演示世界服务（端口 5321）。验收结束后已用 `StopWorld.ps1` 停掉，恢复成重跑前没有运行的状态。

## 可直接复用

- R4 服务（`service.py`）与它的 `/v1/world`、`/v1/commands`、`/v1/schedule` API，代码零改动，由 LAB 独立实例运行。
- 团队美术副本（`living-world-godot/assets/world`，授权见其 CREDITS.md）。
- 3D-Pixel-Campfire 的 surface、flame、sparks 着色器和 Campfire 子树（MIT）。
- 2.5D 方案：固定低分辨率视口、整数倍放大、正交镜头、分级光照。
- Noto Sans SC（OFL），裁成 GB2312 子集以控制网页包体积。

## 需要适配的接口

- R4 只有三个固定账号：网关统一用 operator 身份调用，玩家与分支的对应关系由网关管理。
- R4 Mesa 的历史上限是 1,001 tick：按默认每 60 秒一个 tick，公共世界大约 16.7 小时后会停在上限，需要管理员重置或换新的 R4 世界库。
- R4 代码里有历史绝对路径（`E:\Iridescently\labs\...`）：LAB 通过 `lab.config.json` 的 `r4_python`、`r4_service_dir` 配置 R4 位置，LAB 自己的代码不依赖任何历史绝对路径。
