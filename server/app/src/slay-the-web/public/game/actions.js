import {produce} from '../web_modules/immer.js'
import {createCard, CardTargets} from './cards.js'
import {clamp, shuffle} from './utils.js'
import {getTargets, getCurrRoom} from './utils-state.js'
import powers from './powers.js'
import {dungeonWithMap, bossLootFor} from '../content/dungeon-encounters.js'
import {difficultyById, rewardMultiplier} from '../content/difficulty.js'
import {conditionsAreValid} from './conditions.js'
import {realms, treasures, breakthroughBonus} from '../content/cultivation.js'
import {applyLegacy} from '../content/soul-legacy.js'
import {applyCollectionBonus} from '../content/collection-bonus.js'
import {applyLingzhiBonus, applyLingzhiSettlement, applyLingzhiAwakening, lingzhiAwakeningPassiveTotal} from '../content/lingzhi-bonus.js'
import {applyGatherLing, checkTransform, performTransform, transformStageInfo} from '../content/ling-gather.js'
import {craftGolem, golemPassiveTotal, golemStatus, golemById} from '../content/golem-craft.js'
import {applyDailyBlessing, todayDaily} from '../content/daily.js'
import {bondById} from '../content/bonds.js'
import {skillEffectByName} from '../content/skill-effects.js'
import {markCollected, markMany, isCollected} from '../content/collection-progress.js'
import {articlesLinkedTo, conceptArticles} from '../content/articles-data.js'
import {locationForFloor} from './dungeon.js'
import {
	elementMasteries,
	elementMasteryByElement,
	elementPassiveTotal,
	elementCardBonus,
	playerVsMonsterBonus,
	monsterVsPlayerBonus,
	weatherForFloor,
	weatherCardBonus,
	weatherMonsterBonus,
	resonanceCardBonus,
	resonanceMonsterBonus,
} from '../content/element-mastery.js'
import {
	abilityBranchById,
	branchPassiveTotal,
} from '../content/ability-branches.js'
import {guildById, guildPassiveTotal, randomGuildId} from '../content/guild-branches.js'

// 轮回压迫配置（源自 wuxing-game「众生之门·轮回肉鸽」：
//   tick>10 后宇宙逼近终结，生灵枯竭，每 3 回合扣除递增灵气）
// 爬塔对应：从第 5 层「北域」（那伽领地）起，越接近重生之门压迫越强，
// 每进入一层按 (楼层-4)*2 扣除生命（5层2 / 6层4 / 7层6 / 8层8 / 9层重生之门10）。
const CYCLE_PRESSURE_START_FLOOR = 5
const cyclePressureForFloor = (floor) =>
	Math.max(0, (floor - CYCLE_PRESSURE_START_FLOOR + 1) * 2)

// 轮回侵蚀（最终 Boss 战「重生之门」专属）：
// 抵达重生之门后，累积的轮回压迫每回合化作「轮回侵蚀」——无视格挡、直击灵魂。
// 道心可减免：每 10 点道心抵 1 点侵蚀；侵蚀不会致死（保底 1 生命）。
// 与 wuxing-game「众生之门·轮回肉鸽」对齐：宇宙逼近终结，生灵枯竭。
const CYCLE_EROSION_DIVISOR = 5
const cycleErosionForPlayer = (player) =>
	Math.max(
		0,
		Math.floor((player.cyclePressure || 0) / CYCLE_EROSION_DIVISOR) -
			Math.floor((player.daoHeart || 0) / 10)
	)

// 战斗日志：在 produce 回调内调用，向 state.log 追加一条带回合数的事件记录，
// 供 ui/battle-log.js 渲染（五行克制 / 天时加成 / 轮回侵蚀 / 突破 / 掉落等机制反馈）。
// 最多保留最近 60 条，超出自动截断最旧条目。
const LOG_LIMIT = 60
const pushLog = (draft, text, kind = 'info') => {
	if (!draft.log) draft.log = []
	draft.log.push({turn: draft.turn || 1, text, kind})
	if (draft.log.length > LOG_LIMIT) draft.log = draft.log.slice(-LOG_LIMIT)
}

// 是否处于最终 Boss 战（重生之门层）：当前房间是怪物房，且位于 dungeon graph 最后一层。
const isFinalBossFight = (state) => {
	const dungeon = state.dungeon
	if (!dungeon || !dungeon.graph) return false
	const node = dungeon.graph[dungeon.y] && dungeon.graph[dungeon.y][dungeon.x]
	if (!node || !node.room || node.room.type !== 'monster') return false
	return dungeon.y === dungeon.graph.length - 1
}

// Without this, immer.js will throw an error if our `state` is modified outside of an action.
// While in theory a good idea, we're not there yet. It is a useful way to spot modifications
// of the game state that should not be there.
// setAutoFreeze(false)

// In Slay the Web, we have one big object with game state.
// Whenever we want to change something, call an "action" from this file.
// Each action takes two arguments: 1) the current state, 2) an object of arguments.

/**
 * @typedef {object} State
 * @prop {number} turn
 * @prop {Array} deck
 * @prop {Array} drawPile
 * @prop {Array} hand
 * @prop {Array} discardPile
 * @prop {Player} player
 * @prop {Object} dungeon
 */

/**
 * @typedef {object} Player
 * @prop {number} currentEnergy
 * @prop {number} maxEnergy
 * @prop {number} currentHealth
 * @prop {number} maxHealth
 * @prop {number} block
 * @prop {Object} powers
 */

/**
 * This is the big object of game state. Everything starts here.
 * @param {string=} element - 本命御灵系（金木水火土）；缺省时随机觉醒
 * @param {string=} branch - 灵质天赋（八大能力系）；缺省时无天赋
 * @param {string=} difficulty - 难度（trial/normal/rebirth）；缺省时「历练」
 * @param {string=} guild - 出身分馆（妖灵会馆七大分馆）；缺省时随机出身
 * @returns {State}
 */
function createNewGame(element, branch, difficulty, guild) {
	// 本命御灵系：缺省随机觉醒（魂灵在轮回中自行择一五行系）
	const elementName =
		element && elementMasteryByElement(element) ? element : elementMasteries[Math.floor(Math.random() * elementMasteries.length)].element
	// 灵质天赋（八大能力系）：灵质空间因先天天赋拥有偏向
	const branchName = branch && abilityBranchById(branch) ? branch : undefined
	// 出身分馆（妖灵会馆）：缺省随机出身一家分馆（御灵师以会馆分馆为出身与后盾）
	const guildName = guild && guildById(guild) ? guild : randomGuildId()
	const guildData = guildById(guildName)
	const diff = difficultyById(difficulty)
	const state = {
		turn: 1,
		deck: [],
		drawPile: [],
		hand: [],
		discardPile: [],
		// 局内元信息：难度档（试炼/历练/轮回）影响怪物血量与战利品倍率
		meta: {
			difficulty: diff.id,
			difficultyName: diff.name,
		},
		player: {
			maxEnergy: 3,
			currentEnergy: 3,
			maxHealth: 72 + diff.startingHealthBonus,
			currentHealth: 72 + diff.startingHealthBonus,
			block: 0,
			powers: {},
			// 本命御灵系（五行共鸣）：影响卡牌共鸣加成与本命被动
			element: elementName,
			// 灵质天赋（八大能力系）：影响被动加成与开局专属卡
			branch: branchName,
			// 出身分馆（妖灵会馆）：馆训被动加成（atkBonus/defBonus/hpRegen/fortune/daoHeart/maxHealth）
			guild: guildData ? guildData.id : undefined,
			// 修仙数值（移植自一念仙途）
			realmIndex: 0,
			realmName: realms[0].name,
			cultivation: 0, // 修为，满 100 突破境界
			daoHeart: 20, // 道心
			fortune: 5, // 福缘
			treasures: [], // 法宝列表
			bonds: [], // 羁绊列表（与核心角色结缘，本局永久被动加成）
			cyclePressure: 0, // 轮回压迫累计（源自 wuxing-game：宇宙逼近终结，生灵枯竭）
			gold: 0, // 金币（战斗胜利获得，用于商店消费）
			// 聚灵修炼（源自 wuxing-game 生灵/物质灵双资源）：御灵师借天时聚灵，达标后化形进阶
			shengling: 20, // 生灵（生命底蕴，聚灵获得）
			wuzhi: 0, // 物质灵（成形根基，聚灵获得）
			transformStage: 0, // 化形阶段（0精灵·无形 / 1妖精·化形 / 2大妖·通灵）
			golems: [], // 灵偶（造物系：生灵+物质灵铸造，本局永久被动助战）
		},
		dungeon: {},
		log: [],
	}
	// 本命被动即时生效：福缘（水系）等直接写入
	const mastery = elementMasteryByElement(elementName)
	if (mastery?.passive?.fortune) state.player.fortune += mastery.passive.fortune
	// 灵质天赋被动即时生效：道心（心灵系）、福缘（空间系）等直接写入
	const branchData = abilityBranchById(branchName)
	if (branchData?.passive?.fortune) state.player.fortune += branchData.passive.fortune
	if (branchData?.passive?.daoHeart) state.player.daoHeart += branchData.passive.daoHeart
	// 馆训被动即时生效：道心（苍南/粤东）、福缘（灵溪）、生命（龙游）直接写入
	if (guildData?.passive?.fortune) state.player.fortune += guildData.passive.fortune
	if (guildData?.passive?.daoHeart) state.player.daoHeart += guildData.passive.daoHeart
	if (guildData?.passive?.maxHealth) {
		state.player.maxHealth += guildData.passive.maxHealth
		state.player.currentHealth += guildData.passive.maxHealth
	}
	// 魂灵跨局传承：按累计魂灵等级给予开局加成（前世积累，今生受用）
	applyLegacy(state)
	// 万灵归藏：按累计图鉴收录给予开局加成（见闻沉淀为灵藏，跨局受用）
	applyCollectionBonus(state)
	// 灵质修行联动：按修行已解锁条目/成就给予开局加成（修行反哺爬塔，详见 content/lingzhi-bonus.js）
	applyLingzhiBonus(state)
	// 灵质修行结算桥接：上一场修行结算的修为/道心/法宝（按守门 Boss 通关/最高层数折算）
	// 在下一局爬塔开局一次性承接；跨局通道复用 soul-legacy 已验证的 localStorage 模式（详见 content/lingzhi-bonus.js）
	applyLingzhiSettlement(state)
	// 灵质共鸣觉醒：按修行深度（回路层数/通关次数/残片）折算等级，
	// 开局注入初始灵石与「灵质亲和」常驻被动（全卡伤害/格挡 +等级，见 content/lingzhi-bonus.js）
	applyLingzhiAwakening(state)
	// 今日灵机：按日期确定性给予当日五行当值与灵机祝福（顺天应时，一日一佑）
	applyDailyBlessing(state, todayDaily())
	return state
}

// By default a new game doesn't come with a dungeon. You have to set one explicitly. Look in dungeon-encounters.js for inspiration.
/** @returns {State} */
function setDungeon(state, dungeon, difficulty) {
	if (!dungeon) dungeon = dungeonWithMap(difficulty || state.meta?.difficulty, state.player?.guild)
	state.dungeon = dungeon
	return state
	// return produce(state, (draft) => {
	// 	draft.dungeon = dungeon
	// })
}

// 按本命五行差异化的初始卡组（五行共鸣·各系开局风格）
// 设定：开局选择的本命御灵系决定初始牌型——
//   金·锋锐（高攻+易伤压制）/ 木·回春（虚弱控制+回灵续航）/
//   水·流转（攻防一体+抽牌流转）/ 火·爆发（高费重击+回能）/ 土·厚德（重防+祛除负面）
const STARTER_DECKS = {
	金: ['金刃', '金刃', '金刃', '剑域·斩', '剑域·斩', '御金击', '雷灵闪', '土盾', '土盾', '定心镜'],
	木: ['木缠暗击', '木缠暗击', '木缠暗击', '木愈回春', '回春术', '回春术', '眷灵', '金刃', '土盾', '土盾'],
	水: ['铁浪', '铁浪', '铁浪', '金刃', '金刃', '团鼠·吞灵', '团鼠·吞灵', '黑咻·分身', '土盾', '治愈灵光'],
	火: ['火尖枪·破', '火尖枪·破', '炎爆术', '炎爆术', '金刃', '金刃', '横扫', '土盾', '土盾', '无相面具'],
	土: ['土盾', '土盾', '土盾', '土灵护体', '土灵护体', '金刃', '金刃', '铁浪', '定心镜', '黑咻·分身'],
}

// Draws a "starter" deck to your discard pile. Normally you'd run this as you start the game.
function addStarterDeck(state) {
	const element = state.player?.element || '金'
	const deckNames = STARTER_DECKS[element] || STARTER_DECKS['金']
	const deck = deckNames.map((name) => createCard(name))
	// 灵质天赋（八大能力系）：开局加入一张该系专属卡，体现灵质空间的天赋偏向
	const branch = state.player?.branch && abilityBranchById(state.player.branch)
	if (branch?.starterCard && !deckNames.includes(branch.starterCard)) {
		deck.push(createCard(branch.starterCard))
	}
	// 御灵系·五行分支：御灵系「分支为金木水火土」，按本命五行额外觉醒一张对应分支卡
	if (branch?.id === 'yuling' && branch.branchCards) {
		const branchCardName = branch.branchCards[element]
		if (branchCardName && !deckNames.includes(branchCardName) && !deck.some((c) => c.name === branchCardName)) {
			const branchCard = createCard(branchCardName)
			if (branchCard) deck.push(branchCard)
		}
	}
	// 双系合技觉醒（dual_skills 表）：造物系→画灵（生灵系+造物系）、心灵系→灵誓（生灵系+心灵系，代表老君）。
	// 拥有对应天赋者在开局即觉醒这张双系合技卡，体现「双系合技」的稀有能力。
	let dualSkillName = null
	if (branch?.dualSkill && !deckNames.includes(branch.dualSkill) && !deck.some((c) => c.name === branch.dualSkill)) {
		const dualCard = createCard(branch.dualSkill)
		if (dualCard) {
			deck.push(dualCard)
			dualSkillName = branch.dualSkill
		}
	}
	return produce(state, (draft) => {
		draft.deck = deck
		draft.drawPile = shuffle(deck)
		// 锁御系·御器：与法器亲和，开局获得一件法宝随行
		if (branch?.starterTreasure && !draft.player.treasures.some((t) => t.id === branch.starterTreasure)) {
			const treasure = treasures[branch.starterTreasure]
			if (treasure) {
				draft.player.treasures.push(treasure)
				if (treasure.passive?.fortune) draft.player.fortune += treasure.passive.fortune
			}
		}
		if (dualSkillName) {
			pushLog(draft, `双系合技觉醒：获得「${dualSkillName}」（${branch.name}·合技卡）`, 'reward')
		}
	})
}

// Move X cards from deck to hand.
function drawCards(state, options) {
	const amount = options?.amount ? options.amount : 5
	return produce(state, (draft) => {
		// When there aren't enough cards to draw, we recycle all cards from the discard pile to the draw pile. Should we shuffle?
		if (state.drawPile.length < amount) {
			draft.drawPile = state.drawPile.concat(state.discardPile)
			draft.drawPile = shuffle(draft.drawPile)
			draft.discardPile = []
		}
		const newCards = draft.drawPile.slice(0, amount)
		// Take the first X cards from deck and add to hand and remove them from the deck.
		draft.hand = draft.hand.concat(newCards)
		for (let i = 0; i < amount; i++) {
			draft.drawPile.shift()
		}
	})
}

// Adds a card (from nowhere) directly to your hand.
function addCardToHand(state, {card}) {
	return produce(state, (draft) => {
		draft.hand.push(card)
	})
}

// Discard a single card from your hand.
function discardCard(state, {card}) {
	return produce(state, (draft) => {
		draft.hand = state.hand.filter((c) => c.id !== card.id)
		draft.discardPile.push(card)
	})
}

// Discard your entire hand.
function discardHand(state) {
	return produce(state, (draft) => {
		draft.hand.forEach((card) => {
			draft.discardPile.push(card)
		})
		draft.hand = []
	})
}

// Discard a single card from your hand.
function removeCard(state, {card}) {
	return produce(state, (draft) => {
		draft.deck = state.deck.filter((c) => c.id !== card.id)
	})
}

/**
 * Upgrades a card.
 * @param {State} state
 * @param {card} object
 * @returns {State}
 */
function upgradeCard(state, {card}) {
	return produce(state, (draft) => {
		draft.deck.find((c) => c.id === card.id).upgrade()
	})
}

// The funky part of this action is the `target` argument. It needs to be a special type of string:
// Either "player" to target yourself, or "enemyx", where "x" is the index of the monster starting from 0. See utils.js#getTargets
/**
 *
 * @param {State} state
 * @param {object} props
 * @param {object} props.card
 * @param {string=} props.target
 * @returns {State}
 */
function playCard(state, {card, target}) {
	if (!target) target = card.target
	if (typeof target !== 'string')
		throw new Error(`Wrong target to play card: ${target},${card.target}`)
	if (target === 'enemy') throw new Error('Wrong target, did you mean "enemy0" or "allEnemies"?')
	if (!card) throw new Error('No card to play')
	if (state.player.currentEnergy < card.energy) throw new Error('Not enough energy to play card')
	let newState = discardCard(state, {card})
	newState = produce(newState, (draft) => {
		// Use energy
		draft.player.currentEnergy = newState.player.currentEnergy - card.energy
		// Block is expected to always target the player.
		if (card.block) {
			// 法宝：玄铁甲增加格挡；羁绊：老君阁论道等增加格挡；本命御灵系：土系被动+五行共鸣；灵质天赋：造物/锁御系护体；天时：同系顺天应时；灵机共振：今日当值与天时同向叠加；灵偶：造物系铸造的随行灵偶；灵质亲和：修行共鸣等级的全卡格挡加成
			const defBonus =
				treasurePassiveTotal(newState.player, 'defBonus') +
				bondPassiveTotal(newState.player, 'defBonus') +
				elementPassiveTotal(newState.player, 'defBonus') +
				branchPassiveTotal(newState.player, 'defBonus') +
				guildPassiveTotal(newState.player, 'defBonus') +
				dailyPassiveTotal(newState.player, 'defBonus') +
				golemPassiveTotal(newState.player, 'defBonus') +
				lingzhiAwakeningPassiveTotal(newState.player, 'defBonus') +
				elementCardBonus(card.element, newState.player.element, {attack: false, block: true}).defBonus +
				weatherCardBonus(weatherForFloor(newState.dungeon.y), card.element, {attack: false, block: true}).defBonus +
				resonanceCardBonus(
					weatherForFloor(newState.dungeon.y),
					newState.player.daily?.element || null,
					card.element,
					{attack: false, block: true}
				).defBonus
			draft.player.block = newState.player.block + card.block + defBonus
			pushLog(
				draft,
				`打出「${card.name}」：格挡 +${card.block + defBonus}${defBonus ? `（含加成 ${defBonus}）` : ''}`,
				'def'
			)
		}
	})
	if (card.type === 'attack' || card.damage) {
		// This should be refactored, but when you play an attack card that targets all enemies,
		// we prioritize this over the actual enemy where you dropped the card.
		const newTarget = card.target === CardTargets.allEnemies ? card.target : target
		// 法宝/羁绊/本命御灵系被动/灵质天赋 + 五行共鸣加成（同系/相生/克制）+ 天时顺天应时（同系+1）+ 灵机共振（今日当值与天时同向叠加+1）+ 灵偶（造物系随行助战）+ 灵质亲和（修行共鸣等级的全卡伤害加成）
		let amount =
			card.damage +
			treasurePassiveTotal(newState.player, 'atkBonus') +
			bondPassiveTotal(newState.player, 'atkBonus') +
			elementPassiveTotal(newState.player, 'atkBonus') +
			branchPassiveTotal(newState.player, 'atkBonus') +
			guildPassiveTotal(newState.player, 'atkBonus') +
			dailyPassiveTotal(newState.player, 'atkBonus') +
			golemPassiveTotal(newState.player, 'atkBonus') +
			lingzhiAwakeningPassiveTotal(newState.player, 'atkBonus') +
			elementCardBonus(card.element, newState.player.element, {attack: true, block: false}).atkBonus +
			weatherCardBonus(weatherForFloor(newState.dungeon.y), card.element, {attack: true, block: false}).atkBonus +
			resonanceCardBonus(
				weatherForFloor(newState.dungeon.y),
				newState.player.daily?.element || null,
				card.element,
				{attack: true, block: false}
			).atkBonus
		// 怪物五行克制（仅单体目标）：同系共鸣 / 本命克制 → 伤害 +1（allEnemies 不加，保持全伤卡平衡）
		if (newTarget !== CardTargets.allEnemies && newTarget !== CardTargets.player) {
			const monsterIndex = Number(String(newTarget).replace('enemy', ''))
			const room = getCurrRoom(newState)
			const monster = room.monsters[monsterIndex]
			if (monster && monster.currentHealth > 0) {
				amount += playerVsMonsterBonus(newState.player.element, monster.element)
			}
		}
		if (newState.player.powers.weak) amount = powers.weak.use(amount)
		newState = removeHealth(newState, {target: newTarget, amount})
		// 战斗日志：记录造成伤害（含五行共鸣/克制/天时等加成后的最终值）
		const targetLabel =
			newTarget === CardTargets.allEnemies
				? '全体敌人'
				: (() => {
						const monsterIndex = Number(String(newTarget).replace('enemy', ''))
						const roomNow = getCurrRoom(newState)
						const monster = roomNow && roomNow.monsters && roomNow.monsters[monsterIndex]
						return monster ? monster.name : newTarget
				  })()
		newState = produce(newState, (draft) => {
			pushLog(draft, `打出「${card.name}」对${targetLabel}造成 ${amount} 点伤害`, 'dmg')
		})
	}
	if (card.powers) newState = applyCardPowers(newState, {target, card})
	// if (card.use) newState = card.use(newState, {target, card})
	newState = useCardActions(newState, {target, card})
	return newState
}

/**
 * Runs through a list of actions and return the updated state.
 * Called when the card is played.
 * You CAN overwrite it, just make sure to return a new state.
 * @param {State} state
 * @param {object} props
 * @prop {string} props.target
 * @prop {object} props.card
 * @returns {State}
 */
export function useCardActions(state, {target, card}) {
	if (!card.actions) return state
	let newState = state
	card.actions.forEach((action) => {
		// Don't run action if it has an invalid condition.
		if (action.conditions && !conditionsAreValid(action.conditions, state)) {
			return newState
		}
		// Make sure the action is called with a target.
		if (!action.parameter) action.parameter = {}
		// Prefer the target you dropped the card on.
		action.parameter.target = target
		action.parameter.card = card
		// Run the action
		newState = allActions[action.type](newState, action.parameter)
	})
	return newState
}

/**
 *
 * @param {State} state
 * @param {{target: string, amount: number}} param1
 * @returns {State} new state
 */
function addHealth(state, {target, amount}) {
	return produce(state, (draft) => {
		const targets = getTargets(draft, target)
		targets.forEach((t) => {
			t.currentHealth = clamp(t.currentHealth + amount, 0, t.maxHealth)
		})
	})
}

function addRegenEqualToAllDamage(state, {card}) {
	return produce(state, (draft) => {
		const room = getCurrRoom(state)
		const aliveMonsters = room.monsters.filter((monster) => {
			return monster.currentHealth > 0
		})
		const {regen = 0} = state.player.powers
		const totalDamage = aliveMonsters.length * card.damage
		draft.player.powers.regen = totalDamage + regen
	})
}

const removePlayerDebuffs = (state) => {
	return produce(state, (draft) => {
		draft.player.powers.weak = 0
		draft.player.powers.vulnerable = 0
	})
}

function addEnergyToPlayer(state) {
	return produce(state, (draft) => {
		/* draft.player.maxEnergy = draft.player.maxEnergy + 1 */
		draft.player.currentEnergy = draft.player.currentEnergy + 1
	})
}

/**
 * Removes health from a target, respecting vulnerable and block.
 * @param {Object} state
 * @param {Object} props
 * @param {CardTargets} props.target
 * @param {number} props.amount
 * @returns {Object} - new state
 */
const removeHealth = (state, {target, amount}) => {
	return produce(state, (draft) => {
		getTargets(draft, target).forEach((t) => {
			if (t.powers.vulnerable) amount = powers.vulnerable.use(amount)
			let amountAfterBlock = t.block - amount
			if (amountAfterBlock < 0) {
				t.block = 0
				t.currentHealth = t.currentHealth + amountAfterBlock
			} else {
				t.block = amountAfterBlock
			}
		})
	})
}

/**
 * Sets the health of a target
 * @param {Object} state
 * @param {{target: CardTargets, amount: number}} props
 * @returns {State}
 */
const setHealth = (state, {target, amount}) => {
	return produce(state, (draft) => {
		getTargets(draft, target).forEach((t) => {
			t.currentHealth = amount
		})
	})
}

// Used by playCard. Applies each power on the card to?
function applyCardPowers(state, {card, target}) {
	return produce(state, (draft) => {
		Object.entries(card.powers).forEach(([name, stacks]) => {
			// Add powers that target player.
			if (card.target === CardTargets.player) {
				draft.player.powers[name] = (draft.player.powers[name] || 0) + stacks
			}

			// Add powers that target all enemies.
			else if (card.target === CardTargets.allEnemies) {
				draft.dungeon.graph[draft.dungeon.y][draft.dungeon.x].room.monsters.forEach((monster) => {
					if (monster.currentHealth < 1) return
					monster.powers[name] = (monster.powers[name] || 0) + stacks
				})
			}

			// Add powers to a specific enemy.
			else if (target) {
				const index = target.split('enemy')[1]
				const monster = draft.dungeon.graph[draft.dungeon.y][draft.dungeon.x].room.monsters[index]
				if (monster.currentHealth < 1) return
				monster.powers[name] = (monster.powers[name] || 0) + stacks
			}
		})
	})
}

// —— 统一自动衰减机制（罗小黑·重生之门）——
// 所有增益/减益均随回合结束自动衰减，衰减幅度由 power 自身 decay 配置决定，
// 并被角色「抗性（debuff 消退更快）/ 能力（buff 维持更久）」数值修正：
//   玩家抗性 = 道心 + 福缘（心灵系抵御负面、福缘避祸）
//   玩家能力 = 境界 + 道心（修为越高，增益越持久）
//   怪物抗性/能力 = 可选 resistance / potency 字段（未配置时为 0，按五行/身份配置）

// 角色抗性：影响 debuff 衰减（每 8 点抗性使 debuff 每回合额外衰减 1 层）
function ownerResistance(owner) {
	if (owner && owner.daoHeart !== undefined) {
		// 玩家：道心为主，福缘为辅
		return Math.floor((owner.daoHeart || 0) / 10) + Math.floor((owner.fortune || 0) / 5)
	}
	return (owner && owner.resistance) || 0
}

// 角色能力：影响 buff 衰减（每 12 点能力使 buff 每回合少衰减 1 层，最少仍衰减 1 层）
function ownerPotency(owner) {
	if (owner && owner.realmIndex !== undefined) {
		// 玩家：境界为主，道心为辅
		return (owner.realmIndex || 0) * 2 + Math.floor((owner.daoHeart || 0) / 20)
	}
	return (owner && owner.potency) || 0
}

// 计算单个 power 的回合衰减量（层数）
function decayAmount(powerDef, stacks, owner) {
	if (!powerDef || !powerDef.decay) return stacks > 0 ? 1 : 0
	const {mode, amount = 1} = powerDef.decay
	let base
	if (mode === 'half') {
		base = Math.max(1, Math.floor(stacks / 2))
	} else {
		base = Math.min(amount, stacks)
	}
	if (base <= 0) return stacks > 0 ? 1 : 0
	// 抗性/能力修正
	if (powerDef.type === 'debuff') {
		base += Math.floor(ownerResistance(owner) / 10)
	} else {
		base -= Math.floor(ownerPotency(owner) / 10)
	}
	return Math.max(1, Math.min(base, stacks))
}

// Helper to decrease all power stacks by their own decay config.
function _decreasePowers(powers, owner) {
	Object.entries(powers).forEach(([name, stacks]) => {
		if (stacks > 0) {
			const powerDef = powersByName[name] || null
			powers[name] = stacks - decayAmount(powerDef, stacks, owner)
		}
	})
}

// 通过名字取 power 定义（与 powers.js 保持一致）
const powersByName = {
	regen: powers.regen,
	vulnerable: powers.vulnerable,
	weak: powers.weak,
	strength: powers.strength,
	monsterRegen: powers.monsterRegen,
}

// Decrease player's power stacks.
function decreasePlayerPowerStacks(state) {
	return produce(state, (draft) => {
		_decreasePowers(draft.player.powers, draft.player)
	})
}

// Decrease monster's power stacks.
// 力量(strength)与回灵(monsterRegen)为成长型 buff，半衰减（由 power.decay 配置）；
// 其余 debuff 按各自衰减配置递减，并被怪物抗性修正。
function decreaseMonsterPowerStacks(state) {
	return produce(state, (draft) => {
		getCurrRoom(draft).monsters.forEach((monster) => {
			_decreasePowers(monster.powers || {}, monster)
		})
	})
}

function endTurn(state) {
	let newState = discardHand(state)
	if (state.player.powers.regen) {
		newState = produce(newState, (draft) => {
			let amount = powers.regen.use(newState.player.powers.regen)
			let newHealth
			// Don't allow regen to go above max health.
			if (newState.player.currentHealth + amount > newState.player.maxHealth) {
				newHealth = newState.player.maxHealth
			} else {
				newHealth = addHealth(newState, {target: 'player', amount}).player.currentHealth
			}
			draft.player.currentHealth = newHealth
		})
	}
	// 法宝：灵泉葫芦等每回合回复生命；羁绊：谛听的凝视每回合温养心脉；本命御灵系：木系生机；灵质天赋：生灵系生命链接
	const hpRegen =
		treasurePassiveTotal(state.player, 'hpRegen') +
		bondPassiveTotal(state.player, 'hpRegen') +
		elementPassiveTotal(state.player, 'hpRegen') +
		branchPassiveTotal(state.player, 'hpRegen') +
		guildPassiveTotal(state.player, 'hpRegen') +
		dailyPassiveTotal(state.player, 'hpRegen')
	if (hpRegen > 0) {
		newState = produce(newState, (draft) => {
			draft.player.currentHealth = clamp(
				draft.player.currentHealth + hpRegen,
				0,
				draft.player.maxHealth
			)
		})
	}
	newState = playMonsterActions(newState)
	// 轮回侵蚀：最终 Boss 战中，每回合结束后承受累积轮回压迫的侵蚀（无视格挡、道心可减免、保底 1 生命）。
	newState = applyCycleErosion(newState)
	newState = decreasePlayerPowerStacks(newState)
	newState = decreaseMonsterPowerStacks(newState)
	newState = newTurn(newState)
	return newState
}

// 轮回侵蚀结算：最终 Boss 战每回合结束后，按玩家累积轮回压迫施加侵蚀伤害。
// 侵蚀无视格挡、道心减免（每 10 点抵 1），且不会致死（保底 1 生命）。
function applyCycleErosion(state) {
	if (!isFinalBossFight(state)) return state
	const erosion = cycleErosionForPlayer(state.player)
	if (erosion < 1) return state
	return produce(state, (draft) => {
		draft.player.currentHealth = clamp(
			draft.player.currentHealth - erosion,
			1,
			draft.player.maxHealth
		)
		pushLog(
			draft,
			`轮回侵蚀袭来：生命 -${erosion}（轮回压迫 ${state.player.cyclePressure} · 道心减免 ${Math.floor((state.player.daoHeart || 0) / 10)}）`,
			'warn'
		)
	})
}

// Draws new cards, reset energy, remove player block, check powers
function newTurn(state) {
	let newState = drawCards(state)

	return produce(newState, (draft) => {
		draft.turn++
		draft.player.currentEnergy = draft.player.maxEnergy || 3
		draft.player.block = 0
	})
}

function reshuffleAndDraw(state) {
	const nextState = produce(state, (draft) => {
		draft.hand = []
		draft.discardPile = []
		draft.drawPile = shuffle(draft.deck)
	})
	return drawCards(nextState)
}

// Run all monster intents in current room.
function playMonsterActions(state) {
	const room = getCurrRoom(state)
	if (!room.monsters) return state
	// For each monster, take turn, get state, pass to next monster.
	let nextState = state
	room.monsters.forEach((monster, index) => {
		nextState = takeMonsterTurn(nextState, index)
	})
	return nextState
}

// Runs the "intent" for a single monster (index) in the current room.
// 扩展意图：strength（力量累积）/ regen（回灵累积）/ heal（立即回复），
// 均不随回合递减；力量对伤害直接加成，回灵在行动前回复生命。
function takeMonsterTurn(state, monsterIndex) {
	return produce(state, (draft) => {
		const room = getCurrRoom(draft)
		const monster = room.monsters[monsterIndex]
		// Reset block at start of turn.
		monster.block = 0

		// If dead don't do anything..
		if (monster.currentHealth < 1) return

		// 回灵：行动前恢复生命（不超过最大生命）。
		if (monster.powers.monsterRegen) {
			monster.currentHealth = clamp(
				monster.currentHealth + monster.powers.monsterRegen,
				0,
				monster.maxHealth
			)
		}

		// —— 御灵系技能效果（每回合行动前触发）——
		// 怪物身上配置的 skill 不再只是名字展示，而是映射为实际战斗效果
		// （虚弱/易伤/格挡/力量/回灵/回复），见 content/skill-effects.js。
		const skillEffect = skillEffectByName(monster.skill)
		if (skillEffect) {
			// 注意：endTurn 末尾会统一递减玩家 powers（decreasePlayerPowerStacks），
			// 因此给玩家的 debuff 需带 +1 底数（与下方意图 weak/vulnerable 的 `+1` 处理一致），
			// 保证玩家下个回合开始时真实生效对应层数。
			if (skillEffect.playerWeak) {
				draft.player.powers.weak = (draft.player.powers.weak || 0) + skillEffect.playerWeak + 1
			}
			if (skillEffect.playerVulnerable) {
				draft.player.powers.vulnerable =
					(draft.player.powers.vulnerable || 0) + skillEffect.playerVulnerable + 1
			}
			if (skillEffect.selfBlock) {
				monster.block = monster.block + skillEffect.selfBlock
			}
			if (skillEffect.selfStrength) {
				monster.powers.strength = (monster.powers.strength || 0) + skillEffect.selfStrength
			}
			if (skillEffect.selfRegen) {
				monster.powers.monsterRegen = (monster.powers.monsterRegen || 0) + skillEffect.selfRegen
			}
			if (skillEffect.selfHeal) {
				monster.currentHealth = clamp(
					monster.currentHealth + skillEffect.selfHeal,
					0,
					monster.maxHealth
				)
			}
			// 技能日志：汇总本次生效的御灵系技能效果，让玩家看清技能来源
			// （battle-log.js 中 event 类渲染为紫色事件条，与意图日志并列、不刷屏）。
			const skillParts = []
			if (skillEffect.playerWeak) skillParts.push(`使你虚弱 +${skillEffect.playerWeak}`)
			if (skillEffect.playerVulnerable) skillParts.push(`使你易伤 +${skillEffect.playerVulnerable}`)
			if (skillEffect.selfBlock) skillParts.push(`格挡 +${skillEffect.selfBlock}`)
			if (skillEffect.selfStrength) skillParts.push(`力量 +${skillEffect.selfStrength}`)
			if (skillEffect.selfRegen) skillParts.push(`回灵 +${skillEffect.selfRegen}`)
			if (skillEffect.selfHeal) skillParts.push(`回复 ${skillEffect.selfHeal} 生命`)
			if (skillParts.length) {
				pushLog(draft, `「${monster.name}」发动御灵技【${monster.skill}】：${skillParts.join(' · ')}`, 'event')
			}
		}

		// —— Boss 第二阶段（半血狂暴）——
		// 配置 phase2 的 Boss，生命首次低于最大生命 50% 时切换为第二形态：
		// 替换为 phase2 意图数组并从第 1 个意图重新开始（仅触发一次）。
		if (monster.phase2 && !monster.phase2Active && monster.currentHealth <= monster.maxHealth * 0.5) {
			monster.phase2Active = true
			monster.intents = monster.phase2
			monster.nextIntent = 0
			pushLog(draft, `「${monster.name}」半血狂暴，进入第二形态！`, 'warn')
		}

		// Get current intent.
		const intent = monster.intents[monster.nextIntent || 0]
		if (!intent) return

		// Increment for next turn..
		if (monster.nextIntent === monster.intents.length - 1) {
			monster.nextIntent = 0
		} else {
			monster.nextIntent++
		}

		// Run the intent..
		if (intent.block) {
			monster.block = monster.block + intent.block
			pushLog(draft, `「${monster.name}」蓄力防御：格挡 +${intent.block}`, 'def')
		}

		if (intent.strength) {
			monster.powers.strength = (monster.powers.strength || 0) + intent.strength
			pushLog(draft, `「${monster.name}」汇聚力量：攻击 +${intent.strength}`, 'info')
		}

		if (intent.regen) {
			monster.powers.monsterRegen = (monster.powers.monsterRegen || 0) + intent.regen
			pushLog(draft, `「${monster.name}」吐纳回灵：每回合回复 ${intent.regen} 生命`, 'heal')
		}

		if (intent.heal) {
			monster.currentHealth = clamp(
				monster.currentHealth + intent.heal,
				0,
				monster.maxHealth
			)
			pushLog(draft, `「${monster.name}」恢复 ${intent.heal} 点生命`, 'heal')
		}

		if (intent.damage) {
			let amount = intent.damage + (monster.powers.strength || 0)
			// 怪物五行压制：怪物克制玩家本命 → 伤害 +1（选系需权衡各楼层怪物属性）
			amount += monsterVsPlayerBonus(monster.element, draft.player.element)
			// 怪物应时：与当前天时同系的怪物顺天应时 → 伤害 +1（敌我对称）
			amount += weatherMonsterBonus(weatherForFloor(draft.dungeon.y), monster.element)
			// 灵机共振：今日当值五行与天时同向时，共振系怪物攻击 → 伤害 +1（敌我对称）
			amount += resonanceMonsterBonus(
				weatherForFloor(draft.dungeon.y),
				draft.player.daily?.element || null,
				monster.element
			)
			if (monster.powers.weak) amount = powers.weak.use(amount)
			const updatedPlayer = removeHealth(draft, {target: 'player', amount}).player
			draft.player.block = updatedPlayer.block
			draft.player.currentHealth = updatedPlayer.currentHealth
			pushLog(
				draft,
				`「${monster.name}」对你造成 ${amount} 点伤害${monster.powers.strength ? `（力量 +${monster.powers.strength}）` : ''}`,
				'dmg'
			)
		}

		if (intent.vulnerable) {
			draft.player.powers.vulnerable = (draft.player.powers.vulnerable || 0) + intent.vulnerable + 1
			pushLog(draft, `「${monster.name}」使你易伤 +${intent.vulnerable}`, 'debuff')
		}

		if (intent.weak) {
			draft.player.powers.weak = (draft.player.powers.weak || 0) + intent.weak + 1
			pushLog(draft, `「${monster.name}」使你虚弱 +${intent.weak}`, 'debuff')
		}
	})
}

/**
 * @param {State} state
 * @param {{card: object}} param1
 * @returns {State}
 */
function addCardToDeck(state, {card}) {
	const next = produce(state, (draft) => {
		draft.deck.push(card)
	})
	// 收集图鉴：获得卡牌即登记（战斗奖励选卡 / 篝火强化等统一入口）
	if (card?.name) markCollected('cards', card.name)
	return next
}

// Records a move on the map.
function move(state, {move}) {
	let nextState = reshuffleAndDraw(state)

	const next = produce(nextState, (draft) => {
		// Clear temporary powers, energy and block on player.
		draft.player.powers = {}
		draft.player.currentEnergy = draft.player.maxEnergy || 3
		draft.player.block = 0
		draft.dungeon.graph[move.y][move.x].didVisit = true
		draft.dungeon.pathTaken.push({x: move.x, y: move.y})
		draft.dungeon.x = move.x
		draft.dungeon.y = move.y
		// 修仙：每抵达新一层，战斗历练获得修为（一念仙途数值系统）
		if (move.y > 0) {
			draft.player.cultivation = clamp((draft.player.cultivation || 0) + 8, 0, 100)
			maybeBreakthrough(draft)
		}
		// 轮回压迫（源自 wuxing-game「众生之门·轮回肉鸽」：宇宙逼近终结，生灵枯竭）：
		// 从第 5 层「北域」起，越接近重生之门压迫越强，每进入一层扣除生命（保底 1，不会直接致死）。
		if (move.y >= CYCLE_PRESSURE_START_FLOOR) {
			const pressure = cyclePressureForFloor(move.y)
			draft.player.cyclePressure = (draft.player.cyclePressure || 0) + pressure
			draft.player.currentHealth = clamp(
				draft.player.currentHealth - pressure,
				1,
				draft.player.maxHealth
			)
			pushLog(
				draft,
				`踏入第 ${move.y} 层，轮回压迫 +${pressure}：生命 -${pressure}（累计压迫 ${draft.player.cyclePressure}）`,
				'warn'
			)
		}
		// 移动日志：抵达新地点（含地点名称）
		const locNow = locationForFloor(move.y)
		if (locNow) pushLog(draft, `抵达「${locNow.name}」${locNow.desc ? `—— ${locNow.desc}` : ''}`, 'info')
		// if (number === state.dungeon.rooms.length - 1) {
		// 	throw new Error('You have reached the end of the dungeon. Congratulations.')
		// }
	})

	// 收集图鉴：抵达新楼层自动登记地点主题；进入灵质空间房登记空间
	const loc = locationForFloor(move.y)
	if (loc?.name) markCollected('locations', loc.name)
	const targetNode = next.dungeon.graph[move.y] && next.dungeon.graph[move.y][move.x]
	const room = targetNode?.room
	if (room?.type === 'spirit-space' && room.space?.name) markCollected('spaces', room.space.name)

	return next
}

/**
 * Deals damage to a target equal to the current player's block.
 * @param {State} state
 * @param {object} props
 * @param {string} props.target
 * @returns {State}
 */
function dealDamageEqualToBlock(state, {target}) {
	if (state.player.block) {
		const block = state.player.block
		return removeHealth(state, {target, amount: block})
	}
}

function dealDamageEqualToVulnerable(state, {target}) {
	return produce(state, (draft) => {
		getTargets(draft, target).forEach((t) => {
			if (t.powers.vulnerable) {
				const amount = t.currentHealth - t.powers.vulnerable
				t.currentHealth = amount
			}
		})
		return draft
	})
}
function dealDamageEqualToWeak(state, {target}) {
	return produce(state, (draft) => {
		getTargets(draft, target).forEach((t) => {
			if (t.powers.weak) {
				const amount = t.currentHealth - t.powers.weak
				t.currentHealth = amount
			}
		})
		return draft
	})
}

/**
 * Sets a single power on a specific target
 * @param {State} state
 * @param {Object} props
 * @param {string} props.target
 * @param {string} props.power
 * @param {number} props.amount
 * @returns {State}
 */
function setPower(state, {target, power, amount}) {
	return produce(state, (draft) => {
		getTargets(draft, target).forEach((target) => {
			target.powers[power] = amount
		})
	})
}

// 削减目标指定 power 层数（下限 0）：用于克制敌方回灵/力量的卡牌技能。
function reducePower(state, {target, power, amount}) {
	return produce(state, (draft) => {
		getTargets(draft, target).forEach((target) => {
			target.powers[power] = Math.max(0, (target.powers[power] || 0) - (amount || 0))
		})
	})
}

/**
 * Stores a campfire choice on the room (useful for stats and whatnot)
 * @param {State} state
 * @param {object} props
 * @param {object} props.room a dungeon room
 * @param {string} props.choice enum of the campfire choices
 * @param {object} props.reward card
 * @returns {State}
 */
function makeCampfireChoice(state, {choice, reward}) {
	return produce(state, (draft) => {
		const room = getCurrRoom(draft)
		room.choice = choice
		room.reward = reward
	})
}

// 汇总玩家所有法宝的某一被动效果数值（如 hpRegen / atkBonus / defBonus）
function treasurePassiveTotal(player, key) {
	if (!player.treasures) return 0
	return player.treasures.reduce((sum, treasure) => sum + (treasure.passive?.[key] || 0), 0)
}

// 汇总玩家所有羁绊的某一被动效果数值（键与法宝 passive 对齐：atkBonus / defBonus / hpRegen / fortune）
function bondPassiveTotal(player, key) {
	if (!player.bonds) return 0
	return player.bonds.reduce((sum, bond) => sum + (bond.passive?.[key] || 0), 0)
}

// 汇总今日灵机祝福的被动效果数值（键与法宝 passive 对齐；每日开局仅一条，天然轻量）
function dailyPassiveTotal(player, key) {
	return player.daily?.passive?.[key] || 0
}

// 结下羁绊：去重后加入玩家 bonds，并立即应用即时型加成（maxHealth / fortune / daoHeart）
function gainBond(draft, id) {
	const bond = bondById(id)
	if (!bond) {
		console.warn('羁绊结缘失败，羁绊不存在:', id)
		return
	}
	if (draft.player.bonds.some((b) => b.id === id)) return
	draft.player.bonds.push(bond)
	if (bond.passive?.maxHealth) {
		draft.player.maxHealth = clamp(draft.player.maxHealth + bond.passive.maxHealth, 1, 9999)
		draft.player.currentHealth = clamp(
			draft.player.currentHealth + bond.passive.maxHealth,
			0,
			draft.player.maxHealth
		)
	}
	if (bond.passive?.fortune) draft.player.fortune = clamp((draft.player.fortune || 0) + bond.passive.fortune, 0, 999)
	if (bond.passive?.daoHeart) draft.player.daoHeart = clamp((draft.player.daoHeart || 0) + bond.passive.daoHeart, 0, 999)
}

// 修为满 100 自动突破境界，获得突破奖励（移植自一念仙途境界系统）
function maybeBreakthrough(draft) {
	if (draft.player.cultivation < 100) return
	if (draft.player.realmIndex >= realms.length - 1) {
		// 已到渡劫圆满：修为保留，不再突破
		draft.player.cultivation = 100
		return
	}
	draft.player.realmIndex++
	draft.player.realmName = realms[draft.player.realmIndex].name
	draft.player.cultivation = 0
	draft.player.maxHealth += breakthroughBonus.maxHealth
	draft.player.currentHealth = clamp(draft.player.currentHealth + breakthroughBonus.maxHealth, 0, draft.player.maxHealth)
	draft.player.daoHeart += breakthroughBonus.daoHeart
	pushLog(
		draft,
		`修为圆满，突破至「${draft.player.realmName}」：生命上限 +${breakthroughBonus.maxHealth} · 道心 +${breakthroughBonus.daoHeart}`,
		'break'
	)
}

// 修仙事件抉择：应用一念仙途事件效果（修为/道心/福缘/生命/加卡/法宝/羁绊/魂灵种子），并检测境界突破
/**
 * 词条-收集联动：获得法宝/卡牌时，自动解锁关联世界观词条（markMany 已去重）。
 * @param {{treasureId?: string, cardName?: string}} got
 */
function unlockArticlesByGot({treasureId, cardName}) {
	const names = articlesLinkedTo({treasureId, cardName})
	if (!names.length) return []
	const fresh = names.filter((n) => !isCollected('articles', n))
	if (fresh.length) markMany('articles', fresh)
	return fresh
}

/**
 * 概念词条·灵质空间洞悉：从尚未收集的概念词条中随机悟得一条并入库。
 * @returns {string|null} 洞悉到的词条名（已集齐时返回 null）
 */
function unlockRandomConceptArticle() {
	const uncollected = conceptArticles().filter((a) => !isCollected('articles', a.name))
	if (!uncollected.length) return null
	const name = uncollected[Math.floor(Math.random() * uncollected.length)].name
	markCollected('articles', name)
	return name
}

function makeEventChoice(state, {side, event}) {
	// 灵质天赋专属选项：side='branch' 时取事件 branchChoice 的效果（八大系天赋玩家独有）
	const effects = (side === 'branch' ? event?.branchChoice?.effects : event?.choices?.[side]?.effects) || {}
	const next = produce(state, (draft) => {
		const room = getCurrRoom(draft)
		room.choiceMade = side
		if (effects.cultivation) draft.player.cultivation = clamp((draft.player.cultivation || 0) + effects.cultivation, 0, 100)
		if (effects.daoHeart) draft.player.daoHeart = clamp((draft.player.daoHeart || 0) + effects.daoHeart, 0, 999)
		if (effects.fortune) draft.player.fortune = clamp((draft.player.fortune || 0) + effects.fortune, 0, 999)
		if (effects.health) {
			draft.player.currentHealth = clamp(draft.player.currentHealth + effects.health, 0, draft.player.maxHealth)
		}
		if (effects.maxHealth) {
			draft.player.maxHealth = clamp(draft.player.maxHealth + effects.maxHealth, 1, 9999)
			draft.player.currentHealth = clamp(draft.player.currentHealth + effects.maxHealth, 0, draft.player.maxHealth)
		}
		if (effects.addCard) {
			try {
				draft.deck.push(createCard(effects.addCard))
				// 收集联动：新卡解锁关联世界观词条（图鉴入库由下方统一完成）
				const unlocked = unlockArticlesByGot({cardName: effects.addCard})
				if (unlocked.length) pushLog(draft, `词条收录：「${unlocked.join('」「')}」`, 'event')
			} catch (e) {
				console.warn('事件加卡失败，卡名不存在:', effects.addCard)
			}
		}
		if (effects.treasure) {
			const treasure = treasures[effects.treasure]
			if (treasure && !draft.player.treasures.some((t) => t.id === treasure.id)) {
				draft.player.treasures.push(treasure)
				if (treasure.passive?.fortune) draft.player.fortune += treasure.passive.fortune
				// 收集联动：法宝解锁关联世界观词条（图鉴入库由下方统一完成）
				const unlocked = unlockArticlesByGot({treasureId: treasure.id})
				if (unlocked.length) pushLog(draft, `词条收录：「${unlocked.join('」「')}」`, 'event')
			}
		}
		if (effects.bond) gainBond(draft, effects.bond)
		// 魂灵种子：局内奇遇凝结，散灵时经 soul-legacy.js 折算魂灵跨局累积
		if (effects.soulSeed) draft.player.soulSeed = (draft.player.soulSeed || 0) + effects.soulSeed
		// 灵偶造物：消耗生灵/物质灵铸造随行灵偶（craftGolem 可为单 id 或 id 数组）
		let golemGain = null
		if (effects.craftGolem) {
			const ids = Array.isArray(effects.craftGolem) ? effects.craftGolem : [effects.craftGolem]
			for (const id of ids) {
				const done = craftGolem(draft.player, id)
				if (done.ok) {
					golemGain = golemGain || {names: [], passive: {}}
					golemGain.names.push(done.golem.name)
					golemGain.passive = {...golemGain.passive, ...done.reward.passive}
				} else {
					pushLog(draft, `铸造灵偶失败：${done.reason}`, 'event')
				}
			}
		}
		maybeBreakthrough(draft)
		// 聚灵修炼：效果字段支持 shengling / wuzhi（直接增减），或 ling（按当前天时自动聚灵一次）
		let lingGain = null
		if (effects.ling || effects.shengling || effects.wuzhi) {
			if (effects.ling) {
				lingGain = applyGatherLing(draft.player, weatherForFloor(draft.dungeon?.y))
			} else {
				draft.player.shengling = clamp((draft.player.shengling || 0) + (effects.shengling || 0), 0, 999)
				draft.player.wuzhi = clamp((draft.player.wuzhi || 0) + (effects.wuzhi || 0), 0, 999)
				lingGain = {gain: {shengling: effects.shengling || 0, wuzhi: effects.wuzhi || 0, element: null}}
			}
			const ready = checkTransform(draft.player)
			if (ready) {
				const done = performTransform(draft.player)
				if (done.ok) {
					pushLog(
						draft,
						`✨ 生灵与物质灵交织成形——化形为「${done.stage.name}」：${done.stage.rewardText}`,
						'event'
					)
				}
			}
		}
		// 事件日志：记录玩家选择与效果摘要
		const summary = [
			effects.cultivation ? `修为 ${effects.cultivation > 0 ? '+' : ''}${effects.cultivation}` : null,
			effects.daoHeart ? `道心 ${effects.daoHeart > 0 ? '+' : ''}${effects.daoHeart}` : null,
			effects.fortune ? `福缘 ${effects.fortune > 0 ? '+' : ''}${effects.fortune}` : null,
			effects.health ? `生命 ${effects.health > 0 ? '+' : ''}${effects.health}` : null,
			effects.maxHealth ? `生命上限 +${effects.maxHealth}` : null,
			effects.addCard ? `获得卡牌「${effects.addCard}」` : null,
			effects.treasure ? `获得法宝「${treasures[effects.treasure]?.name || effects.treasure}」` : null,
			effects.bond ? `结下羁绊「${bondById(effects.bond)?.name || effects.bond}」` : null,
			effects.soulSeed ? `魂灵种子 +${effects.soulSeed}` : null,
			golemGain ? `铸造灵偶「${golemGain.names.join('」「')}」` : null,
			lingGain ? `生灵 +${lingGain.gain.shengling} · 物质灵 +${lingGain.gain.wuzhi}（${transformStageInfo(draft.player).name} ${draft.player.shengling}/${draft.player.wuzhi}）` : null,
		]
			.filter(Boolean)
			.join(' · ')
		pushLog(
			draft,
			`【${event?.title || '机缘'}】选择「${event?.choices?.[side]?.text || side}」${summary ? `：${summary}` : ''}`,
			'event'
		)
	})

	// 收集图鉴：完成事件抉择即登记事件，及事件附带的卡牌 / 法宝 / 羁绊
	if (event?.title) markCollected('events', event.title)
	if (effects.addCard) markCollected('cards', effects.addCard)
	if (effects.treasure) markCollected('artifacts', effects.treasure)
	if (effects.bond) {
		const bond = bondById(effects.bond)
		if (bond) markCollected('bonds', bond.name)
	}

	return next
}

// 灵质空间抉择：在他人灵质空间（或自身空间觉醒）内三选一探索。
// 效果字段与事件一致（cultivation/daoHeart/fortune/health/maxHealth/addCard/treasure/bond/soulSeed），由 room.space 提供。
function makeSpiritChoice(state, {side, space}) {
	const effects = space?.choices?.[side]?.effects || {}
	const next = produce(state, (draft) => {
		const room = getCurrRoom(draft)
		room.choiceMade = side
		if (effects.cultivation) draft.player.cultivation = clamp((draft.player.cultivation || 0) + effects.cultivation, 0, 100)
		if (effects.daoHeart) draft.player.daoHeart = clamp((draft.player.daoHeart || 0) + effects.daoHeart, 0, 999)
		if (effects.fortune) draft.player.fortune = clamp((draft.player.fortune || 0) + effects.fortune, 0, 999)
		if (effects.health) {
			draft.player.currentHealth = clamp(draft.player.currentHealth + effects.health, 0, draft.player.maxHealth)
		}
		if (effects.maxHealth) {
			draft.player.maxHealth = clamp(draft.player.maxHealth + effects.maxHealth, 1, 9999)
			draft.player.currentHealth = clamp(draft.player.currentHealth + effects.maxHealth, 0, draft.player.maxHealth)
		}
		if (effects.addCard) {
			try {
				draft.deck.push(createCard(effects.addCard))
				// 收集联动：新卡解锁关联世界观词条（图鉴入库由下方统一完成）
				const unlocked = unlockArticlesByGot({cardName: effects.addCard})
				if (unlocked.length) pushLog(draft, `词条收录：「${unlocked.join('」「')}」`, 'event')
			} catch (e) {
				console.warn('灵质空间加卡失败，卡名不存在:', effects.addCard)
			}
		}
		if (effects.treasure) {
			const treasure = treasures[effects.treasure]
			if (treasure && !draft.player.treasures.some((t) => t.id === treasure.id)) {
				draft.player.treasures.push(treasure)
				if (treasure.passive?.fortune) draft.player.fortune += treasure.passive.fortune
				// 收集联动：法宝解锁关联世界观词条（图鉴入库由下方统一完成）
				const unlocked = unlockArticlesByGot({treasureId: treasure.id})
				if (unlocked.length) pushLog(draft, `词条收录：「${unlocked.join('」「')}」`, 'event')
			}
		}
		if (effects.bond) gainBond(draft, effects.bond)
		// 魂灵种子：灵质空间内凝结，散灵时经 soul-legacy.js 折算魂灵跨局累积
		if (effects.soulSeed) draft.player.soulSeed = (draft.player.soulSeed || 0) + effects.soulSeed
		// 灵偶造物：消耗生灵/物质灵铸造随行灵偶（craftGolem 可为单 id 或 id 数组）
		let golemGain = null
		if (effects.craftGolem) {
			const ids = Array.isArray(effects.craftGolem) ? effects.craftGolem : [effects.craftGolem]
			for (const id of ids) {
				const done = craftGolem(draft.player, id)
				if (done.ok) {
					golemGain = golemGain || {names: [], passive: {}}
					golemGain.names.push(done.golem.name)
					golemGain.passive = {...golemGain.passive, ...done.reward.passive}
				} else {
					pushLog(draft, `铸造灵偶失败：${done.reason}`, 'event')
				}
			}
		}
		maybeBreakthrough(draft)
		// 聚灵修炼：灵质空间内借天时聚灵（ling 自动按当前天时获取；或直接增减 shengling/wuzhi）
		let lingGain = null
		if (effects.ling || effects.shengling || effects.wuzhi) {
			if (effects.ling) {
				lingGain = applyGatherLing(draft.player, weatherForFloor(draft.dungeon?.y))
			} else {
				draft.player.shengling = clamp((draft.player.shengling || 0) + (effects.shengling || 0), 0, 999)
				draft.player.wuzhi = clamp((draft.player.wuzhi || 0) + (effects.wuzhi || 0), 0, 999)
				lingGain = {gain: {shengling: effects.shengling || 0, wuzhi: effects.wuzhi || 0, element: null}}
			}
			const ready = checkTransform(draft.player)
			if (ready) {
				const done = performTransform(draft.player)
				if (done.ok) {
					pushLog(
						draft,
						`✨ 生灵与物质灵交织成形——化形为「${done.stage.name}」：${done.stage.rewardText}`,
						'event'
					)
				}
			}
		}
		// 灵质空间日志：记录探索选择与效果摘要
		const summary = [
			effects.cultivation ? `修为 ${effects.cultivation > 0 ? '+' : ''}${effects.cultivation}` : null,
			effects.daoHeart ? `道心 ${effects.daoHeart > 0 ? '+' : ''}${effects.daoHeart}` : null,
			effects.fortune ? `福缘 ${effects.fortune > 0 ? '+' : ''}${effects.fortune}` : null,
			effects.health ? `生命 ${effects.health > 0 ? '+' : ''}${effects.health}` : null,
			effects.maxHealth ? `生命上限 +${effects.maxHealth}` : null,
			effects.addCard ? `获得卡牌「${effects.addCard}」` : null,
			effects.treasure ? `获得法宝「${treasures[effects.treasure]?.name || effects.treasure}」` : null,
			effects.bond ? `结下羁绊「${bondById(effects.bond)?.name || effects.bond}」` : null,
			effects.soulSeed ? `魂灵种子 +${effects.soulSeed}` : null,
			golemGain ? `铸造灵偶「${golemGain.names.join('」「')}」` : null,
			lingGain ? `生灵 +${lingGain.gain.shengling} · 物质灵 +${lingGain.gain.wuzhi}（${transformStageInfo(draft.player).name} ${draft.player.shengling}/${draft.player.wuzhi}）` : null,
		]
			.filter(Boolean)
			.join(' · ')
		pushLog(
			draft,
			`【${space?.name || '灵质空间'}】选择「${space?.choices?.[side]?.text || side}」${summary ? `：${summary}` : ''}`,
			'event'
		)
	})

	// 收集图鉴：探索灵质空间即登记空间，及探索附带的卡牌 / 法宝 / 羁绊
	if (space?.name) markCollected('spaces', space.name)
	if (effects.addCard) markCollected('cards', effects.addCard)
	if (effects.treasure) markCollected('artifacts', effects.treasure)
	if (effects.bond) {
		const bond = bondById(effects.bond)
		if (bond) markCollected('bonds', bond.name)
	}
	// 概念词条·灵质空间洞悉：每次探索灵质空间，随机悟得一条尚未收集的世界法则词条
	const insight = unlockRandomConceptArticle()
	if (insight) pushLog(next, `灵识洞悉：悟得「${insight}」`, 'event')

	return next
}

// Boss 战利品法宝池：按稀有度过滤 treasures，排除玩家已持有的法宝。
// 区域守门 Boss（风息/那伽/老君等）稀有度 >=3；重生之门最终 Boss 稀有度 >=4。
// 池为空时回退到全部未持有法宝；全部持有则返回 null（不重复掉落）。
export function pickBossTreasure(state, {minRarity = 3} = {}) {
	const ownedIds = new Set((state?.player?.treasures || []).map((t) => t.id))
	const pool = Object.values(treasures).filter((t) => t.rarity >= minRarity && !ownedIds.has(t.id))
	const candidates = pool.length ? pool : Object.values(treasures).filter((t) => !ownedIds.has(t.id))
	if (!candidates.length) return null
	return candidates[Math.floor(Math.random() * candidates.length)]
}

// 战斗胜利结算：按怪物房难度发放金币（普通/精英/Boss 梯度 + 福缘加成），仅可领取一次；
// Boss 战胜利额外掉落一件专属法宝（守门 Boss 稀有度>=3，最终 Boss 稀有度>=4）。
// 在胜利 Overlay 中由玩家点击"收取战利品"触发（ui/app.js handleCollectBattleReward）。
function collectBattleReward(state) {
	const next = produce(state, (draft) => {
		const room = getCurrRoom(draft)
		if (!room || room.type !== 'monster' || room.rewardCollected) return
		const base = {easy: 14, normal: 22, elite: 38, boss: 60}[room.difficulty || 'normal']
		const fortuneBonus = (draft.player.fortune || 0) * 2
		const raw = base + fortuneBonus + Math.floor(Math.random() * 7)
		// 难度奖励倍率：试炼 x1.3 / 历练 x1.0 / 轮回 x0.75（至少保留 1 金币）
		const amount = Math.max(1, Math.round(raw * rewardMultiplier(draft.meta?.difficulty)))
		draft.player.gold = (draft.player.gold || 0) + amount
		room.rewardCollected = true
		room.goldReward = amount
		// Boss 战利品法宝（区域守门 Boss 优先专属掉落；最终 Boss 稀有度>=4 池；仅掉落一次）
		if (room.difficulty === 'boss' && !room.bossTreasureGiven) {
			const isFinalBoss = (draft.dungeon?.y || 0) >= 11
			const bossName = (room.monsters || [])[0]?.name
			const lootId = bossLootFor(bossName)
			const ownedIds = new Set((draft.player.treasures || []).map((t) => t.id))
			let treasure = lootId && !ownedIds.has(lootId) ? treasures[lootId] : null
			// 无专属掉落或已持有 → 回退通用 Boss 法宝池
			if (!treasure) treasure = pickBossTreasure(draft, {minRarity: isFinalBoss ? 4 : 3})
			if (treasure) {
				room.bossTreasureGiven = true
				room.bossTreasureId = treasure.id
				draft.player.treasures.push(treasure)
				if (treasure.passive?.fortune) draft.player.fortune += treasure.passive.fortune
				pushLog(draft, `Boss 战利品：获得法宝「${treasure.name}」`, 'reward')
			}
		}
		pushLog(draft, `战斗胜利：获得 ${amount} 金币${fortuneBonus ? `（含福缘加成 +${fortuneBonus}）` : ''}`, 'reward')
	})

	// 收集图鉴：战斗胜利登记敌人；Boss 战胜利同时登记对应角色（图鉴解锁）；Boss 战利品法宝入图鉴
	if (next.dungeon && next.dungeon.graph) {
		const room = getCurrRoom(next)
		if (room?.bossTreasureId) markCollected('artifacts', room.bossTreasureId)
		if (room?.rewardCollected && room.monsters?.length) {
			const names = room.monsters.map((m) => m.name).filter(Boolean)
			if (names.length) {
				markMany('enemies', names)
				if (room.difficulty === 'boss') markMany('characters', names)
			}
		}
	}

	return next
}

// 剧情回想结算：追忆剧集往事，获得道心/福缘/修为小奖励，并记录已看集数。
// 本局内再次回想起同一集（重历往事）奖励减半；奖励仅可领取一次。
function rewardStory(state) {
	const next = produce(state, (draft) => {
		const room = getCurrRoom(draft)
		if (!room || room.type !== 'story' || room.rewarded) return
		const num = room.episode?.num
		const used = draft.dungeon.usedEpisodeIds || []
		const alreadySeen = num != null && used.includes(num)
		const gains = alreadySeen
			? {daoHeart: 2, fortune: 2, cultivation: 4}
			: {daoHeart: 3, fortune: 3, cultivation: 8}
		room.rewarded = true
		room.reward = gains
		draft.player.daoHeart = clamp((draft.player.daoHeart || 0) + gains.daoHeart, 0, 999)
		draft.player.fortune = clamp((draft.player.fortune || 0) + gains.fortune, 0, 999)
		draft.player.cultivation = clamp((draft.player.cultivation || 0) + gains.cultivation, 0, 100)
		if (num != null) {
			if (!draft.dungeon.usedEpisodeIds) draft.dungeon.usedEpisodeIds = []
			if (!draft.dungeon.usedEpisodeIds.includes(num)) draft.dungeon.usedEpisodeIds.push(num)
		}
		maybeBreakthrough(draft)
		pushLog(
			draft,
			`【剧情回想】第 ${room.episode?.num || '?'} 集「${room.episode?.title || ''}」：道心 +${gains.daoHeart} · 福缘 +${gains.fortune} · 修为 +${gains.cultivation}${alreadySeen ? '（旧事重忆，所得减半）' : ''}`,
			'event'
		)
	})

	// 收集图鉴：剧情回想结算即登记剧集（与图鉴 stories 键一致：第 X 集 · 标题）
	if (next.dungeon && next.dungeon.graph) {
		const room = getCurrRoom(next)
		if (room?.rewarded && room.episode?.num != null) {
			markCollected('stories', `第 ${room.episode.num} 集 · ${room.episode.title}`)
		}
	}

	return next
}

// 灵偶铸造台：玩家主动消耗生灵/物质灵铸造灵偶（content/golem-craft.js craftGolem 内含全部校验）。
// 造物系·无中生有：以生灵塑形、以物质灵凝体；铸造后本局永久被动助战（与法宝/羁绊被动统一汇总）。
const FORGE_PASSIVE_LABELS = {
	atkBonus: (v) => `攻击 +${v}`,
	defBonus: (v) => `格挡 +${v}`,
	hpRegen: (v) => `每回合回复 ${v} 生命`,
	fortune: (v) => `福缘 +${v}`,
	maxHealth: (v) => `最大生命 +${v}`,
	daoHeart: (v) => `道心 +${v}`,
}
function forgeGolem(state, {golemId}) {
	return produce(state, (draft) => {
		const done = craftGolem(draft.player, golemId)
		if (!done.ok) {
			pushLog(draft, `【造物台】铸造失败：${done.reason}`, 'event')
			return
		}
		const passiveText = Object.entries(done.reward?.passive || {})
			.map(([k, v]) => (FORGE_PASSIVE_LABELS[k] ? FORGE_PASSIVE_LABELS[k](v) : `${k} +${v}`))
			.join(' · ')
		pushLog(draft, `【造物台】铸造「${done.golem.name}」：${passiveText}`, 'reward')
		if (done.golem?.name) markCollected('golems', done.golem.name)
	})
}

// 商店购买：购买卡牌 / 法宝 / 疗伤。校验金币足够且商品未售出；金币不足或重复购买直接忽略。
// 商品由 content/shop.js createShop() 生成，字段 kind: 'card' | 'treasure' | 'heal'。
function buyItem(state, {item}) {
	const next = produce(state, (draft) => {
		const room = getCurrRoom(draft)
		if (!room || room.type !== 'shop' || !room.shop) return
		const shopItem = room.shop.items.find((i) => i.id === item?.id)
		if (!shopItem || shopItem.sold) return
		if ((draft.player.gold || 0) < shopItem.price) return

		if (shopItem.kind === 'card') {
			let card
			try {
				card = createCard(shopItem.cardName)
			} catch (e) {
				console.warn('商店加卡失败，卡名不存在:', shopItem.cardName)
				return
			}
			if (!card) return
			draft.deck.push(card)
			// 收集联动：购买新卡解锁关联世界观词条（图鉴入库由 UI 层完成）
			const unlocked = unlockArticlesByGot({cardName: shopItem.cardName})
			if (unlocked.length) pushLog(draft, `词条收录：「${unlocked.join('」「')}」`, 'event')
		} else if (shopItem.kind === 'treasure') {
			const treasure = treasures[shopItem.treasureId]
			if (!treasure || draft.player.treasures.some((t) => t.id === treasure.id)) return
			draft.player.treasures.push(treasure)
			if (treasure.passive?.fortune) draft.player.fortune += treasure.passive.fortune
			// 收集联动：购买法宝解锁关联世界观词条（图鉴入库由 UI 层完成）
			const unlocked = unlockArticlesByGot({treasureId: treasure.id})
			if (unlocked.length) pushLog(draft, `词条收录：「${unlocked.join('」「')}」`, 'event')
		} else if (shopItem.kind === 'heal') {
			const healAmount = Math.floor(draft.player.maxHealth * (shopItem.ratio || 0.25))
			draft.player.currentHealth = clamp(draft.player.currentHealth + healAmount, 0, draft.player.maxHealth)
		} else {
			return
		}

		draft.player.gold -= shopItem.price
		shopItem.sold = true
		// 商店日志：记录购买内容
		const boughtText =
			shopItem.kind === 'card'
				? `购得卡牌「${shopItem.cardName}」`
				: shopItem.kind === 'treasure'
				? `购得法宝「${treasures[shopItem.treasureId]?.name || shopItem.treasureId}」`
				: `购得疗伤（回复 ${Math.floor(draft.player.maxHealth * (shopItem.ratio || 0.25))} 生命）`
		pushLog(draft, `【集市】${boughtText}：金币 -${shopItem.price}`, 'reward')
	})

	// 收集图鉴：商店成功购得卡牌 / 法宝即登记
	if (next.dungeon && next.dungeon.graph) {
		const room = getCurrRoom(next)
		const shopItem = room?.shop?.items?.find((i) => i.id === item?.id)
		if (shopItem?.sold) {
			if (shopItem.kind === 'card') markCollected('cards', shopItem.cardName)
			else if (shopItem.kind === 'treasure') markCollected('artifacts', shopItem.treasureId)
		}
	}

	return next
}

/**
 * Sets the health of all monsters in the dungeon to 1.
 * @param {State} state
 * @returns {State}
 */
function iddqd(state) {
	console.log('iddqd')
	return produce(state, (draft) => {
		draft.dungeon.graph.forEach((floor) => {
			floor.forEach((node) => {
				if (!node.room || !node.room.monsters) return
				node.room.monsters.forEach((monster) => {
					monster.currentHealth = 1
				})
			})
		})
	})
}

const allActions = {
	addCardToDeck,
	addCardToHand,
	addEnergyToPlayer,
	addHealth,
	addRegenEqualToAllDamage,
	addStarterDeck,
	applyCardPowers,
	createNewGame,
	dealDamageEqualToBlock,
	dealDamageEqualToVulnerable,
	dealDamageEqualToWeak,
	discardCard,
	discardHand,
	drawCards,
	endTurn,
	iddqd,
	makeCampfireChoice,
	makeEventChoice,
	makeSpiritChoice,
	collectBattleReward,
	rewardStory,
	buyItem,
	forgeGolem,
	move,
	playCard,
	removeCard,
	removeHealth,
	removePlayerDebuffs,
	reducePower,
	reshuffleAndDraw,
	setDungeon,
	setHealth,
	setPower,
	takeMonsterTurn,
	upgradeCard,
}

export default allActions
