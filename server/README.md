# server/ · 统一后端与前端壳

统一入口、共享后端、前端壳与全部游戏源码。总览见根 [README.md](../README.md)。

## 内容

| 文件 | 作用 |
| --- | --- |
| `portal_server.py` | 统一入口：单进程按 `Host`/路径分发（www / huiguan / oc / 壳 / 游戏模块 / API 代理 / SPA 回退） |
| `verify_portal.py` | 本地自检（27 项） |
| `base_static.py` | 静态站点基类（安全头 / 静态白名单 / 静默断连） |
| `hx_sso.py` | 跨站 SSO cookie（`.iridescently.xyz`） |
| `account_security.py` | 站内账号找回 / 限流 / 改密 |
| `app/shell/index.html` | 统一壳：History API 路径路由，7 游戏全部内嵌（无 iframe） |
| `app/portal.json` | 门户清单（导航唯一数据源，含 `embed` 标记） |
| `app/scripts/build-modules.mjs` | 构建全部游戏到 `app/modules/` |
| `app/src/<名>/` | 游戏源码（由项目根目录 Git 统一管理） |
| `app/modules/<名>/` | 构建产物（gitignore，运行所需） |

`portal/www`、`portal/oc`、`portal/huiguan`、`app/src/cards` 的 server 均从此目录导入共享模块。

## 路由与分发

- 按 `Host`：`huiguan.*`→会馆、`oc.*`→人设站、其余主域→主站。
- 按路径（主域）：`/app/shell/*`→统一壳（SPA 回退到 `shell/index.html`）、`/app/modules/<名>/`→游戏、`/shared/*`→公用资源。
- `POST/GET /app/modules/<名>/api/*`→反向代理到上游（cards 5174 / softie 4173 / juling 5177）。

## 运行

```bash
PORT=8080 python server/portal_server.py
python server/verify_portal.py
node server/app/scripts/build-modules.mjs
```
