# 西木会馆

新成员完整环境、Portal 启动、临时测试数据、停止步骤和实测矩阵见[本地开发环境与启动矩阵](../../docs/development/local-onboarding.md)。

正式入口：<https://huiguan.iridescently.xyz/>。`services/platform/portal_server.py` 按 Host 直接提供本目录的静态页面；不需要把参考项目搬入或另建路由框架。

## 首页维护入口

| 职责 | 文件 |
| --- | --- |
| 页面内容、原有人设表单 `#charForm`、会馆账户流程 | `index.html` |
| 校验结果汇总、字段提示与定位（规则仍在 `index.html`） | `form-feedback.js` |
| 开场 / 浏览 / 选中档案的状态、播放器、滚动与销毁 | `homepage.js` |
| 官方与同人预览、自己的登记、搜索、现有账户事件接入 | `homepage-content.js` |
| 中间列滚动登记、基本信息 / 配色排序、逐段显现与收起两侧 | `homepage-registration.js` |
| 首页右上角导航、版权与免责声明 | `homepage-chrome.js` |
| 会馆配色、自然流布局、三列聚焦、手机排版、极简进度条 | `homepage.css` |
| 原开场 WebGL 模型的源码与时间轴 | `../cards/src/embed/gateEmbed.ts`、相邻 `components/reference/sceneModel.ts` |
| 构建后的模型 | `assets/gate/gate-scene.js`（由源码生成，不直接编辑） |

首页在同一个 DOM 中切换官方、登记和同人内容，登记表单只移动一次，切换时保留输入。`/gallery.html`、`/fan.html` 和 `/#charForm` 仍可直接访问。默认三列按内容自然形成高度，手机改为纵向目录；选中后其他列成为轻量切换入口，桌面指针靠近时可再次拓宽。

中间列向下滚动即可显示现有登记表，无需先点击标题。基本信息在前，角色配色用默认折叠的原生 `details` 放在其后；海报入口始终位于中间列。表单各栏进入视野时渐次显现；越过基本信息后自动聚焦登记列，保持当前滚动位置。滚动使用原生页面行为，不截获滚轮或增加嵌套滚动容器。列宽全程使用同一组可插值的 `minmax` / `fr` 轨道，避免之前混用分数与像素轨道时的跳变。

开场保留已有 Three.js 模型与完整 6 秒时间轴。首次先全屏播放，到门扉完整展开的约 3.67 秒收回画框并暂停；单击继续 / 暂停，双击重播全屏开场。播放时间与页面滚动分开：普通浏览滚动只让画框向下轻移，不缩小或改变媒体时间。相机以完整模型的包围盒中心对齐，控件独立对齐画框而不随画框放大。首次收回后提示拖动旋转；实际旋转后取消提示。手机水平拖动旋转、垂直滑动浏览；减少动态效果时直接显示完成状态。

首页导航复用共享导航的真实链接和现有 `#authBar`，仅本页重排；版权文字从共享页脚移入“更多去处”。不改其他页面的共享导航皮肤，也不新增账户状态或账户数据存储。

## 构建与验证

在 `apps/cards` 运行 `node scripts/build-gate-embed.mjs`，生成本目录的模型 bundle。HTML 中的资产版本参数用于现有静态发布链路缓存刷新。

`tests/homepage.smoke.cjs` 保留可选的 Chrome 运行检查，不向实际账户提交数据。按当前用户验收安排，最新调整仅做构建、语法检查与截图留存，实际观感和交互由用户验收。`tests/capture-homepage.cjs` 用于保存开场、框内状态、登记和移动端截图；截图不等于已完成详细交互验收。

统一入口检查：在未占用端口设置 `PORT` 后运行 `python services/platform/tests/verify_portal.py`，避免把已有服务当成新启动的测试实例。公网检查与本地端点检查需分别报告。

2026-10-11 登记修复：格式检查放在必填检查之后，避免错误提示被后续检查清空。提交失败保留输入和待提交内容；成功才清空表单。错误字段就地提示，提交区汇总可点击定位；请求失败区分登录过期、权限、图片总量、频率、服务异常和网络超时。

`node apps/huiguan/tests/form-flow.cjs` 使用 Chrome 与真实会馆接口在临时端口 / 临时数据库验证 1440px、390px：未填 → 明确缺项 → 格式纠正 → 请求失败仍保留 → 成功登记。仅复制数据库结构，不复制正式用户记录，不向正式账户写入数据；需要安装 Playwright（可通过现有运行时的 `NODE_PATH` 使用）。本轮统一入口检查 36/36 通过，公网色环展开、调色、再次展开和刷新草稿已检查。

设表配色区域保留原海报入口，同时恢复同页、默认折叠的色环。第一次展开才绑定色环交互，之后复用状态；打开不会覆盖已选颜色，离开前仍按原有保存方式操作。

## 设表能力栏

角色配色默认折叠，摘要保留展开与选色提醒；展开后按快速搭配、主 / 辅色选择和古色色板分层展示。人设图片单张上限 8 MiB（JPG / PNG / WebP），以文件上传后在业务 JSON / 展示 HTML 中引用同源 URL。默认业务 JSON 请求上限为 8 MiB；仅 `/api/save-character` 和 `/api/save-all-characters` 暂留 64 MiB 的旧客户端 JSON 写入兼容上限，这与默认限制、单图限制分别独立。新前端会先外置图片，避免封面、图片列表及 HTML 重复传送 Base64；读取既有存档不受这两个写入请求上限影响。

设表的能力说明按「基础与身份 / 系别与技能 / 特殊限制」分组，分支标题统一称为分支技能。能力详解位于能力栏底部，使用默认折叠的原生 `details`；仍保留 `abilityDetailPanel`、`ability-detail-section` 及原有自动生成 / 自定义描述保存逻辑，不复制输入字段。首页表单说明、折叠和窄屏换行样式在 `homepage.css` 的 Registration guidance 段。

## B站 Toy 档案摘要

`GET /api/toy/archive` 给 B站 Toy 门庭页读取：公开同人人设按画廊顺序取前 10 条，官方档案取前 24 条，数量在服务端写死（`TOY_ARCHIVE_FAN_LIMIT` / `TOY_ARCHIVE_OFFICIAL_LIMIT`）。接口匿名：不读会话，不返回账号 id，响应 `Access-Control-Allow-Origin: *` 且不带凭据，缓存 5 分钟；图片只给已存档的上传文件地址，内联 Base64 不给。地址按请求所在根域生成，三根域行为一致。测试：`apps/huiguan/tests/test_toy_archive.py`。说明见 [docs/bilibili-toy.md](../../docs/bilibili-toy.md)。

## 账户服务配置

### OAuth 回归

`npm run test:huiguan-auth-next` 校验登录后的 `next` 回跳严格匹配 HTTPS 主站域名白名单。`npm run test:oauth-mock` 启动本机临时 SQLite 数据根目录和 loopback Mock Provider，并用 Playwright 覆盖登录、state 过期与重放、Cookie、重启后的 Session、退出、拒绝授权和 Token 错误；不访问真实 Provider、生产数据库或真实凭据。CI 在 PR 和候选分支推送时运行这些检查。真实 USSO 应用行为仍需独立测试应用验收；当前客户端未实现 PKCE，也未验证 ID Token nonce，因此 Mock 结果不代表这些协议能力已覆盖。

本地未发布的首屏性能修正：head 精确预加载 intro / gate / homepage 脚本，先初始化门景再加载共享导航和内容；fallback 使用监听先于 load、幂等 ready 与 8 秒出口，未缩短模型动画时间轴。真实测量、延迟导航与视频 smoke 见 [加载审查](../../docs/zszm-loading-audit.md)。正式服务仍读取发布快照，源码通过不等于线上已生效。

共享会话签名使用 `HX_SSO_SECRET`。邮箱验证邮件使用 `ACCOUNT_EMAIL_SMTP_*`；两者都支持环境变量优先、本机 Git 忽略的 `server/.env.local` 作为回退配置，样例在 `services/platform/.env.example`。邮箱 SMTP 凭据应使用邮箱客户端授权码，不要复用邮箱网页登录密码。配置邮件后重启会馆服务；不要把真实密钥提交进 Git。

站内账号可在个人账户页绑定并验证邮箱。只有 `account_emails` 中已验证的地址可用于找回账号名和重置密码；旧用户资料邮箱不会自动获得验证状态。找回邮件含一次性 30 分钟链接，成功重置后该账号的现有会话全部失效。提示问题找回仍作为兼容入口保留。

## 图片传输与颜色真值

`image-upload.js` 供设表、配色海报、官方图片与表情包使用。原生 `FormData` 分开传送图片文件和小型 JSON metadata；图片普通格式 / 海报 PNG 上限 8 MiB，GIF 上限 5 MiB，metadata 上限 256 KiB，multipart 总请求最多为 8 MiB + 256 KiB + 64 KiB 协议余量。海报角色源图先单独上传，编辑状态只保存文件 URL。服务端检查登录 / 编辑权限、MIME、文件签名、图片完整性与 4000 万像素上限；原有 Pillow 缩略图依赖也用于图片校验。未验证的文件不落盘，新上传地址由服务端生成 `/assets/uploads/<sha256>.<extension>`。旧 Base64 存档可继续读取，下一次保存时转换成 URL；不批量改写现有用户数据。

`character-colors.js` 是会馆角色颜色的唯一解析 / 派生入口，同时保存 19 个现有预设；设表只引用该预设表。保存的 `colorPrimary` 与 `colorAccent` HEX 优先，`colorIndex` 只用于缺少 HEX 的旧记录，包含读取历史展示快照时的 fallback。设表与展示页复用原色 surface / accent 和显式派生的 background / text；展示页不再私自混合 16% / 30% surface。海报上半双色区域保留准确的选色 RGB，下半向白色过渡属于明确派生效果。保存绑定海报时，由同一个保存请求更新本人角色的 HEX；展示 HTML 的旧快照在读取时注入当前颜色，无需重新登记。

公开展示页由服务端受控输出（`services/platform/showcase_sanitizer.py`）：保存的展示 HTML 按白名单重建，去掉脚本、事件属性、嵌入/表单/跳转标签和站外或 `javascript:` 链接，再只附加服务端自己的脚本（`showcase-runtime.js` 负责墨点、主题切换和看大图，`showcase-download.js` 负责导出），用每次响应的 nonce CSP 拒绝其他脚本。`show.html` 中的用户展示 HTML 保持不透明来源的安全沙箱。`showcase-download.js` 只发送导出请求和经过格式限制的颜色值，不能读取父页。`showcase-export.js` 在可信父页中处理导出：使用父页已经取到的 HTML 快照，去除活动节点、事件和非上传图 URL，再放入禁止脚本 / 表单、带资源 CSP 的离屏副本，用现有 html2canvas 渲染并下载 PNG。可读取的离屏副本与正在展示的用户沙箱是不同对象；旧快照的原导出监听由捕获阶段接管。按 2 倍清晰度导出，极长页面以 1600 万像素 / 16384 高度上限收敛，避免移动端巨型 Canvas。

## 账户、OC 与众生之门形象

三类资料互相独立。账户身份键是 `(kind, uid)`：当前站内账号使用 `kind=local` 和 `local_users.uid`；暂停的旧 USSO 资料使用 `kind=usso` 和原有用户 ID。邮箱验证是账户邮箱绑定 / 找回能力，不是邮箱密码登录系统：注册登录仍使用会馆站内用户名与密码，验证邮箱单独存入 `account_emails`。

`users.picture` / `local_users.picture` 保留为既有资料或 OAuth 来源头像；用户主动设置的通用账户头像保存在 `users.db` 新增的 `account_profiles.account_avatar_url`。会馆启动时以 `CREATE TABLE IF NOT EXISTS` 幂等建表，不改旧账户或 OC 表。头像先由共享裁切器输出 1:1 图片，再由 Pillow 重新解码、去元数据并缩到最长边 512px；文件按 SHA-256 内容寻址，数据库只存资源引用。

每条 OC 仍保存在 `characters.json` 原有角色记录的 `data` 中，原有 `species_type` / `species_detail` 不变；新增 `data.avatar_asset_id` 和 `data.avatar_display_shape` (`square` / `circle`) 是可选字段，旧 OC 缺省时继续用原封面或首字 fallback。设定图候选由用户选择并进入同一 1:1 裁切器，不自动选择或裁切。替换 / 清空头像不会立即删资源：上传目录还被角色图、海报、展示页和跨模块引用共用，当前没有可证明全站无引用的垃圾回收器，因此保留内容寻址文件以避免破坏其他内容。

众生之门 Identity 位于相同 `account_profiles` 行的 `gate_identity_json`，结构带 `schema_version: 1`，包含 `display_name`、自由文本 `species_name`、独立 `avatar_asset_id`、`avatar_frame_id`、`avatar_mode` 与可选 `source_oc_id`。登录账户读取已签名的 `hx_sso` cookie，再用 `(kind, uid)` 解析会馆账户；从自己的 OC 导入必须用户主动确认，只复制名称、`species_type + species_detail` 和头像引用，之后编辑只写 Gate Identity，不回写 OC。匿名形象仅存当前标签页 `sessionStorage`。头像引用指向不可变内容文件，三种资料的可变字段和记录彼此分离。

相关接口：`GET /api/user` 和 `/api/sso-user` 返回 `account_avatar_url`；`POST /api/account/avatar` 更新 / 清除账户头像；`POST /api/avatars/upload` 供已登录用户上传 OC 头像；`GET /api/user/ocs` 返回本人 OC 候选。众生之门使用 Cards 服务的 `GET /api/gate/identity`、`POST /api/gate/identity`、`GET /api/gate/ocs`，登录态只认共享 `hx_sso`；Cards 自己的旧 OAuth `/api/login` 返回 410，不创建第二个账户状态。

`node apps/huiguan/tests/poster-color-flow.cjs` 在临时账户、临时图片目录与临时数据库中执行 Chrome 390px / 1440px 回归：6 MiB 图片上传、海报生成 / 保存 / PNG 下载 / 重新打开、旧展示快照的颜色恢复、HEX / 实际 RGB 像素比对、MIME 冒充、大小限制和账户权限。展示 iframe 保留脚本和下载能力，但使用不透明来源，不能读取父页账户 DOM；导出另外验证该安全隔离不影响 PNG 下载。只读取现有账户数据库的表结构，不复制用户记录。需要现有 Playwright 与 Sharp 运行时；可以用 `IRIDESCENT_SCHEMA_ROOT` 指定提供数据库结构的工作区，用 `IRIDESCENT_EVIDENCE_DIR` 保存截图和 JSON 结果。

## 公开展示入口解析（2026-10-19）

`show.html?code=...` 复用原有 `/api/get-character`（`/api/huiguan/get-character` 为合法别名）。OC 优先读取原始展示 HTML；`poster-<id>` 属于 SQLite 海报实体，不能当成 OC 的 `char_code`。海报按自己的 ID、公开状态和完整所有者身份读取，图片保持原始上传引用。原始 OC 已不存在但公开画廊保留的资料可作为明确标注的公开快照显示，不创建或覆盖用户设表。实现位于 `services/platform/showcase_document.py`。

读取失败须区分资料不存在与服务不可用，提供重试和节点选择，不能一律要求玩家重新生成、覆盖已有资料。本轮候选与线上状态见 [访问与带宽报告](../../docs/access-and-bandwidth-20261019.md)。
# Images

Artwork and material thumbnails marked with `data-original-image` share one interaction: hover a specific image to see an overlay on the image with “查看原图” and “不再提示”; the first opens that image's full source, while the second remembers the choice in this browser. Clicking the image itself also opens its original. The viewer handles dynamically inserted gallery cards and removes the thumbnail-only `t=1` parameter from the official image endpoints. Keep the marker on the image itself so the action remains tied to the asset under the pointer.
