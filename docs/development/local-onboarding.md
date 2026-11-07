# 本地开发环境与启动矩阵（Issue #72）

本文是新成员在 Windows PowerShell 上从零复现本地开发环境的入口。Linux/macOS 使用同名命令时，将 PowerShell 的环境变量写法换成对应 shell 写法即可。

## 1. 版本与依赖

| 项目 | 要求 | 检查 |
| --- | --- | --- |
| Node.js | 22（以 `.nvmrc` 为准） | `node --version` |
| npm | 随 Node 22 安装，当前锁文件使用 npm lockfile v3 | `npm --version` |
| Python | 3.12（以 `.python-version` 为准） | `& $env:PYTHON --version` |
| Git | 2.30 或更新 | `git --version` |
| 浏览器自动化 | 仅运行浏览器测试时需要 Playwright | 由根依赖或模块依赖提供 |
| Gallery 预览构建 | FFmpeg（`ffmpeg` 在 PATH，或设置 `FFMPEG_PATH`） | `ffmpeg -version` |

PowerShell 示例：

```powershell
git clone https://github.com/iridescent1208234593-debug/Gate-of-All-Beings.git
cd Gate-of-All-Beings

# 使用仓库锁定的版本；不要用 Python 3.10/3.11 代替 3.12
node --version
uv python find 3.12
npm ci

# 按要运行的模块安装依赖
npm ci --prefix apps/cards
npm ci --prefix apps/management
npm ci --prefix apps/ecology
npm ci --prefix apps/softie
npm ci --prefix apps/www/gallery-engine
npx pnpm@10.28.0 install --frozen-lockfile --dir apps/activation-core
```

Slay 仓库当前没有跟踪 `apps/slay/package-lock.json`，因此安装用 `npm install --prefix apps/slay`；不要对它使用 `npm ci`。其余上述 `npm ci` 路径均有提交的 lockfile。

如果没有 `uv`，可用 pyenv 或 Python 官方安装器安装 3.12，并把 `$env:PYTHON` 设置为 3.12 的绝对路径。后续 Python 命令统一使用 `$env:PYTHON`，不要依赖当前 PATH 中的 `python`。

## 2. 数据隔离：只使用 development/test

运行代码不应读取生产数据。完整本机 runtime 使用 `development`；测试使用独立临时目录和 `test` 环境：

```powershell
$runtimeRoot = Join-Path $env:TEMP 'iridescently-onboarding-runtime'
New-Item -ItemType Directory -Force $runtimeRoot | Out-Null
$env:IRIDESCENTLY_STORAGE_ROOT = $runtimeRoot
$env:IRIDESCENTLY_ENVIRONMENT = 'development'
$env:PYTHON = (uv python find 3.12)
& $env:PYTHON --version
& $env:PYTHON -c "import sys; sys.path.insert(0, 'services/platform'); import storage_paths as s; print(s.initialize_storage()['roots'])"

$testRoot = Join-Path $env:TEMP 'iridescently-onboarding-test'
New-Item -ItemType Directory -Force $testRoot | Out-Null
$env:IRIDESCENTLY_STORAGE_ROOT = $testRoot
$env:IRIDESCENTLY_ENVIRONMENT = 'test'
```

不要设置为 `production`，不要复制真实 `users.db`、上传、备份或 secrets 到检出目录。`test` 根目录只放在临时目录；完成后可删除该临时目录。

从空 storage 构建完整首页时，Gallery 还需要一个外部图片目录。没有私有原件时可使用下面的临时 1×1 PNG 占位图；这只验证构建链路，不代表真实 Gallery 素材验收。占位图与转换出的 WebP 都留在临时目录，不要放进 Git：

```powershell
$galleryDir = Join-Path $env:TEMP 'iridescently-onboarding-gallery'
New-Item -ItemType Directory -Force $galleryDir | Out-Null
$png = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')
[IO.File]::WriteAllBytes((Join-Path $galleryDir 'onboarding-placeholder.png'), $png)
$env:GALLERY_DIR = $galleryDir
ffmpeg -version
```

## 3. 推荐启动路径：Portal、Cards、会馆和独立游戏

### 3.1 统一 Portal runtime（包含 Portal、会馆和封存模块）

Portal 不直接运行源码树，必须先生成同一 Git HEAD 的候选并封存 Release：

```powershell
$runtimeRoot = Join-Path $env:TEMP 'iridescently-onboarding-runtime'
$env:IRIDESCENTLY_STORAGE_ROOT = $runtimeRoot
$env:IRIDESCENTLY_ENVIRONMENT = 'development'
$env:PYTHON = (uv python find 3.12)
# 如果没有可用的本机 Gallery 原图，先运行第 2 节生成临时占位图并设置 GALLERY_DIR。
npm run build:site
npm run build:release
npm run release:seal
& $env:PYTHON tools/runtime/local-runtime.py start
& $env:PYTHON tools/checks/local-smoke.py
& $env:PYTHON tools/runtime/local-runtime.py status
```

访问地址和端口：

| 内容 | 地址 |
| --- | --- |
| Portal / 首页 | `http://127.0.0.1:8080/` |
| 会馆 | 由统一入口按 Host 分发；本地冒烟使用已登记的 loopback Host |
| Cards | `http://127.0.0.1:8080/app/modules/cards/` |
| 会馆模块 | `http://127.0.0.1:8080/app/modules/management/` |
| 独立聚灵上游 | `127.0.0.1:5177` |

停止顺序：

```powershell
& $env:PYTHON tools/runtime/local-runtime.py stop
```

`local-runtime.py` 只监听本机回环地址，不启动 Tunnel、不连接香港、不修改 DNS 或 Cloudflare。

### 3.2 Cards 单模块开发

```powershell
cd apps/cards
npm ci
npm run dev                 # Vite，默认 5173
# 另开终端；需要 OAuth API 时：
& $env:PYTHON server.py     # 默认 5174；若未设置 $env:PYTHON，先按第 2 节选择 Python 3.12
```

直接验证：

```powershell
npm test
npm run check:game
```

停止：在运行对应命令的终端按 `Ctrl+C`。Cards 本地开发不需要 Gemini key；不要把密钥写入源码或 `.env` 后提交。

### 3.3 会馆单站调试

会馆正式本地路径是 Portal runtime；不要另起一套账户数据库。只做前端页面调试时可按 `apps/huiguan/README.md` 的静态检查与临时端口测试运行，所有测试必须使用临时 schema/database 和临时图片目录。

统一入口验证：

```powershell
& $env:PYTHON services/platform/tests/verify_portal.py
```

### 3.4 独立游戏：AEON（零依赖）

AEON 不需要构建，也不写 runtime storage：

```powershell
cd apps/aeon
npm test
node serve.mjs             # 默认 8123；另开浏览器访问 http://127.0.0.1:8123
```

停止：按 `Ctrl+C`。

其他独立模块的入口见下方矩阵；同一时间只启动需要验收的服务，避免端口和 WebSocket 测试互相连接。

## 4. 模块启动与验证矩阵

| 模块 | 依赖/启动 | 最小验证 | 本次实测（Node 22.17.0） |
| --- | --- | --- | --- |
| Portal | development runtime/storage + FFmpeg/Gallery source → `build:site` → `build:release` → `release:seal` → `local-runtime.py start` | `local-smoke.py` | Release 启动成功，5/5 服务 healthy；本次 smoke 45/51，因临时 storage 缺少世界观 SQLite 有 6 项 API 检查失败 |
| Cards | `npm ci --prefix apps/cards`; `npm run dev --prefix apps/cards` | `npm test`; `npm run check:game` | 64/64、类型检查通过 |
| 会馆 | 由 Portal runtime 提供 | `& $env:PYTHON services/platform/tests/verify_portal.py` | 238/238 通过（Python 3.12.14） |
| management | `npm ci --prefix apps/management`; `npm run dev --prefix apps/management` | `npm test`; `npm run build` | 6/6、build 通过 |
| ecology | `npm ci --prefix apps/ecology`; `npm run dev --prefix apps/ecology` | `npm test`; `npm run build` | 7/7、build 通过 |
| AEON | `node serve.mjs` | `npm test` | PASS：life persists/evolves |
| softie | `npm ci --prefix apps/softie`; `npm run dev --prefix apps/softie` | `npm test`; `npm run build` | 91/91、build 通过 |
| juling | `IRIDESCENTLY_ENVIRONMENT=development PORT=5177 node server.js` | 浏览器/API 冒烟 | 未在本次 Windows 运行 |
| slay | `npm install --prefix apps/slay`; `npm start --prefix apps/slay` | `npm test --prefix apps/slay` | 依赖已安装；仍有 27 个旧断言失败，见排障 |
| world-map | 根依赖 | `npm run check:world-map` | 未在本次运行 |

“未运行”与“失败”是不同状态；PR/Issue 中必须保留实际命令和结果，不得将其写成通过。

## 5. 常见报错与处理

| 报错/现象 | 原因 | 处理 |
| --- | --- | --- |
| `Python 3.10` 或模块导入错误 | `python` 命令未指向 `.python-version` 的 3.12 | `uv python find 3.12` 检查解释器；设置 `$env:PYTHON` 后再运行构建和 runtime 脚本 |
| Gallery `source directory is missing or invalid` / 找不到 `ffmpeg` | 未设置 `GALLERY_DIR` 或未安装 FFmpeg | 按第 2 节生成临时占位 PNG 并设置 `GALLERY_DIR`；安装 FFmpeg 并确认 `ffmpeg -version` 成功 |
| `readiness marker` 拒绝启动 | storage root 或环境不匹配 | 使用 `IRIDESCENTLY_ENVIRONMENT=development` 初始化，禁止手改 marker |
| 端口已占用 | 旧的 Portal、Vite 或上游服务仍在运行 | `netstat -ano | findstr :8080`；停止自己启动的进程后重试 |
| local smoke 中 `/api/official/characters`、`/api/assets/manifest` 断连 | 空 development storage 未提供 `worldview/worldview_luoxiaohei_v4.db`；当前代码以只读 `mode=rw` 打开该库 | 提供本机获准使用的世界观 SQLite 到 development assets 对应位置后再复跑 smoke；不要从 production 拷贝真实用户数据或私有素材 |
| softie WebSocket 测试返回 `Unexpected server response: 403` | 测试连到了已有服务/错误的 `TEST_URL` | 停止冲突服务，启动一个隔离的本地服务，设置 `$env:TEST_URL` 后再跑；不要重复启动服务 |
| Slay `ava is not recognized` | `apps/slay/node_modules` 不完整 | Slay 没有可用 lockfile，执行 `npm install --prefix apps/slay`，再跑 `npm test --prefix apps/slay` |
| Slay `Card not found: Strike/Defend` 或旧状态断言失败 | 当前实现已迁移到中文卡牌和旅途状态；旧测试仍引用上游英文卡牌/旧状态快照 | 这是现有测试与实现的契约漂移；需单独更新测试夹具或恢复兼容层后再验收全套 Slay 测试 |
| Vite 页面大量 404 | 未构建或未封存候选，或打开了错误端口 | 完成 `build:site/build:release/release:seal`，再启动 Portal；单模块调试访问对应 Vite 端口 |
| 会馆图片 404 | 外部世界观库路径未重链 | 按 `docs/operations.md` 的 `relink_db.py` 预演/迁移流程处理，不复制生产库 |

## 6. 实际脱敏日志

本次在 `docs/onboarding-issue-72` 分支执行的摘要如下；没有记录账号、路径中的个人信息、密钥或用户数据：

```text
node --version                         v22.17.0
Python 3.12 interpreter                3.12.14
Python 3.12 services/platform/tests/verify_portal.py 238/238 passed
npm test --prefix apps/cards           64 tests passed
npm run check:game --prefix apps/cards passed
npm test --prefix apps/management     6 tests passed
npm run build --prefix apps/management built
npm test --prefix apps/ecology        7 tests passed
npm run build --prefix apps/ecology   built
npm test --prefix apps/aeon            ALL PASS; LIFE PERSISTS / EVOLUTION / POPULATION STABLE
npm test --prefix apps/softie          91 tests passed (temporary test storage)
npm run build --prefix apps/softie     built
npm install --prefix apps/slay         dependencies installed
npm test --prefix apps/slay            27 existing assertion failures remain
npm run build:site                     built with temporary GALLERY_DIR placeholder
npm run build:release                  built all module/homepage candidates
npm run release:seal                   sealed development Release
local-runtime.py start                 5/5 services healthy on 8080/5174/5178/5177/4173
python tools/checks/local-smoke.py     45/51; 6 hall worldview DB requests closed
```

完整 Portal Release 已构建、封存并实际启动。启动时先按授权停止了占用 8080、5174、5177、5178、4173 的旧 runtime 进程。当前五项服务保持运行；`local-smoke.py` 的 6 个失败均为临时 development storage 缺少世界观 SQLite，不是 Portal 路由或 Host/Origin 检查失败。
