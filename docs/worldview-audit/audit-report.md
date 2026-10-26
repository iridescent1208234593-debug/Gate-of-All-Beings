# 审校报告：世界观与文案兼容性

> 审校日期：2026-10-26 · 基线：master `8af54a5` · 分支：`claude/project-thread-rziusi`

本报告只做定位和建议。原作设定不确定的地方标【需要原作资料确认】，涉及核心原创设定的地方标【需要项目主创确认】，方案见 [decisions.md](decisions.md)。

## 统计

共 **66** 条。

| 严重度 | P0 | P1 | P2 | P3 | P4 |
|---|---|---|---|---|---|
| 数量 | 1 | 12 | 21 | 29 | 3 |

| 类型 | A 明确冲突 | B 原创扩展 | C 语言气质 | D 机制包装 | E 认知风险 |
|---|---|---|---|---|---|
| 数量 | 9 | 5 | 26 | 2 | 24 |

| 处理状态 | 数量 |
|---|---|
| 已修复 | 22 |
| 需主创确认 | 18 |
| 需原作资料确认 | 10 |
| 建议（未改） | 6 |
| 文案债务 | 10 |

严重度含义：P0 原作明确误用且高曝光；P1 高曝光的认知风险或系统性偏离；P2 局部偏离或会扩散的问题；P3 措辞、统一性；P4 标点、元数据。

## 已修复（本 PR）（22 条）

| ID | 文件 | 模块 | 原文 | 问题 | 类型 | 严重度 | 原因 | 推荐方向 | 推荐文案 |
|---|---|---|---|---|---|---|---|---|---|
| F01 | `apps/slay/public/content/endings.js` | 重生之门 · 结局 | 无限曾于六十三年成仙，一剑破城；你以凡人之躯…… | 把两位角色的设定拼在一起：“六十三岁成仙”是望舒的经历，“使城池不战而降”是无限的传说，且原作中无限并未“成仙”。 | A | P0 | 结局页是通关必看文字，把原作人物写错，属于直接的原作误用。 | 删去错误的人物比附，保留结局本身的情绪。 | 你以凡人之躯，一步步把修行走到了尽头。 |
| F02 | `apps/slay/public/content/boss-intros.js` | 重生之门 · Boss 登场 | 最强执行者，一人一剑破罗城的那一位。 | “一人一剑破罗城”无原作依据，与 F01 同源的误记。 | A | P1 | Boss 登场台词高曝光，玩家会当成原作事迹。 | 只保留可确认的身份。 | 妖灵会馆的最强执行者。 |
| F03 | `apps/slay/public/content/guild-branches.js` | 重生之门 · 出身会馆 | 灵溪分馆 representative 含「山新」 | 山新是罗小白的人类同学，不是会馆成员。 | A | P1 | 把人类配角写成会馆代表，属于明确的人物关系错误。 | 从代表名单中移除。 | （删除该项） |
| F04 | `apps/slay/public/{index,stats,collection}.html, ui/splash-screen.js, ui/menu.js` | 重生之门 · 标题 | 罗小黑战记·重生之门 | 标题写法像官方出品的番外/游戏。 | E | P1 | “罗小黑战记·X”是官方作品的命名格式，易被误认作官方作品。【可能被误认作原作官方设定】 | 主标题放项目名，罗小黑战记作为“同人”后缀。 | 重生之门 · 罗小黑战记同人 |
| F05 | `apps/cards/src/game/WorldGuide.tsx` | 万灵志 | 同人角色与原作角色用同一 tag（仅显示种族） | 108 个同人角色在万灵志里和原作角色无区分。 | E | P1 | 玩家会把同人角色当成原作角色。【可能被误认作原作官方设定】 | 同人角色加“同人 ·”前缀。 | 同人 · 妖精 |
| F06 | `apps/huiguan/index.html` | 西木会馆 · 人设登记 | 法宝 placeholder：天明珠（打开灵质空间-成仙） | 占位示例把未确认的法宝功能写成定论。 | E | P2 | 占位文字是玩家填写时的“标准答案”，会被大量复制。【需要原作资料确认】 | 占位只保留不涉及原作设定的示例。 | （删去天明珠示例） |
| F07 | `apps/huiguan/index.html` | 西木会馆 · 人设登记 | 鹿野，妖灵会馆·感知组组长，无限的关门弟子，感知系能力，妖精 | 示例使用了未确认的“关门弟子”和能力归类。 | E | P3 | 同上，占位会被复制。 | 改用较稳妥的说法。 | 鹿野，妖灵会馆·感知组组长，无限的弟子，妖精 |
| F08 | `apps/huiguan/index.html` | 西木会馆 · meta/og 描述 | 你所登记的人设，将汇入罗小黑战记「众生之门」世界观。 | 读起来像《罗小黑战记》官方有一个「众生之门」世界观，分享卡片上看不出这是同人站。 | E | P3 | 外链预览是站外玩家第一眼看到的文字。 | 写明“同人世界”。 | 你所登记的人设，将汇入「众生之门」——一个《罗小黑战记》同人世界。 |
| F09 | `apps/huiguan/{index,account,gallery}.html, homepage-content.js` | 西木会馆 · 编辑权限说明 | 官方设定 | “官方设定”容易被理解为站方拥有官方设定。 | E | P3 | 区分“原作官方角色资料”和“本站设定”。 | 改为“官方角色资料”。 | 站内的官方角色资料 |
| F10 | `apps/slay/public/ui/lingzhi-xiuxing.js` | 重生之门 · 灵质修行 | 灵质空间是一方由主人心念开辟的小天地…… | 与原作“每个生命固有的空间”不符，写成了修真式的“开辟洞天”。 | A | P2 | 核心术语定义被改写。 | 回到原作含义，保留规矩这一层游戏性。 | 灵质空间是每个生命固有的空间；进了别人的灵质空间，就要守它主人的规矩。 |
| F11 | `apps/slay/public/content/achievements.js` | 重生之门 · 成就名 | 北域之主陨落 / 明王伏诛 / 斩妖如麻 | 把原作角色写成被诛杀的对象，“斩妖”与会馆“人妖共处”的立场相反。 | C | P2 | 原作基调不是斩妖除魔。只改显示名，id 不变，存档不受影响。 | 中性的“试炼/之战”。 | 北域之战 / 明王之试 / 过关斩将 |
| F12 | `apps/slay/public/ui/splash-screen.js` | 重生之门 · 开场 | 一场属于你和浏览器的爬塔冒险 | “浏览器”“爬塔”是开发者/玩家圈术语，跳出世界观。 | C | P3 | 开场副标题。 | 用世界观内的说法。 | 众生之门里的一场卡牌冒险 |
| F13 | `apps/slay/public/ui/splash-screen.js, ui/player.js` | 重生之门 · 教程/状态 | 怪物（×3）/ 怪物五行· | “怪物”与原作“妖精”的平等立场冲突。 | C | P3 | 教程用词会定调。 | 统一为“敌人/敌方”。 | 敌人 / 敌方五行· |
| F14 | `apps/cards/src/journal/JournalApp.tsx, world/rules.ts, game/UnifiedJourney.tsx` | 众生牌录 · 同行者状态 | 已陨落 / 陨落 / 这位同行者已经陨落 | “陨落”是仙侠腔，且意味着死亡，但机制上只是暂时不能出行。 | C | P3 | 文字比机制更重，玩家会以为角色死了。 | 改成与机制一致的“倒下/静养”。 | 静养中 / 倒下 / 这位同行者倒下了，正在静养，暂时不能同行。 |
| F15 | `apps/cards/src/gate/EntryGate.tsx` | 门场景 · 语音问候 | 众生门 | 项目名错字（TTS 会读出来）。 | C | P3 | 名称不统一。 | 用正式名。 | 你好，欢迎来到众生之门 |
| F16 | `apps/cards/src/game/ModeHall.tsx` | 门庭 · 玩法卡 | title: 门庭 | 玩法卡名与整个 hub「门庭」重名，且旧名已改为众生牌录。 | C | P2 | 同一名字指两样东西。 | 用现行名。 | 众生牌录（卡牌 · 出行与重生之门） |
| F17 | `apps/shell/portal.json` | 导航 | 入世历练 · 卡牌冒险 | 入世历练已于 2026-10-23 下线。 | C | P2 | 导航是唯一数据源，过时名会扩散。 | 用现行名。 | 众生牌录 · 出行 / 重生之门 / 灵质回路 |
| F18 | `apps/cards/src/game/core/meta.ts` | 存档 · 错误提示 | 当前手札最多收录… | “手札”是已弃用的旧名。 | C | P3 | 错误提示里的名词要与存档概念一致。 | 改为“存档”。 | 当前存档最多收录 512 个生态个体，请先导出备份。 |
| F19 | `apps/management/src/content/expeditionTargets.js` | 灵境会馆 · 远行目标 | 龙游会馆/天朝/白文村 的维基模板残留文字 | 直接露出了维基模板语法/占位。 | C | P2 | 玩家可见的乱码式文字。 | 改成一句话说明。 | 妖灵会馆在龙游市的分馆，馆长潘靖 / 古代国号/朝代名 / 蓝溪镇相关村落 |
| F20 | `apps/world-map/src/nodes.ts` | 世界地图 · 西木会馆 | 馆长还没有填写介绍哦。 | 原创会馆与原作会馆并列在地图上，没有同人标识。 | E | P2 | 【可能被误认作原作官方设定】 | 加一句身份说明。 | 本站的原创会馆（同人设定），不出自《罗小黑战记》原作。 |
| F21 | `apps/world-map/src/nodes.ts` | 世界地图 · 灵溪 | 分馆. | 半角句号。 | C | P4 | 标点不统一。 | 改全角。 | 分馆。 |
| F22 | `apps/slay/public/ui/splash-screen.js` | 重生之门 · 出身选择 | 出身分馆 · 妖灵会馆七大分馆 | 列表中第一项是苍南总馆，“七大分馆”把总馆算成了分馆，且“七大”有门派感。 | A | P3 | 与原作“苍南是总馆”的结构不符。 | 如实描述。 | 出身会馆 · 苍南总馆与六处分馆 |

## 需要项目主创确认（18 条）

| ID | 文件 | 模块 | 原文 | 问题 | 类型 | 严重度 | 原因 | 推荐方向 | 推荐文案 |
|---|---|---|---|---|---|---|---|---|---|
| D01 | `全站（项目名）` | 整体定位 | 众生之门 | 《众生之门》在原作漫画中是一款 VR 游戏（山新在漫展拿到游戏机，小黑、小白、阿根进入游戏）。项目名与原作内游戏同名。 | E | P1 | 玩家可能以为本站就是原作那款游戏的官方还原。【可能被误认作原作官方设定】【需要项目主创确认】 | 见 decisions.md D01。 | （待定） |
| D02 | `apps/slay/public/content/cultivation.js, worldview-events.js, game/dungeon.js 等` | 重生之门 · 修仙体系 | 炼气→渡劫、修为、道心、福缘、宗门风云、金丹凝聚，正魔相争 | 整套修仙境界与原作的灵/灵质力体系不同。原作没有境界阶梯。 | C | P1 | 是重生之门的核心系统，改名会牵动机制与存档。【需要项目主创确认】 | 见 decisions.md D02。 | （待定） |
| D03 | `apps/slay/public/xiuxian-card/（80 个文件）, ui/lingzhi-xiuxing.js` | 重生之门 · 一念仙途 | 一念仙途 · 完整修仙冒险 | 嵌入的完整修仙卡牌游戏，约 3.2 万字，没有罗小黑内容。 | C | P1 | 与众生之门世界观完全无关的独立作品，嵌在“灵质修行”页里。【需要项目主创确认】 | 见 decisions.md D03。 | （待定） |
| D04 | `apps/slay/public/ui/win-screen.js, lose-screen.js, game/dungeon.js, content/achievements.js, content/soul-legacy.js; apps/cards journal hero quote` | 重生之门 · 轮回叙事 | 轮回的真相如潮水涌来——魂灵从未真正消散…… / 超脱轮回，凌驾生死 / 魂灵入门，前尘尽忘 | 把“轮回/魂灵不灭”写成世界真相。原作有魂灵概念，但并未给出“轮回”定论。 | E | P1 | 以“真相”口吻宣布世界观结论，最容易被误认作原作设定。【可能被误认作原作官方设定】【需要项目主创确认】 | 见 decisions.md D04。 | （待定） |
| D05 | `packages/shared-data/worldview.json` | 共享数据 · 角色境界 | balance.realm_name：练气…渡劫（罗小黑=化神） | 439 个角色都带修仙境界，目前 UI 未显示。 | E | P2 | 一旦被任何模块显示，就等于给原作角色定了修仙等级。【需要项目主创确认】 | 见 decisions.md D05。 | （待定） |
| D06 | `apps/slay/public/game/dungeon.js` | 重生之门 · 层级地名 | '罗家岙', // 1 炼气 | 原作地点被映射到修仙境界。 | E | P2 | 地点被赋予“等级”。【需要项目主创确认】 | 随 D02 一起决定。 | （待定） |
| D07 | `apps/juling/engine.js, public/index.html` | 聚灵 · 阶段 | 精灵→妖精→得道→仙人→神；封神！凌驾天地，超脱轮回；☯ | “成仙/封神”作为线性升级终点，网文等级感强。原作虽有仙、神，但不是妖精的成长阶梯。 | C | P2 | 【需要项目主创确认】 | 见 decisions.md D07。 | （待定） |
| D08 | `apps/juling/engine.js` | 聚灵 · NPC | 原作角色可被克伐/豪夺/掠夺 | 原作角色被写成可掠夺的资源型 NPC。 | E | P2 | 角色塑造与原作相反。【需要项目主创确认】 | 见 decisions.md D08。 | （待定） |
| D09 | `apps/management/src/content/loreCharacters.js` | 灵境会馆 · 随机小妖 | 随机小妖名直接取罗小黑、无限、老君…… | 官方主角会作为随机路人出现；同人角色也混在同一池子。 | E | P1 | 既增加官方角色“戏份”，又混淆原作/同人。【需要项目主创确认】 | 见 decisions.md D09。 | （待定） |
| D10 | `apps/slay/public/content/dungeon-encounters.js, cards.js, skill-effects.js, game/actions.js` | 重生之门 · 无限 Boss | 剑域 / 剑域·斩 / 吞噬·剑域 | “剑域”是原创技能，写法像原作招式。 | B | P2 | 【可能被误认作原作官方设定】【需要项目主创确认】 | 见 decisions.md D10。 | （待定） |
| D11 | `apps/oc/index.html` | OC 页 · 视频标题 | 罗小黑战记 · 灵质空间 / 第29集 — 虹之间 | 格式与原作剧集一致，像官方某一集。 | E | P1 | 【可能被误认作原作官方设定】【需要项目主创确认】 | 见 decisions.md D11。 | （待定） |
| D12 | `apps/slay, apps/cards, apps/management（多处）` | 跨模块 · 灵质 | 灵质 作为可消耗资源/货币 | 原作中“灵质空间/灵质力”是生命本身的属性，不是可以花掉的钱。 | E | P2 | 核心术语语义偏移。【需要项目主创确认】 | 见 decisions.md D12。 | （待定） |
| D13 | `apps/cards/src/game/core/content.ts` | 众生牌录 · 玩家身份 | SEEKER = { name: '修行者', relic: '魂灵印记', relicText: '轮回中的修行者……' } | 玩家身份写成修行者+轮回。 | C | P3 | 与 D04 同源。【需要项目主创确认】 | 见 decisions.md D13。 | （待定） |
| D14 | `apps/cards/src/game/core/content.ts, packages/shared-data/cards.json` | 灵卡 · 无限 | 万剑归一 | 仙侠常用招式名。 | C | P3 | 依附于“无限用剑”的判断。【需要项目主创确认】 | 随 D10 一起决定。 | （待定） |
| D15 | `apps/slay/public/ui/splash-screen.js, ui/app.js, content/ability-branches.js` | 重生之门 · 能力系 | 灵质天赋 · 八大能力系 | UI 说“八大”，项目其他地方是六系/七系。 | B | P1 | 数量本身是原作设定问题。【需要原作资料确认】【需要项目主创确认】 | 见 decisions.md D15。 | （待定） |
| D16 | `apps/slay/public/content/ability-branches.js, element-mastery.js` | 重生之门 · 系别与五行 | 系别→五行映射 | 原创映射，写法像原作规则。 | B | P2 | 【需要原作资料确认】 | 明确标为“本作规则”。 | （待定） |
| D17 | `apps/huiguan/index.html` | 西木会馆 · 规则 | 治愈系与空间系互斥 | 原创平衡规则，写在“特殊限制”中像原作规定。 | B | P2 | 【需要原作资料确认】 | 标为“本站登记规则”。 | 本站登记规则：治愈系与空间系不能同时选择。 |
| D18 | `apps/cards/src/game/core/content.ts` | 众生牌录 · 同行者引言 | 同行者引言（以原作角色口吻） | 项目自写台词，展示方式像原作台词。 | E | P2 | 【需要原作资料确认】【可能被误认作原作官方设定】 | 见 decisions.md D18。 | （待定） |

## 需要原作资料确认（10 条）

| ID | 文件 | 模块 | 原文 | 问题 | 类型 | 严重度 | 原因 | 推荐方向 | 推荐文案 |
|---|---|---|---|---|---|---|---|---|---|
| Y01 | `apps/huiguan/index.html ABILITY_DETAIL vs packages/shared-data/worldview.json` | 能力系 · 吞噬 | huiguan：无限 吞物质；worldview：风息 吞灵质力 | 两处定义互相矛盾。 | A | P2 | 至少一处是错的，但不确定哪处。【需要原作资料确认】 | 确认后统一到 worldview.json。 | （待定） |
| Y02 | `apps/huiguan/index.html vs worldview.json` | 能力系 · 眷灵/画灵 | 眷灵、画灵 的持有者 | 两处持有者不一致。 | A | P2 | 【需要原作资料确认】 | 同上。 | （待定） |
| Y03 | `apps/slay/public/content/guild-branches.js, worldview-data.js; apps/management expeditionTargets.js; apps/cards data/rebirth.json` | 会馆 · 流石 | 流石会馆全员遇难 | 较重的原作事件表述，四处重复。 | E | P2 | 【需要原作资料确认】 | 确认后统一措辞。 | （待定） |
| Y04 | `apps/world-map/src/nodes.ts` | 世界地图 · 苍南 | 最早的传送门已有1000多年历史 | 具体年数需确认。 | E | P3 | 【需要原作资料确认】 | 不确定时可写“历史悠久”。 | （待定） |
| Y05 | `apps/slay/public/content/relations-data.js, character-events.js, timeline-data.js` | 人物关系 · 鹿野 | 关门弟子 | 师承表述需确认。 | E | P3 | 【需要原作资料确认】 | 不确定时用“弟子”。 | （待定） |
| Y06 | `apps/cards/src/game/characterForms.ts, packages/shared-data/worldview.json` | 角色形态 · 老君 | 节能模式 | 可能是同人梗而非原作说法。 | E | P3 | 【需要原作资料确认】 | 确认来源后决定是否标注“同人梗”。 | （待定） |
| Y07 | `apps/slay/public/content/ability-branches.js, music-data.js` | 引用 · 片名 | 不再流浪 | 需确认是否为原作片名/曲名。 | E | P3 | 【需要原作资料确认】 | 确认后统一书名号。 | （待定） |
| Y08 | `apps/slay/public/content/skills-data.js, apps/huiguan` | 法宝 · 天明珠 | 顶级炼器师，制造了天明珠等神器 | 天明珠来源、作用需确认。 | E | P3 | 【需要原作资料确认】 | 确认前避免写作用。 | （待定） |
| Y09 | `packages/shared-data/worldview.json` | 共享数据 · 角色描述 | 290 条推测性描述（“可能”“或许”“疑似”等） | 推测与事实混在同一字段。 | E | P2 | 【需要原作资料确认】 | 加 confidence 字段或在 UI 标“推测”。 | （待定） |
| Y10 | `apps/huiguan/index.html` | 西木会馆 · 能力说明 | 炼器师 / 法宝收藏家 | “炼器师”是修真词，原作是否有此称谓需确认。 | C | P3 | 【需要原作资料确认】 | 未确认前用“擅长制作法器的人”。 | 擅长制作法器的人 |

## 建议修改（本次未改）（6 条）

| ID | 文件 | 模块 | 原文 | 问题 | 类型 | 严重度 | 原因 | 推荐方向 | 推荐文案 |
|---|---|---|---|---|---|---|---|---|---|
| S01 | `apps/slay/public/game/actions.js` | 重生之门 · 战斗日志 | 「X」半血狂暴，进入第二形态！ | MMO 公告腔。 | D | P3 | 机制包装太游戏化。 | 换成角色化描写。 | 「X」被逼到绝境，攻势骤变！ |
| S02 | `apps/slay/public/game/actions.js, content/lingzhi-bonus.js; apps/huiguan` | 跨模块 · 货币 | 灵石 | 修真货币；与“金币”混用。 | D | P3 | 随 D12 一起决定。 | 统一一个货币名。 | （随 D12） |
| S03 | `apps/management/src/content/enemies.js, buildings.js` | 灵境会馆 · 敌人 | 妖物 / 灵质污染中诞生的火魅 | “妖物”带贬义；“灵质污染”是原创概念。 | B | P3 | 与会馆立场冲突。 | 改“失控的灵”“躁动的灵”。 | 躁动的灵 |
| S04 | `apps/ecology, apps/softie, apps/aeon` | 外围玩法 · 包装 | 细胞/基因/史莱姆/打工人/以神之手 | 包装层与世界观语言脱节。 | C | P3 | 外围玩法可以保留原创特色，但入口描述应说清是“灵境之外”的实验玩法。 | 入口统一加一句定位说明。 | （入口说明） |
| S05 | `apps/cards/src/game/ModeHall.tsx` | 门庭 · 聚灵/神经演化 | 以神之手塑造世界 | “神之手”带有宗教/造物主口吻。 | C | P4 | 措辞问题。 | 改中性。 | 亲手塑造世界 |
| S06 | `apps/slay/public/content/achievements.js` | 重生之门 · 成就描述 | 首次通关「重生之门」，窥见轮回的真相。 | 随 D04。 | E | P3 | 随 D04。 | 随 D04。 | （随 D04） |

## 文案债务（结构性）（10 条）

| ID | 文件 | 模块 | 原文 | 问题 | 类型 | 严重度 | 原因 | 推荐方向 | 推荐文案 |
|---|---|---|---|---|---|---|---|---|---|
| T01 | `packages/shared-types/world.js, worldview.json, apps/slay worldview-data.js & ability-branches.js, apps/huiguan ABILITY_DETAIL, apps/juling engine.js, apps/management loreCharacters.js` | 跨模块 · 能力系定义 | 至少 6 份能力系定义 | 同一概念 6 份来源，数量和定义互相冲突。 | A | P1 | 单一文案源问题。 | 以 shared-types/world.js + worldview.json 为唯一来源。 | — |
| T02 | `apps/slay/public/content/worldview-data.js` | 重生之门 · 世界观副本 | 手工维护的第二份世界观 | 与 packages/shared-data 分叉（六大系 vs 八大）。 | A | P2 | 单一文案源问题。 | 改为从 shared-data 生成。 | — |
| T03 | `apps/www/assets/site-language.js` | 主站 · 英文词典 | 门庭=Home、灵境会馆=Spirit Hall、西木会馆=Ximu Hall；仍有入世历练、旅途手札，无众生牌录 | 英文命名规则不统一，且词条过时。 | C | P3 | 英文版会继续显示下线玩法。 | 按 glossary.md 统一。 | — |
| T04 | `apps/cards/scripts/verify-game.mjs` | 测试 · e2e | 旅途手札、入世历练 | e2e 仍断言已下线玩法。 | C | P3 | 测试会阻止文案更新。 | 更新断言。 | — |
| T05 | `apps/slay（原版）与 apps/cards journal（移植版）` | 重生之门 · 双实现 | 两套重生之门文案 | 同一玩法两处维护，文案会分叉。 | C | P3 | 单一文案源问题。 | 决定以哪套为准。 | — |
| T06 | `apps/slay 与 apps/cards` | 跨模块 · 活动名 | 灵质修行 / 灵质回路 | 两个相似名字指两个不同活动。 | C | P3 | 玩家难区分。 | 见 glossary.md。 | — |
| T07 | `全站` | 跨模块 · 同义词 | 灵力/能量；灵石/金币；陨落/阵亡/倒下/散灵；守门者/守门 Boss | 同义词混用。 | C | P3 | 见 glossary.md。 | 按名词表统一。 | — |
| T08 | `apps/management/README.md` | 文档 | 顶部 AIGC 元数据块 | 生成工具的元数据残留。 | C | P4 | 非玩家可见，但会进仓库展示页。 | 删除或移入注释。 | — |
| T09 | `packages/shared-data/worldview.json` | 共享数据 | 维基模板残留 | 导出脚本没有清洗模板语法。 | C | P3 | 会随数据扩散到各模块（F19 即一例）。 | 在 export_worldview.py 里清洗。 | — |
| T10 | `apps/shell/portal.json 与 apps/cards/src/game/ModeHall.tsx` | 导航 · 玩法描述 | 同一玩法描述两处维护 | portal.json 是“导航唯一数据源”，ModeHall 又写了一份。 | C | P3 | 单一文案源问题。 | ModeHall 读 portal.json。 | — |

