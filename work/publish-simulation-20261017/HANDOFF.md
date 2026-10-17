# 阶段 0 handoff：cwd 锁导致 site 发布 EPERM（2026-10-17）

结论：**假设成立。** 只要有进程的 cwd 在 `.releases/production/site` 树内，`ops/publish-release.mjs site` 的目录 rename 就会稳定 EPERM（13 次重试全部失败）。只停 portal 或只停 zszm-oauth 都不够，两个都停才成功。详见 `docs/release-architecture-v2.md` 第 7 节"阶段 0 结论"。

## 实际改动（均未 commit / push）

- 新增 `work/publish-simulation-20261017/repro-cwd-lock.mjs`：复现脚本。
- 新增本目录下的 5 个场景假树和 `<场景>.log`（含 `[release-fs]` 日志）、`summary.json`、本文件。
- 修改 `docs/release-architecture-v2.md`：第 1 节一句措辞改为"已复现"；第 7 节阶段 0 行标为已完成；新增"阶段 0 结论"小节。
- 未碰真实 `.releases`，未停任何正式服务，未改 ops/ 源码。替身进程只绑 127.0.0.1 的随机端口，运行后已确认无残留。

## 运行

```
node work/publish-simulation-20261017/repro-cwd-lock.mjs            # 全部 5 个场景
node work/publish-simulation-20261017/repro-cwd-lock.mjs stop-portal-only
```

两轮结果一致：control 和 stop-both 退出码 0（production=new）；both-running、stop-portal-only、stop-oauth-only 退出码 1，13 × EPERM/-4048，production=old，`.promotion` 已清理。

## 未证明 / 后续

- 没有在生产机上取证当时 5174 的 cwd，也不能排除 Defender、`users.db` 句柄等其他持有者。本实验证明的是"足以导致"。
- 脚本第一版有个 bug：被信号杀掉的子进程 `exitCode` 是 null，清理时会一直等待。已改为同时检查 `signalCode`。
