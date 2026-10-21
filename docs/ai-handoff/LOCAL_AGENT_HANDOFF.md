# 本地自建 Agent 交接

给用户在本机并行运行的第三方 Agent。它当前负责素材复审与 OZtree 相关工作。

## 当前事实（2026-10-17 下午）

- `E:\Projects` master 比 origin 领先 24 个提交，均未 push。Claude 今天新增 11 个，按任务组拆分，见 [DIRTY_WORK_MAP.md](DIRTY_WORK_MAP.md)。
- 124 个复审删除的素材已提交（`44c271c`）。`/ozmtree` 路由已提交，并在根 README 写明边界（`45d70c7`）。
- 线上 `.releases/production/site/server/portal_server.py` 是 10-17 10:59 的手改版本，与 `production.json` 的 manifest 哈希不一致。已提交源码等于这份线上版本加上 shengsheng 路由。下次正规发布会消除这个差异。
- `npm run build:modules` 目前会失败：重生之门（slay）仍从已删除的 `shared/shared-ui/AI image/images` 复制图片。
- 云存档已改为 `(kind, uid, scope)`（`server/game_saves.py`）。会馆模块被 import 时会自动导入旧存档，所以**不要用真实数据根启动工作树里的门户 / 会馆**。`npm run test:portal` 已默认使用临时数据根。

## 你负责的边界

- `E:\External Projects\待审区（用户终审）`、`复审记录`、`未定以及以及疑似同人`、`AI生成（与罗小黑战记动画无关联）`
- `E:\External Projects\众生之门生物树可视化前端`（含 OZtree）
- `E:\Projects\New project\six-system-arena\docs\` 的复审记录
- 素材复审结论落到 `E:\Projects\shared\shared-ui` 时的删除 / 新增

## Claude 的区域（不要改）

- `server/`、`portal/`、`ops/`、`server/app/src/**` 源码
- `docs/ai-handoff/`、`docs/release-architecture-v2.md`、`docs/zszm-startup-performance-spec.md`、`docs/game-save-ownership.md`
- `.releases/`：发布由用户批准后执行；不要再手改 production 快照

## 接口

| 方向 | 怎么做 |
| --- | --- |
| 你需要改 Claude 区域里的文件（如 `build-modules.mjs` 的 slay 图片来源、`portal_server.py`） | 不要直接改。在你的 handoff 里写明"需要的变化 + 原因 + 证据"，由 Claude 实施 |
| 复审导致 `shared/shared-ui` 增删 | 可以做，但完成后列出受影响路径。先用 `git grep` 查引用，并写进 handoff |
| 交接文件 | `E:/Projects/docs/ai-handoff/LOCAL_AGENT_REPORT.md`（你来写；Claude 会读） |

## 硬规则

- 不覆盖、不 restore、不 stash、不 reset 任何你没写过的未提交修改。动一个文件前先 `git status` / `git diff` 确认它当前的状态。
- 不 commit、不 push、不 publish、不重启正式服务，除非用户在对话中明确要求。
- 不删除 `work/`、`ops/backups/`。
- 不向 `.releases/production` 写入。

---

## 继续任务提示词（可直接粘贴给本地 Agent）

<pre>
你在 E:\Projects 项目群里与 Claude 并行工作。先读 E:/Projects/docs/ai-handoff/LOCAL_AGENT_HANDOFF.md 和 DIRTY_WORK_MAP.md，以磁盘与 git 的实际状态为准，不以任何旧报告为准。

目标：完成你正在进行的素材复审 / OZtree 工作，并把结论变成可核对的事实。

你的边界：
- External Projects 下的复审目录与 OZtree
- six-system-arena 的复审记录
- 复审结论导致的 shared/shared-ui 素材增删

其他区域（server/、portal/、ops/、.releases/、docs/ai-handoff 中 Claude 的文件）只读。需要那里发生变化时，写进报告，由 Claude 实施。

约束：
- 不覆盖、不还原、不 stash 任何你没写过的未提交修改；动文件前先看 git status / diff
- 不 commit、不 push、不发布、不重启服务、不写 .releases/production，除非用户明确要求
- 不删除 work/ 和 ops/backups/
- 删除或新增 shared/shared-ui 素材前先 git grep 引用，并在报告中列出

完成标准：写出 E:/Projects/docs/ai-handoff/LOCAL_AGENT_REPORT.md，包含：
1. 实际修改的文件清单（路径 + 新增 / 修改 / 删除）
2. 每项结论的证据（复审记录、对比结果、引用检查）
3. 实际运行的检查与结果（命令 + 输出摘要）；没跑的写"未验证"
4. 需要 Claude 在其区域内做的变化（例如重生之门 slay 图片的新来源）
5. 仍未完成或不确定的事项
</pre>
