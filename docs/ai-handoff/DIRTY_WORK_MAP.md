# Dirty Work Map — `E:\Projects`

## 2026-10-21 收敛（Claude，分支 `zszm-batch-20261021`，未 push）

`b88faf0` 是多会话的混合 checkpoint，按用户决定保留原样；之后的改动按功能域单独提交。用户本轮决定：

| 事项 | 决定 |
| --- | --- |
| 旧入世历练（门庭「旧版 · 即将下线」入口、`#adventure`、`#hall`） | 入口先留；5 小时复活计时只在 `#adventure` 内运行（`4deee6c`），不再改写众生牌录的同行者状态 |
| 旧重生之门 slay 模块（含旧灵质修行） | 保留，等共同引擎迁完（剧情回想、长期进度、结局、旧档转换）再删；`world/activities.ts` 的 `rebirthResults` 过渡写法随之保留 |
| 六系演武 `52-全库复审收口说明.md` 的 AIGC 元数据头 | 已丢弃 |
| `ops/hk-release.py` 的 `ZSZM_HK_SSH_TARGET` 覆盖 | 未提交：自动模式把它判为放宽发布安全边界，留给用户决定 |
| `work/`、`ops/backups/`、`assets/字体/`、`.bak`、`shared/shared-ui/lxh/画师自己截的屏/` | 继续不入库 |

更新：2026-10-17 晚（Claude）。经用户授权，未提交工作已按逻辑任务组拆分提交，**均未 push**。之后又追加管理员修复、slay 可选美术，以及两个并行会话的提交。最新计数用 `git rev-list --count origin/master..HEAD` 查看。

## 已提交的任务组（050be71 之后）

| 提交 | 任务组 | 内容 | 验证 / 部署 |
| --- | --- | --- | --- |
| `468a34f` | SEC Stage 1/1.5 | HSTS + CSP-RO、loopback 与 HTTPS 跳转、Secure cookie、密码 12–128、管家 ENV、Juling HOST | 暂存内容与 `.releases/production/site` 逐文件一致；**已在线上运行** |
| `45d70c7` | `/ozmtree` | OZtree 静态路由与 README 边界说明 | 用户本地 Agent 已于 10-17 加到线上（用户授权） |
| `7774ce2` | SEC Stage 1.7 | 分页钳制、隐藏 owner id、精简 unclassified | 未部署 |
| `b567749` | SEC Stage 1.8 | `scraping_observer.py`、`base_static` hook、robots 清理 | 在 candidate 中，未部署 |
| `6e0857e` | SEC Stage 1.8.1 | 发布器结构化诊断 | 4 个模拟 log |
| `4c1f4e7` | docs | `docs/security/*` | 多份 PASS 仍为 UNVERIFIED，见下文 |
| `348955e` | 设计系统文档 | 共享 Intro Controls 文档、admin 入口 | — |
| `0d924fa` | ZSZM 整合 | 门景 → 初始化 → 门庭；`account_profile.py`；会馆头像 / OC；shengsheng 路由 | 复跑：tsc、check:game、22/22、2/2、7/7、门户 51/51；未发布 |
| `44c271c` | 素材删除 | 124 个复审确认删除的文件 | 用户已确认有意删除；构建依赖已由 `541aec6` 解除 |
| `600633c` | 存档归属迁移 | `(kind, uid, scope)`，旧 JSON 只读导入，可回滚 | `server.test_game_save_scope` 10/10、门户 51/51；未部署 |
| `31bfe0e` | 测试隔离 | `verify_portal` 默认用临时数据根 | 51/51；真实 `users.db` 未被修改 |
| `6a11118` | 主站管理员 | `server/site_admin.py`：完整 `(kind, uid)` 站长名单 + 账户库只读复核，去掉裸 uid 与 `kind == "admin"` | `server.test_site_admin` 7/7；真实库只读核对：usso:7、local:7 仍是管理员，local:218、usso:1 无主站权限（与此前实际一致） |
| `541aec6` | 重生之门可选美术 | `server/app/module-assets.json`（`slay.images` / `IRIDESCENTLY_SLAY_IMAGES_DIR`）；卡面改为 `ui/images/cards/*.svg`；缺图隐藏 | `build:modules` 无美术 exit 0、配置路径不存在 exit 1；有测试源 20/20 卡面加载；无美术时战斗正常，图片隐藏 |
| `8ebbe76` | 性能 harness（并行会话） | `ops/perf/zszm-startup.mjs`、`gate:first-frame` 打点、基线报告 `work/qa/perf/2026-10-17/` | 见该会话 HANDOFF |
| `debe31d` | 发布 v2 阶段 0（并行会话） | 隔离模拟目录复现 cwd 锁导致 rename EPERM | 见 `work/publish-simulation-20261017/` 与 release-architecture-v2.md |

证据日志：`work/qa/claude-verify-20261017/`。

## 仍未提交（有意保留）

| 路径 | 原因 | 状态 |
| --- | --- | --- |
| `New project/six-system-arena/docs/44,45-*复审记录.md` | AIGC 元数据头；属于素材复审流程（用户本地 Agent 的区域） | 留给该 Agent 或用户决定 |
| `shared/shared-types/world.js` | 只改注释：御灵与五行轴的说明；来源未确认，疑似 six-system 复审 | UNKNOWN，未提交 |
| `shared/shared-ui/lxh/ui/选种族/` | 12 个文件均是已提交的 `shared/shared-ui/lxh/QQ_*.png` 的字节级副本，其中 7 个等于被删的 race-tree / scrollbar 原图；代码无引用 | 复审参考副本，不入库，不删除 |
| `assets/字体/`（11 MB） | 未跟踪字体；许可未知 | UNKNOWN，待用户决定 |
| `*.bak_20261015_150424`（2 个） | 与当时 HEAD 字节一致 | STALE；按用户要求暂不清理 |
| `work/`、`ops/backups/` | 证据与备份，含生产用户库副本 | 按用户要求保留，之后再定归档策略 |
| `docs/ai-handoff/`、`docs/zszm-startup-performance-spec.md` | 本轮导航与规格（release-architecture-v2.md 已由阶段 0 会话提交） | 待用户审阅后提交 |
| `stash@{0}` r5-carry | 10-07 | STALE，未动 |

## 已知后续（不是未提交工作）

- （已解决，`541aec6`）`build:modules` 不再依赖已删除的 AI 图；正式新素材接入时只需设置 `server/app/module-assets.json` 的 `slay.images`。
- **线上快照与 Git 的差异**：Stage 1/1.5 和 `/ozmtree` 已入 Git。快照仍记录 `sourceDirty: true` 与手写 overlays，下次正规 `build:site` / `publish:site` 才能消除。
- **UNVERIFIED**：Stage 1/1.5 线上验证、Stage 1.7 生产计数、Stage 1.8 EPERM 原始日志（报告中有，无原始输出）。
