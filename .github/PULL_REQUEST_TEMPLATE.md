## 改了什么

<!-- 用人话说明行为变化，不要只复述 diff。 -->

## 为什么改

<!-- 问题、需求或设计动机。 -->

## 影响范围

- [ ] 仅当前模块内部实现
- [ ] 跨模块共享代码 / `packages/*`
- [ ] API 契约
- [ ] 数据库 / 持久化结构
- [ ] 账户 / owner / 权限 / session
- [ ] 环境变量 / 配置
- [ ] 构建 / Release / 运维
- [ ] UI / 素材

## 核心契约变化

本 PR 是否新增或修改以下内容？如选“是”，请写出名称、旧值/新值、兼容方式与文档位置。

- [ ] 核心术语
- [ ] 公共变量 / 字段
- [ ] API 请求或响应字段
- [ ] 数据库表 / 列 / 索引
- [ ] Schema / shared type
- [ ] 环境变量
- [ ] owner / scope / 身份边界

说明：

<!-- 没有则写“无”。不要留空。 -->

## 兼容与迁移

<!-- 旧客户端、旧数据、旧存档、历史字段是否仍兼容？若无需迁移，说明原因。 -->

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

请粘贴实际执行的命令和结果。不能用“测过了”代替，也不能把无法运行写成通过。

```text
<command> -> PASS / FAIL / NOT RUN（原因）
```

## 风险 / 未验证项

<!-- 包括本地无法证明的代理限制、生产状态、历史数据兼容等。没有则写“无已知未验证项”。 -->

## 最终检查

- [ ] 分支不是 `master` 上直接开发
- [ ] 一个 PR 只处理一个主要目标
- [ ] 没有提交真实数据、密钥、上传、日志或构建产物
- [ ] 没有未经授权修改生产/Cloudflare/DNS/Tunnel/OAuth
- [ ] 没有无计划全局重命名 `uid / user_id / player_id / character_id` 等公共字段
- [ ] 若公共契约变化，已同步相应文档与测试
