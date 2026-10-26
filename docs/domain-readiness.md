# 多根域 Readiness：iridescently.xyz / .cn / .dpdns.org

本文件描述代码与部署工具的多根域准备状态。它**不**表示任何新域名已经上线：DNS、Cloudflare、Tunnel、香港 Nginx/服务、证书和外部 OAuth 登记都不在本批次修改范围内。`iridescently.xyz` 继续作为当前正式入口，不做强制跳转或全站 301。

## 集中配置

唯一真值是 `packages/site-domains/domains.json`：

| 字段 | 含义 |
| --- | --- |
| `roots` | 批准根域，精确列出；不存在通配根域或 `*.iridescently.*` 规则 |
| `defaultRoot` | 未从请求得出根域时使用（默认 `iridescently.xyz`） |
| `services` | 服务 → 子域前缀（`main` 为根域本身） |
| `legacy` | 旧子域在**同一根域**内的跳转目标路径 |
| `oauth` | 每个 OAuth 服务的回调路径与已在外部提供方登记的根域 |
| `previewHosts` | PC 预览主机，只用于浏览器返回地址校验和本地 Vite；生产入口不接受 |
| `assetHost` | R2 自定义域名（当前仅 `assets.iridescently.xyz`），不是应用入口主机 |
| `localPorts` | development / test 下允许的本机 Origin 端口 |

消费方：`services/platform/site_domains.py`（Python 入口、Cookie、SSO、OAuth、CSP、CORS）、`packages/site-domains/index.js`（由 `scripts/generate-domain-config.py` 生成，浏览器与 Node 共用；`--check` 检查是否过期）和 `packages/site-domains/index.mjs`。部署时可用以下环境变量收窄或选择，但不能引入未批准的根域：

- `SITE_DOMAIN`：该部署的首选根域，必须在批准列表内。
- `IRIDESCENTLY_ALLOWED_DOMAINS`：逗号分隔，限定本部署接受的根域子集（须唯一并包含 `SITE_DOMAIN`）。
- `IRIDESCENTLY_OAUTH_CALLBACK_ROOTS`：JSON，例如 `{"huiguan": ["iridescently.xyz", "iridescently.cn"]}`；只能列出已在提供方登记的批准根域。

## 主机名清单

每个批准根域 `R` 下的同一组主机：

| 类别 | 主机 | 行为 |
| --- | --- | --- |
| 应用入口 | `R`、`www.R`、`huiguan.R`、`oc.R`、`zszm.R`、`spirit.R` | 精确匹配后路由；`R/` 与 `www.R/` 302 到 `huiguan.R/` |
| 仅跳转 | `game.R` → `zszm.R/#home`；`lingjing.R` → `zszm.R/#management`；`juling.R` → `zszm.R/app/shell/m/juling`（其 `/api/` 仍代理聚灵） | 始终留在同一根域，不跳往 `.xyz` |
| 预览 | `pc.iridescently.xyz`、`pc-*.iridescently.xyz` | 只在返回地址白名单与本地 Vite；生产入口 421；新根域没有预览映射 |
| 内部 | `127.0.0.1`：8080 门户、5174 Cards、5178 数值、5177 聚灵、4173 灵体 | 仅回环；只信任来自回环的单个 `X-Forwarded-Proto: https` 与 `X-Forwarded-Host` |
| 本地 / 测试 | `localhost`、`127.0.0.1`、`::1` | 仅 development / test 环境的回环请求 |
| 资产 CDN | `assets.iridescently.xyz` | R2 绑定，不复制到新根域，公开对象分类待单独完成 |
| 不接受 | `psy`、`psyche`、`account`、`feather`、`backup`、`origin-zszm`、`hk-zszm-check` 及任何未列出的主机、IP、带端口/用户信息/尾点/重复 Host | 入口 421 |

2026-10-25 的只读盘点（主工作区 `docs/domain-migration/2026-10-25/`）显示：`.xyz` 仅有 apex、huiguan、oc、zszm 与 assets 的 DNS；`.cn` 与 `.dpdns.org` 尚无业务 DNS。代码接受某主机不代表该主机已在线。

## 会话、Cookie 与 SSO

三个根域是不同的可注册域，浏览器不会共享 Cookie。设计为**每个根域独立登录**，共用同一账户与存档数据库：

- 会馆 `session`、`hx_sso` 以及主题、语言偏好 Cookie 的 `Domain` 取自已验证请求的根域（本地主机不设 Domain）；`Secure`、`HttpOnly`、`SameSite=Lax` 不变。
- `sessions_db.audience` 记录签发根域，`read_session` 在其他根域拒绝；迁移前已有的会话视为 `.xyz`。
- `hx_sso` 令牌带 `aud`，只在签发根域验证；无 `aud` 的旧令牌只在 `.xyz` 有效。
- 不实现跨根域无感 SSO。若以后需要，只能用一次性、短效、绑定目标根域的兑换码，不能把长效会话或令牌放进跨站 URL。
- localStorage、IndexedDB 与离线草稿按 Origin 隔离，不会因共用服务器而自动迁移。

## OAuth

- 会馆 USSO 回调由请求根域推导：`https://huiguan.<R>/cb`，且 `R` 必须在 `oauth.huiguan.callbackRoots` 中。默认只有 `.xyz` 已登记。
- 在未登记的根域发起 USSO 登录时返回 503 提示改用站内账号，不会把用户带到另一个根域登录。站内账号登录在三个根域均可用。
- `state` 一次性、10 分钟有效，并绑定发起时的回调地址；在其他根域重放会被拒绝。
- 众生之门旧 OAuth 入口（`/api/login`）已停用（410），其回调不会建立会话。
- 启用新根域：先在 USSO 管理端为该应用新增精确回调（保留旧回调），再部署 `IRIDESCENTLY_OAUTH_CALLBACK_ROOTS`。本批次未修改任何提供方配置或凭据。

## Origin、CORS、CSP、WebSocket

- 入口对 GET/HEAD/OPTIONS 导航不做 Origin 拦截（搜索引擎、分享链接和 OAuth 提供方返回都会带外站 Referer）；POST/PUT/PATCH/DELETE 若带 Origin（缺失时看 Referer）必须是同一根域的批准 HTTPS 主机，多个 Origin 一律拒绝。WebSocket 升级必须带同根域 Origin，灵体服务端再按 `X-Forwarded-Host` 精确比对一次。
- 带凭据的 CORS 只回显同一根域的批准 Origin，不使用 `*`。公开图片/字体保留原有的无凭据 `Access-Control-Allow-Origin: *`（展示页 opaque sandbox 导出需要），私有原图因 `Cache-Control: private` 不在此列。
- Report-Only CSP 按请求根域生成，只列出该根域的精确主机，不再使用 `https://*.iridescently.xyz`。
- 原图接口继续拒绝 `Sec-Fetch-Site: cross-site` 与非同根域来源，并要求站长会话。

## 跳转、canonical 与 SEO

不存在跨根域跳转。`connections.html`、`homepage.html` 的 canonical 与会馆/OC 的 `og:image` 仍指向 `.xyz`：并行运行期间 `.xyz` 是唯一 canonical，切换 canonical 与永久跳转属于以后单独批准的阶段。

## 有意保留的硬编码

`scripts/check-domain-hardcodes.py` 扫描源码与构建产物中的自有域名绝对 URL，以下例外经过审查：

- canonical 与 `og:image` 元数据（见上）；
- 世界观数据的角色来源字段 `sourceUrl`、历史导出 `packages/shared-data/worldview.json`；
- 首页内容种子 `portal/www/links.json`（运行期副本是持久数据）与 `services/platform/.env.example`；
- 针对线上正式站的运维检查脚本 `cards/scripts/inspect-sites.mjs`、`verify-game.mjs`；
- 文档、测试夹具与 `services/platform/tests/verify_portal.py` 的路由模板（运行时展开到每个批准根域）。

## 验证

```powershell
python scripts/check-batch6.py --full --modules <releases>\candidate\modules
```

覆盖：`services/platform/tests/test_site_domains.py`（入口主机、Origin、WebSocket、Cookie、SSO 令牌、OAuth 回调、CSP、Node/浏览器一致性、源码扫描）、`services/platform/tests/test_host_policy.py`、`services/platform/tests/test_huiguan_oauth_session.py`（会话按根域、未登记根域拒绝 OAuth、state 不可跨根域重放）、`services/platform/tests/test_runtime_services.py`（三个根域的 WebSocket Origin）、`services/platform/tests/verify_portal.py`（每个根域的路由、未知 Host 421、同根域跳转、CSP）、构建产物扫描、`portal/huiguan/tests/oauth-e2e.cjs`（本地模拟提供方的浏览器全流程）。

## 上线前置条件（未执行）

1. 香港 Nginx `server_name`/Host map 与本地 Tunnel ingress 增加新主机，保留精确 Host 头，不改写为旧域名。
2. 新 Zone 建立与旧域等效的边缘规则：`huiguan.<R>/assets/uploads/*` 阻断、HTTP→同主机 HTTPS 308、HSTS/CSP 头；SSL strict。
3. 仅新增已核实的业务 DNS（apex、huiguan、oc、zszm）。
4. USSO 新增精确回调后部署 `IRIDESCENTLY_OAUTH_CALLBACK_ROOTS`。
5. R2 公开对象分类完成前，不为新根域绑定资产域名。
