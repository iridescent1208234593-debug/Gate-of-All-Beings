# 统一后端与门户

`portal_server.py` 按 Host/路径分发静态站点、壳、发布模块、共享资源、API/WebSocket。`base_static.py` 禁止解码后敏感路径、目录列表与数据下载；`hx_sso.py` 复用会馆 cookie；`account_security.py` 保留原账户安全逻辑。

生产 Portal 强制绑定 `127.0.0.1`；`host_policy.py` 按 `site_domains.py` 的显式主机表在路由前拒绝未登记或格式异常的 Host、重复 Host，对写请求与 WebSocket 升级要求同根域 Origin，并只接受来自 loopback 的单个 `X-Forwarded-Proto: https` 作为 TLS 终止证明。向上游转发时会删除客户端提供的转发身份头并按已验证请求重建。`python -m unittest discover -s server -p 'test_host_policy.py' -v` 覆盖 Host/HTTPS/转发头策略；它不验证运行中的 Cloudflare Tunnel 或 Nginx 是否正确覆盖入站 `X-Forwarded-Proto`，部署边界仍需单独只读核验。

生产8080，OAuth5174，数值配置5178，聚灵5177，Softie4173。旧 game/lingjing/juling 前端域名转入众生之门；API仍留必要上游。源码公开下载 `/app/src` 不允许。

`build:modules` / `build:site` / `build:homepage` 只生成外部 Release 根下的候选；`npm run release:seal` 封存不可变 Release，`python scripts/local-runtime.py start` 从 channel 启动本机回环服务。`IRIDESCENTLY_PROJECT_ROOT` 只选择代码；数据由 `storage_paths.py` / `runtime-paths.cjs` 从外部存储环境选择。无自动启动构建。详见 [发布流程](../docs/release-workflow.md)。

开发可 `python server/portal_server.py`，生产用网站管家；`python server/verify_portal.py` 在临时 test 存储上使用未占用端口，对每个批准根域检查路径/JSON/真实模块内容、未知 Host 拒绝、同根域跳转与 CSP，不接受误连已有服务器。`python server/test_static_security.py` 检查编码/大小写敏感文件拦截。

## 邮箱验证发信配置（SMTP）

邮箱绑定验证邮件由 `account_email.py` 发送，真实发信依赖 SMTP 配置。未配置时验证邮件发送会失败，绑定功能不可用。

1. **准备发信邮箱**：建议使用专用阿里企业邮箱（或任一支持 SMTP 的邮箱），在邮箱后台生成**客户端授权码**（不是网页登录密码）。
2. **填写配置**：复制 `server/.env.example` 到 `server/.env.local`（本机 Git 忽略，不要把真实密钥提交进 Git），填写以下项：
   - `ACCOUNT_EMAIL_SMTP_HOST`：SMTP 服务器地址，企业邮箱为 `smtp.qiye.aliyun.com`
   - `ACCOUNT_EMAIL_SMTP_PORT`：465（SSL）
   - `ACCOUNT_EMAIL_SMTP_USER` / `ACCOUNT_EMAIL_FROM`：发信邮箱地址
   - `ACCOUNT_EMAIL_SMTP_PASSWORD`：客户端授权码
   - `ACCOUNT_EMAIL_BASE_URL`：邮件内验证链接回跳地址，如 `https://huiguan.iridescently.xyz/account.html`
3. **SPF**：若发信邮箱域名与站点域名不同，需为发信域配置 SPF 记录，否则验证邮件容易被收进垃圾箱。
4. **重启**：配置后重启会馆服务生效。环境变量同名项优先于 `.env.local`。
5. **用户端收件方不限**：阿里 / QQ / Outlook / Gmail 等均可；代码只校验验证链接时效（30 分钟）与一次性使用，不限制收件邮箱厂商。
