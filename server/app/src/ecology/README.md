

---

## 在统一工作区中的位置

> 本仓库位于统一工作区 `server/app/src/ecology/`。总览见 [根 README](../../../../README.md)，架构/数据库/API 见 [docs/](../../../../docs/)。

- 运行：`npm run dev`。
- 构建挂载：Vite base `/app/modules/ecology/`；统一壳内挂载，卸载停止 RAF 循环。
- 存档：世界持久化 → 统一存档 `@lxh/shared-session`。
- 测试：`npm test`；契约 `@lxh/shared-types`。
