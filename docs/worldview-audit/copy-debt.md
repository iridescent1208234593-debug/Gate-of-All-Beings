# 文案债务

文案债务指“现在没错，但结构会让文案继续出错”的问题：同一句话多处维护、数据副本分叉、测试锁死旧文案等。编号对应 [audit-report.md](audit-report.md)。

## 单一文案源问题

| ID | 内容 | 现状 | 建议的唯一来源 | 严重度 |
|---|---|---|---|---|
| T01 | 能力系定义 | 至少 6 份：`packages/shared-types/world.js`、`packages/shared-data/worldview.json`、`apps/slay/public/content/worldview-data.js` + `ability-branches.js`、`apps/huiguan/index.html` 的 ABILITY_DETAIL、`apps/juling/engine.js`、`apps/management/src/content/loreCharacters.js`。数量（六/七/八）和持有者互相矛盾。 | `shared-types/world.js`（结构）+ `worldview.json`（描述） | P1 |
| T02 | slay 世界观副本 | `apps/slay/public/content/worldview-data.js` 是手工维护的第二份世界观，写“六大系”，而 UI 写“八大系”。 | 从 `packages/shared-data` 生成 | P2 |
| T05 | 重生之门双实现 | `apps/slay`（原版）和 `apps/cards` journal（移植版）各有一套文案。 | 主创决定以哪套为准 | P3 |
| T10 | 玩法描述 | `apps/shell/portal.json` 是导航唯一数据源，`apps/cards/src/game/ModeHall.tsx` 又写了一份标题和描述。本 PR 两处都改了，但以后仍要手动同步。 | `portal.json` | P3 |
| — | 流石会馆事件 | “全员遇难”在 slay guild-branches、slay worldview-data、management expeditionTargets、cards rebirth.json 四处重复。 | `worldview.json` | P2 |

## 过时文案

| ID | 内容 | 位置 | 严重度 |
|---|---|---|---|
| T03 | 英文词典仍有入世历练、旅途手札，没有众生牌录；门庭=Home、灵境会馆=Spirit Hall、西木会馆=Ximu Hall 命名规则不统一 | `apps/www/assets/site-language.js` | P3 |
| T04 | e2e 仍断言已下线的“旅途手札”“入世历练” | `apps/cards/scripts/verify-game.mjs` | P3 |
| — | 更新日志里的“入世历练可以重玩” | `apps/www/connections.html` | P4（历史记录，可保留） |

## 同义词混用

| ID | 混用 | 建议 |
|---|---|---|
| T06 | 灵质修行（slay）/ 灵质回路（cards） | 名字保留，但在入口各加一句说明区分 |
| T07 | 灵力 / 能量；灵石 / 金币；陨落 / 阵亡 / 倒下 / 散灵；守门者 / 守门 Boss | 按 [glossary.md](glossary.md) 统一 |

## 数据清洗

| ID | 内容 | 建议 |
|---|---|---|
| T09 | `worldview.json` 有维基模板残留（本 PR 已修的 F19 就是从这里扩散的） | 在 `packages/shared-data/export_worldview.py` 导出时清洗 |
| Y09 | `worldview.json` 有 290 条推测性描述 | 加 `confidence` 字段，UI 显示“推测” |
| T08 | `apps/management/README.md` 顶部有 AIGC 元数据块 | 删除或改成注释 |
