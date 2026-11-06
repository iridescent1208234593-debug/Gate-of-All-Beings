# 部署与运行（Windows 本机）

## 目录

| 位置 | 内容 |
|---|---|
| `E:\Iridescently\labs\zszm-lab-v2\` | 源码：`server/`（网关、监督进程、测试）、`client/`（Godot 工程）、`web/`（测试码页、管理台、监控页）、`scripts/`、`docs/`、`build/web/`（构建产物，不入库） |
| `E:\Iridescently\labs\zszm-lab-v2-runtime\` | 运行数据：`data/lab.sqlite`、`r4/world.sqlite`、`oc-cache/`、`art-uploads/`、`logs/`、`backups/`、`state/`、`evidence/`。代码不选择数据，位置来自 `lab.config.json` 或环境变量 `LAB_RUNTIME` |
| `E:\Iridescently\secrets\lab-v2\` | pepper、管理员密码哈希与初始密码、R4 令牌、Tunnel 凭据与 cloudflared 配置。权限只给当前用户和 SYSTEM |

可选配置文件 `labs/zszm-lab-v2/lab.config.json`（参照 `lab.config.example.json`）可以覆盖端口、运行目录、R4 位置、R4 推进间隔和 Tunnel 开关。

## 一键脚本（LAB 根目录）

| 脚本 | 作用 |
|---|---|
| `Install-LAB.cmd` | 用 uv 创建 3.12 venv 并安装依赖，检查 R4、cloudflared，没有管理员密码时提示设置 |
| `Setup-LAB-Tunnel.cmd` | 只需执行一次（负责人运行）：新建 Tunnel `zszm-lab-v2` 与 CNAME `pc-lab.iridescently.cn`，然后重启 LAB |
| `Start-LAB.cmd` | 启动监督进程（R4 → 网关 → Tunnel），等网关就绪后退出。已在运行时不会重复启动 |
| `Stop-LAB.cmd` | 写入 `state/stop.request`，网关先保存玩家位置再退出，接着停 Tunnel 和 R4。30 秒内没退干净就强制结束 |
| `Restart-LAB.cmd` | 先 Stop 再 Start |
| `Status-LAB.cmd` | 各进程是否存活、重启次数、网关健康状态、数据统计、自启动状态 |
| `Backup-LAB.cmd` | 在线备份 `lab.sqlite` 和 `world.sqlite`（SQLite backup API），生成带 sha256 的 manifest，保留最近 14 份。只备份 LAB 自己的小数据库，不做任何素材全量快照 |
| `Restore-LAB.cmd <备份目录>` | 校验 sha256，先停 LAB，自动再做一份 `pre-restore` 备份，然后恢复，最后启动 |
| `Update-LAB.cmd` | 备份，重新导出 Web 客户端，跑服务端测试，全部通过才重启 |

开机自启默认关闭，与本机自启动全部关闭的约定一致。需要时运行 `powershell -File scripts\lab.ps1 autostart on`（注册登录触发的计划任务 `ZSZM-LAB-V2`，设置为 MultipleInstances=IgnoreNew）；`autostart off` 取消。不会重复启动有三层保证：计划任务本身不并行；监督进程持有 `state/supervisor.lock`；网关和 R4 各自持有数据库锁。

## 故障恢复

每个子进程 10 分钟内最多重启 5 次，退避时间为 2、4、8、16、30 秒，超过就标记为 failed 并停止重启，原因写入 `logs/supervisor.log`。R4 某个分支的调度因 worker 错误停下时，网关会重新启用，每个分支每小时最多 6 次。电脑关机时 LAB 下线；开机后运行 Start-LAB（或打开自启），共享世界会从 SQLite 恢复，玩家回到最后所在的空间和位置。

## 地址

- 本机：http://127.0.0.1:18300/
- 管理台（只限本机）：http://127.0.0.1:18302/ ，初始密码在 `secrets\lab-v2\admin-password.txt`
- 外网：https://pc-lab.iridescently.cn/ （需要先运行 Setup-LAB-Tunnel.cmd）

## 发测试码

在管理台「测试码」里填备注、选角色（玩家、只读监控或美术上传）和数量，点「生成」。明文只显示这一次，复制后发给对应的人。也可以用命令行：`server\.venv\Scripts\python.exe server\labctl.py code-create --label 名字 [--count N] [--out E:\Iridescently\secrets\lab-v2\codes.txt]`。

## 构建客户端

`scripts\lab.ps1 build`（即 `scripts/build-web.ps1`）：调用 Godot 4.7.2 无头导出 Web 版（单线程，Compatibility 渲染器），复制 `lab-bridge.js`，预压缩成 br 和 gz，写入带文件哈希的 `build-info.json`。网关启动时读取客户端版本号，所以重新构建后要重启一次网关。

## 测试

- 服务端集成测试：`server\.venv\Scripts\python.exe -m pytest -q server\tests`。会起一个真实网关进程，使用临时目录，不碰线上 LAB 数据。
- 双浏览器端到端测试：`server\.venv\Scripts\python.exe server\e2e_browser.py --base <地址> --codes <码A> <码B> --out <证据目录>`。
- 负载测试：`server\.venv\Scripts\python.exe server\loadtest.py --stages 2 10 30 50 100 --seconds 30 --out <目录>`。会单独起一个使用临时目录的网关。
