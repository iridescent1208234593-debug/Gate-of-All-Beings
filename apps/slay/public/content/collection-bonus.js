// 罗小黑战记·重生之门 —— 万灵归藏（图鉴收集跨局加成）
// 世界观依据：content/worldview-data.js（灵质空间——每个生命体固有的物质空间，用于储存灵；
//   妖精会收录万物情报；魂灵携带前世记忆与因果转生。）
// 机制：玩家在爬塔中收录的角色 / 敌人 / 事件 / 卡牌 / 法宝 / 地点等见闻，
//   沉淀为「灵藏」存于灵质空间，跨局生效——收集越多，开局越强。
// 与 soul-legacy.js（魂灵传承）互补：魂灵来自「散灵 / 通关」的生死历练，
//   灵藏来自「图鉴收录」的见闻积累；一个靠死，一个靠看。
// 数据来源：collection-progress.js 的 totalCollected()（localStorage 跨局计数，无需新增存档）。

import {totalCollected} from './collection-progress.js'

// 收集里程碑（按累计图鉴收录数递增，后档包含前档加成）：
//   命名取自世界观：万物有灵 → 灵识初开 → 聚灵成精 → 魂灵渐凝 → 洞悉散灵 → 万灵归藏。
// 加成键与 menu.js 的 PASSIVE_LABELS 对齐：maxHealth / fortune / daoHeart。
export const COLLECTION_BONUS_TIERS = [
	{
		threshold: 10,
		name: '万物有灵',
		desc: '你已见识世间众多生灵。万物有灵，身骨受灵滋润。',
		bonus: {maxHealth: 4},
	},
	{
		threshold: 30,
		name: '灵识初开',
		desc: '见闻渐广，灵识初开。机缘亦随之而来。',
		bonus: {fortune: 3},
	},
	{
		threshold: 60,
		name: '聚灵成精',
		desc: '观聚灵之道，心志凝实，渐有妖精之姿。',
		bonus: {daoHeart: 4},
	},
	{
		threshold: 100,
		name: '魂灵渐凝',
		desc: '收录百年见闻，魂灵凝实，前世记忆渐醒。',
		bonus: {maxHealth: 8, fortune: 4},
	},
	{
		threshold: 150,
		name: '洞悉散灵',
		desc: '悟散灵之理，生死不惑，超然物外。',
		bonus: {daoHeart: 8},
	},
	{
		threshold: 220,
		name: '万灵归藏',
		desc: '集万物之灵，化归己藏。灵质空间自成一方天地。',
		bonus: {maxHealth: 15, fortune: 8, daoHeart: 10},
	},
]

/**
 * 按累计收录数返回当前灵藏档位。
 * @param {number} count 累计图鉴收录数（totalCollected 的结果）
 * @returns {{count:number, tier:(object|null), total:object, unlocked:object[], next:(object|null)}}
 *   tier：已解锁的最高档（无解锁时为 null）
 *   total：已解锁全部档位的累计加成（键：maxHealth/fortune/daoHeart）
 *   unlocked：已解锁档位列表
 *   next：下一档（未解锁时为空）
 */
export function collectionBonusForCount(count) {
	const unlocked = COLLECTION_BONUS_TIERS.filter((t) => count >= t.threshold)
	const tier = unlocked.length ? unlocked[unlocked.length - 1] : null
	const total = {}
	for (const t of unlocked) {
		for (const [k, v] of Object.entries(t.bonus)) total[k] = (total[k] || 0) + v
	}
	const next = COLLECTION_BONUS_TIERS.find((t) => count < t.threshold) || null
	return {count, tier, total, unlocked, next}
}

/** 当前跨局灵藏（读取浏览器收集计数；node 环境无 localStorage 时按 0 处理，安全无加成）。 */
export function currentCollectionBonus() {
	let count = 0
	try {
		count = totalCollected()
	} catch (err) {
		count = 0
	}
	return collectionBonusForCount(count)
}

/**
 * 开局应用万灵归藏加成（与 applyLegacy 互补；在 actions.js 的 createNewGame 中调用）。
 * @param {object} state 开局状态（含 player）
 * @returns {object} state
 */
export function applyCollectionBonus(state) {
	const bonus = currentCollectionBonus()
	if (!bonus.tier || Object.keys(bonus.total).length === 0) return state
	const p = state.player
	if (bonus.total.maxHealth) {
		p.maxHealth += bonus.total.maxHealth
		p.currentHealth += bonus.total.maxHealth
	}
	if (bonus.total.fortune) p.fortune += bonus.total.fortune
	if (bonus.total.daoHeart) p.daoHeart += bonus.total.daoHeart
	// 记录来源，供修行面板 / 结算界面展示
	p.collectionBonus = {
		count: bonus.count,
		tierName: bonus.tier.name,
		tierIndex: bonus.unlocked.length - 1,
		total: bonus.total,
	}
	return state
}
