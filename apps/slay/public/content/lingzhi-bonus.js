import { unifiedStorage } from '/shared/shared-session/kv.js';
const localStorage = unifiedStorage('slay');
// 罗小黑战记·重生之门 —— 「灵质修行 → 主游戏」联动奖励
// 修行（灵质空间）解锁的残片/角色/成就，反哺主游戏爬塔：
//  - 已解锁条目数（角色+灵术卡+遗物）决定「灵质共鸣」档位 → 开局福缘/道心/生命/能量加成
//  - 已领取成就数决定「修行感悟」加成 → 道心/福缘加成
// 纯计算函数无副作用；applyLingzhiBonus 由 actions.createNewGame 在开局时调用。
import {loadProgress, saveProgress} from '../game/lingzhi-progress.js'
import {treasures} from './cultivation.js'

// 灵质共鸣档位（按修行已解锁条目总数 unlockedCount）
export const LINGZHI_TIERS = [
	{min: 0, name: '灵质蒙昧', desc: '修行尚未展开，爬塔中暂无灵质共鸣加持。', bonuses: {}},
	{min: 2, name: '灵光初绽', desc: '灵质空间初启，修行见闻化为前世的福缘。', bonuses: {fortune: 1}},
	{min: 5, name: '灵脉渐通', desc: '灵脉渐次贯通，道心澄明，修行反哺今生。', bonuses: {fortune: 1, daoHeart: 2}},
	{min: 10, name: '灵台清明', desc: '灵台清明如镜，体魄受灵质温养，愈发强韧。', bonuses: {fortune: 1, daoHeart: 2, maxHealth: 5}},
	{min: 16, name: '灵韵流转', desc: '灵韵周身流转，灵质之息在轮回中凝为常驻之力。', bonuses: {fortune: 2, daoHeart: 3, maxHealth: 5, extraEnergy: 1}},
]

// 修行感悟加成（按已领取成就数 claimedCount）
const ACHIEVEMENT_BONUS = [
	{min: 3, bonuses: {daoHeart: 2}, desc: '修行感悟初成，道心愈发坚定。'},
	{min: 6, bonuses: {daoHeart: 2, fortune: 1}, desc: '修行感悟深厚，福缘随修行而来。'},
]

/**
 * 计算修行进度对应的主游戏联动加成（纯函数）。
 * @param {object|null} progress lingzhi-progress.js 进度对象；null 时按空进度计算
 * @returns {{unlockedCount:number, claimedCount:number, tier:object, bonuses:{fortune:number, daoHeart:number, maxHealth:number, extraEnergy:number}, source:string}}
 */
export function computeLingzhiBonus(progress) {
	const p = progress || loadProgress()
	const unlockedCount = (p.unlockedCharacters?.length || 0) + (p.unlockedCards?.length || 0) + (p.unlockedRelics?.length || 0)
	const claimedCount = p.claimedAchievements ? Object.keys(p.claimedAchievements).length : 0
	let tier = LINGZHI_TIERS[0]
	for (const t of LINGZHI_TIERS) {
		if (unlockedCount >= t.min) tier = t
	}
	let bonuses = {...tier.bonuses}
	let achDesc = ''
	for (const a of ACHIEVEMENT_BONUS) {
		if (claimedCount >= a.min) {
			achDesc = a.desc
			// 增量叠加（成就加成在档位加成之上累加，而非覆盖）
			bonuses = {
				fortune: (bonuses.fortune || 0) + (a.bonuses.fortune || 0),
				daoHeart: (bonuses.daoHeart || 0) + (a.bonuses.daoHeart || 0),
				maxHealth: (bonuses.maxHealth || 0) + (a.bonuses.maxHealth || 0),
				extraEnergy: (bonuses.extraEnergy || 0) + (a.bonuses.extraEnergy || 0),
			}
		}
	}
	const fortune = bonuses.fortune || 0
	const daoHeart = bonuses.daoHeart || 0
	const maxHealth = bonuses.maxHealth || 0
	const extraEnergy = bonuses.extraEnergy || 0
	const source = `灵质修行 · ${tier.name}（已解锁 ${unlockedCount} 条目${claimedCount ? `，已领 ${claimedCount} 成就` : ''}）`
	return {unlockedCount, claimedCount, tier, achDesc, bonuses: {fortune, daoHeart, maxHealth, extraEnergy}, source}
}

/**
 * 应用联动加成到主游戏开局 state（由 actions.createNewGame 调用）。
 * 加成写入 state.player 与 state.meta.lingzhiBonus（供结算界面展示来源）。
 * @param {object} state actions.createNewGame 产出的游戏状态
 * @returns {object} 应用后的 state（原地修改并返回）
 */
export function applyLingzhiBonus(state) {
	if (!state || !state.player) return state
	const bonus = computeLingzhiBonus(loadProgress())
	if (!bonus || bonus.unlockedCount === 0) return state
	const b = bonus.bonuses
	if (b.fortune) state.player.fortune = (state.player.fortune || 0) + b.fortune
	if (b.daoHeart) state.player.daoHeart = (state.player.daoHeart || 0) + b.daoHeart
	if (b.maxHealth) {
		state.player.maxHealth = (state.player.maxHealth || 0) + b.maxHealth
		state.player.currentHealth = (state.player.currentHealth || 0) + b.maxHealth
	}
	if (b.extraEnergy) {
		state.player.maxEnergy = (state.player.maxEnergy || 3) + b.extraEnergy
		state.player.currentEnergy = (state.player.currentEnergy || 3) + b.extraEnergy
	}
	if (!state.meta) state.meta = {}
	state.meta.lingzhiBonus = {
		unlockedCount: bonus.unlockedCount,
		claimedCount: bonus.claimedCount,
		tierName: bonus.tier.name,
		tierDesc: bonus.tier.desc,
		achDesc: bonus.achDesc,
		bonuses: b,
		source: bonus.source,
	}
	return state
}

/**
 * 生成简洁加成文案（主界面/结算面板用）。
 * @param {object|null} summary save-system.getLingzhiSummary() 或 computeLingzhiBonus 结果
 * @returns {string}
 */
export function lingzhiBonusLine(summary) {
	if (!summary) return '尚未开始灵质修行——去灵质空间修行，解锁残片与成就，可获得爬塔开局加成。'
	if (summary.bonuses && summary.bonuses.fortune === 0 && summary.bonuses.daoHeart === 0 && summary.bonuses.maxHealth === 0 && summary.bonuses.extraEnergy === 0) {
		return `已解锁 ${summary.unlockedCount} 条目 · 已领 ${summary.claimedCount} 成就 —— 再解锁 1 个条目即可开启「灵光初绽」联动加成。`
	}
	const parts = []
	if (summary.bonuses.extraEnergy) parts.push(`每回合能量 +${summary.bonuses.extraEnergy}`)
	if (summary.bonuses.maxHealth) parts.push(`生命 +${summary.bonuses.maxHealth}`)
	if (summary.bonuses.fortune) parts.push(`福缘 +${summary.bonuses.fortune}`)
	if (summary.bonuses.daoHeart) parts.push(`道心 +${summary.bonuses.daoHeart}`)
	return `已解锁 ${summary.unlockedCount} 条目 · 已领 ${summary.claimedCount} 成就 —— 下一世开局：${parts.join('、')}（来源：${summary.source || '灵质修行'}）`
}

// ==================== 灵质修行结算奖励（跨局桥接） ====================
// 设定：灵质回路试炼每次结束（通关守门 Boss / 散灵止步）时，按
//   「历史最高到达层数 bestFloor」与「累计通关次数 wins」结算一份跨局奖励：
//   修为（cultivation）/ 道心（daoHeart）按比例折入，达到更高层数并通关解锁法宝。
// 跨局持久化复用已验证的 localStorage 通道模式（同 soul-legacy 的
//   luoxiaohei-rebirth-soul-legacy、save-system 的档案快照）：
//   结算奖励写入 localStorage['lxz-lingzhi-settlement-v1']，待下一局主爬塔开局时
//   一次性注入 state.player（修为/道心/法宝），注入后清空——
//   「上一场修行的感悟，成为下一世爬塔的根基」。

// 结算奖励存储 key（跨局待生效；模式复用 soul-legacy 的 localStorage 通道）
const SETTLEMENT_KEY = 'lxz-lingzhi-settlement-v1'

// 结算档位：按历史最高层数（灵质回路共 7 层，第 7 层为守门 Boss）划分。
// minFloor 为达到该档所需的历史最高层数；treasureId 须存在于 cultivation.js treasures（id 即名称）。
export const LINGZHI_SETTLEMENT_TIERS = [
	{minFloor: 1, name: '初入回路', cultivation: 4, daoHeart: 1, treasureId: null, desc: '初涉灵质空间，感悟化为修为。'},
	{minFloor: 3, name: '灵脉渐深', cultivation: 8, daoHeart: 2, treasureId: null, desc: '深入回路中段，道心愈发澄明。'},
	{minFloor: 5, name: '逼近门扉', cultivation: 14, daoHeart: 3, treasureId: null, desc: '临门之悟，修为大涨。'},
	{minFloor: 7, name: '叩开重生门', cultivation: 24, daoHeart: 5, treasureId: '唤灵石', desc: '击败守门 Boss，感悟圆满——携「唤灵石」转世。'},
]

// 通关累计加成：每累计通关 1 次，额外折算的修为/道心（与档位基础值叠加）
const SETTLEMENT_WINS_BONUS = {
	cultivationPerWin: 4,
	daoHeartPerWin: 1,
}

/**
 * 计算当前修行进度应折算的跨局结算奖励（纯函数）。
 * 档位取历史最高层数 bestFloor（0 表示从未修行，无奖励）；wins 提供通关累计加成。
 * @param {object|null} progress lingzhi-progress.js 进度对象（需含 bestFloor / wins）
 * @returns {{hasReward:boolean, tier:object|null, bestFloor:number, wins:number, cultivation:number, daoHeart:number, treasureId:string|null}}
 */
export function computeSettlementReward(progress) {
	const p = progress || {}
	const bestFloor = p.bestFloor || 0
	const wins = p.wins || 0
	let tier = null
	for (const t of LINGZHI_SETTLEMENT_TIERS) {
		if (bestFloor >= t.minFloor) tier = t
	}
	if (!tier) return {hasReward: false, tier: null, bestFloor, wins, cultivation: 0, daoHeart: 0, treasureId: null}
	return {
		hasReward: true,
		tier,
		bestFloor,
		wins,
		cultivation: tier.cultivation + wins * SETTLEMENT_WINS_BONUS.cultivationPerWin,
		daoHeart: tier.daoHeart + wins * SETTLEMENT_WINS_BONUS.daoHeartPerWin,
		treasureId: tier.treasureId,
	}
}

/** 读取跨局待生效的结算奖励（浏览器外环境返回 null） */
export function getLingzhiSettlement() {
	if (typeof localStorage === 'undefined') return null
	try {
		const raw = localStorage.getItem(SETTLEMENT_KEY)
		return raw ? JSON.parse(raw) : null
	} catch (err) {
		console.warn('灵质修行结算奖励存档读取失败', err)
		return null
	}
}

/** 清空跨局待生效的结算奖励（开局承接后调用） */
export function clearLingzhiSettlement() {
	if (typeof localStorage === 'undefined') return
	try {
		localStorage.removeItem(SETTLEMENT_KEY)
	} catch (err) {
		console.warn('灵质修行结算奖励存档清除失败', err)
	}
}

/**
 * 结算一次灵质回路试炼并写入跨局待生效奖励（由 ui/lingzhi-xiuxing.js finish() 调用）。
 * 多次修行结算会累加（修为/道心叠加、法宝去重），直到下一局主爬塔开局一次性承接。
 * @param {object} progress 结算后的修行进度（含 bestFloor / wins）
 * @returns {object|null} 本次新增并累加后的待生效奖励；无奖励时返回 null
 */
export function saveLingzhiSettlement(progress) {
	if (typeof localStorage === 'undefined') return null
	const reward = computeSettlementReward(progress)
	if (!reward.hasReward) return null
	const prev = getLingzhiSettlement() || {}
	const next = {
		cultivation: (prev.cultivation || 0) + reward.cultivation,
		daoHeart: (prev.daoHeart || 0) + reward.daoHeart,
		treasureIds: [...new Set([...(prev.treasureIds || []), reward.treasureId].filter(Boolean))],
		bestFloor: Math.max(prev.bestFloor || 0, reward.bestFloor),
		tierName: reward.tier.name,
		updatedAt: Date.now(),
	}
	try {
		localStorage.setItem(SETTLEMENT_KEY, JSON.stringify(next))
	} catch (err) {
		console.warn('灵质修行结算奖励存档写入失败', err)
		return null
	}
	return next
}

/**
 * 开局应用跨局结算奖励（由 actions.createNewGame 调用）。
 * 将待生效的修为/道心注入 state.player、法宝去重后加入 treasures，
 * 记录来源至 state.meta.lingzhiSettlement，并清空待生效存档（一次性承接）。
 * @param {object} state actions.createNewGame 产出的游戏状态
 * @returns {object} 应用后的 state（原地修改并返回）
 */
export function applyLingzhiSettlement(state) {
	if (!state || !state.player) return state
	const settlement = getLingzhiSettlement()
	if (!settlement || (!settlement.cultivation && !settlement.daoHeart && !(settlement.treasureIds || []).length)) return state
	// 修为/道心按比例注入（修行感悟折为今生根基）
	if (settlement.cultivation) state.player.cultivation = (state.player.cultivation || 0) + settlement.cultivation
	if (settlement.daoHeart) state.player.daoHeart = (state.player.daoHeart || 0) + settlement.daoHeart
	// 法宝：与已有法宝去重后注入（id 即名称；被动福缘即时生效）
	const gainedTreasures = []
	for (const tid of settlement.treasureIds || []) {
		const t = treasures[tid]
		if (t && !state.player.treasures.some((x) => x.id === tid)) {
			state.player.treasures.push(t)
			if (t.passive?.fortune) state.player.fortune = (state.player.fortune || 0) + t.passive.fortune
			gainedTreasures.push(tid)
		}
	}
	if (!state.meta) state.meta = {}
	state.meta.lingzhiSettlement = {
		cultivation: settlement.cultivation,
		daoHeart: settlement.daoHeart,
		treasures: gainedTreasures,
		bestFloor: settlement.bestFloor,
		tierName: settlement.tierName,
	}
	// 一次性承接：清空待生效存档，避免下一局重复注入
	clearLingzhiSettlement()
	return state
}

/**
 * 生成待生效结算奖励文案（主菜单/结算面板用）。
 * @param {object|null} settlement getLingzhiSettlement() 返回值
 * @returns {string}
 */
export function lingzhiSettlementLine(settlement) {
	if (!settlement || (!settlement.cultivation && !settlement.daoHeart && !(settlement.treasureIds || []).length)) {
		return '暂无待生效的修行结算奖励——去灵质空间修行，结算感悟将在下一局爬塔开局生效。'
	}
	const parts = []
	if (settlement.cultivation) parts.push(`修为 +${settlement.cultivation}`)
	if (settlement.daoHeart) parts.push(`道心 +${settlement.daoHeart}`)
	if (settlement.treasureIds?.length) parts.push(`法宝「${settlement.treasureIds.join('」「')}」`)
	return `灵质修行结算待生效：${parts.join('、')}——下一局爬塔开局自动承接。`
}

// ==================== 灵质共鸣等级（修行 → 主爬塔 · 强化联动） ====================
// 设定：修行深度（回路层数/通关次数/残片积累）凝结为「灵质共鸣等级」，觉醒后反哺爬塔开局：
//   - 初始灵石：按等级给予开局金币（轮回中携前世修行所得而生）
//   - 灵质亲和（五行属性加成）：本局所有攻击/格挡卡牌获得 +等级 加成——
//     不依赖卡牌五行系，代表灵质共鸣已渗透五行，全卡受益
// 加成规则：等级 = min(5, floor(bestFloor/2) + floor(wins/4) + floor(shards/80))，
// 即「回路深度半折 + 通关每 4 次 1 级 + 残片每 80 枚 1 级」。
export const LINGZHI_AWAKENING_TIERS = [
	{minLevel: 1, gold: 8, atkBonus: 1, defBonus: 1, name: '灵质亲和·初醒', desc: '灵质共鸣初醒，本局全卡伤害与格挡 +1，开局灵石 +8。'},
	{minLevel: 2, gold: 16, atkBonus: 2, defBonus: 2, name: '灵质亲和·贯通', desc: '灵脉贯通，本局全卡伤害与格挡 +2，开局灵石 +16。'},
	{minLevel: 3, gold: 24, atkBonus: 3, defBonus: 3, name: '灵质亲和·流转', desc: '灵韵流转，本局全卡伤害与格挡 +3，开局灵石 +24。'},
	{minLevel: 4, gold: 32, atkBonus: 4, defBonus: 4, name: '灵质亲和·圆满', desc: '灵质圆满，本局全卡伤害与格挡 +4，开局灵石 +32。'},
	{minLevel: 5, gold: 40, atkBonus: 5, defBonus: 5, name: '灵质亲和·轮回', desc: '灵质与轮回共鸣，本局全卡伤害与格挡 +5，开局灵石 +40。'},
]

/**
 * 计算修行共鸣等级（纯函数）。
 * @param {object|null} progress lingzhi-progress.js 进度对象（bestFloor/wins/shards）
 * @returns {number} 0-5
 */
export function computeLingzhiLevel(progress) {
	const p = progress || {}
	const bestFloor = p.bestFloor || 0
	const wins = p.wins || 0
	const shards = p.shards || 0
	return Math.min(5, Math.floor(bestFloor / 2) + Math.floor(wins / 4) + Math.floor(shards / 80))
}

/**
 * 计算灵质共鸣觉醒信息（纯函数）。
 * @param {object|null} progress lingzhi-progress.js 进度对象
 * @returns {{level:number, gold:number, atkBonus:number, defBonus:number, name:string, desc:string}}
 */
export function computeLingzhiAwakening(progress) {
	const level = computeLingzhiLevel(progress)
	if (!level) return {level: 0, gold: 0, atkBonus: 0, defBonus: 0, name: '未觉醒', desc: '灵质修行尚浅，爬塔暂无灵质亲和加成。'}
	const tier = LINGZHI_AWAKENING_TIERS[level - 1]
	return {level, gold: tier.gold, atkBonus: tier.atkBonus, defBonus: tier.defBonus, name: tier.name, desc: tier.desc}
}

/**
 * 开局应用灵质共鸣觉醒（由 actions.createNewGame 调用）。
 * 注入初始灵石（gold）与常驻被动字段 player.lingzhiAwakening；
 * 卡牌加成链通过 lingzhiAwakeningPassiveTotal 消费（actions.playCard）。
 * @param {object} state actions.createNewGame 产出的游戏状态
 * @returns {object} 应用后的 state（原地修改并返回）
 */
export function applyLingzhiAwakening(state) {
	if (!state || !state.player) return state
	const aw = computeLingzhiAwakening(loadProgress())
	if (!aw.level) return state
	if (aw.gold) state.player.gold = (state.player.gold || 0) + aw.gold
	state.player.lingzhiAwakening = {
		level: aw.level,
		atkBonus: aw.atkBonus,
		defBonus: aw.defBonus,
		name: aw.name,
		desc: aw.desc,
	}
	if (!state.meta) state.meta = {}
	state.meta.lingzhiAwakening = {
		level: aw.level,
		gold: aw.gold,
		atkBonus: aw.atkBonus,
		defBonus: aw.defBonus,
		name: aw.name,
		desc: aw.desc,
	}
	return state
}

/**
 * 汇总灵质亲和常驻被动的数值（与 treasurePassiveTotal/bondPassiveTotal 对齐，
 * 由 actions.playCard 在攻击/格挡加成链中调用）。
 * @param {object} player 主爬塔玩家对象
 * @param {'atkBonus'|'defBonus'|string} key 被动键
 * @returns {number}
 */
export function lingzhiAwakeningPassiveTotal(player, key) {
	if (!player?.lingzhiAwakening) return 0
	if (key === 'atkBonus') return player.lingzhiAwakening.atkBonus || 0
	if (key === 'defBonus') return player.lingzhiAwakening.defBonus || 0
	return 0
}

// ==================== 轮回感悟（主爬塔 → 修行反哺） ====================
// 设定：主爬塔每一世（通关/败北）凝结「轮回感悟」——今生战斗见闻在轮回中
// 沉淀为灵质修行的资粮（写回 lxz-lingzhi-xiuxing-v1 进度）：
//   - crossoverExp：轮回感悟，永久累计
//   - 每 100 感悟折 1 残片（单局最多折 2 片，保留余数，防单局刷取）
// 反哺公式：感悟 = (通关 80 / 败北 20) + 到达层数 * 8
export const CROSSOVER_EXP_PER_SHARD = 100
export const CROSSOVER_MAX_SHARDS_PER_RUN = 2

/**
 * 计算主爬塔结算应反哺的轮回感悟（纯函数）。
 * @param {object} state 主爬塔 state（需含 dungeon.y 层数）
 * @param {boolean} won 是否通关
 * @returns {{gainedExp:number, gainedShards:number, floor:number, won:boolean}}
 */
export function computeRunFeedback(state, won) {
	const floor = state?.dungeon && typeof state.dungeon.y === 'number' ? state.dungeon.y + 1 : 0
	const base = won ? 80 : 20
	const gainedExp = base + floor * 8
	const gainedShards = Math.min(
		Math.floor(gainedExp / CROSSOVER_EXP_PER_SHARD),
		CROSSOVER_MAX_SHARDS_PER_RUN
	)
	return {gainedExp, gainedShards, floor, won: !!won}
}

/**
 * 主爬塔结算反哺修行进度（由 ui/app.js 结算处调用）。
 * 读取修行进度 → 增加轮回感悟 crossoverExp → 按比例折算残片 → 写回。
 * @param {object} state 主爬塔 state
 * @param {boolean} won 是否通关
 * @returns {{gainedExp:number, gainedShards:number, floor:number, won:boolean, crossoverExp:number}|null}
 */
export function feedbackLingzhiFromRun(state, won) {
	if (typeof localStorage === 'undefined') return null
	const feedback = computeRunFeedback(state, won)
	if (!feedback.gainedExp) return null
	const progress = loadProgress()
	const next = {
		...progress,
		crossoverExp: (progress.crossoverExp || 0) + feedback.gainedExp,
		shards: (progress.shards || 0) + feedback.gainedShards,
	}
	try {
		saveProgress(next)
	} catch (err) {
		console.warn('轮回感悟反哺修行进度写入失败', err)
		return null
	}
	return {...feedback, crossoverExp: next.crossoverExp}
}

/**
 * 轮回感悟反哺文案（主爬塔结算界面用）。
 * @param {object|null} feedback feedbackLingzhiFromRun 返回值
 * @returns {string}
 */
export function lingzhiFeedbackLine(feedback) {
	if (!feedback || !feedback.gainedExp) return ''
	const parts = [`轮回感悟 +${feedback.gainedExp}`]
	if (feedback.gainedShards) parts.push(`残片 +${feedback.gainedShards}`)
	return `${parts.join('，')}——今生见闻沉淀为灵质修行的资粮。`
}

export default {computeLingzhiBonus, applyLingzhiBonus, lingzhiBonusLine, LINGZHI_TIERS, computeSettlementReward, getLingzhiSettlement, clearLingzhiSettlement, saveLingzhiSettlement, applyLingzhiSettlement, lingzhiSettlementLine, LINGZHI_SETTLEMENT_TIERS, LINGZHI_AWAKENING_TIERS, computeLingzhiLevel, computeLingzhiAwakening, applyLingzhiAwakening, lingzhiAwakeningPassiveTotal, computeRunFeedback, feedbackLingzhiFromRun, lingzhiFeedbackLine, CROSSOVER_EXP_PER_SHARD, CROSSOVER_MAX_SHARDS_PER_RUN}
