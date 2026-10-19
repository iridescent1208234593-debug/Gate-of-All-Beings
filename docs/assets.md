# 资源与 CDN 约定

## Git 与本地数据

Git 保存源码、Design System、配置、文档、SVG/icons，以及目前被页面引用的小型资源。不要为了将来迁移 CDN 忽略仍在使用的文件。当前大于 1 MB 的已跟踪项目文件有 110 个，主要是 `shared/shared-ui/` 与 `portal/huiguan/design-system/ui/` 中正在使用的界面图片，以及设计验收图和少量源素材；其中没有大于 5 MB 的已跟踪文件。暂时保留这些文件。

根目录 `assets/罗小黑战记数据库/` 是本机外部数据集，约 6.16 GiB、2,567 个文件；会馆和首页构建依赖其中的数据库与图片，仍需在本地/部署环境提供。该目录有 367 个大于 1 MB、31 个大于 5 MB、12 个大于 20 MB 的文件；12 个超 20 MB 文件都是视频，约 273–680 MB/个。保留原位置，不要删除或移动。本机 `assets/网站素材/` 是未被当前代码引用的快照和提取资料，也不纳入 Git。

`assets/素材/` 有 26 个文件、约 13.7 MB，是代码文档列出的会馆图片资源来源，因此不被忽略并随项目进入 Git。`assets/罗小黑组件合成/` 也保持可提交，供本地组件素材使用。

## 未来 R2/CDN

适合通过 Cloudflare R2 / CDN 公开提供的内容：图库 WebP 预览、视频、音频、GLB/3D 模型和大型纹理。图库高清原图只放私有持久资产库，通过主站管理员鉴权接口读取；不得放入公开 CDN。迁移时先核对应用运行时路径、对象键、部署缓存和回滚方式，再复制资源并验证线上访问；本仓库不自动上传或移动这些文件。

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

## Gallery 清单工具

`npm run assets:manifest` 将 JPG/JPEG/PNG/WebP 的对象键、SHA-256、字节数和 MIME 写入 `ops/assets/gallery-manifest.json`；GIF 明确排除。沿用 Gallery 的 `discoverGallery()`，支持 `GALLERY_DIR`。这是本地清单，生成过程不上传或移动原件。命令安全边界见 [update-system.md](update-system.md)。

## 首页图库展示图

香港源站 nginx 日志在 2026-10-18 18:50 至 2026-10-19 18:50（香港时间）的滚动 24 小时内记录约 2.27 GB 出站，其中图片约 865 MB（38.2%）；首页图库原图约 686 MB，占图片流量约 79%。这是抵达源站的响应字节估算，不包括 Cloudflare 边缘直接命中的流量，也不代表网卡峰值利用率。首页构建把原图转换成最大边长 1536、WebP quality 88 的独立预览，原件继续留在香港持久资产库，不进入公开构建或 CDN。普通访客不能调用管理员原图 API，也不能从旧 `gallery-files/` 路径直接读取；服务端使用主站签名 SSO 和站长账户复核授权原图请求。生成器输出到 `.releases/.work/gallery-previews/`，不修改源图。CDN 模式下发布前仍需单独上传 `gallery-previews/` 对象，并核对对象数量与总字节；不得把仅有 8 张对象的 Pilot 当作整库已同步。
