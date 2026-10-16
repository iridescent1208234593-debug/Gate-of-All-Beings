# Iridescently

罗小黑主题网站、会馆角色档案与众生之门游戏的生产工作区。主仓库为 private：`iridescent1208234593-debug/iridescently`。

## 目录与所有权

| 目录 | 用途 |
| --- | --- |
| `portal/www` | 节气 Gallery 首页、Connections、已发布 DAY100/射击试玩 |
| `portal/www/gallery-engine` | 正式 Atmospheric Gallery 核心；保留上游 Git 来源，根仓库也追踪源码 |
| `portal/huiguan` | 会馆、设表、官方/同人档案、海报 |
| `portal/oc` | 佳霖馆长设定 |
| `server` | Python 统一门户、SSO 与安全能力 |
| `server/app/src` | 七个游戏模块源码 |
| `server/app/shell` / `portal.json` | 同页模块壳与导航清单；非 embed 试玩使用 iframe，不能概括为全站无 iframe |
| `shared` | UI、账户/session/save、契约与只读事实的唯一公共源码 |
| `ops` / `docs` | 网站管家、构建发布、维护与索引 |
| `.releases/candidate` | 未发布候选（Git 忽略） |
| `.releases/production/site` | 已发布静态/Python 源码快照（Git 忽略） |
| `server/app/modules` / `portal/www/assets/homepage` | 已显式发布的构建产物（Git 忽略） |

研发与参考位于工作区外 `E:\External Projects\Iridescently Labs`，桌面壁纸工具位于 `E:\External Projects\url-wallpaper`；都不参与生产部署。Gallery 上游核心已经迁入生产目录，不再把参考区当构建链路。研究的冻结测试结果保留历史路径，不伪造重新验证。

## 运行与正式入口

生产使用 Windows 网站管家 + Cloudflare Tunnel；8080 按 Host/路径分发，未使用新的部署架构。

| 入口 | 内容 |
| --- | --- |
| https://iridescently.xyz/ | 节气 Gallery；Connections `/connections.html` |
| https://huiguan.iridescently.xyz/ | 西木会馆 |
| https://oc.iridescently.xyz/ | 佳霖馆长设定 |
| https://zszm.iridescently.xyz/ | 众生之门；`/app/shell/m/<key>` 为内部模块 |
| https://spirit.iridescently.xyz/games/spirit-playground?room=forest | 灵体互动 |
| `game.*` / `lingjing.*` / `juling.*` | 308 到众生之门对应模块；旧独立前端停止运行 |
| `psyche.*` | 未正式并入，导航红点；不由此工作区启动 |

API 上游：5174 Cards OAuth、5178 数值配置、5177 聚灵、4173 灵体 WebSocket/API。5178/4173 预览明确读取已发布模块；不是直接把源码 `dist` 上线。5173 的 Ecology 本地开发服务不属于生产，不能因端口存在就判为废弃。具体清单见网站管家 `SITES`。

## 构建、发布、启动

```powershell
npm ci
npm run build:modules       # 七模块和首页只写候选
npm run build:cards         # 只构建众生之门前端候选
npm run test:portal         # 使用独立未占用端口检查
npm run publish:modules    # 显式提升模块和首页
npm run publish:cards      # 只更新众生之门前端模块
npm run build:site          # 从 Git HEAD 导出源码快照，排除密钥/数据
npm run publish:site       # 显式提升静态/Python 源码
# 再由 ops/网站恢复/website-manager.py 启动/重启所需服务
```

源码快照必须从审查后的提交构建；尚未提交的更改不会混入 `build:site`。门户/OAuth 由管家从 `.releases/production/site` 启动，`IRIDESCENTLY_PROJECT_ROOT` 指向原工作区运行数据。正式服务不读取候选目录。发布不会自动杀服务或修改 DNS。部署后记录与完整步骤见 [release-workflow](docs/release-workflow.md)。

## 数据与密钥

`users.db`、`characters.json`、`game_saves.json`、上传/HTML store、`.env.local` 留在原位置，忽略且不随源码快照覆盖。`portal/activation-core/.env.local` 是本机独立 Next.js 应用配置，不删除、不提交，也不由门户启动。

外部 `assets/罗小黑战记数据库` 是真实媒体数据（不纳入 Git），供 Gallery 384 图构建与会馆使用；部署到其他机器需单独提供并确认素材许可。`assets/素材` 是现有会馆资产；网站快照与会话导出是本地资料。生产数据库和媒体需要单独备份，Git 不能恢复它们。

配置：会馆 USSO OAuth 使用 `USSO_CLIENT_SECRET`，众生之门 OAuth 使用 `ZSZM_CLIENT_SECRET`，均只从运行环境读取；`HX_SSO_SECRET` 环境优先，也可从忽略的 `server/.env.local` 读取。会馆 OAuth 的 Client ID 在 `portal/huiguan/server_huiguan.py` 配置；真实 OAuth 应用密钥需由 USSO 应用管理端签发，不能用站内账户密码代替。所有账户逻辑仍复用会馆和 `shared-session`，无第二套身份系统。

## 颜色与海报

`portal/huiguan/character-colors.js` 统一以保存的 HEX 为真值，古色色板索引仅作缺值 fallback；界面背景派生色与主色分开。图片/海报采用 Blob + multipart 上传并在 JSON/HTML 中引用同源 URL，避免重复 Base64。普通业务 JSON 上限 8 MiB，图片/PNG 8 MiB、GIF 5 MiB；64 MiB 旧角色写入兼容范围仍有界限。详见 [会馆](portal/huiguan/README.md) 与 [海报](portal/huiguan/haibao/README.md)。

## 开源与研究边界

可独立运行的 Gallery 工程已公开：[iridescently-atmospheric-gallery](https://github.com/iridescent1208234593-debug/iridescently-atmospheric-gallery)。仅使用自行生成的样例图，保留 MIT/Codrops 来源。主站私有素材、音乐、用户内容、账户配置和研究原始资料不进入公开仓库。其他研究项目需要独立许可证、第三方/私有素材核查与迁移后资格验证，不能为了数量直接发布。

文件维护入口：[首页](portal/www/README.md)、[应用模块](server/app/README.md)、[共享资源](shared/README.md)、[发布](docs/release-workflow.md)。
