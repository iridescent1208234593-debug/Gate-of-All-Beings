import {shuffle, range} from './utils.js'

/**
 * @typedef {object} ROOM
 * @prop {string} type
 * @prop {Array=} monsters
 */

/**
 * @returns {ROOM}
 */
export function StartRoom() {
	return {
		type: 'start',
	}
}

/**
 * A campfire gives our hero the opportunity to rest, remove or upgrade a card.
 * @returns {ROOM}
 */
export function CampfireRoom() {
	return {
		type: 'campfire',
		// choices: ['rest', 'remove', 'upgrade'],
	}
}

/**
 * A monster room has one or more monsters.
 * @param {...Object} monsters
 * @returns {ROOM}
 */
export function MonsterRoom(...monsters) {
	return {
		type: 'monster',
		monsters,
	}
}

/**
 * A cultivation event room presents the player with a binary choice,
 * affecting cultivation stats (realm/cultivation/daoHeart/fortune), health,
 * cards or treasures. Data comes from content/cultivation.js.
 * @param {object} event - a POJO event from the event pool
 * @returns {ROOM}
 */
export function EventRoom(event) {
	return {
		type: 'event',
		event,
	}
}

/**
 * A spirit space room: the player enters another's (or their own awakened)
 * 灵质空间 and makes a three-way choice inside. Data comes from content/spirit-spaces.js.
 * @param {object} space - a POJO spirit space from the pool
 * @returns {ROOM}
 */
export function SpiritSpaceRoom(space) {
	return {
		type: 'spirit-space',
		space,
	}
}

/**
 * A story room: the player recalls a moment from the original TV series,
 * gaining a small reward for reliving the memory. Data comes from content/episodes-data.js.
 * @param {object} episode - {num, title, overview, cast} from episodeList
 * @returns {ROOM}
 */
export function StoryRoom(episode) {
	return {
		type: 'story',
		episode,
	}
}

/**
 * A shop room: the player spends gold (earned from battle rewards) on
 * cards / treasures / healing. Data comes from content/shop.js.
 * @param {object} shop - {theme, items} from createShop()
 * @returns {ROOM}
 */
export function ShopRoom(shop) {
	return {
		type: 'shop',
		shop,
	}
}

/**
 * @typedef MONSTER
 * @prop {number} [hp]
 * @prop {number} [currentHealth]
 * @prop {number} [maxHealth]
 * @prop {number} [block]
 * @prop {number} [random]
 * @prop {Array} [intents]
 * @prop {number} [nextIntent]
 * @prop {Object} [powers]
 */

// A monster has health, probably some damage and a list of intents.
// Use a list of intents to describe what the monster should do each turn.
// Supported intents: block, damage, vulnerable, weak, strength, regen and heal.
//   strength  本回合起永久获得 N 层力量（伤害 +N，不随回合递减）
//   regen     本回合起永久获得 N 层回灵（每回合回复 N 生命，不随回合递减）
//   heal      立即回复 N 生命（不超过最大生命）
// Intents are cycled through as the monster plays its turn.

/**
 *
 * @param {MONSTER} props
 * @returns {MONSTER}
 */
export function Monster(
	props = {
		currentHealth: 42,
		maxHealth: 42,
		intents: [],
	}
) {
	// By setting props.random to a number, all damage intents will be randomized with this range.
	let randomIntents
	if (typeof props.random === 'number') {
		randomIntents = props.intents.map((intent) => {
			if (intent.damage) {
				let newDamage = shuffle(range(5, intent.damage - props.random))[0]
				intent.damage = newDamage
			}
			return intent
		})
	}

	return {
		currentHealth: props.hp || props.currentHealth,
		maxHealth: props.hp || props.maxHealth,
		block: props.block || 0,
		powers: props.powers || {},
		// 罗小黑世界观：怪物名字（由 dungeon-encounters.js 传入，UI 用于显示）
		name: props.name || '妖',
		// 罗小黑世界观：怪物五行（由 dungeon-encounters.js 传入，战斗中五行克制结算，UI 显示标签）
		element: props.element || undefined,
		// 罗小黑世界观：怪物抗性/能力（可选，未配置时按五行推导，影响 buff/debuff 自动衰减幅度）
		resistance: props.resistance !== undefined ? props.resistance : elementResistance(props.element),
		potency: props.potency !== undefined ? props.potency : elementPotency(props.element),
		// 罗小黑世界观：出场台词（Boss 战开场时在战斗界面以气泡展示，见 ui/player.js）
		quote: props.quote || undefined,
		// 罗小黑世界观：第二阶段台词（Boss 半血进入 phase2 后展示，见 ui/player.js）
		phase2Quote: props.phase2Quote || undefined,
		// 罗小黑世界观：怪物御灵系技能名（由 dungeon-encounters.js 传入，战斗 UI 怪物名旁展示，见 ui/player.js）
		skill: props.skill || undefined,
		// A list of "actions" the monster will take each turn.
		// Example: [{damage: 6}, {block: 2}, {}, {weak: 2}]
		// ... meaning turn 1, deal 6 damage, turn 2 gain 2 block, turn 3 do nothing, turn 4 apply 2 weak
		intents: randomIntents || props.intents,
		// A counter to keep track of which intent to run next.
		nextIntent: 0,
		// —— Boss 第二阶段（半血狂暴）——
		// 配置 phase2 意图数组的 Boss，在生命低于 50% 时切换为第二形态
		// （game/actions.js takeMonsterTurn 检测并切换，切换后从 phase2 第 1 个意图开始）。
		phase2: props.phase2 || undefined,
		phase2Active: false,
	}
}

// —— 五行抗性/能力推导（罗小黑世界观：五行生克）——
// 抗性（resistance）影响 debuff 衰减：土厚德（抗性最高）> 金 > 水 > 木 > 火
// 能力（potency）影响 buff 维持：火爆发（能力最高）> 木 > 水 > 金 > 土
const ELEMENT_RESISTANCE = {土: 12, 金: 9, 水: 6, 木: 3, 火: 0}
const ELEMENT_POTENCY = {火: 12, 木: 9, 水: 6, 金: 3, 土: 0}
function elementResistance(element) {
	return ELEMENT_RESISTANCE[element] ?? 0
}
function elementPotency(element) {
	return ELEMENT_POTENCY[element] ?? 0
}
