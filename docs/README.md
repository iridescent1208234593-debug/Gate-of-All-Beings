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
| [operations.md](operations.md) | 部署运营：端口、网站管家、Cloudflare 隧道、排障 |
| [SESSION_HANDOFF.md](SESSION_HANDOFF.md) | 当前 GitHub / Cloudflare 状态、未提交现场和新对话接续入口 |

## 快速事实

- 统一入口：`services/platform/portal_server.py`，端口 `8080`，生产由 Cloudflare 隧道接入。
- 壳：`apps/shell/index.html`，路径 `/app/shell/m/<名>`；embed 模块同页挂载，非 embed 试玩沿用 iframe，不能概括为全站无 iframe。
- 公用包：`@lxh/shared-{ui,types,data,session}`。
- 统一存档：`localStorage['iridescently.save.v1']`。
- 数据库：世界观库 `assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db`；会馆 `apps/huiguan/users.db`；聚灵 `apps/juling/data/save.db`。

## 维护与研发资料

- [卡牌数值后台与功能手册](../apps/cards/docs/card-balance-admin.md)：图鉴卡牌数值编辑、权限、API、备份和恢复。
- [统一更新流程](update-system.md)
- [众生之门新版流程集成](zszm-flow-integration.md)：单次开场、玩家初始化、门庭与小游戏入口；本地候选未发布。
- [身份、头像与存档关系](zszm-identity-and-save-map.md)：Account / OC / Gate 的数据边界、跨站限制和后续风险。
- [共同旅途数据合并](ai-handoff/README.md)：439 名有效角色、跨模式灵卡目录、公共资源事务、Cards/Slay 迁移与其他小游戏接入。
- [主站与西木会馆加载审查](zszm-loading-audit.md)：真实测量、开场阻塞根因和源码优化边界。
- [2026-10-10 目录整理](maintenance/repository-cleanup-2026-10-10.md)
- [生命模拟研究](../../External%20Projects/Iridescently%20Labs/research/doc/zszm-life-research/00-index.md)：当前研发资料在 `E:/External Projects/Iridescently Labs/research/`，独立于生产工作区；此链接用于本机资料阅读。
- [玩家与自主生命：Build-vs-Adopt](../../External%20Projects/Iridescently%20Labs/research/doc/zszm-life-research/33-gameplay-systems-build-vs-adopt.md)：玩法系统的源码筛选、复用边界与下一实验。
