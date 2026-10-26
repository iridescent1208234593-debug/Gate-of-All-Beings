# 交接：众生之门开场配乐选择器

更新时间：2026-10-23（Asia/Singapore）

## 已实现

- 正式入口 `server/app/src/cards/src/gate/EntryGate.tsx` 在声音按钮旁提供自动、配乐 1、配乐 2、静音菜单；Escape 先关闭菜单，方向键可切换选项。
- `OpeningMusic.tsx` 管理音乐选择、淡化切换、静音记忆和跨开场/门场景/门庭播放。默认选择「自动」，对应延长版配乐。`?bgm=split` 仅改变自动模式用于开发对比。
- MP3 文件迁自 `E:\External Projects\众生之门-门原画-程三一\原型\audio\`；迁入副本与原型两首 MP3 的 SHA-256 均一致。WAV 文件与原型目录没有修改。
- `DoorScene.tsx` 已移植推门、灵逸散和闪白；门场景开始时继续播放门前段落，推门后 2.1 秒、闪白开始时切换进门后段落。调整 `DOOR_MUSIC_SWITCH_MS` 可改切换点。

## 验证与边界

- `npm run check:game` 通过。
- `npm run build` 通过，构建产物包含两份 MP3；Vite 报告部分 JS chunk 超过 500 kB，Card 的 gateEmbed chunk 585 kB。另有已有其他模块的动态/静态导入提示。
- 本地可见浏览器确认菜单打开、选项单行、Escape 关闭并还焦、选择配乐、静音后恢复为上次曲目，以及刷新后曲目/静音记忆；约 391px 宽视口下菜单也能完整显示。
- 真实账户跨设备行为、完整生产代理链路、真机低端设备帧率和配乐切换时机的人耳感受，需单独确认；本地浏览器测试记录见 `docs/zszm-flow-integration.md` 对应日期的验收段。
- 本次只改本地工作源码与说明文件，没有提交、推送、构建候选或发布。
- 根工作区有其他已存在的改动；仅处理本交接所列相关路径，不要清理或暂存整个工作区。

## 主要文件

- `server/app/src/cards/src/gate/EntryGate.tsx`
- `server/app/src/cards/src/gate/OpeningMusic.tsx`
- `server/app/src/cards/src/gate/gate.css`
- `server/app/src/cards/src/gate/GameShell.tsx`
- `server/app/src/cards/src/gate/audio/`
- `server/app/src/cards/README.md`
- `docs/zszm-flow-integration.md`
