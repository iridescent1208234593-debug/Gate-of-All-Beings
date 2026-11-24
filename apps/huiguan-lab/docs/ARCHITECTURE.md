# 架构与协议

## 进程与端口（全部只监听 127.0.0.1）

```
浏览器 ──HTTPS/WSS──> Cloudflare 边缘 ──> Tunnel zszm-lab-v2（cloudflared，本机）
                                              │  只路由 pc-lab.iridescently.cn，其余 404
                                              ▼
                               网关 127.0.0.1:18300（server/gateway.py，FastAPI + uvicorn/websockets）
                                 ├─ 测试码页 /、登录 API、Godot 网页包 /play/（需会话）
                                 ├─ WebSocket /ws：实时权威 Hub（server/lab/world.py）
                                 ├─ 只读监控 /monitor（monitor 角色）、美术上传 /art（art 角色）
                                 └─ SQLite runtime/data/lab.sqlite
                               管理台 127.0.0.1:18302（同一进程，不经 Tunnel，见 SECURITY.md）
                               R4 世界服务 127.0.0.1:18301（原 R4 代码不改，LAB 自己的数据库）
                                 └─ SQLite runtime/r4/world.sqlite，Mesa 生态（羊、狼、草地），分支、时钟
监督进程 server/supervisor.py：单实例锁，拉起 R4 → 网关 → Tunnel，失败重启有上限
```

为什么不用 ENet 或 Godot MultiplayerAPI：普通 Cloudflare Tunnel 只转 HTTP/WebSocket，浏览器里也不能用 UDP。权威逻辑要和 R4（Python）放在一起，用 Godot 的高层 MultiplayerAPI 就得另起一个无头 Godot 服务端再做桥接。所以客户端直接用 `WebSocketPeer` 加 JSON 协议，服务端是 Python asyncio Hub。原来的 R4 世界服务没有改动，网关只通过它的 HTTP API 读写。

## 数据归属

| 类别 | 存放 | 内容 |
|---|---|---|
| 本地个人数据 | 浏览器 IndexedDB（Godot `user://`） | 昵称偏好、OC 原图、捏人配置、显示设置。可以导出、导入、清除 |
| 服务器共享世界 | `lab.sqlite`、`world.sqlite` | 公共会馆、私人灵质空间及其拥有者、访问名单、互动物件状态、玩家最后位置、R4 生态、时间与分支 |
| 短期会话缓存 | 内存与 `runtime/oc-cache/`（6 小时 TTL，256 MB 上限） | 在线玩家 OC 的缩小展示副本（不超过 512 px，重新编码为 PNG） |
| 管理审计 | `lab.sqlite` 的 `audit`、`security_events` 表 | 管理员操作和认证事件，只记录测试码 ID 与地址的加盐哈希 |

服务器保存的玩家身份只有：测试码 ID、随机 pid、昵称和最后所在的空间与位置。

## 世界与空间

- 坐标：所有客户端和服务端共用 `client/data/spaces.json`，以米为单位，地面是 x/z 平面。2D 视图按每米 48 像素绘制，3D 视图把 x/z 直接作为 3D 坐标，两者看到的是同一个位置。
- 公共西木会馆对应模板 `hall` 和 R4 的 `public` 分支。
- 灵质空间对应模板 `lingzhi`。在「虹之间」开辟空间时，网关对 R4 的 public 分支做 snapshot，再从这个 snapshot fork 出一条私人分支，并把分支 ID 记到 `spaces.r4_branch`。所以每个灵质空间都是世界历史的一条独立分支：它从开辟那一刻的公共生态出发，之后单独演化，可以单独暂停或快进。R4 的分支属于 operator 账号，玩家与分支的拥有、邀请关系由网关的 `spaces`、`space_acl` 表管理，进出空间都在服务端检查。
- NPC：R4 actor 的格位通过模板里的 `pasture` 映射换算成米坐标。管理员生成的测试生物只存在于网关内存，不进 R4。
- 时间：R4 一个 tick 是世界里的 1 小时，公共分支每 60 秒推进一次（`r4_interval_seconds`）。网关持续核对：只要空间没有被 LAB 暂停，就确保它的 R4 调度在运行。R4 的 worker 偶发出错时会被重新启用，每个分支每小时最多 6 次。

## 实时协议（WebSocket JSON，protocol 1）

客户端发送：

| t | 字段 | 服务端校验 |
|---|---|---|
| hello | client, version | 发 welcome |
| profile | nick | 1–16 字，去掉控制字符和双向控制符 |
| move | x, z, dir, anim, seq | 速度上限 6.5 m/s，留 1.35 倍余量。逐段检查障碍和边界，不通过就回 `correct` |
| chat | text | 不超过 200 字，10 秒内最多 6 条，只发给同一空间 |
| emote | id | 必须在白名单内 |
| interact | object | 必须离物件足够近（半径加 0.6 m） |
| oc_set / oc_get / oc_clear | data(base64) / pid | 见 SECURITY.md。只能取同一空间玩家的 OC |
| space_create / space_enter / space_invite / space_revoke / spaces / space_time | … | 开辟空间和从会馆进入灵质空间都要站在虹之间附近。只有拥有者能邀请、撤销和调整时间。进入私人空间要么是拥有者，要么在访问名单上 |
| ping / rtt | id / ms | 测量往返延迟 |
| guide | seen?, status?, reset? | 新人引导「开始生活」章。`seen` 只做并集，键为 `[a-z0-9._-]`、最多 32 个；`status` 只接受 active/paused/completed/skipped（`veteran` 只由服务端判定）；`reset:true` 重新开始。回 `guide` |

服务端推送：`welcome`（空间、自己、在场玩家、物件、NPC、最近聊天、可见空间、时钟、`guide` 引导进度），`guide`，`s`（每秒 10 次的位置快照：只发变化的玩家，每 2 秒发一次全量），`join`、`leave`、`profile`、`chat`、`emote`、`object`、`npcs`（每秒一次，有变化才发）、`clock`、`oc_changed`、`oc`、`oc_result`、`portal`、`spaces`、`space_created`、`invited`、`notice`、`correct`、`kicked`、`error`。

客户端先在本地按同一套几何预测移动，每秒最多上报 12 次。其他玩家的位置延后 120 ms 做插值显示。同一测试码再次连接时，旧连接会收到 `kicked: replaced`，因此不会留下幽灵角色。断线后按 0.5、1、2、4…秒（最长 10 秒）重连。关闭码 4401 或 4403 表示会话失效，客户端会回到测试码页。

## 客户端（Godot 4.7.2，Compatibility 渲染器，Web 单线程导出）

- `scripts/net.gd`：WebSocket 连接与重连。
- `scripts/profile.gd`：本地个人数据。
- `scripts/web_bridge.gd` 加 `web/play/lab-bridge.js`：浏览器文件选择、下载和登出。
- `scripts/lab_world.gd`：世界镜像、几何、插值和 OC 纹理缓存，2D 与 3D 视图共用。
- `scripts/hall2d.gd`：2D/2.5D 视图。复用栖风原的团队美术（草地、树、门、苔石、花、奶鼠），按深度排序绘制。
- `scripts/hall3d.gd`：3D 像素视图。480×270 低分辨率 SubViewport 按整数倍放大，最近邻采样，正交镜头，使用 3D-Pixel-Campfire 的分级光照材质和篝火子树。OC 以 Y 轴 Billboard 显示，名字在全分辨率覆盖层上绘制。
- `scripts/avatar_editor.gd`：程序绘制的分层捏人编辑器，有人形、兽形、灵体、小鼠四种体型，导出透明 PNG。
- `scripts/main.gd`：界面、输入、首登设置、虹之间面板、本地数据面板、新手引导面板，以及供自动化测试使用的脚本输入（`?auto=`）。
- `scripts/life_guide.gd`：新人引导「开始生活」章（见下）。

## 新人引导「开始生活」

三章引导的最后一章（前两章在主站和会馆网页，见仓库 `docs/development/GLOSSARY.md` 的 Onboarding Progress）。进度存在 LAB 数据库 `life_guide(pid, status, seen, updated_at)`，按 LAB 玩家保存，所以同一玩家在 Web、Windows、Android 上不会重复学。没有引导记录、且玩家资料在引导上线（2026-11-25）前已有昵称的老玩家，首次连上时记为 `veteran`，不会被带着重走。

`life_guide.gd` 自成一体：外壳只做两件事——`register_target(名字, 取矩形的函数)` 告诉它 HUD 控件在哪，`on_event(事件, 数据)` 告诉它玩家刚做了什么。每一步在第一次用得上时出现、只讲一件事，玩家真的做到后才算完成；游戏不暂停、输入不被拦，提示条在宽屏靠右、手机在顶部，不挡场景中央。玩家刚做的事（切视图、进自己的空间、拿起园艺工具、打开小游戏或手记、走到可互动物件旁）对应的说明会优先出现，正在等待的建议稍后再回来。

| 事件 | 触发的步骤 | 完成条件 |
|---|---|---|
| welcome / profile_ready | move 先走两步 | 走满 2 m |
| （move 完成后） | chat 打个招呼 | 发出一条聊天 |
| （chat 完成后） | emote 动作 | 点任一动作 |
| near_object | interact 靠近就能互动 | 互动一次（触屏版本没有互动按钮时不出现、不计入完成） |
| （基础都完成后） | spaces 彩虹门 | 打开「虹之间」 |
| space_entered(private) | space-rules 你的灵质空间 | 知道了 |
| view_toggled | view 两种看法 | 知道了 |
| garden_tool / planted · minigame_opened · journal_opened | garden · minigame · journal | 知道了 / 种下 |

必修四步（move、chat、interact、spaces）完成即 `completed`。顶栏「新手引导」面板可以暂停、继续、重新查看、不需要引导。外壳通过 `has_joystick`、`has_touch_interact` 说明本版本触屏有哪些控件，引导不教不存在的操作。

**接入较新的客户端线**（运行副本、`feat/huiguan-native-world`）：加载 `life_guide.gd`，照 `main.gd` 里带 `guide.` 的十余行接上事件和目标；有摇杆、触屏互动键时把两个开关设为 `true`；在园艺工具切换、种下蘑菇、打开小游戏的地方分别调用 `on_event("garden_tool")`、`on_event("planted")`、`on_event("minigame_opened")`。服务端只需本分支 `store.py` 的表和 `world.py` 的 `guide_state` / `on_guide`。

单线程导出不依赖 SharedArrayBuffer，所以页面不需要 COOP/COEP 跨源隔离头，可以直接经过普通 Tunnel 访问。wasm、pck 和 js 在构建时预压缩成 br 与 gz，一次完整下载约 10 MB。
