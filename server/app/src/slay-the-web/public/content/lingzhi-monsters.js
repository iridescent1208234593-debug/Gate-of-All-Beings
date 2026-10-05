// 罗小黑战记·重生之门 —— 「灵质修行」试炼敌人池（世界观化）
// 设定来源：assets\罗小黑战记数据库\db\worldview_luoxiaohei_v4.db
//   spirit_lifecycle：灵偶/傀儡（生灵+物质灵造出的仿生命体）、物质灵（虚淮类物质灵妖精）、
//     散灵（生物死后生灵消散回归自然）、聚灵/精灵（生灵汇聚的无实体形态）、
//     魂灵（肉体消亡后凝而不散、机缘可保有意识）等生命周期设定
//   characters：阎明（只能走吞噬魂灵道路）、那伽（吸食魂灵、领域侵占）、
//     炎帝（御灵系·火最强，玄离之师，炎域圣火亲授）、傀儡=心灵系技能（操控他人）等能力设定
// 用途：灵质回路试炼中的敌人。保留原战斗模型（name/maxHealth/intents/difficulty），
//   新增 desc/source/element 世界观字段：desc 试炼中遭遇的描写、source 设定出处、
//   element 元素标签（仅展示用，不参与五行共鸣，维持灵质修行独立引擎）。
// 敌人分布：floor 1-2 初段普通 → floor 3-4 中段普通 → floor 5 精英 → 守门 Boss

export const lingzhiMonsterPool = [
	// ---------- 初段（楼层 1-2）：灵质回路外缘的造物与残灵 ----------
	{
		id: 'lm_caomu_kui',
		name: '灵偶·草木傀儡',
		desc: '由生灵与物质灵强行捏合而成的仿生命体，形似草木扎成的偶人，动作僵硬，眼神空洞。它没有魂灵，只是被回路中的残余灵质力驱动着向你挥来。',
		source: 'spirit_lifecycle·灵偶/傀儡：直接用生灵和物质灵造出的类似生命的物体，看起来是活的却没有太多自我意识',
		element: '木',
		maxHealth: 15,
		intents: [{damage: 4}, {block: 3}, {damage: 6}],
		difficulty: 'normal',
	},
	{
		id: 'lm_wuzhi_tuan',
		name: '尘灵·物质灵团',
		desc: '一团暖金色的物质灵在地面蠕动成型，像被无形之手揉捏的泥塑。物质灵是构成万物的基石，这团灵没有意志，却在灵质回路的催化下不断重塑着外形。',
		source: 'spirit_lifecycle·物质灵：组成一切事物的基石，少部分妖精主要由物质灵组成（例如虚淮）',
		element: '土',
		maxHealth: 14,
		intents: [{damage: 5}, {damage: 3, weak: 1}, {block: 4}],
		difficulty: 'normal',
	},
	{
		id: 'lm_youling_can',
		name: '游灵·散灵残响',
		desc: '一道半透明的灵影在林间游荡，是某位妖灵散灵后未能完全回归自然的残响。它没有敌意，只是循着生前的执念徘徊，见你靠近，却本能地发起攻击。',
		source: 'spirit_lifecycle·散灵：生物死后生灵消散回归自然，极少数魂灵强大者凝而不散',
		element: '水',
		maxHealth: 16,
		intents: [{damage: 4}, {block: 3}, {damage: 6}],
		difficulty: 'normal',
	},
	{
		id: 'lm_huanling_canying',
		name: '幻灵·幻化残影',
		desc: '一道淡青色的残影在灵光中不断变换轮廓，时而像飞鸟，时而像走兽。它是最初级的散灵，只会本能地用「幻化」模仿所见之形，试图让你在迷惑中露出破绽。',
		source: 'spirit_lifecycle·幻化：生灵系技能，幻化形态',
		element: '水',
		maxHealth: 15,
		intents: [{damage: 4}, {block: 3}, {damage: 5, weak: 1}],
		difficulty: 'normal',
	},

	// ---------- 中段（楼层 3-4）：聚灵催化下的妖灵与更成形的造物 ----------
	{
		id: 'lm_juling_jingling',
		name: '聚灵妖灵·初生精灵',
		desc: '生灵在回路深处大量汇聚，凝聚成一团无实体的发光精灵。它尚未与物质灵结合，形态在翠绿与碧蓝间流转，像一团有生命的光雾，本能地护住这片聚灵之地。',
		source: 'spirit_lifecycle·聚灵/精灵：生灵汇聚形成没有实体的精灵，精灵与物质灵结合可演变成妖精',
		element: '木',
		maxHealth: 20,
		intents: [{damage: 6}, {block: 4}, {damage: 8}],
		difficulty: 'normal',
	},
	{
		id: 'lm_shiwei_kui',
		name: '灵偶·石卫傀儡',
		desc: '一具以岩石为骨、以物质灵为筋的傀儡，比草木傀儡结实得多。它守在回路岔口，像被设下防线的守卫，无论谁来都只会重复同一件事——击退闯入者。',
		source: 'spirit_lifecycle·灵偶/傀儡：生灵与物质灵造出的仿生命体，看起来是活的却没有太多自我意识',
		element: '土',
		maxHealth: 22,
		intents: [{block: 5}, {damage: 5}, {damage: 8, vulnerable: 1}],
		difficulty: 'normal',
	},
	{
		id: 'lm_hunling_busan',
		name: '魂灵·凝而不散',
		desc: '一团比游灵凝实得多的光球悬在半空，核心明亮如灯。这是肉体消亡后凝而不散的强大魂灵，还残存着生前的意识，正用沉默的目光审视着你——若有机缘，它甚至想借新生命重生。',
		source: 'spirit_lifecycle·魂灵：肉体消亡后凝而不散，又有机缘被新生命吸收，也会多少保有之前的意识',
		element: '火',
		maxHealth: 18,
		intents: [{damage: 5}, {damage: 3, weak: 1}, {block: 3, damage: 4}],
		difficulty: 'normal',
	},
	{
		id: 'lm_mengling_ximeng',
		name: '梦灵·戏梦者',
		desc: '一团幽紫色的灵雾悬在回路岔口，雾气中浮动着破碎的梦境画面。心灵系·戏梦——操控梦境，它把过往旅人的梦魇织成幻象，趁你恍惚时兜头罩下。',
		source: 'spirit_lifecycle·戏梦：心灵系技能，操控梦境',
		element: '心灵',
		maxHealth: 19,
		intents: [{damage: 6}, {damage: 3, weak: 1}, {block: 4, damage: 3}],
		difficulty: 'normal',
	},

	// ---------- 精英（楼层 5）：心灵傀儡师与魂灵吞噬者 ----------
	{
		id: 'lm_kui_leishi',
		name: '精英·傀儡师',
		desc: '一道淡紫色的虚影悬浮于空，指尖垂下无形的丝线，牵动数具草木傀儡缓缓站起。心灵系·傀儡——操控他人，是它唯一擅长的技艺，而你，成了它新的提线对象。',
		source: 'spirit_lifecycle·傀儡：心灵系技能，操控他人',
		element: '心灵',
		maxHealth: 30,
		intents: [{damage: 9}, {block: 6, damage: 4}, {damage: 11}],
		difficulty: 'elite',
	},
	{
		id: 'lm_hun_shizhe',
		name: '精英·魂噬者',
		desc: '一团漆黑的灵影张开大口，贪婪地吸食着回路中逸散的灵质力。它走上了一条吞噬魂灵的道路——如同传闻中那位只能靠吞噬魂灵续命的明王，或是北域那伽的恶行。',
		source: 'characters·阎明（只能走吞噬魂灵的道路）/那伽（吸食魂灵）',
		element: '火',
		maxHealth: 28,
		intents: [{block: 8}, {damage: 8}, {damage: 5, vulnerable: 1}],
		difficulty: 'elite',
	},
	{
		id: 'lm_xiling_shizhi',
		name: '精英·时滞者',
		desc: '一道近乎透明的身影静立于裂隙之间，周身的时间仿佛慢了半拍。空间系·时滞——使目标时间停滞，是它最危险的手段：你以为还来得及防御，伤害却早已落在身上。',
		source: 'spirit_lifecycle·时滞：空间系技能，使目标时间停滞',
		element: '空间',
		maxHealth: 30,
		intents: [{block: 5, damage: 5}, {damage: 9}, {damage: 6, vulnerable: 1}],
		difficulty: 'elite',
	},

	// ---------- 守门 Boss：灵质回路最深处 ----------
	{
		id: 'lm_boss_zhongsheng',
		name: '守门·重生执念',
		desc: '灵质回路最深处的守门者——一道凝而不散的巨大魂灵，核心处如太阳般明亮。它已在此徘徊了不知多少岁月，等待一个有机缘的新生命，好让残存的意识借体重生。这正是「重生之门」的回响：散灵不是终结，而是另一种开始。',
		source: 'spirit_lifecycle·魂灵/散灵：极少数魂灵强大者肉体消亡后凝而不散，机缘被新生命吸收会保有意识；契合重生之门主题',
		element: '空间',
		maxHealth: 70,
		intents: [{damage: 10}, {block: 6, damage: 6}, {damage: 12}, {strength: 1}],
		difficulty: 'boss',
		// —— 二阶段「重生觉醒」（世界观：散灵借体重生，意识不甘消散而爆发）——
		// 血量降至 maxHealth*phase2Threshold 时触发一次：力量 +3、格挡 +10，
		// 意图切换为 phase2Intents（更暴烈的执念爆发循环），觉醒回合为蓄势回合不行动。
		phase2Threshold: 0.4,
		phase2Name: '守门·重生觉醒',
		phase2Intents: [
			{damage: 14},
			{block: 10, damage: 10},
			{damage: 8, vulnerable: 1},
			{strength: 2, block: 6},
		],
	},
	{
		id: 'lm_boss_xuanli',
		name: '守门·玄离试炼',
		portrait: '玄离',
		desc: '灵质回路最深处寒气骤降，冰霜自地面向四周蔓延，一道巨兽虚影盘踞于极寒之中——上古神兽玄离的试炼幻影。它能操控冰与火，灵质空间是足球场大的极寒地狱，曾护守天明珠、坐镇斗帅宫试炼。凡过此门者，须先过冰火双关。',
		source: 'characters·玄离（与阿根共存；控制冰、火，吸收火焰并凝结成冰；灵质空间为极寒地狱；斗帅宫试炼与天明珠守护背景）',
		element: '水',
		maxHealth: 72,
		intents: [{damage: 10}, {block: 8}, {damage: 12, vulnerable: 1}, {damage: 6, weak: 1}],
		difficulty: 'boss',
		// —— 二阶段「极寒觉醒」（世界观：玄离的极寒地狱灵质空间全面展开，冰封之息吞没回路）——
		phase2Threshold: 0.4,
		phase2Name: '守门·玄离极寒觉醒',
		phase2Intents: [
			{damage: 13},
			{block: 10, damage: 8},
			{damage: 9, vulnerable: 1},
			{strength: 2, block: 5},
		],
	},
	{
		id: 'lm_boss_naga',
		name: '守门·那伽侵域',
		portrait: '那伽',
		desc: '灵质回路最深处被浓重的灵雾笼罩，雾中盘踞着一条巨大的蛇影——北域神明那伽的侵蚀幻影。它的领域具「侵占」特质，能令灵融入你的灵质空间，结合魂灵将你化作同感者。三百年的风雪与怨念，在此凝为守门之壁。',
		source: 'characters·那伽（北域神明，大蛇原型；领域进阶形态具侵占特质，让灵融入对方灵质空间、结合魂灵使其成为同感者；吸食魂灵）',
		element: '空间',
		maxHealth: 75,
		intents: [{block: 8, damage: 5}, {damage: 11}, {damage: 6, weak: 1}, {strength: 1, block: 5}],
		difficulty: 'boss',
		// —— 二阶段「领域侵占」（世界观：那伽领域展开，侵占对方灵质空间，灵雾翻涌侵蚀回路）——
		phase2Threshold: 0.4,
		phase2Name: '守门·那伽领域侵占',
		phase2Intents: [
			{damage: 13},
			{block: 12, damage: 7},
			{damage: 9, vulnerable: 1},
			{strength: 2, block: 6},
		],
	},
	{
		id: 'lm_boss_yandi',
		name: '守门·炎帝试炼',
		portrait: '炎帝',
		desc: '灵质回路最深处热浪翻涌，一座熔金火域铺展在回路尽头——上古火神炎帝的试炼幻影端坐其中。御灵系·火为最强御灵系，老君曾言「御灵系不如炎帝」；他更是玄离之师，炎域圣火由他亲授。须发皆燃、目如熔金，抬手间炎域圣火如江河奔涌而来。凡过此门者，须先经受火之极致的淬炼。',
		source: 'characters·炎帝（最年长的神；御灵系·火为最强御灵系、最强火系；玄离之师，曾将炎域圣火传授玄离；与老君为棋友）',
		element: '火',
		maxHealth: 74,
		intents: [{damage: 12}, {block: 5, damage: 8}, {damage: 10, vulnerable: 1}, {strength: 1}],
		difficulty: 'boss',
		// —— 二阶段「圣火觉醒」（世界观：炎域圣火全面展开，火之极致淬炼回路）——
		phase2Threshold: 0.4,
		phase2Name: '守门·炎帝圣火觉醒',
		phase2Intents: [
			{damage: 15},
			{block: 8, damage: 10},
			{damage: 11, vulnerable: 1},
			{strength: 2, block: 5},
		],
	},
]

// 楼层分组：floor 1-2 用初段、floor 3-4 用中段、floor 5 用精英、守门用 Boss
export function lingzhiMonstersForFloor(floorY, rng = Math.random) {
	if (floorY >= 5) {
		return lingzhiMonsterPool.filter((m) => m.difficulty === 'elite')
	}
	if (floorY >= 3) {
		return lingzhiMonsterPool.filter((m) => m.difficulty === 'normal' && m.maxHealth >= 18)
	}
	return lingzhiMonsterPool.filter((m) => m.difficulty === 'normal' && m.maxHealth < 18)
}

// 守门 Boss 池：每次进入灵质回路时随机从池中选取一位守门者（重生执念/玄离试炼/那伽侵域/炎帝试炼）
export function lingzhiBossDef(rng = Math.random) {
	const pool = lingzhiMonsterPool.filter((m) => m.difficulty === 'boss')
	return pool[Math.floor(rng() * pool.length)]
}
