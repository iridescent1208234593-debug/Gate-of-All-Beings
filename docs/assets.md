# 资源与 CDN 约定

## Git 与本地数据

Git 保存源码、Design System、配置、文档、SVG/icons，以及目前被页面引用的小型资源。不要为了将来迁移 CDN 忽略仍在使用的文件。当前大于 1 MB 的已跟踪项目文件有 110 个，主要是 `shared/shared-ui/` 与 `portal/huiguan/design-system/ui/` 中正在使用的界面图片，以及设计验收图和少量源素材；其中没有大于 5 MB 的已跟踪文件。暂时保留这些文件。

根目录 `assets/罗小黑战记数据库/` 是本机外部数据集，约 6.16 GiB、2,567 个文件；会馆和首页构建依赖其中的数据库与图片，仍需在本地/部署环境提供。该目录有 367 个大于 1 MB、31 个大于 5 MB、12 个大于 20 MB 的文件；12 个超 20 MB 文件都是视频，约 273–680 MB/个。保留原位置，不要删除或移动。本机 `assets/网站素材/` 是未被当前代码引用的快照和提取资料，也不纳入 Git。

`assets/素材/` 有 26 个文件、约 13.7 MB，是代码文档列出的会馆图片资源来源，因此不被忽略并随项目进入 Git。`assets/罗小黑组件合成/` 也保持可提交，供本地组件素材使用。

## 未来 R2/CDN

适合后续迁移到 Cloudflare R2 并通过 CDN 提供的内容：图库高清原图、视频、音频、GLB/3D 模型和大型纹理。迁移时先核对应用运行时路径、对象键、部署缓存和回滚方式，再复制资源并验证线上访问；本仓库不自动上传或移动这些文件。

首页 Gallery 的迁移清单由 `npm run assets:manifest` 生成到 `ops/assets/gallery-manifest.json`。它沿用首页构建使用的 `discoverGallery()`，只收录 JPG/JPEG/PNG/WebP，记录相对对象键、源文件相对路径、字节数、SHA-256、MIME 和分类；GIF 会列在 `UNSUPPORTED/EXCLUDED` 中。音乐、数据库、备份和上传内容都不在输入目录或允许类型内。当前清单覆盖 384 张图片（约 304.4 MiB）。`GALLERY_DIR` 可指定本机素材目录；不设置时使用下文的原始 Gallery 目录。清单是复制计划，生成或构建时不会移动、覆盖或删除源素材。

统一流程见 [`update-system.md`](update-system.md)。R2 订阅和 bucket 尚未就绪前，`npm run update` 会停止并记录报告，不执行上传或 DNS/custom-domain 操作。远端同步必须先输出 NEW、CHANGED、UNCHANGED、REMOTE_ONLY 和总字节数；只上传 NEW/CHANGED，保留 REMOTE_ONLY，永不自动删除远端或本地对象。

可继续留在 Git 的资源：SVG/icons、小型 UI 图片、组件示例和必须与代码版本同步的文件。Design System 中当前使用的图片即使超过 1 MB，也先保留在 Git，待有明确替代 URL 和完整性验证后再单独迁移。

## `asset()`

首页的 Vite 代码可从 `portal/www/scripts/asset.js` 导入：

```js
import { asset } from "./asset.js";

const logoUrl = asset("iridescently-mark.png");
const modelUrl = asset("models/example.glb");
```

`VITE_ASSET_BASE_URL` 有值时，`asset(path)` 返回 CDN 根地址加相对路径；未配置时返回当前站点的 `/assets/<path>`，本地素材放在对应应用的 `assets/` 目录。首页品牌标志是首个接入点，其他既有资源引用保持原样。

可将 `portal/www/.env.example` 复制为 `portal/www/.env.local` 进行本地配置；`.env.local` 已被忽略，不会进入 Git。留空或不设置 `VITE_ASSET_BASE_URL` 时使用本地路径。生产配置该变量前，先将相同相对路径对应的对象放到 CDN，例如 `iridescently-mark.png` 对应 `https://assets.iridescently.xyz/iridescently-mark.png`。

当前 helper 属于首页 Vite 应用。其他 Vite、Next.js 或服务端应用接入时，应在各自代码边界使用对应框架的公开环境变量前缀，并复用同一相对键约定；服务端密钥不得暴露为公开变量。

## 新资源放置

- 图标和小型 UI 图片：放在使用它的应用 `assets/` 或其 Design System 资源目录，与引用它的源码一起提交。
- 首页图库源图：继续放在本机 `assets/罗小黑战记数据库/罗小黑节气贺图（gallery素材）/`；构建流程会生成忽略的本地发布副本。
- 新的大型图库、视频、音频、模型与纹理：在实际 R2 bucket/key 规划完成前留在本地原位置，并记录使用它的页面或模块。
- 构建输出、依赖、缓存、日志和运行数据：保留在本地，不提交。

## 禁止提交

`.env*`（仅 `.env.example` 例外）、API keys、token、密码、Cloudflare 凭据、数据库凭据、私钥、数据库和日志、本机会话导出、`node_modules/`、构建输出、缓存，以及根目录 `assets/罗小黑战记数据库/` 与 `assets/网站素材/` 不得进入 Git。`assets/素材/` 和 `assets/罗小黑组件合成/` 按前文说明处理。不要把生产密钥写进 `.env.example` 或公开前端变量。
