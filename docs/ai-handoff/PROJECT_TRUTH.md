# Project Truth（导航层）

快照时间：2026-10-17（Claude 接替 Codex；Phase 0 只读考古，同日下午按用户决策拆分提交，见 [DIRTY_WORK_MAP](DIRTY_WORK_MAP.md)）。本目录只做导航与判定，不替代原文档；原文件以链接为准，判定标记见 [DOC_TRUTH_MAP.md](DOC_TRUTH_MAP.md)。

证据优先级：实际运行/可重复测试 > 源码 > git diff/status > git history > QA 证据 > 配置 > 设计文档 > README > Codex 报告 > TODO。无复现证据的 PASS 一律记为 **UNVERIFIED**。

相关：[DIRTY_WORK_MAP](DIRTY_WORK_MAP.md) · [DEPENDENCY_MAP](DEPENDENCY_MAP.md) · [CURRENT_PRIORITIES](CURRENT_PRIORITIES.md) · [CODEX_AFTER_RESET](CODEX_AFTER_RESET.md)

## 1. Git repository / worktree

| 路径 | 用途 | 分支 / 同步 | 状态 |
| --- | --- | --- | --- |
| `E:\Projects` | 生产主仓库（private `iridescently`） | `master`，ahead origin 24（未 push） | 下午已拆分提交；剩余 3 M + 少量未跟踪，见 DIRTY_WORK_MAP；`stash@{0}` r5-carry（STALE） |
| `portal/www/gallery-engine` | 嵌套 repo，Gallery 核心上游来源 | `main` ahead 1，4 unstaged | 内容已由主仓库追踪并提交；嵌套 `.git` 为冗余历史 |
| `.git/nested-repositories/*`（7 个） | 被吸收的旧嵌套 `.git` | 最后提交 ≤ 2026-10-02 | 已被主仓库取代；`portal/huiguan`、`shared/shared-types` 在 feature 分支，可能有少量独有历史 |
| `External Projects\Anime2AnimatedSVG` | 实验：视频 → 动画 SVG | `codex/anime2animatedsvg-stage3`，无 upstream | Stage 3 grouping 半成品（4 M / 3 ??） |
| `External Projects\url-wallpaper` | 桌面壁纸工具 | master 同步 | 3 M / 1 ??（默认 URL 改为主站等） |
| `External Projects\Iridescently Labs\research` | 私有研究（生命模拟、six-system-arena、playable-slice） | main，无 remote | 7 M / 207 ?? |
| `…\Iridescently Labs\atmospheric-gallery` | 已公开 Gallery | 同步 | clean |
| `…\Iridescently Labs\references\*`（11 个） | 上游参考 clone | 同步 | clean；`InternalBeyond` HEAD 损坏（无 commit，67 staged） |
| `External Projects\众生之门生物树可视化前端` + `OZtree` | OneZoom fork，鳞翅目试验 | OZtree main 同步 | 1 M / 7 ?? |

- **Git worktree 只有 1 个**（主仓库）。`E:\Projects-worktrees\` 不是 git worktree：
  - `zszm-layout-release`：已移除 worktree 的空残留，只有 `node_modules` junction。
  - `zszm-layout-candidate-backup/published`：`abdf74e` 候选构建备份；其 cards 哈希等于当前线上 cards。
- 主仓库 13 个本地分支中，只有 `codex/r2-asset-resolver`（2 commits，CDN resolver，10-08）未合并。

## 2. 活跃项目

| 项目 | 源码 | 运行 / 端口 | 线上 |
| --- | --- | --- | --- |
| 主站 · 节气 Gallery / Connections | `portal/www`（+ `gallery-engine`） | 8080 门户按 Host 分发 | iridescently.xyz |
| 西木会馆 | `portal/huiguan`（`server_huiguan.py`） | 8080 | huiguan.* |
| 佳霖馆长设定 OC | `portal/oc` | 8080 | oc.* |
| 众生之门（门景 → 初始化 → 门庭） | `server/app/src/cards` | 5174 API（OAuth 代理 / Gate identity）；本地验收 dev 5194 API + **5195** Vite | zszm.*（线上 cards = `abdf74e`，**不含**本轮整合） |
| 门庭内模块：灵境会馆 / 生态 / 聚灵 / 重生之门 / 灵体 / AEON | `server/app/src/{management,ecology,juling,slay-the-web,softie-webgpu,aeon}`；清单 `server/app/portal.json` | 聚灵 5177、数值 5178、灵体 4173 | 统一壳 `/app/shell/m/<key>` |
| 射击试玩 | `/playtest/shengsheng-shoot/`（`portal/www`） | 8080 | 已发布 |
| 公共账户 / SSO | `server/hx_sso.py`、`server/account_*.py`、会馆 `users.db` | 门户内 | 共用 |
| shared | `shared/shared-{ui,types,data,session}` | npm workspaces | — |
| 运维 / 发布 | `ops/`（网站管家 `ops/网站恢复/website-manager.py`、`publish-release.mjs`、`build-site.mjs`） | Cloudflare Tunnel | — |
| six-system-arena 素材复审 | `New project/six-system-arena/docs`（+ research 仓库） | 文档型 | — |
| psyche | `E:\心理\…`（管家中 `deployed=False`） | 8000 | 未并入 |

非生产区域：`work/`（QA、安全阶段证据、一次性脚本，未跟踪）、`ops/backups/`（含生产用户库副本）、`.releases/`（candidate / production 快照，git 忽略）、`assets/`（媒体数据库，git 忽略）、`External Projects\{复审记录,待审区（用户终审）,未定以及以及疑似同人}`（素材复审材料）、`归档`、`小说`、`original-ui-version`（已整合进 cards/onboarding 的原型）。

## 3. 生产运行真相（最重要）

- 网站管家从 `.releases/production/site` 快照启动 **8080 门户** 和 **5174 Cards API**；聚灵 5177 直接从工作树 `server/app/src/juling` 运行；5178 / 4173 读已发布模块。
- `.releases/production.json`：site 构建自 `b91f9dc`，`sourceDirty: true`，所以线上运行着**未入 Git 的 Stage 1/1.5 安全代码**（由 `work/prepare_*.py` 手工组装）。cards 来自 `abdf74e`（clean）。
- **发布器之外的线上漂移**：
  - 2026-10-17 10:59 改了 `production/site/server/portal_server.py`（哈希 `38434cdd…` ≠ manifest `89157166…`），新增 `/ozmtree`，指向 `E:\External Projects\…\OZtree\static`。
  - 同一分钟出现空的 `production/site/portal/huiguan/users.db`，疑似有一次启动没有设置 `IRIDESCENTLY_PROJECT_ROOT`。真实库在 `portal/huiguan/users.db`。
  - `production.json` 中有 2 条手写 `overlays`（PayPal / QR 单文件推送，来自 `a3fc0f9`、`050be71`）。
  - 2026-10-18 凌晨（02:34）有人把工作区未提交的 `server/account_email.py`、`portal/huiguan/account.html` 直接热修进 `production/site`；`portal/huiguan/assets/thumbs/` 是运行时缩略图缓存，只在线上快照里。**整包 `publish:site` 会冲掉这三处**，发布前先把热修入 Git 或并入候选。
  - 2026-10-18 Claude 按用户授权以单文件覆盖方式上线 `3ce361e`（玻璃导航 / 时间线 / AI 协作精灵）7 个文件，清单与哈希见 `work/release-20261018-nav/overlay.log`，回滚副本在同目录 `rollback/`；`portal/www/index.html`（工作树直出）只把 site-nav 版本号改为 `20261018-nav`。
- 以上 10-17 修改由用户本地 Agent 完成，用户知情并授权。Stage 1/1.5 与 `/ozmtree` 已于下午入 Git，线上代码可由提交重建；快照 manifest 仍记 dirty / overlay，下次正规发布后一致。

## 4. 无法确定的区域（needs verification）

已解决：素材删除（用户复审确认）；10-17 production 修改（用户授权）；shengsheng 路由属于 ZSZM 门庭；admin 链接属于设计系统文档；门户 51/51 已在隔离环境复现。

仍待确认：

- `shared/shared-types/world.js` 注释改动的来源。
- `assets/字体/` 的用途与许可。
- 候选浏览器验收；Stage 1/1.5/1.7 线上验证结论（只有报告，没有原始输出）。
