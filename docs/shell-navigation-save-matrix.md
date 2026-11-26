# #95 门庭导航与存档回归矩阵

范围：`apps/shell/portal.json` 的 8 个正式游戏模块。`shengsheng-shoot` 是另列的试玩入口；本轮排除，另行确认是否将它纳入正式发布回归。站点链接（包括单独站点的 `spirit`）、未发布入口和 LAB 不在这个矩阵内。

## 操作矩阵

每行公共路径：临时账号 A 从门庭进入指定模块 → 完成可用动作 → 回门庭 → 再进 → 在模块之间前进/后退，再从门庭重入。比较账户显示与操作前后持久状态；切换到另一个临时账号 B 时，账号专属数据不应串用。结算模块另外观察一次主动结算与单纯导航的上报数。路径均以 `/app/shell/m/` 开头。以下“预期”来自源码，不是本轮实测记录。

| 模块 / 路由尾段 | 进入、状态采样及返回预期 | 真模块本轮状态 |
|---|---|---|
| 众生牌录 `cards`（嵌入） | 门庭出行，完成一局；确认当前账户、牌录和续档按 Cards 本地/已授权存档规则恢复。比较一次结算与纯重入的进度上报 | BLOCKED：未运行完整模块构建、账号或战斗 |
| 灵境会馆 `management`（嵌入） | 改建一处或推进一步；按 `saveGame.js` 核对本机作用域及已登录时云存档，单纯重入不可算作再次建造 | PASS：隔离浏览器中真实构建 + 模拟账户/云端完成冷后退与重入；真实云端未测 |
| 生态进化 `ecology`（嵌入） | 暂停模拟，记录世界 ID 和 tick；检查 `persistence.js` 的本机生态存档，重入不重建已保存世界 | BLOCKED：未运行模拟与持久化；SKIP：账号云结算未在现有契约中确认 |
| 聚灵 `juling`（嵌入） | 进行一次可保存的修炼；核对 `README` 所述 SQLite 进度与前端镜像，重入不可重复领同一次收益 | BLOCKED：未运行服务/修炼 |
| 重生之门 `slay`（嵌入） | 进行新局、暂停或结算，核对本地统一存档及待同步队列；纯重入不重复上报 | BLOCKED：未运行卡局、暂停或队列 |
| 灵体互动 `softie`（iframe） | 可用 WebGPU 浏览器更改一个偏好再重入，核对统一存档；不支持者验证兼容性提示另记 | PASS：隔离浏览器真实构建，Spirit 默认入口冷后退及重入均重新挂载；未测 WebGPU、联机和偏好；SKIP：战斗/结算不适用 |
| AEON `aeon`（嵌入） | 启动、暂停模拟再回门庭；已见源码记录教程和 2D/3D 选择，不把世界跑局续档当作已实现 | BLOCKED：未运行模拟与偏好；SKIP：本矩阵无经确认的持久世界续档或账号结算合同 |
| 罗小黑世界地图 `world-map`（iframe） | 查看一个地点档案，再回门庭或前进/后退；继续保留已实现的主题偏好，不要求恢复上次地点 | BLOCKED：未运行真实地图构建；SKIP：战斗、结算及进度上报不适用 |

## 可自动执行的 Shell smoke

在实际仓库根目录，用开发环境里已安装的 Playwright + Chromium：

```sh
PLAYWRIGHT_MODULE="$PWD/apps/management/node_modules/playwright" node apps/shell/tests/navigation-save-smoke.cjs
```

若 Playwright 可直接解析则不用 `PLAYWRIGHT_MODULE`。已有 Chromium 时可用 `CHROMIUM_EXECUTABLE` 指定。测试从 checkout 读取真实 Shell 和 portal manifest，在随机 localhost 端口提供 8 个合成模块、合成账户及回合上报。每模块使用独立浏览器上下文，拦截外站请求。验证真实路由、嵌入／iframe分支、返回门庭、前进／后退，以及导航本身不会重置**合成**进度或发送第二条**合成**上报。它不启动真实服务，不访问或写入账号、SQLite 或正式存档。

这也用浏览器后退从门庭返回上一份 Shell 文档，再前进回门庭；每次把实际观测到的
`pageshow.persisted` 打印出来。Playwright 默认禁用往返缓存，可用 `SHELL_SMOKE_BFCACHE=1`
尝试启用；允许缓存不代表浏览器确实采用它。只有日志为 `true` 才算覆盖往返缓存恢复，为
`false` 则是重新加载路径。真模块仍须用临时 `IRIDESCENTLY_ENVIRONMENT=test` 存储逐行完成矩阵；
不要把合成结果替代模块联机或存档验收。

## 真实构建的补充验收（隔离）

Windows Chrome 158：同一个 Shell 入口，启动隔离浏览器资料及随机 loopback 端口。
大厅与账户、云存档、上报服务用测试替身；只给已知的大厅跳转做本地重定向，拦截其他外部请求。不接生产。

- Management（嵌入）：真实构建在模拟账号下由界面暂停、东扩并手动保存。返回大厅、冷后退、前进和重入后，保存的地图宽度及暂停状态一致。全程只观察到一次云保存请求和一次进度上报请求，都是模拟端点。
- Softie（iframe）：真实构建从默认 Spirit 入口加载；冷后退、前进及重入都会再次挂载 Spirit 视图。未验证 WebGPU 实际渲染及联机。默认路由隐藏旧主页的语言偏好控件，所以本次不把 iframe 重挂载算作偏好存档验证。
- 8/8 合成路径在默认设置及允许往返缓存时均通过，但实际没有观测到往返缓存恢复。其余 6 个模块的真实玩法/存档验收未覆盖。

安装工作区的构建依赖（如使用现有本地缓存，保证工作区包别名指向当前检出），从仓库根目录运行：

~~~sh
npm run build --prefix apps/management -- --base /app/modules/management/
npm run build --prefix apps/softie -- --base /app/modules/softie/
PLAYWRIGHT_MODULE="$PWD/apps/management/node_modules/playwright" node apps/shell/tests/navigation-real-save-smoke.cjs
~~~

构建输出必须位于各模块的 dist。若 Playwright 没有自带浏览器，用 CHROMIUM_EXECUTABLE 指向已安装的 Chrome 或 Chromium。
