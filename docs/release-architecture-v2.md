# 发布架构 v2：不可变版本 + 指针切换（规格，未实施）

状态：2026-10-17 设计稿，供评审。它取代对 `ops/publish-release.mjs` 的补丁式修复。现行流程见 [release-workflow.md](release-workflow.md)，诊断证据见 [STAGE1_8_1_RELEASE_RECOVERY.md](security/STAGE1_8_1_RELEASE_RECOVERY.md)。

## 1. 为什么现行方式会 EPERM

现行发布用目录重命名完成"原子"切换：`production/site → .promotion/previous/0`，再把 candidate 改名进来。Windows 上，如果某个进程的**工作目录**或打开的句柄位于该目录树内，重命名就会失败。

源码证据：`ops/网站恢复/website-manager.py` 对 **`portal` 和 `zszm-oauth` 两个服务**都把 cwd 改写到 `.releases/production/site/...` 内部（约第 326 行）。

- Stage 1.8.1 报告只停了 Portal（8080），5174 Cards API 仍在运行，它的 cwd 在 `production/site/server/app/src/cards`。这足以解释"停掉 Portal 后重试仍失败"。报告把这一点记为 UNKNOWN；**阶段 0 已在隔离副本中复现该机制**（见第 7 节"阶段 0 结论"）。
- 另外，Defender 扫描、`__pycache__` 写入，以及 10-17 出现在快照内的空 `users.db`（说明有进程在快照内打开过数据库），都会在被重命名的树里留下句柄。

结论：只要"切换"需要重命名正被使用的目录，重试次数再多也不可靠。正确做法是**永远不移动正在使用的目录**。

## 2. 原则

1. **不可变版本**：每次发布写入一个新目录，写完设为只读，此后不改、不移动。
2. **指针切换**：生产使用哪个版本只由一个很小的指针决定。切换只改指针，不动目录。
3. **生命周期归网站管家**：发布器只"选择版本"。服务用新版本重启，由管家完成并做健康检查；失败时自动把指针改回去。
4. **运行数据永不进入版本目录**：服务启动时，`IRIDESCENTLY_PROJECT_ROOT` 未设置或指向 `.releases` 内部就拒绝启动。
5. **漂移可检测**：管家启动服务前校验版本 manifest 哈希。手工改动（如 10-17 的 overlay）会被发现并要求变成正式版本。
6. **组件契约显式化**：各组件声明自己提供 / 需要的 API 版本，解决 `publish:cards` 必须配合 `publish:site` 的隐性耦合。
7. **可扩展到新组件**：设计系统后端、未来服务按同一模型接入（第 6 节）。

## 3. 目录与数据模型

```
.releases/
  candidate/<component>/           # 构建输出（现有）
  store/<component>/<release-id>/  # 封存后的不可变版本，含 manifest.json
  channels/production.json         # { component: release-id }，以及 history[]
  channels/production.lock         # 发布互斥锁（创建失败 = 有人在发布）
```

- `release-id` = `<UTC yyyymmddHHMMss>-<sourceHead 7 位>-<manifest 哈希 8 位>`。
- `manifest.json` 字段：`component`、`sourceHead`、`sourceDirty`、`builtAt`、`files{path: sha256}`、`provides{api: version}`、`requires{component.api: ">=n"}`、`services[]`（需重启的管家 key）。
- 组件：`site`（portal/server/shared 源码快照）、`cards`、`modules/<name>`（7 个）、`homepage`。以后加 `ui`（共享设计系统资源）和 `design-system`（后端服务）。

## 4. 流程

| 步骤 | 命令（建议名） | 行为 | 失败影响 |
| --- | --- | --- | --- |
| build | 现有 `build:*` | 写 candidate | 无 |
| seal | `release seal <component>` | 复制到 `store/.../<id>`，计算 manifest，设只读 | 只是多一个未使用版本 |
| plan | `release plan` | 显示指针变化、需重启的服务、契约检查、`sourceDirty` 门槛 | 无 |
| switch | `release switch <component>@<id>` | 拿锁 → 写 `production.json.tmp` → 替换文件（小文件替换，可重试）→ 记 history | 指针不变 |
| restart | 管家按 `services[]` 重启：新进程 cwd 指向新版本目录，旧进程停止后其目录自然空闲 | — | 健康检查失败 → 指针回退 → 用旧版本重启 |
| verify | 管家健康检查 + `verify_portal`（隔离数据根）+ 公网探测 | — | 同上 |
| gc | `release gc` | 每组件保留最近 5 个版本；不删当前 / 上一个 / 任何运行中进程使用的版本 | 无 |

- `modules` / `cards` / `homepage` 目前由门户按请求从 `server/app/modules/<name>`、`portal/www/assets/homepage` 读取。**过渡期**让这些路径变成指向 `store` 版本的 junction。重新指向 junction 只需删除并重建这个链接，不需要移动正在被读取的目录。之后再让门户直接读取指针，用管家的 reload 信号刷新。
- **生产门槛**：`sourceDirty: true` 的版本默认拒绝切换。紧急情况用 `--allow-dirty --reason "<文字>"`，原因写入 history。手工 overlay 改为"从 hotfix 提交封存一个新版本"。
- **回滚** = `release switch <component>@<上一个 id>`，加上管家重启。用户运行数据不随版本回滚（与现状一致）。

## 5. 保留与替换

- **保留**：`verifyCandidate` 的全文件哈希、`[release-fs]` / `[release-preflight]` 诊断格式、`.promotion` 中断保护的思路（改为锁文件）。
- **替换**：目录重命名切换、多目录逐个提升、`production.json` 的手写 overlays。
- **网站管家**：增加"从指针解析版本目录 → 校验 manifest → 启动 → 健康检查 → 回报"的统一路径。端口与域名配置不变，不引入新 DNS / CDN。

## 6. 设计系统后端与共享 UI 的接入位

目前共享 UI 直接从源码目录 `CODE_ROOT/shared` 提供（`/shared/`、会馆 `design-system/ui` junction）。另外，Cards 前端会跨域同步加载会馆的 `design-system.css`、`avatar-cropper.*`。这意味着改共享 UI 等于即时改线上，而且没有版本。

v2 的接入位：

- **`ui` 组件**：把 `shared/shared-ui` 的发布形态封存成版本，按内容哈希提供，路径 `/ui/<release-id>/...`，可长期缓存。各站点的 manifest 写明自己依赖的 `ui` 版本，页面引用由构建注入，不再硬编码跨子域 URL。
- **`design-system` 组件（后端）**：作为一个独立服务组件接入管家（自己的端口与 `services[]`）。它对外提供 token / 组件注册等数据，**产出** `ui` 组件的内容。站点只消费 `ui` 版本，不在运行时依赖后端可用。后端停机不影响已发布页面。
- **契约**：`design-system` 的 `provides` 写 token schema 版本（例如 `tokens: 1`）；`ui` 的 manifest 写自己由哪个 token schema 生成。站点 `requires` 只依赖 `ui`。这样后端演进不会直接破坏站点。

后端的技术栈与存储由你的现有设计系统后端决定。本规格只固定它在发布模型中的边界，不预设实现。

## 7. 分阶段实施与验收

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| 0 | 验证 EPERM 假设：在隔离副本中让一个进程 cwd 位于目标树，复现 rename EPERM；记录句柄 | 有可重复的复现脚本与日志（**已完成，2026-10-17，假设成立**） |
| 1 | `seal` / `plan` / `switch` / `gc` + `channels/production.json`；管家从指针解析 cwd，并校验 manifest | 模拟树中切换 / 回滚 / 健康失败自动回退全部通过；正在运行的旧版本不阻塞切换 |
| 2 | `modules` / `cards` / `homepage` 改为 junction 指向 store | 发布 cards 时门户不停机、不 EPERM |
| 3 | 契约检查（cards ↔ site 的 `gate-identity` API）与 dirty 门槛 | 缺契约的组合被 `plan` 拒绝 |
| 4 | `ui` 组件与内容哈希 URL；Cards / 会馆去掉跨子域同步 CSS / JS | 共享 UI 修改需要发布才生效；首屏无跨子域阻塞资源 |
| 5 | `design-system` 后端组件接入 | 后端停机时已发布页面不受影响 |

### 阶段 0 结论（2026-10-17）：假设成立

脚本：`node work/publish-simulation-20261017/repro-cwd-lock.mjs`（可重复运行；每个场景重建自己的假项目树）。日志：同目录下 `<场景>.log`（含完整 `[release-preflight]` / `[release-fs]` 行）和 `summary.json`。

做法：把真实的 `ops/publish-release.mjs`、`ops/release-artifacts.mjs` 原样复制进假树。按 `website-manager.py` 的 cwd 规则起两个替身进程（`python -m http.server 0`，只绑 127.0.0.1 随机端口）：portal → `production/site/server`，zszm-oauth → `production/site/server/app/src/cards`。替身空闲时不打开树内任何文件，所以**唯一变量是 cwd**。按场景停掉其中一部分，再运行 `publish-release.mjs site`。

| 场景 | 仍在运行（cwd 在树内） | 发布器退出码 | 发布后 production | rename 失败 |
| --- | --- | --- | --- | --- |
| control-no-services | 无 | 0 | new | 0 |
| both-running | portal + zszm-oauth | 1 | old（已回滚） | 13 × `EPERM/-4048` |
| stop-portal-only | zszm-oauth | 1 | old（已回滚） | 13 × `EPERM/-4048` |
| stop-oauth-only | portal | 1 | old（已回滚） | 13 × `EPERM/-4048` |
| stop-both | 无 | 0 | new | 0 |

连续运行两轮，结果完全一致（Node v24.18.0，Windows 11）。

证据要点：

- 失败点与真实 Stage 1.8 一致：都失败在第一步 `production/site → .promotion/previous/0`，错误文本格式相同（`EPERM: operation not permitted, rename …; previous production outputs restored.`）。13 次重试（约 4 秒）全部失败，说明这不是 Defender 那类短暂锁，重试解决不了。
- **只停一个进程不够**：无论留下的是哪一个，只要还有一个进程的 cwd 在树内，rename 就失败。两个都停才成功。这直接解释了"停掉 8080 后重试仍失败"。
- 回滚路径在真实锁下表现正确：旧版本原地不动，`.promotion` 被清理。

尚未证明的部分：

- 本实验证明"5174 仍在运行"**足以**导致当时的失败，但没有在生产机上取证当时 5174 的 cwd，也不能排除当时还有其他持有者（Defender、`users.db` 句柄）。
- 生产上仍不应重试 v1 发布器来取证。v2 的指针切换不移动正在使用的目录，所以不受这一机制影响；阶段 1 验收里"正在运行的旧版本不阻塞切换"可以直接复用本脚本的替身进程做法。

## 8. 需要你决定

1. 版本保留数（建议 5）与磁盘预算（当前 site 快照约 260 MB）。
2. 管家是否获得"切换后自动重启受影响服务"的权限。默认建议：需要显式 `--restart` 才执行。
3. 设计系统后端的现有位置、端口与数据所有权，以便确定第 5 阶段的接入点。
