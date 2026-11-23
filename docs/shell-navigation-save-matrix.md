# #95 门庭导航与存档回归矩阵

范围：`apps/shell/portal.json` 的 8 个正式游戏模块。`shengsheng-shoot` 是另列的试玩入口；本轮排除，另行确认是否将它纳入正式发布回归。站点链接（包括单独站点的 `spirit`）、未发布入口和 LAB 不在这个矩阵内。

## 操作矩阵

每行公共路径：临时账号 A 从门庭进入指定模块 → 完成可用动作 → 回门庭 → 再进 → 在模块之间前进/后退，再从门庭重入。比较账户显示与操作前后持久状态；切换到另一个临时账号 B 时，账号专属数据不应串用。结算模块另外观察一次主动结算与单纯导航的上报数。路径均以 `/app/shell/m/` 开头。以下“预期”来自源码，不是本轮实测记录。

| 模块 / 路由尾段 | 进入、状态采样及返回预期 | 真模块本轮状态 |
|---|---|---|
| 众生牌录 `cards`（嵌入） | 门庭出行，完成一局；确认当前账户、牌录和续档按 Cards 本地/已授权存档规则恢复。比较一次结算与纯重入的进度上报 | BLOCKED：未运行完整模块构建、账号或战斗 |
| 灵境会馆 `management`（嵌入） | 改建一处或推进一步；按 `saveGame.js` 核对本机作用域及已登录时云存档，单纯重入不可算作再次建造 | BLOCKED：未运行真实建造及云存档 |
| 生态进化 `ecology`（嵌入） | 暂停模拟，记录世界 ID 和 tick；检查 `persistence.js` 的本机生态存档，重入不重建已保存世界 | BLOCKED：未运行模拟与持久化；SKIP：账号云结算未在现有契约中确认 |
| 聚灵 `juling`（嵌入） | 进行一次可保存的修炼；核对 `README` 所述 SQLite 进度与前端镜像，重入不可重复领同一次收益 | BLOCKED：未运行服务/修炼 |
| 重生之门 `slay`（嵌入） | 进行新局、暂停或结算，核对本地统一存档及待同步队列；纯重入不重复上报 | BLOCKED：未运行卡局、暂停或队列 |
| 灵体互动 `softie`（嵌入） | 可用 WebGPU 浏览器更改一个偏好再重入，核对统一存档；不支持者验证兼容性提示另记 | BLOCKED：未实测 WebGPU、联机或偏好；SKIP：战斗/结算存档不适用 |
| AEON `aeon`（嵌入） | 启动、暂停模拟再回门庭；已见源码记录教程和 2D/3D 选择，不把世界跑局续档当作已实现 | BLOCKED：未运行模拟与偏好；SKIP：本矩阵无经确认的持久世界续档或账号结算合同 |
| 罗小黑世界地图 `world-map`（iframe） | 查看一个地点档案，再回门庭或前进/后退；继续保留已实现的主题偏好，不要求恢复上次地点 | BLOCKED：未运行真实地图构建；SKIP：战斗、结算及进度上报不适用 |

## 可自动执行的 Shell smoke

在实际仓库根目录，用开发环境里已安装的 Playwright + Chromium：

```sh
PLAYWRIGHT_MODULE="$PWD/apps/management/node_modules/playwright" node apps/shell/tests/navigation-save-smoke.cjs
```

若 Playwright 可直接解析则不用 `PLAYWRIGHT_MODULE`。已有 Chromium 时可用 `CHROMIUM_EXECUTABLE` 指定。测试从 checkout 读取真实 Shell 和 portal manifest，在随机 localhost 端口提供 8 个合成模块、合成账户及回合上报。每模块使用独立浏览器上下文，拦截外站请求。验证真实路由、嵌入／iframe分支、返回门庭、前进／后退，以及导航本身不会重置**合成**进度或发送第二条**合成**上报。它不启动真实服务，不访问或写入账号、SQLite 或正式存档。

本轮：`node --check` **PASS**；运行 smoke 已尝试但 Chromium 在首次起进程即因执行环境拒绝进程 socket（`process_singleton_posix.cc:297: socket() failed: Operation not permitted`）退出，**未运行任何浏览器用例**。发布前在允许 Chromium 启动的 CI 或开发机回跑这份 smoke，并以临时 `IRIDESCENTLY_ENVIRONMENT=test` 存储逐行完成真模块矩阵；不要把合成结果替代模块联机或存档验收。未定位确认可复现的应用缺陷，未改变运行代码。
