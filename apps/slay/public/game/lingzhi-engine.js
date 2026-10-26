// 罗小黑战记·重生之门 —— 「灵质修行」独立战斗引擎
// 复用爬塔核心思路（回合制出牌/怪物意图/选路），但使用独立卡池/遗物池/角色/进度，
// 不依赖主游戏 actions.js 的五行共鸣/法宝/羁绊/修仙数值等系统。
import {produce} from '../web_modules/immer.js'
import {clamp, shuffle} from './utils.js'
import powers from './powers.js'
import {getTargets} from './utils-state.js'
import {
	lingzhiCharacters,
	lingzhiCards,
	lingzhiRelics,
} from '../content/lingzhi-xiuxing.js'
import {lingzhiArtifactRelics} from '../content/lingzhi-relics.js'
// 合并遗物池：既有 8 件 + 世界观法器灵物 15 件（奖励池/初始解锁/事件空间授予统一使用）
const ALL_LINGZHI_RELICS = [...lingzhiRelics, ...lingzhiArtifactRelics]
import {randomLingzhiEvent} from '../content/lingzhi-events.js'
import {randomLingzhiSpace} from '../content/lingzhi-spaces.js'
import {markCollected} from '../content/collection-progress.js'
import {
	lingzhiMonstersForFloor,
	lingzhiBossDef,
} from '../content/lingzhi-monsters.js'
import {
	guildById,
	randomGuildId,
} from '../content/guild-branches.js'
import {todayDaily} from '../content/daily.js'
import {
	lingzhiFactionById,
	randomLingzhiFaction,
} from '../content/lingzhi-factions.js'

// ============ 卡牌实例 ============
let cardSeq = 1
export class LingzhiCard {
	constructor(pojo) {
		Object.assign(this, pojo)
		this.id = `lxz-${cardSeq++}`
	}
}

export function createLingzhiCard(cardId) {
	const pojo = lingzhiCards.find((c) => c.cardId === cardId)
	if (!pojo) throw new Error(`未找到灵术卡: ${cardId}`)
	return new LingzhiCard(pojo)
}

export function createLingzhiCardByName(name) {
	const pojo = lingzhiCards.find((c) => c.name === name)
	if (!pojo) throw new Error(`未找到灵术卡: ${name}`)
	return new LingzhiCard(pojo)
}

// ============ 地图生成 ============
// 灵质回路：7 层（起点 → 5 层中段 → 守门 Boss），宽 3 的选路图。
// 节点类型：start / M（战斗）/ C（休整，回血+可删牌）/ boss（守门）
function buildLingzhiDungeon() {
	const height = 7
	const width = 3
	const graph = []
	for (let y = 0; y < height; y++) {
		const row = []
		// 起点层与守门层均为单节点（守门 Boss 只允许一条路线抵达，避免空房间节点）
		const xCount = y === 0 || y === height - 1 ? 1 : width
		for (let x = 0; x < xCount; x++) {
			const isStart = y === 0
			const isBoss = y === height - 1
			const type = isStart ? 'start' : isBoss ? 'boss' : null
			row.push({
				id: `${y}-${x}`,
				x,
				y,
				type,
				didVisit: isStart,
				edges: new Set(),
				room: null,
			})
		}
		graph.push(row)
	}
	// 连线：除守门层外，每节点连向下一行所有节点（玩家可自由选路）
	for (let y = 0; y < height - 1; y++) {
		for (const node of graph[y]) {
			graph[y + 1].forEach((next) => node.edges.add(next.id))
		}
	}
	// 房间填充：中段 5 层每行 3 个可选节点，随机 战斗/休整/事件
	const usedEventIds = []
	const usedSpaceIds = []
	for (let y = 1; y < height - 1; y++) {
		// 精英层（Boss 前一层，y=height-2）：1 精英战斗 + 1 休整 + 1 事件；
		// 其余楼层：1 普通战斗 + 1 休整 + 1 事件，保证选路多样性与 Boss 前考验
		const isEliteFloor = y === height - 2
		let types = isEliteFloor ? ['elite', 'C', 'E'] : ['M', 'C', 'E']
		// 灵质空间节点（S）：普通层有 45% 概率将事件替换为「灵质空间」探索，
		//   按楼层映射境界（realm）：第 2-3 层炼气、第 4 层筑基、第 5 层金丹
		if (!isEliteFloor && Math.random() < 0.45) {
			const ei = types.indexOf('E')
			types[ei] = 'S'
		}
		const rowTypes = shuffle([...types])
		graph[y].forEach((node, x) => {
			node.type = rowTypes[x]
			if (node.type === 'M' || node.type === 'elite') {
				node.room = makeMonsterRoom(monsterForFloor(y))
			} else if (node.type === 'E') {
				node.room = makeEventRoom(usedEventIds)
			} else if (node.type === 'S') {
				node.room = makeSpaceRoom(spaceRealmForFloor(y), usedSpaceIds)
			} else {
				node.room = makeCampfireRoom()
			}
		})
	}
	// 守门 Boss 单对象需包成数组（makeMonsterRoom 内部按 monsters[] 处理）
	graph[height - 1][0].room = makeMonsterRoom([bossDef()])
	graph[0][0].room = {type: 'start'}
	return {graph, x: 0, y: 0, pathTaken: [], width, height}
}

// ============ 敌人 ============
// 敌人数据来自 content/lingzhi-monsters.js（世界观化试炼敌人池）：
//   初段（楼层 1-2）/ 中段（楼层 3-4）/ 精英（楼层 5）/ 守门 Boss，
//   每类敌人带 desc（遭遇描写）与 source（世界观数据库出处）。
// 保留原战斗模型：name/maxHealth/currentHealth/block/powers/intents/element/difficulty
function makeMonster(def) {
	return {
		name: def.name,
		portrait: def.portrait || '',
		desc: def.desc || '',
		source: def.source || '',
		maxHealth: def.maxHealth,
		currentHealth: def.maxHealth,
		block: 0,
		powers: {},
		intents: def.intents,
		nextIntent: 0,
		element: def.element || '通用',
		difficulty: def.difficulty || 'normal',
		// 守门 Boss 二阶段（重生觉醒）：阶段切换状态
		bossPhase: 1,
		phase2Threshold: def.phase2Threshold,
		phase2Name: def.phase2Name,
		phase2Intents: def.phase2Intents,
	}
}

function monsterForFloor(y) {
	return lingzhiMonstersForFloor(y).map(makeMonster)
}

function bossDef() {
	return makeMonster(lingzhiBossDef())
}

function makeMonsterRoom(monsters) {
	return {type: 'monster', monsters, difficulty: monsters[0]?.difficulty || 'normal', rewardCollected: false}
}

function makeCampfireRoom() {
	return {type: 'campfire', choiceMade: false}
}

// 灵质事件房间：随机抽取一条世界观设定事件（content/lingzhi-events.js），同一局内尽量不重复
function makeEventRoom(excludeIds = []) {
	const ev = randomLingzhiEvent(excludeIds)
	excludeIds.push(ev.id)
	return {type: 'event', event: ev, resolved: false}
}

// 灵质空间境界映射：灵质修行地图 7 层（起始 0 / 中段 1-5 / 守门 6），
//   对应主世界观境界 炼气(0) → 筑基(1) → 金丹(2) → 元婴(3) → 化神(4)
function spaceRealmForFloor(y) {
	if (y <= 2) return 0
	if (y === 3) return 1
	if (y === 4) return 2
	return 3
}

// 灵质空间房间：随机抽取一个世界观灵质空间（content/lingzhi-spaces.js），同局不重复；
//   若该境界无可选空间（极小概率）则回退为休整节点
function makeSpaceRoom(realmIndex, excludeIds = []) {
	const sp = randomLingzhiSpace(realmIndex, excludeIds)
	if (!sp) return makeCampfireRoom()
	excludeIds.push(sp.id)
	return {type: 'space', space: sp, resolved: false}
}

// ============ 房间工具 ============
export function getCurrRoom(state) {
	if (!state?.dungeon?.graph) return null
	const row = state.dungeon.graph[state.dungeon.y]
	if (!row) return null
	const node = row[state.dungeon.x]
	return node && node.room
}

export function isCurrRoomCompleted(state) {
	const room = getCurrRoom(state)
	if (!room) return false
	if (room.type === 'monster') {
		return (room.monsters || []).every((m) => m.currentHealth < 1)
	}
	return true
}

export function isDungeonCompleted(state) {
	if (!state?.dungeon?.graph) return false
	const lastRow = state.dungeon.graph[state.dungeon.graph.length - 1]
	return lastRow.some((node) => node.didVisit && node.room?.type === 'monster' && node.room.monsters.every((m) => m.currentHealth < 1))
}

// ============ 战斗奖励池 ============
// 战利品随机池 = 已解锁的灵术卡 + 已解锁遗物（未解锁不出现）
export function getLingzhiCardRewards(amount, unlockedCardIds, excludeNames = []) {
	const unlocked = lingzhiCards.filter((c) => unlockedCardIds.includes(c.cardId))
	let pool = unlocked.filter((c) => !excludeNames.includes(c.name))
	// 防御：排除卡组已有卡后若池为空（如默认解锁池与起始卡组完全重合），回退为不过滤，
	// 保证战利品弹窗始终有可选卡，避免空池死锁
	if (!pool.length) pool = unlocked
	// 仍不足 amount 时：从全部灵术卡池兜底补足（去重），保证奖励数量足够
	if (pool.length < amount) {
		const extra = lingzhiCards.filter((c) => !pool.includes(c))
		pool = [...pool, ...extra]
	}
	return shuffle(pool).slice(0, amount).map((c) => createLingzhiCard(c.cardId))
}

export function getLingzhiRelicRewards(amount, unlockedRelicIds) {
	const pool = ALL_LINGZHI_RELICS.filter((r) => unlockedRelicIds.includes(r.id))
	return shuffle(pool).slice(0, amount)
}

// ============ 战斗/回合工具 ============
const RELIC_ATTACK_BONUS = (state) =>
	(state.player.relics || []).reduce((s, r) => s + (r.effect?.attackBonus || 0), 0)
const RELIC_LING_ATTACK_BONUS = (state) =>
	(state.player.relics || []).reduce((s, r) => s + (r.effect?.lingAttackBonus || 0), 0)
const hasRelic = (state, key) =>
	(state.player.relics || []).some((r) => r.effect && r.effect[key])

// 灵术卡伤害计算：基础 + 遗物加成（绘具袋/灵潮 全攻击 +1、灵契 名含「灵」+1）+ 力量
function calcDamage(state, card, base) {
	let amount = base
	amount += RELIC_ATTACK_BONUS(state)
	if (card.name.includes('灵')) amount += RELIC_LING_ATTACK_BONUS(state)
	amount += state.player.powers.strength || 0
	if (state.player.powers.weak) amount = powers.weak.use(amount)
	return amount
}

function removeHealth(state, {target, amount}) {
	return produce(state, (draft) => {
		getTargets(draft, target).forEach((t) => {
			let dmg = amount
			if (t.powers && t.powers.vulnerable) dmg = powers.vulnerable.use(dmg)
			const afterBlock = t.block - dmg
			if (afterBlock < 0) {
				t.block = 0
				t.currentHealth = clamp(t.currentHealth + afterBlock, 0, t.maxHealth)
			} else {
				t.block = afterBlock
			}
		})
	})
}

function addHealth(state, {target, amount}) {
	return produce(state, (draft) => {
		getTargets(draft, target).forEach((t) => {
			t.currentHealth = clamp(t.currentHealth + amount, 0, t.maxHealth)
		})
	})
}

function pushLog(state, text, kind = 'info') {
	return produce(state, (draft) => {
		if (!draft.log) draft.log = []
		draft.log.push({turn: draft.turn || 1, text, kind})
		if (draft.log.length > 60) draft.log = draft.log.slice(-60)
	})
}

// 存活敌人（首个）
function firstAliveEnemy(state) {
	const room = getCurrRoom(state)
	if (!room?.monsters) return null
	return room.monsters.find((m) => m.currentHealth > 0)
}

// 单体目标若已阵亡，自动切换到当前首个存活敌人（多怪战斗防"鞭尸"：
//   getTargets('enemy0') 固定取 monsters[0]，首个怪死后后续伤害会全部浪费在尸体上）
function resolveAliveTarget(state, target) {
	if (target === 'allEnemies') return target
	let query = target
	if (!query || query === 'enemy') query = 'enemy0'
	const t = getTargets(state, query)
	if (t.length && t[0].currentHealth > 0) return query
	const alive = firstAliveEnemy(state)
	if (!alive) return query
	const room = state.dungeon.graph[state.dungeon.y][state.dungeon.x].room
	return 'enemy' + room.monsters.indexOf(alive)
}

// ============ 对局初始化 ============
// unlockedCards: 已解锁灵术卡 cardId 数组；unlockedRelics: 已解锁遗物 id 数组
// guildId: 出身分馆（妖灵会馆七大分馆之一）；缺省随机出身。
//   馆训被动映射到灵质修行战斗体系（与主游戏 actions.js 的出生体系同源）：
//     maxHealth → 开局最大生命 +N（龙游）
//     daoHeart  → 道心护体，每点折算 1 点最大生命（苍南 +5 / 粤东 +3）
//     atkBonus  → 每场战斗开始 +N 力量（流石）
//     defBonus  → 每场战斗开始 +2N 格挡（洞桥）
//     hpRegen   → 每场战斗开始回复 2N 生命（寒木）
//     fortune   → 福缘深厚，每场战斗多抽 N 张牌（灵溪）
// factionId: 势力缘起（执行者/离岛/地界·酆都/北域，content/lingzhi-factions.js）；缺省随机出身。
//   势力被动映射到灵质修行战斗体系（与出身分馆、今日灵机叠加生效）：
//     strength  → 每场战斗开始 +N 力量（离岛/执行者/北域）
//     block     → 每场战斗开始 +N 格挡（执行者/地界）
//     heal      → 每场战斗开始回复 N 生命（地界）
//     drawExtra → 每场战斗多抽 N 张牌（北域）
export function createLingzhiGame({characterId, unlockedCards = [], unlockedRelics = [], guildId, factionId}) {
	const char = lingzhiCharacters.find((c) => c.id === characterId) || lingzhiCharacters[0]
	const deck = char.starterCards.map((name) => createLingzhiCardByName(name))
	const relics = ALL_LINGZHI_RELICS.filter((r) => unlockedRelics.includes(r.id))
	const guildName = guildId && guildById(guildId) ? guildId : randomGuildId()
	const guild = guildById(guildName)
	const guildHpBonus = (guild?.passive?.maxHealth || 0) + (guild?.passive?.daoHeart || 0)
	// 势力缘起：指定或随机立场（与出身分馆并行，开战被动叠加）
	const faction = (factionId && lingzhiFactionById(factionId)) || randomLingzhiFaction()
	// 今日灵机（每日轮回祝福）：与主游戏同源（content/daily.js），按现实日期确定性生成；
	// 灵质修行顺天应时，当日灵机提供一层小型开战被动（startBattle 应用），并提升开局最大生命。
	const daily = todayDaily()
	const dailyMaxHp = daily.blessing?.passive?.maxHealth || 0
	const maxHealth = 72 + guildHpBonus + dailyMaxHp
	const state = {
		turn: 1,
		deck,
		drawPile: [],
		hand: [],
		discardPile: [],
		exilePile: [],
		player: {
			maxEnergy: 3,
			currentEnergy: 3,
			maxHealth,
			currentHealth: maxHealth,
			block: 0,
			powers: {},
			characterId: char.id,
			characterName: char.name,
			guild: guildName,
			guildName: guild?.name || '',
			faction: faction.id,
			factionName: faction.name,
			factionLeader: faction.leader,
			relics,
			comboAttack: 0,
			heartTideStacks: 0,
			cardsPlayedThisTurn: 0,
		},
		daily: {
			date: daily.dateStr,
			element: daily.element?.element || null,
			elementName: daily.element?.name || null,
			elementFlavor: daily.element?.flavor || null,
			blessingId: daily.blessing?.id || null,
			blessingName: daily.blessing?.name || null,
			blessingDesc: daily.blessing?.desc || null,
			passive: daily.blessing?.passive || {},
		},
		dungeon: buildLingzhiDungeon(),
		log: [],
		fightTurnCount: 0,
		maxTurnsInRun: 0,
		runStartedAt: Date.now(),
	}
	// 起始抽牌堆
	state.drawPile = shuffle([...deck])
	// 出身分馆馆训日志
	if (guild) {
		state.log.push({
			turn: 0,
			text: `出身「${guild.name}」——${guild.title}${guildHpBonus ? `：最大生命 +${guildHpBonus}` : ''}`,
			kind: 'info',
		})
	}
	// 势力缘起日志
	state.log.push({
		turn: 0,
		text: `势力缘起 · ${faction.name}（${faction.leader}）：${faction.passiveDesc}`,
		kind: 'faction',
	})
	// 今日灵机日志（顺天应时，修行得一日之佑）
	if (daily.blessing?.name) {
		state.log.push({
			turn: 0,
			text: `今日灵机 · ${daily.element?.name || ''}：「${daily.blessing.name}」${dailyMaxHp ? `，最大生命 +${dailyMaxHp}` : ''}`,
			kind: 'daily',
		})
	}
	// 第一场战斗（起点不算战斗，首场在第一次 move 后触发）——不在此初始化被动
	return state
}

// 今日灵机 → 每场战斗开始时的开战增益（与馆训叠加，封顶避免过强）
//   atkBonus  → 每场战斗开始 +N 力量
//   defBonus  → 每场战斗开始 +2N 格挡
//   hpRegen   → 每场战斗开始回复 2N 生命
//   fortune   → 每场战斗多抽 N 张牌（封顶 2 张）
//   daoHeart  → 灵觉通明，每场战斗多抽 1 张牌
export function dailyBattleBonus(daily = {}) {
	const passive = daily.passive || {}
	return {
		strength: passive.atkBonus || 0,
		block: (passive.defBonus || 0) * 2,
		heal: (passive.hpRegen || 0) * 2,
		drawExtra: Math.min(passive.fortune || 0, 2) + (passive.daoHeart ? 1 : 0),
	}
}

// 馆训被动 → 每场战斗开始时的开战增益
function guildBattleBonus(player) {
	const guild = guildById(player.guild)
	const passive = guild?.passive || {}
	return {
		strength: passive.atkBonus || 0,
		block: (passive.defBonus || 0) * 2,
		heal: (passive.hpRegen || 0) * 2,
		drawExtra: passive.fortune || 0,
	}
}

// 势力缘起被动 → 每场战斗开始时的开战增益（与馆训/灵机叠加）
function factionBattleBonus(player) {
	const faction = lingzhiFactionById(player.faction)
	const passive = faction?.passive || {}
	return {
		strength: passive.strength || 0,
		block: passive.block || 0,
		heal: passive.heal || 0,
		drawExtra: passive.drawExtra || 0,
	}
}

// 战斗开始：应用角色被动 + 遗物开战被动 + 抽牌
function startBattle(state) {
	let next = produce(state, (draft) => {
		draft.player.powers = {}
		draft.player.comboAttack = 0
		draft.player.heartTideStacks = 0
		draft.player.cardsPlayedThisTurn = 0
		draft.fightTurnCount = 1
		draft.maxTurnsInRun = Math.max(draft.maxTurnsInRun || 0, 1)
		// 角色被动
		const char = lingzhiCharacters.find((c) => c.id === draft.player.characterId)
		if (char?.passive) {
			if (char.passive.strength) draft.player.powers.strength = (draft.player.powers.strength || 0) + char.passive.strength
			if (char.passive.regen) draft.player.powers.regen = (draft.player.powers.regen || 0) + char.passive.regen
		}
		// 遗物开战被动
		;(draft.player.relics || []).forEach((r) => {
			if (r.effect?.startStrength) draft.player.powers.strength = (draft.player.powers.strength || 0) + r.effect.startStrength
		})
		// 出身分馆馆训：每场战斗开始时生效（流石力量 / 洞桥格挡 / 寒木回血）
		const guildBonus = guildBattleBonus(draft.player)
		if (guildBonus.strength) draft.player.powers.strength = (draft.player.powers.strength || 0) + guildBonus.strength
		if (guildBonus.block) draft.player.block = (draft.player.block || 0) + guildBonus.block
		if (guildBonus.heal) draft.player.currentHealth = Math.min(draft.player.maxHealth, (draft.player.currentHealth || 0) + guildBonus.heal)
		// 势力缘起：阵营立场被动（执行者执法之势 / 离岛夺还之志 / 地界魂灵滋养 / 北域灵主渗透）
		const factionBonus = factionBattleBonus(draft.player)
		if (factionBonus.strength) draft.player.powers.strength = (draft.player.powers.strength || 0) + factionBonus.strength
		if (factionBonus.block) draft.player.block = (draft.player.block || 0) + factionBonus.block
		if (factionBonus.heal) draft.player.currentHealth = Math.min(draft.player.maxHealth, (draft.player.currentHealth || 0) + factionBonus.heal)
		// 今日灵机：顺天应时，当日灵机每场战斗开局加成（与馆训叠加）
		const dailyBonus = dailyBattleBonus(draft.daily)
		if (dailyBonus.strength) draft.player.powers.strength = (draft.player.powers.strength || 0) + dailyBonus.strength
		if (dailyBonus.block) draft.player.block = (draft.player.block || 0) + dailyBonus.block
		if (dailyBonus.heal) draft.player.currentHealth = Math.min(draft.player.maxHealth, (draft.player.currentHealth || 0) + dailyBonus.heal)
	})
	// 界锚：每回合开始时获得 2 点格挡（含战斗首回合）
	if (hasRelic(next, 'startBlock')) {
		next = produce(next, (draft) => {
			draft.player.block = (draft.player.block || 0) + 2
		})
	}
	// 抽牌：默认 5 张 + 绘灵师/灵镜额外抽牌 + 出身分馆福缘加成（灵溪）
	let drawAmount = 5
	const char = lingzhiCharacters.find((c) => c.id === next.player.characterId)
	if (char?.passive?.drawExtra) drawAmount += char.passive.drawExtra
	next.player.relics.forEach((r) => {
		if (r.effect?.startDraw) drawAmount += r.effect.startDraw
	})
	drawAmount += guildBattleBonus(next.player).drawExtra
	drawAmount += factionBattleBonus(next.player).drawExtra
	drawAmount += dailyBattleBonus(next.daily).drawExtra
	next = drawCardsAmount(next, drawAmount)
	// 战斗日志
	next = pushLog(next, `战斗开始，你选择了「${next.player.characterName}」。`, 'info')
	return next
}

function drawCardsAmount(state, amount) {
	return produce(state, (draft) => {
		if (draft.drawPile.length < amount) {
			draft.drawPile = draft.drawPile.concat(draft.discardPile)
			draft.drawPile = shuffle(draft.drawPile)
			draft.discardPile = []
		}
		const newCards = draft.drawPile.slice(0, amount)
		draft.hand = draft.hand.concat(newCards)
		for (let i = 0; i < amount; i++) draft.drawPile.shift()
	})
}

// ============ 动作实现 ============
// 心棱镜：每回合首张【读绪】【定绪】【心印】等标签牌消耗 0
const HEART_FREE_TAGS = ['读绪', '定绪', '心印']
function playCard(state, {card, target}) {
	if (!card) throw new Error('No card to play')
	if (!target) target = card.target
	let energyCost = card.energy || 0
	if (
		hasRelic(state, 'firstCardFree') &&
		state.player.cardsPlayedThisTurn === 0 &&
		energyCost > 0 &&
		(card.tags || []).some((t) => HEART_FREE_TAGS.includes(t))
	) {
		energyCost = 0
	}
	if (state.player.currentEnergy < energyCost) throw new Error('Not enough energy to play card')

	// 移出手牌
	let next = produce(state, (draft) => {
		draft.hand = draft.hand.filter((c) => c.id !== card.id)
		draft.player.currentEnergy -= energyCost
		draft.player.cardsPlayedThisTurn += 1
		if (card.exhaust) {
			draft.exilePile.push(card)
		} else {
			draft.discardPile.push(card)
		}
		// 攻击牌计数（连击/绘涌联动）
		if (card.type === 'attack' || card.damage) {
			draft.player.comboAttack = (draft.player.comboAttack || 0) + 1
		}
	})

	// 格挡
	if (card.block) {
		next = produce(next, (draft) => {
			draft.player.block = (draft.player.block || 0) + card.block
		})
		next = pushLog(next, `打出「${card.name}」：格挡 +${card.block}`, 'def')
	}

	// 直接伤害（attack/damage 字段）
	if (card.type === 'attack' || card.damage) {
		const newTarget = resolveAliveTarget(next, card.target === 'allEnemies' ? card.target : target)
		const amount = calcDamage(next, card, card.damage)
		next = removeHealth(next, {target: newTarget, amount})
		next = pushLog(next, `打出「${card.name}」造成 ${amount} 点伤害`, 'dmg')
	}

	// 卡牌专属动作
	if (card.actions) {
		next = useLingzhiActions(next, {target, card})
	}
	return next
}

function useLingzhiActions(state, {target, card}) {
	if (!card.actions) return state
	let next = state
	card.actions.forEach((action) => {
		next = allActions[action.type](next, {...action, target, card})
	})
	return next
}

// —— 灵术卡专属动作 ——
// 连击/绘涌：本战每使用过 1 张攻击牌 + per 伤
const lingzhiCombo = (state, {base, per, target, card}) => {
	const combo = state.player.comboAttack > 0 ? state.player.comboAttack - 1 : 0 // 本次打出不重复计数
	const extra = combo * per
	const amount = calcDamage(state, card, extra)
	let next = state
	if (amount > 0) {
		next = removeHealth(next, {target: resolveAliveTarget(next, target === 'allEnemies' ? 'allEnemies' : target), amount})
		next = pushLog(next, `「${card.name}」连击加成 +${extra}（已用攻击牌 ${combo}）`, 'dmg')
	}
	return next
}

// 灵脉：抽 1 张牌（AOE 伤害由 damage 字段处理）
const drawCardsAction = (state, {amount}) => drawCardsAmount(state, amount)

// 盾涌：获得 14 点格挡（block 字段处理）；格挡超过 12 的部分转伤
const lingzhiShieldSurge = (state, {cap, card}) => {
	const overflow = Math.max(0, (card.block || 0) - (cap || 12))
	if (overflow < 1) return state
	const enemy = firstAliveEnemy(state)
	if (!enemy) return state
	const amount = overflow + (state.player.powers.strength || 0)
	let next = removeHealth(state, {target: 'enemy0', amount})
	next = pushLog(next, `「${card.name}」溢出格挡转伤：对${enemy.name}造成 ${amount} 点伤害`, 'dmg')
	return next
}

// 藤击：对目标施加虚弱（weak）层数，回合结束递减 1 层
const lingzhiWeak = (state, {amount, target, card}) => {
	const targetQuery = target && target.includes('enemy') ? target : 'enemy0'
	if (!getTargets(state, targetQuery).length) return state
	const stacks = amount || 1
	let next = produce(state, (draft) => {
		getTargets(draft, targetQuery).forEach((enemy) => {
			if (!enemy.powers) enemy.powers = {}
			enemy.powers.weak = (enemy.powers.weak || 0) + stacks
		})
	})
	next = pushLog(next, `「${card?.name || '灵术'}」对敌人施加虚弱 ${stacks} 层`, 'debuff')
	return next
}

// 心潮：能力牌，每次行动开始时本牌伤害 +1（每打出一次叠 1 层）
const lingzhiHeartTide = (state, {base, target, card}) => {
	const stacks = (state.player.heartTideStacks || 0) + 1
	const amount = calcDamage(state, card, base + stacks)
	let next = produce(state, (draft) => {
		draft.player.heartTideStacks = stacks
	})
	next = removeHealth(next, {target: target === 'allEnemies' ? 'allEnemies' : target, amount})
	next = pushLog(next, `「${card.name}」心潮涌起（第 ${stacks} 层）：造成 ${amount} 点伤害`, 'dmg')
	return next
}

// 灵群：对所有敌人造成 2 点伤害（damage 字段处理）；卡组中每张【灵斩】【唤灵】【灵爆】等 +1 伤
const lingzhiSwarm = (state, {base, card}) => {
	const count = (state.deck || []).filter((c) => c.name.includes('灵') && (c.type === 'attack' || c.damage)).length
	if (count < 1) return state
	const enemy = firstAliveEnemy(state)
	if (!enemy) return state
	const amount = calcDamage(state, card, count)
	let next = removeHealth(state, {target: 'allEnemies', amount})
	next = pushLog(next, `「${card.name}」灵群共鸣（卡组 ${count} 张灵术牌）：全体 +${count} 伤`, 'dmg')
	return next
}

// 怪物回合
function playMonsterActions(state) {
	const room = getCurrRoom(state)
	if (!room?.monsters) return state
	let next = state
	room.monsters.forEach((monster, index) => {
		next = takeMonsterTurn(next, index)
	})
	return next
}

function takeMonsterTurn(state, monsterIndex) {
	return produce(state, (draft) => {
		const room = getCurrRoom(draft)
		const monster = room.monsters[monsterIndex]
		// —— 守门 Boss 二阶段「重生觉醒」：血量降至阈值时触发一次 ——
		if (
			monster.difficulty === 'boss' &&
			monster.bossPhase === 1 &&
			monster.currentHealth > 0 &&
			monster.currentHealth <= Math.ceil(monster.maxHealth * (monster.phase2Threshold || 0.4))
		) {
			monster.bossPhase = 2
			monster.powers.strength = (monster.powers.strength || 0) + 3
			monster.block += 10
			monster.intents = monster.phase2Intents || monster.intents
			monster.nextIntent = 0
			draft.log.push({turn: draft.turn, text: `「${monster.name}」的意识猛然觉醒——「重生之门」在此刻轰然敞开！`, kind: 'boss'})
			draft.log.push({turn: draft.turn, text: `「${monster.phase2Name || monster.name}」获得力量 +3、格挡 +10`, kind: 'info'})
			// 觉醒回合为蓄势回合：不执行旧意图
			return
		}
		monster.block = 0
		if (monster.currentHealth < 1) return
		// 回灵
		if (monster.powers.monsterRegen) {
			monster.currentHealth = clamp(monster.currentHealth + monster.powers.monsterRegen, 0, monster.maxHealth)
		}
		const intent = monster.intents[monster.nextIntent || 0]
		if (!intent) return
		if (monster.nextIntent === monster.intents.length - 1) monster.nextIntent = 0
		else monster.nextIntent++

		if (intent.block) {
			monster.block += intent.block
			draft.log.push({turn: draft.turn, text: `「${monster.name}」蓄力防御：格挡 +${intent.block}`, kind: 'def'})
		}
		if (intent.strength) {
			monster.powers.strength = (monster.powers.strength || 0) + intent.strength
			draft.log.push({turn: draft.turn, text: `「${monster.name}」汇聚力量：攻击 +${intent.strength}`, kind: 'info'})
		}
		if (intent.damage) {
			let amount = intent.damage + (monster.powers.strength || 0)
			if (monster.powers.weak) amount = powers.weak.use(amount)
			const updated = removeHealth(draft, {target: 'player', amount})
			draft.player.block = updated.player.block
			draft.player.currentHealth = updated.player.currentHealth
			draft.log.push({turn: draft.turn, text: `「${monster.name}」对你造成 ${amount} 点伤害`, kind: 'dmg'})
		}
		if (intent.vulnerable) {
			draft.player.powers.vulnerable = (draft.player.powers.vulnerable || 0) + intent.vulnerable + 1
			draft.log.push({turn: draft.turn, text: `「${monster.name}」使你易伤 +${intent.vulnerable}`, kind: 'debuff'})
		}
		if (intent.weak) {
			draft.player.powers.weak = (draft.player.powers.weak || 0) + intent.weak + 1
			draft.log.push({turn: draft.turn, text: `「${monster.name}」使你虚弱 +${intent.weak}`, kind: 'debuff'})
		}
	})
}

function endTurn(state) {
	const room = getCurrRoom(state)
	const isBattle = room?.type === 'monster'
	// 弃手牌
	let next = produce(state, (draft) => {
		draft.hand.forEach((card) => draft.discardPile.push(card))
		draft.hand = []
	})
	// 回灵（生息师被动/回灵力量）
	if (next.player.powers.regen) {
		const amount = powers.regen.use(next.player.powers.regen)
		next = addHealth(next, {target: 'player', amount})
	}
	// 坝心片：回合结束格挡≥14 时，溢出格挡转伤
	if (hasRelic(next, 'overflowDamage') && next.player.block >= 14) {
		const overflow = next.player.block - 14
		const enemy = firstAliveEnemy(next)
		if (enemy) {
			next = removeHealth(next, {target: 'enemy0', amount: overflow})
			next = pushLog(next, `「坝心片」溢出格挡转伤：对${enemy.name}造成 ${overflow} 点伤害`, 'dmg')
		}
	}
	// 怪物行动
	next = playMonsterActions(next)
	// 能力递减（力量/回灵持久）
	next = produce(next, (draft) => {
		Object.entries(draft.player.powers).forEach(([name, stacks]) => {
			if (stacks > 0 && !['strength', 'regen'].includes(name)) draft.player.powers[name] = stacks - 1
		})
		draft.dungeon.graph[draft.dungeon.y][draft.dungeon.x].room.monsters?.forEach((monster) => {
			Object.entries(monster.powers).forEach(([name, stacks]) => {
				if (stacks > 0 && !['strength', 'monsterRegen'].includes(name)) monster.powers[name] = stacks - 1
			})
		})
		// 新回合
		draft.turn += 1
		draft.player.currentEnergy = 3
		draft.player.block = 0
		if (hasRelic(draft, 'startBlock')) draft.player.block = (draft.player.block || 0) + 2
		draft.player.cardsPlayedThisTurn = 0
		if (isBattle) {
			draft.fightTurnCount = (draft.fightTurnCount || 0) + 1
			draft.maxTurnsInRun = Math.max(draft.maxTurnsInRun || 0, draft.fightTurnCount)
		}
	})
	// 抽牌
	next = drawCardsAmount(next, 5)
	// 战斗日志长度截断
	next = produce(next, (draft) => {
		if (draft.log.length > 60) draft.log = draft.log.slice(-60)
	})
	return next
}

function move(state, {move}) {
	// 洗牌重抽 + 清理状态
	let next = produce(state, (draft) => {
		draft.hand = []
		draft.discardPile = []
		draft.drawPile = shuffle(draft.deck)
	})
	next = produce(next, (draft) => {
		draft.player.powers = {}
		draft.player.currentEnergy = 3
		draft.player.block = 0
		draft.player.cardsPlayedThisTurn = 0
		draft.dungeon.graph[move.y][move.x].didVisit = true
		draft.dungeon.pathTaken.push({x: move.x, y: move.y})
		draft.dungeon.x = move.x
		draft.dungeon.y = move.y
	})
	// 进入战斗房间 → 触发战斗开始被动并抽牌；非战斗房间（休整等）直接抽 5
	if (getCurrRoom(next)?.type === 'monster') {
		next = startBattle(next)
	} else {
		next = drawCardsAmount(next, 5)
	}
	return next
}

// 篝火：休整（回血 30%）/ 移除卡牌
function campfireRest(state) {
	let next = addHealth(state, {target: 'player', amount: Math.floor(state.player.maxHealth * 0.3)})
	next = produce(next, (draft) => {
		draft.dungeon.graph[draft.dungeon.y][draft.dungeon.x].room.choiceMade = true
	})
	return next
}

function campfireRemoveCard(state, {card}) {
	return produce(state, (draft) => {
		draft.deck = draft.deck.filter((c) => c.id !== card.id)
		draft.discardPile = draft.discardPile.filter((c) => c.id !== card.id)
		draft.dungeon.graph[draft.dungeon.y][draft.dungeon.x].room.choiceMade = true
	})
}

// 添加卡牌到卡组（战斗奖励选卡）
function addCardToDeck(state, {card}) {
	return produce(state, (draft) => {
		draft.deck.push(card)
	})
}

function addRelicToPlayer(state, {relic}) {
	return produce(state, (draft) => {
		draft.player.relics.push(relic)
	})
}

// 灵质事件：选择一个选项，应用生命/上限/卡牌/遗物效果；收益记入 room.reward 由 UI 结算
function resolveEvent(state, {choiceIndex}) {
	return produce(state, (draft) => {
		const room = getCurrRoom(draft)
		if (!room || room.type !== 'event' || room.resolved) return
		const event = room.event
		const choice = event.options[choiceIndex]
		if (!choice) return
		const eff = choice.effect
		const p = draft.player
		if (eff.type === 'heal') {
			p.currentHealth = Math.min(p.maxHealth, p.currentHealth + eff.amount)
		} else if (eff.type === 'maxHp') {
			p.maxHealth += eff.amount
			p.currentHealth = Math.min(p.maxHealth, p.currentHealth + eff.amount)
		} else if (eff.type === 'loseHp' || eff.type === 'loseShards') {
			p.currentHealth = Math.max(1, p.currentHealth - (eff.amount ?? eff.lose))
		} else if (eff.type === 'loseMax') {
			p.currentHealth = Math.max(1, p.currentHealth - eff.lose)
			p.maxHealth += eff.max
			p.currentHealth = Math.min(p.maxHealth, p.currentHealth + eff.max)
		} else if (eff.type === 'addCard') {
			// 事件奇遇：获得指定灵术卡（如画灵之术的「绘涌」、心灵修习的「心潮」）
			const card = createLingzhiCard(eff.card)
			draft.deck.push(card)
			room.reward = {...(room.reward || {}), card: {name: card.name, desc: card.desc}}
		} else if (eff.type === 'relic') {
			// 事件奇遇：获得指定遗物（如预蝉之鉴「灵镜」、灵誓之契「灵契」），已持有则不重复
			const relic = ALL_LINGZHI_RELICS.find((r) => r.id === eff.relic)
			if (relic && !(p.relics || []).some((r) => r.id === relic.id)) {
				p.relics.push({...relic})
				room.reward = {...(room.reward || {}), relic: {name: relic.name, desc: relic.desc}}
			}
		} else if (eff.type === 'removeCard') {
			// 事件奇遇：随机移除卡组 1 张卡（清洗之雨，净除杂念），卡组过薄时保留最后 1 张
			if (draft.deck.length > 1) {
				const idx = Math.floor(Math.random() * draft.deck.length)
				const removed = draft.deck[idx]
				draft.deck.splice(idx, 1)
				room.reward = {...(room.reward || {}), removed: {name: removed.name, desc: removed.desc}}
			}
		}
		const shards =
			(eff.type === 'shards' ? eff.amount : 0) +
			(eff.type === 'maxShards' ? eff.shards : 0) +
			(eff.type === 'loseShards' ? eff.shards : 0)
		if (shards > 0) room.reward = {...(room.reward || {}), shards}
		room.resolved = true
		room.choiceIndex = choiceIndex
	})
}

// 灵质空间抉择：进入他人/无主灵质空间（content/lingzhi-spaces.js），三选一应用
//   生命 / 上限 / 残片 / 灵术卡 / 遗物效果；支持附带代价（lose 扣血、heal 回血）的混合收益
function resolveSpace(state, {choiceIndex}) {
  return produce(state, (draft) => {
    const room = getCurrRoom(draft)
    if (!room || room.type !== 'space' || room.resolved) return
    const choice = room.space.options[choiceIndex]
    if (!choice) return
    const eff = choice.effect
    const p = draft.player
    if (eff.type === 'heal') {
      p.currentHealth = Math.min(p.maxHealth, p.currentHealth + eff.amount)
    } else if (eff.type === 'maxHp') {
      p.maxHealth += eff.amount
      // 提升最大生命时回复等量（或按数据指定的额外回复量）
      p.currentHealth = Math.min(p.maxHealth, p.currentHealth + (eff.heal ?? eff.amount))
    } else if (eff.type === 'loseHp') {
      p.currentHealth = Math.max(1, p.currentHealth - eff.amount)
    } else if (eff.type === 'addCard') {
      const card = createLingzhiCard(eff.card)
      draft.deck.push(card)
      room.reward = {...(room.reward || {}), card: {name: card.name, desc: card.desc}}
    } else if (eff.type === 'relic') {
      const relic = ALL_LINGZHI_RELICS.find((r) => r.id === eff.relic)
      if (relic && !(p.relics || []).some((r) => r.id === relic.id)) {
        p.relics.push({...relic})
        room.reward = {...(room.reward || {}), relic: {name: relic.name, desc: relic.desc}}
      }
    } else if (eff.type === 'removeCard') {
      if (draft.deck.length > 1) {
        const idx = Math.floor(Math.random() * draft.deck.length)
        const removed = draft.deck[idx]
        draft.deck.splice(idx, 1)
        room.reward = {...(room.reward || {}), removed: {name: removed.name, desc: removed.desc}}
      }
    }
    // 通用附加项：lose 扣血 / heal 回血 / shards 得残片（带代价或混合收益的空间抉择）
    if (eff.lose) p.currentHealth = Math.max(1, p.currentHealth - eff.lose)
    if (eff.heal && eff.type !== 'maxHp') p.currentHealth = Math.min(p.maxHealth, p.currentHealth + eff.heal)
    if (eff.type === 'shards') room.reward = {...(room.reward || {}), shards: eff.amount}
    // 探索过的灵质空间同步登记主图鉴（'spaces' 类别，与主爬塔空间共用）
    if (room.space?.name) markCollected('spaces', room.space.name)
    room.resolved = true
    room.choiceIndex = choiceIndex
  })
}

// 回合/卡牌相关的调试动作
const iddqd = (state) => {
	return produce(state, (draft) => {
		draft.player.currentHealth = 999
	})
}

const allActions = {
	playCard,
	endTurn,
	move,
	campfireRest,
	campfireRemoveCard,
	addCardToDeck,
	addRelicToPlayer,
	resolveEvent,
	resolveSpace,
	lingzhiCombo,
	lingzhiWeak,
	drawCards: drawCardsAction,
	lingzhiShieldSurge,
	lingzhiHeartTide,
	lingzhiSwarm,
	iddqd,
}

// ============ ActionManager ============
export class LingzhiGame {
	constructor(state) {
		this.state = state
		this.queue = []
		this.history = []
	}
	enqueue(action) {
		this.queue.push(action)
	}
	dequeue() {
		while (this.queue.length) {
			const action = this.queue.shift()
			const fn = allActions[action.type]
			if (!fn) throw new Error(`未知动作: ${action.type}`)
			const next = fn(this.state, action)
			if (next && next !== this.state) {
				this.history.push(this.state)
				this.state = next
			}
		}
	}
	undo() {
		const prev = this.history.pop()
		if (prev) this.state = prev
	}
}
