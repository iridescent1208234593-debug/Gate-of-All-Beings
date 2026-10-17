# 主站 / 西木会馆加载审查（2026-10-16）

本轮仅修改源码供本地验收，不提交、不推送、不发布、不重启现有正式服务。

## 测量边界

- 审查时间：2026-10-16 21:55–22:14（Asia/Singapore）。
- `127.0.0.1:8080` 由现有正式 portal 进程处理。直连测量使用真实 Host 和 `X-Forwarded-Proto: https`，避免 HTTPS 重定向；没有修改该进程或发布快照。
- 公网测量使用 `curl --compressed`；下表的 bytes 是传输字节，资源源码体积另列。单次请求受 DNS、链路和边缘缓存影响，不能当作所有用户的平均值或浏览器完整首屏耗时。
- 现有正式会馆读取 `.releases/production/site/portal/huiguan`。该快照的 `index.html` / `homepage.js` 与当前工作源码不同，gate-scene bundle 相同；主站生成首页仍来自 `portal/www/index.html` / `assets/homepage`。本地源码改动不等于线上已优化。

| 请求 | TTFB | 总时间 | bytes / 结果 |
| --- | ---: | ---: | --- |
| 本机会馆 HTML | 17 ms | 19 ms | 217,685 / 200 |
| 本机 gate-scene | 17 ms | 22 ms | 607,178 / 200 |
| 本机 homepage.js | 15 ms | 18 ms | 19,079 / 200 |
| 本机 `/api/user`（匿名） | 17 ms | 19 ms | 20 / 200 |
| 公网会馆 HTML（第一次） | 1.98 s | 15.52 s | 65,298 / 200 |
| 公网共享导航（第一次） | 11.00 s | 11.00 s | 4,049 / 200 |
| 公网 gate-scene（直连复测） | 0.63 s | 0.87 s | 160,122 / 200 |
| 公网 homepage.js（直连复测） | 2.13 s | 2.28 s | 5,599 / 200 |
| 公网共享导航（直连复测） | 0.61 s | 0.61 s | 4,049 / 200 |
| 主站 HTML（复测） | 2.06 s | 2.06 s | 3,482 / 200 |
| 主站 Gallery bundle（直连复测） | 1.01 s | 1.61 s | 187,674 / 200 |

同轮请求还出现过连接重置和 502，之后复测相同站点成功。可以确认链路波动，不能仅由 HTTP 探测区分本地出口、Tunnel、边缘或源站的全部贡献；本轮没有调整网络服务。

## “正在点亮众生之门”为什么长

源码链路：

`HTML / CSS → 表单脚本 → 跨域 shared-chrome → intro-controls → gate-scene → homepage-chrome → homepage-content → homepage.js → createScene → 一个 RAF → 隐藏 #homeBoot → 真正播放开场`。

`#homeBoot` 的文字在 `homepage.js` 的 `ready()` 才移除。原来的导航是普通阻塞脚本，且排在 gate 内核之前；即使只是 4 KB 的跨域导航响应慢，也会延后门景初始化。gate 包还有约 607 KB 原始 JS / 160 KB 压缩下载，以及同步 SVG 解析、挤出几何、首帧渲染成本。没有给 CPU 构建成本编造测量数字；需结合浏览器 trace 进一步分离。

这段等待不由 `/api/user`、官方/同人 API 或字体完成控制：请求异步开始，`ready()` 不 await 它们。会馆没有远程字体加载前置条件。媒体时间轴完整为 6 秒，首次播放到门完整展开约 3.67 秒后收束 1.05 秒；文字等待发生在该播放之前。因此直接缩短开场时间轴不能解决问题。

非 WebGL 分支原先先 `video.load()` 再监听 `loadeddata/error`，且没有超时出口：缓存事件竞态或缓冲停顿也可能让遮罩一直存在。fallback MP4 为 389,882 bytes，并非首屏默认会下载的大视频。

## 已实施的窄修改

1. `portal/huiguan/index.html` 在 head 预加载与实际 script 完全相同的 intro、gate-scene、homepage.js URL。
2. core 的执行顺序调整为 intro → gate-scene → homepage.js，再加载导航 / chrome / 内容；播放器、模型时间轴和布局规则未改。导航和档案请求不再是开场 ready 的必要先决条件。
3. `portal/huiguan/homepage.js` 的 ready 改为幂等。fallback 先监听再 load，最多等待 8 秒，失败/超时进入可浏览状态；后到的加载事件不会重新播放或复位页面。pagehide 清理 timeout。
4. `homepage.js` 的资源版本为 `20261016-1`，preload 与 script 一致，避免重复请求及旧缓存。

## 主站首屏发现

- 当前生成首页主 JS 为 769,574 bytes 原始大小，复测压缩约 187,674 bytes。Three、调试面板与 384 张 manifest 在单入口中；没有把 384 张图片全部同时下载。
- `GalleryResources` 只保留附近约 7 张纹理、2 个并发请求；loading 在首张 texture 到达时结束，不等待 Worker palette 或整库完成。该边界正确，本轮未改动 Gallery 核心。
- 第一张原图 PNG 为 800,348 bytes，后续才缩至最长边 1,536：Canvas 缩尺寸能省 GPU，但不会减少首张网络下载量。
- `music-player.js` 导入早于 Gallery 启动，`loadTrack(0)` 会 `audio.load()` 并尝试 `play()`，默认曲目约 4.8 MB。`preload="metadata"` 不会限制真正播放请求的网络需求，可能与首张图竞争。用户已有默认播放要求，本轮没有把它悄悄改成需手动播放。
- 站点状态、会话和语言脚本不被 Gallery init await；它们不是阻止第一张 texture 出现的硬门槛。

后续最有价值的性能工作：先用浏览器 waterfall 测冷缓存首张纹理和音乐竞争；如确认显著，允许音乐在第一张贺图 ready 后开始同一次自动播放尝试。再评估保留原图校验、另生成首屏派生图的方案。调试面板动态加载可以减少生产首屏 JS，但需要单独验证调试入口，未混入本轮。

## 验证记录

- `node --check portal/huiguan/homepage.js`：通过。
- HTMLParser 检查三条 preload 与实际脚本 URL 一致、core 先于共享导航、homepage.js 只初始化一次：通过。
- 依赖复核：`homepage.js` 消费的表单函数和全部必要 DOM 在它之前已定义；`homepage-chrome.js` 只在共享导航插入后整理导航，`homepage-content.js` 通过既有事件连接首页状态，因此都不需要成为门景 ready 的前置脚本。`qc-nav` 的 ResizeObserver 是可选增强，缺少导航时不会阻止初始化。
- 2026-10-17 增加隔离源码 smoke：`python work/qa/zszm-merge-20261017/huiguan-source-smoke.py --port 5196`。`http://127.0.0.1:5196/?chrome_delay=12` 提供实际会馆源码及 gate bundle，仅在测试响应中将共享导航延后 12 秒，并记录 `window.__qaHuiguanBoot` 的遮罩移除 / 导航插入时间；`?chrome_delay=12&fallback=1&video_delay=15` 用实际 MP4 验证 fallback 的 8 秒退出。该服务只监听 loopback、API 返回匿名测试数据、不写正式账户或正式进程。源页、三个 core 脚本、共享导航、fallback MP4 的本地 HTTP smoke 均为 200。
- 本地浏览器验收与本轮集成结果由主任务补充；没有声称已获得线上性能改善。正式快照和线上进程保持原状。

### 2026-10-17 浏览器源码 smoke 结果

- 导航响应人为延后 12 秒：`#homeBoot` 在 **650 ms** 隐藏；导航在 **12,601 ms** 插入，DOMContentLoaded 为 12,764 ms。实际门景正常呈现，控制台 error 列表为空，确认门景 ready 不再等待导航脚本。
- 强制真实 fallback 分支、MP4 响应延后 15 秒：289 ms 已进入 `gate-fallback`，**8,292 ms** 遮罩隐藏，导航 12,263 ms 才插入。页面进入可浏览状态，不等待视频请求结束；这验证了 8 秒有界出口，不能用作默认 WebGL 分支耗时。
- 初次测试发现 gate bundle 的导出为 getter-only，直接覆盖 `hasWebGL` 未生效；测试 harness 随后改为替换可写的 `window.LXHGate` 整体对象，并在可见 QA 面板记录 `fallback-forced` / `gate-fallback-branch` 后重测。没有把那次仍为 WebGL 的结果误报为 fallback 通过。
- 截图与测试服务位于 `work/qa/zszm-merge-20261017/`；该 helper 只为源码 smoke，匿名 API 为隔离数据，不是完整会馆业务验收或公网测速。
