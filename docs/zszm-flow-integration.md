# 众生之门新版流程与门庭集成

日期：2026-10-17。状态：工作源码与本地候选；没有 commit、push、publish 或重启正式服务。

## 真实入口与流程

生产前端源码为 `server/app/src/cards`。`GameShell.tsx` 保留原有 `EntryGate.tsx` 与 760ms 退出，然后插入定稿门场景：

`EntryGate 开场 → 760ms 退出 → 门场景 → 推门 / 灵逸散 / 闪白 → 资料完整者进入门庭，未完成者进入 PlayerOnboarding`

6 小时内回访沿用原规则，直接进入门庭。门场景期间资料读取与游戏模块预加载继续进行；下一屏在闪白后段才显现，先前保持隐藏并 inert。门场景仍处于 opening 方向阶段，不挂载顶部站点栏。

资料不完整者进入已验收原型流程：

`改名 → 种族树 → 具体头像/框选择 → 人类快捷确认或自定义种族 → 设置/拍摄 → 确认保存 → 门庭`。

保持原型现有步骤顺序，没有为了接口名重新设计视觉。种族编号仅作素材 ID，不作为玩家的真实种族文字。账户资料请求失败可重试；返回开场不清空已经确认的玩家状态。

初始化来自 `E:\External Projects\original-ui-version\src`，必要源码、字体与素材迁入 `src/onboarding`。正式构建没有外部项目绝对路径依赖。门场景由 `src/gate/DoorScene.tsx` 与 `door-scene.css` 从分层 React canvas/CSS 实现；仅从只读原型迁入定稿 `assets_final` 的 PNG，不加载外部路径、不带入原型整页或其音频引擎。原型文件本身未修改。

## 数据与生命周期

`PlayerProfileProvider` 是已确认 Gate 玩家资料的唯一 React owner。初始化、既有高级编辑器、顶部 HUD、门庭与浅滩共用这一份状态。`PlayerAvatar.tsx` 复用同一个 SVG 图片窗口与框叠层，头像图片和框分开保存。初始化草稿独立于账户资料，只有确认保存成功才进入后续内容。

登录者调用现有 `/api/gate/identity`，图片为 Blob/multipart；匿名者沿用 `sessionStorage['zszm.gateIdentity.v1']`。账户切换重新读取当前账户，不把匿名或前一个账户的草稿自动迁入。可选 `expected_owner` 在服务端写入/图片落盘前检查；不匹配返回 409。详见 [身份与存档关系](zszm-identity-and-save-map.md)。

初始化样式限定 `.gate-onboarding`，设计尺寸使用容器变量，不改 `html` 根字号。卸载清理 listener、RAF、timer、ResizeObserver、dialog 和 object URL。浅滩也有独立清理，不持续运行 JS RAF/WebGL。

## 门庭与路由

统一门庭在 `#home`，入口名称、描述与模块 key 来源仍是 `server/app/portal.json`。详细映射见 [MODES.md](../server/app/src/cards/src/game/MODES.md)。

| 类型 | 入口 |
| --- | --- |
| 当前应用内 | 雾隐浅滩 `#shore`、入世历练 `#adventure`、灵境会馆 `#management`、生态 `#ecosystem` |
| 既有模块壳 | 聚灵、重生之门、灵体互动、AEON、省省海滩射击：`/app/shell/m/<key>` |
| 案头辅助 | 会馆日常、图鉴、手札、万灵志 |

卡牌原首页的同行者选择移至 `#adventure` 无 run 状态；原型浅滩不再是全站唯一终点。成熟玩法引擎、receipt/outbox、生态收获与各自存档不重写。模块壳增加“返回门庭”。射击试玩旧直达 `/playtest/shengsheng-shoot/` 增加显式门户分发，避免被 zszm 的 SPA fallback 吞掉。

删除/替代的是 Cards 首页重复模块按钮与“唯一卡牌首页”呈现；保留了其成熟游戏内容。没有删除正式站现有开场、玩法、账户或研究项目。

## 资源、依赖与鸣谢边界

- 正式 3D 开场继续使用项目原有 gate / `@lxh/shared-ui` 控件；新门场景复用原型的图层、视差深度、门洞光尘、水面扰动和灵逸散动画。
- 开场声音按钮旁增加配乐菜单：自动（默认延长版）、配乐 1、配乐 2（试听/未完成）和静音；选曲与静音保存在浏览器本地，音乐在开场离场后继续播放。MP3 副本迁入 Cards 源码，外部原型及 WAV 归档不改。`?bgm=split` 只用于开发时对比「自动」门前使用配乐 2、进门后切回延长版。
- 门场景沿用现有 `OpeningMusicProvider`，不移植原型音频引擎或选曲 UI。门前音乐持续到推门后 2.1 秒的闪白起始点，再切到进门后段落；时机常量位于 `src/gate/DoorScene.tsx` 的 `DOOR_MUSIC_SWITCH_MS`，需要人耳确认。
- 初始化种族图、头像框与字体来自已验收原型及用户提供的《罗小黑战记》参考资料，保留原型 SVG/PNG 表现，没有生成新占位几何图形。
- 门庭森林图复用 `packages/shared-ui/lxh/scenes/deep-forest-moss.png`；浅滩背景和三灵息玩法来自原型 `world-screen.js` / `media/bg.png`。
- 沿用既有 React、Vite、Lucide、Three 等依赖；没有新增框架、路由库或身份系统。
- 此次素材迁入不等于取得第三方素材再许可；主仓库仍 private，不独立公开这些素材。Connections 的既有作者鸣谢不在本轮重做。

## 本地与发布边界

本轮可访问 `http://127.0.0.1:5195/`；API 5194，Vite 的共享资源/模块请求代理至现有 8080。正式环境仍由网站管家读取 `.releases/production/site` 和已发布模块；不会读取此开发服务。

根目录 `npm run build:cards` 仅写 `.releases/candidate`。将来发布需先审查源码提交、构建源码快照与 Cards 候选，再按既有 `docs/release-workflow.md` 显式提升并只重启相关服务。本轮没有执行该流程。

## 维护入口

| 要修改 | 文件 |
| --- | --- |
| 正式开场 | `src/gate/EntryGate.tsx` / `src/embed/gateEmbed.ts` |
| 门场景 | `src/gate/DoorScene.tsx` / `src/gate/door-scene.css` / `src/gate/door-assets/` |
| 初始化流程/种族动画 | `src/onboarding/PlayerOnboarding.tsx` / `race-tree.js` / `screens.html` / `onboarding.css` |
| 头像裁切和框 | `src/onboarding/player-avatar.js` / `src/game/PlayerAvatar.tsx` |
| 已确认玩家状态 | `src/game/PlayerProfile.tsx` |
| 已有高级编辑/OC 导入 | `src/game/PlayerIdentity.tsx` |
| 门庭与移动布局 | `src/game/ModeHall.tsx` / `mode-hall.css` |
| 浅滩玩法 | `src/game/ShoreMode.tsx` / `shore/` |
| 模块清单 | `server/app/portal.json` |
| 主站/会馆加载发现 | [加载审查](zszm-loading-audit.md) |

## 验证记录

2026-10-23 本地候选接入「门」场景。`npm run check:game`、`npx tsc --noEmit` 和根目录 `npm run build:cards` 均通过；候选写入 `.releases/candidate/cards`，没有发布。浏览器实际验证新玩家（进入初始化）、完整资料玩家（推门后进门庭）、6 小时回访直接进门庭、开场 Skip、门场景 Skip、Esc、Enter、空格、减少动态效果、重看开场和“从开场走一遍”新形象。1440×900 与 390×844/844×390 无横向溢出；手机竖屏显示 opening 方向提示。门场景中目标页 `aria-hidden` / `inert`，站点栏隐藏；闪白起始约 2.1s，下一屏在 3.4s 开始于白光后显现，并随门场景淡出。控制台无 error。页面隐藏/恢复通过模拟 `visibilitychange` 验证：隐藏期间门场景暂停，恢复后续播并正常结束；切换到另一个本地浏览器页没有触发真实 `document.hidden`，因此真实后台标签页生命周期未计为已验证。后续发现宽屏横向锚点被 `clamp` 截断，现改为直接对齐门洞；1440×900 实测舞台左移 33px，图层覆盖视口两侧；修复版本地验收服务为 `http://127.0.0.1:5197/`。

截图：`file:///E:/External%20Projects/Iridescently%20Operations%20Archive/qa/qa/zszm-door-20261023/door-desktop.jpg`、`door-mobile-portrait.jpg`、`door-mobile-landscape.jpg`、`door-flash-desktop.jpg`、`door-fade-desktop.jpg`、`next-screen-desktop.jpg`。低端真机帧率、真实玩家账户跨设备资料、真实设备的方向锁、音频切换的人耳感受尚未测；候选构建仍报告既有 `gateEmbed` 超过 500 kB 警告。

2026-10-17 本地浏览器实际走通单次正式开场、改名、种族选择、自定义种族、设置头像、门庭与浅滩探索/返回。热更新重载后重新进入开场，直接恢复已确认头像和种族，未重复初始化。1440/390px 测量无整页横向溢出；手机导航保留原有横向滚动，玩家 HUD 窄屏为有无障碍名称的头像按钮。

截图：`file:///E:/External%20Projects/Iridescently%20Operations%20Archive/qa/qa/zszm-merge-20261017/hall-desktop.png`、`hall-mobile.png`、`shore-mobile.png`。构建/自动测试结果以本轮最终验收记录为准。没有把本地通过声称为线上通过，未完整回归每个独立玩法的 GPU/联网功能。

最终检查：`npm run check:game` 与完整 `tsc --noEmit` 通过；初始化草稿测试 2/2，身份 API 隔离测试 7/7，既有卡牌核心测试 22/22（包含 90 次自动历练），门户测试 51/51。根目录 `npm run build:cards` 成功生成 71 个哈希资源。候选使用正式 `/app/modules/cards/` base 在本地 5197 预览，实际走通人类快捷确认、头像保存、门庭和刷新恢复，控制台 error 为空。

候选预览必须模拟正式门户对 `/app/modules/cards/api/card-balance` 的既有重写，转到 5178 的 `/api/card-balance`；裸静态预览即使 JS 能加载，也会缺少数值服务而暂停历练。本轮补齐测试代理后重试，告警消失；没有把这项预览配置问题当作生产账户/API 改造。

候选仍有原门景 chunk 大于 500 kB 的 Vite 提醒；初始化三份字体约 15 MB，已与开场分包但尚未做保留字形的子集化。真实账户跨设备登录、所有玩法 GPU/联网与完整生产代理链路未在本轮浏览器逐一回归，不能由这些本地结果推定。
