// 罗小黑战记·重生之门 —— 「灵质修行」法器灵物遗物池（世界观扩充）
// 设定来源：assets\罗小黑战记数据库\db\worldview_luoxiaohei_v4.db
//   spirit_lifecycle 表（法器灵物/技能设定），筛选有明确设定的 15 件法器灵物。
// 结构严格对齐 content/lingzhi-xiuxing.js 的 lingzhiRelics：{id, name, cost, desc, effect}
// id 统一使用 faqi- 前缀避免与现有遗物 id 冲突；cost 为残片解锁消耗（60~120）。
// effect 仅使用引擎已支持字段：
//   attackBonus / lingAttackBonus / startStrength / startDraw /
//   firstCardFree / overflowDamage / startBlock（startBlock 固定每回合 +2 格挡）
// 2026-08-31 扩充：法器灵物遗物池（15 件），与现有 8 件遗物合并进入灵质修行遗物池。

export const lingzhiArtifactRelics = [
	{
		id: 'faqi-tianmingzhu',
		name: '天明珠',
		cost: 100,
		desc: '老君誓言录中的至宝，须挑战玄离方可得之。战斗开始获得 1 层力量。',
		effect: {startStrength: 1},
	},
	{
		id: 'faqi-lanyupan',
		name: '蓝玉盘',
		cost: 95,
		desc: '老君耳饰，空间系顶级法宝，可将人转移至曾标记之处。战斗开始多抽 1 张牌。',
		effect: {startDraw: 1},
	},
	{
		id: 'faqi-dingxinjing',
		name: '定心镜',
		cost: 85,
		desc: '可辨真伪的明镜，洞察先机。每回合首张牌消耗 0。',
		effect: {firstCardFree: true},
	},
	{
		id: 'faqi-qiongyuandun',
		name: '琼圆盾',
		cost: 90,
		desc: '号称无妖能破的护体法宝，自动触发防护。每回合开始时获得 2 点格挡。',
		effect: {startBlock: 2},
	},
	{
		id: 'faqi-biyujia',
		name: '碧玉甲',
		cost: 95,
		desc: '与琼圆盾相类的贴身护甲，失去意识亦会触发护主。回合结束溢出格挡转伤。',
		effect: {overflowDamage: true},
	},
	{
		id: 'faqi-fangcunhe',
		name: '方寸盒',
		cost: 75,
		desc: '内藏一方空间的空间法器。战斗开始多抽 1 张牌。',
		effect: {startDraw: 1},
	},
	{
		id: 'faqi-yuchan',
		name: '预蝉',
		cost: 80,
		desc: '感知危险便会预警的灵蝉。每回合开始时获得 2 点格挡。',
		effect: {startBlock: 2},
	},
	{
		id: 'faqi-qiankundai',
		name: '乾坤袋',
		cost: 90,
		desc: '收纳万物的储物法宝，内含无主灵质空间。战斗开始多抽 1 张牌。',
		effect: {startDraw: 1},
	},
	{
		id: 'faqi-ruomu',
		name: '若木',
		cost: 100,
		desc: '坚硬如铁、蕴含灵力的神木，可破妖精之躯。全攻击 +1。',
		effect: {attackBonus: 1},
	},
	{
		id: 'faqi-fenghuoqiankunjuan',
		name: '风火乾坤圈',
		cost: 110,
		desc: '哪吒的法宝，尺寸可变、可分可合。全攻击 +1。',
		effect: {attackBonus: 1},
	},
	{
		id: 'faqi-suolingjia',
		name: '锁灵枷',
		cost: 85,
		desc: '束缚封锁之器，可锁灵克敌。名含「灵」的灵术伤害 +1。',
		effect: {lingAttackBonus: 1},
	},
	{
		id: 'faqi-lingzhu',
		name: '灵珠',
		cost: 90,
		desc: '蕴含磅礴灵力的神器宝珠。名含「灵」的灵术伤害 +1。',
		effect: {lingAttackBonus: 1},
	},
	{
		id: 'faqi-benminglingshi',
		name: '本命灵石',
		cost: 100,
		desc: '与妖精本命相连的灵石，性命交修。战斗开始获得 1 层力量。',
		effect: {startStrength: 1},
	},
	{
		id: 'faqi-xuanqingdan',
		name: '玄清丹',
		cost: 105,
		desc: '收入老君誓言录中的丹药，须逼老君出手方可得之。战斗开始获得 1 层力量。',
		effect: {startStrength: 1},
	},
	{
		id: 'faqi-qinglingguo',
		name: '青灵果',
		cost: 85,
		desc: '生于锁御宫中的灵果，服之灵觉通明。战斗开始多抽 1 张牌。',
		effect: {startDraw: 1},
	},
]
