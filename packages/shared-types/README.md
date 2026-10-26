# 三系统 JSON 交换

`world.js` 定义六系：御灵、生灵、造物、空间、心灵、锁御；五行：金木水火土。两者为独立轴。

`exchange.js` 为生态、主入口、经营共同调用的边界校验；`models.d.ts` 与 `exchange.d.ts` 提供 TypeScript 契约。

## 收获包

- `kind: eco-harvest`，`schemaVersion: 2`；继续接受 v1 老收获。
- `worldId` 与递增 `sequence` 标识世界和批次。每个接收存档拒绝重复或早于已接收的批次；离线文件应按批次顺序导入。
- `resources.food/herb/spirit` 为 0–500 的整数，至少一项非零。
- `species` 记录存活生产者、食草者、捕食者，最多三类。
- `individuals` 每批最多 12 个（各类最多 4 个由生态选出），引用真实存活植株或有机体。
- 个体编号为 `eco-card-${worldId}-${sourceId}`，`sourceId` 为 `plant-数字` 或 `organism-数字`。同一个体保持同一张卡。
- 个体的五行取所在灵质空间，体型、速度、活力规范为 1–10；不从输入 JSON 接受伤害等可执行效果。卡牌数值由 zszm 本地规则推导，是游戏规则而非原作事实。
- 可带 `space` 快照供记录；接收方不会用它覆盖自己的世界状态。

## 保存与确认

生态先保存收获和待发送队列，再向同源主入口发送。主入口把卡牌资料及待入库队列一起保存到 IndexedDB，保存成功后才确认生态已接收。

经营在 `/management/index.html` 中打开后，由主入口逐批送入。经营校验、检查容量、写入本地存档后才确认入库；确认遗失时按批次去重。库存不足则拒绝整批，保留主入口的待入库记录。

所有消息都检查 `origin` 和具体 iframe 的 `source`。独立页面也保留 JSON 下载/导入。v2 资源只送经营库存；v1 保留旧版日常会馆资源行为，同时可交付经营。每份手札最多记录 512 个个体，待发送/入库各最多 100 批。

这是单机、同一浏览器来源内的协议，不提供跨域共享存档、统一云账户账本或防篡改签名。旧站不同域名的 localStorage 不会自动搬进主站。

验证：`npm run verify`；跨系统测试在 `../../apps/cards/src/game/core/exchangeQueue.test.ts`。
