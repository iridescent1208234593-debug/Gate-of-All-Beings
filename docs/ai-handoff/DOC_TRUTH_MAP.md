# Documentation Truth Map

判定：**CURRENT** / **PARTIALLY CURRENT** / **STALE** / **UNKNOWN**（2026-10-17，按源码与复跑结果核对）。本表不改写原文档。

| 文档 | 判定 | 依据 |
| --- | --- | --- |
| [zszm-identity-and-save-map.md](../zszm-identity-and-save-map.md) | CURRENT | 与 `account_profile.py`、`cards/server.py`、`server_huiguan.py` 一致；自述"线上未包含" |
| [zszm-flow-integration.md](../zszm-flow-integration.md) | CURRENT（本地/候选范围） | 流程与源码一致；本轮未发布 |
| [zszm-loading-audit.md](../zszm-loading-audit.md) | CURRENT（本地/候选范围） | 测量脚本 `work/qa/zszm-merge-20261017/huiguan-source-smoke.py` 存在；数值未复跑 |
| [work/qa/zszm-merge-20261017/README.md](../../work/qa/zszm-merge-20261017/README.md) | PARTIALLY CURRENT | tsc、check:game、22/22、2/2、7/7、门户 51/51（隔离数据根）已复现；浏览器验收 UNVERIFIED |
| `server/app/src/cards/README.md`（工作树） | CURRENT（本地） | HEAD 版是 AI Studio 模板，属于 STALE |
| [根 README.md](../../README.md) | PARTIALLY CURRENT | 10-17 已补 `/ozmtree` 边界与 `test:portal` 实际行为；仍未说明快照 dirty / overlay；外部目录表缺 8 项；research / Anime2SVG 读 `E:\Projects` 未写 |
| [docs/README.md](../README.md) | PARTIALLY CURRENT | 索引已加 zszm 条目；仍引用已删除的 `AI image` |
| [architecture.md](../architecture.md) | PARTIALLY CURRENT | 第 52 行仍写 slay → `shared/shared-ui/AI image/images` |
| [hooks.md](../hooks.md) | PARTIALLY CURRENT | 第 40 行同上 |
| [release-workflow.md](../release-workflow.md) | PARTIALLY CURRENT | 声称快照只从审查后的提交构建；实际 site `sourceDirty: true`、手工组装、overlay、10-17 手改 |
| `docs/security/STAGE1_REMEDIATION_REPORT.md`、`STAGE1_5_PRODUCTION_VERIFICATION.md` | PARTIALLY CURRENT | 代码已上线；PASS 无原始输出 → UNVERIFIED |
| `docs/security/STAGE1_6_OPERATIONAL_HARDENING.md` | CURRENT | 有 listeners.csv、restore-drill 证据 |
| `docs/security/STAGE1_8_ANTI_SCRAPING_PRODUCTION.md` | PARTIALLY CURRENT | 候选存在、未上线；EPERM 无原始日志 |
| `docs/security/STAGE1_8_1_RELEASE_RECOVERY.md` | CURRENT | 4 个模拟 log 可查 |
| 其它 `docs/security/*`（baseline、matrix、csp 等） | UNKNOWN | 未逐项核对 |
| [game-save-ownership.md](../game-save-ownership.md) | CURRENT | 与 `server/game_saves.py`、测试一致；未部署 |
| [release-architecture-v2.md](../release-architecture-v2.md)、[zszm-startup-performance-spec.md](../zszm-startup-performance-spec.md) | CURRENT（规格） | 设计稿，未实施 |
| [SESSION_HANDOFF.md](../SESSION_HANDOFF.md)（10-05） | STALE | 描述 `f4004fdb`、31/31 等早期状态；已被本目录取代 |
| `server/app/README.md` | CURRENT | embed / iframe 描述与 `portal.json`、shell 一致 |
| `shared/README.md` | CURRENT | junction 说明与磁盘一致 |
| `External Projects\original-ui-version\{README,INTEGRATION}.md` | STALE | 端口 5191 无代码支撑；原型已整合进 `cards/src/onboarding` |
| `External Projects\README.md` | PARTIALLY CURRENT | 目录表不全；"不参与构建"不准确 |
| Codex 完成报告中的 "PASS"（各处） | 逐项核对 | 没有可复现输出的一律按 UNVERIFIED 处理 |

## 已发现的文档冲突

1. （下午已部分缓解：线上代码已入 Git）"快照只从提交构建"（release-workflow / 根 README）与 `production.json` 的 `sourceDirty: true` 加手工 overlay 冲突。
2. （已解决）根 README 已写明 `/ozmtree` 例外。
3. architecture / hooks 仍以 `AI image/images` 为 slay 素材来源，而该目录已按复审删除（`44c271c`）。
4. cards README 的 HEAD 版（AI Studio 模板）与工作树版（正式说明）冲突，以工作树为准。
