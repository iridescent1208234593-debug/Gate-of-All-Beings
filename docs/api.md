# API 参考

统一入口把各游戏 API 代理到其上游：`/app/modules/<名>/api/*` → 上游 `/api/*`
（cards→`5174`、softie→`4173`、juling→`5177`）。会馆/主站/人设站按 Host 直达各自 Handler。

## 1. 会馆 `apps/huiguan/server_huiguan.py`（8089）

登录/账号：
`/api/register`、`/api/login`、`/api/logout`、`/api/user`、`/api/sso-user`、`/api/auth`、`/api/rename`、`/api/user/theme`、`/api/sso/role-theme`、`/api/security/<setup|question|change|reset|settings>`

角色 / 官方资料：
`/api/get-characters`、`/api/get-character`、`/api/save-character`、`/api/save-all-characters`、`/api/my-broken-characters`、`/api/official/characters`、`/api/official/character`、`/api/official/edit`、`/api/official/graph`、`/api/official/merge`、`/api/official/react`、`/api/official/reactions`、`/api/official/scribe-apply`、`/api/official/supplement`、`/api/official/avatar/set`

图片 / 素材：
`/api/official/img`、`/api/official/img-id`、`/api/official/unclassified`、`/api/official/unclassified-img`、`/api/official/image/add|delete|reorder|type`、`/api/official/sticker/upload`、`/api/official/stickers`、`/api/assets/manifest`、`/api/assets/avatar`、`/api/assets/image`、`/api/assets/shared`

申请 / 管理：
`/api/elder/apply`、`/api/exempt/apply`、`/api/group/confirm`、`/api/admin/users`、`/api/admin/user/update`、`/api/admin/user/delete`、`/api/admin/characters`、`/api/admin/delete-character`、`/api/admin/elder-requests`、`/api/admin/elder/decide`、`/api/admin/exempt-requests`、`/api/admin/exempt/decide`、`/api/admin/scribe-requests`、`/api/admin/scribe/decide`、`/api/admin/supplements`、`/api/admin/supplement/decide`、`/api/admin/posters`、`/api/admin/poster/delete`、`/api/member/users`、`/api/member/user/update`

同人 / 配色 / 海报：
`/api/fan/submit|list|my|publish|react|reactions|toggle|check-suggest`、`/api/color-schemes`、`/api/color-schemes/mine`、`/api/color-schemes/delete`、`/api/posters/save|publish|my|get|delete`

云存档：`/api/game/save`、`/api/game/load`

`POST /api/game/save?scope=softie` 与 `GET /api/game/load?scope=softie` 保存或读取登录账号的灵体外观参数。省略 `scope` 时继续使用原有灵境会馆存档。

也接受前缀 `/api/huiguan/<同上>` 与 `/api/security/*`。

## 2. 卡牌 OAuth `apps/cards/server.py`（5174）

`GET /api/login`、`GET /api/callback`、`GET /api/user`、`GET /api/sso-user`、`GET /api/logout`

## 3. 聚灵 `apps/juling/server.js`（5177）

`GET /api/state`、`POST /api/start`、`POST /api/action`

## 4. 软乎乎 `apps/softie/server/spirit-settings.js`（Vite dev/preview，4173）

`GET /api/spirit-settings`、`PUT /api/spirit-settings`（JSON，服务端校验）

## 5. 主站 `apps/www/server.py`（8088 → 统一入口主域）

`GET /api/sso-user`、`POST /api/admin/links`、`POST /api/admin/thanks`（同源 + 管理员）

## 6. 人设站 `apps/oc/server.py`（8090）

`GET /api/sso-user`

## 7. 统一入口共用接口（每个已登记主机同源可达，`services/platform/portal_server.py`）

身份都来自共享 `hx_sso` Cookie；POST 要求 JSON 与同根域来源。

账户积分：`/api/progress/*`（`services/platform/account_progress.py`）。

会馆托付（`services/platform/hall_errands.py`，供 Godot 会馆客户端 `labs/fengling-godot` 使用；界面上“托付”即 errand、“到场”即 presence）：

| 方法与路径 | 请求 | 返回 |
| --- | --- | --- |
| `GET /api/errands` | — | `{logged_in, terms, errands: [{errand_id, name, desc, place, stay_seconds, reward, is_held, is_mine}], active}` |
| `POST /api/errands/accept` | `{errand_id}` | 进行中的记录 `{run_id, errand_id, status, present_seconds, stay_seconds, can_report, accepted_at, finished_at}`；已持有一项或已被他人接走 → 409 |
| `POST /api/errands/presence` | `{place, is_present}` | 同上，另有 `is_present`、`credited_seconds`；只在 `is_present` 且 `place` 等于托付地点时计时，两次之间最多计 90 秒；不在场即断开计时链 |
| `POST /api/errands/report` | `{}` | 同上，另有 `awarded`；到场时间不足 → 400；按 `account_progress` 的 `errand` 规则记积分（每天 3 次，受每日上限约束） |
| `POST /api/errands/abandon` | `{}` | `{ok}` |

一个账户同时只持有一项；一项托付同时只归一人；24 小时无到场记录的持有会自动释放。是否到场目前由客户端上报，服务端无法核实。托付内容（`ERRANDS`）是占位文案，待文案组提供。

## 8. 契约

跨模块 JSON 契约见 `packages/shared-types`（`npm run verify`）。生态 → 主入口的收获包 `kind: eco-harvest`，详见 `packages/shared-types/README.md`。

## 示例

```bash
# 统一入口（本地主域）
curl -H 'Host: iridescently.xyz' http://127.0.0.1:8080/app/modules/cards/api/user
curl -H 'Host: iridescently.xyz' http://127.0.0.1:8080/app/modules/juling/api/state
# 会馆（直连）
curl 'http://127.0.0.1:8089/api/official/img?cid=1&n=0&t=1'
```
