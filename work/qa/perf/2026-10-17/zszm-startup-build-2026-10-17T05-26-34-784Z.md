# 众生之门启动性能报告

- 时间：2026-10-17T05:26:34.784Z
- 目标：build `working tree (temporary build)`
- 条件：Fast 4G（9 Mbps 下行 / 150 ms RTT），CPU 4× 降速；chrome 155.0.8059.84 headless；视口 1440×900；3 次取中位数；跨子域请求被阻断
- 首帧口径：`performance.mark('gate:first-frame')`；/api/* 由 harness 返回匿名游客应答

| 指标 | 条件 | 实测 | 预算 | 结果 |
| --- | --- | ---: | ---: | --- |
| firstGateFrame | cold | 1640 ms | 2500 ms | 通过 |
| jsBeforeFrame | cold | 221.9 KB | 250.0 KB | 通过 |
| crossOriginBlocking | cold | 4 | 0 | **超标** |
| onboardingBytes | cold | 14.92 MB | 1.50 MB | **超标** |
| warmHallEnter | warm | 2446 ms | 1000 ms | **超标** |

热缓存门景首帧 3531 ms，热缓存首帧前 JS 0.0 KB，热缓存跨子域阻塞 4。

## 每次运行

| # | 冷首帧 | 冷首帧前 JS | 跨子域阻塞 | 初始化可交互 | 初始化总传输 | 热首帧 | 热进入门庭 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1537 ms | 221.9 KB | 4 | 2660 ms | 14.92 MB | 3284 ms | 2446 ms |
| 2 | 1668 ms | 221.9 KB | 4 | 2894 ms | 14.92 MB | 3637 ms | 2320 ms |
| 3 | 1640 ms | 221.9 KB | 4 | 2800 ms | 14.92 MB | 3531 ms | 2661 ms |

## 首帧前的跨子域阻塞请求（第 1 次运行）

- https://huiguan.iridescently.xyz/design-system/design-system.css?v=3（Stylesheet，197–214 ms，失败：net::ERR_CONNECTION_REFUSED）
- https://huiguan.iridescently.xyz/avatar-cropper.css（Stylesheet，199–214 ms，失败：net::ERR_CONNECTION_REFUSED）
- https://iridescently.xyz/assets/site-language.js?v=20261016-1（Script，201–221 ms，失败：net::ERR_CONNECTION_REFUSED）
- https://huiguan.iridescently.xyz/avatar-cropper.js（Script，201–221 ms，失败：net::ERR_CONNECTION_REFUSED）

## 首帧前 JS（第 1 次运行）

- /app/modules/cards/assets/index-9oBtH63S.js：71.1 KB（199–467 ms）
- https://iridescently.xyz/assets/site-language.js?v=20261016-1：0.0 KB（201–221 ms）
- https://huiguan.iridescently.xyz/avatar-cropper.js：0.0 KB（201–221 ms）
- /app/modules/cards/assets/gateEmbed-RmRpmvVW.js：150.8 KB（828–1146 ms）

## 冷启动最大的传输（第 1 次运行）

- /app/modules/cards/assets/zihun-wennuan-B1VR6L0X.ttf：6345.5 KB
- /app/modules/cards/assets/zaozi-puyue-CGMRCdZK.ttf：4833.0 KB
- /app/modules/cards/assets/font-CCGU7_6s.ttf：3450.9 KB
- /app/modules/cards/assets/gateEmbed-RmRpmvVW.js：150.8 KB
- /app/modules/cards/assets/index-9oBtH63S.js：71.1 KB
- /app/modules/cards/assets/PlayerOnboarding-RN6aomva.js：28.4 KB
- /app/modules/cards/assets/r10-EelRZX1C.png：22.8 KB
- /app/modules/cards/assets/r18-B3MF4bVK.png：20.7 KB
- /app/modules/cards/assets/r11-CUlh3Q_M.png：11.7 KB
- /app/modules/cards/assets/r05-6b8kx777.png：10.9 KB
- /app/modules/cards/assets/r06-C57tJp-Z.png：10.9 KB
- /app/modules/cards/assets/r22-Crg8IArx.png：10.8 KB
