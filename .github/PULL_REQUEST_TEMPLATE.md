<!--
众生之门仓库的 Pull Request 规范。

填写前请先读：
  AGENTS.md
  docs/development/AI_DEVELOPMENT.md
  docs/development/GLOSSARY.md
  docs/development/NAMING_AND_CONTRACTS.md
  docs/development/BRANCH_STRATEGY.md
  .github/instructions/ 下与本 PR 改动路径匹配的规则

协作流程：切分支 → 提 PR → 评审通过 → 合并。
CI 未通过、或评审未通过之前不要合并；协作者的分支在评审之前不合并、不删除、不改写。
-->

## 改了什么

<!--
用人话说明**行为变化**，不要复述 diff。

要求：
- 写清楚「谁、在什么情况下、会看到什么不同的结果」；
- 一个 PR 只处理一个主要目标；多个目标请拆成多个 PR；
- 如果本 PR 同时包含「功能改动」和「配套的自动化测试」，在这里只描述功能改动，
  测试放在下面的「自动化测试」一节。
-->

## 为什么改

<!--
问题现象、需求或设计动机。修复 bug 时，写清楚 bug 的**触发条件**与**用户可见的影响**。
如有对应的 issue / 文档 / 讨论，贴链接。
-->

## 影响范围

<!-- 勾选所有适用的项；每一项都要在下面「核心契约变化」里给出对应说明。 -->

- [ ] 仅当前模块内部实现
- [ ] 跨模块共享代码 / `packages/*`
- [ ] API 契约
- [ ] 数据库 / 持久化结构
- [ ] 账户 / owner / 权限 / session
- [ ] 环境变量 / 配置
- [ ] 构建 / Release / 运维
- [ ] UI / 素材

## 核心契约变化

本 PR 是否新增或修改以下内容？如选"是"，请写出名称、旧值/新值、兼容方式与文档位置。

<!--
逐项写出：名称 | 旧 | 新 | 兼容方式 | 文档位置（文件路径 + 章节）。
确实没有变化的项目勾"否"。
-->

- [ ] 核心术语
- [ ] 公共变量 / 字段
- [ ] API 请求或响应字段
- [ ] 数据库表 / 列 / 索引
- [ ] Schema / shared type
- [ ] 环境变量
- [ ] owner / scope / 身份边界

说明：

<!-- 没有则写"无"。不要留空。 -->

## 兼容与迁移

<!--
旧客户端、旧数据、旧存档、历史字段是否仍兼容？
是否需要 migration？迁移的触发条件、执行方式与回滚方式分别是什么？
若无需迁移，说明原因。
-->

## 自动化测试

<!--
CONTRIBUTING.md 的硬性要求：新增或修改逻辑必须有对应测试；修复 bug 时先补能复现该 bug 的测试。

必须回答三件事，缺一不可：

1. 测试文件在**仓库内**的哪个路径？
   —— 探针脚本、临时脚本必须提交进仓库，不能只放在仓库外的本地目录，
      否则评审方无法复现。

2. 复现命令是什么？
   —— 贴**完整命令**（含工作目录），评审方要能在自己的机器上原样跑通。

3. 修复前的失败证据是什么？
   —— 同一份测试在修复前应当失败。贴出失败的用例名与统计，
      这是「这个测试确实抓得住这个 bug」的证据。
-->

测试文件路径：

<!-- 例：apps/aeon/test/war-veto.test.mjs -->

复现命令：

<!--
例：
  cd apps/aeon && node --test "test/war-veto.test.mjs"
  cd apps/aeon && npm test
-->

修复前失败证据：

<!--
例：
  git checkout master && cd apps/aeon && node --test "test/war-veto.test.mjs"
  -> FAIL（预期）  # tests 5 / # pass 4 / # fail 1
                    # not ok 1 - a war involving the player is not ended by war weariness
-->

若本次不新增测试，请说明原因：

## AI 使用情况

- [ ] 本 PR 有 AI 参与
- [ ] 本 PR 无 AI 参与

若有 AI 参与：

- 使用工具：<!-- Claude / Codex / Copilot / 其他 -->
- 已读取：`AGENTS.md`
- [ ] 已读取 `docs/development/AI_DEVELOPMENT.md`
- [ ] 已检查 `docs/development/GLOSSARY.md`
- [ ] 已检查 `docs/development/NAMING_AND_CONTRACTS.md`
- [ ] 已检查与本任务相关的 `.github/instructions/`
- [ ] AI 未自行新增未登记的核心概念或平行字段

## 验证

请粘贴实际执行的命令和结果。不能用"测过了"代替，也不能把无法运行写成通过。

```text
<command> -> PASS / FAIL / NOT RUN（原因）
```

<!--
要求：
- 每条命令都要有真实输出，不接受「应该能过」；
- 跑不了的检查写 NOT RUN 并说明原因，**不要写 PASS**；
- CI 必须为绿：`regression`（推送分支）与 `merge-gate`（PR 合并结果）；
  改动 `apps/aeon` 时另有 AEON 回归套件（`aeon regression suite`）必须为绿；
- 浏览器端 / 真机相关改动，注明是否在无头环境验证过。
-->

## 风险 / 未验证项

<!--
包括但不限于：本地无法证明的代理限制、生产状态、历史数据兼容、
浏览器 / 真机未覆盖的部分、数值平衡未评估、对其他模块的潜在影响。
没有则写"无已知未验证项"。
-->

## 合并顺序（堆叠 PR）

<!--
如果本 PR 依赖另一个尚未合并的 PR，写明：依赖的 PR 号 + 合并顺序。
不依赖则写"无"。

例：本 PR 依赖 #122，需在 #122 合并之后合并。
-->

## 最终检查

- [ ] 分支不是 `master` 上直接开发
- [ ] 一个 PR 只处理一个主要目标
- [ ] 没有提交真实数据、密钥、上传、日志或构建产物
- [ ] 没有未经授权修改生产/Cloudflare/DNS/Tunnel/OAuth
- [ ] 没有无计划全局重命名 `uid / user_id / player_id / character_id` 等公共字段
- [ ] 若公共契约变化，已同步相应文档与测试
