# 西木会馆 · Design System

> 维护方法参考《用 AI 维护一套设计系统》：design token + 组件库 + 规范文档，并映射到代码。
> 代码入口：`design-system/design-system.css`。所有新页面/新组件必须复用本系统，禁止硬编码色值。

## 一、Design Tokens（见 design-system.css `:root`）

| 类别 | Token | 值 | 用途 |
|---|---|---|---|
| 色彩 | --qc-bg | #f5f0e8 | 页面底（乳白宣纸） |
| 色彩 | --qc-panel | #fbf8f2 | 卡片/面板底 |
| 色彩 | --qc-border | #d4cfbe | 描边 |
| 色彩 | --qc-text | #3a4a3e | 正文（墨绿） |
| 色彩 | --qc-dim | #7a8a7e | 次级文字 |
| 色彩 | --qc-accent | #5a9e8f | 主色（松绿） |
| 色彩 | --qc-gold | #d4a840 | 点缀（描金） |
| 色彩 | --qc-danger | #b3543f | 警示（赭红） |
| 字体 | --qc-font-body | Noto Serif SC | 正文衬线 |
| 字体 | --qc-font-hand | LXGW WenKai | 导航/手写感 |
| 圆角 | --qc-r-sm/md/lg/xl | 4/6/10/12px | 由小到大 |
| 阴影 | --qc-shadow-sm/md/lg | — | 卡片/悬浮/弹窗 |

派生透明色（--qc-accent-glow 等）由主色派生，**不要硬编码 rgba**。

## 二、组件清单（qc- 前缀）

| 组件 | 类名 | 用途 | 何时用 | 何时不用 |
|---|---|---|---|---|
| 按钮 | .qc-btn | 主操作 | 提交/确认 | 纯链接用 <a> |
| 按钮·幽灵 | .qc-btn--ghost | 次操作 | 取消/返回 | 主操作用实心 |
| 按钮·金 | .qc-btn--gold | 强调 | 申请/会员 | 普通操作用主色 |
| 按钮·危险 | .qc-btn--danger | 破坏 | 删除/封禁 | 非破坏操作 |
| 卡片 | .qc-card | 内容容器 | 信息块/列表项 | 纯文本段落 |
| 卡片·悬浮 | .qc-card--hover | 可点卡片 | 画廊/跳转 | 静态展示 |
| 标签 | .qc-tag | 状态/分类 | 角色/完整度 | 长文本 |
| 输入 | .qc-input/.qc-select/.qc-textarea | 表单 | 编辑/搜索 | 只读展示 |
| 表格 | .qc-table | 结构化数据 | 成员/审核列表 | 少量键值用卡片 |
| 弹窗 | .qc-modal | 覆盖交互 | 确认/编辑/删除 | 轻提示用 toast |
| 横幅 | .qc-banner | 引导/公告 | 申请/入口 | 常规内容 |
| 标题 | .qc-h2 | 区块标题 | 分节 | 页面主标题 |
| 色板 | .qc-swatch / .qc-swatch-grid | 古色色板 | 配色选色 | 纯展示色卡 |
| 页签 | .qc-tabs / .qc-tab | 五行/分类切换 | 色库分类 | 导航级页签 |
| 选色槽 | .qc-slot / .qc-slots | 主色/辅色槽位 | 双槽选色 | 单色展示 |
| 上传区 | .qc-upload | 点击/拖拽上传 | 图片上传 | 表单附件 |
| 滑块 | .qc-range | 范围调节 | 透明度/缩放 | 精确数值输入 |

## 三、Rules（给 AI / 开发的硬约束）

1. 只能用 `src` 级组件（本文件 qc- 类），**不允许新建组件**；确需新组件先更新本文档与 css。
2. **不允许硬编码色值**；一律用 token（--qc-*）。
3. 间距/圆角/字号用 token（--qc-sp-* / --qc-r-* / --qc-fs-*）。
4. 新增组件类型或发现好看风格 → **反哺**回本系统（持续反哺原则）。
5. 定稿前让 AI 用组件库重画一遍，确保复用已有组件。
6. 定期用 AI 做 UI 体检：交互是否符合原则、视觉是否一致。

## 四、扩展色库 · 中国古色 · 五行

- 数据源：`design-system/ancient-colors.js`（window.ANCIENT_COLORS，金/木/水/火/土 五类，479+ 色，每色 {h:HEX, n:色名}）。
- 可视化：`design-system/colors.html`（按五行浏览、搜索、点击复制 HEX）。
- 用途：角色主题「自由选色」从该色库取色；设计新界面需传统色时优先从此库选，保持文化一致性。
- 主站 index.html 的「自由选色 · 479 种中国古色 · 五行归类」与此同源。

## 五、映射到代码

- 组件 ↔ 代码：所有页面引用 `design-system/design-system.css`，类名即契约。
- 样式指南/演示：`design-system/index.html`（可视化全部 token 与组件）。
- 游戏界面组件库：`/design-system/components.html`（第十节）展示共享 `shared/shared-ui/lxh-ui.css`、`lxh-ui.js` 的全部组件、状态与用法；`/design-system/assets-library.html` 只展示接入素材库头像后的效果；它们参照的界面截图在 `docs/design-reference/lxh/`（不公开、不发布）。`shared/shared-ui/lxh/` 只放运行时引用的图片。
- 站点导航、加载状态、品牌标：`shared/shared-ui/site-nav.js`、`lxh-ui.css` 的 `.qc-loading`、`shared/shared-ui/brand/`；接法见 `shared/shared-ui/README.md`，规则见下文第七节。
- 开场进度与跳过控件：`shared/shared-ui/intro-controls.css` 和 `lxh-intro.js`；样式指南中的 Intro Controls 示例展示实际共享样式。会馆与众生之门各自保留场景状态，仅复用控件契约。
- 管理入口：管理员通过审核中心顶部“设计系统”进入样式指南。入口仅在 `/api/user` 确认管理员后显示。

## 六、布局约束

- 同一屏幕边缘的操作控件必须归属同一 flex 控件组，并用 `gap` 留出间距；不得让多个独立的 `position: fixed` 控件占用同一角落。全屏开场已有控件组时，新增切换按钮挂入该组的预留挂载点，并由容器统一控制边距、换行与窄屏排布。
- 新增角落控件前检查所在页面已有的导航、声音、语言和辅助入口；断点变窄时仍须可见、可点且彼此不重叠。

## 七、站点导航 · 加载状态 · 品牌标（2026-10-17）

### 站点导航（全局栏）

三站与所有游戏模块共用一条 48px 全局栏，代码只有 `shared/shared-ui/site-nav.js` 一份。

| 区域 | 内容 | 规则 |
| --- | --- | --- |
| 左 | 像素品牌标 + Iridescently | 品牌标垫宣纸色方块；窄屏只留标 |
| 中 | 节气画廊 · 西木会馆 · 众生之门 β · 更多 | 三站并列；当前站点 2px 描金下划线；其余入口收进「更多」 |
| 右 | 页面插槽 · 语言 · 账户 | 页面自己的按钮进 `IridescentlyNav.slot()` |

| Token | 值 | 用途 |
| --- | --- | --- |
| `--qc-nav-h` | 48px（运行时写回实际高度） | 本地栏 `top`、内容区让位 |
| `--qc-nav-ink` | #13241e 松烟 | 栏底 |
| `--qc-nav-paper` | #f4eedf 宣纸 | 栏上文字、品牌标底 |
| `--qc-nav-gold` | #e6c06a 描金 | 当前站点、焦点环 |

- **一页一条全局栏。** 站内子导航（众生之门页签、模块壳页签）是全局栏下方的米白本地栏：`position: sticky; top: var(--qc-nav-h)`，当前页签同样用描金下划线。
- **磨砂玻璃栏。** 与节气画廊右下角「贺图计数 / 方向键」控件同一套：半透明底、`backdrop-filter: blur(14px) saturate(1.3)`、1px 发丝边、顶部柔和高光；颜色全走 `#qc-nav` 上的 `--qc-fg / --qc-glass / --qc-edge / --qc-hi / --qc-panel` 变量。
- **沉浸首屏**（节气画廊）用 `data-variant="overlay"`：更透的深色玻璃叠在画面上。米白浅色页面（connections）用 `data-tone="light"`：米白玻璃 + 墨色字。其余页面默认深墨玻璃，几何与条目不变。
- **开场与初始化不显示全局栏**：众生之门开场动画、玩家初始化是全屏体验，进入门庭后才挂栏。
- 窄屏（≤720px）保持单行 48px：隐藏文字标、beta 角标、页面插槽里的次要按钮；「更多」面板改为整宽下拉。
- 不再使用：`shared-chrome-v2.js`（已转发到新组件）、会馆首页的右上角胶囊栏、`game-nav.js` 的第二条深色栏、模块壳的自绘顶栏、主站的独立 `.site-chrome`。

### 加载状态 `.qc-loading`

- 在内容将要出现的位置显示：一条细描金进度线 + 一句具体说明（「正在读取旅途存档…」），不另起全屏加载页，不换底色。
- 页面级等待加 `.qc-loading--page`（铺满全局栏以下的视口，宣纸底）。
- 出错改 `role="alert"`：说明发生了什么，并给出「重新读取」按钮。
- 能预取就预取：众生之门在开场动画播放时空闲加载门庭代码，进门时不再停在加载页。

### 品牌标

像素直角坐标系：三条墨色坐标轴从原点伸出，+Y 端红球、+X 端绿球、+Z（左下斜）端蓝球，对应 RGB ↔ XYZ。16×16 网格，只能整数倍缩放并加 `image-rendering: pixelated`；放在深色底上时垫宣纸色圆角方块。源文件 `shared/shared-ui/brand/iridescently-mark.svg`，PNG 副本 `portal/www/assets/iridescently-mark.png`（开场角标、旧页面）。

## 十、游戏界面组件库 lxh-ui（2026-10-20）

众生之门、各游戏模块和会馆页面共用的游戏画面组件，与本文件的 `qc-` 站点组件并列。真身在 `shared/shared-ui/lxh-ui.css` / `lxh-ui.js`，组件库页面 `design-system/components.html`（样式指南首页有入口）。接法见 `shared/shared-ui/README.md`。

### 两层 token

| 层 | 前缀 | 定义处 | 用在 |
| --- | --- | --- | --- |
| 站点 | `--qc-*` | `design-system.css` | 会馆页面、表单、表格、站点弹窗 |
| 游戏画面 | `--lxh-*` | `lxh-ui.css` | HUD、面板、气泡、游戏按钮、模块界面 |

- 两层共享的语义只定义一次：`--lxh-danger: var(--qc-danger, #b3543f)`；`.qc-loading` 的颜色读 `--qc-*`，没引入 `design-system.css` 时回退到 `--lxh-*`。
- 新增语义 token：`--lxh-on-fill`（实心色块上的字）、`--lxh-on-ochre`（亮橙块上的字）、`--lxh-yes-fill` / `--lxh-no-fill`（按钮底，比 `--lxh-yes` / `--lxh-no` 深一档）、`--lxh-ok`、`--lxh-focus` / `--lxh-focus-on-dark`、`--lxh-tap`（44px）、`--lxh-dur`、`--lxh-scrim`、`--lxh-z-modal`、`--lxh-r-sm/md/lg/xl`，以及原先写死在组件里的面板、格子、选中色。
- 唯一改了值的 token：`--lxh-text-dim` 从 `#8b9181` 加深到 `#666d5e`（乳白底上 2.9:1 → 4.8:1）。用到它的是 `.qc-loading` 的说明文字和灵境玩耍页，变化是字更清楚。

### 组件清单

| 组件 | 类名 / 脚本 | 用途 |
| --- | --- | --- |
| 按钮 | `.lxh-btn` + `--yes` / `--no` / `--danger` / `--ghost` / `--sm`；`LXHUI.button()`、`setBusy()` | 游戏内是/否、提交、破坏性操作 |
| 输入框 | `.lxh-field` / `.lxh-input`（`--dark`）；`LXHUI.field()` | 起名、搜索、数值输入 |
| 加载与出错 | `.qc-loading`（`--page` / `--inline` / `--dark`）；`LXHUI.loading()` | 等待、读取失败与恢复 |
| 确认框 | `.lxh-modal` / `.lxh-confirm`；`LXHUI.confirm()` | 退出、转账、放生等确认 |
| 主 HUD | `.lxh-hud`、`.lxh-fbtn`（`.is-on`、`.lxh-fbtn__dot`）；`LXHUI.hud()` | 平板式主界面 |
| 面板 | `charpanel` / `filmcard` / `phone` / `mail` / `wxnode` | 角色属性、装饰卡、游戏内手机 |
| 社交 | `nameplate` / `chatbubble` / `friends` | 名牌、聊天、好友定位 |
| 数值 | `counter` / `expbar` / `lvchart` / `radar6` / `radar5` | 计数、经验、等级、能力雷达 |
| 选择 | `racegrid` / `racetree` / `avaframe` | 种族选择、谱系、头像框 |
| 图标 | `LXHUI.ICONS`（原始 SVG 字符串）、`LXHUI.LABELS`（中文读屏名） | 模块内图标 |

### 规则

1. **向后兼容。** 已有类名、token 名和 `LXHUI` 参数不删、不改含义，新造型用修饰类。改选择器前先搜消费者（`server/app/src`、`portal/`）。
2. **状态齐全。** 可点控件要有悬停、按下、`:focus-visible`、禁用（`:disabled` / `aria-disabled`）和提交中（`aria-busy`）；输入框要有校验失败（`aria-invalid` + `.lxh-field__err` + `aria-describedby`）。
3. **触控与对比。** 可点区不小于 44px，视觉更小的钮用 `::before` 扩大触控区；正文对比不低于 4.5:1。焦点环浅底用青玉，深底用描金：库里的深色组件已自动切换，自定义深色容器加 `data-lxh-surface="dark"`。
4. **文本转义。** 数据字段（`name`、`text`、`id`、头像 URL）自动转义；`title`、`hint`、`intro`、`abilities` 接受可信 HTML，不放用户输入。
5. **弹窗行为。** `LXHUI.confirm()` 与 `qc-modal.js` 一致：`role="dialog"`、焦点圈定、Esc / 点遮罩取消、关闭后焦点回到触发元素；默认焦点在「否」防误触；层级 10000，盖住全局栏。
6. **减少动态。** `prefers-reduced-motion: reduce` 时停掉状态闪烁、输入光标、提交扫光和过渡。
7. **模块要重建。** React / Vite 模块把 `lxh-ui.css` 打包进产物，改动要等该模块重新构建、发布后才生效；直接用 `<link>` 引用的页面（会馆、模块壳）刷新即生效。

### 本次修正（2026-10-20）

- 五行徽章 `.lxh-wxnode` 和五行星图节点上的字原为乳白压在乳白上（1.1:1），改为墨色。
- 「是 / 否」按钮、名牌 ID 块的乳白字对比从 2.8 / 3.3:1 提到 4.9 / 5.1:1（按钮底改用 `--lxh-yes-fill` / `--lxh-no-fill`）；邮件角标改为深字。
- 确认框层级从 9996 提到 10000（原先在全局栏下面），并补齐 dialog 语义、焦点圈定和窄屏布局（≤480px 图标居中、按钮等宽）。
- 种族网格：格子用 `minmax(0, 1fr)`，大图不再撑破网格；类别栏可换行，390px 宽不溢出；格子和类别钮带 `aria-pressed`，可直接点选。
- 好友面板搜索框改为真实输入框，定位钮触控区补到 44px；名牌 ID 块随内容加宽。
- 所有库内按钮补 `type="button"`（放进表单不会误提交）和中文读屏名，装饰图标 `aria-hidden`。

