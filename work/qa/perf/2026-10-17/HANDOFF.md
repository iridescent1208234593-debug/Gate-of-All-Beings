# 众生之门启动性能 harness：交接（2026-10-17）

实施 [规格](../../../../docs/zszm-startup-performance-spec.md)第 4 节第 6 项、第 5 节第 1 步。本次只做测量，没有优化，没有 publish，没有重启 8080 等服务，没有 push。

## 改动

- 新增 `ops/perf/zszm-startup.mjs`：Playwright + CDP harness。
  - 测冷 / 热缓存，Fast 4G（9 Mbps / 150 ms RTT）+ CPU 4×。
  - 输出 `{firstGateFrame, jsBeforeFrame, crossOriginBlocking, onboardingBytes}`，另测 `warmHallEnter`，与第 2 节预算比较。
  - 退出码：0 达标，1 超标，2 无法测量。报告写入 `work/qa/perf/<date>/`（JSON + MD）。
  - Playwright 复用 `server/app/src/management/node_modules` 里的副本，没有新增根依赖。
- `server/app/src/cards/src/gate/EntryGate.tsx`：加 `performance.mark('gate:first-frame')`。
  - 打点时机：3D 场景第一次渲染后（`onFrame` 在 `renderer.render` 之后调用），或 2D 降级启动时。只记一次，StrictMode 重复挂载不会重复记。
  - 不在 `gateEmbed.ts` 打点：运行时加载期间显示的 2D 占位在 t=0 时所有图层透明，不算可见首帧。
- `docs/zszm-startup-performance-spec.md`：
  - 第 1 节现状表按实测重写。
  - 第 4 节第 6 项补用法与口径。
  - 该文件仍在"待用户审阅后提交"范围内，**本次提交不含它**。

## 命令

```bash
node ops/perf/zszm-startup.mjs --build --runs 3                       # 当前工作树临时构建（不碰 .releases）
node ops/perf/zszm-startup.mjs --build --runs 3 --block-cross-origin  # 跨子域立即失败
node ops/perf/zszm-startup.mjs                                        # 默认测 .releases/candidate/cards
node ops/perf/zszm-startup.mjs --url http://127.0.0.1:5173/           # 本地 Vite dev（未打包，只作相对比较）
```

`/api/*` 由 harness 用 CDP Fetch 返回匿名游客应答，不启动、不访问门户 / 会馆，也不碰数据根。不用 Playwright `route`，因为它会关闭 HTTP 缓存，第一版热缓存因此 0 命中，已修正。

## 基线（3 次中位数）

| 指标 | 实测 | 预算 |
| --- | ---: | ---: |
| firstGateFrame（冷） | 9541 ms（6919–10198） | 2500 ms ✗ |
| jsBeforeFrame（冷） | 231.8 KB | 250 KB ✓ |
| crossOriginBlocking | 4 | 0 ✗ |
| onboardingBytes | 14.97 MB | 1.5 MB ✗ |
| warmHallEnter | 2478 ms | 1000 ms ✗ |
| firstGateFrame（冷，跨子域阻断） | 1640 ms | 2500 ms ✓ |

报告文件：

- `zszm-startup-build-2026-10-17T05-24-59-724Z.{json,md}`：真实网络
- `zszm-startup-build-2026-10-17T05-26-34-784Z.{json,md}`：`--block-cross-origin`

## 发现（未处理，只记录）

1. 冷启动首帧几乎完全由 4 个跨子域阻塞请求决定。它们在 3.0–7.0 s 后才结束。跨子域请求立即失败时，首帧是 1.6 s。
2. `https://huiguan.iridescently.xyz/avatar-cropper.css` 和 `.js` 线上返回 **404 text/html**，TTFB 4–8 s，被浏览器以 `ERR_BLOCKED_BY_ORB` 拦截。404 不进缓存，所以热缓存每次也要等 1–4.5 s。这是规格第 4 节第 3 项的直接证据。
3. 3 个 TTF 共 14.6 MB，占初始化传输的 97%。
4. `gateEmbed` 下载完到首帧约 1.4 s（4× CPU），即场景构建成本。这是第 4 节第 2 项要测的数据。
5. 现有 `.releases/candidate/cards` 早于打点，harness 会报"没有打点"并以 2 退出。下次正式构建候选后才能直接测候选。

## 回归

| 位置 | 命令 | 结果 |
| --- | --- | --- |
| `server/app/src/cards` | `npx tsc --noEmit` | 通过 |
| `server/app/src/cards` | `npm run check:game` | 通过 |
| `server/app/src/cards` | `npm test` | 22/22 |
| `server/app/src/cards` | `python -m unittest tests/test_gate_identity_scope.py` | 7/7 |
| 项目根 | `npm run test:portal` | 51/51（临时数据根），需要 `PORT=18080 PYTHONIOENCODING=utf-8` |

`npm run test:portal` 的两个问题：

- 默认端口 8080 被正式服务占用，脚本直接 FAIL。
- 一次冷启动超过 25 s 等待上限，打印中文失败信息时又因 cp1252 控制台编码崩溃。
- 两者都属于 `verify_portal.py`，本次未改，列为后续项。

## 后续建议

- 在 `verify_portal.py` 中处理两点：默认端口与 8080 冲突时自动换端口；stdout 用 UTF-8。
- 规格第 5 节第 3 步（跨子域清零）可以先修 avatar-cropper 404。这样收益最大，也不需要等字体许可。
- harness 尚未覆盖浅滩 / 门庭场景图片，第 5 步实施前补测。
