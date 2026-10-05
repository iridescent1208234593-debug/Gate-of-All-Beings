# Iridescently 主站首页

主域 `/` 由 `portal/www/index.html` 提供。页面结构源文件是 `homepage.html`；运行首页构建后，Vite 会把它编译到根目录 `index.html`，并把首页脚本、样式和图库素材发布到 `assets/homepage/`。入口会按脚本与样式内容附加版本号，更新后不会继续命中旧缓存。

首页直接接入已完成的 Atmospheric Gallery 源码与 `assets/罗小黑战记数据库/罗小黑节气贺图（gallery素材）`。图库插件递归发现图片并生成清单；生产构建会校验所有发布图片与图库源文件 SHA-256 一致。首页构建不修改 Gallery 项目。

从项目根目录运行：

```powershell
npm run dev:homepage
npm run build:homepage
npm run build:modules
```

开发预览地址：`http://127.0.0.1:5173/assets/homepage/homepage.html`。
`build:modules` 会在构建模块时一并生成正式首页。若 Gallery 项目的依赖目录尚未安装，先运行：

```powershell
npm ci --prefix "New project/gallery/codrops-depth-gallery"
```

## 修改入口

- 首页标题、说明文字、图库状态、导航内容与菜单链接：`homepage.html`
- 站点标志图片：`assets/iridescently-mark.png`；靠近站名字样时显示颜文字：`scripts/brand-interaction.js` 与 `styles/chrome.css`
- Gallery 启动、桌面画面居中、节气图标题、单张步进、键盘控制、autoplay、启动反馈和资源生命周期：`scripts/gallery.js`。自动播放默认关闭；开启后每张停留 8 秒、到达两端会折返。滚动、方向键、前后按钮和控制带操作都会把下一次播放延后 8 秒；Gallery 的滚动与按键仍由用户优先控制。系统减少动态效果时不会自动启动，运行中切换到减少动态效果会暂停。
- 可调观感控制带及偏好：`scripts/appearance-controls.js`。右侧设置按钮横向展开六项滑块，默认收起且不占布局空间。六项观感与 autoplay 开关通过 `shared/shared-session/save.js` 保存在 `localStorage['iridescently.save.v1']`，使用 `homepage.appearance.v1:account:<kind>:<uid>` 区分账户，匿名设置单独使用 `homepage.appearance.v1:anonymous`。旧首页 v1/v2 本地值只在首次账户没有 Appearance 值时迁移一次；已有账户值优先。当前 shared-session save 没有云端通用偏好接口，因此按账户分区只在本浏览器持久化，不提供跨设备同步。连续拖动即时预览，滑块松开后本地保存；系统减少动态效果仍优先于账户中的微动值。
- 当前页导航保护：`scripts/site-navigation.js` 根据 canonical path 标记 `aria-current="page"`，并阻止重复导航到当前首页。
- 首页脚本入口：`scripts/homepage.js`
- 首页色彩、字体、画布背景、focus 和 loading：`styles/home.css`
- 桌面导航、菜单、图库控制与横向设置带：`styles/chrome.css`
- 平板与手机排布、图片尺寸、图库标题的移动端可读性：`styles/responsive.css` 与 `scripts/gallery.js`。手机端会再收窄贺图，并按横图宽高比限制画布占宽，保持完整图片可见；设置带默认折叠，展开时覆盖画面。
- 上游 Gallery 源码路径、资源目录和 Vite 构建配置：`vite.config.mjs`
- 资源校验、发布目录和根首页构建：`scripts/build-homepage.mjs`
- Connections / Credits 页面结构与站内链接：`connections.html`；其独立视觉样式和友站/鸣谢数据渲染及原有管理员编辑：`styles/connections.css`、`scripts/connections.js`。可维护的友站数据在 `links.json`，鸣谢数据在 `thanks.json`；开源项目的作者、用途和许可证说明直接维护在页面 HTML 中。

本轮正式首页截图保存在根目录 `docs/homepage-acceptance-assets/`：桌面 1440 CSS 像素宽见 [`desktop-1440.png`](../../docs/homepage-acceptance-assets/desktop-1440.png)，手机 390 CSS 像素宽见 [`mobile-390.png`](../../docs/homepage-acceptance-assets/mobile-390.png)。
