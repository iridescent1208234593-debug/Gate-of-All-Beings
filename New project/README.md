# New project · 项目地图与 Connections 分析

核查日期：2026-10-09。工作区：`E:\Projects\New project`。

这是进入工作区的地图，不是新页面实现说明。本文区分 **已核实的本地事实**、**下一阶段建议** 和 **Needs verification**。本轮只新增此 README；没有实现 Connections、修改源码或 reference、安装依赖、运行构建、删除/移动文件、创建分支、提交或发布。

## 2026-10-10 整理后的入口

- 生产与研发目录保持现有相对路径：`gallery/`、`day100-film/`、`six-system-arena/`、`experiments/`、`doc/`、`references/`、`motion/`、`skills/`。
- 实验入口：[experiments/README.md](experiments/README.md)，阶段实现与评审证据分开索引。
- `doc/` 是项目研究文档，统一索引在 [doc/README.md](doc/README.md)，无需移动而破坏研究/实验引用。
- `InternalBeyond/` 继续作为 Persona 开发参考保留；其内层 Git 已有暂存文件，本次不提交、不删除。
- 独立小说 `A小说/` 已整体迁至 `E:\New project\小说\植物A`，入口 `E:\New project\README.md`。
- `merge_out.txt` 为零字节历史临时输出，迁入 `../docs/maintenance/archive/` 保留，不再平铺于研发根目录。
- 下文是此前审计与设计地图，旧现场和“本轮未删除”等描述属于该次历史记录；此次实际动作以 [整理记录](../docs/maintenance/repository-cleanup-2026-10-10.md) 为准。

## 阅读入口与核查边界

- 先读本文，再按需要阅读 [REFERENCE_BASELINE.md](REFERENCE_BASELINE.md)。后者保存设计研究背景，其中的旧任务授权不构成本轮实施授权。
- 实际 Git 根目录是 `E:\Projects`，当前父仓库分支为 `feat/sixsys-e2e-closeout`。下列多个目录另有独立 `.git`；不是一个统一 npm workspace。
- 先查看一级、二级目录，再读取 README、package/config、入口与少量关键源码；后续只对识别出的项目做文件名、引用、生命周期及目标哈希检查。目录巡检跳过 `.git` 内部、node_modules、dist/build/cache/coverage；生成目录仅做针对性的文件计数与体积检查。
- 没有读取图片/视频原件内容，没有审查所有大型二进制、遍历依赖源码或执行原版 EXE。
- 现有生产入口在目录外：`E:\Projects\portal\www`、`E:\Projects\portal\huiguan`、`E:\Projects\server\app`、`E:\Projects\shared`。仅为追踪依赖而读取相关入口，没有修改。
- 本地已有 8080 服务；读取 `http://127.0.0.1:8080/connections.html` 返回 200，脚本为 `./scripts/connections.js`。未启动/重启服务，未执行浏览器交互或性能录制；公网版本、FPS、GPU 内存与手机实机表现均为 **Needs verification**。

## Project Map

表内路径均相对于 `E:\Projects\New project\`；“使用”指源码/构建/资料依赖证据，不代表本轮确认公网部署。

| 项目 / 路径 | 实际用途与技术栈 | 当前状态、使用证据与主站关系 | Connections 相关程度 | 保留 / 继续开发判断 |
| --- | --- | --- | --- | --- |
| Atmospheric Depth Gallery · `gallery/codrops-depth-gallery/` | 真实贺图自动发现、图片取色、深度图库与气氛；Vite、Three.js、GLSL、ColorThief Worker | 生产构建依赖。主站 `scripts/gallery.js` 直接导入 Engine/CSS，`build-homepage.mjs` 和 `vite.config.mjs` 使用此处 plugin、依赖与别名；内层 Git `main`、HEAD `b91193b`，README/plugin/config 有既有未提交改动 | 高：图片、取色、加载和资源管理；全屏滚轮模型不适合正文 | KEEP；继续维护生产能力，先核查释放缺陷 |
| Curve Gallery · `gallery/curve-gallery/` | 曲线路径摄影、CPU 椭球 mood field、project/ambient 分层；Vite、Three.js，当前无 GSAP | 独立空间实验；`sol-visual-phase`、HEAD `a3e5d8e`，工作树干净。8 个真实封面仍配 sample 项目数据；未在检查的主站构建入口发现导入 | 中：统一状态/资源生命周期可参考；不是 Origin 时间轴 | ARCHIVE；保留，下一阶段需明确产品用途后继续 |
| Infinite GSAP Gallery · `gallery/infinite-gsap-gallery/` | DOM 无限画廊、Observer 输入、Flip 放大/返回；Parcel、GSAP、imagesloaded | 干净上游 clone，HEAD `1ed1cf5`；无已查主站导入。不是 Depth Gallery 的副本 | 中：图像到详情的状态连续性 | ARCHIVE；保留技术参考，不维护第二套正式图库 |
| Scroll Revealed WebGL · `gallery/scroll-revealed-webgl/` | 像素 reveal、图像平面、详情过渡；Astro、Three.js、GSAP、ScrollSmoother、Barba | 干净上游 clone，HEAD `f236f2a`；无已查主站导入 | 中：pixel reveal 与纹理/DOM 对位 | ARCHIVE；按效果参考，避免移植整套路由/renderer |
| dotmatter · `motion/dotmatter/` | 粒子、dither、halftone、ASCII 等 WebGL2 效果引擎及 React wrapper；TS、pnpm | 干净上游 monorepo，HEAD `0762bfe`；无已查主站导入 | 中高：halftone/dot，局部触碰反馈 | KEEP reference；只对确有需求的单个效果评估开发 |
| Motion Primitives · `motion/motion-primitives/` | React 动效组件和文档站；Next、Motion、Tailwind | 干净上游 clone，HEAD `120f64f`；有 cursor、magnetic、carousel、blur、in-view 等；不是主站组件库 | 中：交互参数与可访问结构参考 | KEEP reference；不把 Next 文档站引入静态主站 |
| Scroll Layout Animations · `motion/scroll-layout-animations/` | Lenis + GSAP Flip/ScrollTrigger 的滚动布局实验；原生 HTML/JS | 干净 clone，HEAD `ade47c5`；包含 pin 和长滚动区间；无已查主站导入 | 中：布局之间的连续变形 | ARCHIVE；概念参考，避免照搬长 pin 结构 |
| 六系演武 · `six-system-arena/` | 数值模型、数据库派生、卡组/成就、对战结算、集成交付包；Python、PS、JS、React/TS adapter | 父仓库跟踪，README/run_all/报告有近期既有改动和 E2E 输出。`integration/` 是单向交付包；当前 cards 源码扫描未找到 sixsys 接入引用 | 低：可做技术/开源说明，不直接承担 Connections 交互 | KEEP；继续独立开发；生产挂载 **Needs verification** |
| 省省 Web 游戏 · `shengsheng-shoot-web/` | 海滩射击游戏；原生 HTML/CSS/JS、Canvas 2D | 独立源码，有 core/game/响应式控件；`game.js` 与 `portal/www/playtest/shengsheng-shoot/game.js` SHA-256 相同。其余发布资源未全量比对 | 高：Special Thanks 可玩的对象 | KEEP；复用游戏，后续补挂载/暂停/销毁接口 |
| 省省游戏恢复与审计 · `shengsheng-shoot-audit/` | PCK 提取、Godot 可读源码恢复、纹理导出、逻辑/浏览器检查和证据 | 有 recovered、extracted、textures、tools、截图；`core.test.mjs` 实际导入相邻 Web 版。不是第二个 Web 游戏 | 高：玩法与素材来源证据 | KEEP；保留恢复源码、脚本、代表性验证证据；工具包缓存另列 |
| 原版游戏包 · `shoot_game 南巷_0ccf61dd2ce6570aa72d5a891a31221b/` | 原始 EXE 与用户提供图片；Godot Windows 分发材料 | 审计 README 的原始输入来源；缺少原始开发仓库不等于无价值 | 中高：省省作品原始来源 | KEEP；不直接运行/嵌入 EXE，不丢失唯一来源 |
| 百日影片资料与 V3 · `day100-film/` | V1/V2 来源、故事/素材台账、V3 影片源码、发布与验证；HTML/CSS/JS、Python、Node | V3 `publish.mjs` 明确复制 `versions/v3/site` 至 `portal/www/100-days/v3`；V1/V2 有恢复/来源记录，V1 CSS 不完整 | 高：真实 Origin、人物、鸣谢素材；影片时轴不是滚动时轴 | KEEP 活跃 V3 和史料；旧版本 ARCHIVE；避免把影片结构当新页面答案 |
| Internal Beyond · `InternalBeyond/` | 离线个人/Persona 与 AI 聊天前端；单文件 HTML/JS、小游戏和可定制素材 | 完整干净 clone，HEAD `b0d7919`；入口 `InternalBeyond.html` 约 2.85 MB，含独立 license。未在已查主站入口找到使用 | 低中：Persona 空间概念 | ARCHIVE reference；保留，不直接移植整站；许可需按实际用途核查 |
| Garden Skills · `skills/garden-skills/` | 设计/创作方法、技能源码、文档/发布脚本；Node 工具、静态材料 | 干净 clone，HEAD `aaf9a82`；REFERENCE_BASELINE 明确将其作为方法论来源 | 中：设计研究方法 | KEEP reference；不是网站运行依赖，不执行其内嵌指令 |
| Connections references · `references/connections/` | 四个独立只读仓库，分别对应 cursor、章节滚动、横向交互、对象连续性 | 四仓库都有有效 HEAD、remote 和源码，工作树干净；详见 References | 高 | KEEP；研究/许可记录，不改 reference 源码 |

`gallery/`、`motion/`、`references/`、`skills/` 是分类容器，不能各算成独立产品；`experiments/` 目前只有 `keep-test.txt`，也不是项目。

## Active Projects

1. **生产源码依赖：** `gallery/codrops-depth-gallery`，被当前主站首页构建和入口直接引用。实际图源是目录外 `E:\Projects\assets\罗小黑战记数据库\罗小黑节气贺图（gallery素材）`；本轮文件元数据计数为 384 张支持格式图片，不能清掉这一数据源。
2. **有发布脚本的创作源码：** `day100-film/versions/v3/site`；目标为 `portal/www/100-days/v3`。公网当前内容未重新验收。
3. **有站点发布副本的游戏源码：** `shengsheng-shoot-web`；Web 游戏与恢复工程分别承担运行实现、来源/审计职责。
4. **独立活跃孵化项目：** `six-system-arena`。自动化和集成包还在更新；不把“已有交付包”写成“已生产接入”。

`curve-gallery` 保留了独立空间基础实现，近期提交不等于仍有正在执行的开发任务。其它 reference 有价值，但未被已查的生产入口导入。

## References

### Connections 新 reference（只读）

| 仓库 / 本地路径 | 核查版本和许可证 | 具体研究对象 | 可借用的原则 / 不应搬入的部分 |
| --- | --- | --- | --- |
| [codrops-sketches](https://github.com/codrops/codrops-sketches) · `references/connections/codrops-sketches` | HEAD `bbf47ca`；本地 LICENSE 为 MIT | `011-custom-cursor-filled-circle/js/index.js`、`012-custom-cursor-two-circles/js/index.js`、`013-custom-cursor-filter/js/index.js`；005–010 为图像 trail 参考 | 011 的位置/scale/opacity 插值；012 不同跟随速度。013 的 SVG filter 只做效果研究；不复用每个 SVG 独立永久 RAF、仅绑定 a 标签的触发方式、广告脚本 |
| [ScrollPanels](https://github.com/codrops/ScrollPanels) · `references/connections/ScrollPanels` | HEAD `cb0e61a`；MIT；package 使用旧 `@studio-freight/lenis ^0.2.9`、GSAP `^3.11.3` | `src/js/index.js` 至 `index5.js`，columns/showcase 两段、scrub 时间线 | 章节间视觉权重和进度映射；它没有现成 enter/establish/settle/leave 状态机，不应描述为已有章节系统；不移植旧依赖与全图 preload |
| [embla-carousel](https://github.com/davidjerleke/embla-carousel) · `references/connections/embla-carousel` | HEAD `91f5ced`；本地 `9.0.0-rc04`；MIT | `packages/embla-carousel/src/components/{DragHandler,DragTracker,Animations,ScrollAnimator,Options}.ts` | 横向轴判定、惯性、click 抑制、settle 停帧、事件清理；用于 Origin 交互，不复制 Carousel UI、loop、autoplay、wheel 插件 |
| [OneElementScroll](https://github.com/codrops/OneElementScroll) · `references/connections/OneElementScroll` | HEAD `feb7ad7`；MIT | `js/index.js` 的 `.one`、`[data-step]`、Flip.getState/fit、gsap.context/revert；`js/smoothscroll.js` | 同一对象跨 waypoint 的身份连续性、resize 重新测量；不把各图片/标题的独立 trigger 和 Lenis ticker 整套搬入 |

### 其它参考与许可缺口

保留 `gallery/infinite-gsap-gallery`（Flip 详情）、`gallery/scroll-revealed-webgl`（pixel）、`motion/dotmatter`（halftone/dot）、`motion/motion-primitives`（magnetic/cursor/blur）、`motion/scroll-layout-animations`（布局变形）、`skills/garden-skills`（设计方法）。这些项目解决不同问题，不因能力名称重复就删除 clone。

- `infinite-gsap-gallery` 的 README 写 MIT，但 package 写 ISC，且本地没有 README 所链接的 LICENSE：**Needs verification**。
- `scroll-revealed-webgl` 的 README 写 MIT，但本地没有其链接的 LICENSE；`curve-gallery` 本地也未见 LICENSE：**Needs verification**。缺失许可文件本身不能证明下载失败。
- InternalBeyond 根 LICENSE 明确将软件和视觉/文档许可分开，软件指向 PolyForm Noncommercial。是否可用于具体未来发布：**Needs verification**；本轮不提供许可法律结论。
- README 的 external 链接只用来记录出处；本轮未把上游最新代码拉入本地。

## Reusable Systems / Canonical Systems 建议

本节是下一阶段的选型建议。除表中“现有生产”项外，推荐的共享系统还没有实现。

| 系统 | 已存在的实现、重复点 | 建议 canonical 与理由 | Connections 采用方式 |
| --- | --- | --- | --- |
| Gallery | Depth：真实图片/取色/资源池；Curve：空间曲线；Infinite：DOM 无限列表；Scroll Revealed：pixel/detail；会馆还有自己的角色图库 | **现有主站 Gallery canonical：Depth**，由真实 import/build 证据确定；其它是不同表现研究，不强行合并 | 复用图片/色彩与资源原则；不实例化完整全屏 Engine |
| Color System | Depth 的 `src/data/palette-worker.js` + `palette.js`；Curve 的 sample palettes/CPU mood field；会馆 index 内角色配色和 `applyFormTheme()`，另有 ancient/cathycolor 数据 | **图片色 canonical：Depth palette；角色/会馆配色 canonical：现有会馆数据与函数**。它们输入不同；尚无一个已抽取的全站独立 Color 包 | 用现有取色结果驱动章节 CSS 色彩；会馆系统作为 Things I gave back 的真实候选，不声称已开源 |
| Cursor | Codrops 011/012/013；Motion Primitives `components/core/cursor.tsx`；Depth 的 WebGL Trail 是视觉尾迹，缺少 VIEW/ENTER 等语义 | **拟建一个原生 DOM cursor**，以 011/012 为算法参考；当前没有符合本轮全部要求的全局 cursor | 改写；不引入 React/Motion，不把 WebGL trail 当全局 cursor |
| Scroll | Depth 的全局 wheel/touch → camera；Curve canvas input；Infinite Observer；ScrollPanels/布局 demo 的 Lenis；Pixel demo 的 ScrollSmoother | **Connections canonical：原生纵向 document scroll**。章节状态由一个控制器管理；必要时 GSAP/ScrollTrigger 驱动章节视觉；首版不加 Lenis | 只参考滚动进度映射；不复用图库的 preventDefault 输入 |
| Transition | Depth mood/fade/GLSL；Infinite Flip open/close；OneElement Flip 跨 waypoint；Pixel shader/Barba；Motion blur | **章节 transition：内容对象 + CSS atmosphere；局部对象变形才用 Flip**。页面 navigation 仍保持现有链接行为，短过渡为渐进增强；无现成全站通用 transition canonical | 改写；不增加平行 Barba router 或全屏遮罩 |
| Timeline | V3 的自动播放时间轴；Curve 的 path progress；Motion carousel 的 index/固定 slide；Embla drag core | **拟建 Origin DOM 时间轴 + Embla 横向内核**，时间轴内容与纵向章节状态独立；不存在可直接用的 Origin 产品 | Embla 内核复用，时间轴 DOM/语义改写；影片只参考素材与暂停习惯 |
| WebGL | Depth Engine、Curve renderer、Pixel Canvas、dotmatter core 都有独立渲染体系 | **主站已有 Depth；Connections 默认 DOM/CSS**，有明确效果和性能证据才局部启用一个 renderer | 不把四套 renderer 并入一页；优先静态 halftone 和图片渐变 |
| Loading | Depth `GalleryResources` 渐进资源 + 主站 gallery status/retry；游戏 preload；demo imagesloaded；影片全图 preload | **普通内容原生 lazy/async decode；特殊媒体局部 loading**。Depth 资源池继续服务 Gallery | 改写局部加载壳；不阻塞全文等所有图片 |
| Navigation | 主站 `portal/www/scripts/site-navigation.js` 与 `brand-interaction.js`；历史 shared-chrome-v2；会馆 game-nav | **Connections 复用现有主站导航与品牌入口**；当前 connections.js 确实导入这两个脚本 | 直接复用；共享 footer/旧 chrome 的替代范围另查，不能据此删除 |
| Magnetic / interactive objects | Motion `magnetic.tsx`、`tilt.tsx`；Infinite image/detail；现有角色与游戏交互 | **原生局部反馈**，仅当前 hover 对象更新，幅度受限 | 改写算法，保留点击和键盘语义 |
| Mobile fallback | Curve lowPower/DPR 档；dotmatter img fallback/reduced/offscreen；游戏触控；主站 Gallery 紧凑适配 | **Connections 保留同一数据，用可读 DOM、点击展开与静态图** | 直接采用降级原则；主站 Gallery 手机适配不等于新页面已验收 |

完成度最高的真实图源/色彩管线是 Depth；空间状态结构最清楚的实验是 Curve；横向拖动的专用参考是 Embla；生命周期较完整的粒子 wrapper 是 dotmatter。这里比较的是源码结构与已接入程度，**没有进行同设备基准测试，不能断言哪个 FPS 最高**。

重复 GSAP/Lenis 出现在独立 reference，不代表生产页面已重复加载。未来应消除同一页面上争抢 wheel、transform 和时钟的重复驱动，而不是删除不同用途的研究仓库。

## Experimental / Archive

**ARCHIVE 是建议保留的状态，不是本轮把文件移动到 archive 文件夹。**

| 范围 | 分类 | 为什么保留 |
| --- | --- | --- |
| Curve、Infinite、Pixel Gallery；Scroll Layout | ARCHIVE | 各自有不同空间/transition/reveal 技术，未证明被新版完整覆盖 |
| `six-system-arena/legacy/d-drive-r1`（重复文件候选除外） | ARCHIVE | MIGRATION 明确为 D 盘 R1 只读快照；有外置覆盖、溯源和字段校验等未完全吸收能力，不能整目录当迁移垃圾 |
| `six-system-arena/vendor/backup` | ARCHIVE | backup-index、CHANGELOG、`docs/06-数据源与回滚.md` 实际引用，含补丁前共享 UI 快照；不是已失效的无引用 backup |
| `day100-film/versions/v1`、V2 来源副本、text、community/current 证据 | ARCHIVE / KEEP | 原 ZIP、素材、恢复片段、来源/缺失台账与验收截图有历史价值；资料 README 明确保留，V2 本身仍有站点入口 |
| `shengsheng-shoot-audit/recovered`、测试脚本与截图 | KEEP | 恢复出可读 GDScript/场景、逻辑测试导入当前 Web 版、截图作为跨设备验证证据；不是无入口代码 |
| `InternalBeyond` | ARCHIVE | 完整外部 Persona 项目参考；与主站没有已查导入关系，但用途与许可独立 |
| `experiments/keep-test.txt` | KEEP | 内容为 “Keep this test file.”，是明确保留的测试标记；无运行价值也不据此改判垃圾 |
| `gallery/codrops-depth-gallery/src/Experience/TrailHeadParticles.js` | KEEP | 虽标注 optional experiment，仍被 TrailController import、创建并 update；不是孤立代码 |

## Cleanup Candidates / 无作用副产物报告

本轮**没有删除任何文件**。清理优先级由可再生成性、引用与唯一价值决定，不由文件年代决定。

### DELETE CANDIDATE

| 具体路径 | 核实证据 | 下一阶段建议 |
| --- | --- | --- |
| 已于 2026-10-10 清理的时间戳 `derive-from-db` 副本（原路径见 Git 历史） | 与同目录 `derive-from-db.mjs` SHA-256 完全相同（`A6928E80…6F3B848`）；已查本目录/项目文本未找到时间戳文件名引用；原文件仍有入口/文档 | 已移除完全一致且无调用的副本，保留 canonical `derive-from-db.mjs` |
| `references/connections/OneElementScroll/.DS_Store`、`img/.DS_Store`、`js/.DS_Store` | Finder 元数据，且被上游 Git 跟踪；不是内容或依赖 | 仅作为清理候选记录；reference 只读，未来动作需要明确包含该范围 |
| `gallery/codrops-depth-gallery/src/assets/` | 空目录；已查 src/config 没有对此空目录的 import，正式图源在外部 assets | 可清掉空壳；不扩大为删除正式素材目录 |

没有找到足够证据把其它完整项目整体判为 DELETE CANDIDATE。

### GENERATED

| 具体范围 | 事实 / 再生成依据 | 清理限制 |
| --- | --- | --- |
| `gallery/codrops-depth-gallery/dist` | 388 文件、约 305.13 MiB；384 为 gallery-files 图片副本；由 Vite/plugin 构建产生，Git 未跟踪 | 先确认没有本地 preview/发布在读；当前源码构建默认可走 CDN，不能保证重建字节完全等于旧产物 |
| `gallery/curve-gallery/dist` | 27 文件、约 5.72 MiB；Vite build 输出，Git 未跟踪 | 源码和 public 留存；停止依赖该输出的 preview 后再清 |
| 两个 Gallery 的 `node_modules` | package/lockfile 配套依赖安装目录；主站 build-homepage 确实调用 Depth 的 Vite 和 plugin 包 | 可重装，但不能当无使用缓存立即清掉；本轮未安装/重装 |
| `references/connections/ScrollPanels/dist` | 43 文件、约 1.65 MiB，Parcel 产物，但全部由上游 Git 跟踪 | GENERATED 不等于应删；这是 reference 自带可查看 demo，保留，且旧依赖重建未验证 |
| `six-system-arena/data/generated/character_stats.json`、`data/generated/e2e/*`、`integration/verify/verify_report.json` | generate_stats/e2e_flow/verify 脚本和 run_all 指向这些产物 | 角色数据是交付包输入，不能清掉后不恢复；E2E/verify 是验收证据，只在确认可重跑后清理 |
| `six-system-arena/integration/data/*`、`integration/js/*` | sync_from_arena 明确从 arena 真源同步，verify 检查漂移 | **KEEP 交付副本**，不是无用重复；当前挂载状态仍需验证 |
| `shengsheng-shoot-audit/gdre.zip` | 下载的恢复工具压缩包，已另有 `tools` 和恢复源码 | 可再下载性/固定版本来源 **Needs verification**；作为缓存候选，不删恢复源码 |
| `shengsheng-shoot-audit/textures`、`extracted` | extract-pck/extract-textures 脚本明确输出这些目录 | **KEEP 来源/恢复证据**；原始 EXE + 工具链是否足以完整重现，需要验证 |
| 游戏 `browser-results.json`、screenshots；V3 `verification` | 验证脚本产生的结果与截图 | GENERATED 的同时有验收证据价值；保留代表性结果，不能全当 AI 垃圾 |

### UNKNOWN / Needs verification

| 范围 | 已确认内容 | 尚不能下的结论 |
| --- | --- | --- |
| `six-system-arena/legacy/d-drive-r1/src/ui/react/SystemIcon_20261006_000755_817.tsx` | 与 `SystemIcon.tsx` 哈希不同；时间戳版用 `cardIcon`，现原名版依赖 `decorateIcon`，barrel 文档标注了缺陷 | 旧版可能保留修复线索，不能当完全重复副本；需确认旧能力已吸收 |
| `skills/garden-skills/dist/prompts/claude-design-system-prompt.md` | dist 中唯一文件，Git 跟踪；发布 pack 脚本默认生成的是 dist/release，未找到此 prompt 的同名生成命令 | 不能因目录叫 dist 就认定可再生成；保留 |
| `day100-film` 的 8 个空目录 | `community/contributors`；`current/{character-gallery,huiguan,juling,zszm}`；`history/{failures,milestones}`；`source/images` | 资料库有缺失素材说明，空目录可能是收集占位；需按 MISSING_ASSETS/创作需要确认，不能只凭为空删除 |
| 未引用图片/大型二进制的全量去重 | 本轮不解码原件，不对 4 个 reference 的全部 sample assets 做内容匹配 | 没有宣称所有孤儿素材或重复图片已被找全 |
| `six-system-arena/data/stat-model_20261007_140741_663.json` | 本轮开始时 Git 已是删除状态，当前文件不存在 | 不是本轮删除，也不补回；先查原变更任务的处置依据 |
| 旧路径文档 | Curve HANDOFF 仍写旧 `New project/curve-gallery` 和旧参考路径；当前实际已分组到 gallery | 入口 README 指向真实位置；旧文档/验证命令的其它漂移待单独修订，本轮不改子项目文档 |

### 范围外失败 clone 旁证

`E:\Projects\InternalBeyond` **不在本轮 New project 范围内**，只有 `.git`，HEAD 不可解析，Git 无 pack 对象且报告 `tmp_pack_1z5BbE` 垃圾；remote 与完整的 `New project/InternalBeyond` 相同。它符合失败下载残留特征，可供未来另行明确范围后清理。本轮不改、不删，不把其状态套用于完整副本。

所有有效项目 `.git` 应 KEEP；本轮检查的内层 git-dir/common-dir 均为 `.git`，不是需要随手删掉的“缓存”。父仓库对部分 reference/实验设了 ignore，**ignored 不等于无用或已备份**。

## Connections 可复用能力清单

| 能力 | 来源 | 方式 | 原因与边界 |
| --- | --- | --- | --- |
| 站点导航 / 品牌 | `portal/www/scripts/site-navigation.js`、brand-interaction.js、chrome 样式 | 直接复用 | Connections 当前入口正在用；保持 canonical/current-page 与新窗口语义 |
| 友站、鸣谢与管理编辑 | `portal/www/scripts/connections.js`，`/links.json`、`/thanks.json`、`/api/admin/links`、`/api/admin/thanks`、`/api/sso-user` | 复用数据与权限流，改写呈现 | 当前已有持久化与管理员编辑，不能重做静态名单而丢掉原能力 |
| Origin 史料 | 用户本轮明确内容 + day100 STORY/ASSET_INDEX/CREDITS | 内容引用，逐项核实素材 | 本轮已知年份只有 2014；其它节点不编造精确日期，影片叙事不自动覆盖本轮顺序 |
| 图片取色 | Depth palette / Worker | 复用算法，改写 DOM 消费者 | 同一个 image→palette→art direction 来源，不能另外制造随机章节配色系统 |
| 图像加载 | GalleryResources 的并发/取消原则，原生 img | 改写 | DOM 图片不需 Three 纹理；loading/retry 只阻塞当前特殊对象 |
| Cursor | Codrops 011/012 | 改写 | 缺状态词、桌面门控、销毁/闲置停帧；需要一份全局语义 cursor |
| 章节进度与 settle | ScrollPanels + 原生 scroll / 可选 ScrollTrigger | 只参考，再实现章节 controller | reference 有视觉 timeline，没有完整章节生命周期 |
| 跨章节对象 | OneElementScroll Flip/context | 只参考 | waypoint 身份连续性适合少量贯穿对象；不是所有章节共享同一种特效 |
| 横向惯性 | Embla vanilla core | 直接使用内核，改写时间轴 UI | 有横向轴判定、点击抑制、惯性和 settle；页面仍正常竖向滚动 |
| People magnetic | Motion Primitives magnetic / tilt | 改写 | 原实现每实例 document mousemove + geometry read；改为当前对象局部更新 |
| 图片过渡 / halftone / pixel | Depth atmosphere、Infinite Flip、Pixel shader、dotmatter | 只参考或局部改写 | CSS/静态纹理先行；无须为 Credits 引入整套 WebGL/Barba |
| 省省可玩对象 | shengsheng-shoot-web + audit/recovered | 复用游戏，改写宿主接口 | 保留玩法与像素风；需 start/pause/resume/destroy、离屏停帧、音频手势、触控竞争处理 |
| Persona / OC | 现有会馆角色数据与用户已授权形象；InternalBeyond 作为概念来源 | 数据/素材按授权复用，外部项目只参考 | 不假定 InternalBeyond 等于省省 Persona；身份、素材和贡献仍需确认 |
| Reduced motion | dotmatter/Curve/主站已有相关判断 | 复用原则，明确新页行为 | 现有项目的局部降级不等于全站 cursor 和章节已满足需求 |

## Connections Interaction Architecture（建议，未实现）

纵向主轴是 document，Origin 的横向轴只在局部视口生效。页面状态最少包含 `activeSection`、`phase`、`direction`、`sectionProgress`、`activeTimelineId`、`openedObjectId`、`pointerMode`、`reducedMotion`；章节进度、横向位置、展开对象相互独立。使用一个页面 controller 管理挂载和资源释放，不建通用插件框架。

| 顺序 | Enter / Establish | Settle（真正允许停留的内容） | Leave / 连接下一章 |
| --- | --- | --- | --- |
| 1 Origin | 稀疏的横向节点与少量颜色出现，先给出“为什么做这个网站” | 拖动/触摸、hover 预览、点击固定详情；不需横向滚到底，随时能继续竖向滚 | 灵感线索收成一个轻量贯穿对象，引到真实的人 |
| 2 People | 人物/OC 在不同尺度与位置进入页面空间 | 同时只有当前人物获得轻微 magnetic；click/键盘打开人物故事与贡献 | 人物退到背景或位置回归，协作对象获得视觉权重 |
| 3 Creative Support | 友站作为各自有视觉识别的“门”，截图尊重原比例 | hover 有短空间反馈、cursor ENTER；真实 a 链接跳外站，无外站 iframe | 门的图像色淡出，留下项目名和技术线索 |
| 4 Technical Support | 密度与动效降低，呈现 backstage | 可读的贡献、部署/基础设施分工，按真实证据填写 | 工程来源引到借用/回馈关系 |
| 5 Open Source | 两条清楚的内容线：Things I borrowed / Things I gave back | repo、author、license、实际参考内容；西木配色与 Gallery 标明计划/已发布状态，不伪造仓库链接 | 保留出处线索，进入工具怎样参与创作 |
| 6 AI & Tools | 从任务/产出角色进入，避免 Logo 墙 | Kimi、DeepSeek、ChatGPT、Claude、Marvis 按 Research/Code/Writing/Visual Exploration/Debugging/Architecture/Review 的已确认参与记录呈现 | 工具退场，让学到的视觉原则成为主角 |
| 7 References | 案例与“从这里学到什么”成对出现 | 展示学习内容、映射到站点哪一处，不把网址列表充作故事 | 技术/视觉信息收敛到具体感谢 |
| 8 Special Thanks | 省省有独立可触碰空间，游戏/Persona 明确可进入 | PLAY 后才初始化游戏；可退出，暂停和触控区域清楚；Persona 没有确证素材时先标缺项 | 离开时暂停游戏/音频，复杂度与色彩扰动逐步下降 |
| 9 And you? | 画面安静、留白增多，出现 And you? | hover SAY HI 后点击/键盘才展开联系方式；cursor 提示不是唯一入口 | 正常 footer、导航与可回到上方的路径 |

所有章节都有自己的 establish 和可阅读 settle，不要求固定时长、不锁住滚轮、也不等待动画播完才可点击。回滚时状态可逆；锚点和快速滚动可直接到内容，不能强制从前章重新播起。

后台数据仍沿用现有 links/thanks 和权限接口。新增 Credits 数据最少记录 `id/kind/name/repo/author/license/borrowedFor/sourceUrl/status`，AI 另有 `roles` 和参与证据；没有证据的贡献、日期或开源状态留空并标 Needs verification。Origin 回答“为什么存在”，References 回答“为什么长成这样”。

## Motion System（建议，未实现）

| 状态 / 动作 | 规则 | 成本与可访问边界 |
| --- | --- | --- |
| section enter | 内容进入可见区域后启用当前章；短位移、opacity 和色彩权重变化 | 不隐藏可访问正文等待 JS；离屏媒体不初始化 |
| establish | 标题、关键对象和一段叙事形成视觉主次，进度跟实际竖向位置 | 一个章节 timeline/controller；缓存 geometry，resize/字体/展开后才重测 |
| settle | 阅读区域为宽区间，元素静止；滚动停止约 120–180ms 后停止跟随更新 | 此时间是交互建议，不是强制等待；不要用持续漂浮表达“有生命” |
| leave | 主对象回归/迁移，背景权重交给下一章；正文依然可读 | 游戏离屏暂停，局部 canvas 停帧；反向滚动可还原 |
| hover | 约 120–200ms，位置变化建议 4–8px；只增强当前对象 | transform/opacity 优先，避免全屏 blur/filter 动画 |
| drag | 仅 Origin 横轴受 Embla 驱动，惯性结束即 settle | 不另用 GSAP 写同一个 track transform，不绑定 wheel 转横向 |
| page transition | 保持真实链接/历史/修饰键；支持时用短 View Transition，建议 150–250ms，失败即时导航 | 外站门直接导航；不等长 overlay，不新建 Barba 路由 |
| reduced motion | 原生滚动；移除 parallax、trailing、Flip 飞行与磁吸；无需观看入场即可阅读；图像短淡入或即时显示 | cursor 可简化成即时小点，也可停用；Origin 使用无惯性原生水平 overflow，避免仅设置 duration 却仍保留 drag 惯性 |

章节阶段由滚动几何和活动区决定，不按所有 section 的统一 25% 四等分：内容高度不同，应每章定义 establish 区、settle 区和 leave 区。ScrollTrigger 如启用，只驱动表现，不控制 document 的可滚动性；pin/snap/normalizeScroll 首版关闭。

## Origin Timeline Architecture（建议，未实现）

DOM 结构：

```text
section#origin
  header（章节标题与为什么出现）
  timeline wrapper
    viewport（局部交互边界）
      ol.track（横向 flex）
        li.node
          button（年份/标题；data-cursor=OPEN）
          figure / avatar（可选）
    previous / next buttons（放在拖动视口外）
  detail region（单一活动节点详情，稳定保留高度）
  continue anchor（随时去 People）
```

七条已知线索按本轮叙事排列：2014 关注罗小黑 → 长期幕布记录 → 风华档案室 → Wiki 编纂 → 中文完整官网缺口 → 日版官网 → “那我自己做一个”。除 2014 外不填未经证实日期；这些是叙事顺序，具体真实时间排序仍需资料验证。

**Embla 适合做横向内核**，因为 DragHandler 已处理横/纵轴差异、非左键/表单目标、惯性和拖动后 click 抑制，ScrollAnimator settle 后会停止 Animations RAF；时间轴不能以 slide index 冒充年份/真实事件 id。

- 默认 `axis: 'x'`、`align: 'start'`、`dragFree: true`、`loop: false`、`containScroll: 'trimSnaps'`；节点宽度可变、间隔稀疏，不复制轮播 dots/autoplay UI。
- 默认不 snap，允许停在任意位置；点击节点才聚焦/展开。如果之后确实要柔和落点，v9 有 `dragFree: 'snap'`，但这不是 v8 API。
- **下一阶段默认选择 stable v8.6.0 vanilla 包并锁版本**，本地 v9 RC 用于研究。v8 是 `watchDrag/startIndex`、camelCase 部分事件；本地 v9 使用 `draggable/startSnap` 和 `pointerdown/pointerup` 等事件，不能混用。此轮没有安装 Embla。
- 活跃拖动 track 使用 `touch-action: pan-y pinch-zoom`；浏览器保留纵向 pan 与缩放。不要加 Wheel Gestures 插件，不给 document wheel 调 preventDefault，不加第二份自制 pointer capture/inertia。
- dragThreshold 只用于鼠标拖动后 click 抑制，不是轴向识别阈值；不能依赖它延迟开始 drag。可选按钮、文本选择和弹出详情区域不得被 viewport 横拖吞掉。
- desktop：轨道空白 cursor DRAG，节点 OPEN；hover 只预览，click/Enter 固定详情；左右控制和 Tab 可访问未显示节点。
- mobile：取消 cursor/magnetic；手指纵向划继续浏览整页，横向划局部轨道；tap 展开，不要求长按 hover。详情区要么稳定预留高度，要么移动端 drawer，需实测避免 CLS。
- 无 JS / reduced motion：原生水平 overflow，可触摸浏览，节点保留可直接读的摘要/详情入口。不要把 Embla destroy 后只留 hidden overflow。

上述 API/触控原则对照了 [Embla v9 options](https://www.embla-carousel.com/docs/api/options)、[v8 options](https://www.embla-carousel.com/docs/v8/api/options) 和 [Required Setup](https://www.embla-carousel.com/docs/guides/required-setup)。版本事实以 2026-10-09 查询为准，实施前再查锁定包。

## Cursor Architecture（建议，未实现）

codrops 011 使用一个 SVG，第一次 mousemove 才显现，随后位置/scale/opacity 用 lerp 收敛；012 用两个不同 amt 的圆制造 trailing；013 有双 SVG 与 filter/radius 动画，成本更高。011/012 中初始化 `ty.previous = ty.previous = ...` 是重复赋值写法，且 amt 按帧固定；只学习交互感觉，改用时间差阻尼，不能原样当公共库。

拟建的全局 cursor 只有一个控制器和一个命中无效的 `pointer-events: none` DOM 层；点、外圈与文字共享同一个有需求才运行的 RAF。位置仅来自 pointermove，样式只写 transform/opacity；label 变化时更新文字，不逐帧测量。

```text
disabled（coarse / 无 hover / mobile / touch / 未启用）
  ↕ capability + input mode
hidden（未首次移动 / pointer 离窗 / blur / 编辑输入）
  ↕ pointer enter/leave
default dot ↔ hover(action) ↔ pressed
                       ↘ dragging → hover/default
```

| 触发对象 | action / 行为 |
| --- | --- |
| 可看图像/案例 | VIEW，放大并提示可查看 |
| Creative Support 外链门 | ENTER，保持真实 a 点击/新标签语义 |
| 省省游戏入口 | PLAY，点击后才启动 |
| Origin 空白轨道 | DRAG；dragging 优先于 hover，放开后重算命中对象 |
| 人物、时间节点、展开对象 | OPEN；disabled 控件不提示可打开 |
| 最后 Contact | SAY HI；键盘/点击同样能展开，不依赖 cursor 文字 |
| 普通 button/a | 只有放大反馈；label 以显式 data-cursor 为准 |
| input/textarea/contenteditable、文本选区 | 回到系统 cursor，不打断编辑/选择 |

规则：事件委托 `closest('[data-cursor]')` 优先于通用 a/button；嵌套目标取最近有语义的对象；被 drag 锁定时忽略新 hover 标签，pointercancel/lost focus 退出 drag。Cursor 只观察状态，不 capture pointer、不 preventDefault、不拦截 click。MediaQueryList 和 pointerType 改变时重新门控；DOM 成功初始化后才隐藏系统 cursor，销毁/异常/禁用要恢复。游戏进入操控态时使用系统指针或原游戏反馈。

desktop fine + hover 才允许显示；移动端和 pointer coarse 禁用，混合设备触摸时隐藏。Reduced motion 取消尾随、缩放弹簧与滤镜，即时跟随或使用原生 cursor。AbortController 清理事件；pointer 离窗、document.hidden、pagehide 暂停/释放；收敛后取消 RAF，新 pointer/state 变化才唤醒。

## 性能审计（已读源码；运行指标 Needs verification）

下面的 RAF/trigger 计数按**一个入口实例**，不是 rg 出现次数，也不能把互不加载的 reference 相加成生产成本。

| 入口 | 时钟 / ScrollTrigger 数量 | 已核实风险和已有控制 |
| --- | --- | --- |
| 主站 Depth Gallery | Engine 1 个持续 RAF；主站 gallery.js 在 detent 等待期间另有 1 个临时 RAF；无 GSAP/Lenis/Embla | DPR 上限 2；资源半径 3、并发 2、纹理边长 1536、palette 样本 160。Engine 没有显式 document.hidden 停帧；原 Scroll 在全局 wheel/touchmove preventDefault |
| Depth 卸载 | Engine.dispose → Experience.dispose → TrailController.dispose → Trail / TrailHeadParticles | **实际发现上一轮判断不成立**：当前生产提交 `b91193b` 已有真实 `TrailController.dispose()`，释放 Trail 动态几何/材质、粒子池共享几何与各粒子材质；完整运行检查中 Gallery、Label、Background、Debug 和 renderer 均继续释放，无“不存在方法”异常。另补上 controller 所有的两个 Group 从主 Scene 脱离。 |
| Curve Gallery | 1 个应用 RAF；0 ScrollTrigger、0 GSAP | unified state + AbortController；hidden 时跳过更新/渲染，但仍先安排下一 RAF；低功耗 DPR 1/桌面 1.5、纹理档位。context lost/HMR/pagehide 有清理；sample 数据和完整手机表现未验收 |
| Codrops cursor 011 / 012 / 013 | 分别 1 / 2 / 2 个持续 CursorElement RAF；013 另用 GSAP 动画 filter | 全局 mousemove，逐链接 enter/leave，无 destroy/visibility/coarse/reduced 管理；bounds 初始化读取，render 没有逐帧 geometry read，但所有 loop 永久运行 |
| ScrollPanels | 每个 demo 1 个 Lenis RAF + GSAP 内部 ticker；index/index3/index4/index5 源码各有 2 个 scrollTrigger 配置，index2 有 3 个 | 独立页面不同时运行；没有显式取消 Lenis loop/context 清理；imagesloaded 等待全图。旧依赖配置不能照搬 |
| OneElementScroll | Lenis 接 GSAP ticker，没有另建 Lenis RAF；Flip 主轨 1 trigger，再有按 title span/图片数量生成的 triggers | flipCtx.revert 仅管理 Flip 主轨；resize 会重测 Flip 状态。动画 filter、scale/长位移与媒体数量相关；实际 trigger 总数未在浏览器实例化计数 |
| Infinite Gallery | GSAP Observer/tween/Flip；未见自有持续 RAF | Observer 对 window wheel/touch preventDefault；applyParallax 每个 slide 读 rect 后写 gsap.set，存在跨对象读写交错引发布局/样式同步的风险；resize 匿名 listener 缺销毁接口 |
| Pixel / Scroll Revealed | 1 个应用 render 回调挂 GSAP ticker；另有 ScrollSmoother/每图与文字 triggers | Media.destroy 释放 geometry/material/listener/trigger，但未见 texture.dispose；全局 ticker/resize 解绑需补核；loadImages 统计所有 img，只处理 load 而没有 error 完成分支 |
| Motion cursor/magnetic/carousel | Motion 内部调度，不能按组件数简单叫多个 RAF | cursor parent enter/leave 清理用了新匿名函数，解绑无效；隐藏 body cursor 未恢复。Magnetic 每实例全局 mousemove + rect 读取；Carousel `dragMomentum:false`，不适合所需自由惯性 |
| dotmatter React | 每挂载实例 1 RAF；独立 WebGL2 renderer | 有 IntersectionObserver、visibility、ResizeObserver、reduced/img fallback 与 destroy；pointermove 每次 getBoundingClientRect，需缓存/仅局部使用。多实例仍会倍增 GPU/纹理成本 |
| 省省 Web / V3 影片 | 各 1 自有 RAF；0 ScrollTrigger | 游戏有后台暂停/音频停止、影片 visibility 暂停，但 tick/frame 仍递归调 RAF；嵌入长页前需要离屏/退出停止回路接口 |

### 图片与移动端

- Depth 从 manifest 渐进请求，取消远离图片；GalleryResources.dispose 终止 Worker 并释放 texture，TrailController.dispose 释放 Trail/粒子几何与材质并移除其 Scene Group，各 owner 释放自己的资源。
- 当前 palette 结果使用 Map 随访问累积，纹理池受窗口限制；对 384 张图有界，但更大规模的 palette cache eviction 尚未证明。
- Connections 现有 neighbors 图片已有 `loading=lazy`；未来图像需明确 width/height 或 aspect-ratio、`decoding=async`、按 viewport lazy，不用 imagesloaded 阻塞整页。跨域图片取色的 CORS 与降级仍需实际资源验证。
- 首页构建 plugin 当前带 CDN 默认来源；384 张本地素材与 dist 副本计数不等于公网 CDN 可用。原图、CDN 与部署状态不能凭旧报告推断。
- 移动端默认 DOM/CSS、无 cursor/磁吸/常驻 WebGL；静态 halftone/dot 用装饰纹理，blur 只做小面积短变化；游戏仅交互区域消费输入，纵向页面仍可滚。

### 下一阶段的性能约束与验收

1. 应用共享动效驱动只有一份；GSAP 内部 ticker 与 Embla 自己的按需 RAF 各自管理，不侵入依赖内核来追求“全页物理上只有一条 RAF”。不再叠加 Lenis 自驱动 + gsap ticker 双重 raf。
2. 一个章节控制点覆盖章节内对象，首版最多九个章节主控制点，跨章节对象必要时额外一个；不按每头像/每字创建 ScrollTrigger。静止阅读、hidden 和离屏特殊媒体应停帧。
3. scroll/pointer 事件先存状态，批量读 geometry 再写 transform；resize/字体加载/展开使 cache 失效，避免在每个 mousemove 为所有人物读 rect。
4. 引入游戏/renderer 必须有 mount/start/pause/resume/destroy 与 context-loss fallback；卸载清 listener/ticker/Worker/texture/material/geometry/audio。
5. 后续实测桌面、iOS Safari、Android：纵向 scroll 与横拖/点击竞争、键盘/缩放、reduced、切后台/回前台、回退缓存、反复进出页面的 listener/RAF/纹理增长，以及资源错误。60fps 是目标而非本轮结果。

## 实施顺序（下一阶段建议；本轮在 README 更新后停止）

| Phase | 工作与退出条件 |
| --- | --- |
| 0 — Repository Cleanup & Map | 本轮地图已完成。未来只对明确授权条目清理；先处理 Depth dispose 缺陷的独立修复与回归；核查许可、现有编辑/数据、史料/素材与来源，不一次性合并 reference |
| 1 — Cursor | 在主站共享入口做原生 cursor；桌面精细 pointer、触摸/reduced/编辑/拖动/退出生命周期验收；参考库保持只读 |
| 2 — Connections Shell | 九章纵向 DOM 与导航/锚点，复用 links/thanks 管理流；无动效也可完整阅读，定义每章 establish/settle 区 |
| 3 — Origin | 七条叙事节点、稳定详情区、Embla 锁版、无 snap 横拖；验证原生竖滚、触控、键盘和 no-JS/reduced fallback |
| 4 — People / Doors | 真实人物/OC、单对象 magnetic、click 展开、友站视觉门与外链；不嵌外站 iframe |
| 5 — Credits Sections | Technical/Open Source/AI/References 的真实数据、贡献角色、许可和 learned-from；计划开源与已发布明确区分 |
| 6 — Special Thanks | 省省独立游戏/Persona 空间，PLAY 才加载、离屏暂停/音频、可退出；无需改原游戏核心玩法 |
| 7 — Mobile / Performance | 始终保留移动阅读路；检查 RAF/trigger/listener/布局、图片、DPR/资源寿命与实机浏览，不只凭单元测试 |
| 8 — Cleanup | 替换实现验收后移除确实过时的入口/兼容层；清掉本轮实现产生的临时输出；仍需确认引用和 Git 差异，不积累平行实现 |

## README 修改结果与待验证事项

根目录原来没有 README；本轮新增本文件，没有改 REFERENCE_BASELINE 和各子项目 README。新增 Project Map、Active Projects、References、Reusable Systems、Experimental / Archive、Cleanup Candidates、复用清单、Interaction Architecture、Motion、Origin、Cursor、性能审计、实施顺序和证据边界。

保留的 **Needs verification**：公网/构建产物新旧一致性；sixsys 生产挂载；三个 Gallery reference 的许可缺口；InternalBeyond 具体使用许可；Persona 身份/素材与新贡献记录；除 2014 外的精确事件日期；gdre 下载缓存重现；SystemIcon 时间戳版的独有能力；Garden dist prompt 的生成来源；影片空目录用途；未解码素材的全量孤儿/去重；实机 FPS/GPU/listener/trigger 数量；旧 HANDOFF 路径和其它文档漂移。

核实依据：上述项目 README/package/config/入口与生命周期源文件；父仓库和 13 个内层 clone 的 Git status/remote/HEAD；目标文件 SHA-256、空目录/生成目录元数据；主站 import/build/API 路径；本地 8080 只读响应。未来 GSAP 生命周期/进度建议另对照 [ScrollTrigger 官方文档](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)。本轮没有重新跑会生成文件的测试/构建，历史验收记录只作为资料，不冒充当前通过结果。
