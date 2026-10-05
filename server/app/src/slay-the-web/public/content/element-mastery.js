// 罗小黑战记·重生之门 —— 本命御灵系（五行共鸣）
// 设定依据：content/worldview-data.js（御灵系金木水火土分支）、games\juling\engine.js（五行相生相克）
// 机制：
//   1. 开局选定一个本命御灵系（金木水火土），获得对应本命被动（与法宝/羁绊被动共用 atkBonus/defBonus/hpRegen/fortune 键）
//   2. 战斗中打出卡牌时，按「卡牌 element ↔ 玩家本命 element」的五行关系给予共鸣加成：
//       同系（本命共鸣）   → 伤害/格挡 +2
//       相生（生我/我生）   → 伤害/格挡 +1
//       我克（本命克制）   → 伤害 +1（仅攻击牌）
//       被克/无五行关系     → 无加成
//   3. 本命御灵系信息展示在玩家面板与开局选择界面

// 五行元素顺序（与 wuxing-game engine.js 保持一致）
export const ELEMENTS = ['金', '木', '水', '火', '土']

// 相生：A 生 B（A -> B）
export const SHENG = {
	木: '火',
	火: '土',
	土: '金',
	金: '水',
	水: '木',
}

// 相克：A 克 B（A -> B）
export const KE = {
	木: '土',
	火: '金',
	土: '水',
	金: '木',
	水: '火',
}

// 五行角色定位（参考 wuxing-game ELEMENT_ROLE）
export const ELEMENT_ROLE = {
	金: '攻击·锋锐克木',
	木: '生长·生机克土',
	水: '控制·柔韧克火',
	火: '爆发·炽烈克金',
	土: '防御·厚重克水',
}

// 本命御灵系数据：每系一个本命被动，键与法宝/羁绊 passive 对齐
export const elementMasteries = [
	{
		element: '金',
		title: '锋锐金系',
		role: ELEMENT_ROLE.金,
		flavor: '金属操控，锋锐肃杀。御灵系中最善攻伐的分支，一往无前。',
		passive: {atkBonus: 1},
	},
	{
		element: '木',
		title: '生机木系',
		role: ELEMENT_ROLE.木,
		flavor: '万物生发，生机盎然。催生草木、愈疗生灵，御灵系中生机最盛。',
		passive: {hpRegen: 1},
	},
	{
		element: '水',
		title: '柔韧水系',
		role: ELEMENT_ROLE.水,
		flavor: '藏渊若水，变化无形。控水驭冰，柔韧绵长，福缘自来。',
		passive: {fortune: 2},
	},
	{
		element: '火',
		title: '炽烈火系',
		role: ELEMENT_ROLE.火,
		flavor: '炽烈爆发，焚尽八荒。御灵系中爆发最强，一鼓作气，势不可挡。',
		passive: {atkBonus: 1},
	},
	{
		element: '土',
		title: '厚重土系',
		role: ELEMENT_ROLE.土,
		flavor: '大地厚载，稳若磐石。御灵系中最善防御，不动如山。',
		passive: {defBonus: 1},
	},
]

/** @param {string} element @returns {object|undefined} */
export const elementMasteryByElement = (element) => elementMasteries.find((m) => m.element === element)

// 五行关系判定
/** @param {string} cardElement @param {string} playerElement @returns {'same'|'sheng'|'ke'|'beKe'|'beSheng'|'none'} */
export function elementRelation(cardElement, playerElement) {
	if (!cardElement || !playerElement) return 'none'
	if (cardElement === playerElement) return 'same'
	// 生我（card 生 player）
	if (SHENG[cardElement] === playerElement) return 'beSheng'
	// 我生（player 生 card）
	if (SHENG[playerElement] === cardElement) return 'sheng'
	// 我克（player 克 card）
	if (KE[playerElement] === cardElement) return 'ke'
	// 被克（card 克 player）
	if (KE[cardElement] === playerElement) return 'beKe'
	return 'none'
}

/**
 * 计算卡牌与玩家本命系的五行共鸣加成。
 * @param {string} cardElement
 * @param {string} playerElement
 * @param {{attack?: boolean, block?: boolean}} [kind] - 卡牌种类；默认同时考虑伤害与格挡
 * @returns {{atkBonus: number, defBonus: number}}
 */
export function elementCardBonus(cardElement, playerElement, kind = {}) {
	const relation = elementRelation(cardElement, playerElement)
	if (relation === 'none') return {atkBonus: 0, defBonus: 0}
	const atk = kind.attack === false ? 0 : 1
	const def = kind.block === false ? 0 : 1
	switch (relation) {
		case 'same':
			// 本命共鸣：伤害与格挡均 +2
			return {atkBonus: 2 * atk, defBonus: 2 * def}
		case 'beSheng':
		case 'sheng':
			// 相生呼应：伤害与格挡均 +1
			return {atkBonus: 1 * atk, defBonus: 1 * def}
		case 'ke':
			// 本命克制：攻击牌伤害 +1；格挡牌不受益
			return {atkBonus: 1 * atk, defBonus: 0}
		case 'beKe':
			// 被克制：无加成（不做负向惩罚，避免挫败）
			return {atkBonus: 0, defBonus: 0}
		default:
			return {atkBonus: 0, defBonus: 0}
	}
}

/** 汇总本命御灵系的某一被动数值（与 treasurePassiveTotal/bondPassiveTotal 对齐） */
export function elementPassiveTotal(player, key) {
	if (!player || !player.element) return 0
	const mastery = elementMasteryByElement(player.element)
	return mastery?.passive?.[key] || 0
}

// —— 怪物五行（敌我双向克制结算，数据见 dungeon-encounters.js 各怪 element 字段）——
// 机制（与卡牌共鸣同一张五行表）：
//   1. 玩家攻击怪物：同系共鸣（御灵共鸣）→ 伤害 +1；本命克制（玩家 克 怪物）→ 伤害 +1；其余无加成
//   2. 怪物攻击玩家：怪物克制玩家本命 → 伤害 +1（属性压制，选系需有策略）；其余无加成

/** 玩家攻击怪物时的五行加成：同系共鸣 / 本命克制 → +1（仅作用于怪物目标） */
export function playerVsMonsterBonus(playerElement, monsterElement) {
	if (!playerElement || !monsterElement) return 0
	if (playerElement === monsterElement) return 1
	if (KE[playerElement] === monsterElement) return 1
	return 0
}

/** 怪物攻击玩家时的五行压制：怪物克制玩家本命 → +1；其余无加成 */
export function monsterVsPlayerBonus(monsterElement, playerElement) {
	if (!monsterElement || !playerElement) return 0
	if (KE[monsterElement] === playerElement) return 1
	return 0
}

// —— 卡牌五行共鸣徽标（卡面直接提示该卡与玩家本命系的关系）——
// 依据 elementCardBonus 的加成规则，供 ui/cards.js 在卡面渲染小印章：
//   同系（本命共鸣）→ 伤害/格挡 +2；相生（生我/我生）→ 伤害/格挡 +1；
//   本命克制 → 攻击 +1；被克制 → 无加成（不做惩罚）。
const RESONANCE_META = {
	same: {label: '本命共鸣', cls: 'same', bonus: '伤害/格挡 +2'},
	sheng: {label: '相生呼应', cls: 'sheng', bonus: '伤害/格挡 +1'},
	beSheng: {label: '相生呼应', cls: 'sheng', bonus: '伤害/格挡 +1'},
	ke: {label: '本命克制', cls: 'ke', bonus: '攻击 +1'},
	beKe: {label: '被克', cls: 'beke', bonus: '无加成'},
}

/**
 * 计算卡牌与玩家本命系的共鸣徽标信息。
 * @param {string} cardElement 卡牌元素（金木水火土/生灵/空间/心灵等）
 * @param {string} playerElement 玩家本命御灵系（金木水火土）
 * @returns {{relation: string, label: string, cls: string, bonus: string, title: string}|null}
 *          无玩家本命或卡牌无五行时不返回徽标。
 */
export function cardResonanceInfo(cardElement, playerElement) {
	if (!cardElement || !playerElement) return null
	const relation = elementRelation(cardElement, playerElement)
	const meta = RESONANCE_META[relation]
	if (!meta) return null
	return {
		relation,
		label: meta.label,
		cls: meta.cls,
		bonus: meta.bonus,
		title: `${meta.label}：${meta.bonus}`,
	}
}

// ==================== 五行天时（时令相位） ====================
// 机制来源：games\juling\engine.js PHASE_LING（天时相位）
//   天时按五行轮转，不同相位下灵的流动不同：生发相生灵盛、肃杀相物质凝而伤生。
// 玩法化：爬塔每层对应一个天时相位（随楼层 5 层一循环），与五行共鸣同表结算——
//   「顺天应时」：打出与天时同系的卡牌，伤害/格挡 +1；
//   「应时之妖」：与天时同系的怪物攻击时伤害 +1（敌我对称，选系与构筑需权衡天时）。
// 楼层映射（wuxing-game 五行轮转顺序，0 层起）：
//   0 木·生发（灵溪/罗家岙） → 1 火·旺盛 → 2 土·中和 → 3 金·肃杀 → 4 水·收藏 → 5 木·生发…

// 天时相位顺序（与 wuxing-game engine.js ELEMENTS 一致）
export const WEATHER_ORDER = ['木', '火', '土', '金', '水']

// 天时相位数据：flavor / 生灵、物质灵倾向引用 wuxing-game PHASE_LING
export const weatherPhases = [
	{element: '木', name: '天时·生发', flavor: '万物生发，生灵活跃', shengling: 5, wuzhi: 2, decay: 1},
	{element: '火', name: '天时·旺盛', flavor: '能量鼎盛，灵潮澎湃', shengling: 4, wuzhi: 4, decay: 2},
	{element: '土', name: '天时·中和', flavor: '中和稳定，大地厚载', shengling: 3, wuzhi: 5, decay: 1},
	{element: '金', name: '天时·肃杀', flavor: '肃杀收敛，物质凝练', shengling: 1, wuzhi: 6, decay: 4},
	{element: '水', name: '天时·收藏', flavor: '收藏归藏，生灵潜息', shengling: 4, wuzhi: 3, decay: 3},
]

/** 当前楼层对应的天时元素（楼层 5 层一循环） */
export function weatherForFloor(floor) {
	const i = ((Math.floor(floor || 0) % WEATHER_ORDER.length) + WEATHER_ORDER.length) % WEATHER_ORDER.length
	return WEATHER_ORDER[i]
}

/** 天时相位详情（按元素查） */
export const weatherPhaseInfo = (element) => weatherPhases.find((p) => p.element === element)

/**
 * 天时共鸣：打出与天时同系的卡牌「顺天应时」→ 伤害/格挡 +1。
 * 相生/相克/无关均无加成（不惩罚，仅鼓励顺应时令的构筑取舍）。
 * @returns {{atkBonus: number, defBonus: number}}
 */
export function weatherCardBonus(weatherElement, cardElement, kind = {}) {
	if (!weatherElement || !cardElement || weatherElement !== cardElement) return {atkBonus: 0, defBonus: 0}
	const atk = kind.attack === false ? 0 : 1
	const def = kind.block === false ? 0 : 1
	return {atkBonus: atk, defBonus: def}
}

/** 怪物应时：与天时同系的怪物攻击时伤害 +1（「应时之妖」，敌我对称） */
export function weatherMonsterBonus(weatherElement, monsterElement) {
	if (!weatherElement || !monsterElement) return 0
	return weatherElement === monsterElement ? 1 : 0
}

// ==================== 灵机共振（今日灵机 × 楼层天时） ====================
// 机制来源：content/daily.js「今日灵机」的五行当值（按日期确定性轮换）与楼层天时（weatherForFloor）双系统联动。
// 当「今日灵机当值五行」与「当前楼层天时」同向时，天地同频，该系灵气格外活跃：
//   1. 玩家打出与共振系同系的卡牌：伤害/格挡 +1（叠加于「顺天应时」之上，共振日同系卡牌共 +2）
//   2. 与共振系同系的怪物攻击时：伤害 +1（叠加于「应时之妖」之上，敌我对称）
// 说明：共振是「稀有日」增益（当值五行 5 选 1，且仅在对应楼层出现），不改动既有数值，
//       仅在两系统同向时叠加，为每日爬塔增加可感知的天时变化与构筑取舍。

/**
 * 判断今日灵机当值五行是否与当前楼层天时同向。
 * @param {string} weatherElement 当前楼层天时（weatherForFloor）
 * @param {string} dailyElement  今日灵机当值五行（todayDaily().element.element，开局写入 player.daily.element）
 * @returns {{active: boolean, element?: string, label?: string, desc?: string}}
 */
export function resonanceInfo(weatherElement, dailyElement) {
	if (!weatherElement || !dailyElement || weatherElement !== dailyElement) return {active: false}
	return {
		active: true,
		element: weatherElement,
		label: '灵机共振',
		desc: '灵机与天时同向，此系灵气格外活跃',
	}
}

/**
 * 灵机共振卡牌加成：共振系同系卡牌 → 伤害/格挡 +1（叠加于顺天应时之上）。
 * @returns {{atkBonus: number, defBonus: number}}
 */
export function resonanceCardBonus(weatherElement, dailyElement, cardElement, kind = {}) {
	const info = resonanceInfo(weatherElement, dailyElement)
	if (!info?.active || !cardElement || cardElement !== info.element) return {atkBonus: 0, defBonus: 0}
	const atk = kind.attack === false ? 0 : 1
	const def = kind.block === false ? 0 : 1
	return {atkBonus: atk, defBonus: def}
}

/** 灵机共振怪物加成：共振系同系怪物攻击时伤害 +1（敌我对称） */
export function resonanceMonsterBonus(weatherElement, dailyElement, monsterElement) {
	const info = resonanceInfo(weatherElement, dailyElement)
	if (!info?.active || !monsterElement || monsterElement !== info.element) return 0
	return 1
}
