# 文档索引

Gate of All Beings / 众生之门 工作区文档。总览见根 [README.md](../README.md)。

| 文档 | 内容 |
| --- | --- |
| [architecture.md](architecture.md) | 整体架构：统一入口、壳 SPA、模块 embed 协议、构建管线 |
| [database.md](database.md) | 所有数据存储：世界观库、用户库、IndexedDB、SQLite、统一存档 |
| [auth.md](auth.md) | 用户系统：hx_sso 跨站 SSO、会馆账号、OAuth、账号找回 |
| [api.md](api.md) | API 清单：会馆、卡牌、聚灵、软乎乎、统一入口代理 |
| [hooks.md](hooks.md) | 钩子与约定：embed、dispose、portal.json、构建、扩展点 |
| [networking.md](networking.md) | 联机：现状与预留接口设计 |
| [repository-layout.md](repository-layout.md) | 仓库布局、2026-10-26 重构的旧→新路径对照、外部运维入口的新旧路径 |
| [workspace.md](workspace.md) | 本机工程工作区：目录角色、`iridescently-workspace.json`、存储根与运维根的解析、runtime 搬迁 |
| [operations.md](operations.md) | 谁在哪里运行；本机唯一的服务启动路径、端口、香港发布、排障 |
| [development/local-onboarding.md](development/local-onboarding.md) | Node 22 / Python 3.12 本地环境、Portal/Cards/会馆/游戏启动矩阵、日志与排障 |
| [development/module-test-baseline.md](development/module-test-baseline.md) | 八个游戏模块的构建、单测、最小交互入口与未验证项基线（Issue #73），含只读诊断脚本 |
| [recovery.md](recovery.md) | 恢复手册：Git、退役分支、本机运行数据、迁移原件、Release 的副本位置与恢复/演练命令 |
| [development/BRANCH_STRATEGY.md](development/BRANCH_STRATEGY.md) | 分支策略：trunk、短期分支、线上热修复移植、归档 tag 与删除规则 |
| [development/AI_DEVELOPMENT.md](development/AI_DEVELOPMENT.md) | Claude / Codex / Copilot 等 AI 的统一开发规则与交付要求 |
| [development/GLOSSARY.md](development/GLOSSARY.md) | Account / OC / Gate Identity / Player / Actor / Owner / Scope 等核心术语唯一语义 |
| [development/NAMING_AND_CONTRACTS.md](development/NAMING_AND_CONTRACTS.md) | 变量、API、数据库、环境变量命名与历史兼容字段迁移规则 |
| [development/AI_TASK_TEMPLATE.md](development/AI_TASK_TEMPLATE.md) | 所有开发者共用的单次 AI 任务模板，避免每个人维护一套项目 Prompt |
| [security/README.md](security/README.md) | 安全文档索引：现行规则与历史报告的区分、最近一次审计证据的位置 |
| [SESSION_HANDOFF.md](SESSION_HANDOFF.md) | 历史交接（写作时的 GitHub / Cloudflare 状态）；现行状态以上面各文档为准 |

## 快速事实

- 统一入口：`services/platform/portal_server.py`，端口 `8080`，生产由 Cloudflare 隧道接入。
- 壳：`apps/shell/index.html`，路径 `/app/shell/m/<名>`；embed 模块同页挂载，非 embed 试玩沿用 iframe，不能概括为全站无 iframe。
- 公用包：`@lxh/shared-{ui,types,data,session}`。
- 统一存档：`localStorage['iridescently.save.v1']`。
- 数据库：世界观库 `assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db`；会馆、聚灵等持久数据在外部 data 根（`<data>/huiguan/users.db`、`<data>/juling/`），见 [存储与运行期写入方](storage-runtime-writers.md)。

## 维护与研发资料

- [各组制作标准与任务](production/README.md)：美术、UI、动画、音乐、文案、策划、程序、测试与版权各组的标准、首批任务和验收；由策划组维护。
- [卡牌数值后台与功能手册](../apps/cards/docs/card-balance-admin.md)：图鉴卡牌数值编辑、权限、API、备份和恢复。
- [统一更新流程](update-system.md)
- [众生之门新版流程集成](zszm-flow-integration.md)：单次开场、玩家初始化、门庭与小游戏入口；本地候选未发布。
- [身份、头像与存档关系](zszm-identity-and-save-map.md)：Account / OC / Gate 的数据边界、跨站限制和后续风险。
- [共同旅途数据合并](ai-handoff/README.md)：439 名有效角色、跨模式灵卡目录、公共资源事务、Cards/Slay 迁移与其他小游戏接入。
- [主站与西木会馆加载审查](zszm-loading-audit.md)：真实测量、开场阻塞根因和源码优化边界。
- [2026-10-10 目录整理](maintenance/repository-cleanup-2026-10-10.md)
- [生命模拟研究](../../labs/iridescently-labs/research/doc/zszm-life-research/00-index.md)：研发资料在工作区 `labs/iridescently-labs/research/`，不属于仓库；链接按 `repo/` 检出的位置写，只用于本机阅读。
- [玩家与自主生命：Build-vs-Adopt](../../labs/iridescently-labs/research/doc/zszm-life-research/33-gameplay-systems-build-vs-adopt.md)：玩法系统的源码筛选、复用边界与下一实验。
