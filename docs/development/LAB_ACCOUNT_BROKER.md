# LAB 会馆账户授权测试契约（v1）

目前仅在隔离测试运行；上线、更改香港账户系统、配置域名/正式 OAuth 和启用正式迁移均不是本次变更的授权。不是一套通用 OAuth Provider，不使用生产数据验证。

## 身份与访问
- 账户服务继续用 `(kind, uid)`；LAB 仅接收随机且持久的服务专用 subject `sub`。不是全局 Account ID、昵称、OC ID 或既有 LAB 玩家 ID，也不能从它推回会馆账户标识。
- `lab_auth_access` 是独立准入开关，默认关闭；现有站务角色、共创身份、测试码都不自动获得准入。
- `grant` 是针对 LAB 的短时不透明凭证，只交 LAB 后端。LAB 的浏览器会话和原生会话由 LAB 自己签发；浏览器会馆 cookie、账户密码、邮箱、昵称、OC、真实 Account ID 不进入 LAB。
- 到期上限是签发后 1 小时或者原始会馆会话到期（二者取早）；不自动续期。会馆端核对会话存活、账户可用、当前条款版本和独立准入。原会话退出或撤销即失效，重新登录不恢复旧授权。禁用准入并撤销，之后打开也不会恢复旧授权。
- 授权记录只存会话行定位和指纹，不再存一份会馆 cookie；如回收/重建数据库行可能使旧 LAB 授权保守失效。授权码是一次性（核对后原子消费），不落盘；凭证只存摘要。

## 端点
所有服务端请求 POST JSON，固定发行站 HTTPS（不自动跟随跳转）和 `Authorization: Bearer <服务专用凭证>`。服务专用凭证分环境注入，客户端构建和日志中禁止存放。查看/确认页面不使用服务凭证；只允许已登录的会馆用户在同一来源操作、会话绑定 CSRF、正确配对码和显式同意。六位数字显示在玩家发起登录的界面，**不要放 URL、日志或让客服转发**。

| 路径（`/api/lab-auth/` 下） | Fields | 成功响应 |
| --- | --- | --- |
| `start` | `challenge` (PKCE S256, base64url 不带填充) | `request_id,state,match_code,approval_path,expires_in` |
| `approve` GET / POST | GET `request_id`；POST 同源 form，包含 `request_id,csrf,match_code,decision` | HTML，允许或拒绝是明确按钮 |
| `poll` | `request_id,state` | `status=pending/denied` 或 `status=approved,code,expires_in` |
| `redeem` | `request_id,state,code,verifier` | `sub,grant,expires_in` |
| `introspect` | `sub,grant` | `active=true,expires_in` 或 `active=false` |
| `revoke` | `sub,grant` | `revoked=true`（幂等） |

请求 300 秒，授权码最长 45 秒；状态/校验器/授权码只经服务端传送，客户端只取得自己的单独 LAB 轮询会话和没有凭证的回审地址。轮询同一笔至少间隔 2 秒，太快返回 `429 slow_down`；请求启动全局 120/分 `429 start_limit`。错误 JSON `error` 标签：`400 invalid_request/invalid_grant`、`401 service_auth_required`、`404 not_found`、`410 expired`、`503 lab_account_disabled`。每笔回审最多五次错误配对。LAB 端仍独立限制创建频率并验证轮询发起者；同一 grant 的活跃 socket 复核应设置短周期、有明确中断上限。Broker 不改变现有 Host/Origin/CORS；接线必须保留已有 Host 验证，并配置精确 HTTPS Origin 和会馆会话 audience；不支持由请求指定 issuer、redirect URL 或服务 audience。
