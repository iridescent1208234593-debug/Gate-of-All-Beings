# 众生之门启动性能报告

- schema：`zszm-startup/v1`
- 时间：2026-10-17T05:46:54.586Z
- 目标：build `working tree (temporary build)`
- 条件：Fast 4G（9 Mbps 下行 / 150 ms RTT），CPU 4× 降速；chrome 155.0.8059.84 headless；视口 1440×900；3 次取中位数；跨子域请求被阻断（热缓存数字不可用）
- 口径：时间均自导航开始；首帧为 `performance.mark('gate:first-frame')`；/api/* 由 harness 返回匿名游客应答

## 预算

| 指标 | 条件 | 实测 | 预算 | 结果 |
| --- | --- | ---: | ---: | --- |
| firstGateFrame | cold | 1649 ms | 2500 ms | 通过 |
| jsBeforeFrame | cold | 221.9 KB | 250.0 KB | 通过 |
| crossOriginBlocking | cold | 4 | 0 | **超标** |
| onboardingBytes | cold | 14.92 MB | 1.50 MB | **超标** |
| warmHallEnter | warm | 1201 ms | 1000 ms | **超标** |

## 时间点

| 时间点 | 冷缓存（新玩家） | 热缓存（老玩家） |
| --- | ---: | ---: |
| 门景首帧 `firstGateFrame` | 1649 ms | 1284 ms |
| 跳过可点 `skipClickable` | 848 ms | 715 ms |
| 进入可点 `enterClickable` | 4490 ms | 4166 ms |
| 点击进入 `enterClicked` | 4785 ms | 4462 ms |
| 初始化可交互 `onboardingInteractive` | 6265 ms | — |
| 门庭可交互 `hallInteractive` | — | 5663 ms |

## 按类型分组（冷缓存，到初始化可交互且网络静止）

| 类型 | 请求 | 传输 | 缓存命中 | 失败 | 最早开始 | 最晚结束 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| document | 1 | 1.1 KB | 0 | 0 | 1 ms | 178 ms |
| js | 6 | 252.4 KB | 0 | 2 | 200 ms | 5006 ms |
| css | 4 | 15.2 KB | 0 | 2 | 198 ms | 4976 ms |
| font | 3 | 14629.4 KB | 0 | 0 | 5610 ms | 20312 ms |
| image | 47 | 381.6 KB | 0 | 1 | 607 ms | 9073 ms |
| video | 1 | 0.0 KB | 0 | 1 | 4871 ms | 4904 ms |
| api | 2 | 0.2 KB | 0 | 0 | 864 ms | 871 ms |

## 按类型分组（热缓存，到门庭可交互且网络静止）

| 类型 | 请求 | 传输 | 缓存命中 | 失败 | 最早开始 | 最晚结束 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| document | 1 | 1.1 KB | 0 | 0 | 0 ms | 172 ms |
| js | 8 | 37.1 KB | 3 | 2 | 196 ms | 5524 ms |
| css | 5 | 11.5 KB | 1 | 2 | 194 ms | 5524 ms |
| image | 3 | 2866.6 KB | 0 | 1 | 466 ms | 8587 ms |
| video | 1 | 0.0 KB | 0 | 1 | 4561 ms | 4594 ms |
| api | 3 | 0.4 KB | 0 | 0 | 738 ms | 5493 ms |

## 每次运行

| # | 冷首帧 | 进入可点 | 初始化可交互 | 首帧前 JS | 跨子域阻塞 | 冷总传输 | 热首帧 | 热进入门庭 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1649 ms | 4490 ms | 6239 ms | 221.9 KB | 4 | 14.92 MB | 1235 ms | 1187 ms |
| 2 | 1592 ms | 4444 ms | 6265 ms | 221.9 KB | 4 | 14.92 MB | 1284 ms | 1201 ms |
| 3 | 1660 ms | 4525 ms | 6632 ms | 221.9 KB | 4 | 14.92 MB | 1894 ms | 1337 ms |

## 首帧前的跨子域阻塞请求（第 1 次运行）

- https://huiguan.iridescently.xyz/design-system/design-system.css?v=3（Stylesheet，195–275 ms，失败：net::ERR_CONNECTION_REFUSED）
- https://huiguan.iridescently.xyz/avatar-cropper.css（Stylesheet，197–276 ms，失败：net::ERR_CONNECTION_REFUSED）
- https://iridescently.xyz/assets/site-language.js?v=20261016-1（Script，199–328 ms，失败：net::ERR_CONNECTION_REFUSED）
- https://huiguan.iridescently.xyz/avatar-cropper.js（Script，200–329 ms，失败：net::ERR_CONNECTION_REFUSED）

## 资源时序（冷缓存，中位数）

| 类型 | 资源 | 开始 | 结束 | 传输 | 备注 |
| --- | --- | ---: | ---: | ---: | --- |
| document | `/` | 1 ms | 178 ms | 1.1 KB |  |
| js | `/app/modules/cards/assets/index.js` | 200 ms | 457 ms | 71.1 KB |  |
| js | `https://iridescently.xyz/assets/site-language.js` | 202 ms | 222 ms | 0.0 KB | 失败 net::ERR_CONNECTION_REFUSED |
| js | `https://huiguan.iridescently.xyz/avatar-cropper.js` | 202 ms | 223 ms | 0.0 KB | 失败 net::ERR_CONNECTION_REFUSED |
| js | `/app/modules/cards/assets/gateEmbed.js` | 872 ms | 1189 ms | 150.8 KB |  |
| js | `/app/modules/cards/assets/PlayerOnboarding.js` | 4792 ms | 5006 ms | 28.4 KB |  |
| js | `/app/modules/cards/assets/player-avatar.js` | 4799 ms | 4975 ms | 2.1 KB |  |
| css | `https://huiguan.iridescently.xyz/design-system/design-system.css` | 198 ms | 218 ms | 0.0 KB | 失败 net::ERR_CONNECTION_REFUSED |
| css | `https://huiguan.iridescently.xyz/avatar-cropper.css` | 200 ms | 218 ms | 0.0 KB | 失败 net::ERR_CONNECTION_REFUSED |
| css | `/app/modules/cards/assets/index.css` | 201 ms | 395 ms | 10.7 KB |  |
| css | `/app/modules/cards/assets/PlayerOnboarding.css` | 4800 ms | 4976 ms | 4.4 KB |  |
| font | `/app/modules/cards/assets/font.ttf` | 5610 ms | 16360 ms | 3450.9 KB |  |
| font | `/app/modules/cards/assets/zaozi-puyue.ttf` | 5614 ms | 18900 ms | 4833.0 KB |  |
| font | `/app/modules/cards/assets/zihun-wennuan.ttf` | 5615 ms | 20312 ms | 6345.5 KB |  |
| image | `https://iridescently.xyz/assets/iridescently-mark.png` | 607 ms | 855 ms | 0.0 KB | 失败 net::ERR_CONNECTION_REFUSED |
| image | `/app/modules/cards/assets/r01.png` | 6164 ms | 6337 ms | 5.1 KB |  |
| image | `/app/modules/cards/assets/r02.png` | 6165 ms | 6337 ms | 4.7 KB |  |
| image | `/app/modules/cards/assets/r03.png` | 6166 ms | 6352 ms | 5.1 KB |  |
| image | `/app/modules/cards/assets/r04.png` | 6168 ms | 6353 ms | 4.6 KB |  |
| image | `/app/modules/cards/assets/r05.png` | 6168 ms | 6367 ms | 10.9 KB |  |
| image | `/app/modules/cards/assets/r06.png` | 6169 ms | 6367 ms | 6.6 KB |  |
| image | `/app/modules/cards/assets/r07.png` | 6170 ms | 6884 ms | 6.3 KB |  |
| image | `/app/modules/cards/assets/r08.png` | 6170 ms | 6776 ms | 5.1 KB |  |
| image | `/app/modules/cards/assets/r09.png` | 6171 ms | 8204 ms | 6.4 KB |  |
| image | `/app/modules/cards/assets/r10.png` | 6172 ms | 7579 ms | 22.8 KB |  |
| image | `/app/modules/cards/assets/r11.png` | 6173 ms | 6961 ms | 6.6 KB |  |
| image | `/app/modules/cards/assets/r12.png` | 6173 ms | 7637 ms | 6.5 KB |  |
| image | `/app/modules/cards/assets/r13.png` | 6174 ms | 8115 ms | 4.5 KB |  |
| image | `/app/modules/cards/assets/r14.png` | 6176 ms | 8021 ms | 6.0 KB |  |
| image | `/app/modules/cards/assets/r15.png` | 6176 ms | 7765 ms | 4.8 KB |  |
| image | `/app/modules/cards/assets/r16.png` | 6177 ms | 7721 ms | 5.4 KB |  |
| image | `/app/modules/cards/assets/r17.png` | 6178 ms | 8130 ms | 5.2 KB |  |
| image | `/app/modules/cards/assets/r18.png` | 6178 ms | 7032 ms | 20.7 KB |  |
| image | `/app/modules/cards/assets/r19.png` | 6179 ms | 7385 ms | 9.4 KB |  |
| image | `/app/modules/cards/assets/r20.png` | 6180 ms | 8160 ms | 10.3 KB |  |
| image | `/app/modules/cards/assets/r21.png` | 6180 ms | 8306 ms | 4.7 KB |  |
| image | `/app/modules/cards/assets/r22.png` | 6181 ms | 6750 ms | 5.0 KB |  |
| image | `/app/modules/cards/assets/r23.png` | 6182 ms | 7570 ms | 7.5 KB |  |
| image | `/app/modules/cards/assets/r01.png#2` | 6187 ms | 7364 ms | 5.6 KB |  |
| image | `/app/modules/cards/assets/r02.png#2` | 6188 ms | 7533 ms | 9.9 KB |  |
| image | `/app/modules/cards/assets/r03.png#2` | 6188 ms | 8314 ms | 7.8 KB |  |
| image | `/app/modules/cards/assets/r04.png#2` | 6189 ms | 7217 ms | 7.4 KB |  |
| image | `/app/modules/cards/assets/r05.png#2` | 6190 ms | 6981 ms | 5.4 KB |  |
| image | `/app/modules/cards/assets/r06.png#2` | 6190 ms | 7920 ms | 10.9 KB |  |
| image | `/app/modules/cards/assets/r07.png#2` | 6191 ms | 7734 ms | 9.3 KB |  |
| image | `/app/modules/cards/assets/r08.png#2` | 6192 ms | 7334 ms | 9.7 KB |  |
| image | `/app/modules/cards/assets/r09.png#2` | 6193 ms | 7452 ms | 9.7 KB |  |
| image | `/app/modules/cards/assets/r10.png#2` | 6193 ms | 6949 ms | 9.2 KB |  |
| image | `/app/modules/cards/assets/r11.png#2` | 6194 ms | 7170 ms | 11.7 KB |  |
| image | `/app/modules/cards/assets/r12.png#2` | 6194 ms | 7253 ms | 8.5 KB |  |
| image | `/app/modules/cards/assets/r13.png#2` | 6195 ms | 8578 ms | 9.2 KB |  |
| image | `/app/modules/cards/assets/r14.png#2` | 6195 ms | 8311 ms | 10.1 KB |  |
| image | `/app/modules/cards/assets/r15.png#2` | 6196 ms | 7315 ms | 9.3 KB |  |
| image | `/app/modules/cards/assets/r16.png#2` | 6196 ms | 7728 ms | 7.8 KB |  |
| image | `/app/modules/cards/assets/r17.png#2` | 6197 ms | 8690 ms | 7.5 KB |  |
| image | `/app/modules/cards/assets/r18.png#2` | 6197 ms | 8752 ms | 10.0 KB |  |
| image | `/app/modules/cards/assets/r19.png#2` | 6198 ms | 8778 ms | 9.3 KB |  |
| image | `/app/modules/cards/assets/r20.png#2` | 6199 ms | 8875 ms | 8.2 KB |  |
| image | `/app/modules/cards/assets/r21.png#2` | 6199 ms | 8952 ms | 10.2 KB |  |
| image | `/app/modules/cards/assets/r22.png#2` | 6200 ms | 8995 ms | 10.8 KB |  |
| image | `/app/modules/cards/assets/r23.png#2` | 6201 ms | 9073 ms | 10.0 KB |  |
| video | `https://huiguan.iridescently.xyz/assets/luoxiaohei_ep29.mp4` | 4871 ms | 4904 ms | 0.0 KB | 失败 net::ERR_CONNECTION_REFUSED |
| api | `/api/sso-user` | 864 ms | 868 ms | 0.1 KB |  |
| api | `/api/gate/identity` | 867 ms | 871 ms | 0.1 KB |  |

## 资源时序（热缓存，中位数）

| 类型 | 资源 | 开始 | 结束 | 传输 | 备注 |
| --- | --- | ---: | ---: | ---: | --- |
| document | `/` | 0 ms | 172 ms | 1.1 KB |  |
| js | `/app/modules/cards/assets/index.js` | 196 ms | 202 ms | 0.0 KB | 缓存 |
| js | `https://iridescently.xyz/assets/site-language.js` | 197 ms | 219 ms | 0.0 KB | 失败 net::ERR_CONNECTION_REFUSED |
| js | `https://huiguan.iridescently.xyz/avatar-cropper.js` | 198 ms | 220 ms | 0.0 KB | 失败 net::ERR_CONNECTION_REFUSED |
| js | `/app/modules/cards/assets/gateEmbed.js` | 743 ms | 747 ms | 0.0 KB | 缓存 |
| js | `/app/modules/cards/assets/GameApp.js` | 4470 ms | 4675 ms | 33.8 KB |  |
| js | `/app/modules/cards/assets/player-avatar.js` | 4477 ms | 4480 ms | 0.0 KB | 缓存 |
| js | `/app/modules/cards/assets/ModeHall.js` | 5345 ms | 5524 ms | 2.9 KB |  |
| js | `/app/modules/cards/assets/shore-background.js` | 5347 ms | 5524 ms | 0.4 KB |  |
| css | `https://huiguan.iridescently.xyz/design-system/design-system.css` | 194 ms | 213 ms | 0.0 KB | 失败 net::ERR_CONNECTION_REFUSED |
| css | `https://huiguan.iridescently.xyz/avatar-cropper.css` | 195 ms | 213 ms | 0.0 KB | 失败 net::ERR_CONNECTION_REFUSED |
| css | `/app/modules/cards/assets/index.css` | 196 ms | 202 ms | 0.0 KB | 缓存 |
| css | `/app/modules/cards/assets/GameApp.css` | 4478 ms | 4668 ms | 9.4 KB |  |
| css | `/app/modules/cards/assets/ModeHall.css` | 5348 ms | 5524 ms | 2.1 KB |  |
| image | `https://iridescently.xyz/assets/iridescently-mark.png` | 466 ms | 694 ms | 0.0 KB | 失败 net::ERR_CONNECTION_REFUSED |
| image | `/app/modules/cards/assets/shore-background.png` | 5781 ms | 8587 ms | 1513.6 KB |  |
| image | `/app/modules/cards/assets/deep-forest-moss.png` | 5784 ms | 8435 ms | 1353.1 KB |  |
| video | `https://huiguan.iridescently.xyz/assets/luoxiaohei_ep29.mp4` | 4561 ms | 4594 ms | 0.0 KB | 失败 net::ERR_CONNECTION_REFUSED |
| api | `/api/sso-user` | 738 ms | 742 ms | 0.1 KB |  |
| api | `/api/gate/identity` | 741 ms | 743 ms | 0.1 KB |  |
| api | `/app/modules/cards/api/card-balance` | 5322 ms | 5493 ms | 0.2 KB |  |
