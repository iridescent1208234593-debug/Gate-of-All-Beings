# 众生之门新版流程与门庭集成

日期：2026-10-17。状态：工作源码与本地候选；没有 commit、push、publish 或重启正式服务。

## 真实入口与流程

生产前端源码为 `server/app/src/cards`。`GameShell.tsx` 保留原有 `EntryGate.tsx` 和 `gateEmbed.ts` 门景，完成和 Skip 都通过原有 760ms 退出；同时读取现有账户和玩家资料。开场后，资料完整者直接进入门庭，未完成者进入已验收原型流程：

`改名 → 种族树 → 具体头像/框选择 → 人类快捷确认或自定义种族 → 设置/拍摄 → 确认保存 → 门庭`。

保持原型现有步骤顺序，没有为了接口名重新设计视觉。种族编号仅作素材 ID，不作为玩家的真实种族文字。账户资料请求失败可重试；返回开场不清空已经确认的玩家状态。

初始化来自 `E:\External Projects\original-ui-version\src`，必要源码、字体与素材迁入 `src/onboarding`。正式构建没有外部项目绝对路径依赖。未迁入原型 `main.js`、`opening-animation.js`、重复门景与整页入口，因此不存在双开场。外部原型本身保留，没有删除其开发历史或修改其源文件。

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

- 正式开场继续使用项目原有 gate / `@lxh/shared-ui` 控件。
- 初始化种族图、头像框与字体来自已验收原型及用户提供的《罗小黑战记》参考资料，保留原型 SVG/PNG 表现，没有生成新占位几何图形。
- 门庭森林图复用 `shared/shared-ui/lxh/scenes/deep-forest-moss.png`；浅滩背景和三灵息玩法来自原型 `world-screen.js` / `media/bg.png`。
- 沿用既有 React、Vite、Lucide、Three 等依赖；没有新增框架、路由库或身份系统。
- 此次素材迁入不等于取得第三方素材再许可；主仓库仍 private，不独立公开这些素材。Connections 的既有作者鸣谢不在本轮重做。

## 本地与发布边界

本轮可访问 `http://127.0.0.1:5195/`；API 5194，Vite 的共享资源/模块请求代理至现有 8080。正式环境仍由网站管家读取 `.releases/production/site` 和已发布模块；不会读取此开发服务。

根目录 `npm run build:cards` 仅写 `.releases/candidate`。将来发布需先审查源码提交、构建源码快照与 Cards 候选，再按既有 `docs/release-workflow.md` 显式提升并只重启相关服务。本轮没有执行该流程。

## 维护入口

| 要修改 | 文件 |
| --- | --- |
| 正式开场 | `src/gate/EntryGate.tsx` / `src/embed/gateEmbed.ts` |
| 初始化流程/种族动画 | `src/onboarding/PlayerOnboarding.tsx` / `race-tree.js` / `screens.html` / `onboarding.css` |
| 头像裁切和框 | `src/onboarding/player-avatar.js` / `src/game/PlayerAvatar.tsx` |
| 已确认玩家状态 | `src/game/PlayerProfile.tsx` |
| 已有高级编辑/OC 导入 | `src/game/PlayerIdentity.tsx` |
| 门庭与移动布局 | `src/game/ModeHall.tsx` / `mode-hall.css` |
| 浅滩玩法 | `src/game/ShoreMode.tsx` / `shore/` |
| 模块清单 | `server/app/portal.json` |
| 主站/会馆加载发现 | [加载审查](zszm-loading-audit.md) |

## 验证记录

2026-10-17 本地浏览器实际走通单次正式开场、改名、种族选择、自定义种族、设置头像、门庭与浅滩探索/返回。热更新重载后重新进入开场，直接恢复已确认头像和种族，未重复初始化。1440/390px 测量无整页横向溢出；手机导航保留原有横向滚动，玩家 HUD 窄屏为有无障碍名称的头像按钮。

截图：`work/qa/zszm-merge-20261017/hall-desktop.png`、`hall-mobile.png`、`shore-mobile.png`。构建/自动测试结果以本轮最终验收记录为准。没有把本地通过声称为线上通过，未完整回归每个独立玩法的 GPU/联网功能。

最终检查：`npm run check:game` 与完整 `tsc --noEmit` 通过；初始化草稿测试 2/2，身份 API 隔离测试 7/7，既有卡牌核心测试 22/22（包含 90 次自动历练），门户测试 51/51。根目录 `npm run build:cards` 成功生成 71 个哈希资源。候选使用正式 `/app/modules/cards/` base 在本地 5197 预览，实际走通人类快捷确认、头像保存、门庭和刷新恢复，控制台 error 为空。

候选预览必须模拟正式门户对 `/app/modules/cards/api/card-balance` 的既有重写，转到 5178 的 `/api/card-balance`；裸静态预览即使 JS 能加载，也会缺少数值服务而暂停历练。本轮补齐测试代理后重试，告警消失；没有把这项预览配置问题当作生产账户/API 改造。

候选仍有原门景 chunk 大于 500 kB 的 Vite 提醒；初始化三份字体约 15 MB，已与开场分包但尚未做保留字形的子集化。真实账户跨设备登录、所有玩法 GPU/联网与完整生产代理链路未在本轮浏览器逐一回归，不能由这些本地结果推定。
