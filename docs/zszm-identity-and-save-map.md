# 众生之门身份与存档边界（源码核对，2026-10-17）

本文件记录本轮工作源码的真实行为，供后续账户整合使用。没有迁移数据库、读取真实账户记录、提交、发布或调整认证协议；线上快照尚未包含本轮合并，不能将本文件视作线上行为已经通过验收。

## 1. 三种资料必须继续分开

| 对象 | Owner / 真值 | 字段与读写入口 | 当前用途 |
| --- | --- | --- | --- |
| Account：登录账户 | 会馆 `users.db` 中的本地账户、既有 USSO 用户及会话；标识为 `(kind, uid)` | `local_users` / `users` / `sessions_db` / `user_flags`；会馆 `/api/user`；共享站点 `/api/sso-user` | 登录、权限、账户昵称；账户不是一个有种族的游戏角色 |
| Account Avatar：账户头像 | 同一数据库 `account_profiles`，主键 `(kind, uid)` | `account_avatar_url`；会馆 `/api/account/avatar` | 账户本人通用头像；空值时界面可能展示原有 `picture` |
| OC：作者登记的角色 | 会馆 `characters.json`；拥有者通过会馆登录会话确定 | 记录 `data.name`、`species_type`、`species_detail`、`avatar_asset_id`、`image/images` 等；`/api/get-characters`、`/api/user/ocs`；Gate `/api/gate/ocs` 为导入适配 | 可有多个角色；人类 / 妖精和具体妖精种族属于该 OC；不会自动成为 Account 字段 |
| Gate Identity：众生之门玩家形象 | 登录时 `account_profiles.gate_identity_json`；访客时当前源的会话存储 | `/api/gate/identity`；React `PlayerProfileProvider` | 众生之门玩家名称、种族、头像图片、头像框；入口、HUD、形象编辑器、浅滩共用 |
| Game Save：玩法进度 | 各玩法已有存档 owner；见下表 | 卡牌、经营、生态、浅滩、聚灵各有现存存储 | 不等同于 Gate Identity；本轮整合入口没有将它们变成一套云存档 |

`portal/oc` 本身是现有静态角色设定站；它的共享登录展示不意味着所有用户 OC 数据存放在该站。用户填写的设表和归属数据仍由会馆拥有。

头像应以 `avatarImage + avatarFrame overlay` 呈现。Account Avatar、OC Avatar、Gate Avatar 可以由用户明确复制或选择同一个资源，但不是同一可变字段，也不会自动双向同步。

## 2. 登录与跨站数据链路

```text
会馆登录 / 注册
  ├─ session cookie → sessions_db → 会馆 resolve_identity(kind, uid)
  └─ hx_sso cookie → 各子站验证签名和有效期
       ├─ 主站 / OC / 正式 zszm 的 /api/sso-user
       └─ Cards /api/gate/identity → resolve_sso_identity → account_profiles

PlayerProfileProvider
  ├─ 并行读取 /api/sso-user 与 /api/gate/identity，并校验 owner 一致
  ├─ 未完成资料 → PlayerOnboarding → saveIdentity
  └─ 已完成资料 → GameApp / PlayerIdentity / PlayerAvatar / ShoreMode
```

- 会馆发出的 `session` 与 `hx_sso` 均为 `.iridescently.xyz` 域 Cookie，`HttpOnly`、`SameSite=Lax`，生产配置使用 `Secure`。共享 SSO 期限为 7 天；会馆真实会话另由 `sessions_db` 校验。
- 主站、OC 的 `/api/sso-user` 使用 `hx_sso.read_cookie`；返回 `uid`。会馆和 Cards 自己的接口通常返回 `user_id`。正式 portal 路由把 `zszm` 根路径的 `/api/sso-user` 交给主站 Handler，其余 `/api/*` 代理到 Cards，因此同一页面可能同时遇到两种字段名。
- 本轮 `PlayerProfile.tsx` 将 `user.user_id ?? user.uid` 转为字符串后统一放入 `account.user_id`。前端 scope 使用 `kind:user_id`，后端 owner 使用 `{kind, user_id}`；不能只比较裸 uid。
- `shared/shared-session/session.js` 只是同源 `/api/sso-user` 的 fetch / 内存缓存；没有单独登录服务，也不会自动将 localStorage 同步到其他子域。
- `localhost` / `127.0.0.1` 不会获得 `.iridescently.xyz` Cookie。本地匿名 smoke 不能证明真实跨子域登录成功；代理或本地测试账号须单独配置，不能把“本地有存档”当作已登录。

主要源码：`server/hx_sso.py`、`portal/huiguan/server_huiguan.py`、`portal/www/server.py`、`portal/oc/server.py`、`server/portal_server.py`、`server/account_profile.py`。

## 3. Gate Identity 的统一状态、字段与保存保护

`server/app/src/cards/src/game/PlayerProfile.tsx` 是 React 流程中唯一的玩家资料 owner。入口和玩法读它的 Context；`onboarding/player-profile.js` 仅维护一次挂载的编辑草稿，不直接创建另一份持久化身份。

| 字段 | 约束 / 含义 |
| --- | --- |
| `schema_version` | 当前为 `1` |
| `display_name` | trim，最多 60 字符；玩家名称，不覆盖账户昵称 |
| `species_name` | trim，最多 100 字符；人类可快捷确认，其他种族自由填写，不覆盖 OC 的二级分类 |
| `avatar_asset_id` | 上传后为 `/assets/uploads/<hash>.<ext>`；访客可保存裁切后的 data URL；默认方案可留空，由框编号对应默认头像 |
| `avatar_frame_id` | 已选择的默认头像 / 框资源编号，最多 80 字符；不是玩家种族名称 |
| `avatar_mode` | `default` / `upload` / `account` / `oc`；用于表达头像来源 |
| `source_oc_id` | 明确从哪个自有 OC 导入；后端核验归属；导入是复制，不回写 OC |

持久化：

- 登录：`GET/POST /api/gate/identity`，写入实际项目根目录 `portal/huiguan/users.db` 的 `account_profiles.gate_identity_json`；`(kind, uid)` 是组合主键。头像文件在会馆 `assets/uploads`，页面通过会馆域名读取资源。
- 访客：`sessionStorage['zszm.gateIdentity.v1']`；只在当前 origin、浏览器会话内恢复，不跨设备、不作为认证。访客上传使用裁切结果的 data URL，不能持久化临时 blob URL。
- 登录后**不会自动把访客资料迁移到账户**；退出后也不会把刚才账户资料写成访客资料。原有访客会话可重新读回。已有账户资料优先，空账户会进入自己的初始化流程。
- 读取账户变化时，前端清空前一 scope 的 identity 并增加 generation；`pageshow` / `focus` 重新读取。两条响应的登录状态或 owner 不一致时提示重试，不静默用别人的资料继续初始化。
- 保存期间阻止并发保存；图片使用 multipart，元数据使用 JSON；未上传图片时拒绝持久化 `data:` / `blob:` 到账户。
- 新客户端发送 `expected_owner: {kind, user_id}`。`server.py` 在落盘和图片处理前与当前认证 owner 严格比较，不一致返回 **409**；成功响应再次带 owner，前端校验后才更新 Context。generation / scope 校验再挡住过期响应更新界面。
- 为兼容已有调用，后端目前允许不带 `expected_owner` 的旧客户端；因此该 guard 是新流程的草稿绑定保护，尚不是所有历史调用都必须满足的统一 API 合约。
- `uid/user_id` 字段归一、`expected_owner`、访客不迁移分别解决响应形状、保存竞争、资料边界问题；不能以其中一项替代另外两项。

`PlayerIdentity.tsx` 的 OC 导入通过 `/api/gate/ocs` 获取本人 OC，然后显式复制名称、物种和选定图片。服务器对 `source_oc_id` 校验 owner。导入后编辑 Gate 身份不会更新原 OC；以后替换 Gate 图片也不会自动改 Account Avatar。

## 4. 游戏存档实际分布

| 内容 | 当前 key / 文件 / owner | 跨设备与换号边界 |
| --- | --- | --- |
| 众生之门卡牌历练、会馆日常、旅途手札等 | IndexedDB `zszm-adventure-v1` / store `saves` / key `current`；`game/storage.ts` | 同源浏览器本地；目前 key **未按账户 scope 隔离**，换号仍可能看到该浏览器原有进度；不是 Gate Identity 云存档 |
| 卡牌摘要 | `localStorage['iridescently.save.v1']` 内 `m:cards:summary` | 用于模块/壳读取摘要，不是完整卡牌存档；无账户和跨设备保证 |
| 雾隐浅滩（本轮由原型场景接入） | `sessionStorage['zszm.shore.v1:<kind>:<user_id>']`；匿名为 `zszm.shore.v1:anonymous`；`ShoreMode.tsx` | 按 scope 创建/销毁模式实例，玩家显示实时读取 Context；探索节点、灵息、日志仍仅会话本地，不云同步 |
| 灵境会馆经营本地 | 统一 namespace 内 `m:management:lingjing-huiguan-save-<uid>` / `...-guest`；本地账户缓存 `m:management:lingjing-huiguan-account` | `saveGame.js` / `account.js` 仍只用裸 uid 选择本地档；缓存恢复失败会保留旧值；非本轮 scope 保护覆盖范围 |
| 灵境会馆经营云端 | 会馆 `/api/game/save`、`/api/game/load` → `users.db.game_saves`，主键 `(kind, uid, 'management')` | 2026-10-17 源码已迁移（未发布）；旧 `game_saves.json` 只读导入，见 [game-save-ownership.md](game-save-ownership.md) |
| Softie 云存档（客户端未改） | `users.db.game_saves` 的 `(kind, uid, 'softie')`；API `?scope=softie` | 与经营槽独立，不再回退读取经营存档；源码已迁移，未发布 |
| 灵境生态 | namespace 内 `m:ecology:zszm-ecology-v2`；`ecology/src/core/persistence.js` | 同源 localStorage；无账户 scope、无云同步；生态交换包和卡牌收获队列有自己的校验，不等于账户存档 |
| 聚灵 | `juling/server.js` 的 `globalSoul` / `currentRun`；`data/save.db` 的 `save_state` 或 JSON fallback 的 `soul` | 当前是服务进程的全局玩法状态，不是每个账户的私人存档；统一入口未改变这一点 |
| 统一壳 / 其他 localStorage 模块 | `shared/shared-session/save.js` / `kv.js` → `iridescently.save.v1`，模块前缀 `m:<module>:` | 标准化本地命名空间和旧 key 迁移；不自动带 owner，不自动云同步 |
| 主站 Gallery Appearance | 同一 namespace 内 `homepage.appearance.v1:account:<kind>:<uid>` 或匿名 key | 当前 `appearance-controls.js` 依赖的是本地 `get/set`；按账户键隔离当前 origin 的偏好，**尚无服务器云 preference 接口**；不能宣称跨设备同步 |

`BroadcastChannel('iridescently')` / fallback event bus 只覆盖同源页面/iframe。主站、会馆、zszm 是不同 origin，即使它们共享 Cookie，也不会共享 localStorage、sessionStorage、IndexedDB 或 BroadcastChannel。跨端资料恢复必须依赖服务端接口，不可只改键名。

## 5. 已确认的账户风险与下一轮边界

以下是源码审查发现，未读取真实账户数据，也未在本轮修改账户实现。

1. **主站管理员判定混用身份种类与权限。** `portal/www/server.py::_is_admin` 当前将裸 uid 与 USSO 白名单比较，未先要求 `kind == 'usso'`，并接受 `kind == 'admin'`。而真实身份种类为 local / usso，管理员是 role。若本地 uid 与白名单文本碰撞，可能发生错误授权；没有证据表明真实账户已经发生碰撞。下一轮应由统一、经数据库复核的 `(kind, uid)` 身份解析获取角色，至少先补齐种类约束并加本地/USSO 同号回归；不要直接凭同一数字或前端 `admin` 字段授权。

2. **（2026-10-17 源码已处理，未发布）历史经营 / Softie 云存档 owner 是 raw uid。** 已改为 `(kind, uid, scope)`，旧档按正面证据归属、不确定者隔离、可导出回滚，见 [game-save-ownership.md](game-save-ownership.md)。以下为原始记录：
   `_api_game_save/_load` 在通过会馆会话验证后使用 `str(ident['uid'])` 访问 `game_saves.json`，缺少 kind。不同身份源的同号用户可能读写同一档；客户端经营本地档也有同类键名问题。下一轮应先做只读 owner 冲突清点、制定可回滚迁移表，再改为复合 owner；不能直接把所有旧档重新归给当前登录者，也不能靠清空旧档解决。本轮只记录，未迁移或删除任何存档。

3. **玩法进度还没有统一账户归属。** 卡牌 IndexedDB `current`、生态 localStorage 为浏览器级，聚灵为服务级全局状态；Gate Identity 已按账户保存不代表这些玩法自动随账户同步。后续先为每一种档明确“私人 / 访客 / 共享世界”产品语义，再设计存档 owner、迁移、冲突和导出流程。

4. **跨站登录展示与失效检查力度不同。** 主站/OC 仅验证 SSO 签名、有效期，不像会馆 session 每次解析数据库角色和封禁状态；主站响应的名字也来自签发时快照。Gate 则通过 `resolve_sso_identity` 检查账户资料（本地账户须 active，USSO 有封禁检查，但仍保留缺失记录时的旧 token 回退）。因此跨站 UI 可能短期保留旧昵称/状态；共享 cookie 不等同于全站即时撤销。下一轮应统一 session introspection 的最小返回合同与失效规则，保留身份用途分离。

5. **新 Gate guard 是必要保护，但历史接口仍需后续梳理。** 新流程已按 owner 检查并拒绝换号草稿，且不会自动迁移 guest；旧客户端不带 `expected_owner` 仍能按当前已认证账户保存。后续如要强制 guard，须先确认所有调用者、升级客户端并安排兼容收尾；本轮不顺手改变认证协议。

6. **资源可达性与资料私有性是不同层。** Gate 上传只接受项目认可的 `/assets/uploads` URL，服务器解码、裁切并限制图片大小；但这些哈希资源是公开静态 URL，不是鉴权私有相册。不要把“私有账户资料行”误读为“图片不可被持有链接的人访问”。后续如需私有素材，应单独定义授权下载，不应混进此次入口合并。

## 6. 后续整合建议（未执行）

1. 统一只读身份响应为规范的 `(kind, uid)`、角色、账户头像，给 legacy `user_id` 提供明确过渡；先修主站管理员 kind 检查和旧云档 owner 冲突。
2. 保持 Account / OC / Gate 三个资料 owner；提供显式的“使用账户头像 / 从 OC 导入”，记录来源，避免双向隐式覆盖。Gate 玩家资料可以先用现有 `account_profiles`，不需要为入口整合重建账户数据库。
3. 逐玩法定义存档归属和云同步；guest → account 只能是有提示的显式导入，已有账户档优先，并具备冲突预览/导出。先处理卡牌与经营，再考虑生态、浅滩和聚灵各自的共享语义。

## 核对文件

- `server/hx_sso.py`、`server/account_profile.py`、`server/portal_server.py`
- `portal/www/server.py`、`portal/www/scripts/appearance-controls.js`
- `portal/huiguan/server_huiguan.py`、`portal/huiguan/account.html`、`portal/oc/server.py`
- `shared/shared-session/session.js`、`save.js`、`kv.js`、`bus.js`
- `server/app/src/cards/server.py`
- `server/app/src/cards/src/game/PlayerProfile.tsx`、`PlayerIdentity.tsx`、`PlayerAvatar.tsx`、`GameApp.tsx`、`storage.ts`、`ShoreMode.tsx`
- `server/app/src/cards/src/onboarding/PlayerOnboarding.tsx`、`player-profile.js`
- `server/app/src/management/src/systems/account.js`、`saveGame.js`
- `server/app/src/ecology/src/core/persistence.js`、`server/app/src/juling/server.js`

核对方式为源码与路由阅读；这是数据边界审查记录，不是账户渗透测试或跨设备云同步验收报告。
