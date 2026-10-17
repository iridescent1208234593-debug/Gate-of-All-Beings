# 钩子与约定

## 1. 壳 embed 协议

模块被壳无 iframe 挂载时的约定：

| 约定 | 说明 |
| --- | --- |
| `window.__iridescentlyEmbed` | 壳在注入脚本前设置的**容器元素**；模块若存在则挂载到它（如 softie 的 `mount(container)`） |
| `window.__iridescentlyDispose` | 模块提供的**卸载函数**；壳在切换/离开时调用，用于停循环、解绑监听、销毁实例 |
| `<base href>` | 壳按模块基址设置，保证运行期相对资源按模块解析 |
| `?embed=<ts>` | 壳 import 模块入口时加的 cache-bust，保证重复进入重新执行 |

模块侧实现：cards（React `createRoot`）、management（`__lingjing.dispose`）、ecology/aeon（循环闸门）、juling（IIFE + dispose）、slay（渲染进 `#SlayTheWeb`）、softie（`export mount/unmount`）。

## 2. `server/app/portal.json`（导航唯一数据源）

```jsonc
{ "key": "cards", "group": "游戏", "name": "…", "desc": "…",
  "url": "/app/modules/cards/", "icon": "🦊", "status": "beta", "embed": true }
```

- `url` 以 `/` 开头 = 站内模块（壳内路由到 `/app/shell/m/<key>`）；`https://` = 外链站点。
- `embed: true` = 无 iframe 挂载；否则壳用 iframe。
- 新增模块只需在 `portal.json` 增条目 → 壳导航自动出现。

## 3. `portal_server.py` 扩展点

- `route(host, path)` 返回 `(处理类, 配置)`：
  - Host 分支（`huiguan.*`/`oc.*`）→ 各自 Handler；
  - `StaticHandler` + `{root, strip, spa?}` 提供静态子树与 SPA 回退；
  - `ProxyHandler` + `{port, strip}` 提供 `/app/modules/<名>/api/*` 反代（端口表 `PROXY_PORTS`）。
- 新增上游：在 `PROXY_PORTS` 加 `<模块名>: <端口>`。
- **keep-alive**：`Dispatcher.handle_one_request` 的 try/finally 保证每个请求都重新分发；改路由逻辑务必保留。

## 4. 构建约定 `server/app/scripts/build-modules.mjs`

- Vite 模块：源码须能 `vite build --base /app/modules/<名>/`，产物落 `server/app/modules/<名>`。
- 静态模块：放 `src/<名>/public`（或整目录），必要时在脚本里修正根绝对路径。
- `slay/ui/images`：可选美术，`build-modules.mjs` 按 `server/app/module-assets.json`（`slay.images`）或 `IRIDESCENTLY_SLAY_IMAGES_DIR` 复制真实文件；未配置时跳过，配置了但路径不存在则构建失败。旧来源 `shared/shared-ui/AI image` 已按复审删除。
- 后端共享：`sys.path` 指向 `server/` 以导入 `base_static`/`hx_sso`/`account_security`。

## 5. shared-session 钩子

- `kv.unifiedStorage(module)`：同 localStorage 接口，写统一键并迁移旧键。
- `save.get/set/onSave`：统一存档读写与订阅。
- `bus.publish/subscribe`：`BroadcastChannel('iridescently')` 跨模块同步（Node 下 `unref`）。
- `session.refreshSession/getSession`：统一登录态。

## 6. 运维钩子

- 网站管家 `ops/网站恢复/website-manager.py` 的 `SITES`：站点清单（名称/域名/端口/启动命令）。
- 看门狗 `portal/huiguan/watchdog.py`：8080 不在则拉起 `server/portal_server.py`。
- Cloudflare：`~/.cloudflared/config.yml` 的 ingress 与 `TUNNEL_SITE`。
- 世界观库重链：`assets/罗小黑战记数据库/relink_db.py`（预演 / `--apply`）。

## 7. 新增一个游戏（清单）

1. 源码放 `server/app/src/<名>/`（独立 git 仓库），可用 `@lxh/*` 公用包。
2. 需要无 iframe：暴露挂载/卸载（`createRoot` 或 `__iridescentlyDispose`）。
3. `build-modules.mjs` 增加该模块的构建/拷贝。
4. `portal.json` 增加条目（`embed: true`）。
5. 若有 API，在 `portal_server.PROXY_PORTS` 加上游端口，并把前端调用改成 base 感知（`/app/modules/<名>/api/...`）。
6. 跑 `verify_portal.py` 与对应测试。

2026-10-14：Cards提供`window.__iridescentlyMount`，返回当前root的dispose；壳缓存factory并复用已加载React runtime，避免每次执行整份bundle重复安装document代理。未提供factory的模块仍按既有脚本挂载，但必须实现真实owner清理。壳使用shell前缀DOM/style，避免与模块topbar等id碰撞。切换由AbortController+generation串行化，旧fetch不能回写新页面。
