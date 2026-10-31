# OC 小游戏

独立的原生 JavaScript / Canvas 应用，包含 OC 快跑和青蛙过河。游戏实现、素材、样式、接入适配与测试全部留在本目录；Cards 只追加门庭卡片，不承载游戏逻辑。

## 入口

| 玩法 | 壳入口 | 构建后页面 |
| --- | --- | --- |
| OC 快跑 | `/app/shell/m/oc-run` | `/app/modules/mini-games/?game=runner` |
| 青蛙过河 | `/app/shell/m/frog-crossing` | `/app/modules/mini-games/?game=crossing` |

统一壳以同源 iframe 承载。进入游戏前读取当前账户的 OC，选择已有头像或配图作为出场形象。所有 OC 使用同样的物理规则和碰撞尺寸，不修改设表或门庭形象。OC 列表来自已有 `/api/gate/ocs`，前后读取 `/api/gate/identity` 核对 owner；开局再次确认角色和图片仍属于当前账户。

无登录、没有 OC、接口故障和图片失效分别显示提示，不能进入错误状态的对局。切换窗口自动暂停；回来后核对账户，换号时退出原对局并重新选 OC。P / Esc 暂停，继续游戏需要再次确认登录身份。

## 保留和移除

- 快跑开放默认地图和经典小恐龙；太空地图已移除，更多地图显示“敬请期待”并暂不开放。沿用二段跳、三档难度、固定角色碰撞范围和小步碰撞检测。
- 过河保留晴日马路和林间小河、9 × 11 格棋盘、逐格跳跃、三次机会、五个终点与后续关卡。道路和水流按原规则运动。
- 地图由开发者固定在 `src/maps.js` / `src/crossing.js`，快跑障碍仍按原规则动态生成。玩家可以选择内置地图，不能上传、编辑、导入或通过 URL 加载其他地图。
- 金币快跑保留原版金币路线与磁铁、飞行包、护盾、双倍金币；固定普通难度，所有道具在局内免费生成，每局清空。不接钱包、库存、开局携带、购买、养成、商店、图片上传、地图编辑器和小工具 SDK。
- 本机最佳、上次 OC、地图与难度按账号和玩法隔离，不恢复半局。三个账号榜单为 `oc-run`、`oc-run-coins`、`frog-crossing`；金币榜先比较单局金币数，再比较同一局的整数游戏距离（与画面一致），相同则先达到者在前。普通快跑和过河按单局分数。过河过关继续属于同一局，仅机会耗尽时提交；主动离开不提交完整成绩。

## 目录边界

| 文件 | 职责 |
| --- | --- |
| `src/runner.js` | 纯跑酷状态与物理，无 DOM、网络或账户依赖 |
| `src/coins.js` | 金币路线、拾取、四种局内道具，不依赖钱包或账号 |
| `src/crossing.js` | 纯过河状态、车道、碰撞和关卡 |
| `src/maps.js`、`assets/` | 默认地图与待开放地图定义、必要素材；门庭封面为地图预览，不包含用户 OC |
| `src/graphics.js` | Canvas 绘制与图片加载 |
| `src/platform.js` | OC 接口、精确来源校验、按 owner 隔离的本机记录 |
| `src/app.js` | 选择页面、输入、暂停、生命周期和错误提示 |
| `build.mjs` | 静态构建白名单；不打包测试、文档或源包信息 |
| `tests/` | 玩法、账户边界、构建和模拟浏览器测试 |

存储复用现有 `unifiedStorage('mini-games')`，键含账户 owner 和玩法编号。账户资料、其他玩法存档和原小工具的旧记录均不迁移、不修改。这里不是 OC 数据库的新写入方。写入失败会保留待保存成绩并显示重试，损坏记录不会被静默覆盖。

入口接入仅追加到 `apps/shell/portal.json`、`apps/cards/src/game/ModeHall.tsx`、`tools/build/build-modules.mjs`。排行榜复用 `/api/progress/report`、共享上报客户端及共享榜单页面；后端 `services/platform/mini_game_scores.py` 通过现有 `account_progress.py` 接入，使用现有账号数据库中的独立成绩/去重表，不写积分、任务、OC 或钱包。共享客户端只为金币榜传距离；共享页面只为金币榜追加距离显示，其他榜单规则保持不变。

每局固定编号；失败可以在当前页面重试，不阻止继续玩，重试不会重复结算，也不会用同一编号改成绩。待提交队列只保留在当前页面内存，关闭/刷新页面不保证补传。换号时不把旧账号成绩提交给新账号。未修改域名、登录或生产部署。

## 构建与验证

### 手动试玩（测试 OC）

不要双击 `index.html`，`file://` 没有共享模块和 OC 接口。在仓库根目录打开 PowerShell：

```powershell
node apps/mini-games/dev.mjs
```

保持窗口运行，在浏览器打开 `http://127.0.0.1:5186/?game=runner` 或 `http://127.0.0.1:5186/?game=crossing`。页面顶部明确标注本地试玩，提供两位测试 OC。按 Ctrl+C 停止。无需安装 npm 依赖，也可以在本目录运行 `npm run dev`。

如果端口被占用，先设置 `$env:MINI_GAMES_PORT='5187'` 再启动，使用输出的新地址。服务只监听本机回环，按白名单提供本模块和必要的已有共享文件；不代理线上、不读取真实账户或数据库、不接受上传和写 API。开发服务、测试角色和顶部提示不进入正式构建。

这能手动检验游戏、地图、角色切换、暂停和成绩保存，不能验证真实 OC 所有权或真实排行榜提交：试玩服务拒绝写 API，出现提交失败提示属于预期，可继续玩。真实账户联调需要完整的登录后端；线上会馆的 Cookie 不会自动带到本地试玩。

### 自动检查

从仓库根目录运行，无新增 npm 依赖：

```powershell
python -X utf8 -m unittest services.platform.tests.test_mini_game_scores
node --test apps/mini-games/tests/*.test.js
node apps/mini-games/tests/browser.mjs
```

浏览器测试使用根项目的 Playwright；找不到该包时可用 `MINI_GAMES_PLAYWRIGHT_MODULE` 指向已安装的 Playwright。可选 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定 Chromium / Edge，`MINI_GAMES_EVIDENCE_DIR` 指定截图目录。默认不改源码；设置 `MINI_GAMES_WRITE_COVERS=1` 才会更新两张门庭地图预览。

浏览器测试启动一次性的本地静态构建，只使用模拟账户、OC 和图片，不读取真实账户或连接生产接口。它覆盖桌面／手机、空列表／访客／接口失败／图片失败、暂停继续、换号、刷新成绩和统一壳加载切换。截图不代表真实账户联调验收。

正式模块构建仍使用根目录 `npm run build:modules`，新增模块仅做静态复制，不需要单独安装依赖。构建不等于发布；需要同时构建 Cards 才能显示新门庭入口。香港旧布局不能直接套用这份新布局的构建。

## 来源

基于用户提供的 `Lets-Go-小工具-20261019-空间额度查询.zip` 拆分重构。原始压缩包未修改。`SOURCE.json` 记录源包、源脚本与保留素材的 SHA-256 和原文件名；地图几何与图像沿用原实现，不因此增加素材的独立分发授权。没有复制原包的 GIF 解码器或其他被移除系统。

没有 OC 时使用用户提供的 `assets/default-character.png` 作为默认出场角色；有 OC 时优先选择账户 OC。访客可用默认角色试玩，成绩不参与账户排行榜。读取失败仍提示重试，不把网络错误当作没有 OC。
