# 众生之门入场 UI 集成记录

Cards 正式入口仍是 `src/gate/GameShell.tsx` 与 `src/gate/EntryGate.tsx`，由项目现有 `/app/modules/cards/` 路由加载。外部 `<工作区>\labs\original-ui-version` 是独立交互原型，不作为生产运行时依赖。

原型的全屏门景、单次播放、进度定位、配色切换和显式进入已经接到正式开场。场景使用 Cards 内的 `src/embed/gateEmbed.ts`，该文件与原型门景同源于 `sceneModel.ts`，不复制原型打包文件或引入外部绝对路径。`EntryGate.tsx` 将它作为单一动画时间轴运行；隐藏页面会暂停，离开时销毁 renderer，WebGL 不可用时使用现有 2D 场景。原型里的用户名创建、种族树、示例种族列表、头像流程和 MT 剧情不进入正式入口：它们与当前账户、存档和游戏流程没有数据/路由契约，照搬会产生第二套登录和开场业务。

`shared-ui/lxh-ui.css` 提供既有视觉 tokens；`intro-controls.css` 与 `lxh-intro.js` 统一 Cards 和 Huiguan 的进度条呈现、时间格式和轻量 Skip 交互。两个页面分别保留自己的场景主题和目的地。Skip 与正常进入共用同一淡出和挂载路径。

Cards 当前 `/api/sso-user` 明确将 `is_admin` 返回为 `false`，Cards 客户端没有可用于管理员导航的授权事实，也没有独立的管理页面权限契约。因此本次不在普通用户导航中创建伪管理员入口，也不把受限页面暴露给用户；管理员导航接入须落在提供可信管理员身份的现有管理端，不能由前端路由自行判断。
