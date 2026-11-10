# 众生之门 · Gate of All Beings

> 罗小黑主题的站点群与八个游戏模块，共用一个仓库：一套账户与存档边界、一条发布流水线、三个批准根域。

主仓库为 private：`iridescent1208234593-debug/Gate-of-All-Beings` ｜ 文档索引：[docs/README.md](docs/README.md)

## 这是什么

这个仓库不是单一游戏，而是一个**多站点工作区**：

- **站点**：节气 Gallery 首页、西木会馆角色档案、佳霖馆长设定（`apps/www`、`apps/huiguan`、`apps/oc`）
- **游戏**：八个模块 —— 众生之门本体（卡牌历练）、经营、生态、聚灵、AEON、世界地图、Slay、灵体互动
- **共通层**：统一入口与 SSO（`services/platform`）、跨站共享的 UI／账户／存档／领域映射（`packages`）、构建发布与本机运行（`tools`）、入口生成物（`infra`）

同一份代码与构建产物同时服务多个根域，但**每个根域独立登录、Cookie 与 CSP**；游戏模块挂载在同一个壳里，不是若干独立网站拼接而成。

## 在线入口

| 入口 | 内容 |
| --- | --- |
| <https://iridescently.xyz/> | 节气 Gallery；Connections 在 `/connections.html` |
| <https://huiguan.iridescently.xyz/> | 西木会馆 |
| <https://oc.iridescently.xyz/> | 佳霖馆长设定 |
| <https://zszm.iridescently.xyz/> | 众生之门本体；`/app/shell/m/<key>` 为内部模块 |
| <https://spirit.iridescently.xyz/games/spirit-playground?room=forest> | 灵体互动 |

同一份代码同时接受 `iridescently.xyz`、`iridescently.cn`、`iridescently.dpdns.org` 三个批准根域下的上述子域（集中配置 `packages/site-domains/domains.json`）。每个根域独立登录、Cookie 与 CSP，`.xyz` 继续运行且不强制跳转。DNS、证书与 OAuth 回调的登记状态属于上线批次，见 [domain-readiness](docs/domain-readiness.md)。

## 快速开始

新成员从零安装、启动 Portal/Cards/会馆和独立游戏的完整步骤与实际验证矩阵见[本地开发环境与启动矩阵](docs/development/local-onboarding.md)。

**只想看**：直接用上面的在线入口，不需要本地环境。

**想改某个模块**：进入对应目录，按该目录自己的 README 启动。八个模块的技术栈并不统一（Vite + React、原生 JS + Canvas、Python 服务、Next.js），没有一条命令能覆盖全部。

**想跑整个站点**：需要先构建并封存一个 Release，再启动本机运行时，不能直接拉起源码。完整路径见 [本机运行与排障](docs/operations.md)：

```powershell
npm ci
npm run build:site      # Git HEAD 源码快照 → <releases>/candidate/site
npm run build:release   # 八个模块 + 首页候选
npm run release:seal    # 三个候选须来自同一干净提交 → 不可变 Release
python tools/runtime/local-runtime.py start   # 只在本机回环启动，不起 Tunnel、不改 DNS
```

环境版本锁定在 `.nvmrc`（Node 22）与 `.python-version`（Python 3.12）。

## 模块地图

| 路径 | 模块 | 作用 | 怎么进入 |
| --- | --- | --- | --- |
| `apps/www` | 首页与 Gallery | 节气 Gallery 首页、Connections、DAY100／射击试玩 | 线上 `iridescently.xyz` |
| `apps/www/gallery-engine` | Gallery 核心 | 正式 Atmospheric Gallery 引擎；保留上游 Git 来源，根仓库也追踪源码 | 随 `www` 构建 |
| `apps/huiguan` | 西木会馆 | 会馆、设表、官方／同人档案、海报 | 线上 `huiguan.*` |
| `apps/oc` | 馆长设定 | 佳霖馆长 OC 设定站 | 线上 `oc.*` |
| `apps/cards` | 众生之门 | 3D 门景开场、统一门庭、卡牌历练 | 线上 `zszm.*`；新版流程目前仅本地候选 |
| `apps/management` | 灵境会馆 | 灵质空间经营模拟（M0 骨架 / M1 Demo / M2 种植 / M3 时代跃迁） | 本地 `npm run dev` |
| `apps/ecology` | 生态模拟 | Three.js 生态世界，可编辑环境与生命 | 本地 `npm run dev` |
| `apps/juling` | 聚灵 | 文字修仙：物质灵／生灵双线成长、化形、轮回 | 本地 `npm start` |
| `apps/aeon` | AEON | 神经网络驱动的文明模拟（上游开源） | 本地 `npm run serve` |
| `apps/slay` | Slay the Web | 浏览器卡牌引擎（上游开源） | 本地 `npm start` |
| `apps/softie` | 灵体互动 | WebGPU 软体物理，作为灵体互动的技术底座 | 线上 `spirit.*` |
| `apps/world-map` | 世界地图 | Three.js 环形世界地图，iframe 隔离自身样式与 WebGL 生命周期 | `/app/shell/m/world-map` |
| `apps/shell` | 模块壳 | 同页挂载与导航清单 `portal.json`；非 embed 试玩仍用 iframe | — |
| `apps/activation-core` | 激活码系统 | 单管理员激活码管理，独立 Next.js 应用 | 本地 `npm run dev` |

"线上"指已在正式入口登记；未标注线上不等于未部署，以部署记录为准。

## 仓库结构

`apps/` 站点与游戏 · `services/` 统一入口与平台服务 · `packages/` 跨站共享源码 · `tools/` 构建发布与本机运行 · `infra/` 入口生成物与探针 · `docs/` 文档。

2026-10-26 的布局重构（`portal/`、`server/`、`shared/`、`scripts/`、`ops/` → 新目录）有逐条新旧对照，见 [仓库布局](docs/repository-layout.md)；仓库之外的本机目录约定见 [工程工作区](docs/workspace.md)。

研发、原型与上游参考位于工程工作区的 `labs`，不参与生产部署。Gallery 上游核心已迁入生产目录，不再把参考区当构建链路。研究的冻结测试结果保留历史路径，不伪造重新验证。

## 架构与边界

三条规则决定了这个仓库能改什么、不能改什么：

1. **代码不选数据**。存储来自 `IRIDESCENTLY_STORAGE_ROOT`／`IRIDESCENTLY_ENVIRONMENT` 或工作区清单；源码树、worktree 与 Release 目录永远不会被选为数据根。
2. **不另起身份系统**。所有账户逻辑复用会馆与 `shared-session`，每个根域独立会话。
3. **生产变更需显式授权**。香港生产、Cloudflare、DNS、Tunnel 与 OAuth 登记不由修改源码触发。

架构总览见 [architecture.md](docs/architecture.md)，环境隔离见 [ENVIRONMENT_BOUNDARIES](docs/architecture/ENVIRONMENT_BOUNDARIES.md)，数据写入方契约见 [存储与运行期写入方](docs/storage-runtime-writers.md)。

## 数据与密钥

`users.db`、`characters.json`、`game_saves.json`、上传与展示 store、Cards／聚灵／首页互动数据库、世界观可编辑库以及 `secrets/server.env` 都只存在于外部 data / assets 根，**不进入 Git、候选或 Release**；Release 替换与回滚不会覆盖它们。

`assets/source/罗小黑战记数据库` 是真实媒体原件（不纳入 Git），供 Gallery 构建与会馆使用；派生 WebP 预览与缩略图写入 cache 根，可随时重建。**Git 不能恢复数据库和媒体，须单独备份。**

配置项名称与各自的读取位置见文末折叠的运维细节。

## 来源、许可与公开边界

本仓库聚合了原创内容与若干上游开源项目，两者的边界必须分清：

| 来源 | 说明 |
| --- | --- |
| `apps/slay` | Slay the Web（基于 Slay the Spire 的社区重实现），目录内附 LICENSE |
| `apps/softie` | softie-webgpu 上游项目（MIT），目录内附 LICENSE |
| `apps/aeon` | AEON 上游项目，目录内附 LICENSE |
| `apps/world-map` | 源码导入自 `aaabby-w/temp` 的 `81758f747fa0c038fe26a13e016d707ed8f317aa`，上游继续维护制图母版与生成脚本 |
| `apps/activation-core` | 独立 Next.js 应用，目录内附 LICENSE |
| `apps/www/gallery-engine` | 保留上游 Git 来源与 MIT／Codrops 声明 |

可独立运行的 Gallery 工程已公开：[iridescently-atmospheric-gallery](https://github.com/iridescent1208234593-debug/iridescently-atmospheric-gallery)，仅使用自行生成的样例图。

**主站私有素材、音乐、用户内容、账户配置和研究原始资料不进入公开仓库。** 其他研究项目需要独立许可证、第三方／私有素材核查与迁移后资格验证，不能为了数量直接发布。

## 文档导航

[docs/README.md](docs/README.md) 是全量索引。最常用的几篇：

- [架构](docs/architecture.md) · [数据库](docs/database.md) · [认证](docs/auth.md) · [API 清单](docs/api.md)
- [构建发布流程](docs/release-workflow.md) · [本机运行与排障](docs/operations.md) · [恢复手册](docs/recovery.md)
- [众生之门流程集成](docs/zszm-flow-integration.md) · [账户与存档边界](docs/zszm-identity-and-save-map.md) · [首屏加载审查](docs/zszm-loading-audit.md)

各目录的维护入口：[首页](apps/www/README.md) · [应用模块](apps/README.md) · [共享资源](packages/README.md)。

## 协作

- **AI 协作指令**：[AGENTS.md](AGENTS.md)；编辑器侧补充见 [.github/copilot-instructions.md](.github/copilot-instructions.md) 与 `.github/instructions/`。
- **分支与合并**：trunk 为唯一集成来源，短期分支按内容命名（`feat/`、`fix/`、`docs/`、`chore/`），一分支一 PR；不强推、不改写共享分支历史。规则见 [BRANCH_STRATEGY](docs/development/BRANCH_STRATEGY.md)。
- **删除与清理**：被跟踪文件的删除范围以负责人明确指定的为准；运行时数据、上传、数据库、密钥、原件与证据永不作为"清理"删除。

---

<details>
<summary><b>运维细节</b>（存储根、路由、API 端口、配置项、颜色与海报）</summary>

### 存储与运行

源码、持久数据、用户上传、派生缓存、构建候选、Release 与备份分别位于不同根目录。`IRIDESCENTLY_STORAGE_ROOT` 选择外部存储父目录，`IRIDESCENTLY_ENVIRONMENT`（`development` / `staging` / `production` / `test`）选择其中相互隔离的环境；服务在缺少已验证的就绪标记时拒绝启动。

在工作区内的检出里运行时，存储根默认取工作区的 `runtime`（`<runtime>\<environment>\{data,assets,cache,releases,backups}`），不必设置环境变量；搬迁存储只能用 `tools/runtime/relocate-storage.py`。本机的仓库、worktree、外部存储、运维工具、原件与证据由根目录的 `iridescently-workspace.json` 登记。

旧本地运行数据的迁移证据与可恢复原件在 `<runtime>\production\backups\batch6-migration-20261025`；只读复核：`python tools/runtime/storage-migrate.py verify --manifest <该目录>\manifest.json`。`python tools/runtime/backup-storage.py snapshot` 生成同盘快照，不等于异地备份。

回滚：`npm run release:rollback -- <release-id>`，只切换 channel，持久数据不变。启动后只读冒烟：`python tools/checks/local-smoke.py`（三根域页面／API、匿名原图拒绝、跨根 Origin 与 WebSocket 拒绝、未知 Host 421）。全量回归：`python tools/checks/regression.py --full --modules <candidate>/modules`，只使用临时 test 存储。

### 部署形态与路由

生产使用 Windows 网站管家 + Cloudflare Tunnel；8080 按 Host／路径分发，未使用新的部署架构。

- `game.*` / `lingjing.*` / `juling.*`：308 到众生之门对应模块，旧独立前端停止运行。
- `psyche.*`：未正式并入，导航红点；不由此工作区启动。
- `*/ozmtree/`：生物树可视化试用（OneZoom 改造，鳞翅目导入），任意站点 Host 均可访问。

本仓库的统一入口不提供 `/ozmtree/`（发布线已移除该路由）。OZtree 是工作区 `labs` 下的独立实验项目，其源码、数据与许可见该仓库 README；重新上线需要单独决定，并改为显式发布而不是读取工作区外的目录。香港旧线是否仍提供该路径以其部署记录为准。香港生产在迁移到本布局之前运行旧布局，只存在于线上的修复记录在 `docs/changelog/hk-drift-*.md`，移植前不回写 trunk。

### API 上游

5174 Cards OAuth、5178 数值配置、5177 聚灵、4173 灵体 WebSocket／API。5178／4173 预览明确读取已发布模块，不是直接把源码 `dist` 上线。5173 的 Ecology 本地开发服务不属于生产，不能因端口存在就判为废弃。具体清单见网站管家 `SITES`。

### 配置项

会馆 USSO OAuth 使用 `USSO_CLIENT_SECRET`，众生之门 OAuth 使用 `ZSZM_CLIENT_SECRET`，均只从运行环境读取；`HX_SSO_SECRET` 环境优先，也可从外部 data 根的 `secrets/server.env` 读取。会馆 OAuth 的 Client ID 在 `apps/huiguan/server_huiguan.py` 配置；真实 OAuth 应用密钥需由 USSO 应用管理端签发，不能用站内账户密码代替。

`apps/activation-core/.env.local` 是本机独立 Next.js 应用配置，不删除、不提交，也不由门户启动。

### 颜色与海报

`apps/huiguan/character-colors.js` 统一以保存的 HEX 为真值，古色色板索引仅作缺值 fallback；界面背景派生色与主色分开。图片／海报采用 Blob + multipart 上传并在 JSON／HTML 中引用同源 URL，避免重复 Base64。普通业务 JSON 上限 8 MiB，图片／PNG 8 MiB、GIF 5 MiB；64 MiB 旧角色写入兼容范围仍有界限。详见 [会馆](apps/huiguan/README.md) 与 [海报](apps/huiguan/haibao/README.md)。

</details>

---

## 当前状态

众生之门最新源码集成：正式门景 → 玩家初始化 → 统一门庭；原型浅滩独立为模式，成熟玩法保留原引擎和存档。开场新增可记忆的配乐选择与静音控制，配乐从开场延续到门庭。**此轮仅本地工作源码，未发布。**

## 路线图

- [x] 八个游戏模块接入统一入口与统一壳
- [x] 众生牌录三模式：同行者出行、重生之门、灵质回路
- [x] 会馆日常的照料、默契与封灵
- [x] 雾隐浅滩独立为短章模式
- [x] 经营远征与生态收获交换协议
- [x] 统一账户、跨域会话与统一存档边界
- [x] 不可变 Release 发布与回滚
- [x] 源码树与运行数据分离
- [x] 固定新版牌录测试版本，跑通出发、结算、照料、续读
- [ ] 观察玩家归来后是否自发改变下一步
- [ ] 按观察结果只推进一项：改进变化反馈或封顶失败损失
- [ ] 射击：验证何时停下开火
- [ ] 用相近长度的片段对比三种模式
- [ ] 经营或生态二选一，验证玩家的干预是否改变结果
- [ ] 灵体验证无主持人推动时的自发互动
- [ ] 浅滩按短章收口
- [ ] 主线内容扩展
- [ ] 角色关系增强
- [ ] AEON 续档
- [ ] 聚灵与一念仙途再启动
- [ ] 跨模块成长
