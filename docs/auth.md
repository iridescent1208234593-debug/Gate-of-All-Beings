# 用户系统与鉴权

## 1. 跨站 SSO（hx_sso）

- 实现：`services/platform/hx_sso.py`（跨站共用）。
- Cookie：`hx_sso`，域 `.iridescently.xyz`，`HttpOnly; SameSite=Lax`；token 由 `make_token(uid,kind,name,color)` 签发、`verify_token` 校验、`read_cookie(headers)` 读取。
- 会馆是签发方（登录后写 cookie）；主站 / 人设站 / 各游戏读 cookie 获取登录态。
- 读取端点：各站 `/api/sso-user` 返回 `{logged_in,name,uid,kind,admin}`。
- 管理白名单：`apps/www/server.py` 的 `ADMIN_USSO_IDS`（与会馆 `ADMIN_USSO_IDS` 一致）。

## 2. 会馆账号（站内）

`apps/huiguan/server_huiguan.py`：

| 端点 | 作用 |
| --- | --- |
| `POST /api/register` | 站内注册（写入 `local_users`，密码哈希）；必须带当前 `legal_version`，同意记录写入 `legal_consents` |
| `GET /api/legal` · `POST /api/legal/accept` | 《用户须知》《隐私政策》当前版本与本账号的同意记录（`services/platform/legal_consent.py`） |
| `POST /api/login` | 站内登录 / 或跳转 USSO |
| `GET /api/user` | 当前登录用户（USSO 或站内） |
| `GET /api/sso-user` | 跨站 SSO 登录态 |
| `GET /api/logout` | 退出并清 cookie |
| `POST /api/auth` | 供 management 的注册/登录复用 |
| `POST /api/game/save` · `GET /api/game/load` | 账号云存档 |

灵体使用 `scope=softie` 将参数保存在账号记录的独立命名空间中，不会覆盖灵境会馆的默认存档。主站游戏壳允许对会馆 API 携带账号 Cookie。
| `GET/POST /api/security/<action>` | 账号找回（见下） |

- 账号来源两种：**USSO**（外部 OAuth 2.1/OIDC，`sso.umrc.cn`）与**站内**账号；`users` 存 USSO，`local_users` 存站内。
- 角色：`user` / `executor`（执行者）/ `elder`（长老）/ `admin`；`user_flags` 存封禁与管理标记。
- 会话持久化：`sessions_db(sid,kind,uid,created_at,expires_at)`，重启不掉登录态。

### 账号找回 / 安全（services/platform/account_security.py）

动作（`/api/security/<action>`）：`setup`（设置提示问题）、`question`（取问题）、`change`（改密）、`reset`（凭答案重置）、`settings`。
- 哈希答案 + 按账号与 IP 双维度限流（`security_attempts`），原子更新密码。
- 仅限站内账号；USSO 账号需到 USSO 改密。
- 同源校验：Origin 必须为会馆域或 `localhost:8089`。

## 3. 卡牌 OAuth（USSO 客户端）

`apps/cards/server.py`，端口 `5174`：

- `GET /api/login` → 跳 `https://sso.umrc.cn/authorize.php`（`client_id` + `redirect_uri`）。
- `GET /api/callback` → 换 token、取 userinfo。
- `GET /api/user` / `/api/sso-user` / `/api/logout`。
- 用户落 `apps/cards/users.db` 的 `users`。
- 生产回调固定 `https://zszm.iridescently.xyz/api/callback`。
- 前端 API 走 base 感知：`/app/modules/cards/api/*`，由统一入口代理到 `5174`。

## 4. 各站读取与跨域

| 站 | 读取登录态 |
| --- | --- |
| 主站 `apps/www` | `/api/sso-user`（读 hx_sso） |
| 人设站 `apps/oc` | `/api/sso-user` |
| 经营 `management` | `ACCOUNT_API = https://huiguan.iridescently.xyz`（dev 为 `localhost:8089`） |
| 卡牌 | 自有 OAuth（`5174`） |

> 本地跨子域（8080 ↔ 8089）会被 ORB/CORS 拦，属预期；生产走子域正常。

## 5. 安全要点

- Cookie 仅 `HttpOnly`，前端拿不到 token，只能读 `/api/sso-user`。
- 静态白名单：`base_static.static_allowed` 屏蔽 `.py/.db/.log/.bak` 及点文件；`BaseStaticHandler.list_directory` 返回 404。
- 写接口（www 的 `/api/admin/*`）校验同源 + 管理员。

## 6. 角色与权限规则

身份决定御灵系可选数量与年龄上限，规则同时写在前端表单提示里（`apps/huiguan/index.html` 的基础与身份段），改动时两处要同步。

| 身份 | 御灵系可选 | 年龄上限 | 获得方式 |
| --- | --- | --- | --- |
| 未登录访客 | 1 系 | 450 岁 | — |
| 执行者 | 2 系 | 450 岁 | 注册即默认 |
| 长老 | 2 系 | 1500 岁 | 提交申请并经馆长批准，或管理员在后台直接设置 |
| 荣誉长老 / 妖王 | 2 系 | 1500 岁 | 表单页内直接选择，妖王需写明理由 |
| 管理员 | — | — | `ADMIN_USSO_IDS` 中的 USSO 账号，或 `local_users.role='admin'` |

- 兜底：若全站没有任何管理员，第一个注册者自动成为管理员（`server_huiguan.py` 的注册逻辑）。
- 管理员身份与会话标记分离：`ADMIN_USSO_IDS` 是永久白名单，`user_flags.role` 是站内授予。

## 7. 管理后台

页面 `/admin.html`，仅管理员可见入口；接口集中在 `server_huiguan.py` 的 `/api/admin/*`。

| 分组 | 端点 |
| --- | --- |
| 查看 | `/api/admin/users`、`/characters`、`/elder-requests`、`/honor-requests`、`/supplements`、`/scribe-requests`、`/exempt-requests`、`/posters` |
| 用户 | `/api/admin/user/update`（封禁 / 角色）、`/api/admin/user/delete`、`/api/admin/reset-password` |
| 审核 | `/api/admin/elder/decide`、`/honor/decide`、`/supplement/decide`、`/scribe/decide`、`/exempt/decide` |
| 内容 | `/api/admin/delete-character`、`/api/admin/poster/delete` |

封禁后该用户的既有会话立即失效；删除用户会连同其角色卡一并删除，不可恢复。

- 长老后台（`/member.html`，`/api/member/*`）：可查看执行者/编辑、授予或取消文书等级、把执行者设为 executor；不能管理长老或管理员，不能修改账号的封禁状态（`status` 仅 `scope == "all"` 的管理员可改，后端返回 403，不依赖前端隐藏按钮）。
- 管理员专属：封禁 / 解封、设置 elder / admin 角色、重置站内账号密码、删除用户。

## 8. 限流

| 场景 | 计数键 | 阈值 |
| --- | --- | --- |
| 注册 | `reg:{ip}` | 5 次 / 1 小时 |
| 登录失败 | 用户名 + IP 组合 | 8 次 / 10 分钟 |
| 登录失败 | `login-ip:{ip}` | 30 次 / 10 分钟 |
| 登录失败 | `login-user:{user}` | 20 次 / 1 小时 |

计数键形如 `login:{user}`+`{ip}`，实现为 `rate_blocked(key, max_n, window)`，阈值集中在 `LOGIN_FAILURE_LIMITS`；计数每 5 分钟清理一次过期条目（`_RATE_CLEANUP_INTERVAL`）。触发时返回 429 与中文提示。

## 9. 常见问题

- **登录时打错用户名会怎样？** 统一入口 `/api/auth` 是"用户名存在就登录、不存在就注册"，所以拼错的名字会被当成新账号**自动注册并登录**。识别方法：登录后昵称不对、角色卡为空。表单弹窗已提示"用户名不存在时将自动注册并登录"；误建的空账号可由管理员在后台删除。
- **脚本访问接口返回 403 `error code: 1010`？** 这是 Cloudflare 的浏览器完整性检查拦了非浏览器 UA，换成浏览器 UA 即可；真实用户在浏览器里不受影响。