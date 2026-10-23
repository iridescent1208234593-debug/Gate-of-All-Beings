# 旧版入世历练归档（2026-10-23）

用户决定：旧版入世历练已被众生牌录取代，归档并下线。

## 恢复方式

下线前的最后一个提交已打标签（本地标签，需要 push 标签才会出现在远端）：

```
git show archive/legacy-adventure-20261023:server/app/src/cards/src/game/GameApp.tsx
git checkout archive/legacy-adventure-20261023 -- server/app/src/cards/src/game/transport.ts
```

标签指向 `e263562`。

## 下线了什么

| 内容 | 位置 |
| --- | --- |
| `#adventure`：选同行者、地图、战斗、奖励、休憩、行商、结局，及 `start` / `send` / `newJourney` 和「牌组」「替换旅途」两个弹窗 | `game/GameApp.tsx` |
| `#timeline` 旅途手札（只服务旧历练的节点事件；众生牌录的出行不读这份时间线） | `game/GameApp.tsx` 的 `TimelineEditor` |
| 门庭里「旧版 · 即将下线」入口和二次确认弹窗 | `game/ModeHall.tsx`、`mode-hall.css` |
| 全员陨落 5 小时复活计时（`reviveIfDue` 的调用） | `game/GameApp.tsx` |
| `LocalTransport` / `IGameTransport` | `game/transport.ts`（已删除） |
| 两条功能说明和门庭说明里的旧历练文字 | `game/FeatureGuide.tsx`、`game/MODES.md` |

旧链接 `#adventure`、`#timeline` 现在回到门庭。

## 有意保留

- **存档数据不动**：`SaveData.run`、`meta.timeline`、`runTimeline` 仍在存档结构里并通过校验，玩家已有的存档不会因此失效；只是没有入口再读写它们。
- **核心引擎不动**：`core/engine.ts`、`core/meta.ts`（`createRun`、`claimRun`、`reviveIfDue` 等）仍有测试覆盖，众生牌录的出行和重生之门共用同一个引擎。`reviveIfDue` 现在没有调用方，等确认不再需要后再删。
- **会馆日常（`#hall`）保留**：它还是可用的功能，但与众生牌录的「照料」重复，并且用另一套日数（`meta.day`），后续需要用户决定是否合并或下线。
- **门庭的「这次更新」赞 / 踩**保留，只存在本地浏览器，不发送到任何地方。
- **魂灵、修行残片**同日从界面撤下，但仍在共享账本中（旧重生之门页面还会写入，账本校验要求这两项存在，已有余额不能丢）。
