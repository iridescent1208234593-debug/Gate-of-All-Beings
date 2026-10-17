# 众生之门启动性能 harness：交接（2026-10-17）

实施 [规格](../../../../docs/zszm-startup-performance-spec.md)第 4 节第 6 项、第 5 节第 1 步。第二轮按用户补充的范围扩展。用户原话："测量门景出现、可交互、核心资源、字体、图片、音频和 chunk 的实际加载时序，后续优化必须可以量化前后差异。"

本次只做测量，没有优化，没有 publish，没有重启 8080 等服务，没有 push。没有碰 `portal/www/server.py` 和 `server/app/scripts/build-modules.mjs`。

## 改动

- `ops/perf/zszm-startup.mjs`：Playwright + CDP harness。
  - 测冷 / 热缓存，Fast 4G（9 Mbps / 150 ms RTT）+ CPU 4×。
  - **预算指标**：`firstGateFrame`、`jsBeforeFrame`、`crossOriginBlocking`、`onboardingBytes`，另加 `warmHallEnter`，与第 2 节比较。退出码：0 达标，1 超标，2 无法测量。
  - **时间点**：门景首帧、跳过可点、进入可点、点击进入、初始化可交互、门庭可交互。由注入脚本每帧检查一次，同时打 `performance.mark('zszm:*')`。
  - **资源时序**：按 document / js / css / font / image / audio / video / api / other 分组，给出数量、字节、缓存命中、失败、最早开始、最晚结束。每个资源记开始、结束、字节。资源键去掉同源 origin、Vite 哈希和查询串，跨构建可对齐。
  - **固定格式与 diff**：`schema: zszm-startup/v1`，汇总为中位数。`--compare <before.json>` 测完即比较，`--diff <a.json> <b.json>` 只比较两份报告。两者都输出 `*.json` 与 `*.md`。
  - 流程：
    - 冷缓存：新玩家，等"进入"可点后点击，再等初始化可交互、字体就绪、网络静止 1.5 s。
    - 热缓存：同一上下文，已完成资料的游客，点击"进入"到门庭可交互。
  - `/api/*` 用 CDP Fetch 返回匿名游客应答，不访问后端或数据根。不用 Playwright `route`，因为它会关闭 HTTP 缓存。
  - Playwright 复用 `server/app/src/management/node_modules` 中的副本。
- `server/app/src/cards/src/gate/EntryGate.tsx`（第一轮，`8ebbe76`）：加 `performance.mark('gate:first-frame')`。打点在 3D 场景第一次渲染后，或 2D 降级启动时，只记一次。
- `docs/zszm-startup-performance-spec.md`：第 1 节按实测重写；第 4 节第 6 项补用法、格式与口径。仍在"待用户审阅后提交"范围内，**未提交**。

## 命令

```bash
node ops/perf/zszm-startup.mjs --build --runs 3                       # 当前工作树临时构建（不碰 .releases）
node ops/perf/zszm-startup.mjs --build --runs 3 --block-cross-origin  # 跨子域立即失败，只看自身路径，数字稳定
node ops/perf/zszm-startup.mjs --build --compare work/qa/perf/2026-10-17/zszm-startup-build-2026-10-17T05-43-07-453Z.json
node ops/perf/zszm-startup.mjs --diff <before.json> <after.json>
node ops/perf/zszm-startup.mjs                                        # 默认测 .releases/candidate/cards（需含打点）
node ops/perf/zszm-startup.mjs --url http://127.0.0.1:5173/           # 本地 Vite dev，只作相对比较
```

## 基线（3 次中位数，`work/qa/perf/2026-10-17/`）

| 指标 | 真实网络 | 跨子域立即失败 | 预算 |
| --- | ---: | ---: | ---: |
| firstGateFrame（冷） | 2851 ms（2394–4388） | 1649 ms | 2500 ms |
| jsBeforeFrame | 231.7 KB | 221.9 KB | 250 KB |
| crossOriginBlocking | 4 | 4 | 0 |
| onboardingBytes | 15.34 MB | 14.92 MB | 1.5 MB |
| warmHallEnter | 1159 ms | 1201 ms | 1000 ms |
| 进入可点（冷） | 5681 ms | 4490 ms | — |
| 初始化可交互（冷） | 8734 ms | 6265 ms | — |
| 门庭可交互（热） | 6436 ms | — | — |

基线文件：

- `zszm-startup-build-2026-10-17T05-43-07-453Z.{json,md}`：真实网络
- `zszm-startup-build-blocked-2026-10-17T05-45-09-302Z.{json,md}`：跨子域阻断
- `zszm-startup-diff-2026-10-17T05-47-05-283Z.{json,md}`：两者的 diff，演示格式

第一轮的两份报告没有 schema，已从目录删除，`8ebbe76` 中仍可查。那一轮冷首帧中位数为 9.5 s（6.9–10.2 s），与本轮的差异全部来自会馆 / 官网子域的响应时间。

## 发现（未处理，只记录）

1. **门景首帧由 4 个跨子域阻塞请求决定，且随公网波动。**
   - 同日两轮，这 4 个请求最晚分别在 1.1–3.1 s 和 3.0–7.0 s 结束，首帧随之在 2.4 s 到 10.2 s 之间。
   - 跨子域立即失败时，首帧稳定在 1.6 s。
2. **`huiguan.iridescently.xyz/avatar-cropper.css` 和 `.js` 线上返回 404 text/html。**
   - 首字节 4–8 s，浏览器以 ORB 拦截。
   - 404 不进缓存，热缓存每次也要等 0.6–4.5 s。
3. **字体 14.6 MB，占初始化传输的 95%。** 初始化界面出现后才开始下载，约 23 s 才下完。
4. **初始化阶段会加载会馆视频 `luoxiaohei_ep29.mp4`。** 跨源 Range 请求，约 0.4–0.7 MB。
5. **热缓存进入门庭时，图片传输 2.9 MB**，主要是门庭背景 PNG。
6. **没有音频请求。** 问候语用语音合成，不走网络。
7. **场景构建成本：** `gateEmbed` 下载完到首帧约 1.4 s（4× CPU）。

## 回归（第二轮改完后复跑）

| 位置 | 命令 | 结果 |
| --- | --- | --- |
| `server/app/src/cards` | `npx tsc --noEmit` | 通过 |
| `server/app/src/cards` | `npm run check:game` | 通过 |
| `server/app/src/cards` | `npm test` | 22/22 |
| `server/app/src/cards` | `python -m unittest tests/test_gate_identity_scope.py` | 7/7 |
| 项目根 | `PORT=18080 PYTHONIOENCODING=utf-8 npm run test:portal` | 51/51（临时数据根） |

`npm run test:portal` 用默认参数时有两个问题，本次均未改：

- 端口 8080 被正式服务占用，脚本直接 FAIL。
- 一次冷启动超过 25 s 等待上限，打印中文失败信息时又因 cp1252 控制台编码崩溃。

## 后续建议

- 在 `verify_portal.py` 中让默认端口冲突时自动换端口，stdout 用 UTF-8。
- 第 5 节第 3 步先修 avatar-cropper 404：收益最大，也不需要等字体许可。
- 浅滩场景尚未覆盖，第 5 步实施前补一个浅滩阶段。
