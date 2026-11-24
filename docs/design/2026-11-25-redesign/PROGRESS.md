# 全项目视觉重构 · 进度与覆盖清单

分支 `feat/onboarding-visual-redesign`（基于 master `5154cb2`），工作树 `E:\Iridescently\worktrees\feat-onboarding-visual-redesign`。
证据 `E:\Iridescently\evidence\onboarding-visual-redesign-20261125\`（`before/`、`after/`、`compare/`）。
设计系统见 [lingxi-design-system.md](../lingxi-design-system.md)。本文件记录事实，跨会话续做从「下一步」开始。

## 状态一览（2026-11-25）

| 范围 | 状态 |
|---|---|
| P0 新人引导（三章 + 统一进度） | **完成并验证**，见下 |
| 设计系统（令牌、引导部件、Web↔Godot 对应） | 令牌与引导部件完成；各页尚未迁移到 `--ling-*` |
| 全站页面视觉改造 | **未开始**（只做了审计与改造前截图） |
| LAB HUD / 登录 / 设置 / 管理台视觉改造 | **未开始**；见「阻塞」 |
| 动效（众生之门开启、灵卡、手记翻页等） | **未开始** |

## P0 新人引导 · 已交付

| 章 | 落点 | 验证 |
|---|---|---|
| 认识世界 | 会馆首页（主站根域落地页） | 浏览器场景 A–D（开场中不出现、暂停/继续/Esc、跳过与「更多·新手引导」重看、老浏览器不重走、reduced-motion） |
| 建立身份 | 登记表、登录、首次登记成功、同人画廊 | 场景 E（表单→输入反馈→账号提示→真实登录框）、F（账号进度跨设备）、G（老账号 veteran）、H（访客进度登录后并入）、I（画廊手机一次性提示、无横向溢出）、J（老账号打开表单不出现提示、仍为 veteran）、K（提示不抢输入框焦点；Esc 只关当前提示）、L（同一浏览器换账号不串进度） |
| 开始生活 | LAB Godot 客户端 | 网关测试 2 项；两名真实浏览器玩家（1280×720 键盘、844×390 触屏）12 项：走路（真实按键）→聊天→动作、第二玩家独立进度、同一世界、2D/3D 即时解释、重连后进度保留、互动→虹之间→章完成 |

结果文件：`after/web-scenarios/results.json`（34/34）、`after/lab-two-clients-run1|run2/results.json`（12/12，连续两次）。LAB 网关测试 13/14：失败的 `test_ws_requires_session_origin_and_host` 期望 421 得到 502，在未改动的 master 上同样失败，是本机代理（Mihomo TUN）拦截了带伪造 Host 的请求。另有一次早期运行在脚本化「走到照林花」那步卡住（L10），之后同一场景连续 3 次通过，判断为脚本输入的寻路偶发，记为待观察。

### 独立代码审查（新上下文，2026-11-25）

审查提出 15 项，已逐项对照代码核实并处理：
- 已修：老账号做一次标记就被服务端改回 active（客户端不再为已完成章发 status，服务端只允许 reset 重新打开）；提示抢走正在输入的焦点；Esc 关提示却暂停整章；「上一处」或整页目标不可见时把引导记为完成；固定上线日期判断老用户（改为「首次被引导见到时账号已超过 24 小时或已有 OC」，LAB 改为「首次见到时已有昵称」）；步骤键允许 Unicode 与文档不符；tour 覆盖 hint 不清理监听；登录后的账号进度写进浏览器共享副本、换账号后串到另一账号；Godot「好」重复隐藏丢掉下一条、点「好」就把互动和虹之间记为已学会；服务端回声覆盖更新的本地进度；单行 lambda；SVG 渐变 id 重复；残留注释与测试桩；每次请求都读 OC 列表。
- 记录未改：POST /api/onboarding 与 /api/legal/accept 一样依赖同站 Cookie 与入口层的 Origin 检查（入口对跨站带 Origin 的写请求已拒绝）；`huiguan:auth-changed` 在每次登录检查时触发一次 GET。
对比截图：`compare/home-newvisitor-10s__{desktop,laptop,tablet,mobile}__{before,after}.jpg`（同页、同视口、同一时刻的新访客）。

被取代并删除的旧实现：首页「先给你的创作留个归处」模态框（每次加载、每次关闭登录框都弹）、登记表上方的静态「新手指引」。众生之门的 `PlayerOnboarding`（选名字、种族、头像，负责人已验收）是身份创建流程，不是教程，保留不动。

## 回归

`tools/checks/regression.py`（未带 `--full`）在本分支有 10 项失败。逐项核对后均为环境问题，与本分支无关：
- 7 项：测试全部断言通过后，Windows 在清理临时目录时报 `WinError 32`（日志或 SQLite 文件仍被占用）。在未改动的 master（稀疏检出 `scratch\onboarding-redesign\master-baseline`）上同样失败，已复现 3 项。
- `test_runtime_services`、`activation-core`：本工作树未安装 `node_modules`（磁盘只剩约 5 GB，未重复安装）。
- 新增 `test_onboarding_progress_http.py` 通过。

## 页面清单与审计发现（改造前）

| 站点 | 页面 | 文件 | 主要问题 | 状态 |
|---|---|---|---|---|
| 会馆 | 首页 / 开场 / 档案室 / 登记 | `apps/huiguan/index.html`（4.5k 行，4 段内联样式） | 新访客被模态框打断；三扇门没有说明这里是什么；手机顶栏只剩「更多」，会馆与众生之门入口被藏起；登录后连续弹两个模态框（群昵称、同人画廊建议） | 引导已改；视觉未改 |
| 会馆 | 官方档案 | `gallery.html` | 局部 `:root` 与 design-system 重复 | 未改 |
| 会馆 | 官方同人画廊 | `works.html` | 同上 | 未改 |
| 会馆 | 同人画廊 + 审核 | `fan.html`（967 行） | 浅色纸面与首页夜林割裂；工具栏、分区、排序挤在一起 | 引导已加；视觉未改 |
| 会馆 | 官方角色详情 | `char.html` | — | 未审 |
| 会馆 | OC 展示 | `show.html` | — | 未审 |
| 会馆 | 个人中心 / 账户安全 | `account.html`、`security.html` | — | 未审 |
| 会馆 | 审核中心 / 成员管理 | `admin.html`、`member.html` | — | 未审 |
| 会馆 | 会馆信息 / 须知 / 隐私 | `info.html`、`terms.html`、`privacy.html` | — | 未审 |
| 会馆 | 关系图 / 表情包 / 海报 | `relation.html`、`stickers.html`、`haibao/` | — | 未审 |
| 主站 | 节气图库 | `apps/www/homepage.html`（构建为 `index.html`） | 生产根域 `/` 302 到会馆，图库在 `/gallery.html` | 未审 |
| 主站 | 连接与鸣谢 / 共创名录 | `apps/www/connections.html` | 独立的 `--connections-*` 令牌 | 未审 |
| 人设站 | 佳霖 / 三足乌 | `apps/oc/index.html` | 与会馆重复的 `:root` | 未审 |
| 众生之门 | 统一壳与模块 | `apps/shell`、`apps/cards` 等 | — | 未审 |
| LAB | 测试码页、管理台、监控、美术上传 | `apps/huiguan-lab/web/*` | 共用 31 行 `lab.css` | 未审 |
| LAB | 游戏 HUD | `client/scripts/main.gd` | 顶栏为默认灰按钮；聊天记录白字直接压在场景上；虹之间等面板是未加样式的默认面板；触屏没有摇杆与互动键（较新线已有） | 引导已加；视觉未改 |

改造前截图：`before/`（会馆 9 页 × 4 视口，含 `report.json` 的横向溢出与报错）、`before/home/`。测试存储是空的，「官方档案暂时无法加载」与破图来自空库，不是缺陷；正式对比前要先灌入脱敏样例数据。

## 阻塞与待负责人决定

1. **LAB 有三条分叉的客户端线**：master（`main.gd` 785 行）、运行副本 `labs\zszm-lab-v2`（1087 行，不在 Git，11-21 修改，含摇杆、小游戏、狼人杀、技能、种植、人模头像）、Codex 工作树 `feat/huiguan-native-world`（1520 行，**未提交**，11-22）。本分支只改 master 线，并把引导做成可插拔模块；接入较新线的方法写在 `apps/huiguan-lab/docs/ARCHITECTURE.md`「新人引导」。LAB 的 HUD 视觉改造要等负责人决定以哪条线为准，否则会与未提交的工作冲突。
2. 运行副本里的手记、种植、小游戏在 master 不存在；对应引导步骤已定义，但只在接入较新线后出现。
3. 本机无 `gh`，PR 需要负责人点开对比链接。

## 未验证

- Windows 原生、Android 客户端：只验证了 Web 导出；原生版本未构建、未上真机。
- 真实手机与平板：只用桌面 Chrome 模拟视口与触屏。
- 性能：没有做加载与帧率对比，不提供数字。新增静态资源实测：`guide.js` 30.4 KB（gzip 9.3 KB）、`guide.css` 11.6 KB（gzip 3.3 KB）、`lingxi.css` 8.2 KB、会馆 `onboarding.js` 9.6 KB；无外部依赖，不引入 Remotion。
- 英文界面：引导文案只有中文。
- 断线重连时的引导表现：重连保留进度已验证；断线中途的提示条行为未专门测试。

## 下一步（按顺序）

1. 处理独立代码审查的结论（进行中）。
2. 推送分支、负责人开 PR；合并与发布仍需负责人批准。
3. 为截图对比准备脱敏样例数据（官方档案、若干公开同人卡）。
4. 会馆首页与同人画廊迁移到 `--ling-*`，统一夜林与纸面两套表面；修手机顶栏入口被藏的问题。
5. 其余会馆页面按上表逐页迁移；每页保存同视口前后截图。
6. 负责人确定 LAB 主线后，做 HUD、登录、设置与触屏控件的视觉改造。
