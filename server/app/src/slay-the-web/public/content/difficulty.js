// 罗小黑战记·重生之门 —— 难度系统（试炼 / 历练 / 轮回）
// 世界观映射：
//   - 试炼·灵质初醒：灵质空间尚不稳定，妖气稀薄，敌人孱弱而机缘丰厚（新手友好档）
//   - 历练·众生之门：众生之门试炼的正常强度，妖与人皆全力相搏（默认档）
//   - 轮回·无间之狱：轮回压迫濒临极限，妖物狂暴，每一战都是生死边缘（高难档）
// 数值作用域：怪物血量（普通/精英/事件怪按 hpMult，Boss 额外乘 bossHpMult）、
//   战斗金币奖励倍率（rewardMult）、开局生命上限加成（startingHealthBonus）。
// 本模块为纯数据 + 纯函数，不依赖运行时状态，可单独 import 测试。

export const DIFFICULTIES = [
	{
		id: 'trial',
		name: '试炼 · 灵质初醒',
		desc: '适合初入众生之门的修行者：妖气稀薄，敌人孱弱，战利品更为丰厚，开局生命上限提升。',
		icon: '🌱',
		hpMult: 0.75,
		bossHpMult: 1.0,
		rewardMult: 1.3,
		startingHealthBonus: 12,
	},
	{
		id: 'normal',
		name: '历练 · 众生之门',
		desc: '众生之门试炼的正常强度，妖与人皆全力相搏，胜负全凭修为与抉择。',
		icon: '⛩️',
		hpMult: 1.0,
		bossHpMult: 1.0,
		rewardMult: 1.0,
		startingHealthBonus: 0,
	},
	{
		id: 'rebirth',
		name: '轮回 · 无间之狱',
		desc: '轮回压迫濒临极限，妖物狂暴嗜血（敌人血量大幅提升、Boss 更为致命），战利品随之削减，唯有强者可渡。',
		icon: '🌀',
		hpMult: 1.4,
		bossHpMult: 1.5,
		rewardMult: 0.75,
		startingHealthBonus: 0,
	},
]

export const DIFFICULTY_KEY = 'lxz-rebirth-difficulty'

/** 按 id 取难度配置；未知 id 回退默认「历练」 */
export function difficultyById(id) {
	if (!id) return DIFFICULTIES.find((d) => d.id === 'normal')
	return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES.find((d) => d.id === 'normal')
}

/** 奖励倍率：战斗金币结算时按此缩放 */
export function rewardMultiplier(id) {
	return difficultyById(id).rewardMult
}

/**
 * 对地牢应用难度倍率（纯函数，返回新地牢/新房间/新怪物，不污染模块级静态房间对象）。
 * 遍历 graph 中所有 monster 房间：
 *   - 普通/精英/事件怪房间的每个怪物：maxHealth/currentHealth 乘以 hpMult
 *   - boss 房间的每个怪物：乘以 hpMult * bossHpMult
 *   - 历练档（双倍率均为 1）直接返回原地牢，零拷贝零开销
 * 缩放规则：向下取整但至少保留 1 点生命；currentHealth 按比例同步缩放。
 * @param {Object} dungeon
 * @param {string=} difficultyId - trial / normal / rebirth
 */
export function applyDifficultyToDungeon(dungeon, difficultyId = 'normal') {
	if (!dungeon || !dungeon.graph) return dungeon
	const cfg = difficultyById(difficultyId)
	if (cfg.hpMult === 1 && cfg.bossHpMult === 1) return dungeon
	const nextGraph = dungeon.graph.map((row) =>
		row.map((node) => {
			if (!node || !node.room || node.room.type !== 'monster') return node
			const room = node.room
			const mult = room.difficulty === 'boss' ? cfg.hpMult * cfg.bossHpMult : cfg.hpMult
			if (mult === 1) return node
			const monsters = room.monsters.map((m) => {
				const base = m.maxHealth || m.currentHealth || 1
				// 用 Math.round 避免浮点乘积累计误差（如 1.4*1.5=2.0999...）
				const maxHealth = Math.max(1, Math.round(base * mult))
				const curBase = m.currentHealth ?? base
				const currentHealth = Math.min(maxHealth, Math.max(1, Math.round(curBase * mult)))
				return {...m, maxHealth, currentHealth}
			})
			return {...node, room: {...room, monsters, metaDifficulty: cfg.id}}
		})
	)
	return {...dungeon, graph: nextGraph}
}
