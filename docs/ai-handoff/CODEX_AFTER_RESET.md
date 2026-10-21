# Codex 恢复后先读

Claude 于 2026-10-17 临时接替。上午 Phase 0 只读考古；下午按用户授权把未提交工作拆成 11 个提交（**未 push**），实现了云存档 `(kind, uid, scope)` 迁移，并写了发布 v2 与启动性能规格。没有 publish，没有重启服务。用户的本地 Agent 并行负责素材复审与 OZtree，见 [LOCAL_AGENT_HANDOFF.md](LOCAL_AGENT_HANDOFF.md)。

## 阅读顺序

1. [PROJECT_TRUTH.md](PROJECT_TRUTH.md)：仓库、项目、**生产运行真相**（线上快照记为 dirty；10-17 的手改已获授权，代码已入 Git）。
2. [DIRTY_WORK_MAP.md](DIRTY_WORK_MAP.md)：11 个任务组提交与剩余未提交项。
3. [DEPENDENCY_MAP.md](DEPENDENCY_MAP.md)：`(kind, uid)` 风险、`publish:cards` 与 `publish:site` 的耦合。
4. [DOC_TRUTH_MAP.md](DOC_TRUTH_MAP.md)：哪些 README / 报告可信。
5. [CURRENT_PRIORITIES.md](CURRENT_PRIORITIES.md)：P0–P3 与需要用户决策的事项。
6. 规格：[release-architecture-v2.md](../release-architecture-v2.md)、[zszm-startup-performance-spec.md](../zszm-startup-performance-spec.md)、[game-save-ownership.md](../game-save-ownership.md)。

## 不要做

- 不要相信旧报告里没有原始输出的 PASS（Stage 1 / 1.5 / 1.7、EPERM 记录）。门户 51/51 已由 Claude 复现，见下表。
- 不要用真实数据根启动工作树里的门户 / 会馆：import 时会自动导入旧存档并建表。`npm run test:portal` 已默认使用临时数据根。
- 不要单独 `publish:cards`。新前端需要新的 `/api/gate/*` 后端。
- slay 美术为可选（`server/app/module-assets.json`）；未配置时构建出无图版本，这是预期行为。
- 不要删除 `work/`。安全文档把它当作证据引用。其中 `work/restore-drill/databases/` 和 `ops/backups/` 含生产用户库副本。
- 不要停止 5194 / 5195。它们留给用户验收众生之门。

## Claude 已复现的测试（2026-10-17）

前 5 项在 `server/app/src/cards` 下运行，后 2 项在项目根运行，结果均 PASS（日志：`work/qa/claude-verify-20261017/`）：

| 命令 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run check:game` | PASS |
| `npm test` | 22/22 |
| `node --import tsx --test src/onboarding/player-profile.test.ts` | 2/2 |
| `python -m unittest tests/test_gate_identity_scope.py` | 7/7 |
| `python -m unittest server.test_game_save_scope`（项目根） | 10/10 |
| `PORT=18083 python server/verify_portal.py`（临时数据根） | 51/51 |
| `python -m unittest server.test_site_admin`（项目根） | 7/7 |
| `npm run build:modules` | exit 0（无美术） |

## 状态更新

本目录是导航层。后续工作完成后，在对应文件里更新判定和日期，不要复制原文档内容。
