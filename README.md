# 众生之门 · Gate of All Beings

罗小黑主题网站、会馆角色档案与众生之门游戏的生产工作区。主仓库为 private：`iridescent1208234593-debug/Gate-of-All-Beings`。

## 目录与所有权

| 目录 | 用途 |
| --- | --- |
| `portal/www` | 节气 Gallery 首页、Connections、已发布 DAY100/射击试玩 |
| `portal/www/gallery-engine` | 正式 Atmospheric Gallery 核心；保留上游 Git 来源，根仓库也追踪源码 |
| `portal/huiguan` | 会馆、设表、官方/同人档案、海报 |
| `portal/oc` | 佳霖馆长设定 |
| `server` | Python 统一门户、SSO 与安全能力 |
| `server/app/src` | 八个游戏模块源码 |
| `server/app/shell` / `portal.json` | 同页模块壳与导航清单；非 embed 试玩使用 iframe，不能概括为全站无 iframe |
| `shared` | UI、账户/session/save、契约与只读事实的唯一公共源码 |
| `scripts` / `docs` | 根目录运维入口、构建发布文档与维护索引；运维实现位于外部 Ops 目录 |
| `.releases/candidate` | 未发布候选（Git 忽略） |
| `.releases/production/site` | 已发布静态/Python 源码快照（Git 忽略） |
| `server/app/modules` / `portal/www/assets/homepage` | 已显式发布的构建产物（Git 忽略） |

研发与参考位于工作区外 `E:\External Projects\Iridescently Labs`，桌面壁纸工具位于 `E:\External Projects\url-wallpaper`；都不参与生产部署。例外：线上 `/ozmtree/` 直接读取 `E:\External Projects` 下的 OZtree 静态目录（见下文入口表）。Gallery 上游核心已经迁入生产目录，不再把参考区当构建链路。研究的冻结测试结果保留历史路径，不伪造重新验证。

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
| `*/ozmtree/` | 生物树可视化试用（OneZoom 改造，鳞翅目导入）；任意站点 Host 均可访问 |

同一份代码同时接受 `iridescently.xyz`、`iridescently.cn`、`iridescently.dpdns.org` 三个批准根域下的上述子域（集中配置 `packages/site-domains/domains.json`）；每个根域独立登录、Cookie 与 CSP，`.xyz` 继续运行且不强制跳转。是否已有 DNS、证书与 OAuth 回调登记属于上线批次，见 [domain-readiness](docs/domain-readiness.md)。

`/ozmtree/` 由 `server/portal_server.py` 的 `OZTREE_STATIC` 直接提供工作区外的静态目录 `E:\External Projects\众生之门生物树可视化前端\OZtree\static`，不经构建、候选或 Release，也不在源码快照内；换机部署需单独提供该目录，或改为显式发布。OZtree 自身源码、数据与许可见其仓库 README。

API 上游：5174 Cards OAuth、5178 数值配置、5177 聚灵、4173 灵体 WebSocket/API。5178/4173 预览明确读取已发布模块；不是直接把源码 `dist` 上线。5173 的 Ecology 本地开发服务不属于生产，不能因端口存在就判为废弃。具体清单见网站管家 `SITES`。

## 构建、发布、启动

源码、持久数据、用户上传、派生缓存、构建候选、Release 与备份分别位于不同根目录，契约见 [存储与运行期写入方](docs/storage-runtime-writers.md) 和 [发布流程](docs/release-workflow.md)。`IRIDESCENTLY_STORAGE_ROOT` 选择外部存储父目录，`IRIDESCENTLY_ENVIRONMENT`（`development` / `staging` / `production` / `test`）选择其中相互隔离的环境；源码树、worktree 与 Release 目录永远不会被选为数据根，服务在缺少已验证的就绪标记时拒绝启动。

```powershell
npm ci
npm run build:site        # Git HEAD 源码快照 → <releases>/candidate/site，排除数据、上传与密钥
npm run build:release     # 八个模块 + 首页候选
npm run release:seal      # 三个候选须来自同一干净提交；生成不可变 <releases>/store/<id> 并切换 channel
npm run release:rollback -- <release-id>    # 只切换 channel，持久数据不变
python scripts/local-runtime.py start       # 只在本机回环启动已封存 Release，不启动 Tunnel、不改 DNS
python scripts/local-runtime.py status | stop
python scripts/check-batch6.py --full --modules <candidate>/modules   # 回归，只使用临时 test 存储
```

本机外部存储位于 `E:\External Projects\Iridescently Runtime\<environment>\{data,assets,cache,releases,backups}`。旧本地运行数据的迁移证据与可恢复原件在 `production\backups\batch6-migration-20261025`；只读复核：`python scripts/storage-migrate.py verify --manifest <该目录>\manifest.json`。`python scripts/backup-storage.py snapshot` 生成同盘快照，不等于异地备份。外部运维工具（`E:\External Projects\Iridescently Operations`）通过 `local-workspace.json` 选择源码与存储根；香港发布工具仍按其自身流程运行，本仓库不包含香港部署动作。

## 数据与密钥

`users.db`、`characters.json`、`game_saves.json`、上传与展示 store、Cards/聚灵/首页互动数据库、世界观可编辑库及 `secrets/server.env` 都只存在于外部 data / assets 根，不进入 Git、候选或 Release；Release 替换与回滚不会覆盖它们。`portal/activation-core/.env.local` 是本机独立 Next.js 应用配置，不删除、不提交，也不由门户启动。

`assets/source/罗小黑战记数据库` 是真实媒体原件（不纳入 Git），供 Gallery 构建与会馆使用；派生 WebP 预览、缩略图写入 cache 根，可随时重建。部署到其他机器需单独提供原件并确认素材许可。Git 不能恢复数据库和媒体，须单独备份。

配置：会馆 USSO OAuth 使用 `USSO_CLIENT_SECRET`，众生之门 OAuth 使用 `ZSZM_CLIENT_SECRET`，均只从运行环境读取；`HX_SSO_SECRET` 环境优先，也可从外部 data 根的 `secrets/server.env` 读取。会馆 OAuth 的 Client ID 在 `portal/huiguan/server_huiguan.py` 配置；真实 OAuth 应用密钥需由 USSO 应用管理端签发，不能用站内账户密码代替。所有账户逻辑仍复用会馆和 `shared-session`，无第二套身份系统。

AI 协作指令与隔离边界见 [Copilot 仓库指令](.github/copilot-instructions.md)、[架构说明](docs/architecture.md) 和 [环境隔离审计](docs/architecture/ENVIRONMENT_BOUNDARIES.md)。分支治理当前为建议稿，尚未执行，见 [BRANCH_STRATEGY](docs/development/BRANCH_STRATEGY.md)；归档边界见 [ARCHIVE_POLICY](docs/development/ARCHIVE_POLICY.md)。

## 颜色与海报

`portal/huiguan/character-colors.js` 统一以保存的 HEX 为真值，古色色板索引仅作缺值 fallback；界面背景派生色与主色分开。图片/海报采用 Blob + multipart 上传并在 JSON/HTML 中引用同源 URL，避免重复 Base64。普通业务 JSON 上限 8 MiB，图片/PNG 8 MiB、GIF 5 MiB；64 MiB 旧角色写入兼容范围仍有界限。详见 [会馆](portal/huiguan/README.md) 与 [海报](portal/huiguan/haibao/README.md)。

## 开源与研究边界

可独立运行的 Gallery 工程已公开：[iridescently-atmospheric-gallery](https://github.com/iridescent1208234593-debug/iridescently-atmospheric-gallery)。仅使用自行生成的样例图，保留 MIT/Codrops 来源。主站私有素材、音乐、用户内容、账户配置和研究原始资料不进入公开仓库。其他研究项目需要独立许可证、第三方/私有素材核查与迁移后资格验证，不能为了数量直接发布。

文件维护入口：[首页](portal/www/README.md)、[应用模块](server/app/README.md)、[共享资源](packages/README.md)、[发布](docs/release-workflow.md)。

众生之门最新源码集成：正式门景 → 玩家初始化 → 统一门庭；原型浅滩独立为模式，成熟玩法保留原引擎和存档。开场新增可记忆的配乐选择与静音控制，配乐从开场延续到门庭。此轮仅本地工作源码，未发布。见 [流程与路由](docs/zszm-flow-integration.md)、[账户与存档边界](docs/zszm-identity-and-save-map.md)、[首屏加载审查](docs/zszm-loading-audit.md)。
