# 官方角色搜索与分页回归（#87）

范围是 `apps/huiguan/gallery.html` 和首页 `homepage-content.js` 的官方角色列表。
修复基于 `fc52b23`，保留 `/api/official/characters` 的筛选、排序和响应契约，
不变更身份、数据库、素材、存档或生产配置。

## 已复现与修复

| 操作 | 修复前 | 修复后 |
| --- | --- | --- |
| 慢搜索未结束时输入另一关键词或切换筛选 | 画廊的 `loading` 提前返回，丢弃新查询 | 立即取消旧请求，并用查询代次拒绝过期响应 |
| 追加页面期间修改搜索输入 | 防抖期间旧响应仍可能渲染；旧分页按钮还能使用 | 输入变化就使旧查询失效，清空旧结果并隐藏旧分页入口 |
| 第 2 页网络失败后重试 | 画廊请求第 3 页；首页还会清空已有列表 | 已有列表保留，重试仍请求第 2 页 |
| 画廊第 2 页返回 HTTP 503 | 被当作空列表，隐藏分页入口 | 检查 HTTP 状态，保留当前页并显示重试文案 |
| 画廊连点“加载更多” | 未发出请求的点击也递增页码，后续跳页 | 请求期间禁用并检查加载状态，成功后才推进页码 |

首页脚本引用版本同步更新。账户、私人角色和同人列表继续使用原有逻辑。

## 复现命令

安装根依赖并准备 Playwright Chromium 后，从仓库根目录运行：

```sh
node --test apps/huiguan/tests/official-gallery-browser.cjs
python -X utf8 apps/huiguan/tests/test_official_gallery_pagination_http.py
node apps/huiguan/tests/gallery-attr-escape.cjs
```

新增浏览器检查已接入 `python tools/checks/regression.py --full`。
若使用已有 Chromium/Edge，可为新增检查设置 `CHROMIUM_EXECUTABLE`，例如 PowerShell 7：

```powershell
$env:CHROMIUM_EXECUTABLE = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node --test apps/huiguan/tests/official-gallery-browser.cjs
```

测试拦截所有请求，只读取受检页面及脚本，阻止外站请求及 Service Worker。
首页保留真实 DOM 和内联 CSS，只执行受检内容脚本；画廊运行真实列表脚本和反应组件。
账户、其他 API、私有图片和其他脚本均用替身，不访问真实数据或运行中的站点。
HTTP 测试另外使用随机本机端口、临时 `test` 存储和虚构 SQLite 验证实际服务端排序与分页。
退出前关闭服务器和日志，避免 Windows 临时日志文件占用导致清理失败。

## 2026-11-26 本机结果与测量边界

Windows、Node 24.22.3、Python 3.14.6、本机 Edge headless；不是项目要求的 Node 22 / Python 3.12 CI 环境。
新增浏览器检查 25/25 通过：慢请求交错、防抖、筛选组合、HTTP/网络失败重试、连点、空结果和清空搜索。
既有属性转义浏览器回归、HTTP 分页测试、3 项档案结构测试和受影响 JavaScript/Python 语法检查通过。
额外尝试的 `test_original_image_access.py` 因本机 Python 缺少 Pillow（`PIL`）未能启动，不计为通过。

| 页面 | 虚构条目数 | 视口 | 首批 DOM 卡片 | 追加一页后 | 列表请求数 |
| --- | --- | --- | --- | --- | --- |
| 官方画廊 | 100 / 1000 / 5000 | 390×900、1280×900 | 30 | 60 | 2 |
| 首页官方栏 | 100 / 1000 / 5000 | 390×900、1280×900 | 24 | 48 | 2 |

一次通过运行中，画廊首批渲染为 344–410 ms、追加为 146–213 ms；首页为 333–459 ms、103–209 ms。
计时从测试端导航/点击开始，到目标卡片数量和可操作按钮就绪；每次运行输出原始 JSON 诊断。
这些是单次、无真实图片、API 拦截环境中的可重复测量方法，包含测试驱动开销。
不代表生产网络、真实设备、完整首页或缓存性能，不宣称修复带来了加载速度提升。
本次修复目标是查询一致性与可靠翻页；完整页面的真实素材、网络瀑布和性能优化仍需独立测量。
未运行全仓构建或全量回归：本机未安装仓库各模块依赖，本次改动是直接提供的 HTML/JS。
