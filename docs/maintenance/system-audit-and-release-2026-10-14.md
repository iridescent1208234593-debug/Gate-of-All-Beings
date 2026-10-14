# Iridescently 系统整改与上线验收 · 2026-10-14

## 现状与边界

生产源码根为 E:/Projects。主仓库 master、private GitHub `iridescent1208234593-debug/iridescently`；没有 reset 或丢弃原 Homepage 工作。原始审计识别 26 个 Git 仓库、13 条根仓库分支和一个根 worktree；没有把嵌套上游仓库的分支强行合并。初始 master 领先远端 81 个提交。

生产 Gallery 已迁到 `portal/www/gallery-engine`；原嵌套 Git checkpoint 和四项既有修改保留，根仓库也追踪正式核心源码。384 张真实图源继续位于本机媒体目录，未改顺序、shader、palette Worker 或 mood pipeline。

参考和研究整体迁到 `E:/External Projects/Iridescently Labs/references`、`research`，桌面壁纸在 `E:/External Projects/url-wallpaper`。4,677 个研究文件核对，49 项明确路径边界变化，零意外 hash 变化；冻结 Runtime/evidence 与原生模型未改。研究 Git 只在本地，当前 checkpoint `5062c93`：保留源码与代表性证据，117 个私有媒体/原始输出由 local-materials-index.json 记录 SHA-256 并继续留在磁盘，不公开、不删除。迁移后 Stage 4 Candidate Stable 150 项、Runtime 10 项、恢复 7 项、Ecology adapter 6 项及 playable build/verify 通过；shared-resource 已确认记录的 5 项与 7 项检查通过，不宣称所有长时科学实验重跑。

旧 D:/Projects/zszm 已停止作为生产源，7 项工作保存在其本地 `713dc66` checkpoint；两项仍有效的修复已进入 E 盘正式实现，其余为旧实现的离线历史。原数据与 Git 没有盲删。另一个进行中的任务在本轮期间持续向原 New project/six-system-arena/docs 写新复审文档；36–38 已保留迁入研究库，后续新文件保留为明确的未提交研究记录，不能为了根工作树整齐丢掉它们。

## 两个高优先级 Bug：根因 → 修改 → 验证

### 海报保存请求过大

原来固定 1080×1920 Canvas 导出 PNG/Base64，又把原图 Base64 与海报一起放进 JSON。约 3.97 MB JSON 在会馆默认 2 MiB 读取上限处提前被拒绝，不是移动端 DPR 自动放大画布，也不是后端后续海报限额生效。

现在图片采用 Blob/File + multipart，图片以内容 hash 的同源 URL 持久化；业务 JSON 与角色 HTML 引用 URL，下载采用 Blob。普通业务 JSON 按用户要求设置为 **8 MiB**，图片/PNG 8 MiB，GIF 5 MiB，metadata 256 KiB；multipart 增加有限边界开销。旧角色/批量写入兼容 64 MiB 仍有界限，没有无限扩容。验证实际图片签名、解码、像素数、登录/所有权，拒绝无效内容不留下文件。

安装的 Chrome 在 390/1440 两尺寸跑完整生成、上传、保存、刷新、重载和导出：源图 6,232,792 字节，海报 1080×1920，均通过。公网内置浏览器 390×844 使用自行生成的 6,224,791 字节测试 PNG：云端保存成功、下载 PNG 成功，刷新并点击载入恢复 1080×1920 图片、标题和原配色；图片来源为 /assets/uploads/ 的 URL。测试海报 `上线验收 · 2026-10-14` 保留在当前账户中，未关联人设、未共享画廊，不修改已有角色配色。下载 PNG 1,660,259 字节，尺寸与颜色验证通过。未验证 iOS/Android 实机相册或系统分享面板。

### 主色不一致与变淡

原保存 HEX 会被旧 preset index 0 覆盖，展示页又独立混入 .16/.30 的背景派生色；海报保存存在第二次未确认的颜色更新与陈旧 HTML，grain 也改动纯色区像素。不是通过提高 saturation 解决。

`portal/huiguan/character-colors.js` 统一 19 项已有 preset，合法 HEX 是真值，缺值时才用有效索引 fallback。设表预览、存储、展示和海报复用它；原始主色与背景派生色明确区分。海报一次持久化同步拥有者的关联角色颜色，生成展示页注入保存 HEX，消除二次覆盖。底部明确设计的白色渐变仍保留。

本地 Chrome 在 390/1440 验证 #b83e4e：展示表面 RGB(184,62,78)、海报和展示导出 PNG 均有精确对应像素；旧 index-only fallback #1a1f2e 正确。公网下载海报的原配色 #90a65d / #2b313a 分别有 237,106 / 404,522 个精确像素；顶部纯色区与控件 HEX 一致。阴影、竹影及底部渐变是明确派生区域，不能把这些像素当成原色。

## UI、生命周期与安全

- 主站/会馆/众生之门入口、更多菜单、当前页语义、键盘焦点、Escape 和移动布局统一；当前页品牌激活保持 Gallery 位置。心理档案云尚未正式并入，状态红点。
- 保留会馆自己的视觉与同页档案入口，不统一成浅灰 SaaS 卡片。会馆账户栏继续用已有 authBar；众生之门账户状态来自 shared-session/hx_sso，无第二套身份。
- 壳的串行 mount、AbortController/generation 防止旧异步模块复活；卸载拥有的 style/overlay；导航层与 AEON 重名 id 分离。Cards 复用一次 React runtime 并正确 unmount，避免 selectionchange 累积。
- Ecology/AEON/Management/Slay 各自释放真实 RAF、timer、listener、GSAP/Draggable、音频、renderer/controls 与拥有的 GPU 资源，未加空 dispose 掩盖问题。
- 20 项 UI/竞态检查、19 份 JS/inline 语法检查通过。七模块各两轮进入/离开，离开后 RAF、interval、injected style、owned overlay 为 0，无新增 pageerror；Management 的最终独立复测优先于旧报告。Softie headless 软件 GPU 显示等待 WebGPU，不能宣称其实际 GPU 画面通过。
- 私有静态路径经过 URL 解码和大小写检查；DB/WAL/密钥/环境/源目录/目录列表不可通过静态路由读取。公网 users.db、编码 game_saves.json、app/src 请求均 404。
- 反代提供可信 forwarded Host，拒绝客户端伪造 forwarded 头。Cards 原来把代理连接的 127.0.0.1 当成本地管理访问，导致公网无 Origin GET 也获得管理能力；现按真实主机判定。公网匿名 API 现在 editable=false 且无 adminToken；本地伪造公网 Host 的 PUT 为 403。
- 用户展示 HTML 保持 opaque sandbox；可信父页面通过白名单快照、无脚本隔离副本和现有 html2canvas 导出，修复 opaque iframe 克隆导出报错，没有把用户 HTML 直接赋予父页面权限。

## 清理、Git 与文档

删除已替代的 links.html/thanks.html（保留服务端 308 到 Connections 章节）、两个 _backup_gate、无引用 w_0/w_1/w_2、旧 redirect 脚本与入口；旧独立 game/lingjing 与重复前端的管家项已移除。juling 5177 仍承担实际 API，不删除。5173 Ecology 开发服务不属于线上，不能仅因存在就认定废弃。Huiguan 的共享 UI 实际是 Windows junction，canonical owner 为 shared/shared-ui，移除重复 Git 追踪并保留真实公共能力。

用户数据 characters.json/game_saves.json、本机 .env.local、上传/store 不再跟随源码发布；原文件仍在本机。原未知附件、媒体、嵌套 Git 与数据保留。检查过的 .bak 内容可由 Git 历史恢复后删除，没有制作 legacy-home 备份。

README 已同步生产/研究地图、服务、启动、候选/发布流程、颜色与上传约定、共享 ownership 和开源范围；历史冻结审计里的旧路径作为历史证据保留，不伪造其日期与测试结果。改版前仅保留 screenshots，见 ../ui-history/2026-10-14-before/；改版后见 ../ui-history/2026-10-14-after/。

安全 checkpoint 为 pre-system-remediation-20261013。关键提交：1b8dbc9 私有路由防护，478968f 整理前 checkpoint，431f167 系统整改与迁移，21b9a89 管理接口信任边界，4e89300 Windows 发布 rename 重试，3d33151 新增讨喜团子特别鸣谢。生产数据库备份仅在忽略的 .releases/.work 下，未上传。

最终发布前扫描所有根仓库可达文本 blob 与当前源码：未发现真实 OAuth CLIENT_SECRET、GitHub token、私钥或跟踪的 .env/.env.local；唯一 private-key marker 为 activation-core README 的省略示例，已人工确认无 key 内容。扫描为文本启发式，未解包二进制档案或扫描全部第三方嵌套历史，不能声称穷尽所有格式。

## 生产部署与公网验收

沿用 Windows 网站管家和 Cloudflare Tunnel，9 个站群域名统一到 8080；没有新 CDN/DNS 架构。Portal/OAuth 从 .releases/production/site 的 Git HEAD 源码快照运行；用户数据在原路径。Homepage/七模块仅构建到 .releases/candidate，显式 publish 后写正式输出。Cards/Softie Node API 插件仍在进程启动时从源码加载，静态预览来自发布模块；没有宣称所有 Node 后端已快照隔离。

主要服务：8080 统一门户；5174 OAuth；5178 数值配置；5177 聚灵；4173 灵体 API/WebSocket。5176/5179 旧服务未监听。game、lingjing、juling 旧域名 308 到众生之门对应入口。

构建通过；独立端口 Portal 回归 **49/49** 和静态安全测试通过。14 项公网入口/跳转/私有文件防护检查通过；公网 homepage.js、character-colors.js SHA-256 与正式输出一致。公网会馆登录成功，众生之门显示同一账户；Skip 后内容与导航正常。公网 Gallery 初始化 384 图、下一张与同页导航保持位置；设置带可开关，无新增 console error。移动端海报公网端到端通过，见上。

Windows 发布目录被 Python 服务 cwd 锁住时，首次 promotion 未成功并恢复旧产物；只停止受影响 Portal/OAuth，再发布并由现有管家启动，两次服务恢复 HTTP200。其余 API/Tunnel 不做无意义重启。detached Python 没有可用 shutdown/console handler，无法声称本次停止通过应用级优雅关闭；用户数据写请求完成后才执行受控重启。

## Credits 与公开项目

Connections 按实际用途补充 ECharts、React/Lucide、html2canvas、Three、ColorThief、Vite、GSAP/Tone、AEON、Slay/Preact 及交互研究来源，不做 dependency dump。保留已有朋友/人物鸣谢与管理接口。新增 **讨喜团子：技术支持 · 众生之门 UI 界面；QQ 937319686；B 站 1410357100**，公网内容与链接已核对。

实际独立公开： https://github.com/iridescent1208234593-debug/iridescently-atmospheric-gallery ，MIT、保留 Houmahani/Codrops 来源，用四张自行生成样例 PNG，不带罗小黑素材、音乐、账户或主站私有文件。公开提交 d6b27030cecb21ee83c3205153c240eb9457c010；npm ci/test/lint/build 通过，本地与远端 main 一致。主站继续 private。六系/Stage4/DAY100/恢复游戏未公开，研究资格、私有素材和许可边界需独立确认。

## 明确未完成/需决定的边界

- HUIGUAN_CLIENT_SECRET / ZSZM_CLIENT_SECRET 当前未配置，外部 OAuth 无法验收；用户账户密码不是应用密钥。本地账户与跨站签名会话已经实际通过，密码不写文件或 Git。
- 实机 iOS/Android 相册/分享、真实 Softie WebGPU 渲染尚未验证。
- Slay 上游 AGPL 已保留署名与许可证；修改版完整 corresponding-source 的公开提供方式和素材范围仍需许可审查，不能把主站 private 当作这一义务已满足。
- 第三首 .mgg0.flac 不属于可直接播放的标准 FLAC；界面保留不可播放提示，需标准可播放源，不尝试解密。
- 跨任务新研究记录仍回写旧路径，已识别为进行中工作；应让该任务改用研究根。未丢弃这些新记录。
