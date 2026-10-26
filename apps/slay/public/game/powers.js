/**
 * The type of a power
 * @typedef POWER
 * @property {string} name
 * @property {string} description
 * @property {string} type
 * @property {string=} target
 * @property {Function=} use
 * @property {Object=} decay
 */

// Class representing a power.
class Power {
	/**
	 * @param {POWER} power - The base power to create a class from
	 */
	constructor(power) {
		const {name, description, type, target, use, decay} = power
		this.name = name
		this.description = description
		this.type = type
		this.target = target
		this.use = use
		// 自动衰减配置（罗小黑·重生之门统一衰减机制）：
		//   mode: 'flat'  每回合固定衰减 amount 层
		//   mode: 'half'  每回合衰减为原层数的一半（向下取整，用于成长型 buff，如力量/回灵）
		// 实际衰减幅度还会被角色「抗性（debuff 衰减更快）/ 能力（buff 衰减更慢）」修正。
		this.decay = decay || {mode: 'flat', amount: 1}
	}
}

export const regen = new Power({
	type: 'buff',
	name: '回灵',
	description: '每回合恢复与回灵层数等量的生命值',
	target: 'player',
	use: (stacks) => stacks,
	decay: {mode: 'half'},
})

export const vulnerable = new Power({
	type: 'debuff',
	name: '易伤',
	description: '易伤状态下受到的伤害增加 50%',
	use: (dmg) => Math.floor(dmg * 1.5),
	decay: {mode: 'flat', amount: 1},
})

export const weak = new Power({
	type: 'debuff',
	name: '虚弱',
	description: '虚弱目标造成的伤害降低 25%',
	use: (dmg) => Math.floor(dmg * 0.75),
	decay: {mode: 'flat', amount: 1},
})

export const strength = new Power({
	type: 'buff',
	name: '力量',
	description: '造成的伤害增加与力量层数等量的数值',
	target: 'self',
	use: (dmg, stacks) => dmg + (stacks || 0),
	decay: {mode: 'half'},
})

export const monsterRegen = new Power({
	type: 'buff',
	name: '回灵',
	description: '每回合恢复与回灵层数等量的生命值',
	target: 'self',
	use: (stacks) => stacks,
	decay: {mode: 'half'},
})

export default {regen, vulnerable, weak, strength, monsterRegen}
