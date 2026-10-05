import Dungeon from '../game/dungeon.js'
import {MonsterRoom, Monster} from '../game/dungeon-rooms.js'
import {random} from '../game/utils.js'
import {applyDifficultyToDungeon} from './difficulty.js'

// 罗小黑战记·重生之门 —— 敌人与遭遇
// 敌人名称与设定对齐 content/worldview-data.js 的 characters / spiritLifecycle 条目
// （离岛组织、府先生一伙、那伽灵主、灵偶等），数值沿用原 Slay-the-Web 难度曲线。

// This is the dungeon currently used.
// difficulty：trial（试炼）/ normal（历练，默认）/ rebirth（轮回），
// 由 difficulty.js 的 applyDifficultyToDungeon 在生成后按倍率缩放怪物血量。
// guild：出身分馆 id（可空），传入 Dungeon 使事件房可触发本馆支援事件（见 guild-branches.js）。
export const dungeonWithMap = (difficulty, guild) => {
	return applyDifficultyToDungeon(
		Dungeon({
			width: 6,
			height: 10,
			minRooms: 3,
			maxRooms: 4,
			customPaths: '0235',
			guild,
		}),
		difficulty
	)
}

// This is the dungeon used in tests. Don't change it without running tests.
export const createTestDungeon = () => {
	const dungeon = Dungeon({width: 1, height: 3})
	// The tests rely on the first room having a single monster, second two monsters.
	const intents = [{block: 7}, {damage: 10}, {damage: 8}, {}, {damage: 14}]
	dungeon.graph[1][0].room = MonsterRoom(Monster({hp: 42, intents}))
	dungeon.graph[2][0].room = MonsterRoom(Monster({hp: 24, intents}), Monster({hp: 13, intents}))
	dungeon.graph[3][0].room = MonsterRoom(Monster({hp: 42, intents}))
	return dungeon
}

// Here are some different monsters we use in the game.

export const easyMonsters = {}
export const monsters = {}
export const elites = {}
export const bosses = {}

// —— 第 1-2 层 小怪：离岛喽啰 / 灵偶 / 团鼠 ——

easyMonsters['离岛小妖'] = MonsterRoom(
	Monster({
		name: '离岛小妖',
		skill: '藤蔓缠绕',
		element: '木',
		hp: random(8, 13),
		intents: [{damage: 7}, {damage: 11}, {damage: 7}, {block: 9}],
		random: 2,
	})
)
easyMonsters['离岛小妖 x2'] = MonsterRoom(
	Monster({
		name: '离岛小妖',
		skill: '藤蔓缠绕',
		element: '木',
		hp: random(8, 13),
		intents: [{damage: 7}, {damage: 11}, {damage: 7}, {block: 9}],
		random: 2,
	}),
	Monster({
		name: '离岛小妖',
		skill: '藤蔓缠绕',
		element: '木',
		hp: random(8, 13),
		intents: [{damage: 6}, {damage: 11}, {damage: 5}, {block: 5}],
		random: 1,
	})
)
easyMonsters['灵偶·木人'] = MonsterRoom(
	Monster({
		name: '灵偶·木人',
		skill: '催生',
		element: '木',
		hp: random(10, 14),
		intents: [{damage: 6}, {regen: 2}, {damage: 6}, {damage: 3}, {block: 4}],
		random: 2,
	})
)
easyMonsters['团鼠·暴走'] = MonsterRoom(
	Monster({
		name: '团鼠·暴走',
		skill: '地陷',
		element: '土',
		hp: random(9, 13),
		intents: [{damage: 5}, {damage: 8}, {damage: 5}, {block: 5}],
		random: 1,
	}),
	Monster({
		name: '团鼠·暴走',
		skill: '地陷',
		element: '土',
		hp: random(7, 11),
		intents: [{damage: 6}, {block: 4}, {damage: 7}],
		random: 1,
	})
)

// —— 普通怪：离岛成员 / 府先生一伙 / 恶妖 ——

monsters['天虎'] = MonsterRoom(
	Monster({
		name: '天虎',
		skill: '烈焰',
		element: '火',
		hp: random(33, 37),
		intents: [{vulnerable: 1}, {strength: 2}, {damage: 10}, {damage: 6}, {weak: 1}],
		random: 2,
	})
)
monsters['洛竹'] = MonsterRoom(
	Monster({
		name: '洛竹',
		skill: '缚灵',
		element: '木',
		hp: random(28, 32),
		intents: [{weak: 1}, {damage: 9}, {damage: 6}, {}, {weak: 1}],
		random: 2,
	}),
	Monster({
		name: '离岛小妖',
		skill: '藤蔓缠绕',
		element: '木',
		hp: random(13, 17),
		intents: [{damage: 7}, {block: 4, damage: 8}, {damage: 6}, {}, {block: 6}],
		random: 2,
	})
)
monsters['黑咻'] = MonsterRoom(
	Monster({
		name: '黑咻',
		skill: '雾隐',
		element: '水',
		hp: random(20, 24),
		intents: [{damage: 8}, {block: 5}, {damage: 8, block: 4}, {damage: 10}],
		random: 2,
	}),
	Monster({
		name: '黑咻·分裂体',
		skill: '分裂',
		element: '木',
		hp: random(10, 14),
		intents: [{damage: 5}, {damage: 7}, {block: 3}],
		random: 1,
	})
)
monsters['破老'] = MonsterRoom(
	Monster({
		name: '破老',
		skill: '岩壁',
		element: '土',
		hp: random(45, 50),
		// 平衡审计(2026-08-26)：原单发 21 超过精英层峰值(19)，下调至 16；
		// 配合岩壁(每回合+5格挡)与 weak 仍属普通怪中最难缠的一档。
		intents: [{weak: 1}, {block: 10, damage: 10}, {damage: 16}],
	})
)
monsters['青丘'] = MonsterRoom(
	Monster({
		name: '青丘',
		skill: '烈焰',
		element: '火',
		hp: random(26, 30),
		intents: [{vulnerable: 1}, {damage: 6}, {damage: 9}, {block: 10}],
		random: 2,
	}),
	Monster({
		name: '团鼠·暴走',
		skill: '地陷',
		element: '土',
		hp: random(12, 15),
		intents: [{damage: 6}],
		random: 2,
	})
)
monsters['恶妖·缠藤'] = MonsterRoom(
	Monster({
		name: '恶妖·缠藤',
		skill: '缠藤',
		element: '木',
		hp: random(28, 32),
		intents: [{damage: 8}, {weak: 1}, {strength: 1}, {block: 8, damage: 6}, {damage: 10}],
		random: 3,
	})
)
monsters['虚淮'] = MonsterRoom(
	Monster({
		name: '虚淮',
		skill: '寒潮',
		element: '水',
		hp: random(30, 34),
		intents: [{damage: 8}, {weak: 1, damage: 7}, {block: 6, damage: 9}, {damage: 12}],
		random: 2,
	})
)
monsters['兆岳'] = MonsterRoom(
	Monster({
		name: '兆岳',
		skill: '地陷',
		element: '土',
		hp: random(36, 40),
		intents: [{block: 8}, {damage: 10}, {strength: 2}, {block: 6, damage: 8}, {damage: 13}],
		random: 2,
	})
)

// —— 普通怪扩充（第 3-6 层）：谛听鹰犬 / 卡里灵植 / 大爽转移 / 众生之门玩家 / 罗家岙 ——
// 设定提取自 worldview-data.js 的 characters：
//   谛听（上古神兽，三匹会变黄色翅膀的侦查鹰犬）、卡里（灵溪馆长，木系催生树木）、
//   大爽（龙游会馆，空间系·转移）、山新（众生之门玩家，多系杂学）、
//   罗小白（天生怪力 + 老君所赠蓝玉盘）、三叔（罗家岙，肉盾/体力型）。

monsters['谛听·侦查鹰犬'] = MonsterRoom(
	Monster({
		name: '谛听·侦查鹰犬',
		skill: '烈焰',
		element: '火',
		hp: random(24, 28),
		intents: [{damage: 7}, {block: 6, damage: 5}, {damage: 9}, {weak: 1, damage: 6}],
		random: 2,
	}),
	Monster({
		name: '谛听·侦查鹰犬',
		skill: '烈焰',
		element: '火',
		hp: random(22, 26),
		intents: [{damage: 6}, {damage: 8}, {block: 5}, {damage: 9, block: 3}],
		random: 2,
	})
)
monsters['卡里·灵植守卫'] = MonsterRoom(
	Monster({
		name: '卡里·灵植守卫',
		skill: '催生',
		element: '木',
		hp: random(30, 34),
		intents: [{regen: 3}, {damage: 8}, {block: 7, damage: 6}, {regen: 2, damage: 7}],
		random: 2,
	})
)
monsters['大爽·定点转移'] = MonsterRoom(
	Monster({
		name: '大爽·定点转移',
		skill: '转移',
		element: '水',
		hp: random(28, 32),
		intents: [{block: 12}, {damage: 8}, {block: 6, damage: 6}, {damage: 10}, {block: 10}],
		random: 2,
	})
)
monsters['山新·游戏玩家'] = MonsterRoom(
	Monster({
		name: '山新·游戏玩家',
		skill: '烈焰',
		element: '火',
		hp: random(24, 28),
		intents: [{damage: 7}, {weak: 1, damage: 5}, {damage: 9}, {block: 4, damage: 6}, {damage: 11}],
		random: 2,
	}),
	Monster({
		name: '罗小白·蓝玉盘',
		skill: '蓝玉盘',
		element: '金',
		hp: random(22, 26),
		intents: [{block: 6}, {damage: 6}, {damage: 8, block: 4}, {damage: 10}],
		random: 2,
	})
)
monsters['三叔·横扫千军'] = MonsterRoom(
	Monster({
		name: '三叔·横扫千军',
		skill: '横扫',
		element: '土',
		hp: random(42, 46),
		intents: [{block: 8}, {damage: 12}, {block: 5, damage: 8}, {damage: 15}, {strength: 1}],
		random: 3,
	})
)

// —— 精英：离岛首领 / 那伽灵主 / 府先生 / 执行者 ——

elites['风息·豪夺'] = MonsterRoom(
	Monster({
		name: '风息·豪夺',
		skill: '豪夺',
		element: '木',
		hp: 46,
		intents: [{damage: 12}, {strength: 3, damage: 10}, {block: 5, damage: 16}, {}, {block: 6}],
	})
)
elites['那伽·灵主'] = MonsterRoom(
	Monster({
		name: '那伽·灵主',
		skill: '渊啸',
		element: '水',
		hp: 60,
		intents: [{damage: 12}, {damage: 11, weak: 1}, {strength: 2}, {damage: 4, block: 6}],
		random: 6,
	})
)
elites['千针'] = MonsterRoom(
	Monster({
		name: '千针',
		skill: '针雨',
		element: '金',
		hp: 52,
		intents: [{damage: 9}, {block: 8}, {damage: 11}, {vulnerable: 2}, {damage: 14}],
	})
)
elites['灵质守卫'] = MonsterRoom(Monster({
	name: '灵质守卫',
		skill: '岩壁',
	element: '土',
	hp: 70,
	block: 12,
	intents: [{block: 5}, {damage: 16}],
}))
elites['三妖众'] = MonsterRoom(
	Monster({
		name: '府先生·酒仙',
		skill: '烈焰',
		element: '火',
		hp: random(39, 46),
		intents: [{weak: 1}, {damage: 10}],
	}),
	Monster({
		name: '府先生·千针',
		skill: '针雨',
		element: '金',
		hp: random(39, 46),
		intents: [{damage: 10}, {weak: 1}],
	}),
	Monster({
		name: '府先生·破老',
		skill: '岩壁',
		element: '土',
		hp: random(39, 46),
		intents: [{weak: 1}, {damage: 10}],
	})
)
elites['执行者·剑与土'] = MonsterRoom(
	Monster({
		name: '执行者·白宜',
		skill: '剑阵',
		element: '土',
		hp: random(42, 48),
		intents: [{damage: 11}, {damage: 9, block: 4}, {damage: 14}, {block: 8}],
		random: 3,
	}),
	Monster({
		name: '执行者·乙',
		skill: '岩壁',
		element: '土',
		hp: random(38, 44),
		intents: [{damage: 8}, {block: 9}, {regen: 3}, {damage: 10}, {block: 6, damage: 6}],
		random: 2,
	})
)

// —— 精英扩充（第 5-8 层）：鹿野追毫 / 鸠老造物 / 哪吒三头六臂 / 斗帅宫妖王 ——
// 设定提取自 worldview-data.js 的 characters：
//   鹿野（感知组组长，金系金属操控 + 生灵系·追毫，体术极强）、
//   鸠老（执行者，生灵系·洞察 + 造物系·仿生）、
//   哪吒（妖灵会馆创始人之一，御灵系·火 + 生灵系·幻化三头六臂）、
//   昊天（斗帅宫妖王，曾在斗帅宫与玄离大战并落败）。

elites['鹿野·追毫锁定'] = MonsterRoom(
	Monster({
		name: '鹿野·追毫锁定',
		skill: '追毫',
		element: '金',
		hp: 58,
		intents: [{vulnerable: 2, damage: 8}, {damage: 12}, {block: 8, damage: 10}, {vulnerable: 1, damage: 14}, {damage: 16}],
		random: 3,
		quote: '追毫已锁定，你跑不掉的。',
		phase2Quote: '全图锁定！感知组的追迹，无人可逃。',
		// 第二阶段「追毫·全图锁定」：感知组组长彻底展开追踪术，持续施加易伤并高速连击。
		phase2: [
			{vulnerable: 2, damage: 12},
			{damage: 16},
			{vulnerable: 2},
			{damage: 12, block: 8},
			{damage: 20},
			{weak: 1, damage: 14},
		],
	})
)
elites['鸠老·造物仿生'] = MonsterRoom(
	Monster({
		name: '鸠老·造物仿生',
		skill: '仿生',
		element: '金',
		hp: 62,
		intents: [{block: 10}, {damage: 10}, {regen: 3}, {damage: 13}, {block: 8, damage: 8}],
		random: 3,
	}),
	Monster({
		name: '鸠老·仿生兽',
		skill: '冲撞',
		element: '金',
		hp: random(24, 28),
		intents: [{damage: 8}, {damage: 10}, {block: 4, damage: 6}],
		random: 2,
	})
)
elites['哪吒·三头六臂'] = MonsterRoom(
	Monster({
		name: '哪吒·三头六臂',
		skill: '三头六臂',
		element: '火',
		hp: 70,
		intents: [{damage: 10}, {damage: 8, block: 6}, {damage: 13}, {vulnerable: 2, damage: 8}, {damage: 15}],
		random: 3,
		quote: '三头六臂一开，你接得住几招？',
		phase2Quote: '三头六臂全开——接招！',
		// 第二阶段「三头六臂·全力」：火力全开，攻击频率与力度全面提升。
		phase2: [
			{damage: 14},
			{damage: 12, block: 6},
			{vulnerable: 2, damage: 12},
			{damage: 18},
			{weak: 2, damage: 10},
			{damage: 22},
		],
	})
)
elites['昊天·斗帅宫妖王'] = MonsterRoom(
	Monster({
		name: '昊天·斗帅宫妖王',
		skill: '妖王怒',
		element: '金',
		hp: 78,
		intents: [{strength: 2}, {block: 10}, {damage: 12}, {strength: 2, damage: 8}, {damage: 16}],
		random: 4,
		quote: '斗帅宫一败，今日来讨回来。',
		phase2Quote: '妖王暴怒！斗帅宫之威，今日讨还！',
		// 第二阶段「妖王暴怒」：力量持续堆叠，重击伤害不断攀升。
		phase2: [
			{strength: 3},
			{damage: 16},
			{block: 8, damage: 14},
			{strength: 2, damage: 12},
			{damage: 24},
			{vulnerable: 2, damage: 16},
			{damage: 30},
		],
	})
)

// —— 精英扩充（第 7-8 层元婴/化神）：木落仙人 / 冬冬 / 孙悟空 / 西木子 ——
// 设定提取自 worldview_luoxiaohei_v4.db characters 表：
//   木落仙人（妖灵会馆长老，空间系·巨灵阵，可令物质变小，能拉人入灵质空间）、
//   冬冬（妖灵会馆龙游，空间系·时滞，加速自身时间流速高速行动）、
//   孙悟空（妖王后成神，实力深不可测，老君评价"一般般"）、
//   西木子（苍南会馆五大长老之一，锁御系 + 心灵系·戏梦，精神干涉与局势掌控）。

elites['木落仙人·巨灵阵'] = MonsterRoom(
	Monster({
		name: '木落仙人·巨灵阵',
		skill: '巨灵阵',
		element: '木',
		// 平衡审计(2026-08-26)：原 HP72 + 每回合巨灵阵+6格挡 拖长战，下调至 66。
		hp: 66,
		intents: [
			{weak: 2, damage: 8},
			{block: 12},
			{damage: 12},
			{vulnerable: 2, damage: 10},
			{block: 8, damage: 12},
			{damage: 18},
		],
		random: 3,
		quote: '巨灵阵下，万物皆可化小。',
		phase2Quote: '巨灵阵·尽收——变小吧！',
		// 第二阶段「巨灵阵·尽收」：阵势全开，将闯入者灵质不断压缩——虚弱与易伤交替，攻势渐猛。
		phase2: [
			{weak: 2, damage: 12},
			{block: 10, damage: 10},
			{vulnerable: 2, damage: 14},
			{damage: 20},
			{weak: 2, damage: 16},
			{damage: 26},
		],
	})
)
elites['冬冬·时滞'] = MonsterRoom(
	Monster({
		name: '冬冬·时滞',
		skill: '时滞',
		element: '水',
		hp: 58,
		intents: [
			{damage: 8},
			{damage: 6, block: 4},
			{damage: 12},
			{damage: 8},
			{damage: 6},
			{block: 8},
			{damage: 16},
		],
		random: 3,
		quote: '我的时间，比你的快。',
		phase2Quote: '时滞加速——我的时间，你追不上！',
		// 第二阶段「时滞·加速」：自身时间流速进一步加快，高频连击并穿插格挡，逼迫玩家抢节奏。
		phase2: [
			{damage: 12},
			{damage: 10, block: 4},
			{damage: 14},
			{damage: 10},
			{damage: 8},
			{block: 6, damage: 12},
			{damage: 20},
		],
	})
)
elites['孙悟空·斗帅妖王'] = MonsterRoom(
	Monster({
		name: '孙悟空·斗帅妖王',
		skill: '三昧火',
		element: '火',
		hp: 84,
		intents: [
			{strength: 2},
			{damage: 14},
			{block: 10},
			{damage: 12, vulnerable: 1},
			{damage: 18},
			{weak: 1, damage: 12},
		],
		random: 4,
		quote: '俺老孙，也来闯一闯这重生之门。',
		phase2Quote: '金箍镇灵！俺老孙认真了！',
		// 第二阶段「金箍·镇灵」：妖王真正发力，力量持续堆叠，重击与易伤交替压上。
		phase2: [
			{strength: 3},
			{damage: 18},
			{block: 8, damage: 14},
			{vulnerable: 2, damage: 16},
			{damage: 24},
			{strength: 2, damage: 18},
			{damage: 32},
		],
	})
)
elites['西木子·戏梦'] = MonsterRoom(
	Monster({
		name: '西木子·戏梦',
		skill: '戏梦',
		element: '木',
		hp: 66,
		intents: [
			{weak: 2},
			{damage: 10},
			{vulnerable: 2, damage: 8},
			{block: 10, damage: 8},
			{damage: 14},
			{weak: 2, damage: 10},
		],
		random: 3,
		quote: '此间是梦，醒来便忘了。',
		phase2Quote: '戏梦锁魂——醒来前，把梦做完！',
		// 第二阶段「戏梦·锁魂」：锁御系全面展开，虚弱与易伤循环压制，伤害稳步抬升。
		phase2: [
			{weak: 2, damage: 12},
			{vulnerable: 2, damage: 10},
			{block: 8, damage: 12},
			{weak: 3},
			{damage: 18},
			{vulnerable: 2, damage: 16},
			{damage: 24},
		],
	})
)

// —— Boss：离岛首领 / 那伽领域 / 流石之影 / 重生之门 ——

bosses['离岛首领·风息'] = MonsterRoom(
	Monster({
		name: '离岛首领·风息',
		skill: '豪夺',
		element: '木',
		hp: random(100, 140),
		intents: [{damage: 16}, {block: 6}, {damage: 16}, {damage: 7}, {weak: 2}],
		random: 5,
		quote: '人类夺走了我们的家园……我只是，想要回家。',
		phase2Quote: '豪夺！你的灵质空间……归我了！',
		// 第二阶段「豪夺·灵质吞噬」：夺取他人灵质空间的力量，攻势转为狂暴，
		// 交替施压并持续堆叠力量——拖得越久越危险。
		phase2: [
			{damage: 18, block: 8},
			{vulnerable: 2, damage: 12},
			{damage: 26},
			{strength: 2, damage: 10},
			{weak: 2, damage: 12},
			{damage: 30},
		],
	})
)
bosses['那伽·领域'] = MonsterRoom(
	Monster({
		name: '那伽·领域',
		skill: '渊啸',
		element: '水',
		hp: 62,
		intents: [
			{damage: 5},
			{damage: 8},
			{damage: 12},
			{damage: 17},
			{damage: 23},
			{damage: 30},
			{damage: 38},
			{damage: 45},
		],
		quote: '踏进吾的领域，生死便由吾说了算。',
		phase2Quote: '渊啸！北域三百年的寒，尽数沸腾！',
		// 第二阶段「渊啸·领域沸腾」：北域寒气彻底沸腾，伤害曲线整体抬高且提速，
		// 并穿插格挡与虚弱——逼迫玩家尽快终结战斗。
		phase2: [
			{damage: 10},
			{damage: 15},
			{block: 10, damage: 14},
			{damage: 22},
			{weak: 2, damage: 16},
			{damage: 30},
			{damage: 40},
			{damage: 52},
		],
	})
)
bosses['重生之门·门灵'] = MonsterRoom(
	Monster({
		name: '重生之门·门灵',
		skill: '聚灵',
		element: '金',
		hp: 120,
		intents: [{damage: 14}, {vulnerable: 2}, {heal: 15, strength: 3}, {block: 12, damage: 10}, {damage: 18}],
		random: 4,
		quote: '聚灵而生，散灵而归——穿过此门，窥见轮回。',
		phase2Quote: '门扉已开——聚灵者归于我，散灵者亦归于我。',
		// 第二阶段「门扉全开」：聚灵与散灵的边界彻底洞开，门灵进入狂暴，
		// 频繁回灵蓄力并施加易伤/虚弱，回响也随门扉强化。
		phase2: [
			{damage: 20},
			{vulnerable: 2, damage: 10},
			{heal: 20, strength: 4},
			{block: 8, damage: 16},
			{weak: 3, damage: 14},
			{damage: 28},
		],
	}),
	Monster({
		name: '门灵·回响',
		skill: '回响',
		element: '金',
		hp: 40,
		intents: [{weak: 2}, {regen: 3}, {block: 10}, {damage: 12}],
		random: 2,
		quote: '门扉之后，皆是回响……',
	})
)
bosses['灵遥·流石之影'] = MonsterRoom(
	Monster({
		name: '灵遥·流石之影',
		skill: '断金阵',
		element: '土',
		hp: random(110, 130),
		intents: [
			{damage: 12},
			{block: 14},
			{damage: 10, weak: 1},
			{damage: 18},
			{block: 10, damage: 8},
		],
		random: 3,
		quote: '妖精的未来，不该由人类的战争来决定。',
		phase2Quote: '断金阵起！人类，此路不通。',
		// 第二阶段「断金阵·夺灵」：灵遥展开断金阵，并以夺灵强化自身——
		// 攻防交替、持续堆叠力量并施加易伤，拖得越久越难破解。
		phase2: [
			{damage: 16},
			{vulnerable: 2, damage: 10},
			{block: 12, damage: 12},
			{strength: 3},
			{damage: 22},
			{weak: 2, damage: 14},
			{damage: 30},
		],
	})
)

// —— Boss：高阶大能（第9层「重生之门」最终 Boss 池扩充）——
// 设定提取自 worldview_luoxiaohei_v4.db characters 表：
//   老君（封神妖精，眷灵/灵誓/读心）、无限（最强执行者，金系+空间系吞噬）、
//   玄离（冰火双灵质空间，炎域圣火）。

bosses['老君·灵誓试炼'] = MonsterRoom(
	Monster({
		name: '老君·灵誓试炼',
		skill: '灵誓',
		element: '火',
		hp: random(130, 160),
		intents: [
			{block: 12},
			{damage: 10},
			{heal: 12},
			{vulnerable: 2},
			{damage: 16},
		],
		random: 3,
		quote: '小友莫急，先陪老朽论一论灵誓。',
		phase2Quote: '眷灵缚魂——孩子，你的道心，可曾动摇？',
		// 第二阶段「眷灵·缚魂」：老君以眷灵吸收空间生灵反哺自身，并以灵誓具象化
		// 束缚闯入者——回灵蓄力与心灵压制交替，拖得越久越接近"誓言即死"。
		phase2: [
			{weak: 2, damage: 12},
			{heal: 16, strength: 2},
			{block: 14},
			{damage: 18},
			{vulnerable: 2, damage: 14},
			{damage: 24},
		],
	})
)
bosses['执行者·无限'] = MonsterRoom(
	Monster({
		name: '执行者·无限',
		skill: '剑域',
		element: '金',
		hp: random(120, 150),
		intents: [
			{damage: 12},
			{block: 8, damage: 8},
			{damage: 14},
			{vulnerable: 1},
			{damage: 10},
			{block: 12},
		],
		random: 3,
		quote: '会馆的安危，由我来守。亮剑吧。',
		phase2Quote: '剑域已开。这一课，叫做守住灵质空间。',
		// 第二阶段「吞噬·剑域」：空间系吞噬展开剑域，攻击频率与力度全面提升，
		// 并持续积蓄力量——如传闻中一人一剑破城。
		phase2: [
			{damage: 16},
			{strength: 2},
			{block: 10, damage: 12},
			{damage: 20},
			{vulnerable: 2, damage: 14},
			{damage: 26},
		],
	})
)
bosses['玄离·冰火双域'] = MonsterRoom(
	Monster({
		name: '玄离·冰火双域',
		skill: '冰火双域',
		element: '水',
		hp: random(110, 135),
		intents: [
			{damage: 9, weak: 1},
			{damage: 11},
			{block: 8},
			{damage: 12, vulnerable: 1},
			{damage: 14},
		],
		random: 2,
		quote: '冰与火，我都试过了。你要不要也试试？',
		phase2Quote: '炎域圣火！冰火双域，尽归我身！',
		// 第二阶段「炎域圣火」：冰域退散、炎域圣火彻底燃起，可吸收他人火焰反哺自身——
		// 高伤连击并持续施加虚弱/易伤，考验玩家的格挡节奏。
		phase2: [
			{damage: 14},
			{vulnerable: 2, damage: 10},
			{damage: 18},
			{block: 6, damage: 12},
			{damage: 22},
			{weak: 2, damage: 16},
		],
	})
)

// —— Boss：北域与蓝溪镇守门（第6/8层补充）——
// 设定提取自 worldview_luoxiaohei_v4.db characters 表：
//   那伽（id=11，北域领主，生灵系植灵转移+分身，蓝溪镇主线反派）、
//   明王/阎明（id=141/145，妖灵会馆三神之一，吞噬魂灵之路的治愈系）。

bosses['那伽·北域之主'] = MonsterRoom(
	Monster({
		name: '那伽·北域之主',
		skill: '植灵',
		element: '水',
		hp: random(100, 130),
		intents: [
			{weak: 1, damage: 10},
			{heal: 10, regen: 2},
			{damage: 14},
			{vulnerable: 1, damage: 8},
			{block: 10},
			{damage: 16},
		],
		random: 3,
		quote: '区区闯入者，也敢踏足北域？',
		phase2Quote: '北域万灵，皆为我所用！',
		// 第二阶段「植灵·北域万灵」：那伽本体以植灵转移汲取北域万灵反哺自身，
		// 回灵蓄力与心灵压制交替，持续回血的续航型 Boss，考验玩家的爆发节奏。
		phase2: [
			{heal: 14, strength: 2},
			{weak: 2, damage: 12},
			{damage: 18},
			{block: 8, damage: 10},
			{regen: 3},
			{damage: 24},
		],
	})
)
bosses['明王·阎罗噬魂'] = MonsterRoom(
	Monster({
		name: '明王·阎罗噬魂',
		skill: '噬魂',
		element: '火',
		hp: random(140, 170),
		intents: [
			{weak: 2},
			{damage: 14},
			{heal: 15, strength: 2},
			{block: 12},
			{damage: 12, vulnerable: 1},
			{damage: 18},
		],
		random: 3,
		quote: '孩子，你的魂灵……我收下了。',
		phase2Quote: '魂灵俱归我身——这便是明王的道！',
		// 第二阶段「吞噬·魂灵归位」：吞噬魂灵的道路彻底展开，回血蓄力频率加快，
		// 心灵压制（虚弱/易伤）与重击交替——拖得越久，明王越是不可战胜。
		phase2: [
			{heal: 20, strength: 3},
			{weak: 2, damage: 14},
			{damage: 20},
			{block: 10, damage: 12},
			{vulnerable: 2, damage: 16},
			{damage: 28},
		],
	})
)

// —— 区域守门 Boss 池（中途 Boss 房，dungeon.js 按楼层主题分配）——
// regionBossPools 各子池与 dungeon.js 的 REGION_BOSS_FLOORS 一一对应：
//   金丹·离岛（y=5）→ 风息（离岛首领）
//   金丹·北域（y=6）→ 那伽（北域领主）
//   元婴·老君阁（y=7）→ 老君/玄离（元婴期大能）
//   元婴·蓝溪镇（y=8）→ 明王（吞噬魂灵的酆都之主）
//   化神·苍南会馆（y=9）→ 无限/灵遥（化神期执行者）
export const regionBossPools = [
	['离岛首领·风息'],
	['那伽·领域', '那伽·北域之主'],
	['老君·灵誓试炼', '玄离·冰火双域'],
	['明王·阎罗噬魂'],
	['执行者·无限', '灵遥·流石之影'],
]

// 最终 Boss 池（graph 末层）：重生之门·门灵 + 高阶大能，
// 避免早期剧情 Boss（风息/那伽）出现在最终战，点题「重生之门」。
export const finalBossPool = [
	'重生之门·门灵',
	'老君·灵誓试炼',
	'执行者·无限',
	'玄离·冰火双域',
	'灵遥·流石之影',
]

// —— 怪物区域归属（楼层地点主题匹配）——
// 用于 dungeon.js 在 M/E 房按当前楼层世界观地点优先抽取对应区域的怪，
// 区域池为空时回退全局池，保证任何楼层都有怪可出。
// 区域 key 对齐 dungeon.js 的楼层地点主题：
//   longyou（龙游/风息公园，筑基） / lidao（离岛，金丹） / beiyu（北域，金丹） /
//   laojunge（老君阁/蓝溪镇，元婴） / huiguan（苍南会馆，化神）。
// 归属依据 worldview_luoxiaohei_v4.db characters 表的设定：
//   卡里（灵溪馆长）、三叔/罗小白（罗家岙）、大爽（龙游会馆·转移）、山新（众生之门玩家）、
//   洛竹/青丘（离岛成员）、虚淮/兆岳（北域、那伽麾下）、谛听（上古神兽·侦查鹰犬）、
//   昊天/孙悟空（斗帅宫妖王）、冬冬（龙游·时滞）、木落仙人/西木子（会馆长老）、
//   执行者·剑与土/鹿野/鸠老/哪吒（妖灵会馆执行者/创始人）。
// 未标注的怪物（破老、千针、灵质守卫、三妖众、团鼠、灵偶等）视为全区域可出。
export const MONSTER_REGIONS = {
	longyou: ['天虎', '洛竹', '黑咻', '卡里·灵植守卫', '大爽·定点转移', '山新·游戏玩家', '恶妖·缠藤'],
	lidao: ['洛竹', '青丘', '恶妖·缠藤', '离岛小妖', '风息·豪夺'],
	beiyu: ['虚淮', '兆岳', '黑咻', '恶妖·缠藤', '那伽·灵主'],
	laojunge: ['谛听·侦查鹰犬', '昊天·斗帅宫妖王', '木落仙人·巨灵阵', '孙悟空·斗帅妖王', '冬冬·时滞', '西木子·戏梦'],
	huiguan: ['天虎', '谛听·侦查鹰犬', '执行者·剑与土', '鹿野·追毫锁定', '鸠老·造物仿生', '哪吒·三头六臂', '木落仙人·巨灵阵'],
}

// 楼层（graph y）→ 区域 key；null 表示早期新手层（easyMonsters 池）或最终 Boss 层。
// 与 dungeon.js 的 FLOOR_LOCATION_ORDER 对齐：
//   y=1-2 灵溪/罗家岙（新手） / y=3-4 龙游/风息公园 / y=5 离岛 / y=6 北域 /
//   y=7-8 老君阁/蓝溪镇 / y=9 苍南会馆 / y=10 重生之门（最终 Boss）。
export const REGION_FOR_FLOOR = (floor) => {
	if (floor <= 2) return null
	if (floor <= 4) return 'longyou'
	if (floor === 5) return 'lidao'
	if (floor === 6) return 'beiyu'
	if (floor <= 8) return 'laojunge'
	if (floor === 9) return 'huiguan'
	return null
}

// —— 区域守门 / 最终 Boss 专属战利品映射 ——
// Boss 名 → 专属法宝 id（须存在于 content/cultivation.js treasures）。
// 战斗结算时优先掉落专属法宝（仅一次）；已持有或不在映射内则回退通用 Boss 法宝池。
export const REGION_BOSS_LOOT = {
	'离岛首领·风息': '风息之种',
	'那伽·领域': '北域寒晶',
	'那伽·北域之主': '北域寒晶',
	'老君·灵誓试炼': '灵誓契',
	'玄离·冰火双域': '冰火玄晶',
	'明王·阎罗噬魂': '阎罗令',
	'执行者·无限': '流石令',
	'灵遥·流石之影': '流石令',
	'重生之门·门灵': '门灵之钥',
}

// 取 Boss 专属战利品 id；无专属掉落返回 null
export const bossLootFor = (name) => REGION_BOSS_LOOT[name] || null

// —— 区域徽章（战斗 UI 展示怪物来源区域，增强世界观沉浸）——
// 区域 key 与 MONSTER_REGIONS / REGION_FOR_FLOOR 对齐；
// name 为战斗中展示的短徽章名，flavor 为悬浮详情（依据 worldview_luoxiaohei_v4.db locations/organizations）。
export const REGION_NAMES = {
	longyou: {
		name: '龙游',
		flavor: '龙游·风息公园一带。人类与妖精共居的城镇，妖灵会馆龙游分会的驻地，风息曾在此带领伙伴扎根。',
	},
	lidao: {
		name: '离岛',
		flavor: '离岛·北域边缘的海岛。风息的老家，也是那伽觊觎清凝之力的北域前哨，黑市行商往来不绝。',
	},
	beiyu: {
		name: '北域',
		flavor: '北域·那伽的领地。三百年前那伽麾下妖精与执行者在此对峙，冰寒之气终年不散。',
	},
	laojunge: {
		name: '老君阁',
		flavor: '老君阁·蓝溪镇。老君的灵质空间与蓝溪镇相邻，上古大妖在此隐居，货摊与试炼并存。',
	},
	huiguan: {
		name: '苍南会馆',
		flavor: '苍南会馆·妖灵会馆总部。只有得到认可的执行者才能入内的藏库与议事之地，守卫森严。',
	},
}

// 反查怪物所属区域：命中 MONSTER_REGIONS 返回区域 key，未标注（全区域可出）返回 null
export const regionForMonster = (name) => {
	if (!name) return null
	for (const [key, list] of Object.entries(MONSTER_REGIONS)) {
		if (list.includes(name)) return key
	}
	return null
}

// 楼层 → 区域短名（null 表示新手层/最终 Boss 层，不展示区域徽章）
export const regionNameForFloor = (floor) => {
	const key = REGION_FOR_FLOOR(floor)
	return key ? REGION_NAMES[key]?.name || null : null
}
