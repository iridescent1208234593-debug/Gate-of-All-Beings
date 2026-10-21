# Current Priorities（2026-10-17 下午更新）

用户已做出的决策：

| 事项 | 决策 |
| --- | --- |
| 素材删除 | 有意，已提交 |
| 10-17 production / OZtree 修改 | 用户本地 Agent 所为，已授权；`/ozmtree` 接受并补 README |
| 拆分提交 | 允许，**不 push** |
| `game_saves` | 迁移到长期账户隔离，已实现 |
| `work/`、`ops/backups` | 暂时保留 |

## P0

1. （已完成）slay 美术改为可选，`build:modules` 恢复可用；等待用户指定正式素材源。
2. **首次正规发布**：从提交构建 site（`sourceDirty: false`），在维护窗口 `publish:site` 与 `publish:cards` 一起发布，然后用 `python server/game_saves.py status` 确认存档迁移。必须先解决 EPERM：短期按 [release-architecture-v2.md](../release-architecture-v2.md) 第 7 节阶段 0 验证 cwd 假设，即同时停 5174 与 8080。需要用户批准发布窗口。

## P1

3. （已完成，`6a11118`）主站管理员改为完整 `(kind, uid)` 站长名单 + 服务端账户状态复核；实际权限不变。会馆其余裸 uid 风险（OC 键、admin 删除接口原始 key）见 DEPENDENCY_MAP。
4. 发布架构 v2 阶段 0–2（[规格](../release-architecture-v2.md)）。
5. 众生之门启动性能（[规格](../zszm-startup-performance-spec.md)）：先做测量 harness，再处理字体（**先确认许可**）。

## P2

6. 会馆 `characters.json` 的 OC 键迁移：复用 `game_saves.resolve_legacy_owner` 的规则，单独设计。
7. 文档同步：`release-workflow.md` 写入 v2 过渡说明（architecture / hooks 的 slay 描述已在 `541aec6` 更新）。
8. 提交 `docs/ai-handoff/` 与两份规格（待用户审阅）。

## P3

9. 外部实验（Anime2AnimatedSVG Stage 3、research 的 207 个未跟踪文件、url-wallpaper）。
10. 清理类事项须用户另行授权：嵌套 `.git`、`InternalBeyond`、stash、已合并分支、`.bak`、`Projects-worktrees` 残留、`codex/r2-asset-resolver`。最后一项已被 `gallery-engine` 现有实现取代（它改的是旧路径 `New project/gallery/...`）。

## Safe Next Actions

| 类别 | 内容 |
| --- | --- |
| **A. Claude 可直接做** | 维护本目录；在隔离数据根复跑测试；实现性能 harness；在模拟树中验证 EPERM 假设 |
| **B. 需继续调查** | `world.js` 注释来源；`assets/字体/` 用途与许可 |
| **C. 规格已出，可由 Claude 或 Codex 实施** | 发布架构 v2；启动性能 |
| **D. 需用户决策** | slay 正式素材源；发布窗口；字体许可；是否 push |
