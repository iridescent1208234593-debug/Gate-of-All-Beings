// 罗小黑战记·重生之门 —— 卡牌内容
// 设定依据：content/worldview-data.js（abilitySystems / characters / artifacts）
// element 字段：御灵系金木水火土、生灵系、空间系、心灵系、造物系、锁御系、通用
// 卡牌机制均使用 game/actions.js 已有动作，新增卡不引入新机制。
// 馆主彩蛋：三足乌「虹（佳霖）」专属卡池（content/oc-rainbow.js），随卡池自然出现
import {ocCards} from './oc-rainbow.js'

export default [
	// ================= 基础攻击/防御（初始卡组） =================
	{
		name: '金刃',
		element: '金',
		type: 'attack',
		energy: 1,
		target: 'enemy',
		damage: 6,
		description: '造成 6 点伤害。',
		image: 'the-angel-of-death.jpg',
		upgrade() {
			this.damage = 9
			this.upgraded = true
			this.name = '金刃+'
			this.description = '造成 9 点伤害。'
		},
	},
	{
		name: '土盾',
		element: '土',
		type: 'skill',
		energy: 1,
		block: 5,
		target: 'player',
		image: 'angel-messenger.jpg',
		description: '获得 5 点格挡。',
		upgrade() {
			this.block = 8
			this.upgraded = true
			this.name = '土盾+'
			this.description = '获得 8 点格挡。'
		},
	},

	// ================= 御灵系·金 =================
	{
		name: '御金击',
		element: '金',
		type: 'attack',
		energy: 2,
		damage: 8,
		target: 'enemy',
		image: 'apteryx-mantelli.jpg',
		powers: {
			vulnerable: 2,
		},
		description: '造成 8 点伤害。施加 2 层易伤。',
		upgrade() {
			this.damage = 10
			this.upgraded = true
			this.name = '御金击+'
			this.powers.vulnerable = 3
			this.description = '造成 10 点伤害。施加 3 层易伤。'
		},
	},
	{
		name: '雷灵闪',
		element: '金',
		type: 'attack',
		energy: 1,
		damage: 4,
		target: 'allEnemies',
		powers: {
			vulnerable: 1,
		},
		description: '对所有敌人造成 4 点伤害并施加 1 层易伤。',
		image: '4.jpg',
		upgrade() {
			this.name = '雷灵闪+'
			this.damage = 6
			this.description = '对所有敌人造成 6 点伤害并施加 1 层易伤。'
		},
	},
	{
		name: '追毫',
		element: '生灵',
		type: 'skill',
		energy: 1,
		target: 'enemy',
		image: 'serpentine-dancer.jpg',
		powers: {
			vulnerable: 2,
		},
		actions: [
			{
				type: 'drawCards',
				parameter: {amount: 1},
			},
		],
		description: '施加 2 层易伤并抽 1 张牌。（鹿野·感知组追迹秘术）',
		upgrade() {
			this.name = '追毫+'
			this.powers.vulnerable = 3
			this.description = '施加 3 层易伤并抽 1 张牌。（鹿野·感知组追迹秘术）'
		},
	},

	// ================= 御灵系·木 =================
	{
		name: '木缠暗击',
		element: '木',
		type: 'attack',
		energy: 1,
		damage: 7,
		target: 'enemy',
		powers: {
			weak: 1,
		},
		description: '造成 7 点伤害。施加 1 层虚弱。',
		image: 'manicule.jpg',
		upgrade() {
			this.damage = 8
			this.upgraded = true
			this.name = '木缠暗击+'
			this.powers.weak = 2
			this.description = '造成 8 点伤害。施加 2 层虚弱。'
		},
	},
	{
		name: '木愈回春',
		element: '木',
		type: 'skill',
		energy: 2,
		target: 'player',
		description: '获得 5 层回灵。仅当生命值低于 50% 时才能打出。',
		image: '5.jpg',
		powers: {
			regen: 5,
		},
		conditions: [
			{
				type: 'healthPercentageBelow',
				percentage: 50,
			},
		],
		upgrade() {
			this.name = '木愈回春+'
			const a = this.conditions.find((action) => action.type === 'healthPercentageBelow')
			a.percentage = 75
			this.description = '获得 5 层回灵。仅当生命值低于 75% 时才能打出。'
		},
	},
	{
		name: '木缚藤蔓',
		element: '木',
		type: 'attack',
		energy: 1,
		damage: 5,
		target: 'enemy',
		powers: {
			weak: 1,
		},
		description: '造成 5 点伤害。施加 1 层虚弱。（风息·操纵植物藤蔓）',
		image: 'vernal-equinox.jpg',
		upgrade() {
			this.damage = 7
			this.upgraded = true
			this.name = '木缚藤蔓+'
			this.powers.weak = 2
			this.description = '造成 7 点伤害。施加 2 层虚弱。（风息·操纵植物藤蔓）'
		},
	},

	// ================= 御灵系·水（冰） =================
	{
		name: '铁浪',
		element: '水',
		type: 'attack',
		energy: 1,
		damage: 5,
		block: 5,
		target: 'enemy',
		description: '造成 5 点伤害。获得 5 点格挡。',
		image: 'henry-stares-back.jpg',
		upgrade() {
			this.damage = 7
			this.block = 7
			this.upgraded = true
			this.name = '铁浪+'
			this.description = '造成 7 点伤害。获得 7 点格挡。'
		},
	},
	{
		name: '冰封千里',
		element: '水',
		type: 'attack',
		energy: 2,
		damage: 8,
		target: 'enemy',
		powers: {
			weak: 2,
		},
		description: '造成 8 点伤害。施加 2 层虚弱。（阿根·操纵水与冰）',
		image: 'railway-trains-in-space.jpg',
		upgrade() {
			this.damage = 11
			this.upgraded = true
			this.name = '冰封千里+'
			this.description = '造成 11 点伤害。施加 2 层虚弱。（阿根·操纵水与冰）'
		},
	},
	{
		name: '水御·寒潮',
		element: '水',
		type: 'skill',
		energy: 1,
		target: 'player',
		block: 5,
		actions: [
			{
				type: 'drawCards',
				parameter: {amount: 1},
			},
		],
		description: '获得 5 点格挡并抽 1 张牌。（水系·柔韧绵长）',
		image: 'railway-trains-in-space.jpg',
		upgrade() {
			this.block = 8
			this.upgraded = true
			this.name = '水御·寒潮+'
			this.description = '获得 8 点格挡并抽 1 张牌。（水系·柔韧绵长）'
		},
	},

	// ================= 御灵系·火 =================
	{
		name: '紫云焰',
		element: '火',
		type: 'attack',
		energy: 2,
		damage: 11,
		target: 'enemy',
		powers: {
			weak: 1,
		},
		description: '造成 11 点伤害。施加 1 层虚弱。（谛听·紫云焰）',
		image: 'h-sperling-horrified.jpg',
		upgrade() {
			this.damage = 14
			this.upgraded = true
			this.name = '紫云焰+'
			this.description = '造成 14 点伤害。施加 1 层虚弱。（谛听·紫云焰）'
		},
	},
	{
		name: '玄离·炽焰',
		element: '火',
		type: 'attack',
		energy: 1,
		damage: 5,
		target: 'enemy',
		powers: {
			vulnerable: 1,
		},
		description: '造成 5 点伤害。施加 1 层易伤。（玄离·炎帝之徒，炽焰灼敌）',
		image: '4.jpg',
		upgrade() {
			this.damage = 7
			this.upgraded = true
			this.name = '玄离·炽焰+'
			this.powers.vulnerable = 2
			this.description = '造成 7 点伤害。施加 2 层易伤。（玄离·炎帝之徒，炽焰灼敌）'
		},
	},
	{
		name: '炎爆术',
		element: '火',
		type: 'attack',
		energy: 2,
		damage: 14,
		target: 'enemy',
		description: '引爆烈焰，造成 14 点伤害。（火系·爆发之术，一鼓作气）',
		image: 'h-sperling-horrified.jpg',
		upgrade() {
			this.damage = 17
			this.upgraded = true
			this.name = '炎爆术+'
			this.description = '引爆烈焰，造成 17 点伤害。（火系·爆发之术，一鼓作气）'
		},
	},

	// ================= 御灵系·土 =================
	{
		name: '金刚撞',
		element: '土',
		energy: 1,
		type: 'attack',
		target: 'enemy',
		description: '造成等同于你格挡值的伤害。',
		image: 'fallback.jpg',
		actions: [
			{
				type: 'dealDamageEqualToBlock',
			},
		],
		upgrade() {
			this.energy = 0
			this.name = '金刚撞+'
		},
	},
	{
		name: '土灵护体',
		element: '土',
		type: 'skill',
		energy: 2,
		target: 'player',
		block: 12,
		description: '大地厚载，获得 12 点格挡。（土系·厚重防御）',
		image: 'angel-messenger.jpg',
		upgrade() {
			this.block = 16
			this.upgraded = true
			this.name = '土灵护体+'
			this.description = '大地厚载，获得 16 点格挡。（土系·厚重防御）'
		},
	},

	// ================= 御灵系·五行分支（灵质天赋「御灵系」专属） =================
	// 设定：御灵系「最基本的能力，分支为金木水火土」（ability_branches 六大系）。
	// 选择灵质天赋「御灵系」时，按本命五行额外觉醒一张对应分支卡，体现御灵系五行分支的攻伐偏向。
	{
		name: '御金·锋锐',
		element: '金',
		type: 'attack',
		energy: 1,
		damage: 6,
		target: 'enemy',
		powers: {
			vulnerable: 1,
		},
		description: '御金之锋，造成 6 点伤害并施加 1 层易伤。（御灵系·金之分支）',
		image: '4.jpg',
		upgrade() {
			this.damage = 8
			this.upgraded = true
			this.name = '御金·锋锐+'
			this.powers.vulnerable = 2
			this.description = '御金之锋，造成 8 点伤害并施加 2 层易伤。（御灵系·金之分支）'
		},
	},
	{
		name: '御木·生长',
		element: '木',
		type: 'skill',
		energy: 1,
		target: 'player',
		block: 4,
		powers: {
			regen: 2,
		},
		description: '御木生发，获得 4 点格挡与 2 层回灵。（御灵系·木之分支）',
		image: 'vernal-equinox.jpg',
		upgrade() {
			this.block = 6
			this.upgraded = true
			this.name = '御木·生长+'
			this.powers.regen = 3
			this.description = '御木生发，获得 6 点格挡与 3 层回灵。（御灵系·木之分支）'
		},
	},
	{
		name: '御水·流转',
		element: '水',
		type: 'attack',
		energy: 1,
		damage: 4,
		block: 4,
		target: 'enemy',
		description: '御水流转，造成 4 点伤害并获得 4 点格挡。（御灵系·水之分支）',
		image: 'railway-trains-in-space.jpg',
		upgrade() {
			this.damage = 6
			this.block = 6
			this.upgraded = true
			this.name = '御水·流转+'
			this.description = '御水流转，造成 6 点伤害并获得 6 点格挡。（御灵系·水之分支）'
		},
	},
	{
		name: '御火·爆发',
		element: '火',
		type: 'attack',
		energy: 2,
		damage: 13,
		target: 'enemy',
		powers: {
			vulnerable: 1,
		},
		description: '御火引爆，造成 13 点伤害并施加 1 层易伤。（御灵系·火之分支）',
		image: 'h-sperling-horrified.jpg',
		upgrade() {
			this.damage = 16
			this.upgraded = true
			this.name = '御火·爆发+'
			this.powers.vulnerable = 2
			this.description = '御火引爆，造成 16 点伤害并施加 2 层易伤。（御灵系·火之分支）'
		},
	},
	{
		name: '御土·厚德',
		element: '土',
		type: 'skill',
		energy: 1,
		target: 'player',
		block: 7,
		powers: {
			regen: 1,
		},
		description: '御土厚载，获得 7 点格挡与 1 层回灵。（御灵系·土之分支）',
		image: 'angel-messenger.jpg',
		upgrade() {
			this.block = 10
			this.upgraded = true
			this.name = '御土·厚德+'
			this.powers.regen = 2
			this.description = '御土厚载，获得 10 点格挡与 2 层回灵。（御灵系·土之分支）'
		},
	},

	// ================= 通用 =================
	{
		name: '全攻突进',
		element: '通用',
		type: 'attack',
		energy: 0,
		damage: 14,
		target: 'enemy',
		conditions: [
			{
				type: 'onlyType',
				cardType: 'attack',
			},
		],
		description: '仅当手牌全为攻击牌时才能打出。造成 14 点伤害。',
		image: 'h-sperling-horrified.jpg',
		upgrade() {
			this.name = '全攻突进+'
			this.damage = 17
			this.description =
				'仅当手牌全为攻击牌时才能打出。造成 17 点伤害。'
		},
	},
	{
		name: '横扫',
		element: '通用',
		type: 'attack',
		energy: 1,
		damage: 8,
		target: 'allEnemies',
		description: '对所有敌人造成 8 点伤害。',
		image: 'vernal-equinox.jpg',
		upgrade() {
			this.damage = 11
			this.upgraded = true
			this.name = '横扫+'
			this.description = '对所有敌人造成 11 点伤害。'
		},
	},

	// ================= 生灵系 =================
	{
		name: '回春术',
		element: '生灵',
		type: 'skill',
		energy: 1,
		target: 'player',
		description: '恢复 1 点生命。若生命值低于 50%，抽 2 张牌。',
		image: 'bare-feet-of-god.jpg',
		actions: [
			{
				type: 'addHealth',
				parameter: {
					amount: 1,
				},
			},
			{
				type: 'drawCards',
				parameter: {
					amount: 2,
				},
				conditions: [
					{
						type: 'healthPercentageBelow',
						percentage: 50,
					},
				],
			},
		],
		upgrade() {
			this.name = '回春术+'
			this.description = '恢复 2 点生命。若生命值低于 50%，抽 2 张牌。'
			// An example of how to upgrade a local action.
			const a = this.actions.find((action) => action.type === 'addHealth')
			a.parameter.amount = 2
		},
	},
	{
		name: '治愈灵光',
		element: '生灵',
		type: 'skill',
		energy: 1,
		target: 'player',
		description: '恢复 4 点生命并获得 3 点格挡。（清凝·极致治愈）',
		image: 'ritual-rain.png',
		block: 3,
		actions: [
			{
				type: 'addHealth',
				parameter: {
					amount: 4,
				},
			},
		],
		upgrade() {
			this.name = '治愈灵光+'
			this.block = 5
			this.description = '恢复 4 点生命并获得 5 点格挡。（清凝·极致治愈）'
		},
	},
	{
		name: '眷灵',
		element: '生灵',
		type: 'skill',
		energy: 1,
		target: 'player',
		description: '获得 2 层回灵并抽 1 张牌。（老君·吸收空间逸散之灵）',
		image: 'soul-drain.png',
		powers: {
			regen: 2,
		},
		actions: [
			{
				type: 'drawCards',
				parameter: {amount: 1},
			},
		],
		upgrade() {
			this.name = '眷灵+'
			this.powers.regen = 3
			this.description = '获得 3 层回灵并抽 1 张牌。（老君·吸收空间逸散之灵）'
		},
	},
	{
		name: '噬灵术',
		element: '生灵',
		type: 'attack',
		energy: 3,
		target: 'allEnemies',
		description: '对所有敌人造成 2 点伤害，并将其转化为生命。',
		image: 'succube.png',
		damage: 2,
		actions: [
			{
				type: 'addRegenEqualToAllDamage',
			},
		],
		upgrade() {
			this.name = '高等噬灵术'
			this.description = '对所有敌人造成 3 点伤害，并将其转化为生命。'
			this.damage = 3
		},
	},
	{
		name: '净灵之雨',
		element: '生灵',
		type: 'skill',
		energy: 2,
		target: 'player',
		description: '移除自身的虚弱与易伤。',
		image: 'ritual-rain.png',
		damage: 0,
		actions: [
			{
				type: 'removePlayerDebuffs',
			},
		],
		upgrade() {
			this.name = '终焉净雨'
			this.description = '移除自身的虚弱与易伤。获得 10 点格挡。'
			this.block = 10
		},
	},
	{
		name: '豪夺',
		element: '生灵',
		type: 'attack',
		energy: 2,
		damage: 8,
		target: 'enemy',
		description: '造成 8 点伤害并获得 2 层回灵。（风息·掠夺性最强之术）',
		image: 'succube.png',
		powers: {
			regen: 2,
		},
		upgrade() {
			this.damage = 10
			this.upgraded = true
			this.name = '豪夺+'
			this.powers.regen = 3
			this.description = '造成 10 点伤害并获得 3 层回灵。（风息·掠夺性最强之术）'
		},
	},
	{
		name: '散灵诀',
		element: '生灵',
		type: 'attack',
		energy: 1,
		damage: 5,
		target: 'enemy',
		description: '造成 5 点伤害，削减目标 3 层回灵与 2 层力量。（虹·散灵秘术，克制吐纳回灵之敌）',
		image: 'succube.png',
		actions: [
			{
				type: 'reducePower',
				parameter: {
					power: 'monsterRegen',
					amount: 3,
				},
			},
			{
				type: 'reducePower',
				parameter: {
					power: 'strength',
					amount: 2,
				},
			},
		],
		upgrade() {
			this.damage = 7
			this.upgraded = true
			this.name = '散灵诀+'
			this.description = '造成 7 点伤害，削减目标 4 层回灵与 3 层力量。（虹·散灵秘术，克制吐纳回灵之敌）'
			this.actions = [
				{
					type: 'reducePower',
					parameter: {
						power: 'monsterRegen',
						amount: 4,
					},
				},
				{
					type: 'reducePower',
					parameter: {
						power: 'strength',
						amount: 3,
					},
				},
			]
		},
	},

	// ================= 强化系（生灵系分支）=================
	{
		name: '巨力',
		element: '生灵',
		type: 'attack',
		energy: 1,
		target: 'enemy',
		description: '造成 5 点伤害并获得 2 层力量。（强化系·巨力，越战越强）',
		image: 'succube.png',
		damage: 5,
		powers: {
			strength: 2,
		},
		upgrade() {
			this.name = '巨力+'
			this.damage = 7
			this.powers.strength = 3
			this.description = '造成 7 点伤害并获得 3 层力量。（强化系·巨力，越战越强）'
		},
	},

	// ================= 心灵系 =================
	{
		name: '摄魂术',
		element: '心灵',
		type: 'attack',
		energy: 1,
		target: 'allEnemies',
		description: '消耗自身 3 点生命，对所有敌人施加虚弱与易伤。',
		image: 'soul-drain.png',
		damage: 0,
		powers: {
			weak: 3,
			vulnerable: 3,
		},
		actions: [
			{
				type: 'removeHealth',
				parameter: {
					amount: 3,
					target: 'player',
				},
			},
		],
		upgrade() {
			this.name = '深层摄魂术'
			this.description = '消耗自身 4 点生命，对所有敌人施加虚弱与易伤。'
			this.powers.vulnerable = 4
			this.powers.weak = 4
			this.actions = [
				{
					type: 'removeHealth',
					parameter: {
						amount: 4,
						target: 'player',
					},
				},
			]
		},
	},
	{
		name: '咒术化解',
		element: '心灵',
		energy: 0,
		type: 'attack',
		target: 'enemy',
		description: '造成等同于目标易伤与虚弱层数的伤害，随后移除这些减益。',
		image: 'voodoo-education.png',
		actions: [
			{
				type: 'dealDamageEqualToWeak',
			},
			{
				type: 'dealDamageEqualToVulnerable',
			},
			{
				type: 'setPower',
				parameter: {
					power: 'weak',
					amount: 0,
				},
			},
			{
				type: 'setPower',
				parameter: {
					power: 'vulnerable',
					amount: 0,
				},
			},
		],
		upgrade() {
			this.name = '咒术馈赠'
			// remove the "reset of monster power"
			this.description = '造成等同于目标易伤与虚弱层数的伤害，且不移除减益。'
			this.actions = [
				{
					type: 'dealDamageEqualToWeak',
				},
				{
					type: 'dealDamageEqualToVulnerable',
				},
			]
		},
	},
	{
		name: '灵誓',
		element: '心灵',
		type: 'skill',
		energy: 2,
		target: 'enemy',
		description: '宣读灵誓束缚敌人：施加 3 层虚弱与 3 层易伤。接誓者必须遵从。（老君·双系合技）',
		image: 'mask-of-the-faceless.png',
		powers: {
			weak: 3,
			vulnerable: 3,
		},
		upgrade() {
			this.name = '灵誓+'
			this.powers.weak = 4
			this.powers.vulnerable = 4
			this.description = '宣读灵誓束缚敌人：施加 4 层虚弱与 4 层易伤。接誓者必须遵从。（老君·双系合技）'
		},
	},

	// ================= 造物系 =================
	{
		name: '无相面具',
		element: '造物',
		type: 'skill',
		energy: 0,
		target: 'player',
		description: '获得 1 点能量。',
		image: 'mask-of-the-faceless.png',
		damage: 0,
		actions: [
			{
				type: 'addEnergyToPlayer',
			},
		],
		upgrade() {
			this.description = '获得 1 点能量和 5 点格挡。'
			this.name = '无相双面'
			this.block = 5
		},
	},
	{
		name: '画灵',
		element: '造物',
		type: 'attack',
		energy: 1,
		damage: 6,
		block: 3,
		target: 'enemy',
		description: '以灵造物：造成 6 点伤害并获得 3 点格挡。（生灵系+造物系·双系合技）',
		image: 'manicule.jpg',
		upgrade() {
			this.damage = 8
			this.block = 4
			this.upgraded = true
			this.name = '画灵+'
			this.description = '以灵造物：造成 8 点伤害并获得 4 点格挡。（生灵系+造物系·双系合技）'
		},
	},

	// ================= 空间系 =================
	{
		name: '瞬移',
		element: '空间',
		type: 'skill',
		energy: 1,
		target: 'player',
		description: '空间传送：抽 2 张牌。（小黑·传送）',
		image: 'codices.jpg',
		actions: [
			{
				type: 'drawCards',
				parameter: {amount: 2},
			},
		],
		upgrade() {
			this.name = '瞬移+'
			this.energy = 0
			this.description = '空间传送：抽 2 张牌。（小黑·传送）'
		},
	},
	{
		name: '吞噬之域',
		element: '空间',
		type: 'attack',
		energy: 2,
		damage: 5,
		block: 5,
		target: 'enemy',
		description: '展开吞噬：造成 5 点伤害并获得 5 点格挡。（无限·空间系吞噬）',
		image: 'alice-holds-the-white-king.jpg',
		upgrade() {
			this.damage = 7
			this.block = 7
			this.upgraded = true
			this.name = '吞噬之域+'
			this.description = '展开吞噬：造成 7 点伤害并获得 7 点格挡。（无限·空间系吞噬）'
		},
	},
	{
		name: '领域·展开',
		element: '空间',
		type: 'skill',
		energy: 3,
		target: 'player',
		description: '展开灵质领域：获得 8 点格挡与 3 层回灵。（领域·灵质空间庇护）',
		image: 'vernal-equinox.jpg',
		block: 8,
		powers: {
			regen: 3,
		},
		upgrade() {
			this.name = '领域·固守'
			this.block = 12
			this.description = '展开灵质领域：获得 12 点格挡与 3 层回灵。（领域·灵质空间庇护）'
		},
	},

	// ================= 锁御系（法宝） =================
	{
		name: '定心镜',
		element: '锁御',
		type: 'skill',
		energy: 0,
		target: 'player',
		description: '法宝定心：获得 4 点格挡，并移除自身的虚弱与易伤。（谛听·老君所赐）',
		image: 'mask-of-the-faceless.png',
		block: 4,
		actions: [
			{
				type: 'removePlayerDebuffs',
			},
		],
		upgrade() {
			this.name = '定心镜·守'
			this.block = 7
			this.description = '法宝定心：获得 7 点格挡，并移除自身的虚弱与易伤。（谛听·老君所赐）'
		},
	},
	{
		name: '蓝玉盘',
		element: '空间',
		type: 'skill',
		energy: 2,
		target: 'player',
		description: '法宝位移：获得 8 点格挡并抽 1 张牌。（罗小白·老君所赠空间系法宝）',
		image: '2.jpg',
		block: 8,
		actions: [
			{
				type: 'drawCards',
				parameter: {amount: 1},
			},
		],
		upgrade() {
			this.name = '蓝玉盘+'
			this.block = 10
			this.description = '法宝位移：获得 10 点格挡并抽 1 张牌。（罗小白·老君所赠空间系法宝）'
		},
	},

	// ================= 角色专属卡（世界观数据库 character_abilities_ext 提取） =================
	// 设定依据：worldview_luoxiaohei_v4.db character_abilities_ext 各角色能力描述，
	// 机制复用 game/actions.js 已有动作，未引入新效果。

	// 罗小黑·分身黑咻（生灵系-分身）
	{
		name: '黑咻·分身',
		element: '生灵',
		type: 'skill',
		energy: 1,
		target: 'player',
		description: '尾巴化作黑咻护主：获得 4 点格挡并抽 1 张牌。（罗小黑·分身黑咻）',
		image: 't.jpg',
		block: 4,
		actions: [
			{
				type: 'drawCards',
				parameter: {amount: 1},
			},
		],
		upgrade() {
			this.name = '黑咻·分身+'
			this.block = 6
			this.description = '尾巴化作黑咻护主：获得 6 点格挡并抽 1 张牌。（罗小黑·分身黑咻）'
		},
	},
	// 无限·金系剑击（空间系-吞噬 / 御灵系-金）
	{
		name: '剑域·斩',
		element: '金',
		type: 'attack',
		energy: 1,
		damage: 7,
		target: 'enemy',
		description: '金系剑光一闪，造成 7 点伤害。（执行者·无限）',
		image: 'the-angel-of-death.jpg',
		upgrade() {
			this.name = '剑域·斩+'
			this.damage = 10
			this.description = '金系剑光一闪，造成 10 点伤害。（执行者·无限）'
		},
	},
	// 风息·金系缚阵（御灵系-金）
	{
		name: '风息·金缚',
		element: '金',
		type: 'attack',
		energy: 2,
		damage: 9,
		target: 'enemy',
		powers: {
			vulnerable: 2,
		},
		description: '金系缚阵困敌，造成 9 点伤害并施加 2 层易伤。（风息）',
		image: 'serpentine-dancer.jpg',
		upgrade() {
			this.name = '风息·金缚+'
			this.damage = 11
			this.powers.vulnerable = 3
			this.description = '金系缚阵困敌，造成 11 点伤害并施加 3 层易伤。（风息）'
		},
	},
	// 哪吒·火尖枪（御灵系-火）
	{
		name: '火尖枪·破',
		element: '火',
		type: 'attack',
		energy: 1,
		damage: 8,
		target: 'enemy',
		description: '火尖枪直刺，造成 8 点伤害。（哪吒）',
		image: 'a-line-of-composed-type.jpg',
		upgrade() {
			this.name = '火尖枪·破+'
			this.damage = 11
			this.description = '火尖枪直刺，造成 11 点伤害。（哪吒）'
		},
	},
	// 玄离·冰火双域（御灵系-冰/火，双灵质空间）
	{
		name: '冰火双域',
		element: '火',
		type: 'attack',
		energy: 2,
		damage: 8,
		target: 'enemy',
		powers: {
			weak: 1,
		},
		description: '冰火双域交替压制，造成 8 点伤害并施加 1 层虚弱。（玄离）',
		image: '6.jpg',
		upgrade() {
			this.name = '冰火双域+'
			this.damage = 10
			this.powers.weak = 2
			this.description = '冰火双域交替压制，造成 10 点伤害并施加 2 层虚弱。（玄离）'
		},
	},
	// 李清凝·治愈系（生灵系-治愈系）
	{
		name: '清凝仙术',
		element: '生灵',
		type: 'skill',
		energy: 2,
		target: 'player',
		description: '仙家医术温养，回复 12 点生命。（李清凝·治愈系）',
		image: 'ritual-rain.png',
		actions: [
			{
				type: 'addHealth',
				parameter: {amount: 12},
			},
		],
		upgrade() {
			this.name = '清凝仙术+'
			this.description = '仙家医术温养，回复 16 点生命。（李清凝·治愈系）'
			this.actions[0].parameter.amount = 16
		},
	},
	// 比丢·吞噬（能吞噬除金属和生物外的一切物质）
	{
		name: '团鼠·吞灵',
		element: '生灵',
		type: 'attack',
		energy: 1,
		damage: 6,
		target: 'enemy',
		description: '团鼠吞下灵质：造成 6 点伤害并护住自身 3 点格挡。（比丢）',
		image: '5.jpg',
		block: 3,
		upgrade() {
			this.name = '团鼠·吞灵+'
			this.damage = 8
			this.block = 4
			this.description = '团鼠吞下灵质：造成 8 点伤害并护住自身 4 点格挡。（比丢）'
		},
	},
	// 七臂·锁御系七星（锁御系-七星）
	{
		name: '七星锁',
		element: '锁御',
		type: 'skill',
		energy: 1,
		target: 'enemy',
		powers: {
			weak: 2,
		},
		description: '锁御七星封印敌妖，施加 2 层虚弱。（七臂·锁御系）',
		image: 'codices.jpg',
		upgrade() {
			this.name = '七星锁+'
			this.powers.weak = 3
			this.description = '锁御七星封印敌妖，施加 3 层虚弱。（七臂·锁御系）'
		},
	},
	// 东东·空间系时滞（加快自身时间流速）
	{
		name: '时滞·加速',
		element: '空间',
		type: 'skill',
		energy: 2,
		target: 'player',
		description: '加快自身时间流速：回复 1 点能量并抽 1 张牌。（东东·空间时滞）',
		image: 'railway-trains-in-space.jpg',
		actions: [
			{
				type: 'addEnergyToPlayer',
			},
			{
				type: 'drawCards',
				parameter: {amount: 1},
			},
		],
		upgrade() {
			this.name = '时滞·加速+'
			this.description = '加快自身时间流速：回复 1 点能量并抽 2 张牌。（东东·空间时滞）'
			this.actions[1].parameter.amount = 2
		},
	},
	// 白虎·上古神兽体质（创世级神兽）
	{
		name: '白虎·啸',
		element: '金',
		type: 'attack',
		energy: 3,
		damage: 20,
		target: 'enemy',
		description: '上古神兽咆哮，造成 20 点伤害。（白虎·创世级神兽）',
		image: 'bare-feet-of-god.jpg',
		upgrade() {
			this.name = '白虎·啸+'
			this.damage = 26
			this.description = '上古神兽咆哮，造成 26 点伤害。（白虎·创世级神兽）'
		},
	},

	// ================= 五行补强·木（世界观数据库 character_abilities_ext 提取） =================
	// 木灵愈生：御灵系·木「生机盎然」，老君《蓝溪镇》第136话「生灵在其空间内消耗灵力便可不断变强」
	{
		name: '木灵愈生',
		element: '木',
		type: 'skill',
		energy: 1,
		target: 'player',
		description: '催生木灵滋养自身：获得 3 层回灵并抽 1 张牌。（木系·生机生长）',
		image: 'vernal-equinox.jpg',
		powers: {
			regen: 3,
		},
		actions: [
			{
				type: 'drawCards',
				parameter: {amount: 1},
			},
		],
		upgrade() {
			this.name = '木灵愈生+'
			this.powers.regen = 4
			this.description = '催生木灵滋养自身：获得 4 层回灵并抽 1 张牌。（木系·生机生长）'
		},
	},
	// 古树盘根：御灵系·木「操纵植物藤蔓」（风息），以根须缚敌
	{
		name: '古树盘根',
		element: '木',
		type: 'skill',
		energy: 1,
		target: 'enemy',
		block: 5,
		powers: {
			weak: 1,
		},
		description: '古树根须破土缠敌：获得 5 点格挡并施加 1 层虚弱。（风息·操纵植物藤蔓）',
		image: 'manicule.jpg',
		upgrade() {
			this.name = '古树盘根+'
			this.block = 8
			this.powers.weak = 2
			this.description = '古树根须破土缠敌：获得 8 点格挡并施加 2 层虚弱。（风息·操纵植物藤蔓）'
		},
	},
	// 玄离·冰晶：御灵系·冰「操纵水与冰」（玄离），凝聚冰晶掷敌
	{
		name: '冰晶·玄离',
		element: '水',
		type: 'attack',
		energy: 1,
		damage: 6,
		target: 'enemy',
		description: '凝水成冰掷向敌人，造成 6 点伤害并施加 1 层虚弱。（玄离·御灵系冰）',
		image: 'railway-trains-in-space.jpg',
		powers: {
			weak: 1,
		},
		upgrade() {
			this.name = '冰晶·玄离+'
			this.damage = 8
			this.powers.weak = 2
			this.description = '凝水成冰掷向敌人，造成 8 点伤害并施加 2 层虚弱。（玄离·御灵系冰）'
		},
	},
	// 清泉·双刃：御灵系·水「武器：双刀」（清泉），刀光如水绵长
	{
		name: '清泉·双刃',
		element: '水',
		type: 'attack',
		energy: 1,
		damage: 5,
		target: 'enemy',
		description: '双刀如水流连绵，造成 5 点伤害并抽 1 张牌。（清泉·御灵系水·双刀）',
		image: 'serpentine-dancer.jpg',
		actions: [
			{
				type: 'drawCards',
				parameter: {amount: 1},
			},
		],
		upgrade() {
			this.name = '清泉·双刃+'
			this.damage = 7
			this.description = '双刀如水流连绵，造成 7 点伤害并抽 1 张牌。（清泉·御灵系水·双刀）'
		},
	},
	// 芷清·土壁：御灵系·土（芷清），厚土为壁
	{
		name: '芷清·土壁',
		element: '土',
		type: 'skill',
		energy: 2,
		target: 'player',
		block: 14,
		description: '引大地厚土筑起壁垒，获得 14 点格挡。（芷清·御灵系土）',
		image: 'angel-messenger.jpg',
		upgrade() {
			this.name = '芷清·土壁+'
			this.block = 18
			this.description = '引大地厚土筑起壁垒，获得 18 点格挡。（芷清·御灵系土）'
		},
	},
	// 叶子·地刺：御灵系·土（叶子），地刺突袭
	{
		name: '叶子·地刺',
		element: '土',
		type: 'attack',
		energy: 1,
		damage: 7,
		target: 'enemy',
		description: '大地裂开刺出岩锥，造成 7 点伤害并施加 1 层易伤。（叶子·御灵系土）',
		image: 'fallback.jpg',
		powers: {
			vulnerable: 1,
		},
		upgrade() {
			this.name = '叶子·地刺+'
			this.damage = 9
			this.powers.vulnerable = 2
			this.description = '大地裂开刺出岩锥，造成 9 点伤害并施加 2 层易伤。（叶子·御灵系土）'
		},
	},
	// 池年·重塑：御灵系·土「极强的自我修复能力」（池年）
	{
		name: '池年·重塑',
		element: '土',
		type: 'skill',
		energy: 1,
		target: 'player',
		block: 4,
		powers: {
			regen: 2,
		},
		description: '大地之力重塑躯体，获得 4 点格挡与 2 层回灵。（池年·御灵系土·自我修复）',
		image: 'ritual-rain.png',
		upgrade() {
			this.name = '池年·重塑+'
			this.block = 6
			this.powers.regen = 3
			this.description = '大地之力重塑躯体，获得 6 点格挡与 3 层回灵。（池年·御灵系土·自我修复）'
		},
	},
	// 龙岩·岩崩：变化/形态操控「土/岩系能力」（龙岩），兽形撼地
	{
		name: '龙岩·岩崩',
		element: '土',
		type: 'attack',
		energy: 2,
		damage: 13,
		target: 'enemy',
		description: '兽形态引动岩崩，造成 13 点伤害。（龙岩·土/岩系能力）',
		image: 'a-line-of-composed-type.jpg',
		upgrade() {
			this.name = '龙岩·岩崩+'
			this.damage = 17
			this.description = '兽形态引动岩崩，造成 17 点伤害。（龙岩·土/岩系能力）'
		},
	},

	// ================= 心灵系·补充（读心/傀儡/戏梦） =================
	// 读心：心灵系基础能力「与精神力相关，包括读心」（ability_branches 六大系）
	{
		name: '读心',
		element: '心灵',
		type: 'skill',
		energy: 1,
		target: 'enemy',
		powers: {
			weak: 2,
		},
		actions: [
			{
				type: 'drawCards',
				parameter: {amount: 1},
			},
		],
		description: '窥探敌人心思，施加 2 层虚弱并抽 1 张牌。（心灵系·读心）',
		image: 'soul-drain.png',
		upgrade() {
			this.name = '读心+'
			this.powers.weak = 3
			this.description = '窥探敌人心思，施加 3 层虚弱并抽 1 张牌。（心灵系·读心）'
		},
	},
	// 傀儡术：心灵系「心灵操纵、傀儡」（ability_branches 六大系）
	{
		name: '傀儡术',
		element: '心灵',
		type: 'attack',
		energy: 1,
		damage: 5,
		target: 'enemy',
		powers: {
			weak: 2,
		},
		description: '以丝线牵制敌人，造成 5 点伤害并施加 2 层虚弱。（心灵系·傀儡）',
		image: 'voodoo-education.png',
		upgrade() {
			this.name = '傀儡术+'
			this.damage = 7
			this.powers.weak = 3
			this.description = '以丝线牵制敌人，造成 7 点伤害并施加 3 层虚弱。（心灵系·傀儡）'
		},
	},
	// 戏梦：心灵系「传音/傀儡/戏梦/摄心」（六大系说明）
	{
		name: '戏梦',
		element: '心灵',
		type: 'skill',
		energy: 1,
		target: 'enemy',
		powers: {
			vulnerable: 2,
			weak: 2,
		},
		description: '以幻梦惑敌，施加 2 层易伤与 2 层虚弱。（心灵系·戏梦）',
		image: 'succube.png',
		upgrade() {
			this.name = '戏梦+'
			this.powers.vulnerable = 3
			this.powers.weak = 3
			this.description = '以幻梦惑敌，施加 3 层易伤与 3 层虚弱。（心灵系·戏梦）'
		},
	},

	// ================= 造物系·补充（重构/无中生有） =================
	// 重构：造物系「重构物体，改变物体性质、样貌」（ability_branches 六大系）
	{
		name: '重构',
		element: '造物',
		type: 'skill',
		energy: 1,
		target: 'player',
		block: 6,
		actions: [
			{
				type: 'drawCards',
				parameter: {amount: 1},
			},
		],
		description: '重构物质化守为攻，获得 6 点格挡并抽 1 张牌。（造物系·重构）',
		image: 'manicule.jpg',
		upgrade() {
			this.name = '重构+'
			this.block = 9
			this.description = '重构物质化守为攻，获得 9 点格挡并抽 1 张牌。（造物系·重构）'
		},
	},
	// 无中生有：造物系「可以靠灵质空间中的物质灵无中生有」（ability_branches 六大系）
	{
		name: '无中生有',
		element: '造物',
		type: 'skill',
		energy: 1,
		target: 'player',
		actions: [
			{
				type: 'addEnergyToPlayer',
			},
			{
				type: 'drawCards',
				parameter: {amount: 1},
			},
		],
		description: '以物质灵凭空造物，获得 1 点能量并抽 1 张牌。（造物系·无中生有）',
		image: 'mask-of-the-faceless.png',
		upgrade() {
			this.name = '无中生有+'
			this.actions = [
				{
					type: 'addEnergyToPlayer',
				},
				{
					type: 'drawCards',
					parameter: {amount: 2},
				},
			]
			this.description = '以物质灵凭空造物，获得 1 点能量并抽 2 张牌。（造物系·无中生有）'
		},
	},

	// ================= 锁御系·补充（阵法/灵御） =================
	// 封灵阵：锁御系「法宝/灵器/阵法」（六大系说明）
	{
		name: '封灵阵',
		element: '锁御',
		type: 'skill',
		energy: 1,
		target: 'allEnemies',
		powers: {
			weak: 2,
			vulnerable: 2,
		},
		description: '以阵法压制全场敌人，施加 2 层虚弱与 2 层易伤。（锁御系·阵法）',
		image: 'ritual-rain.png',
		upgrade() {
			this.name = '封灵阵+'
			this.powers.weak = 3
			this.powers.vulnerable = 3
			this.description = '以阵法压制全场敌人，施加 3 层虚弱与 3 层易伤。（锁御系·阵法）'
		},
	},
	// 御灵环：锁御系「与法宝、法器相关的能力，如灵御、制灵」（ability_branches 六大系）
	{
		name: '御灵环',
		element: '锁御',
		type: 'skill',
		energy: 1,
		target: 'player',
		block: 7,
		powers: {
			regen: 1,
		},
		description: '以御灵法器护体，获得 7 点格挡与 1 层回灵。（锁御系·灵御）',
		image: 'angel-messenger.jpg',
		upgrade() {
			this.name = '御灵环+'
			this.block = 10
			this.description = '以御灵法器护体，获得 10 点格挡与 1 层回灵。（锁御系·灵御）'
		},
	},
	// —— 馆主彩蛋 · 三足乌「虹（佳霖）」专属卡（content/oc-rainbow.js）——
	...ocCards,
]
