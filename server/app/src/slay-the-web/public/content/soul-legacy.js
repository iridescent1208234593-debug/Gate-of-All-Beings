import { unifiedStorage } from '/shared/shared-session/kv.js';
const localStorage = unifiedStorage('slay');
// 罗小黑战记·重生之门 —— 魂灵跨局传承（Soul Legacy）
// 机制来源：games\juling（众生之门·聚灵）核心设定：
//   「散灵：灵质空间衰竭 = 死亡；魂灵跨局传承，越死越强。」
//   局内奇遇（事件 / 灵质空间）可凝结「魂灵种子」，散灵时折入轮回，随魂灵一起跨局累积。
// 每局结束（散灵死亡 / 通关重生之门）都会结算魂灵，魂灵永久累积于浏览器本地存储，
// 下一局开局按魂灵等级获得传承加成 —— 每一次散灵，都是下一世重生的养料。
// 世界观依据：content/worldview-data.js spiritLifecycle ——
//   魂灵：生命在孕育过程中吸收自然界生灵后孕育出的灵识，是意识和自我认知的载体。
// 数据存储：localStorage['luoxiaohei-rebirth-soul-legacy']

import {treasures} from './cultivation.js'

const LEGACY_KEY = 'luoxiaohei-rebirth-soul-legacy'

// 魂灵等级（跨局成长曲线，参考 wuxing-game 的 REALMS 按累计魂灵划分）
export const SOUL_REALMS = [
	{name: '轮回初醒', soul: 0, desc: '每一次散灵，都是轮回的开始。'},
	{name: '凝魂', soul: 100, desc: '魂灵初凝，隐约感知前世的残影。'},
	{name: '聚魄', soul: 300, desc: '魂魄渐聚，传承觉醒——开局获得一件法宝。'},
	{name: '灵识', soul: 600, desc: '灵识清明，前世记忆如潮水涌来。'},
	{name: '轮回', soul: 1000, desc: '渡过一轮回，重生之门为你敞开——开局获得天明珠。'},
	{name: '超脱', soul: 2000, desc: '超脱轮回，凌驾生死。'},
]

// 传承加成：每级提升量（最高 5 级）
const LEGACY_BONUS = {
	maxHealthPerLevel: 6, // 开局最大生命 +6/级（至多 +30）
	fortunePerLevel: 2, // 开局福缘 +2/级（至多 +10）
	// 特定等级赠送传承法宝（id 须存在于 cultivation.js treasures）
	giftTreasureByLevel: {
		2: '定心镜', // 聚魄：传承觉醒
		5: '天明珠', // 轮回：至宝随魂而来
	},
}

// 结算公式参数
const SOUL_CFG = {
	realmPerIndex: 25, // 境界每层 +25 魂灵（炼气0 / 筑基25 / 金丹50 / 元婴75 / 化神100）
	treasureEach: 15, // 每件法宝 +15 魂灵
	healthRatioMax: 40, // 剩余生命比例折算（至多 +40）
	soulSeedEach: 8, // 每颗「魂灵种子」 +8 魂灵（对齐 wuxing-game：局内奇遇凝结的魂灵种子，散灵时折入轮回）
	winBonus: 200, // 通关「重生之门」 +200 魂灵
}

/** 读取跨局魂灵存档（浏览器外环境返回 null） */
export function getLegacy() {
	if (typeof localStorage === 'undefined') return null
	try {
		const raw = localStorage.getItem(LEGACY_KEY)
		return raw ? JSON.parse(raw) : null
	} catch (err) {
		console.warn('魂灵传承存档读取失败', err)
		return null
	}
}

/** 写入跨局魂灵存档 */
export function saveLegacy(legacy) {
	if (typeof localStorage === 'undefined') return
	try {
		localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))
	} catch (err) {
		console.warn('魂灵传承存档写入失败', err)
	}
}

/** 根据累计魂灵返回等级对象（含 index） */
export function legacyLevel(soul) {
	let cur = SOUL_REALMS[0]
	for (const r of SOUL_REALMS) {
		if (soul >= r.soul) cur = r
	}
	return {index: SOUL_REALMS.indexOf(cur), ...cur}
}

/**
 * 结算本局获得的魂灵（散灵 / 通关时调用）。
 * 公式对齐 wuxing-game 的「生灵折算 + 境界/法器加成」：
 *   境界折算 + 法宝折算 + 剩余生命比例折算 + 魂灵种子折算 + 通关奖励
 * @param {object} state 当前 game state
 * @param {boolean} won 是否通关「重生之门」
 */
export function calcSoulGained(state, won) {
	const p = state.player || {}
	const realmSoul = (p.realmIndex || 0) * SOUL_CFG.realmPerIndex
	const treasureSoul = (p.treasures?.length || 0) * SOUL_CFG.treasureEach
	const ratio = Math.max(0, Math.min(1, (p.currentHealth || 0) / Math.max(1, p.maxHealth || 1)))
	const healthSoul = Math.floor(ratio * SOUL_CFG.healthRatioMax)
	const seedSoul = (p.soulSeed || 0) * SOUL_CFG.soulSeedEach // 局内凝结的魂灵种子折入轮回
	const winSoul = won ? SOUL_CFG.winBonus : 0
	return realmSoul + treasureSoul + healthSoul + seedSoul + winSoul
}

/**
 * 结束一局并结算魂灵（写入跨局存档）。
 * 返回结算摘要：{gainedSoul, totalSoul, level, runs, wins, bestFloor, lastResult}
 */
export function settleRun(state, won) {
	const legacy = getLegacy() || {}
	const gainedSoul = calcSoulGained(state, won)
	const totalSoul = (legacy.soul || 0) + gainedSoul
	const newLegacy = {
		soul: totalSoul,
		runs: (legacy.runs || 0) + 1,
		wins: (legacy.wins || 0) + (won ? 1 : 0),
		bestFloor: Math.max(legacy.bestFloor || 0, state.dungeon?.y || 0),
		lastResult: won ? '通关重生之门' : '散灵',
		lastGained: gainedSoul,
		updatedAt: Date.now(),
	}
	saveLegacy(newLegacy)
	const level = legacyLevel(totalSoul)
	return {gainedSoul, totalSoul, level, soulSeed: state.player?.soulSeed || 0, ...newLegacy}
}

/**
 * 追加魂灵奖励（成就解锁等跨局额外魂灵）。
 * 不覆盖 runs/wins 等局次字段，只累加 soul 并刷新 updatedAt。
 * @param {number} amount 奖励魂灵数（>0 才生效）
 * @returns {{soul:number, level:object}|null} 奖励后的累计魂灵与等级；无奖励时返回 null
 */
export function awardSoul(amount) {
	if (!amount || amount <= 0) return null
	const legacy = getLegacy() || {}
	const soul = (legacy.soul || 0) + amount
	saveLegacy({...legacy, soul, updatedAt: Date.now()})
	return {soul, level: legacyLevel(soul)}
}

/**
 * 开局应用魂灵传承加成：按魂灵等级提升最大生命与福缘，
 * 达到特定等级时获得传承法宝（对应世界观：魂灵携带前世的记忆与因果转生）。
 * 在 actions.js 的 createNewGame 中调用。
 */
export function applyLegacy(state) {
	const legacy = getLegacy()
	if (!legacy || !legacy.soul) return state
	const level = legacyLevel(legacy.soul)
	const hpBonus = level.index * LEGACY_BONUS.maxHealthPerLevel
	const fortuneBonus = level.index * LEGACY_BONUS.fortunePerLevel
	if (hpBonus > 0) {
		state.player.maxHealth += hpBonus
		state.player.currentHealth += hpBonus
	}
	if (fortuneBonus > 0) state.player.fortune += fortuneBonus
	// 记录传承来源，供 UI 展示
	state.player.soulLevel = level.index
	state.player.soulLegacy = {
		soul: legacy.soul,
		levelName: level.name,
		hpBonus,
		fortuneBonus,
	}
	// 传承法宝（逐级取最高档）
	const giftTreasureId = LEGACY_BONUS.giftTreasureByLevel[level.index]
	if (giftTreasureId && !state.player.treasures.some((t) => t.id === giftTreasureId)) {
		const treasure = treasures[giftTreasureId]
		if (treasure) {
			state.player.treasures.push(treasure)
			if (treasure.passive?.fortune) state.player.fortune += treasure.passive.fortune
		}
	}
	return state
}

/**
 * 魂灵传承面板数据（开局页/主菜单展示用）。
 * 一次性返回当前等级、下一级目标与进度、传承加成、传承法宝与下一级奖励预告。
 * 与 applyLegacy 的加成口径保持一致（生命 +等级*6，福缘 +等级*2）。
 * @param {{soul:number, runs?:number, wins?:number, bestFloor?:number, lastResult?:string, lastGained?:number}|null} legacy getLegacy() 返回值
 * @returns {object|null} 无传承记录时返回 null
 */
export function legacyPanel(legacy) {
	if (!legacy || !legacy.soul) return null
	const level = legacyLevel(legacy.soul)
	const next = SOUL_REALMS[level.index + 1] || null
	const curNeed = level.soul
	const nextNeed = next ? next.soul : null
	const progress = next
		? Math.min(100, Math.max(0, Math.floor(((legacy.soul - curNeed) / (nextNeed - curNeed)) * 100)))
		: 100
	const hpBonus = level.index * LEGACY_BONUS.maxHealthPerLevel
	const fortuneBonus = level.index * LEGACY_BONUS.fortunePerLevel
	const giftTreasureId = LEGACY_BONUS.giftTreasureByLevel[level.index]
	const giftTreasure = giftTreasureId ? treasures[giftTreasureId] : null
	const nextGiftId = next ? LEGACY_BONUS.giftTreasureByLevel[level.index + 1] : null
	const nextGift = nextGiftId ? treasures[nextGiftId] : null
	// cultivation.js 法宝对象无 name 字段（id 即名称），此处补齐供 UI（splash-screen.js）展示
	const withName = (t) => (t ? {...t, name: t.name || t.id} : null)
	return {level, next, nextNeed, progress, hpBonus, fortuneBonus, giftTreasure: withName(giftTreasure), nextGift: withName(nextGift)}
}
