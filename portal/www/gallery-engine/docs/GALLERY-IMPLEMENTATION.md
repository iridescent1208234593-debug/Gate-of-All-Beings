# 真实 Gallery 实现与验证

## 1. 最终方案与取舍

使用小型 Vite 插件 + virtual module + 有界纹理窗口 + ColorThief Worker。没有新增依赖、UI 框架、状态库、独立 atmosphere transition 或自研量化算法。Scroll 和 Background（包括 GLSL）保持原实现。

## 2. 修改文件

新增：`gallery-plugin.js`、`src/data/palette.js`、`src/data/palette-worker.js`、`src/Experience/GalleryResources.js`、`tests/gallery.mjs`、本说明。

修改：`vite.config.js`、`src/data/galleryData.js`、`src/Experience/Gallery.js`、`src/Experience/Engine.js`、`src/Experience/Label.js`、`src/Experience/index.js`、`src/main.js`、`src/css/canvas.css`、`package.json`、`README.md`。

`package-lock.json` 的 ColorThief 安装变更在本轮开始前已经存在，予以保留。

## 3. 外部文件发现与暴露

默认读取用户指定目录，支持环境变量 `GALLERY_DIR` 覆盖。递归发现 `.jpg/.jpeg/.png/.webp`，大小写不敏感，排除目录、符号链接及其他格式。开发路由只服务清单内 WebP 预览；`/gallery-files/` 原图路径在开发与主站服务器均被关闭。正式原图由主站 `/api/gallery/original` 接口读取，并要求通过签名 SSO 和站长账户状态复核。使用 Node 原生文件监听，不受 Vite 忽略目录规则影响。

## 4. Manifest / data

插件启动/构建时从文件系统生成 `virtual:gallery`：相对路径、原始 filename、去扩展名的 title、size/mtime 版本和编码 URL。前端 `galleryData.js` 自动生成布局数据，无逐图 import 或手工列表。开发时增加、删除、修改图片会重新扫描并刷新页面。

构建只把生成的 WebP 预览逐文件复制到 `dist/gallery-previews`，原图不进入静态构建或 CDN。当前 384 张预览共 32,872,550 bytes；原图从 `asset-library/homepage-gallery` 私有持久目录读取。

## 5. 排序

`Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })` 对相对路径进行自然排序；比较相等时用原始字符串作为确定性第二排序条件。数字顺序为 1、2、3、10。不是按节气日历排序。

## 6. 文件名、图片和 UI

同一清单条目同时提供 URL、title 和 filename。标题仅去最后的图片扩展名，不改磁盘名称、不转大小写，通过 `textContent` 显示并允许换行。URL 每个路径段独立 `encodeURIComponent`，服务端只解码一次。正式 UI 显示序号/总数、真实标题及对应 accent 色点；原 demo 标题和 PMS/CMYK/RGB/HEX 展示已移除。

## 7–8. 取色方案与实际 API

继续使用已安装的 **colorthief 3.5.0**。[官方说明](https://github.com/lokesh/color-thief)与本地 3.5.0 的类型/源码均已检查。

Worker 使用 `getPaletteSync` 的 OKLCH 量化，12 色、quality 2、`ignoreWhite: false`、alphaThreshold 125。`classifySwatches` 在同一份 palette 上生成 Vibrant、Muted、DarkVibrant、DarkMuted、LightVibrant、LightMuted，避免重复量化。保留 `.hex()`、`.oklch()`、`.population`、`.proportion`；dominant 是占比最多的提取色。没有使用平均色作为 atmosphere。

本地源码和实际测试发现：全透明样本会触发库的过滤放宽，因此 Worker 在量化前检测有效 alpha；没有 alpha >=125 的像素时显式 fallback。普通透明 PNG 的隐藏 RGB 不参与有效取色。

## 9. 完整数据流

外部清单 → 当前/附近图片请求 → 异步 bitmap 解码 → 图片尽快可见 → 缩至最长边 160 的 RGBA sample → Worker ColorThief → palette / semantic roles / population → art-direction mapping → background/blob1/blob2/accent → Gallery 原有相邻 mood blend → Background 原有颜色插值 → 原 GLSL shader。

palette 到达时，先平滑更新该图片自己的 mood 数据，随后仍由原有深度插值使用；不重置背景，不增加中性色过渡阶段。

## 10. Art direction

在 OKLCH 中选择有代表性的色相：过滤占比低于 3.5% 的异常色，以占比平方根和受限 chroma 排序；Vibrant 类 swatch 只有代表性足够时才参与主色选择。第二色兼顾像素占比和色相距离。

背景 L 限制在 0.60–0.74，blob L 在 0.73–0.85，chroma 在 0.065–0.15；保持浓度，避免死黑、泛白和过饱和。明度区间经过现有 shader 的实际截图验证；shader 本身会将 blob 向背景混合 35%，未修改它。

单色图使用同色相明暗层次和 28° 邻近色相扩展；完全中性色采用冷色基调。真正的灰度/白色素材没有可靠色相，这里的冷色是明确的美术选择，不伪称图中本来有该色。

## 11. 加载与预载

当前图片优先，兼顾 fade/mood 两侧，默认预载前后 3 张。最多 2 个任务并发；离开窗口的网络请求取消。首屏不等待全部图片或 palettes。纹理最长边限制为 1536，取色 sample 为 160；原文件仅作为读取源，不写回。

## 12. 纹理缓存与释放

默认窗口通常最多 7 张纹理。离开窗口即移除材质引用、`texture.dispose()`、释放 canvas 像素；bitmap 用完 `close()`。透明度接近零的 plane 不渲染，避免无意义 GPU 上传。只在材质 map 改变时标记 needsUpdate，保留原 opacity lerp。

浏览全部 384 张的跳转扫描中，缓存峰值 7，renderer GPU texture 计数峰值 2；这是跳转扫描的实测值，连续 fade 时可能同时上传更多附近图片，但仍受窗口限制。Three.js 原有 StandardMaterial 会使用一个内部 16×16 DFG LUT，因此计数不是纯 Gallery 图片数量。

40 次快速跳转验证并发始终 <=2、纹理始终 <=7，无图片失败。完整 dispose 后 Gallery texture cache 为 0、plane 为 0、geometry 计数为 0、Worker 已停止。renderer 的 texture 计数仍有一个 Three 内部 DFG LUT，并非增长中的 Gallery 缓存。

原 parallax 的 `1 + index * 0.05` 在大图库会无限放大，现封顶为前五张的最大增益；前五张体验不变，后面保持同等级手感。

## 13. Palette cache

以包含文件版本的 source URL 为键保存 runtime Map，只保留小型分析结果和最终色值。纹理释放后 palette 仍可复用。实际缓存复访测试：第一轮产生 6 次新增分析，第二轮相同访问 **0 次** 新增分析。没有每帧重新取色，没有引入持久数据库。

## 14. Fallback 与 Debug

统一使用有颜色浓度的蓝/金/青 fallback。palette 未完成、Worker 异常、空透明图、取色异常和图片解码失败均有对应处理；损坏图片仍保留真实标题和背景。失败图片本次运行不无限重试，重新加载可重试。

按 D 显示原调参面板及当前图的 filename、相对路径、URL、palette、dominant、全部 semantic swatches、population/proportion、最终 mood、auto/fallback、错误信息、资源计数；默认隐藏。诊断文本最多每 250ms 刷新。`?inspect` 额外提供 `window.galleryDebug`，普通页面不暴露此入口。

## 15. 实际素材覆盖

浏览器逐窗口加载和取色覆盖 **全部 384 张真实图片**：PNG 252、JPG 124、JPEG 8。全部 auto 成功，得到 364 组不同最终 mood；不是声称每张图片都产生唯一颜色。

深色代表：2014年万圣节贺图.png；浅色代表：2024年元旦贺图1.png；低饱和代表：2018年小雪贺图.jpg；高饱和代表：2012年春节贺图.png。覆盖单色倾向和多色复杂真实图，并目视检查蓝色夜景、红金高饱和、浅色近白图的实际页面。

真实库没有 WebP，32×32 alpha 抽样也未检测到透明像素，不将它们算作真实素材覆盖。另建 8 个隔离 fixture：四种格式（包括由真实图转换的 WebP）、中文/空格/中英文括号/#%&+、透明图（透明区隐藏洋红而有效区蓝色）、全白、全透明、损坏图。普通透明图仅提取有效蓝色；全透明与损坏图 fallback。额外新增一个测试文件验证数量 8→9，删除验证 9→8，均自动刷新。

## 16. 原版 Gallery 工程与交互验证记录

- `npm run build`、`npm test`、`npm run lint`、插件/测试文件额外 ESLint、`git diff --check` 通过。
- 生产 preview 的中文 URL、图片显示、384 数量和 Worker auto 取色通过。
- 2026-10-19 独立 production build 确认只包含 384 张预览，不生成 `gallery-files/` 或 `.gallery-originals/`；互动手势和主站权限接口另有单元测试覆盖。
- 实际 mouse wheel/pointer 验证了速度响应、pointer 平滑、breath 倾斜、plane fade；一次采样 fade 两图 opacity 之和为 1，velocity 为 1.5，breath 约 0.652，grain 仍为 0.04，blob strength 随速度变化。
- 相邻 mood 在 0/25/50/75/100% 深度的采样保持原线性插值链路，无中性色重置调用。
- 真实 Gallery 控制台检查无错误；隔离损坏图产生预期 warning。越界文件请求 404，非法 URL 编码 400。

### 2026-10-19 图廊权限及互动更新

- `npm test` 覆盖发现/URL/调色及单击-双击手势；`python -m unittest server.test_gallery_interactions` 覆盖非管理员拒绝、私有原图接口、66 次门槛、跨图片单评论、25 字上限、CSRF 来源和重复提交。
- 独立 Vite production build 生成 384 张 WebP 预览，总计 32,872,550 bytes；未生成任何公开原图副本。主 JS 780,200 bytes（gzip 194,150 / Brotli 192,605 bytes），CSS 30,464 bytes（gzip 6,846 / Brotli 7,090 bytes）。
- 本轮未完成浏览器实机桌面/移动视觉验收：当前浏览器工具拒绝访问 loopback 预览地址；页面仍由本机 Vite 提供给用户手动审阅。

### 2026-10-20 图廊互动修正

- `gallery-interactions.mjs` 将原图入口移到容量说明旁，图廊内只保留轻量点赞、喜欢和评论痕迹。图片与按钮走相同的动作提交；Vite 开发预览将 `/api/gallery`、`/api/sso-user` 转到本地 8088，源图库的 `/@fs/` 访问被开发服务拒绝。
- 复用西木会馆 `reactions-fx.js` 的点赞/喜欢 SVG、520/620ms 动作节奏与随机散落反馈；当前图廊将这一层亮度降低。fan.html 原有点击语义和接口不变。
- 互动组件采用当前 plane 四角经 Three.js 投影得到的屏幕矩形。中心偏左则置右，偏右置左；空间不足时在图下或图上选择不遮画的安全区域，空间不足则暂时隐藏组件，图片手势仍可用。
- 同一用户同一图的点赞与喜欢累积为独立 `interaction_count`，在 0–66 间驱动磨砂、颜色、组件宽度和评论痕迹的连续变化；仅服务端确认达到 66 次才开放评论输入。评论在数据库上按账户唯一，服务端事务与测试覆盖并发提交。其他人评论默认只留淡痕，hover/轻触后一次最多读 3 条，再按需分页。
- `npm test` 覆盖单击/双击/四连点/长按和 375px、横屏、左右边缘投影布局；`python -m unittest server.test_gallery_interactions` 覆盖混合互动门槛、分页、原图权限及并发单评论。浏览器工具仍未提供本地 loopback 页面的实际可视验收，故不能把脚本布局测试写成实机视觉通过。

## 17. 当前限制

- GIF 未纳入此次支持；目录内 8 张 GIF 被排除。JPG/JPEG/PNG/WebP 均支持。
- 开发源变化采用页面刷新，会重置滚动与 runtime cache；生产输出新增素材后需重新 build/deploy。
- 当前默认路径是本机 Windows 路径；其他机器用 GALLERY_DIR。
- Gallery 只在浏览器解码 WebP 预览；完整原图仅在管理员主动选择后由主站接口提供。
- runtime cache 不跨刷新持久化。大量相似原图可能得到相同 mood。
- plane 元数据/material 随图库数量线性增加，每帧仍遍历 planes；数百张已测试，数万张未验证。
- 依赖现代浏览器 Worker、ImageData、createImageBitmap；不支持时使用 fallback。
- 当前 Vite build 的主 JS 为约 780 kB（gzip 约 193 kB），超过 500 kB 提示阈值但构建成功；当前工作没有扩展 Engine 或强行拆分核心依赖。
- 视觉质量已在代表性图片上目视检查，但不能据此声称逐张完成主观美术评价或全设备压力测试。

## 18. 最值得调节的五项

集中在 `src/data/palette.js` 的 `atmosphere`：

1. backgroundLightness：空间明暗与深色图可见度。
2. blobLightness：blob 层次与柔光感。
3. chromaFloor/chromaCeiling：浓度下限和刺激度上限。
4. monochromeHueSpread：单色图的第二层色相差。
5. paletteSmoothing：首次自动配色到达后的收敛速度；不改变相邻图的深度 blend。
