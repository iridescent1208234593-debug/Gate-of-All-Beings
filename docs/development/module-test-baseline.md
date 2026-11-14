# 八个游戏模块的测试与可运行性基线（Issue #73）

本文记录八个游戏模块（cards、management、ecology、juling、aeon、world-map、slay、softie）的构建方式、单元测试结果、最小交互入口验证情况和已知未验证项。基线只使用本机临时存储，不触碰香港生产、Cloudflare、DNS、Tunnel、OAuth 或真实用户数据。

总览与启动步骤见[本地开发环境与启动矩阵](local-onboarding.md)；模块结构和构建边界见 [apps/README.md](../../apps/README.md)。

## 1. 环境与复跑方式

| 项目 | 本轮实测 |
| --- | --- |
| 系统 | Windows 10/11 + PowerShell 7 |
| Node.js | v22.17.0 |
| npm | 10.9.2 |
| Python | 3.12.14（`uv python find 3.12`） |
| 存储 | 临时目录 `IRIDESCENTLY_STORAGE_ROOT`；构建用 `development`，测试用 `test` |

只读诊断脚本：

```powershell
# 只盘点，不执行任何命令（只读，输出 Markdown）
python tools/checks/module_baseline.py

# 执行聚合构建 + 各模块单测，并挂载构建产物做入口探测
python tools/checks/module_baseline.py --run --serve --json baseline.json --markdown baseline.md

# 收紧时间上限：每条命令 300 秒、整轮 --run 600 秒（默认 600 / 1800）
python tools/checks/module_baseline.py --run --command-timeout 300 --total-timeout 600
```

`--run` 用 `IRIDESCENTLY_ENVIRONMENT=test` 和一次性临时根运行；`--serve` 在随机回环端口按门户路径（`/app/modules/<名>/`、`/shared/`）托管构建产物，抓取每个入口及它自己引用的资源。`--run` 的每条命令（聚合构建、各模块测试、附加检查）上限 600 秒（`COMMAND_TIMEOUT`，可用 `--command-timeout` 覆盖）：超时会终止 npm 及其派生的整棵进程树、记 FAIL 并在 JSON 里带 `timeout` 字段，与「测试失败」分开，避免一个卡住的模块让基线命令永远不退出。整轮 `--run` 另有 1800 秒（`TOTAL_TIMEOUT`，可用 `--total-timeout` 覆盖）墙钟预算：命令上限会被剩余预算压低（`--command-timeout` 大于 `--total-timeout` 合法，总预算是硬上限），用尽后不再启动新命令，剩余检查记为 NOT RUN，整轮以非 0 退出。脚本的单元测试：

```powershell
python -m unittest discover -s tools/checks -p 'test_module_baseline.py'
```

## 2. 状态定义

| 状态 | 含义 |
| --- | --- |
| PASS | 命令退出码 0；或入口页面及其引用的同源资源都返回 200 |
| FAIL | 命令退出码非 0、或超过 600 秒上限被终止（JSON 带 `timeout`）；或入口引用的资源缺失 |
| SKIP | 检查不适用或当前无法运行（无 test 脚本、依赖未安装、没有构建产物） |
| NOT RUN | 本轮没有尝试执行 |

SKIP 与 NOT RUN 都不等于通过；缺少依赖导致的失败不会被记为 PASS。整轮预算用尽时剩余检查记 NOT RUN，整轮以非 0 退出，不把不完整的矩阵当成通过。

## 3. 测试与可运行性矩阵

| 模块 | 构建 | 单元测试 | 最小交互入口（加载） | 浏览器 UI / GPU 交互 | 已知未验证项 |
| --- | --- | --- | --- | --- | --- |
| cards | PASS | PASS 67/67 + 后端 4/4 + `tsc` | PASS（HTTP 200，7 个自有资源无缺失） | NOT RUN | 出行/重生之门完整流程、OAuth 后端（`server.py` 5174）、音频 |
| management | PASS | PASS 6/6 | PASS（HTTP 200，2 个自有资源无缺失） | NOT RUN | 账号 API（8089）、导出/导入、时代跃迁长流程 |
| ecology | PASS | PASS 7/7 | PASS（HTTP 200，2 个自有资源无缺失） | NOT RUN | 真实交互与性能门槛、移动端布局 |
| juling | PASS（静态拷贝） | SKIP（无 test 脚本） | PASS（3 个 API + `GET /` 全 200；1 个自有资源无缺失） | NOT RUN（接口级交互已 PASS） | 化形/成仙长流程、存档重启、多端并发 |
| aeon | PASS（静态拷贝） | PASS（`test/headless.mjs`） | PASS（`serve.mjs` 8123；2 个自有资源无缺失） | NOT RUN | 浏览器长时运行与性能、可视化效果 |
| world-map | PASS | SKIP（无 test 脚本；`tsc --noEmit` PASS） | PASS（HTTP 200，3 个自有资源无缺失） | NOT RUN | 全屏 WebGL 硬件渲染、地点档案交互、iframe 生命周期 |
| slay | PASS（静态拷贝） | **FAIL**（见 §4.1） | PASS（HTTP 200，7 个自有资源无缺失；可选素材 favicon 404） | NOT RUN | 完整对局流程、Node 下的 `/shared/` 解析、账号 API |
| softie | PASS | PASS 91/91 | PASS（HTTP 200，3 个自有资源无缺失） | SKIP（无头环境拿不到 WebGPU 适配器） | WebGPU 真机、多人 WebSocket、`tests/*.browser.mjs` |

「最小交互入口（加载）」指按门户路径加载入口、取得 200 且同源资源齐全，由 `module_baseline.py --serve` 复现。「浏览器 UI / GPU 交互」指真正在浏览器里点击、操作并观察状态变化：本轮未执行，除 softie 因无头环境拿不到 WebGPU 适配器记 SKIP 外，其余七个模块记 NOT RUN，不计为通过。

聚合构建 `node tools/build/build-modules.mjs`：PASS（exit 0，9.99s），产出全部八个模块目录。五个 Vite 模块（cards、management、ecology、softie、world-map）另用各自 `npm run build` 单独验证通过；juling、aeon、slay 由聚合构建静态拷贝，没有独立构建步骤。上表八行、各模块计数与出口码均取自同一轮 `--run --serve` 运行。

AEON 的 headless 用例跑满 6000 tick（本轮 123.7s，随机器负载波动）：final pop 3200、peak pop 3200、max generation 16，`LIFE PERSISTS` / `EVOLUTION (gens>=5)` / `POPULATION STABLE` 三项均 PASS。

### 3.1 最小交互入口

| 模块 | 入口 | 入口验证方式 |
| --- | --- | --- |
| cards | `/app/modules/cards/`（`apps/cards/index.html`） | 入口 + 7 个自有资源 200 |
| management | `/app/modules/management/`（`apps/management/index.html`） | 入口 + 2 个自有资源 200 |
| ecology | `/app/modules/ecology/`（`apps/ecology/index.html`） | 入口 + 2 个自有资源 200 |
| juling | `node server.js`（`PORT=5177`）→ `/`、`/api/state`、`/api/start`、`/api/action` | 3 个 API 与 `GET /` 均 200；1 个自有资源 200 |
| aeon | `node serve.mjs`（8123） | `GET /` 与 `GET /src/sim/sim.js` 均 200；2 个自有资源 200 |
| world-map | `/app/modules/world-map/`（同域 iframe） | 入口 + 3 个自有资源 200 |
| slay | `/app/modules/slay/`（挂载到 `#SlayTheWeb`） | 入口 + 7 个自有资源 200 |
| softie | `/app/modules/softie/`（`mount(container)`） | 入口 + 3 个自有资源 200 |

## 4. 失败项与复现

### 4.1 slay 单测失败（未修复，两个独立原因）

```powershell
npm install --prefix apps/slay
npm test --prefix apps/slay
# 2 tests failed, 5 uncaught exceptions（exit 1）
```

**原因一：根绝对 `/shared/...` 导入在 Node 下解析到盘符根。** 16 处前端源码用浏览器 URL 路径导入共享包，例如：

- `apps/slay/public/content/soul-legacy.js:1` → `import { unifiedStorage } from '/shared/shared-session/kv.js'`
- `apps/slay/public/content/character-images.js:2` → `import { characters, facts, characterByName } from '/shared/shared-data/catalog.js'`

Node ESM 把 `/shared/...` 解析为当前盘根，于是报 `Cannot find module 'D:\shared\shared-session\kv.js'`，`tests/dungeon.js`、`tests/game.js`、`tests/actions.js`、`tests/ai.js`、`tests/dungeon-graph.js` 五个文件在导入阶段就退出。浏览器里不受影响：门户把 `/shared/*` 映射到 `packages/*`（`services/platform/portal_server.py` 第 253 行），本轮入口探测也证实了这一点。要跑通这五个测试文件，需要给 Node 提供等价的解析（导入映射或测试用别名），或把这些导入改成可解析的相对/包名形式。

**原因二：卡牌名称契约漂移。** 旧测试仍用英文卡名：

- `apps/slay/tests/cards.js:6` 期望 `createCard('Strike')`
- `apps/slay/tests/cards.js:16` 期望 `createCard('Defend')`
- `apps/slay/public/game/cards.js:103` 抛 `Card not found: Strike`

这与 `local-onboarding.md` 记录的「27 个旧断言失败」不同：本轮有 5 个测试文件在导入阶段崩溃，它们的断言根本没有执行，所以断言失败数更少。两者是同一类契约漂移在不同依赖状态下的表现，不能互相替代。

## 5. 矩阵之外的未验证项

矩阵最后一列已按模块列出未验证项，下面三条跨模块，没有对应行：

- **模块生命周期**：`window.__iridescentlyDispose` 的重复挂载/卸载、RAF 与监听器释放没有在壳内复验。
- **门户端到端**：本轮没有执行 `build:site` → `build:release` → `release:seal` → `local-runtime.py start`，模块在真实门户 Host 路由下的表现沿用 Issue #72 的记录，不作为本轮结论。
- **账户与跨域 API**：management 在本地开发域名下请求 `http://localhost:8089`（`apps/management/src/systems/account.js:10`），slay 请求 `https://huiguan.iridescently.xyz/api/user`；两个上游都没有启动，登录与存档同步未验证。
