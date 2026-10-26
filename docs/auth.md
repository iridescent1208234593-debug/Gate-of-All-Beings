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
| `POST /api/register` | 站内注册（写入 `local_users`，密码哈希） |
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
