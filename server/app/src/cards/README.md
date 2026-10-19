# 众生之门

正式前端源码：保留门景开场，随后进入玩家初始化与统一门庭；卡牌历练是其中一个模式。线上入口为 `https://zszm.iridescently.xyz/`，本轮集成仅写工作源码和候选，尚未发布。

## 本地运行

在本目录安装依赖后运行 `python server.py`（默认 5174）和 `npm run dev`（默认 5173）。需要根门户提供共享静态资源和成熟模块时，另按根 README 启动门户。无须为玩家初始化配置 Gemini key，也不要将密钥写入源码。

端口冲突时可以单独指定：`PORT=5194` 启动 Python API，`ZSZM_DEV_API_TARGET=http://127.0.0.1:5194` 配合 Vite `--port 5195 --host 127.0.0.1`。这些环境变量在 PowerShell 使用 `$env:变量名='值'` 设置。生产构建通过根目录 `npm run build:cards` 写候选，不等于发布。

## 新版流程与维护边界

- `src/gate/EntryGate.tsx`：保留正式门景、Skip、进度、颜色、缩放。
- `src/gate/GameShell.tsx`：单次开场 → 资料读取 → 未完成者初始化 / 已完成者门庭。异步资料请求与门景并行，失败可重试。
- `src/onboarding/`：已验收原型的改名、种族树、头像列表、种族确认与设置/拍摄。没有复制原型开场或整站入口；参见本目录 README。
- `src/game/PlayerProfile.tsx`：已确认玩家资料唯一 React owner；设置、HUD、门庭和浅滩共同读取，账户/OC 仍为独立实体。
- `src/game/ModeHall.tsx`、`MODES.md`：从 `server/app/portal.json` 读取玩法清单；模式及路由的实际映射见 MODES.md。
- `src/game/ShoreMode.tsx`、`shore/`：原型浅滩作为独立小游戏，退出回门庭。
- `src/game/PlayerIdentity.tsx`：保留已有高级编辑、OC 导入和裁切；保存后更新同一 provider。

整合、来源、验证和未发布边界见 [集成记录](../../../../docs/zszm-flow-integration.md)；身份与存档边界见 [数据关系](../../../../docs/zszm-identity-and-save-map.md)。

入世历练与重生之门已接入共同旅途数据层：角色使用 SQLite 的有效 ID，资源和完整玩法快照进入统一 IndexedDB；旧档首次读取时迁入。门庭资源栏与「共同旅途」可查共享进度、439 名角色、168 个灵卡定义并导出。数据契约、迁移规则与其他小游戏接入方式见[合并 README](../../../../docs/ai-handoff/README.md)。这是本地源码与候选的实现状态，尚未发布。

## 在统一工作区中的位置

> 本仓库位于统一工作区 `server/app/src/cards/`。总览见 [根 README](../../../../README.md)，架构/数据库/API 见 [docs/](../../../../docs/)。

- 运行：`npm run dev`（5173）；OAuth 代理 `python server.py`（5174）；统一门户数值配置 API 由 `vite preview`（5178）提供，先运行 `npm run build` / 门户模块构建。
- 构建挂载：`node server/app/scripts/build-modules.mjs`（base `/app/modules/cards/`）；统一壳内以 React `createRoot` 无 iframe 挂载。
- 顶栏：进入门庭后挂载站点全局栏 `@lxh/shared-ui/site-nav.js`（品牌标、三站切换、账户由它负责，开场和玩家初始化时不显示）；本应用只渲染其下的米白本地栏：页签 + 「开场」「玩法说明」「形象」。样式在 `src/game/header.css`，挂载时机在 `src/gate/GameShell.tsx`。
- 加载：资料、存档和各视图的等待一律用共享 `.qc-loading`，在内容位置显示细进度线与说明，不另起全屏加载页；开场播放时空闲预取 `GameApp` / `ModeHall`。出错时不能停在加载线：视图由 `src/components/LoadBoundary.tsx` 兜住（分包失败给「重新加载页面」，渲染出错另给「重试」），自管的读取失败用同文件的 `LoadError`。开发时 `vite.config.ts` 把 `index.html` 里线上的 `design-system.css` 换成工作区 `portal/huiguan/design-system/` 源码，构建产物不变。
- 开场入口与 Skip：`src/gate/GameShell.tsx`、`src/gate/EntryGate.tsx`；正常进入和 Skip 复用同一淡出转场。进度/拖动/Skip 控件契约来自 `@lxh/shared-ui/lxh-intro.js` 与 `intro-controls.css`，场景状态由本模块维护。入场左上角使用主站 `/assets/iridescently-mark.png`（像素坐标系品牌标的 PNG 副本，源文件 `shared/shared-ui/brand/iridescently-mark.svg`）。原型融合取舍见 [入场 UI 集成记录](docs/entry-ui-integration.md)。`/api/sso-user` 是右上角账户状态的唯一来源，登录入口转到会馆 SSO；返回本页时会重新读取共享会话。
- 开场右上角的声音与语言按钮属于同一个 `.gate-tools` 控件组。主站 `assets/site-language.js` 通过 `.gate-language-host` 挂载语言按钮；入口组件尚未渲染时延迟挂载，不能退回到独立的 fixed 右上角按钮。
- 主游戏首页模块入口在 `src/game/GameApp.tsx`；灵境会馆复用 `ManagementPanel`，聚灵从统一壳路由 `/app/shell/m/juling` 打开。旧独立场景选择应用已移除；正式开场用 `src/embed/gateEmbed.ts` 驱动全屏门景、进度、主题和缩放，WebGL 降级场景与主游戏仍复用 `ReferenceScene2D.tsx`、`ReferenceScene3D.tsx` 和 `sceneModel.ts`。
- 存档：IndexedDB `iridescently-game-v1` 的 `mode:cards` 为主，资源/角色进度在共享 profile；`zszm-adventure-v1` 为只读迁入来源，`m:cards:summary` 仅是摘要。身份资料仍使用原有会馆用户库，与本地旅途分离。
- API：旧 Cards OAuth `/api/login` 保留为 410 停用响应；`/api/sso-user`、`/api/gate/identity` 与 `/api/gate/ocs` 使用会馆共享 `hx_sso`，不创建第二套账户状态。
- 身份资料：账号使用 `(kind, uid)` 隔离。Gate Identity 保存于会馆 `users.db.account_profiles.gate_identity_json`；OC 仍在会馆 `characters.json` 每条记录的 `data` 中。导入 OC 是经用户确认的一次字段复制，不保持同步，种族名称为自由文本。账户头像、OC 头像和 Gate 头像彼此独立；API / 资源细节见 `portal/huiguan/README.md` 的“账户、OC 与众生之门形象”。
- 测试：`npm test`、`npm run check:game`。
