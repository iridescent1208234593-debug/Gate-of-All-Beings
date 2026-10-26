# 众生之门玩家初始化

正式 `EntryGate` 完成后挂载 `PlayerOnboarding`，不包含另一份开场动画。

来源为已验收的 `E:\External Projects\original-ui-version\src` 名称、种族树、头像列表、种族确认和双头像框流程。生产代码和所需素材均在本目录，不依赖外部目录的运行时路径。图像来自用户提供的《罗小黑战记》参考画面，字体保留原型现有来源；只用于当前非商业同人项目，不视为可重新许可的独立开源素材。

## 接口与状态

- `initialIdentity`：正式 `GateIdentity`，仅在挂载时初始化编辑草稿。
- `onComplete(identity, avatarBlob)`：交给现有玩家状态服务保存。异步保存失败留在当前头像页，可重试。
- `onCancel()`：由父页面返回已有门景；没有重复加载门景资源。
- `player-profile.js`：每次挂载独立的内存草稿，不读写账户、OC 或 `sessionStorage`。账户/访客持久化由正式状态服务负责。
- `species_name` 存储用户确认的真实文字；`r01`–`r23` 仅作为现有头像素材/框 ID，不作为种族名称。
- 用户上传图片中心裁切为 512×512 Blob，图片与框继续分离。预览使用 object URL，卸载释放；账户 API 通过父页面上传 Blob，不将 Base64 塞入 JSON。
- `player-avatar.js` 的 `createPlayerAvatar` / `resolvePlayerAvatar` 复用设置预览与玩家 HUD 的图片、裁切窗口和框叠层。

## 维护与清理

`screens.html` 保留已验收结构，`onboarding.css` 保留配色、图标与动画。样式限定于 `.gate-onboarding`，设计像素用容器 `--onboarding-unit`；不写全局根字号。种族树继续使用同一进度值驱动 SVG 路径、节点和图标入场。卸载中止全部监听、取消 RAF/过渡定时器、断开 ResizeObserver、关闭种族 dialog 并释放 object URL，支持 React StrictMode 重挂载。

本目录刻意不迁入原型的 `main.js`、`opening-animation.js`、门景资源和世界场景。独立场景由正式模式目录单独接入；正式开场、账户和游戏存档继续由原有 owner 管理。
