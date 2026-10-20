# shared-ui · 站群组件库

节气画廊（iridescently.xyz）、西木会馆（huiguan.*）、众生之门（zszm.* 与各游戏模块）共用的界面组件与品牌资源。这里是真身：会馆的 `portal/huiguan/design-system/ui` 是指向本目录的 junction，线上同时由 `https://<任一站点>/shared/shared-ui/…` 提供。

样式指南（含真实组件演示）：`https://huiguan.iridescently.xyz/design-system/`。规则与 token：[`portal/huiguan/design-system/design-system.md`](../../portal/huiguan/design-system/design-system.md)。

## 目录

| 路径 | 内容 | 消费者 |
| --- | --- | --- |
| `site-nav.js` | **站点导航**：三站共用的唯一全局栏（品牌标、三站切换、更多、页面插槽、语言、账户） | 所有页面；React 应用 `import '@lxh/shared-ui/site-nav.js'` 后调用 `IridescentlyNav.mount()` |
| `brand/iridescently-mark.svg` | **品牌标**：像素直角坐标系，红绿蓝三球（16×16 网格） | 站点导航、样式指南；PNG 副本在 `portal/www/assets/iridescently-mark.png` |
| `lxh-ui.css` / `lxh-ui.js` | **游戏界面组件库**：HUD、面板、气泡、按钮、输入框、确认框，以及 **加载状态** `.qc-loading`。组件库页面：`/design-system/components.html` | 众生之门、模块、会馆页面、样式指南 |
| `lxh-intro.js` / `intro-controls.css` | 开场进度条与跳过控件 | 众生之门开场、会馆首页开场 |
| `lxh/` | 组件运行时真正引用的图片（约 8 MB） | 见下文 |

## 游戏界面组件库 lxh-ui

实时示例、全部状态、token 和可复制用法：`https://huiguan.iridescently.xyz/design-system/components.html`（源码 `portal/huiguan/design-system/components.html`）。

```html
<link rel="stylesheet" href="/design-system/ui/lxh-ui.css?v=20261020">   <!-- 其他站点：/shared/shared-ui/lxh-ui.css -->
<script src="/design-system/ui/lxh-ui.js?v=20261020"></script>            <!-- 之后使用 window.LXHUI -->
```

React / Vite 模块用 `import '@lxh/shared-ui/lxh-ui.css'` 和 `import '@lxh/shared-ui/lxh-ui.js'`。模块的构建产物会把 CSS 打包进去，改了本目录后要重新构建该模块才会生效。

- **类名是契约。** 现有类名、`--lxh-*` token 名和 `LXHUI` 的参数都不能删、不能改含义；要新造型就加修饰类。动选择器前先搜 `server/app/src` 和 `portal/` 里的消费者。目前模块只用到 token、`.qc-loading` 和 `LXHUI.ICONS`；组件类主要在样式指南和 slay 预览页里用。
- **两层 token。** `--qc-*` 属于会馆和站点页面（`design-system.css`），`--lxh-*` 属于游戏画面（`lxh-ui.css`）。危险色同源：`--lxh-danger` 引用 `--qc-danger`。组件里不写色值，新颜色先加 token。
- **状态基线（2026-10-20）。** 可点控件都有悬停、按下、`:focus-visible` 焦点环（浅底青玉 `--lxh-focus`，深底描金 `--lxh-focus-on-dark`）、`:disabled` / `aria-disabled`、提交中 `aria-busy="true"`；输入框有 `aria-invalid` 校验失败。触控区不小于 `--lxh-tap`（44px）。开启「减少动态效果」时停掉闪烁和扫光。
- **基础件。** `.lxh-btn`（`--yes` / `--no` / `--danger` / `--ghost` / `--sm`）、`.lxh-field` + `.lxh-input`（`--dark`）、`.qc-loading`（`--page` / `--inline` / `--dark`）。脚本：`LXHUI.button()`、`setBusy()`、`field()`、`loading()`、`confirm()`。
- **文本转义。** `name`、`text`、`id` 等数据字段自动转义，可以放玩家输入；`title`、`hint`、`intro`、`abilities` 接受可信 HTML（如 `<br>`），不要把用户输入放进去。
- **确认框。** `LXHUI.confirm()` 是带 `role="dialog"` 的模态框：焦点先落在「否」，Tab 只在框内循环，Esc 或点遮罩等于「否」，关闭后焦点回到原处；`onYes` 返回 Promise 时「是」显示提交中，完成后再关闭。层级 `--lxh-z-modal: 10000`，盖住全局栏。

## 站点导航怎么接

```html
<!-- 普通页面：自动挂载，并给 body 让出栏高（--qc-nav-h） -->
<script src="https://iridescently.xyz/shared/shared-ui/site-nav.js?v=20261017"></script>

<!-- 全屏沉浸首屏（节气画廊）：透明叠在画面上，不让位 -->
<script src="https://iridescently.xyz/shared/shared-ui/site-nav.js?v=20261017" data-variant="overlay"></script>
```

- 页面自己的按钮放进 `IridescentlyNav.slot()`（元素类名 `.qc-nav-slot`，不要用 `.qc-slot` 选它，那是配色选色槽），不要再用 `position: fixed` 占右上角。
- 自带账户界面的页面先设 `window.__HUIGUAN_OWN_AUTH = true`，再往 `#authBar` 渲染；其他页面由导航读取 `/api/sso-user`。
- 站内子导航（众生之门页签、模块壳）是一条米白本地栏，`position: sticky; top: var(--qc-nav-h)`，放在全局栏下面。一页只有一条深色栏。
- 在众生之门模块壳里（`window.__iridescentlyEmbed`）导航不重复挂载；单独打开的模块由 `design-system/game-nav.js` 挂上全局栏和「回门庭」。
- 旧地址 `portal/www/assets/shared-chrome-v2.js` 只是转发到本组件，供缓存里的旧页面使用；新页面不要再引用它。

## 加载状态

内容未到时，在内容将出现的位置显示 `.qc-loading`（细进度线 + 一句话），不要另起全屏加载页；页面级等待加 `.qc-loading--page`，出错改 `role="alert"` 并给重试按钮。

恢复入口放进 `.qc-loading__actions`（可多个 `<button>` / `<a>`，已带 36/44px 触控高度和键盘焦点环）。颜色全走 `--lxh-*` / `--qc-*` token。会馆页面引入 `/design-system/ui/lxh-ui.css` 即可使用，示例见 `portal/huiguan/security.html`；状态写法见设计系统第八节。

## `lxh/` 只放运行时素材

`lxh/` 下的文件会随站点发布并公开可访问。只有被代码引用的图片放这里，按用途分子目录（`ui/`、`scenes/`、`ai-avatars/`…），文件名用小写英文短横线描述内容。

截图、对照稿、聊天/小红书截屏等**参考素材**放 [`docs/design-reference/`](../../docs/design-reference/README.md)：不公开、不进发布快照。2026-10-17 已把 258 个未被引用的参考图从这里移过去（103 MB → 8.6 MB）。

`lxh/ui/选种族/` 是尚未入库的素材，保持原样，确认后再决定归属。
