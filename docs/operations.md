# 部署与运维

## 端口总表

| 端口 | 服务 | 启动 |
| --- | --- | --- |
| 8080 | 统一入口（www + huiguan + oc + 壳 + 游戏模块 + API 代理） | `PORT=8080 python server/portal_server.py` |
| 8088 | 主站单站（可选，独立） | `cd portal/www && python server.py` |
| 8089 | 会馆单站（可选，独立） | `cd portal/huiguan && python server_huiguan.py` |
| 8090 | 人设站单站（可选，独立） | `cd portal/oc && python server.py` |
| 5173 | 卡牌 dev | `cd server/app/src/cards && npm run dev` |
| 5174 | 卡牌 OAuth 代理（统一入口 cards API 上游） | `cd server/app/src/cards && python server.py` |
| 5176 | 旧卡牌入口重定向 | `cd server/app/src/cards && node scripts/legacy-redirect.mjs` |
| 5177 | 聚灵（统一入口 juling API 上游） | `cd server/app/src/juling && PORT=5177 node server.js` |
| 5179 | 灵境会馆 dev | `cd server/app/src/management && npm run dev` |
| 4173 | 软乎乎 preview（统一入口 softie API 上游） | `cd server/app/src/softie-webgpu && npm run preview` |

## 生产架构

- **Cloudflare 隧道**：`~/.cloudflared/config.yml` 把 `iridescently.xyz`、`www`、`huiguan`、`oc`、`spirit` 指向 `127.0.0.1:8080`（统一入口）；`zszm/game/juling/lingjing/psyche/psy/feather` 各自保留。
- 灵体正式链接为 `https://spirit.iridescently.xyz/games/spirit-playground?room=forest`。页面由 `server/app/modules/softie/` 提供，房间服务使用 softie 上游 4173；账号云存档 API 由会馆提供。
- **网站管家** `ops/网站恢复/website-manager.py`：按 `SITES` 一键恢复全部站点 + 隧道；状态分开检查本机 8080、cloudflared 进程、`main` Tunnel 活动连接和公网主站。`--smoke-test` 只读检查，不启动任何进程。Windows 登录任务 `marvis-cloudflared` 负责登录时启动隧道；网站管家启动前先检查现存进程，避免重复实例。
- **看门狗** `portal/huiguan/watchdog.py`：只负责 8080 不在时拉起统一入口（由计划任务每 5 分钟调用）；Tunnel 由网站管家负责检查和恢复，避免两个自动器重复启动 cloudflared。

### 一键恢复

```bash
cd ops/网站恢复 && python website-manager.py        # 图形界面，一键恢复全部
python website-manager.py --smoke-test              # 自检
```

### 重启隧道

```bash
cloudflared tunnel --config "%USERPROFILE%\.cloudflared\config.yml" run
```

## 统一入口切换 / 回滚

- 切换：`config.yml` 把目标域名改到 8080 → 重启 cloudflared。
- 回滚：改回 8088/8089/8090 → 重启 cloudflared；旧单站仍可独立运行。
- 配置备份：`config.yml.bak-<时间戳>`。

## 数据库维护

- 世界观库搬移后重链：`python "assets/罗小黑战记数据库/relink_db.py"`（预演）→ `--apply`（自动备份 `.bak-<时间戳>`）。
- 会馆用户库 `portal/huiguan/users.db`、聚灵 `server/app/src/juling/data/save.db` 直接备份文件即可。

## 排障

| 现象 | 处理 |
| --- | --- |
| 模块页 css/js 大量 404 | 统一入口曾因 keep-alive 未重新分发；确认 `Dispatcher.handle_one_request` 保留 try/finally 恢复 |
| 本地跨域资源 ERR_BLOCKED_BY_ORB / CORS | 会馆设计系统/SSO 走独立子域，本地跨 8080↔8089 会被拦，属预期 |
| 会馆图片 404 | 世界观库路径失效 → 跑 `relink_db.py` |
| 重复进入游戏出现双循环 | 模块未提供/未调用 `__iridescentlyDispose` |
| 端口占用 | `netstat -ano | findstr :8080` → `taskkill /PID <pid> /T /F` |

## 日志

- 统一入口：控制台 / 重定向文件；看门狗写 `server/portal*.log`。
- 网站管家：`ops/网站恢复/logs/<站点>.log`。
- 各单站：站点目录内 `.log`（清理时可删）。
