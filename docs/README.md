# 文档索引

Iridescently / 众生之门 工作区文档。总览见根 [README.md](../README.md)。

| 文档 | 内容 |
| --- | --- |
| [architecture.md](architecture.md) | 整体架构：统一入口、壳 SPA、模块 embed 协议、构建管线 |
| [database.md](database.md) | 所有数据存储：世界观库、用户库、IndexedDB、SQLite、统一存档 |
| [auth.md](auth.md) | 用户系统：hx_sso 跨站 SSO、会馆账号、OAuth、账号找回 |
| [api.md](api.md) | API 清单：会馆、卡牌、聚灵、软乎乎、统一入口代理 |
| [hooks.md](hooks.md) | 钩子与约定：embed、dispose、portal.json、构建、扩展点 |
| [networking.md](networking.md) | 联机：现状与预留接口设计 |
| [operations.md](operations.md) | 部署运营：端口、网站管家、Cloudflare 隧道、看门狗、排障 |

## 快速事实

- 统一入口：`server/portal_server.py`，端口 `8080`，生产由 Cloudflare 隧道接入。
- 壳：`server/app/shell/index.html`，History API 路径路由 `/app/shell/m/<名>`，7 游戏无 iframe。
- 公用包：`@lxh/shared-{ui,types,data,session}`。
- 统一存档：`localStorage['iridescently.save.v1']`。
- 数据库：世界观库 `assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db`；会馆 `portal/huiguan/users.db`；聚灵 `server/app/src/juling/data/save.db`。
