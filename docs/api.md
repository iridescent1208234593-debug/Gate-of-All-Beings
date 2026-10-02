# API 参考

统一入口把各游戏 API 代理到其上游：`/app/modules/<名>/api/*` → 上游 `/api/*`
（cards→`5174`、softie→`4173`、juling→`5177`）。会馆/主站/人设站按 Host 直达各自 Handler。

## 1. 会馆 `portal/huiguan/server_huiguan.py`（8089）

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

也接受前缀 `/api/huiguan/<同上>` 与 `/api/security/*`。

## 2. 卡牌 OAuth `server/app/src/cards/server.py`（5174）

`GET /api/login`、`GET /api/callback`、`GET /api/user`、`GET /api/sso-user`、`GET /api/logout`

## 3. 聚灵 `server/app/src/juling/server.js`（5177）

`GET /api/state`、`POST /api/start`、`POST /api/action`

## 4. 软乎乎 `server/app/src/softie-webgpu/server/spirit-settings.js`（Vite dev/preview，4173）

`GET /api/spirit-settings`、`PUT /api/spirit-settings`（JSON，服务端校验）

## 5. 主站 `portal/www/server.py`（8088 → 统一入口主域）

`GET /api/sso-user`、`POST /api/admin/links`、`POST /api/admin/thanks`（同源 + 管理员）

## 6. 人设站 `portal/oc/server.py`（8090）

`GET /api/sso-user`

## 7. 契约

跨模块 JSON 契约见 `shared/shared-types`（`npm run verify`）。生态 → 主入口的收获包 `kind: eco-harvest`，详见 `shared/shared-types/README.md`。

## 示例

```bash
# 统一入口（本地主域）
curl -H 'Host: iridescently.xyz' http://127.0.0.1:8080/app/modules/cards/api/user
curl -H 'Host: iridescently.xyz' http://127.0.0.1:8080/app/modules/juling/api/state
# 会馆（直连）
curl 'http://127.0.0.1:8089/api/official/img?cid=1&n=0&t=1'
```
