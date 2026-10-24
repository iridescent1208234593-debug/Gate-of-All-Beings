# 玩法入口与服务故障恢复

`server-recovery.js` 的 `IridescentlyRecovery.render(container, options)` 为统一模块壳、会馆展示读取失败和服务器导航错误页提供恢复入口。

- 首操作是「换服务器重试」，保留路径、查询参数及锚点；用 `data-server-choice` 标记，防止本机选服脚本把稳定版链接重新改回本机。
- 其余操作是「重新加载」和「返回众生之门游戏页面」。保留 44px 触控区域、键盘焦点及窄屏换行。
- 只发起一次、最长 4 秒的另一节点入口健康检查；提示在线只代表门户可达，不承诺该玩法的所有资源或共享后台均正常。
- 切换由玩家点击执行，没有自动刷新、自动跳转或失败后循环切回。
- 切换不搬迁 localStorage / IndexedDB 或未提交草稿；香港账户和云端 API 仍为单一来源。
- `server-unavailable.html` 可独立加载，不依赖游戏构建。nginx 在应用源站不可用时直接提供该页和恢复 JS。
- 404 / 502 / 503 / 504 保留真实 HTTP 错误状态。只有游戏导航使用 HTML 恢复；资源请求维持失败状态，API 源站故障返回 JSON 502。

模块壳先检查入口 HTTP 状态；嵌入模块的脚本/样式加载失败交由原有挂载异常分支清理并显示恢复组件。非嵌入玩法先做 HEAD 检查，再打开原 iframe。已有路由、引擎、账户与存档契约不重建。

统一门户在分发静态目录时会剥离 `/app/modules` 等前缀。导航与 API 的判断必须读取 `requestline` 中的原始公开路径，不能读取已经改写的 `handler.path`。回归检查必须经过真实 Dispatcher；只测 PC 网关不足以覆盖此分发行为。

恢复页由源站或香港 nginx 提供。如果本机隧道完全离线、Cloudflare 直接返回 1033，页面代码无法运行；此时应直接打开香港正式入口。要覆盖 CDN 自身错误需另行配置边缘故障页或 Worker，本轮没有增加该架构。

验收入口：`python ops/test_access_recovery.py`；浏览器覆盖脚本在 `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/audits/access-audit-20261019/browser-candidate.js`。
