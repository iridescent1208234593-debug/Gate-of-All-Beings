# #101 双人隔离 PoC：实现与证据

**状态：按 [#100 RFC](MULTIPLAYER-RFC.md) 2026-11-28 的审定实现。** 只使用临时 runtime、虚构测试码和本机环回，不接生产，不新增账号体系，R4 关闭（`LAB_R4=0`，所以不能证明 R4 分支隔离）。

## 协议变化

- `space_invite`：只写待确认邀请（`space_invites`，`INVITE_TTL` = 7 天），不授予访问；重复邀请幂等，过期后可再邀。
- `space_invite_accept` / `space_invite_decline`：来客接受后才写 `space_acl`；拒绝删除邀请，不授权；已接受的访问不会过期。
- `space_revoke`：同时删除访问与待确认邀请；在场访客回到公共会馆出生点，离线访客在重连时复验后回到会馆。
- 访客在别人的私人空间里可以聊天、表情、互动，铺路与种植返回 `visitor_read_only`，调整时间返回 `not_space_owner`，不能邀请他人。
- 推送：`invited`（带 `pending`、`expires_at`）、`invites`、`spaces` 中拥有者可见 `pending`；`welcome` 带 `invites`。
- 客户端「虹之间」面板列出收到的邀请（接受 / 拒绝），拥有者看到「等待对方确认」与「撤销邀请」。

## 验收与证据

| 验收 | 证据 |
| --- | --- |
| 双人同场、移动、聊天 | `server/tests/test_gateway.py`：同场位置快照与聊天；`test_private_space_invite_revoke_isolation` 私人空间聊天不外泄到会馆 |
| 未经授权不能查看或修改他人私人空间 | 同上：未受邀与「待确认」都返回 `space_forbidden`；`test_pending_invite_decline_expiry_and_reinvite`：拒绝后、过期后、他人代接受都不授权（`invite_not_found`） |
| 邀请 / 拒绝 / 撤销 | `test_pending_invite_decline_expiry_and_reinvite`：拒绝两次幂等、重复邀请只有一行、过期后可续邀、接受后才在 ACL |
| 访客只互动 | `test_visitor_only_interacts_and_offline_revoke_returns_to_hall`：铺路 / 种植 `visitor_read_only`，`space_time` 与邀请被拒，聊天可用；拥有者仍可布置 |
| 重连不复制玩家、不污染存档 | 同上：离线撤销后重连回到 hall、pid 不变，另一方在场名单里该玩家只出现一次 |
| 客户端 | `client/tests/test_space_invites_ui.gd`：待确认邀请有接受 / 拒绝、不作为可进入空间；接受后可前往；拥有者看到等待确认 |
| 浏览器双开 | `server/e2e_browser.py` 的 B 先 `accept_invites` 再 `enter_invited` |

以上服务端测试由 merge-gate 运行（#248），客户端测试由 `tools/checks/lab-godot-client.py` 运行（#232）。

## 资源使用（2026-11-28，本机）

`python -B loadtest.py --stages 2 --seconds 20 --out <临时目录>`（两名机器人玩家：真实登录 + WebSocket，持续移动、偶尔聊天；Windows，24 核 / 31.7 GB；网关自起于临时 runtime）：

| 玩家 | 网关 CPU 平均 / 峰值 | RSS 峰值 | tick p50 / p99 | RTT p50 / p95 | 每人快照 | 每人下行 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 2.1 % / 6.2 % | 68.1 MB | 0.82 / 1.38 ms | 1.3 / 3.0 ms | 9.51 次/秒 | 119.6 kbps |

环回网络，不代表外网或手机；未录屏，以测试日志与上表代替。
