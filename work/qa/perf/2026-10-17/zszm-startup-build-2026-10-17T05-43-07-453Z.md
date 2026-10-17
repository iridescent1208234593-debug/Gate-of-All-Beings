# 众生之门启动性能报告

- schema：`zszm-startup/v1`
- 时间：2026-10-17T05:45:09.117Z
- 目标：build `working tree (temporary build)`
- 条件：Fast 4G（9 Mbps 下行 / 150 ms RTT），CPU 4× 降速；chrome 155.0.8059.84 headless；视口 1440×900；3 次取中位数
- 口径：时间均自导航开始；首帧为 `performance.mark('gate:first-frame')`；/api/* 由 harness 返回匿名游客应答

## 预算

| 指标 | 条件 | 实测 | 预算 | 结果 |
| --- | --- | ---: | ---: | --- |
| firstGateFrame | cold | 2851 ms | 2500 ms | **超标** |
| jsBeforeFrame | cold | 231.7 KB | 250.0 KB | 通过 |
| crossOriginBlocking | cold | 4 | 0 | **超标** |
| onboardingBytes | cold | 15.34 MB | 1.50 MB | **超标** |
| warmHallEnter | warm | 1159 ms | 1000 ms | **超标** |

## 时间点

| 时间点 | 冷缓存（新玩家） | 热缓存（老玩家） |
| --- | ---: | ---: |
| 门景首帧 `firstGateFrame` | 2851 ms | 2380 ms |
| 跳过可点 `skipClickable` | 2098 ms | 1882 ms |
| 进入可点 `enterClickable` | 5681 ms | 5208 ms |
| 点击进入 `enterClicked` | 6334 ms | 5467 ms |
| 初始化可交互 `onboardingInteractive` | 8734 ms | — |
| 门庭可交互 `hallInteractive` | — | 6436 ms |

## 按类型分组（冷缓存，到初始化可交互且网络静止）

| 类型 | 请求 | 传输 | 缓存命中 | 失败 | 最早开始 | 最晚结束 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| document | 1 | 1.1 KB | 0 | 0 | 1 ms | 182 ms |
| js | 6 | 262.3 KB | 0 | 1 | 204 ms | 6594 ms |
| css | 4 | 19.2 KB | 0 | 1 | 201 ms | 6553 ms |
| font | 3 | 14629.4 KB | 0 | 0 | 6932 ms | 22806 ms |
| image | 47 | 417.8 KB | 0 | 0 | 1856 ms | 18238 ms |
| video | 1 | 381.5 KB | 0 | 0 | 6544 ms | 8871 ms |
| api | 2 | 0.2 KB | 0 | 0 | 2111 ms | 2116 ms |

## 按类型分组（热缓存，到门庭可交互且网络静止）

| 类型 | 请求 | 传输 | 缓存命中 | 失败 | 最早开始 | 最晚结束 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| document | 1 | 1.1 KB | 0 | 0 | 0 ms | 177 ms |
| js | 8 | 37.1 KB | 4 | 1 | 199 ms | 6312 ms |
| css | 5 | 11.5 KB | 2 | 1 | 196 ms | 6311 ms |
| image | 3 | 2866.6 KB | 1 | 0 | 1623 ms | 9392 ms |
| video | 1 | 0.0 KB | 1 | 0 | 5548 ms | 5550 ms |
| api | 3 | 0.4 KB | 0 | 0 | 1899 ms | 6266 ms |

## 每次运行

| # | 冷首帧 | 进入可点 | 初始化可交互 | 首帧前 JS | 跨子域阻塞 | 冷总传输 | 热首帧 | 热进入门庭 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2851 ms | 5681 ms | 7424 ms | 231.8 KB | 4 | 15.25 MB | 2380 ms | 969 ms |
| 2 | 2394 ms | 5429 ms | 8937 ms | 231.7 KB | 4 | 15.34 MB | 4179 ms | 4397 ms |
| 3 | 4388 ms | 7253 ms | 8734 ms | 231.7 KB | 4 | 15.34 MB | 1756 ms | 1159 ms |

## 首帧前的跨子域阻塞请求（第 1 次运行）

- https://huiguan.iridescently.xyz/design-system/design-system.css?v=3（Stylesheet，201–912 ms，HTTP 200，4.0 KB）
- https://huiguan.iridescently.xyz/avatar-cropper.css（Stylesheet，203–1261 ms，失败：net::ERR_BLOCKED_BY_ORB）
- https://iridescently.xyz/assets/site-language.js?v=20261016-1（Script，205–1628 ms，HTTP 200，9.9 KB）
- https://huiguan.iridescently.xyz/avatar-cropper.js（Script，206–1706 ms，失败：net::ERR_BLOCKED_BY_ORB）

## 资源时序（冷缓存，中位数）

| 类型 | 资源 | 开始 | 结束 | 传输 | 备注 |
| --- | --- | ---: | ---: | ---: | --- |
| document | `/` | 1 ms | 182 ms | 1.1 KB |  |
| js | `/app/modules/cards/assets/index.js` | 204 ms | 475 ms | 71.1 KB |  |
| js | `https://iridescently.xyz/assets/site-language.js` | 205 ms | 1628 ms | 9.9 KB |  |
| js | `https://huiguan.iridescently.xyz/avatar-cropper.js` | 206 ms | 1706 ms | 0.0 KB | 失败 net::ERR_BLOCKED_BY_ORB |
| js | `/app/modules/cards/assets/gateEmbed.js` | 2116 ms | 2426 ms | 150.8 KB |  |
| js | `/app/modules/cards/assets/PlayerOnboarding.js` | 6353 ms | 6594 ms | 28.4 KB |  |
| js | `/app/modules/cards/assets/player-avatar.js` | 6371 ms | 6549 ms | 2.1 KB |  |
| css | `https://huiguan.iridescently.xyz/design-system/design-system.css` | 201 ms | 912 ms | 4.0 KB |  |
| css | `https://huiguan.iridescently.xyz/avatar-cropper.css` | 203 ms | 1261 ms | 0.0 KB | 失败 net::ERR_BLOCKED_BY_ORB |
| css | `/app/modules/cards/assets/index.css` | 204 ms | 413 ms | 10.7 KB |  |
| css | `/app/modules/cards/assets/PlayerOnboarding.css` | 6373 ms | 6553 ms | 4.4 KB |  |
| font | `/app/modules/cards/assets/font.ttf` | 6932 ms | 18782 ms | 3450.9 KB |  |
| font | `/app/modules/cards/assets/zaozi-puyue.ttf` | 6937 ms | 21392 ms | 4833.0 KB |  |
| font | `/app/modules/cards/assets/zihun-wennuan.ttf` | 6937 ms | 22806 ms | 6345.5 KB |  |
| image | `https://iridescently.xyz/assets/iridescently-mark.png` | 1856 ms | 3066 ms | 36.2 KB |  |
| image | `/app/modules/cards/assets/r01.png` | 8638 ms | 8817 ms | 5.1 KB |  |
| image | `/app/modules/cards/assets/r02.png` | 8639 ms | 8817 ms | 4.7 KB |  |
| image | `/app/modules/cards/assets/r03.png` | 8640 ms | 8825 ms | 5.1 KB |  |
| image | `/app/modules/cards/assets/r04.png` | 8641 ms | 8826 ms | 4.6 KB |  |
| image | `/app/modules/cards/assets/r05.png` | 8642 ms | 8850 ms | 10.9 KB |  |
| image | `/app/modules/cards/assets/r06.png` | 8643 ms | 8841 ms | 6.6 KB |  |
| image | `/app/modules/cards/assets/r07.png` | 8644 ms | 9995 ms | 6.3 KB |  |
| image | `/app/modules/cards/assets/r08.png` | 8646 ms | 9640 ms | 5.1 KB |  |
| image | `/app/modules/cards/assets/r09.png` | 8646 ms | 10147 ms | 6.4 KB |  |
| image | `/app/modules/cards/assets/r10.png` | 8647 ms | 9991 ms | 22.8 KB |  |
| image | `/app/modules/cards/assets/r11.png` | 8647 ms | 10845 ms | 6.6 KB |  |
| image | `/app/modules/cards/assets/r12.png` | 8648 ms | 9809 ms | 6.5 KB |  |
| image | `/app/modules/cards/assets/r13.png` | 8649 ms | 9074 ms | 4.5 KB |  |
| image | `/app/modules/cards/assets/r14.png` | 8649 ms | 9155 ms | 6.0 KB |  |
| image | `/app/modules/cards/assets/r15.png` | 8650 ms | 10349 ms | 4.8 KB |  |
| image | `/app/modules/cards/assets/r16.png` | 8650 ms | 9778 ms | 5.4 KB |  |
| image | `/app/modules/cards/assets/r17.png` | 8651 ms | 10396 ms | 5.2 KB |  |
| image | `/app/modules/cards/assets/r18.png` | 8651 ms | 10640 ms | 20.7 KB |  |
| image | `/app/modules/cards/assets/r19.png` | 8652 ms | 9457 ms | 9.4 KB |  |
| image | `/app/modules/cards/assets/r20.png` | 8652 ms | 10747 ms | 10.3 KB |  |
| image | `/app/modules/cards/assets/r21.png` | 8653 ms | 9394 ms | 4.7 KB |  |
| image | `/app/modules/cards/assets/r22.png` | 8653 ms | 9155 ms | 5.0 KB |  |
| image | `/app/modules/cards/assets/r23.png` | 8654 ms | 9208 ms | 7.5 KB |  |
| image | `/app/modules/cards/assets/r01.png#2` | 8659 ms | 9441 ms | 5.6 KB |  |
| image | `/app/modules/cards/assets/r02.png#2` | 8659 ms | 10335 ms | 9.9 KB |  |
| image | `/app/modules/cards/assets/r03.png#2` | 8660 ms | 10163 ms | 7.8 KB |  |
| image | `/app/modules/cards/assets/r04.png#2` | 8660 ms | 9041 ms | 7.4 KB |  |
| image | `/app/modules/cards/assets/r05.png#2` | 8661 ms | 9339 ms | 5.4 KB |  |
| image | `/app/modules/cards/assets/r06.png#2` | 8661 ms | 9362 ms | 10.9 KB |  |
| image | `/app/modules/cards/assets/r07.png#2` | 8662 ms | 9557 ms | 9.3 KB |  |
| image | `/app/modules/cards/assets/r08.png#2` | 8663 ms | 9979 ms | 9.7 KB |  |
| image | `/app/modules/cards/assets/r09.png#2` | 8663 ms | 9257 ms | 9.7 KB |  |
| image | `/app/modules/cards/assets/r10.png#2` | 8664 ms | 10347 ms | 9.2 KB |  |
| image | `/app/modules/cards/assets/r11.png#2` | 8664 ms | 9212 ms | 11.7 KB |  |
| image | `/app/modules/cards/assets/r12.png#2` | 8665 ms | 9760 ms | 8.5 KB |  |
| image | `/app/modules/cards/assets/r13.png#2` | 8665 ms | 10547 ms | 9.2 KB |  |
| image | `/app/modules/cards/assets/r14.png#2` | 8666 ms | 10210 ms | 10.1 KB |  |
| image | `/app/modules/cards/assets/r15.png#2` | 8666 ms | 9319 ms | 9.3 KB |  |
| image | `/app/modules/cards/assets/r16.png#2` | 8667 ms | 10578 ms | 7.8 KB |  |
| image | `/app/modules/cards/assets/r17.png#2` | 8667 ms | 17686 ms | 7.5 KB |  |
| image | `/app/modules/cards/assets/r18.png#2` | 8667 ms | 17701 ms | 10.0 KB |  |
| image | `/app/modules/cards/assets/r19.png#2` | 8668 ms | 17870 ms | 9.3 KB |  |
| image | `/app/modules/cards/assets/r20.png#2` | 8668 ms | 17885 ms | 8.2 KB |  |
| image | `/app/modules/cards/assets/r21.png#2` | 8669 ms | 18054 ms | 10.2 KB |  |
| image | `/app/modules/cards/assets/r22.png#2` | 8670 ms | 18085 ms | 10.8 KB |  |
| image | `/app/modules/cards/assets/r23.png#2` | 8671 ms | 18238 ms | 10.0 KB |  |
| video | `https://huiguan.iridescently.xyz/assets/luoxiaohei_ep29.mp4` | 6544 ms | 7659 ms | 381.5 KB | 失败 net::ERR_ABORTED |
| video | `https://huiguan.iridescently.xyz/assets/luoxiaohei_ep29.mp4#2` | 6712 ms | 8035 ms | 29.1 KB |  |
| video | `https://huiguan.iridescently.xyz/assets/luoxiaohei_ep29.mp4#3` | 8123 ms | 19161 ms | 256.6 KB |  |
| api | `/api/sso-user` | 2111 ms | 2115 ms | 0.1 KB |  |
| api | `/api/gate/identity` | 2114 ms | 2116 ms | 0.1 KB |  |

## 资源时序（热缓存，中位数）

| 类型 | 资源 | 开始 | 结束 | 传输 | 备注 |
| --- | --- | ---: | ---: | ---: | --- |
| document | `/` | 0 ms | 177 ms | 1.1 KB |  |
| js | `/app/modules/cards/assets/index.js` | 199 ms | 204 ms | 0.0 KB | 缓存 |
| js | `https://iridescently.xyz/assets/site-language.js` | 200 ms | 205 ms | 0.0 KB | 缓存 |
| js | `https://huiguan.iridescently.xyz/avatar-cropper.js` | 201 ms | 1283 ms | 0.0 KB | 失败 net::ERR_BLOCKED_BY_ORB |
| js | `/app/modules/cards/assets/gateEmbed.js` | 1906 ms | 1909 ms | 0.0 KB | 缓存 |
| js | `/app/modules/cards/assets/GameApp.js` | 5473 ms | 5702 ms | 33.8 KB |  |
| js | `/app/modules/cards/assets/player-avatar.js` | 5479 ms | 5480 ms | 0.0 KB | 缓存 |
| js | `/app/modules/cards/assets/ModeHall.js` | 6135 ms | 6312 ms | 2.9 KB |  |
| js | `/app/modules/cards/assets/shore-background.js` | 6136 ms | 6312 ms | 0.4 KB |  |
| css | `https://huiguan.iridescently.xyz/design-system/design-system.css` | 196 ms | 202 ms | 0.0 KB | 缓存 |
| css | `https://huiguan.iridescently.xyz/avatar-cropper.css` | 198 ms | 1357 ms | 0.0 KB | 失败 net::ERR_BLOCKED_BY_ORB |
| css | `/app/modules/cards/assets/index.css` | 200 ms | 203 ms | 0.0 KB | 缓存 |
| css | `/app/modules/cards/assets/GameApp.css` | 5480 ms | 5671 ms | 9.4 KB |  |
| css | `/app/modules/cards/assets/ModeHall.css` | 6138 ms | 6311 ms | 2.1 KB |  |
| image | `https://iridescently.xyz/assets/iridescently-mark.png` | 1623 ms | 1624 ms | 0.0 KB | 缓存 |
| image | `/app/modules/cards/assets/shore-background.png` | 6583 ms | 9392 ms | 1513.6 KB |  |
| image | `/app/modules/cards/assets/deep-forest-moss.png` | 6584 ms | 9237 ms | 1353.1 KB |  |
| video | `https://huiguan.iridescently.xyz/assets/luoxiaohei_ep29.mp4` | 5548 ms | 5550 ms | 0.0 KB | 缓存 |
| api | `/api/sso-user` | 1899 ms | 1904 ms | 0.1 KB |  |
| api | `/api/gate/identity` | 1903 ms | 1905 ms | 0.1 KB |  |
| api | `/app/modules/cards/api/card-balance` | 6092 ms | 6266 ms | 0.2 KB |  |
