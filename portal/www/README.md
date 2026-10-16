# Iridescently 主站首页

主域 `/` 由 `portal/www/index.html` 提供。页面结构源文件是 `homepage.html`；首页构建只生成 `.releases/candidate/homepage/index.html` 及 `assets/homepage/` 候选资源。检查后执行 `npm run publish:homepage` 才更新当前目录中的正式 `index.html` 与 `assets/homepage/`。入口会按脚本与样式内容附加版本号，更新后不会继续命中旧缓存。候选与生产版本记录见 [发布流程](../../docs/release-workflow.md)。

首页直接接入已完成的 Atmospheric Gallery 源码与 `assets/罗小黑战记数据库/罗小黑节气贺图（gallery素材）`。图库插件递归发现图片并生成清单；生产构建会校验所有发布图片与图库源文件 SHA-256 一致。首页构建不修改 Gallery 项目。

从项目根目录运行：

```powershell
npm run dev:homepage
npm run build:homepage
npm run build:modules
npm run publish:homepage # 检查首页候选后显式发布
```

开发预览地址：`http://127.0.0.1:5173/assets/homepage/homepage.html`。
`build:modules` 会在构建模块时一并生成首页候选；显式 `publish:modules` 才将模块与首页一起发布。若 Gallery 项目的依赖目录尚未安装，先运行：

```powershell
npm ci --prefix "portal/www/gallery-engine"
```

## 修改入口

- 站群页面内中英文切换与文案词条：`assets/site-language.js`。偏好写入 `Domain=.iridescently.xyz` 的一年期 first-party cookie，匿名用户也可在子域间保留；不接触登录资料或角色内容。`shared-chrome-v2.js`、主站 Gallery / Connections、会馆页面与众生之门 Cards 入口加载该脚本；Softie 模块保持独立，不由此脚本改动。

- 首页标题、说明文字、图库状态、导航内容与菜单链接：`homepage.html`。右侧主导航、Beta 标、分隔线与连接入口样式在 `styles/chrome.css`，小屏间距在 `styles/responsive.css`。
- 站点标志图片：`assets/iridescently-mark.png`，由 `scripts/homepage.js` 按 Vite 资源路径载入。站名字样在桌面悬停或键盘聚焦时随机切换七种颜文字，手机点按可切换、再次点按还原：`scripts/brand-interaction.js` 与 `styles/chrome.css`（Connections 页使用 `styles/connections.css`）。
- Gallery 启动、桌面画面居中、节气图标题、单张步进、键盘控制、autoplay、启动反馈和资源生命周期：`scripts/gallery.js`。生产与开发默认使用本地图库；只有显式设置 `VITE_ASSET_BASE_URL` 才覆盖为 CDN 根地址，不把已有 Pilot 当作整库上线。自动播放默认关闭，默认约每 4.5 秒一张；自定义设置中的速度滑块可调 1–10 秒，右侧实时显示当前“X 秒/张”，并沿用 Appearance 偏好存储。开启后立即开始浏览，播放间隔包含图片移动时间，到达两端会折返。左右按钮短按移动一张，长按约 250 ms 后以约 380 ms 的节奏连续浏览，松开即停止且不补发单击；手动滚动和导航会延后下一轮自动播放。系统减少动态效果时不会自动启动，用户可明确点按开启；运行中切换到减少动态效果会暂停。新用户与“恢复默认”的过渡、停留分别设为 0 和 100；已有个人偏好继续优先。
- 同页音乐控制带与三首本地曲目：`scripts/music-player.js`、`assets/music/`。音符入口位于画廊上方；页面载入时优先尝试播放《早安喵》，浏览器禁止有声自动播放时会在首次用户操作后重试。单曲结束后停留，不自动切歌；用户仍可在控制带手动切歌、暂停/播放和拖动进度，操作不会触发 Gallery 手势。《不再流浪》的源文件实际是 AAC/M4A 容器，因此项目内以 `.m4a` 保存。第三首当前附件无法按标准 FLAC 解码，浏览器会显示格式错误；提供普通 FLAC/MP3 文件后可直接替换。
- 可调观感控制带及偏好：`scripts/appearance-controls.js`。右侧设置按钮横向展开六项滑块，默认收起且不占布局空间。六项观感与 autoplay 开关通过 `shared/shared-session/save.js` 保存在 `localStorage['iridescently.save.v1']`，使用 `homepage.appearance.v1:account:<kind>:<uid>` 区分账户，匿名设置单独使用 `homepage.appearance.v1:anonymous`。旧首页 v1/v2 本地值只在首次账户没有 Appearance 值时迁移一次；已有账户值优先。当前 shared-session save 没有云端通用偏好接口，因此按账户分区只在本浏览器持久化，不提供跨设备同步。连续拖动即时预览，滑块松开后本地保存；系统减少动态效果仍优先于账户中的微动值。
- 当前页导航保护与站点状态点：`scripts/site-navigation.js` 根据 canonical path 标记 `aria-current="page"`，并阻止重复导航到当前首页；它读取 `/api/site-status`，45 秒缓存的可达性由 `server.py` 探测。心理档案云按“未并入本站”显示红点，即使直达域名当前可访问。
- 首页脚本入口：`scripts/homepage.js`
- 首页色彩、字体、画布背景、focus 和 loading：`styles/home.css`
- 桌面导航、菜单、图库控制与横向设置带：`styles/chrome.css`；设置展开后有轻薄磨砂底层，提升鲜艳背景上的可读性
- 平板与手机排布、图片尺寸、图库标题的移动端可读性：`styles/responsive.css` 与 `scripts/gallery.js`。手机端会再收窄贺图，并按横图宽高比限制画布占宽，保持完整图片可见；设置带默认折叠，展开时覆盖画面。
- 上游 Gallery 源码路径、资源目录和 Vite 构建配置：`vite.config.mjs`
- 资源校验与首页候选构建：`scripts/build-homepage.mjs`；显式发布与回滚保护：根目录 `ops/publish-release.mjs`
- Connections / Credits 页面结构与站内链接：`connections.html`；独立视觉样式与友站/鸣谢数据渲染：`styles/connections.css`、`scripts/connections.js`。动态友站和常规鸣谢数据来自 `links.json`、`thanks.json`；特别鸣谢与联系/讨论入口直接维护在 HTML 中。

Connections 顶部项目足迹在 `connections.html` 的 `#project-history` 中追加节点；日期来自 `docs/项目鸣谢/感谢各位.md`，未补猜年份。每次有较大改动正式发布时，都在这里补一条日期和简短变更说明；同一发布周期内相关小提交合并为一条，随发布页面一同更新。特别感谢与可折叠的 13 位社区贡献者分别在 `#with-thanks`、`#community-thanks`，描述以用户确认版本为准。抖音与小红书分享链接归佳霖个人，在 `#contact`，不属于小黑窝社区。三张二维码为 `assets/wechat-personal-qr.png`、`assets/wechat-reward-qr.png`、`assets/wechat-group-qr.png`；旧群码已原路径替换，页面附版本参数刷新缓存，群码到期需要更换图片并更新有效期提示。二维码不裁切、不重绘，点击可查看原图。视觉样式仍在 `styles/connections.css`，未变更友站 / 常规鸣谢的管理接口。

此前的首页验收基线截图（2026-10-04）保存在根目录 `docs/homepage-acceptance-assets/`：桌面见 [`desktop-1440.png`](../../docs/homepage-acceptance-assets/desktop-1440.png)，手机见 [`mobile-390.png`](../../docs/homepage-acceptance-assets/mobile-390.png)。

2026-10-14 发布边界：`build:site` 从审查后的 Git HEAD 冻结静态页面/Python源码，`publish:site` 后由管家重启。运行期 links.json/thanks.json 留在原目录，管理员编辑不写入源码快照。Gallery 核心在 gallery-engine；实验/参考已迁往外部 Labs。
