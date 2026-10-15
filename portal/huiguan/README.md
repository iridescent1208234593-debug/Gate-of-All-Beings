# 西木会馆

正式入口：<https://huiguan.iridescently.xyz/>。`server/portal_server.py` 按 Host 直接提供本目录的静态页面；不需要把参考项目搬入或另建路由框架。

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
| 原开场 WebGL 模型的源码与时间轴 | `../../server/app/src/cards/src/embed/gateEmbed.ts`、相邻 `components/reference/sceneModel.ts` |
| 构建后的模型 | `assets/gate/gate-scene.js`（由源码生成，不直接编辑） |

首页在同一个 DOM 中切换官方、登记和同人内容，登记表单只移动一次，切换时保留输入。`/gallery.html`、`/fan.html` 和 `/#charForm` 仍可直接访问。默认三列按内容自然形成高度，手机改为纵向目录；选中后其他列成为轻量切换入口，桌面指针靠近时可再次拓宽。

中间列向下滚动即可显示现有登记表，无需先点击标题。基本信息在前，角色配色用默认折叠的原生 `details` 放在其后；海报入口始终位于中间列。表单各栏进入视野时渐次显现；越过基本信息后自动聚焦登记列，保持当前滚动位置。滚动使用原生页面行为，不截获滚轮或增加嵌套滚动容器。列宽全程使用同一组可插值的 `minmax` / `fr` 轨道，避免之前混用分数与像素轨道时的跳变。

开场保留已有 Three.js 模型与完整 6 秒时间轴。首次先全屏播放，到门扉完整展开的约 3.67 秒收回画框并暂停；单击继续 / 暂停，双击重播全屏开场。播放时间与页面滚动分开：普通浏览滚动只让画框向下轻移，不缩小或改变媒体时间。相机以完整模型的包围盒中心对齐，控件独立对齐画框而不随画框放大。首次收回后提示拖动旋转；实际旋转后取消提示。手机水平拖动旋转、垂直滑动浏览；减少动态效果时直接显示完成状态。

首页导航复用共享导航的真实链接和现有 `#authBar`，仅本页重排；版权文字从共享页脚移入“更多去处”。不改其他页面的共享导航皮肤，也不新增账户状态或账户数据存储。

## 构建与验证

在 `server/app/src/cards` 运行 `node scripts/build-gate-embed.mjs`，生成本目录的模型 bundle。HTML 中的资产版本参数用于现有静态发布链路缓存刷新。

`tests/homepage.smoke.cjs` 保留可选的 Chrome 运行检查，不向实际账户提交数据。按当前用户验收安排，最新调整仅做构建、语法检查与截图留存，实际观感和交互由用户验收。`tests/capture-homepage.cjs` 用于保存开场、框内状态、登记和移动端截图；截图不等于已完成详细交互验收。

统一入口检查：在未占用端口设置 `PORT` 后运行 `python server/verify_portal.py`，避免把已有服务当成新启动的测试实例。公网检查与本地端点检查需分别报告。

2026-10-11 登记修复：格式检查放在必填检查之后，避免错误提示被后续检查清空。提交失败保留输入和待提交内容；成功才清空表单。错误字段就地提示，提交区汇总可点击定位；请求失败区分登录过期、权限、图片总量、频率、服务异常和网络超时。

`node portal/huiguan/tests/form-flow.cjs` 使用 Chrome 与真实会馆接口在临时端口 / 临时数据库验证 1440px、390px：未填 → 明确缺项 → 格式纠正 → 请求失败仍保留 → 成功登记。仅复制数据库结构，不复制正式用户记录，不向正式账户写入数据；需要安装 Playwright（可通过现有运行时的 `NODE_PATH` 使用）。本轮统一入口检查 36/36 通过，公网色环展开、调色、再次展开和刷新草稿已检查。

设表配色区域保留原海报入口，同时恢复同页、默认折叠的色环。第一次展开才绑定色环交互，之后复用状态；打开不会覆盖已选颜色，离开前仍按原有保存方式操作。

## 设表能力栏

角色配色默认折叠，摘要保留展开与选色提醒；展开后按快速搭配、主 / 辅色选择和古色色板分层展示。人设图片单张上限 8 MiB（JPG / PNG / WebP），以文件上传后在业务 JSON / 展示 HTML 中引用同源 URL。默认业务 JSON 请求上限为 8 MiB；仅 `/api/save-character` 和 `/api/save-all-characters` 暂留 64 MiB 的旧客户端 JSON 写入兼容上限，这与默认限制、单图限制分别独立。新前端会先外置图片，避免封面、图片列表及 HTML 重复传送 Base64；读取既有存档不受这两个写入请求上限影响。

设表的能力说明按「基础与身份 / 系别与技能 / 特殊限制」分组，分支标题统一称为分支技能。能力详解位于能力栏底部，使用默认折叠的原生 `details`；仍保留 `abilityDetailPanel`、`ability-detail-section` 及原有自动生成 / 自定义描述保存逻辑，不复制输入字段。首页表单说明、折叠和窄屏换行样式在 `homepage.css` 的 Registration guidance 段。

## 账户服务配置

共享会话签名使用 `HX_SSO_SECRET`。邮箱验证邮件使用 `ACCOUNT_EMAIL_SMTP_*`；两者都支持环境变量优先、本机 Git 忽略的 `server/.env.local` 作为回退配置，样例在 `server/.env.example`。邮箱 SMTP 凭据应使用邮箱客户端授权码，不要复用邮箱网页登录密码。配置邮件后重启会馆服务；不要把真实密钥提交进 Git。

## 图片传输与颜色真值

`image-upload.js` 供设表、配色海报、官方图片与表情包使用。原生 `FormData` 分开传送图片文件和小型 JSON metadata；图片普通格式 / 海报 PNG 上限 8 MiB，GIF 上限 5 MiB，metadata 上限 256 KiB，multipart 总请求最多为 8 MiB + 256 KiB + 64 KiB 协议余量。海报角色源图先单独上传，编辑状态只保存文件 URL。服务端检查登录 / 编辑权限、MIME、文件签名、图片完整性与 4000 万像素上限；原有 Pillow 缩略图依赖也用于图片校验。未验证的文件不落盘，新上传地址由服务端生成 `/assets/uploads/<sha256>.<extension>`。旧 Base64 存档可继续读取，下一次保存时转换成 URL；不批量改写现有用户数据。

`character-colors.js` 是会馆角色颜色的唯一解析 / 派生入口，同时保存 19 个现有预设；设表只引用该预设表。保存的 `colorPrimary` 与 `colorAccent` HEX 优先，`colorIndex` 只用于缺少 HEX 的旧记录，包含读取历史展示快照时的 fallback。设表与展示页复用原色 surface / accent 和显式派生的 background / text；展示页不再私自混合 16% / 30% surface。海报上半双色区域保留准确的选色 RGB，下半向白色过渡属于明确派生效果。保存绑定海报时，由同一个保存请求更新本人角色的 HEX；展示 HTML 的旧快照在读取时注入当前颜色，无需重新登记。

`show.html` 中的用户展示 HTML 保持不透明来源的安全沙箱。`showcase-download.js` 只发送导出请求和经过格式限制的颜色值，不能读取父页。`showcase-export.js` 在可信父页中处理导出：使用父页已经取到的 HTML 快照，去除活动节点、事件和非上传图 URL，再放入禁止脚本 / 表单、带资源 CSP 的离屏副本，用现有 html2canvas 渲染并下载 PNG。可读取的离屏副本与正在展示的用户沙箱是不同对象；旧快照的原导出监听由捕获阶段接管。按 2 倍清晰度导出，极长页面以 1600 万像素 / 16384 高度上限收敛，避免移动端巨型 Canvas。

`node portal/huiguan/tests/poster-color-flow.cjs` 在临时账户、临时图片目录与临时数据库中执行 Chrome 390px / 1440px 回归：6 MiB 图片上传、海报生成 / 保存 / PNG 下载 / 重新打开、旧展示快照的颜色恢复、HEX / 实际 RGB 像素比对、MIME 冒充、大小限制和账户权限。展示 iframe 保留脚本和下载能力，但使用不透明来源，不能读取父页账户 DOM；导出另外验证该安全隔离不影响 PNG 下载。只读取现有账户数据库的表结构，不复制用户记录。需要现有 Playwright 与 Sharp 运行时；可以用 `IRIDESCENT_SCHEMA_ROOT` 指定提供数据库结构的工作区，用 `IRIDESCENT_EVIDENCE_DIR` 保存截图和 JSON 结果。
