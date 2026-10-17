# shared-ui · 站群组件库

节气画廊（iridescently.xyz）、西木会馆（huiguan.*）、众生之门（zszm.* 与各游戏模块）共用的界面组件与品牌资源。这里是真身：会馆的 `portal/huiguan/design-system/ui` 是指向本目录的 junction，线上同时由 `https://<任一站点>/shared/shared-ui/…` 提供。

样式指南（含真实组件演示）：`https://huiguan.iridescently.xyz/design-system/`。规则与 token：[`portal/huiguan/design-system/design-system.md`](../../portal/huiguan/design-system/design-system.md)。

## 目录

| 路径 | 内容 | 消费者 |
| --- | --- | --- |
| `site-nav.js` | **站点导航**：三站共用的唯一全局栏（品牌标、三站切换、更多、页面插槽、语言、账户） | 所有页面；React 应用 `import '@lxh/shared-ui/site-nav.js'` 后调用 `IridescentlyNav.mount()` |
| `brand/iridescently-mark.svg` | **品牌标**：像素直角坐标系，红绿蓝三球（16×16 网格） | 站点导航、样式指南；PNG 副本在 `portal/www/assets/iridescently-mark.png` |
| `lxh-ui.css` / `lxh-ui.js` | 游戏画风组件（HUD、面板、气泡、按钮…）与 **加载状态** `.qc-loading` | 众生之门、模块、样式指南 |
| `lxh-intro.js` / `intro-controls.css` | 开场进度条与跳过控件 | 众生之门开场、会馆首页开场 |
| `lxh/` | 组件运行时真正引用的图片（约 8 MB） | 见下文 |

## 站点导航怎么接

```html
<!-- 普通页面：自动挂载，并给 body 让出栏高（--qc-nav-h） -->
<script src="https://iridescently.xyz/shared/shared-ui/site-nav.js?v=20261017"></script>

<!-- 全屏沉浸首屏（节气画廊）：透明叠在画面上，不让位 -->
<script src="https://iridescently.xyz/shared/shared-ui/site-nav.js?v=20261017" data-variant="overlay"></script>
```

- 页面自己的按钮放进 `IridescentlyNav.slot()`，不要再用 `position: fixed` 占右上角。
- 自带账户界面的页面先设 `window.__HUIGUAN_OWN_AUTH = true`，再往 `#authBar` 渲染；其他页面由导航读取 `/api/sso-user`。
- 站内子导航（众生之门页签、模块壳）是一条米白本地栏，`position: sticky; top: var(--qc-nav-h)`，放在全局栏下面。一页只有一条深色栏。
- 在众生之门模块壳里（`window.__iridescentlyEmbed`）导航不重复挂载；单独打开的模块由 `design-system/game-nav.js` 挂上全局栏和「回门庭」。
- 旧地址 `portal/www/assets/shared-chrome-v2.js` 只是转发到本组件，供缓存里的旧页面使用；新页面不要再引用它。

## 加载状态

内容未到时，在内容将出现的位置显示 `.qc-loading`（细进度线 + 一句话），不要另起全屏加载页；页面级等待加 `.qc-loading--page`，出错改 `role="alert"` 并给重试按钮。

## `lxh/` 只放运行时素材

`lxh/` 下的文件会随站点发布并公开可访问。只有被代码引用的图片放这里，按用途分子目录（`ui/`、`scenes/`、`ai-avatars/`…），文件名用小写英文短横线描述内容。

截图、对照稿、聊天/小红书截屏等**参考素材**放 [`docs/design-reference/`](../../docs/design-reference/README.md)：不公开、不进发布快照。2026-10-17 已把 258 个未被引用的参考图从这里移过去（103 MB → 8.6 MB）。

`lxh/ui/选种族/` 是尚未入库的素材，保持原样，确认后再决定归属。
