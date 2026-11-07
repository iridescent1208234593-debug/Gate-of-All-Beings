# 部署与运维

## 谁在哪里运行

| 环境 | 位置 | 代码来源 | 谁改动 |
| --- | --- | --- | --- |
| 生产 | 香港服务器，经 Cloudflare Tunnel 对外 | 香港自己的发布目录（旧布局 + 10-24 安全加固谱系 + 之后的线上热修复），不是本仓库的封存 Release | 只在负责人授权下发布；本机不承载生产流量 |
| 本机 | 工程工作区（见 [工程工作区](workspace.md)） | 本仓库 trunk 封存出的 Release（`<runtime>/<environment>/releases/store/<id>`，由 channel 选择） | 本机开发与验证 |
| 测试 | 临时目录 | 当前检出 | `tools/checks/regression.py`，只用临时 `test` 存储 |

本机不再兼任生产源站：旧的"网站管家一键恢复全部站点 + 隧道"、把 `config.yml` 指向 8080 的切换/回滚、本机 `main` Tunnel 连接器，都是香港迁移之前的做法，已经退役。Tunnel、DNS 与 Cloudflare 设置属于生产配置，不在本机运维流程里改动。

## 本机服务：只有一条启动路径

```powershell
python tools/runtime/local-runtime.py start     # 校验 channel 选中的封存 Release，只在 127.0.0.1 启动五个服务
python tools/checks/local-smoke.py              # 只读冒烟（三根域页面/API、Origin 与 WebSocket 拒绝、421）
python tools/runtime/local-runtime.py status | stop
```

`local-runtime.py` 不启动 Tunnel、不连香港、不改 DNS；数据来自外部存储，缺少就绪标记时拒绝启动。网站管家（工作区 `operations/网站恢复/website-manager.py`）是同一套启动逻辑的图形界面。要让本机跑新代码：`npm run build:site`、`npm run build:release`、`npm run release:seal`；回滚：`npm run release:rollback -- <release-id>`（只移动 channel）。封存前先 `python tools/runtime/backup-storage.py snapshot`。

### 端口

| 端口 | 服务 | 本机启动方式 |
| --- | --- | --- |
| 8080 | 统一入口（www、huiguan、oc、壳、游戏模块、API 代理） | `local-runtime.py` |
| 5174 | 卡牌 OAuth 代理 | `local-runtime.py` |
| 5177 | 聚灵 | `local-runtime.py` |
| 5178 | 卡牌数值配置 API | `local-runtime.py` |
| 4173 | 软乎乎 / 灵体服务 | `local-runtime.py` |
| 5173 / 5179 | 卡牌、灵境会馆的前端开发服务器 | `npm run dev`（各自目录），不属于本机 runtime |
| 8088 / 8089 / 8090 | 主站、会馆、人设站单站 | 只用于单独调试；统一入口已在进程内提供 |

### 监听地址

统一入口（8080）和三个单站（8088/8089/8090）都只监听 `127.0.0.1`，规则在 `services/platform/listen_address.py`：Tunnel 与统一入口都在本机访问它们，不需要外部网卡。只有同时设置 `IRIDESCENTLY_ENVIRONMENT=development` 和 `HOST=<地址>`（如 `HOST=0.0.0.0`）才会监听局域网，用于临时 LAN 调试；其他环境（包括未设置）一律忽略 `HOST` 并在 stderr 提示。`HOST` 非敏感、非必填、默认 `127.0.0.1`。回归检查：`services/platform/tests/test_listen_address.py`。

同一端口只能有一个占用者。登录时自动启动、并占用以上端口的旧任务会让 `local-runtime.py` 启动失败（例如 2026-10-26 前仍在的 `D:\Projects\zszm` 5178 预览任务）。

## 香港发布

香港仍运行旧布局，发布工具在工作区 `operations/`（`hk-release.py`，以 `local-workspace.json` 的 `hkProjectRoot` 为旧布局根），不在本仓库。它的全量打包来自本机旧快照；香港当前版本不是本机构建的时候，`prepare` 会拒绝执行，避免回退在香港直接发布的修复。只替换指定文件时用 `--base-version` + `--overlay-list`，叠加内容由 `infra/hk-legacy/build_overlay_candidate.py` 从明确的 Git ref 读取。把本布局部署到香港是单独授权的阶段（先迁移香港数据到存储契约）。

线上热修复必须同时进入 trunk，规则见 [分支策略](development/BRANCH_STRATEGY.md)。

## 三服务器只读运维

香港 A、运维服务器 B、本机 C 之间的 FRP 互联与只读监控见 [three-node-ops.md](three-node-ops.md)。第一阶段只读，未部署；B 与香港的安装需要负责人逐项批准。

## 数据维护

- 持久数据在外部 data 根（`<data>/huiguan/users.db`、`<data>/juling/` 等），不在源码树。一致性快照：`python tools/runtime/backup-storage.py snapshot`；校验：`… verify <快照目录>`。
- 世界观库搬移后重链：`python "assets/罗小黑战记数据库/relink_db.py"`（预演）→ `--apply`（自动备份 `.bak-<时间戳>`）。
- 恢复步骤见 [恢复手册](recovery.md)。

## 排障

| 现象 | 处理 |
| --- | --- |
| `local-runtime.py start` 某服务不健康 | 看 `<cache>/logs/local-runtime/<服务>.log`；先查端口是否被别的进程占用：`netstat -ano | findstr :5178` |
| 服务拒绝启动，提示 readiness marker | 存储根不对或被手工移动过；用 `tools/runtime/relocate-storage.py` 搬迁，不要手改标记 |
| 模块页 css/js 大量 404 | 统一入口曾因 keep-alive 未重新分发；确认 `Dispatcher.handle_one_request` 保留 try/finally 恢复 |
| 本地跨域资源 ERR_BLOCKED_BY_ORB / CORS | 会馆设计系统/SSO 走独立子域，本地跨 8080↔8089 会被拦，属预期 |
| 会馆图片 404 | 世界观库路径失效 → 跑 `relink_db.py` |
| 重复进入游戏出现双循环 | 模块未提供/未调用 `__iridescentlyDispose` |

## 日志

- 本机服务：`<cache>/logs/local-runtime/<服务>.log`。
- 网站管家：`<工作区>\operations\网站恢复\logs\<站点>.log`。
