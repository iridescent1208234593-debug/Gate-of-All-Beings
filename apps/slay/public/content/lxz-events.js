// 罗小黑战记·重生之门 —— 蓝溪镇篇章剧情事件池
// 数据来源：content/lxz-chapters.js（蓝溪镇漫画篇章分组，提取自 worldview_luoxiaohei_v4.db 的 lxz_episodes 表 134 条）
//          角色设定来自 worldview_luoxiaohei_v4.db 的 characters 表（老君 / 李清凝 / 玄离 / 程北河 / 无限 / 阎明 / 明王）
// 玩法定位：爬塔地图事件房（V 节点）新增「篇章剧情」事件源（与世界观事件 / 修仙事件三池混合）。
//   以蓝溪镇漫画 7 个篇章（序章·初遇 / 云游·四方 / 归途·无限 / 会馆·前夜 / 暗流·试探 / 远行·北域 / 新章·星夜）
//   为剧情骨架，按境界(0-4)分组分布，让玩家在爬塔途中重历蓝溪镇关键剧情片段。
// 效果字段与 worldview-events.js / cultivation.js 事件体系保持一致（由 game/actions.js 的 makeEventChoice 统一应用）：
//   cultivation 修为增减 / daoHeart 道心 / fortune 福缘 /
//   health 当前生命 / maxHealth 最大生命 / addCard 加卡（须存在于 content/cards.js）/
//   treasure 获得法宝（id 须存在于 content/cultivation.js 的 treasures）

// 篇章剧情事件池：按境界(0-4)分组（realmForFloor 最高返回 4，渡劫境界不在爬塔地图出现）
export const lxzEventPool = [
	// ---------- 炼气 · 序章·初遇（蓝溪镇第1-9话） ----------
	{
		id: 'e_lxz_qingning',
		realm: 0,
		title: '蓝溪镇·序章·初遇',
		description:
			'战乱之年，你随一队流民逃入深山。溪边躺着个昏迷的小女孩——她所在的村落刚被洗劫，孤女李清凝却天生治愈系，灵光极旺。一位灰袍老者蹲在她身边，掌心聚起淡金色的生灵：「这孩子的灵……很特别。」他抬眼看向你：「年轻人，可愿搭把手？」',
		choices: {
			left: {text: '救人要紧', effects: {daoHeart: 10, fortune: 5, addCard: '治愈灵光'}},
			right: {text: '敬而远之', effects: {cultivation: 8, daoHeart: -2}},
		},
	},
	// ---------- 炼气 · 云游·四方（蓝溪镇第10-19话） ----------
	{
		id: 'e_lxz_roaming',
		realm: 0,
		title: '蓝溪镇·云游·四方',
		description:
			'老君带着清凝、玄离游历罗城。城门口强人拦路，医馆里伤者呻吟。清凝不顾自己年幼，撸起袖子就要给人治伤；玄离蹲在墙头，冰火两系的灵力在指尖打转。老君摇着扇子笑：「这世道啊——救一人是一人。」',
		choices: {
			left: {text: '帮清凝治伤', effects: {daoHeart: 8, fortune: 4, cultivation: 5}},
			right: {text: '护玄离开路', effects: {cultivation: 12, health: -4}},
		},
	},
	// ---------- 筑基 · 归途·无限（蓝溪镇第20-29话） ----------
	{
		id: 'e_lxz_beihe_infinite',
		realm: 1,
		title: '蓝溪镇·归途·无限',
		description:
			'蓝溪镇里来了个重伤的青年——一人一剑破罗城，随后力竭昏迷。老君把他托付给神医程北河。北河嘴上嫌弃，手上却细致入微：「躺着别动，你这条命，我救定了。」青年醒来，目光锐利如剑：「……我叫无限。」',
		choices: {
			left: {text: '请教剑术', effects: {addCard: '金刃', cultivation: 10}},
			right: {text: '陪北河照料', effects: {daoHeart: 10, maxHealth: 5}},
		},
	},
	// ---------- 金丹 · 会馆·前夜（蓝溪镇第30-39话） ----------
	{
		id: 'e_lxz_guild_night',
		realm: 2,
		title: '蓝溪镇·会馆·前夜',
		description:
			'烟花在城墙外炸开，老君与几位故人围炉对饮——妖灵会馆将在今夜立下雏形。有人质疑：人妖共存，谈何容易？老君举起酒盏：「正因为难，才要有人去做。」窗外，一只黑猫趴在檐角，金色的眼睛映着火光。',
		choices: {
			left: {text: '共饮此杯', effects: {daoHeart: 12, fortune: 6, treasure: '天机罗盘'}},
			right: {text: '记住这一幕', effects: {cultivation: 15, daoHeart: 4}},
		},
	},
	// ---------- 元婴 · 暗流·试探（蓝溪镇第40-49话） ----------
	{
		id: 'e_lxz_yanming',
		realm: 3,
		title: '蓝溪镇·暗流·试探',
		description:
			'蓝溪镇来了位沉默的客人——阎明，天赋异禀的治愈系妖精，却因体质只能吞噬魂灵，被同类视为异类。她盯着清凝看了很久：「同系相惜……我本想护她。」你感到她灵质空间里沉甸甸的、名为酆都的气息。',
		choices: {
			left: {text: '坦诚相谈', effects: {daoHeart: 12, fortune: 6}},
			right: {text: '谨慎戒备', effects: {cultivation: 12, fortune: -3}},
		},
	},
	// ---------- 元婴 · 远行·北域（蓝溪镇第50-54话） ----------
	{
		id: 'e_lxz_north',
		realm: 3,
		title: '蓝溪镇·远行·北域',
		description:
			'北域传来钦差将至的消息，出镇前夜，疯犬在暗处低吠，有人影在树后窥探。清凝收拾行囊，玄离的火苗在指尖明明灭灭。老君望着北方，难得沉默——那里是那伽的领地，一别，便是三百年。',
		choices: {
			left: {text: '暗中护送', effects: {health: -6, daoHeart: 10, fortune: 5}},
			right: {text: '留守蓝溪镇', effects: {cultivation: 14, daoHeart: -3}},
		},
	},
	// ---------- 化神 · 新章·星夜（蓝溪镇第134话） ----------
	{
		id: 'e_lxz_starry',
		realm: 4,
		title: '蓝溪镇·新章·星夜',
		description:
			'多年后你重返蓝溪镇旧址。老君已迁走居民、封闭空间，废墟间却仍有灵光浮沉。星夜之下，一棵老树新芽萌发——有人在此埋下过约定，也有人在此学会离别。「重生之门」的传说，或许就藏在这片故土之下。',
		choices: {
			left: {text: '参悟生死', effects: {cultivation: 20, daoHeart: 10, maxHealth: 5}},
			right: {text: '拾取旧物', effects: {treasure: '定心镜', fortune: 4}},
		},
	},
]

// 篇章剧情事件抽取：按境界过滤；当前境界无篇章事件时返回 null（由 dungeon.js 走兜底池）
export function pickLxzEventForRealm(realmIndex, usedEventIds = []) {
	const pool = lxzEventPool.filter((e) => e.realm === realmIndex && !usedEventIds.includes(e.id))
	if (pool.length === 0) return null
	return pool[Math.floor(Math.random() * pool.length)]
}

export const lxzEventStats = {
	total: lxzEventPool.length,
	byRealm: lxzEventPool.reduce((acc, e) => {
		acc[e.realm] = (acc[e.realm] || 0) + 1
		return acc
	}, {}),
}
