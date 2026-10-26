# 联机试点与落地顺序（2026-10-20）

范围：只读梳理当前工作树的 4173 灵体和 5177 聚灵源码，给后续联机服务端设计提供依据；没有迁移或修改服务。

## 当前实现

| 模块 | 现状 | 联机含义 |
| --- | --- | --- |
| 灵体（4173） | `apps/softie/server/spirit-multiplayer.js` 由 Vite 插件挂到 HTTP upgrade；客户端连接 `/api/spirit-room/ws`。玩家进入房间后服务端以 30 Hz 推进物理、以 15 Hz 广播快照。房间与玩家 ID 都在进程内存中。 | 已有服务端权威物理、房间和多人状态同步，可以作为第一轮联机验收对象。当前房间 ID 是随机连接 ID；连接只校验同源 Origin，没有账户身份验证或持久化房间。服务重启会清空房间。 |
| 聚灵（5177） | `apps/juling/server.js` 暴露 `/api/state`、`/api/start`、`/api/action`。当前 `currentRun` 与 `globalSoul` 是进程级单例；累计魂灵写入 `save.db`，不支持账户或角色归属。 | 现在的状态会被同一进程内所有请求共享，不能直接作为多个玩家各自回合的联机房间；先要分离玩家运行状态并定义授权和存档 owner。 |

端口证据来自 `E:\External Projects\Iridescently Operations\网站恢复/website-manager.py`：4173 是 Softie 的 Vite preview / WebSocket 上游，5177 是聚灵 Node 服务。该清单描述工作树的启动配置，不证明这两个源码版本已经部署到香港生产环境。

## 首个试点

选灵体房间作为第一轮试点，目标是验证现有权威房间链路的生产化和多客户端行为。它已经实现了游戏状态服务端推进、房间加入/离开、快照、心跳、超载断开和输入限速；聚灵仍是单个全局运行状态，作为多人试点需要先做更大范围的状态拆分。

本选择不表示灵体房间已经具备账户级联机：目前的随机 `selfId` 只代表当前 WebSocket 连接，不能作为账户、OC 或云存档的 owner。第一轮应保持房间短生命周期，账号绑定和跨设备存档另行设计。

## 建议顺序

1. **联机契约**：在 `apps/softie/server/spirit-multiplayer.js` 现有 `join / move / command / snapshot` 上固化协议版本、错误码、最大载荷、输入序号与房间容量；补清断线和重复加入语义。
2. **可运行的房间进程**：把房间运行时从 Vite preview 生命周期中分离为专用 Node 服务，并保留统一门户的 WebSocket 代理。第一阶段单实例、内存房间即可；部署或进程重启会结束房间，客户端重新加入。
3. **真实双客户端验收**：独立浏览器上下文加入同一房间，确认双方看到对方状态；覆盖房间隔离、离开清理、断线重连、过期输入、Origin 拒绝和 WebSocket 代理空闲心跳。
4. **再接入身份**：为房间加入可验证的服务端账户 owner；客户端不能自行声明 `(kind, uid)`。根据账号与角色存档边界任务决定加入房间时绑定账号还是允许匿名。
5. **扩展到聚灵**：先将 `currentRun` 改成房间/玩家隔离的状态，再定义每个动作的服务端验证、房间成员授权、回合顺序和存档 owner；不要让现有进程级 `globalSoul` 变成所有玩家共用的数据。

## Durable Objects 判断

第一轮不需要 Durable Objects：当前只需一个权威进程持有短期房间状态。若之后要多实例横向扩展、区域路由、房间故障恢复，或需要把每个房间固定路由到单写入者，再评估 Durable Objects 与现有 Node 服务的运维成本。第一轮验收指标应先测并发房间数、快照带宽、tick p95、进程重启后的可接受行为。

## 源码与后续任务

- `apps/softie/server/spirit-multiplayer.js`：权威物理、房间内存态、限速和快照。
- `apps/softie/src/multiplayer/client.js`：连接重试、输入序号、移动与命令发送。
- `apps/softie/tests/spirit-multiplayer.test.js`：现有房间服务测试入口（本次未运行）。
- `apps/juling/server.js`：聚灵全局状态与动作 API。
- `E:\External Projects\Iridescently Operations\网站恢复/website-manager.py`：工作树服务端口与入口清单。

下一项应是 IRI-17 的房间服务边界与 Durable Objects 评估，后续实施任务再单独定义部署形态、账户验证和多客户端验收范围。
