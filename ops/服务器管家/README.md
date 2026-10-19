# Iridescently 服务器管家

双击本目录的 **打开服务器管家.vbs**。旧「网站管家」中也有「打开服务器管家」按钮。

## 两台主机如何并行

| 入口 | 提供什么 | 更新方式 | 电脑关机后 |
| --- | --- | --- | --- |
| 服务器 2：香港稳定版（默认） | 正式页面、游戏代码、全部后台和玩家数据 | 在管家中手动发布代码或资产 | 继续运行 |
| 服务器 1：本机新版 | 本机当前页面、共享资源及已构建游戏模块 | 修改页面或完成本地模块构建后即可看到 | 新版入口离线，玩家可回稳定版 |

两边共用**香港的账户、云存档、上传和资产接口**。本机新版网关没有 SQLite 连接，不启动本机旧认证、存档或游戏后台，不复制 Windows 的旧账户库到香港。

并行的是页面 / 游戏客户端代码版本；认证、云存档、房间 WebSocket 和游戏 API 仍只有香港这一套。新版如果要求新增后台接口，必须等兼容接口发布到香港后才能使用。当前方案没有独立的本机实验后台、数据库双写或自动数据库合并。

浏览器本地设置、尚未上传的草稿和离线进度属于各个域名，**不会自动跨域迁移**。切换前请确认进度已保存到云端。已有共享域名 Cookie 会继续使用；某些登录回调仍会回到香港页面，完成后再切换即可。

## 玩家选择服务器

导航栏「更多」中有「香港稳定版 · 切换服务器」或「本机新版 · 切换服务器」；开场等没有导航栏的页面显示在左下角，避开右下角的跳过按钮。选服页保留当前路径、查询参数和页面锚点。

选服脚本注入锚定 HTML 文档的第一个 `<head>`，以 `defer` 在解析完成后运行。不要改回匹配 `</body>`：会馆首页的内联 JS 模板中也含有 `</body>`，匹配到模板会提前结束脚本，让后续源码直接显示在页面上并中断保存逻辑。香港 nginx 与本机预览网关必须保持同一条注入规则。

玩法故障页的「换服务器重试」是一次手动选择，保留当前路径和锚点，并避开 PC 导航自动改写。入口健康提示仅表示门户可达，不能保证共同后台或所有游戏资源可用；不自动无限重试。2026-10-19 的展示页、深层壳路由和带宽候选状态详见 [访问与带宽报告](../../docs/access-and-bandwidth-20261019.md)。定向候选不能用普通「发布香港代码」重新打包代替，否则会把工作区其他尚未审查的代码一起收集。

众生之门选服页：<https://zszm.iridescently.xyz/__server/select>

| 网站 | 香港稳定版 | 本机新版 |
| --- | --- | --- |
| 首页 | https://iridescently.xyz | https://pc.iridescently.xyz |
| www | https://www.iridescently.xyz | https://pc-www.iridescently.xyz |
| 西木会馆 | https://huiguan.iridescently.xyz | https://pc-huiguan.iridescently.xyz |
| OC | https://oc.iridescently.xyz | https://pc-oc.iridescently.xyz |
| 灵体互动 | https://spirit.iridescently.xyz | https://pc-spirit.iridescently.xyz |
| 众生之门 | https://zszm.iridescently.xyz | https://pc-zszm.iridescently.xyz |
| 旧 game / juling / lingjing 域名 | 保留原重定向与聚灵 API | 对应 pc-game / pc-juling / pc-lingjing，保留新版跳转 |

本机离线时，选服页提示改用稳定版。若已经在浏览器的离线错误页，请直接打开上面的稳定版链接；没有自动将本机页面的未提交操作转移到另一页面。

## 启动与停止本机新版

- **配置本机入口**：使用本机 Cloudflare 证书配置独立的 PC Tunnel 和 pc-* 域名，不改九个正式域名。正常情况下只需首次配置。
- **启用本机新版并登录自启**：只启动本机网关 `127.0.0.1:18190` 和独立 cloudflared；加入当前 Windows 用户的登录启动目录。
- **停止本机新版并取消自启**：只停止管家记录的两个进程，校验 PID 和启动时间，移除该登录启动项。
- 状态中显示实际隧道边缘连接数；只有进程、没有连接时不能当成在线。

登录自启要求 Windows 用户已登录和网络可用。后台进程意外退出不会由常驻守护程序自动拉起，可在管家重新启用。停止本机新版不影响香港服务。

不要用旧网站管家的「启动本机预览」代替这里的新版入口。旧按钮是保留的开发工具，会启动旧本机后台；新的双服入口使用单独端口，所有玩家写请求仍固定去香港。

## 代码更新

1. 按原项目流程完成需要的构建、验证和本地发布。
2. 点 **预览代码包**，查看版本、包大小和文件清单；此步骤不上线。
3. 在你决定更新稳定版时点 **发布香港代码**。
4. 香港安装依赖、运行隔离的 Portal 检查，通过后切换版本并检查后台；失败自动恢复旧程序。
5. **回滚香港代码**切回上一个程序版本，玩家数据保持最新。

代码包读取 `.releases/production/site` 的正式页面 / Python 快照、`server/app/modules` 现有构建产物、首页构建产物和现有预览 API 所需源码。它不自动构建，不把编辑中的所有源码直接作为正式版本。

代码包排除 DB、账户、云存档、上传、密钥、独立世界观资产库及首页 `gallery-files`。首页图库已放到香港持久资产目录，新旧代码版本都接到同一份图库，回滚代码不会倒退图库。

**本机新版并不等于香港待发布包**：本机页面直接读工作区，香港代码包读本地已发布快照。要让相同修改进入稳定版，需要先完成原有本地构建 / 发布流程，再在这里发布。

## 资产库更新：先基线，再增量

1. 点 **下载资产编辑副本**。它下载香港最新的参考资料与媒体哈希索引，在 `.releases/asset-workspaces/<时间戳>/` 创建新副本；不会覆盖以前的编辑目录，也不修改原 Windows DB。
2. 点 **打开资产工作目录**。用 SQLite 编辑器编辑 `library.sqlite3` 的参考资料；不要修改表结构。此副本不包含账户、会话、玩家收藏、投票、上传记录或云存档。
3. 要新增 / 修改媒体，把文件放到工作目录的 `media/` 下，保留相对路径。例如：

   `media/assets/罗小黑战记数据库/images/新角色.png`

   `media/assets/素材/新素材.png`

   `media/asset-library/homepage-gallery/新文件名.png`

4. 图片引用字段使用 `assets/罗小黑战记数据库/...` 这样的相对路径。香港会转换为它自己的绝对数据路径。不要填 Windows 绝对路径。
5. 点 **预览资产更新**。查看记录数、文件数和 `plan.json` 中每项 before / after。预览会向香港检查冲突，但不会写库。没有变更时发布也是空操作。
6. 确认预览后点 **发布资产更新**。编辑副本或媒体在预览后又发生改变时，会要求重新预览。
7. 成功后，下一批编辑请重新下载香港基线。保留的旧工作目录不会自动变成新的基线。

发布逐项比对基线，香港有并发编辑或 ID 冲突就拒绝整批更新。它不会用本机整库覆盖香港，不会删除香港新注册用户，也不会把冻结 Windows 库里的旧图片带回来。

媒体目录不会全量复制：只上传放进工作副本 `media` 的文件。删除参考记录不自动永久删除其原媒体文件。首页图库采用新文件名发布，禁止原名替换，以免旧 CDN 缓存继续显示旧图；首页图库列表 / 编排仍属于首页构建产物，改变列表需相应代码发布。

世界观图片接口保持既有 BYPASS / DYNAMIC 行为，无需为了这些接口额外清 Cloudflare 或 nginx 缓存，也无需新建 API Token。

## 资产回滚与恢复

**回滚上次资产更新**反向应用上一批记录和文件变更，不恢复整份旧数据库。回滚前同样检查线上值；被玩家 / 管理员之后修改过的资产记录会产生冲突，需要合并后再操作。代码不随资产回滚。

每次实际资产更新在香港 `/srv/iridescently/asset-updates/<版本>/` 留存变更清单、库备份和受影响文件的原件。更新使用 SQLite 事务、文件日志和事务内版本标记；若进程中断，下一次资产命令会按标记恢复未提交的文件操作。不要直接用备份覆盖正在运行的整库。

资产接口仍可在香港后台编辑；管家不会取代这些功能。未分类审核、玩家投稿记录、收藏和投票仍由线上后台管理，不进入离线副本。卡牌数值配置与房间运行数据同样保留在香港，不会随代码或此参考资产包覆盖。线上编辑与离线编辑相撞时，以冲突提示为准。

## 本次真人图片隔离

2026-10-19 已按预览清除 `character_images` 的 585、586 和 `images` 的 1016、1017。

- 备份：`/srv/iridescently/data/assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db.bak-20261019-075410`
- 文件隔离：`/srv/iridescently/quarantine/20261019-075410/`
- 两个原文件名和 SHA256 已加入香港资产发布阻止名单，避免旧副本误发布回来。
- 原 Windows 库未修改；它既不是在线数据源，也不是新的资产编辑副本。

公开接口复查：被删除的两个图片 ID 均返回 404；剩余 4 张本地图的原图哈希未命中隔离名单。另有 1 个外链重定向和 1 张图片（ID 1184）返回 404，未把这些项当成全量哈希通过，详见 `work/hk-bandwidth/verification-realperson-removal.json`。未扩大删除范围。

## 文件与凭据

| 用途 | 位置 |
| --- | --- |
| 窗口 | `ops/server-manager.py` |
| CLI | `ops/server-control.py` |
| 代码发布 | `ops/hk-release.py` |
| 增量资产校验 | `ops/server_assets.py` |
| 本机无数据库网关 | `ops/pc-preview.py` |
| 本机隧道、进程状态与日志 | `.releases/server-manager/` |
| 资产编辑目录 | `.releases/asset-workspaces/` |
| 香港受限发布入口 | `/usr/local/sbin/iridescently-control` |
| 香港资产校验模块 | `/usr/local/lib/iridescently/server_assets.py` |

日常代码和资产操作使用既有的本机专用 SSH 密钥，不要求输入 root 密码。首次安装 / 修复服务器控制脚本才需要管理员权限。Cloudflare 账号证书只在配置域名时使用；运行隧道仅需本机专属凭据。

不要分享 `.releases` 中的密钥、隧道凭据、环境文件或资产编辑副本。它们由 Git 忽略。Windows 专用 SSH 密钥和 PC 隧道凭据有当前用户 / SYSTEM 的 ACL；密码未写进管家或 README。

## 命令行与检查

```text
python ops/server-control.py status
python ops/server-control.py pc-start
python ops/server-control.py pc-stop
python ops/server-control.py code-prepare
python ops/server-control.py code-publish
python ops/server-control.py code-rollback
python ops/server-control.py assets-init
python ops/server-control.py assets-plan
python ops/server-control.py assets-publish
python ops/server-control.py assets-rollback
python ops/test_server_management.py
python ops/server-manager.py --smoke-test
```

`pc-configure` 会写新的 pc-* DNS，其余代码 / 资产操作不改 DNS。所有真实发布和回滚都是按钮或命令显式触发，没有定时自动发布。

验收记录位于 `work/hk-bandwidth/verification-dual-live.json` 和 `verification-dual-offline.json`。已检查双服匿名 API 响应一致、各自页面和构建资源、敏感文件拦截，以及停止本机新版后香港仍可访问。浏览器在 390px 下实测了新版返回稳定版和开场按钮避让。真实账号登录 / 写云存档往返尚需用你自己的账号验收。
