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

- 运行：`npm run dev`（5173）；OAuth 代理 `python server.py`（5174）。
- 构建挂载：`node server/app/scripts/build-modules.mjs`（base `/app/modules/cards/`）；统一壳内以 React `createRoot` 无 iframe 挂载。
- 存档：IndexedDB `zszm-adventure-v1`（主）+ 统一存档摘要 `m:cards:summary`；用户库 `users.db`。
- API：`/api/login`、`/api/callback`、`/api/user`、`/api/sso-user`、`/api/logout`（见 docs/api.md）。
- 测试：`npm test`、`npm run check:game`。
