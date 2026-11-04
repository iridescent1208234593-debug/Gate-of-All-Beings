# 仓库布局

2026-10-26 起的目录约定。按"是什么"分目录：可部署的站点与游戏在 `apps/`，Python 服务在 `services/`，公共源码在 `packages/`，开发与发布工具在 `tools/`，入口基础设施在 `infra/`。

| 目录 | 内容 |
| --- | --- |
| `apps/www`、`apps/huiguan`、`apps/oc` | 主站、会馆、人设站（统一入口按 Host 分发） |
| `apps/activation-core` | 独立 Next.js 应用，不由门户启动 |
| `apps/shell` | 统一壳 `index.html` 与导航清单 `portal.json` |
| `apps/bilibili-toy` | B站 Toy 门庭页源码与内容（`content.json`、`assets/assets.json`）；由负责人用自己的 B站账号发布，不进站点快照，见 `apps/bilibili-toy/README.md` |
| `apps/<模块>` | 游戏源码；目录名即模块 key：cards、management、ecology、juling、aeon、world-map、slay、softie |
| `services/platform` | 统一入口 `portal_server.py`、SSO/账户/安全、存储契约（`storage_paths.py` 与 `runtime-paths.cjs`）；测试在 `tests/` |
| `packages/shared-*` | 设计系统、类型契约、只读事实、会话/存档（npm 包名仍为 `@lxh/*`） |
| `packages/site-domains` | 批准根域与站点映射：`domains.json` 为唯一来源，`index.js` / `index.mjs` 为生成物 |
| `tools/build` | 模块、首页素材、Cards、世界地图、站点快照、运行期服务的构建；`module-assets.json` |
| `tools/release` | 候选清单与封存/回滚（`release-artifacts.mjs`、`publish-release.mjs`）及其测试 |
| `tools/runtime` | 本机回环启动器、存储快照、Batch 6 数据迁移 |
| `tools/domains` | 域名配置生成与自有域名硬编码扫描 |
| `tools/checks/regression.py` | 回归入口：每个测试模块单独进程，只用临时 test 存储 |
| `tools/toy` | B站 Toy 包的构建与安全检查（`build-toy-bundle.mjs`）及其测试 |
| `tools/ops` | 调用外部运维目录的入口（`run-ops.mjs`、`update.mjs`） |
| `infra/ingress` | 入口清单 `deployed-hosts.json`、Nginx/Tunnel 生成物及渲染器、边界探针、选服页 |
| `infra/hk-legacy` | 香港旧布局的候选叠加工具（见下文"香港"） |
| `docs` | 文档；带日期的报告、审计与交接保留写作时的路径 |
| `assets` | 受版本控制的界面组件源文件与字体；真实媒体原件不进 Git |

构建产物不进 Git：候选写入外部 Release 根的 `candidate/`，封存的 Release 中模块位于 `dist/modules/<名>`、首页产物位于 `apps/www/`。

## 旧路径对照

| 旧 | 新 |
| --- | --- |
| `portal/{www,huiguan,oc,activation-core}` | `apps/{www,huiguan,oc,activation-core}` |
| `server/app/src/{cards,aeon,management,ecology,juling,world-map}` | `apps/<同名>` |
| `server/app/src/slay-the-web` | `apps/slay` |
| `server/app/src/softie-webgpu` | `apps/softie` |
| `server/app/shell/index.html`、`server/app/portal.json` | `apps/shell/` |
| `server/app/README.md` | `apps/README.md` |
| `server/app/scripts/build-modules.mjs`、`server/app/module-assets.json` | `tools/build/` |
| `server/app/modules/`（生成） | Release 内 `dist/modules/` |
| `server/*.py`、`server/runtime-paths.cjs`、`server/README.md`、`server/.env.example` | `services/platform/` |
| `server/test_*.py`、`server/verify_portal.py`、`server/test_theme_e2e.mjs` | `services/platform/tests/` |
| `server/security_ingress_test.py` | `services/platform/tests/test_ingress_security.py` |
| `shared/shared-{ui,data,session,types}` | `packages/shared-*` |
| `shared/site-domains.{json,template.js,js,mjs,d.mts}` | `packages/site-domains/{domains.json,template.js,index.js,index.mjs,index.d.mts}` |
| `scripts/{assets-manifest,build-cards,build-gallery-previews,build-runtime,build-site,build-world-map}.mjs`、`scripts/build-site.py` | `tools/build/` |
| `scripts/{publish-release,release-artifacts,test-publish-release,test-release-artifacts}.mjs` | `tools/release/` |
| `scripts/{local-runtime,backup-storage,storage-migrate}.py` | `tools/runtime/` |
| `scripts/{check-domain-hardcodes,generate-domain-config}.py` | `tools/domains/` |
| `scripts/check-batch6.py` | `tools/checks/regression.py` |
| `scripts/{run-ops,update}.mjs` | `tools/ops/` |
| `ops/security/*`、`ops/server-public/` | `infra/ingress/`、`infra/ingress/server-public/` |
| `ops/security/build_overlay_candidate.py`、`candidate-overlays.json` | `infra/hk-legacy/` |
| `portal/huiguan/watchdog.py`、`cloudflared_watchdog.ps1`、`work/` | 已删除；本机服务由 `tools/runtime/local-runtime.py` 启停 |

## 没有变的契约

- 公开 URL：`/shared/*` 仍是共享包入口（现映射到 `packages/*`），`/app/shell/*`、`/app/portal.json`、`/app/modules/*` 不变。浏览器域名映射的地址是 `/shared/site-domains/index.js`（旧 `/shared/site-domains.js` 已返回 404，所有源码页面已更新）。
- `/app/shell/*` 现在只以 `apps/shell` 为根；以前根在 `server/app`，`../` 能读到其他源码。
- npm 包名 `@lxh/*`、存储契约（`IRIDESCENTLY_STORAGE_ROOT` / `IRIDESCENTLY_ENVIRONMENT` 与就绪标记）、数据位置都不变。站点快照只导出 `apps/`、`services/`、`packages/`。

## 切换已有检出

Git 切换分支时只移动受版本控制的文件。被忽略的本地文件留在旧目录，需要手工处理：

- `portal/activation-core/.env.local` → `apps/activation-core/.env.local`（不提交）。
- 各模块的 `node_modules`：在新目录重新 `npm ci`（根目录与 `apps/{cards,management,ecology,softie}`、`apps/www/gallery-engine`）。
- 旧目录下若还有数据库、上传或日志，先确认 Batch 6 迁移已把它们放进外部存储，再处理旧副本。`.gitignore` 继续忽略整个 `/portal/`、`/server/`、`/shared/`，防止误提交。
- 调用旧仓库路径的计划任务或快捷方式（例如旧看门狗）需要停用或改路径。

## 外部运维目录

运维目录不在本仓库中，位置由工作区清单的 `operations` 登记（见 [工程工作区](workspace.md)）。2026-10-26 起它的入口按所选检出的布局选择路径：检出里有新路径就用新路径，否则用旧路径，因此同一套运维工具既能驱动本布局的检出，也能继续驱动香港旧线的旧布局根。对应关系：

| 运维文件 | 旧布局 | 新布局 |
| --- | --- | --- |
| `assets-manifest.mjs`、`build-cards.mjs`、`build-gallery-previews.mjs`、`build-site.mjs`、`build-world-map.mjs` | `<项目根>/scripts/<同名>` | `<项目根>/tools/build/<同名>` |
| `build-site.py` | `<项目根>/scripts/build-site.py` | `<项目根>/tools/build/build-site.py` |
| `publish-release.mjs`、`release-artifacts.mjs` | `<项目根>/scripts/<同名>` | `<项目根>/tools/release/<同名>` |
| `update.mjs` | `<项目根>/scripts/update.mjs` | `<项目根>/tools/ops/update.mjs` |
| `server-control.py` | `<项目根>/server`（导入 `storage_paths`） | `<项目根>/services/platform` |
| `pc-preview.py` | `server/app`、`server/app/modules`、`shared`、`portal/www` | `apps/shell`、Release 的 `dist/modules`、`packages`、`apps/www` |
| `网站恢复/website-manager.py` | `scripts/local-runtime.py`、各服务 cwd `server/app/src/<模块>`、`server/app/modules`、`portal/www/index.html` | `tools/runtime/local-runtime.py`、`apps/<模块>`（`softie-webgpu` → `softie`）、Release 的 `dist/modules`、`apps/www/index.html` |

`infra/ingress/build_host_inventory.py` 现在需要 `--website-manager <运维目录>/网站恢复/website-manager.py`。

## 香港

香港生产仍运行重构前的布局（安全入口线 `codex/security-ingress-*`）。`hk-release.py`、`hk-release-control.py` 和 `infra/hk-legacy/build_overlay_candidate.py` 都按旧路径（`server/`、`portal/`、`shared/`）打包或叠加，只能对那条线的提交使用。把本布局部署到香港是单独授权的阶段：先迁移香港数据到存储契约，再改香港发布路径。

## 历史文档

`docs/ai-handoff`、`docs/security`、`docs/maintenance`、`docs/ui-history`、`docs/design-reference`、`docs/archive`、设计系统审计，以及带日期的报告、审计和交接（如 `*-20261019.md`、`release-architecture-v2.md`、`zszm-loading-audit.md`、`SESSION_HANDOFF.md`）记录当时的状态，保留原路径；按上表换算。
