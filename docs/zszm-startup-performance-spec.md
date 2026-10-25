# 众生之门启动性能：预算与实施规格（第 1 步已实施）

状态：2026-10-17 设计稿；第 5 节第 1 步（测量 harness 与打点）已实施，基线见第 1 节。前置审查见 [zszm-loading-audit.md](zszm-loading-audit.md)。发布与共享 UI 的长期边界见 [release-architecture-v2.md](release-architecture-v2.md) 第 6 节。

## 1. 现状（2026-10-17 harness 实测基线）

数据来源：`node scripts/run-ops.mjs perf/zszm-startup.mjs --build --runs 3`。把工作树（`31bfe0e` + 首帧打点）临时构建后测量，构建配置与 `.releases/candidate/cards` 相同；现有候选早于打点，无法直接测。

- 条件：冷 / 热缓存，Fast 4G（9 Mbps / 150 ms RTT），CPU 4× 降速，Chrome 155 headless，视口 1440×900。文本资源按 gzip 计。
- 报告：`file:///E:/External%20Projects/Iridescently%20Operations%20Archive/qa/qa/perf/2026-10-17/`。真实网络与 `--block-cross-origin` 各一份，另有两者的 diff。
- 时间均自导航开始，取 3 次中位数。

| 指标（第 2 节口径） | 真实网络 | 跨子域立即失败 | 预算 | 结果 |
| --- | ---: | ---: | ---: | --- |
| 门景首帧（冷） | **2.9 s**（2.4–4.4 s；同日早些时候一轮为 9.5 s，6.9–10.2 s） | 1.6 s | ≤ 2.5 s | 超标，且随子域响应大幅波动 |
| 首帧前传输 JS（冷） | 231.7 KB | 221.9 KB | ≤ 250 KB | 通过，余量 18 KB |
| 首帧前跨子域阻塞请求 | **4** | 4（立即失败） | 0 | 超标 |
| 新玩家到达初始化的总传输 | **15.34 MB** | 14.92 MB | ≤ 1.5 MB | 超标 |
| 老玩家进入门庭（热，点击"进入"到门庭渲染） | 1.16 s | 1.20 s | ≤ 1.0 s | 超标 |

时间点（真实网络，中位数）：

| 时间点 | 冷缓存（新玩家） | 热缓存（老玩家） |
| --- | ---: | ---: |
| 跳过可点 | 2.1 s | 1.9 s |
| 门景首帧 | 2.9 s | 2.4 s |
| 进入可点（场景播到开门） | 5.7 s | 5.2 s |
| 初始化可交互 | 8.7 s | — |
| 门庭可交互 | — | 6.4 s |

按类型（冷缓存，真实网络，到初始化可交互且网络静止）：

| 类型 | 数量 | 传输 | 时间范围 |
| --- | ---: | ---: | --- |
| JS | 6 | 262 KB | 0.2–6.6 s |
| CSS | 4 | 19 KB | 0.2–6.6 s |
| 字体 | 3 | **14.6 MB** | 6.9–22.8 s |
| 图片 | 47 | 418 KB | 1.9–18.2 s |
| 视频 | 1 | 382 KB | 6.5–8.9 s |
| 音频 | 0 | — | — |

视频是会馆的 `luoxiaohei_ep29.mp4`，按 Range 分段请求。热缓存进入门庭时，图片传输 2.9 MB，主要是门庭背景 PNG。

| 资源 | 原始 / 传输 | 何时加载 | 实测问题 |
| --- | ---: | --- | --- |
| `index-*.js`（入口） | 223 KB / 71 KB | 首屏 | 模块脚本要等阻塞 CSS 完成才执行。执行后还需约 1.2 s（4× CPU）才发起门景 import |
| `gateEmbed-*.js` | 585 KB / 151 KB | 动态 import，门景首帧需要 | 下载约 0.4 s。下载完到首帧约 1.4 s（4× CPU），即场景构建成本 |
| `GameApp-*.js` / `WorldGuide-*.js` | 109 KB / 141 KB | 进入门庭后 | 热缓存下点击"进入"到门庭约 1.2 s |
| `PlayerOnboarding-*.js` | 55 KB / 28 KB | 未完成初始化者 | 可接受 |
| 3 个 TTF 字体 | **14.6 MB**（6.3 + 4.8 + 3.5） | 初始化 CSS 引用；`font-display` 只设了 1 个 | 占初始化总传输的 95%。字体在初始化界面出现后才开始下载，结束约在 23 s |
| `shore-background.png` / `deep-forest-moss.png` | 1.5 MB / 1.4 MB | 浅滩 / 门庭场景 | 未转码、未分尺寸（harness 尚未覆盖浅滩） |
| 跨子域阻塞资源 | — | `<head>` 中会馆 `design-system.css`、`avatar-cropper.css`；`<body>` 中同步的 `site-language.js`、`avatar-cropper.js` | 两轮实测中，这 4 个请求最晚分别在 1.1–3.1 s 和 3.0–7.0 s 后结束，门景首帧随之在 2.4 s 到 10.2 s 间波动。**`huiguan.iridescently.xyz/avatar-cropper.css` 与 `.js` 返回 404 HTML**，TTFB 4–8 s，被浏览器以 ORB 拦截。404 不进缓存，所以热缓存也要等 0.6–4.5 s |

候选总计 71 个文件、22 MB。

## 2. 预算（验收口径）

| 指标 | 条件 | 预算 |
| --- | --- | --- |
| 门景首帧（首个可见场景帧） | 冷缓存、Fast 4G（约 9 Mbps / 150 ms RTT）、中端 CPU 4× 降速 | ≤ 2.5 s |
| 首帧前传输 JS | 压缩后 | ≤ 250 KB |
| 首帧前的跨子域阻塞请求 | — | **0** |
| 新玩家到达初始化可交互的总传输 | 含字体 | ≤ 1.5 MB |
| 老玩家（已完成资料）进入门庭 | 热缓存 | ≤ 1.0 s |
| 任一单个外部请求失败或超时 | — | 不阻止进入门庭 |

## 3. 启动阶段规格（谁能阻塞谁）

```
P0 HTML + 入口 JS + 同源关键 CSS          → 只允许阻塞到此
P1 门景运行时 + 场景数据（并行预取）       → 首帧
P2 玩家资料 /api/gate/identity（与 P1 并行，已实现） → 决定进入初始化 / 门庭
P3 初始化：字体、头像清单、种族媒体（仅在需要时）
P4 门庭模式清单、各模式 chunk（hover / 视口内预取）
后台：语言切换、头像裁切器、共享导航、统计
```

规则：

- P0–P1 不得依赖任何跨子域资源，也不得等待网络 API。
- P3 / P4 的资源在 P2 结果明确后才请求。
- 任何外部请求都必须有超时和降级出口。

## 4. 实施项

1. **字体（收益最大）**：
   - 转为 woff2，所有 `@font-face` 设 `font-display: swap`。
   - 展示用字体（标题、手写）按初始化界面实际出现的字符做静态子集，在构建脚本中从 `onboarding/*.js` 的文案提取字符集。
   - 用户输入字体（`GateOnboardingInput`）不做全量 CJK 下载：默认用系统字体，选做"已输入字符的按需子集"服务。后者是独立后端接口，可放进第 6 节的设计系统后端。
   - **许可**：3 个字体的授权需先确认（造字工房 / 字魂类字体通常限制 web 嵌入与子集分发）。未确认前不得上公网。
2. **门景运行时拆分**：
   - `gateEmbed` 拆成运行时与场景数据（SVG / 几何）。
   - 场景数据预计算为二进制或 JSON，在 HTML 中 `modulepreload` / `preload`。
   - 测量 CPU 端 SVG 解析与挤出几何的成本。若主导，改为构建期生成几何。
3. **去掉跨子域关键路径**：
   - `avatar-cropper.*` 改为身份编辑器打开时动态加载。
   - `site-language.js` 改为 `defer`，或由 `ui` 组件提供同源版本。
   - `design-system.css` 中首屏实际需要的部分内联或同源化。长期由 `ui` 组件提供带哈希的同源 URL（release-architecture-v2 第 4 阶段）。
4. **图片**：
   - 浅滩背景、森林苔藓转 AVIF / WebP，并提供 2–3 个宽度（`image-set` / `srcset`）。
   - 种族头像合成雪碧图或保持小 PNG，按视口加载。
5. **模式 chunk 预取**：门庭对卡片在 hover 或进入视口时 `import()` 预取；不在首屏预取全部模式。
6. **测量 harness**：
   - 性能工具保存在外部运维项目 `E:\External Projects\Iridescently Operations\perf\zszm-startup.mjs`：Playwright + Chrome DevTools Protocol，冷 / 热缓存、网络与 CPU 节流。
   - 输出 `{firstGateFrame, jsBeforeFrame, crossOriginBlocking, onboardingBytes}`，与第 2 节预算比较，超标即非零退出。
   - 报告写入 `file:///E:/External%20Projects/Iridescently%20Operations%20Archive/qa/qa/perf/%3Cdate%3E/`。门景用 `performance.mark('gate:first-frame')` 打点，作为唯一首帧口径。
   - 已实现（2026-10-17）。用法：`node scripts/run-ops.mjs perf/zszm-startup.mjs [--dist <dir> | --build | --url <url>] [--runs 3] [--block-cross-origin] [--compare <before.json>]`；只比较两份报告用 `--diff <before.json> <after.json>`。默认测 `.releases/candidate/cards`。退出码：0 全部达标，1 有超标，2 无法测量（例如构建没有打点）。
   - 报告格式固定（`schema: zszm-startup/v1`），取各次运行的中位数：
     - `summary.metrics`：五个预算指标。
     - `summary.milestones`：冷 / 热缓存的时间点，含 `firstGateFrame`、`skipClickable`、`enterClickable`、`enterClicked`、`onboardingInteractive`、`hallInteractive`。
     - `summary.groups`：按 document / js / css / font / image / audio / video / api / other 分组的数量、字节、缓存命中、失败、最早开始、最晚结束。
     - `summary.resources`：每个资源的开始、结束、字节。键去掉同源 origin、Vite 文件哈希和查询串，跨构建可对齐。
     - diff 输出指标、时间点、分组的前后差值。资源列出新增、移除，以及传输变化 ≥ 1 KB 或结束时间变化 ≥ 250 ms 的项。
   - 口径：
     - `firstGateFrame`：打点时间。打点在 3D 场景第一次渲染后，或 2D 降级启动时。等待运行时期间显示的 2D 占位在 t=0 时是空白，不计。
     - 交互时间点：注入脚本每帧检查一次，按钮可见且未禁用、输入框可见、门庭主区可见时记录。
     - `jsBeforeFrame`：首帧前发起的 Script 请求的传输字节，含跨源。
     - `crossOriginBlocking`：首帧前发起的跨源请求中，属于初始 HTML 同步 stylesheet / 经典同步脚本或 `renderBlockingStatus = blocking` 的个数。
     - `onboardingBytes`：冷启动从导航开始，经点击"进入"，到初始化可交互、字体就绪、网络静止 1.5 s 的全部传输。
     - `warmHallEnter`：热缓存下已完成资料的游客，从点击"进入"到门庭可交互。
   - 跨子域走真实公网，单轮波动很大（门景首帧同日测得 2.4–10.2 s）。比较前后差异时，同时看 `--block-cross-origin` 的结果：它只反映自身路径，数字稳定。
   - `/api/*` 由 harness 用 CDP Fetch 返回匿名游客应答，不访问后端或数据根。不用 Playwright route，因为它会关闭 HTTP 缓存。`--block-cross-origin` 模式下所有请求都经拦截，热缓存数字不可用。

## 5. 实施顺序与验收

| 顺序 | 项 | 验收 |
| --- | --- | --- |
| 1 | 测量 harness 与打点 | 能复现现状数字，作为基线并存档 |
| 2 | 字体（许可确认后） | 初始化总传输 ≤ 1.5 MB；无不可见文字闪烁超过 3 s |
| 3 | 跨子域关键路径清零 | harness 报告 `crossOriginBlocking = 0`；任一子域 10 s 延迟不影响门景首帧 |
| 4 | 门景拆分与预取 | 门景首帧 ≤ 2.5 s（第 2 节条件） |
| 5 | 图片与模式预取 | 浅滩 / 门庭进入时间不回退，传输减少 |

每一步都要回归：

- `npm run check:game`、`npm test`、初始化 2/2、身份 7/7、`npm run test:portal`；
- 5195 浏览器流程：开场 → 初始化 → 门庭 → 浅滩 → 返回。

## 6. 与设计系统后端的关系

- 字体子集、token、共享控件属于设计系统职责。规格中的"按需子集服务"和"同源 `ui` 资源"应作为设计系统后端 / `ui` 组件的能力实现，众生之门只消费，不在 Cards 内另造一套。
- 在后端接入之前，第 1–5 步都能独立完成。第 2、3 步的产物（woff2 子集、同源资源）后续可以原样迁入 `ui` 组件。
