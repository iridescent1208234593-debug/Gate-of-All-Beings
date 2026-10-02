# 联机（现状与预留接口）

## 现状：单机、同源单浏览器

- 跨模块协作在同源内完成：
  - 生态 → 主入口：`shared-types` 的 `eco-harvest` 包 + cards 的 exchangeQueue（IndexedDB），逐批确认去重。
  - 统一存档：`shared-session` 命名空间键。
- **没有服务端账本**：不同旧域名的 localStorage 不自动迁移，不提供跨设备/跨浏览器同步或防篡改签名。

## 预留接口设计（尚未实现）

目标：将来接入多人/云同步时，不改各游戏内部逻辑，只在统一入口加一层网络服务。

### 路由预留

```
/api/net/hello                 # 能力探测：{ protocol: 1, features:[...] }
/api/net/session               # 建立/加入对局：{ roomId, seat, token }
/api/net/state?room=<id>&since=<seq>   # 拉取增量状态
/api/net/action                # 提交动作 { roomId, seq, op, payload }（幂等）
/ws                            # WebSocket 升级：实时状态与动作广播（协议见下）
```

- 在 `portal_server.route` 增加 `/api/net/*` 与 `/ws` 分支；`/ws` 需在 `ThreadingHTTPServer` 上做 Upgrade 握手（或在前面加一层支持 WS 的网关）。
- 房间/对局状态建议独立存储（如 SQLite 表 `net_rooms(id, seq, state, updated_at)`），与世界观库、用户库分离。

### 消息信封（建议）

与 `shared-types` 现有风格一致：

```jsonc
{ "schemaVersion": 1, "kind": "net-action",
  "roomId": "r-…", "actor": "eigenflux|uid", "seq": 42,
  "op": "move|playCard|gather|…", "payload": { }, "ts": 1730000000000 }
```

- 幂等：接收方按 `(roomId, seq)` 去重，早于已接收批次丢弃（复用 exchange 的序列思路）。
- 鉴权：复用 `hx_sso` 登录态；`/api/net/session` 校验 uid 后签发房间 token。
- 冲突：服务端权威状态 + 客户端预测（先不做），或回合制锁步（推荐先做锁步）。

### 前端接入点

- 统一壳/`shared-session`：把网络层做成 `@lxh/shared-net`（将来），暴露与 `save` 类似的 `connect()/send()/onState()`。
- 各游戏只在“存档/动作提交”处替换为网络调用，不感知传输细节。

### 不做的事（边界）

- 不做跨域共享存档、统一云账户账本、防篡改签名。
- 不改变现有单机存档与 exchange 行为；网络层为可选叠加。
