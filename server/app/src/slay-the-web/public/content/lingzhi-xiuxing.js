// 罗小黑战记·重生之门 —— 「灵质修行」活动独立数据
// 独立于主游戏卡池/遗物池/角色/进度系统，进入灵质回路试炼后使用本文件数据。
// 设定来源：用户提供的「灵质修行」活动截图（残片解锁页/修行图鉴页/修行成就页/主界面），
// 数值与文案均以截图及任务规格为准，未编造截图外设定。
// 同人设定标注：本活动为同人创作内容，与官方世界观独立。
// 2026-08-30 扩充：卡池新增世界观「六大系」御灵能力卡（御灵系金木水火土/空间系/心灵系/双系合技），
// 设定来源：assets\罗小黑战记数据库\db\worldview_luoxiaohei_v4.db
//   ability_systems：六大系（御灵系/生灵系/造物系/空间系/心灵系/锁御系）
//   ability_branches：御灵系分支（金=攻击/木=生长/水=控制/火=爆发/土=防御）、空间系（传送/领域/吞噬）、
//     心灵系（读心/傀儡）、双系合技（画灵=生灵+造物、灵誓=生灵+心灵）
//   character_abilities：小黑/无限（御灵系·金）、风息（御灵系·木）、老君（心灵系·洞察）等角色能力参照
// 卡牌仍以 element='通用' 参与灵质修行独立引擎（不触发主游戏五行共鸣），
// 系别通过 tags（如【金系】【木系】）与 desc 世界观化文案体现。
// 2026-08-31 扩充：新增「法器灵物」遗物池（content/lingzhi-relics.js，15 件），
//   设定来源：世界观数据库 spirit_lifecycle 表，与既有 8 件遗物合并参与灵质修行。
import {lingzhiArtifactRelics} from './lingzhi-relics.js'

// ============ 角色池 ============
// id: 唯一标识；name: 角色名；cost: 残片解锁消耗（行者 0=默认解锁）；
// desc: 特性描述；starterCards: 起始卡组（对应灵术卡池 name）；
// passive: 开局被动（strength 力量层数 / regen 回灵层数 / drawExtra 额外抽牌）
export const lingzhiCharacters = [
	{
		id: 'walker',
		name: '行者',
		cost: 0,
		desc: '修行者：战斗开始获得 1 层力量。以基础灵术稳步推进。',
		starterCards: ['焰击', '焰击', '藤击', '连击', '灵脉', '裂隙', '裂隙'],
		passive: {name: '修行者', desc: '战斗开始获得 1 层力量', strength: 1},
	},
	{
		id: 'summoner',
		name: '唤灵师',
		cost: 120,
		desc: '开战灵火仆；铺场后以聚灵/固灵养灵协同输出。',
		starterCards: ['灵群', '灵群', '焰击', '焰击', '灵脉', '灵脉', '裂隙'],
		passive: {name: '灵火仆', desc: '开战灵火仆助战，获得 1 层力量', strength: 1},
	},
	{
		id: 'vitalist',
		name: '生息师',
		cost: 150,
		desc: '以再生与即时治疗拉长续航。',
		starterCards: ['盾涌', '盾涌', '藤击', '藤击', '灵脉', '灵脉', '裂隙'],
		passive: {name: '再生', desc: '战斗开始获得 1 层回灵，每回合回复 1 生命', regen: 1},
	},
	{
		id: 'painter',
		name: '绘灵师',
		cost: 150,
		desc: '以灵墨速写造物，战斗开始多抽一张。',
		starterCards: ['绘涌', '绘涌', '藤击', '连击', '灵脉', '灵脉', '裂隙'],
		passive: {name: '灵墨速写', desc: '战斗开始多抽 1 张牌', drawExtra: 1},
	},
	{
		id: 'riftwalker',
		name: '裂隙术士',
		cost: 150,
		desc: '操控裂隙折跃，开战法强+1，折壳/虚语逐步建立控场。',
		starterCards: ['裂隙', '裂隙', '裂隙', '藤击', '灵脉', '灵脉', '盾涌'],
		passive: {name: '折跃法强', desc: '开战法强+1，获得 1 层力量', strength: 1},
	},
	{
		id: 'mindreader',
		name: '读心者',
		cost: 150,
		desc: '读绪探心、削弱敌人意图。',
		starterCards: ['藤击', '藤击', '连击', '连击', '灵脉', '灵脉', '裂隙'],
		passive: {name: '读绪', desc: '读绪探心，洞察敌人意图', strength: 0},
	},
]

// ============ 灵术卡池 ============
// name: 卡名；element: 通用（不参与五行共鸣）；type: attack/skill/power；
// energy: 费用；target: CardTargets 字符串（player/enemy/allEnemies）；
// damage/block: 基础数值；desc: 描述文案（与截图一致）；
// tags: 标签（【】内的关键词，供遗物联动）；cost: 残片解锁消耗（0=默认解锁）；
// cardId: 卡池内部稳定 id（createCard 使用）
export const lingzhiCards = [
	{
		cardId: 'yanji',
		name: '焰击',
		element: '通用',
		type: 'attack',
		energy: 1,
		target: 'enemy',
		damage: 7,
		desc: '造成 7 点伤害。',
		tags: ['灵击'],
		cost: 0,
	},
	{
		cardId: 'tengji',
		name: '藤击',
		element: '通用',
		type: 'attack',
		energy: 1,
		target: 'enemy',
		damage: 5,
		desc: '造成 5 点伤害；对目标施加 1 层虚弱（2回合）。',
		tags: ['灵击'],
		cost: 0,
		actions: [{type: 'lingzhiWeak', amount: 1}],
	},
	{
		cardId: 'lianji',
		name: '连击',
		element: '通用',
		type: 'attack',
		energy: 1,
		target: 'enemy',
		damage: 4,
		desc: '造成 4 点伤害；本战每使用过 1 张【灵击】【心流击】等攻击牌 +2 伤。',
		tags: ['心流击'],
		cost: 0,
		actions: [{type: 'lingzhiCombo', base: 4, per: 2}],
	},
	{
		cardId: 'lingmai',
		name: '灵脉',
		element: '通用',
		type: 'attack',
		energy: 1,
		target: 'allEnemies',
		damage: 1,
		desc: '对所有敌人造成 1 点伤害；抽 1 张牌；消耗。',
		tags: ['灵脉'],
		cost: 0,
		exhaust: true,
		actions: [{type: 'drawCards', amount: 1}],
	},
	{
		cardId: 'liexi',
		name: '裂隙',
		element: '通用',
		type: 'attack',
		energy: 1,
		target: 'enemy',
		damage: 9,
		desc: '造成 9 点伤害。',
		tags: ['裂隙'],
		cost: 0,
	},
	{
		cardId: 'dunyong',
		name: '盾涌',
		element: '通用',
		type: 'skill',
		energy: 1,
		target: 'player',
		block: 14,
		desc: '获得 14 点格挡；格挡超过 12 的部分转伤。',
		tags: ['盾涌'],
		cost: 70,
		actions: [{type: 'lingzhiShieldSurge', block: 14, cap: 12}],
	},
	{
		cardId: 'xinchao',
		name: '心潮',
		element: '通用',
		type: 'power',
		energy: 1,
		target: 'enemy',
		desc: '能力：每次行动开始时本牌伤害 +1。',
		tags: ['心印'],
		cost: 80,
		actions: [{type: 'lingzhiHeartTide', base: 1}],
	},
	{
		cardId: 'lingqun',
		name: '灵群',
		element: '通用',
		type: 'attack',
		energy: 1,
		target: 'allEnemies',
		damage: 2,
		desc: '对所有敌人造成 2 点伤害；卡组中每张【灵斩】【唤灵】【灵爆】等 +1 伤；消耗。',
		tags: ['唤灵'],
		cost: 60,
		exhaust: true,
		actions: [{type: 'lingzhiSwarm', base: 2}],
	},
	{
		cardId: 'huiyong',
		name: '绘涌',
		element: '通用',
		type: 'attack',
		energy: 1,
		target: 'enemy',
		damage: 6,
		desc: '造成 6 点伤害；本战每使用过 1 张攻击牌 +1 伤；消耗。',
		tags: ['造物击'],
		cost: 65,
		exhaust: true,
		actions: [{type: 'lingzhiCombo', base: 6, per: 1}],
	},

	// ========== 世界观「六大系」御灵能力卡（2026-08-30 扩充） ==========
	// 设定来源：worldview 数据库 ability_systems / ability_branches / character_abilities。
	// 御灵系：金（攻击）、木（生长/控制）、水（控制/变化）、火（爆发）、土（防御）；
	// 空间系（传送/领域）、心灵系（读心）、双系合技（画灵=生灵+造物、灵誓=生灵+心灵）。

	// —— 御灵系·金（操纵金属，代表：无限、小黑）——
	{
		cardId: 'jinfeng',
		name: '金锋',
		element: '通用',
		type: 'attack',
		energy: 1,
		target: 'enemy',
		damage: 8,
		desc: '以金系灵质凝成锋刃，造成 8 点伤害。',
		tags: ['灵斩', '金系'],
		cost: 60,
	},
	{
		cardId: 'tieyu',
		name: '铁羽',
		element: '通用',
		type: 'attack',
		energy: 0,
		target: 'enemy',
		damage: 4,
		desc: '驭铁化羽，造成 4 点伤害；本战每使用过 1 张攻击牌 +1 伤。',
		tags: ['灵击', '金系'],
		cost: 65,
		actions: [{type: 'lingzhiCombo', base: 4, per: 1}],
	},

	// —— 御灵系·木（操控植物/生长，代表：小黑、风息）——
	{
		cardId: 'tengfu',
		name: '藤缚',
		element: '通用',
		type: 'attack',
		energy: 1,
		target: 'enemy',
		damage: 4,
		desc: '催生藤蔓缠缚敌人，造成 4 点伤害；施加 2 层虚弱（2回合）。',
		tags: ['灵击', '木系'],
		cost: 55,
		actions: [{type: 'lingzhiWeak', amount: 2}],
	},
	{
		cardId: 'fansheng',
		name: '繁生',
		element: '通用',
		type: 'skill',
		energy: 1,
		target: 'player',
		block: 10,
		desc: '木灵蓬勃生长为盾，获得 10 点格挡。',
		tags: ['木系', '生长'],
		cost: 60,
	},

	// —— 御灵系·水（控制/变化）——
	{
		cardId: 'bingxin',
		name: '冰心',
		element: '通用',
		type: 'skill',
		energy: 1,
		target: 'player',
		block: 8,
		desc: '水灵凝冰护体，获得 8 点格挡；对敌人施加 1 层虚弱（2回合）。',
		tags: ['水系', '定绪'],
		cost: 65,
		actions: [{type: 'lingzhiWeak', amount: 1}],
	},
	{
		cardId: 'chaoyong',
		name: '潮涌',
		element: '通用',
		type: 'attack',
		energy: 2,
		target: 'allEnemies',
		damage: 7,
		desc: '灵潮奔涌，对所有敌人造成 7 点伤害。',
		tags: ['灵斩', '水系'],
		cost: 80,
	},

	// —— 御灵系·火（爆发）——
	{
		cardId: 'yanbao',
		name: '焰爆',
		element: '通用',
		type: 'attack',
		energy: 2,
		target: 'enemy',
		damage: 16,
		desc: '火灵聚于一点轰然爆开，造成 16 点伤害。',
		tags: ['灵斩', '火系'],
		cost: 75,
	},
	{
		cardId: 'yujin',
		name: '余烬',
		element: '通用',
		type: 'attack',
		energy: 1,
		target: 'enemy',
		damage: 5,
		desc: '爆燃后的余温，造成 5 点伤害；抽 1 张牌。',
		tags: ['心流击', '火系'],
		cost: 70,
		actions: [{type: 'drawCards', amount: 1}],
	},

	// —— 御灵系·土（防御）——
	{
		cardId: 'yanlei',
		name: '岩垒',
		element: '通用',
		type: 'skill',
		energy: 1,
		target: 'player',
		block: 12,
		desc: '土灵凝岩成垒，获得 12 点格挡。',
		tags: ['土系'],
		cost: 60,
	},

	// —— 空间系（传送/领域，代表：小黑传送+领域、无限吞噬）——
	{
		cardId: 'zheyue',
		name: '折跃',
		element: '通用',
		type: 'skill',
		energy: 0,
		target: 'player',
		desc: '空间折跃，抽 2 张牌；消耗。',
		tags: ['空间系', '裂隙'],
		cost: 80,
		exhaust: true,
		actions: [{type: 'drawCards', amount: 2}],
	},
	{
		cardId: 'xujie',
		name: '虚界',
		element: '通用',
		type: 'power',
		energy: 1,
		target: 'player',
		block: 8,
		desc: '外放灵质空间一角护体，获得 8 点格挡；抽 1 张牌。',
		tags: ['空间系', '心印'],
		cost: 85,
		actions: [{type: 'drawCards', amount: 1}],
	},

	// —— 心灵系（读心，代表：老君·洞察）——
	{
		cardId: 'duxin',
		name: '读心',
		element: '通用',
		type: 'skill',
		energy: 0,
		target: 'player',
		desc: '静心读绪、洞察敌人，抽 1 张牌。',
		tags: ['读绪', '心灵系'],
		cost: 70,
		actions: [{type: 'drawCards', amount: 1}],
	},

	// —— 双系合技（ability_systems·双系合技）——
	{
		cardId: 'lingshi',
		name: '灵誓',
		element: '通用',
		type: 'attack',
		energy: 1,
		target: 'enemy',
		damage: 6,
		desc: '宣读灵誓，令敌我皆受约束，造成 6 点伤害；施加 2 层虚弱（2回合）；抽 1 张牌。',
		tags: ['心印', '心灵系'],
		cost: 90,
		actions: [
			{type: 'lingzhiWeak', amount: 2},
			{type: 'drawCards', amount: 1},
		],
	},
	{
		cardId: 'hualing',
		name: '画灵',
		element: '通用',
		type: 'attack',
		energy: 1,
		target: 'enemy',
		damage: 5,
		desc: '以灵墨速写造物，造成 5 点伤害；本战每使用过 1 张攻击牌 +2 伤；消耗。',
		tags: ['造物击', '双系'],
		cost: 90,
		exhaust: true,
		actions: [{type: 'lingzhiCombo', base: 5, per: 2}],
	},
]

// ============ 遗物池 ============
// id: 唯一标识；name: 遗物名；cost: 残片解锁消耗（0=默认解锁）；
// desc: 效果描述（与截图一致）；effect: 引擎识别的被动效果键
//   startBlock 回合开始格挡 / attackBonus 全攻击 +1 / startStrength 开战力量 +1 /
//   startDraw 开战额外抽牌 / lingAttackBonus 名含「灵」攻击 +1 /
//   firstCardFree 每回合首张牌消耗 0 / overflowDamage 回合结束溢出格挡转伤
export const lingzhiRelics = [
	{
		id: 'jiemao',
		name: '界锚',
		cost: 0,
		desc: '每回合开始时获得 2 点格挡。',
		effect: {startBlock: 2},
	},
	{
		id: 'huijudai',
		name: '绘具袋',
		cost: 0,
		desc: '【画灵】【造物击】【绘群】等伤害 +1。',
		effect: {attackBonus: 1},
	},
	{
		id: 'zhanqi',
		name: '战旗',
		cost: 60,
		desc: '战斗开始力量 +1。',
		effect: {startStrength: 1},
	},
	{
		id: 'lingjing',
		name: '灵镜',
		cost: 65,
		desc: '战斗开始抽 1 张牌。',
		effect: {startDraw: 1},
	},
	{
		id: 'lingqi',
		name: '灵契',
		cost: 70,
		desc: '【灵斩】【唤灵】【灵爆】等伤害 +1。',
		effect: {lingAttackBonus: 1},
	},
	{
		id: 'xinlengjing',
		name: '心棱镜',
		cost: 75,
		desc: '每回合首张【读绪】【定绪】【心印】等标签牌消耗 0。',
		effect: {firstCardFree: true},
	},
	{
		id: 'baxinpian',
		name: '坝心片',
		cost: 90,
		desc: '回合结束格挡≥14 时，溢出格挡转伤。',
		effect: {overflowDamage: true},
	},
	{
		id: 'lingchao',
		name: '灵潮',
		cost: 100,
		desc: '【御灵】牌伤害 +1。',
		effect: {attackBonus: 1},
	},
]

// 合并遗物池：既有 8 件 + 世界观法器灵物 15 件（供引擎奖励池/解锁页/图鉴统一使用）
export const allLingzhiRelics = [...lingzhiRelics, ...lingzhiArtifactRelics]

// ============ 修行成就 ============
// id: 唯一标识；name: 成就名；group: 分组；condition: 达成条件文案；
// check: 引擎判定用的 progress 函数名（engine 实现）；desc: 描述；
// reward: 领取奖励残片数
export const lingzhiAchievements = [
	{
		id: 'chuta',
		name: '初踏灵质',
		group: '修行历程',
		condition: '累计开始修行 1 次',
		reward: 10,
		desc: '迈入灵质回路的第一步。',
	},
	{
		id: 'chuzheng',
		name: '初证圆满',
		group: '修行历程',
		condition: '累计通关 1 次',
		reward: 50,
		desc: '完成一次完整的灵质回路试炼。',
	},
	{
		id: 'qinxue',
		name: '勤学不辍',
		group: '修行历程',
		condition: '累计开始修行 10 次',
		reward: 30,
		desc: '坚持修行十次。',
	},
	{
		id: 'wujie',
		name: '五劫圆满',
		group: '修行历程',
		condition: '累计通关 5 次',
		reward: 80,
		desc: '五度击破守门，功德圆满。',
	},
	{
		id: 'xingzhe',
		name: '行者证道',
		group: '角色证道',
		condition: '使用【行者】首次通关',
		reward: 40,
		desc: '以行者之姿完成修行。',
	},
	{
		id: 'xinqi',
		name: '新契觉醒',
		group: '残片收藏',
		condition: '首次残片解锁一名角色',
		reward: 25,
		desc: '与新角色缔结灵契。',
	},
	{
		id: 'shushi',
		name: '术式初开',
		group: '残片收藏',
		condition: '首次残片解锁一张灵术卡',
		reward: 20,
		desc: '习得一门新的灵术。',
	},
	{
		id: 'yiwu',
		name: '遗物结缘',
		group: '残片收藏',
		condition: '首次残片解锁一件遗物',
		reward: 20,
		desc: '与一件遗物结下缘分。',
	},
	{
		id: 'jixing',
		name: '疾行证道',
		group: '极限挑战',
		condition: '在 20 分钟内完成一次通关',
		reward: 60,
		desc: '行云流水，速通回路。',
	},
	{
		id: 'aozhan',
		name: '鏖战不休',
		group: '极限挑战',
		condition: '单场战斗持续 15 回合以上并获胜',
		reward: 35,
		desc: '苦战至最后一刻仍屹立不倒。',
	},
]

// 统计（供图鉴/主界面展示）
export const lingzhiStats = {
	characters: lingzhiCharacters.length,
	cards: lingzhiCards.length,
	relics: lingzhiRelics.length + lingzhiArtifactRelics.length,
	achievements: lingzhiAchievements.length,
	totalCollectibles: lingzhiCharacters.length + lingzhiCards.length + lingzhiRelics.length + lingzhiArtifactRelics.length,
}
