<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3bd5bc23-3c10-4d00-9fd8-57702da16358

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## 在统一工作区中的位置

> 本仓库位于统一工作区 `server/app/src/cards/`。总览见 [根 README](../../../../README.md)，架构/数据库/API 见 [docs/](../../../../docs/)。

- 运行：`npm run dev`（5173）；OAuth 代理 `python server.py`（5174）；统一门户数值配置 API 由 `vite preview`（5178）提供，先运行 `npm run build` / 门户模块构建。
- 构建挂载：`node server/app/scripts/build-modules.mjs`（base `/app/modules/cards/`）；统一壳内以 React `createRoot` 无 iframe 挂载。
- 开场入口与 Skip：`src/gate/GameShell.tsx`、`src/gate/EntryGate.tsx`；正常进入和 Skip 复用同一淡出转场。进度/拖动/Skip 控件契约来自 `@lxh/shared-ui/lxh-intro.js` 与 `intro-controls.css`，场景状态由本模块维护。入场左上角使用主站 `/assets/iridescently-mark.png`，与主站共享同一标识。原型融合取舍见 [入场 UI 集成记录](docs/entry-ui-integration.md)。`/api/sso-user` 是右上角账户状态的唯一来源，登录入口转到会馆 SSO；返回本页时会重新读取共享会话。
- 开场右上角的声音与语言按钮属于同一个 `.gate-tools` 控件组。主站 `assets/site-language.js` 通过 `.gate-language-host` 挂载语言按钮；入口组件尚未渲染时延迟挂载，不能退回到独立的 fixed 右上角按钮。
- 主游戏首页模块入口在 `src/game/GameApp.tsx`；灵境会馆复用 `ManagementPanel`，聚灵从统一壳路由 `/app/shell/m/juling` 打开。旧独立场景选择应用已移除；正式开场用 `src/embed/gateEmbed.ts` 驱动全屏门景、进度、主题和缩放，WebGL 降级场景与主游戏仍复用 `ReferenceScene2D.tsx`、`ReferenceScene3D.tsx` 和 `sceneModel.ts`。
- 存档：IndexedDB `zszm-adventure-v1`（主）+ 统一存档摘要 `m:cards:summary`；用户库 `users.db`。
- API：`/api/login`、`/api/callback`、`/api/user`、`/api/sso-user`、`/api/logout`（见 docs/api.md）。
- 测试：`npm test`、`npm run check:game`。
