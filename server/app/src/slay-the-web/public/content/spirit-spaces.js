// 罗小黑战记·重生之门 —— 灵质空间探索模块
// 设定来源：content/worldview-data.js（提取自 worldview_luoxiaohei_v4.db）——
//   「灵质空间：每个生命体固有的物质空间，用于储存灵，与生命直接相关。
//     高阶妖精可开辟独立空间，内部规则由开辟者制定，是战斗与庇护的核心场所。
//     空间系能力附着于灵质空间，无法后天习得，一个灵质空间只能附带一个。」
// 玩法定位：爬塔地图新增「灵质空间」节点（Z）。御灵师闯入他人灵质空间（或自身空间觉醒），
//   在空间内做出三选一抉择，获得修为 / 道心 / 福缘 / 生命 / 卡牌 / 法宝等收益。
// 效果字段与 worldview-events.js / cultivation.js 事件体系保持一致（由 game/actions.js 统一应用）：
//   cultivation 修为增减 / daoHeart 道心 / fortune 福缘 /
//   health 当前生命 / maxHealth 最大生命 / addCard 加卡（须存在于 content/cards.js）/
//   treasure 获得法宝（id 须存在于 content/cultivation.js 的 treasures）

// 灵质空间数据池：按境界(0-4)分组，对应 dungeon.js 的楼层分布
// 馆主彩蛋：三足乌「虹（佳霖）」的灵质空间「虹之间」（content/oc-rainbow.js）
import {ocSpiritSpaces} from './oc-rainbow.js'

export const spiritSpacePool = [
	// ---------- 炼气 · 灵质初醒（自身空间觉醒，灵溪/罗家岙附近） ----------
	{
		id: 'ss_awaken',
		realm: 0,
		name: '领域·初绽',
		owner: '你自身',
		theme: '空间系·领域',
		desc: '你的灵质空间在沉睡多年后第一次完全展开——空间内部灰蒙蒙的，生灵如萤火般漂浮。传说高阶妖精可在此开辟独立领域，而你的空间，正传来微弱的、属于「重生之门」的回响。',
		choices: {
			left: {text: '静心凝灵', effects: {cultivation: 12, daoHeart: 6, ling: true}},
			center: {text: '感应空间', effects: {cultivation: 8, fortune: 6, addCard: '领域·展开'}},
			right: {text: '扩张边界', effects: {maxHealth: 6, daoHeart: -3}},
		},
	},
	// ---------- 炼气 · 聚灵之地（生灵与物质灵交汇之所，供御灵师借天时聚灵化形） ----------
	{
		id: 'ss_ling_gather',
		realm: 0,
		name: '聚灵之地',
		owner: '妖精会·灵溪分馆（无名妖灵）',
		theme: '灵质循环·聚灵',
		desc: '一片生灵如萤火般明灭的原野——传说生灵汇聚可成精灵，精灵与物质灵交织方化为妖精。此地游离灵气充沛，正是御灵师借天时聚灵、孕育化形的好去处。风中隐约传来妖精会的低语：「聚灵，是万物成形的开端。」',
		choices: {
			left: {text: '静坐聚灵', effects: {ling: true, daoHeart: 3, soulSeed: 1}},
			center: {text: '凝炼物质灵', effects: {ling: true, wuzhi: 6}},
			right: {text: '感知灵脉', effects: {cultivation: 8, shengling: 6}},
		},
	},
	{
		id: 'ss_lixi_grove',
		realm: 0,
		name: '灵植温床',
		owner: '卡里（灵溪会馆馆长）',
		theme: '御灵系·木',
		desc: '灵溪会馆后院有一片卡里用木系御灵催生的小树林。他笑眯眯地站在树苗前：「进来坐坐？我这空间养树最好——木系妖精的灵质空间，生灵最旺。」树根下隐约埋着旧物。',
		choices: {
			left: {text: '帮忙催生', effects: {cultivation: 10, daoHeart: 5, fortune: 3}},
			center: {text: '掘出旧物', effects: {treasure: '灵泉葫芦', fortune: -3}},
			right: {text: '取一根灵枝', effects: {addCard: '木缚藤蔓'}},
		},
	},
	{
		id: 'ss_game_gate',
		realm: 0,
		name: '众生之门·游戏空间',
		owner: '山新（灵溪·四小只）',
		theme: '虚拟空间·游戏世界',
		desc: '山新拉着你钻进《众生之门》——号称"真实到不可思议"的御灵游戏。灵质空间在这里以玩家身份出现：有数值面板、技能树、复活点，也有满地乱跑的小妖。山新拍拍胸脯：「别怕，死了还能复活——不过痛感可是真的哦！」',
		choices: {
			left: {text: '组队刷怪', effects: {cultivation: 12, daoHeart: 4}},
			center: {text: '领取新手礼包', effects: {treasure: '剑心佩', fortune: -2}},
			right: {text: '挑战隐藏Boss', effects: {addCard: '全攻突进', health: -6}},
		},
	},
	// ---------- 筑基 · 领域残迹（龙游/风息公园） ----------
	{
		id: 'ss_longyou_remnant',
		realm: 1,
		name: '龙游·领域残迹',
		owner: '风息（散灵后的遗留）',
		theme: '御灵系·木 · 领域残留',
		desc: '风息在龙游展开领域失败后，生灵散尽却未完全消散，化为一片茂密林木留在城中。树冠间仍残留着领域规则的痕迹——你若踏入，会被这片土地短暂接纳。',
		choices: {
			left: {text: '感悟领域余韵', effects: {cultivation: 15, daoHeart: 8}},
			center: {text: '摘取灵果', effects: {maxHealth: 5, fortune: 4}},
			right: {text: '顺着树根探秘', effects: {addCard: '木愈回春', health: -6}},
		},
	},
	{
		id: 'ss_park_spirit',
		realm: 1,
		name: '风息公园·新生灵域',
		owner: '散灵生灵',
		theme: '生灵汇聚',
		desc: '龙游市内，风息散灵后建立的风息公园。无数生灵在林木间流转、聚散，形成一个极罕见的「自发灵质场」——没有开辟者，却自成规则。此地的生灵格外温和。',
		choices: {
			left: {text: '与生灵共鸣', effects: {daoHeart: 10, cultivation: 8}},
			center: {text: '引灵入体', effects: {maxHealth: 4, cultivation: 6}},
			right: {text: '捕捉游离灵偶', effects: {addCard: '眷灵'}},
		},
	},
	{
		id: 'ss_bookshop_dream',
		realm: 1,
		name: '龙游·画中书境',
		owner: '画虎',
		theme: '造物系·画灵 · 书境',
		desc: '龙游街角的书店由松鼠妖精画虎经营。他打了个响指，你脚下的地板化作墨迹，四周书架坍缩成一张宣纸——「欢迎来到我的画里。这里的规则很简单：能画出什么，就有什么。」',
		choices: {
			left: {text: '观摩画技', effects: {cultivation: 10, daoHeart: 8}},
			center: {text: '取走店中藏书', effects: {treasure: '拾贰集'}},
			right: {text: '习得画灵之术', effects: {addCard: '画灵'}},
		},
	},
	// ---------- 金丹 · 他人领地（离岛/北域） ----------
	{
		id: 'ss_lidao_base',
		realm: 2,
		name: '离岛·据点空间',
		owner: '风息一伙',
		theme: '空间系·传送门 · 木',
		desc: '离岛是风息一伙的据点，通过桥梁下的传送门可达。岛上的灵质空间由同伴共同维护：洛竹的藤蔓盘绕墙壁，虚淮留下传送印记，天虎在角落蜷成一团。这里对陌生来客并不友善。',
		choices: {
			left: {text: '以礼叩门', effects: {fortune: 8, daoHeart: 3, cultivation: 6}},
			center: {text: '探查传送印记', effects: {addCard: '瞬移', daoHeart: -3}},
			right: {text: '与守岛者切磋', effects: {cultivation: 14, health: -8}},
		},
	},
	{
		id: 'ss_beiyu_cage',
		realm: 2,
		name: '北域·囚笼',
		owner: '那伽',
		theme: '生灵系·植灵转移',
		desc: '那伽的领地北域，一片寒冷而压抑的空间。这里曾囚禁清凝三百年——治愈系灵力被抽离的痕迹至今仍在灵质空间壁上刻成纹路。深处有那伽的「灵主」在巡逻。',
		choices: {
			left: {text: '破除旧禁制', effects: {cultivation: 12, daoHeart: 8}},
			center: {text: '搜刮囚室遗物', effects: {treasure: '天机罗盘', fortune: -5}},
			right: {text: '速战速决离开', effects: {health: -10, fortune: 10}},
		},
	},
	{
		id: 'ss_mulun_lingfeng',
		realm: 2,
		name: '灵风山·巨灵阵',
		owner: '木落仙人（灵风山）',
		theme: '空间系·巨灵阵 · 变小',
		desc: '灵风山深处，树精灵七果与花精灵粉末守着一段扭曲的空间。木落仙人留下的巨灵阵仍在运转：踏入阵中万物都会缩小，连你的灵质空间也被压成掌心大小。粉末骑着虎妞远远喊：「小心别踩到树苗！」',
		choices: {
			left: {text: '参悟阵纹', effects: {cultivation: 14, daoHeart: 6}},
			center: {text: '搜罗迷你遗物', effects: {treasure: '若木'}},
			right: {text: '硬闯阵心', effects: {addCard: '瞬移', health: -6}},
		},
	},
	// ---------- 元婴 · 老君空间（老君阁/蓝溪镇） ----------
	{
		id: 'ss_laojunge',
		realm: 3,
		name: '老君阁',
		owner: '老君',
		theme: '空间系·独立空间 · 锁御',
		desc: '老君闭关的灵质空间，内有锁御宫、斗帅宫等殿宇。空间规则由老君亲自制定：外来者不可飞行、不可喧哗、不可妄动法宝。传说天明珠曾存放于此，引来府先生一伙觊觎。',
		choices: {
			left: {text: '拜谒锁御宫', effects: {cultivation: 16, daoHeart: 10}},
			center: {text: '寻访旧藏', effects: {treasure: '定心镜'}},
			right: {text: '偷学空间规则', effects: {addCard: '吞噬之域', daoHeart: -8}},
		},
	},
	{
		id: 'ss_lanxizhen',
		realm: 3,
		name: '蓝溪镇·遗墟',
		owner: '老君（曾庇护）',
		theme: '空间系·迁镇 · 治愈',
		desc: '曾受老君庇护的人类城镇，迁入他的灵质空间后一度繁华：三和堂医馆的灯火、清凝问诊的身影、谛听镇守的街巷。迁镇后这里便废弃了，唯余空间残影与淡淡的治愈灵力。',
		choices: {
			left: {text: '凭吊废墟', effects: {daoHeart: 12, cultivation: 8}},
			center: {text: '收集残存灵药', effects: {addCard: '治愈灵光'}},
			right: {text: '修复一处结界', effects: {maxHealth: 8, fortune: 3}},
		},
	},
	{
		id: 'ss_xuanli_shenshan',
		realm: 3,
		name: '深山·炎域',
		owner: '玄离（山神）',
		theme: '御灵系·冰火双空间',
		desc: '深山腹地，犬形妖精玄离静静蹲坐在雪线上。他的灵质空间一半冰封、一半燃烧——冰火双系在他体内共存数百年，如今化作「山神」的领域。炎域圣火在他掌心跳跃：「想取暖，还是想冷静？」',
		choices: {
			left: {text: '参悟冰火', effects: {cultivation: 16, daoHeart: 8}},
			center: {text: '拾取炎域余烬', effects: {treasure: '玄铁甲'}},
			right: {text: '感受炎域圣火', effects: {addCard: '冰封千里', health: -8}},
		},
	},
	{
		id: 'ss_yifan_moon',
		realm: 3,
		name: '月宫·星途',
		owner: '一凡仙人',
		theme: '空间系·瞬身 · 星际',
		desc: '老君阁深处悬着一幅《奔月图》，画中残留着一凡仙人瞬身远行的空间印记。你触碰印记，顷刻间被抛上星空——脚下是月面，远处是地球，更远处是这位仙人追寻了数百年的「宇宙尽头」。',
		choices: {
			left: {text: '凝望星辰', effects: {cultivation: 15, daoHeart: 10}},
			center: {text: '拾取月岩法宝', effects: {treasure: '天机罗盘'}},
			right: {text: '追逐星轨', effects: {addCard: '雷灵闪', fortune: -3}},
		},
	},
	// ---------- 化神 · 会馆与重生（苍南/重生之门） ----------
	{
		id: 'ss_cangnan',
		realm: 4,
		name: '苍南会馆',
		owner: '妖灵会馆（上古无主灵质空间）',
		theme: '空间系·无主空间 · 秩序',
		desc: '由上古无主灵质空间改造而成的妖灵会馆总馆。无数执行者的灵质印记在此叠加：鹿野的追毫、鸠老的洞察、兆岳的凌荆。这里是妖精世界的秩序中枢，也是你踏入重生之门前最后的补给地。',
		choices: {
			left: {text: '聆听会馆训诫', effects: {daoHeart: 14, cultivation: 10}},
			center: {text: '请求执行者赐宝', effects: {treasure: '琼圆盾', daoHeart: -5}},
			right: {text: '观摩御灵图谱', effects: {addCard: '豪夺', cultivation: 6}},
		},
	},
	{
		id: 'ss_mingwang_fengdu',
		realm: 4,
		name: '酆都·索灵地界',
		owner: '明王',
		theme: '治愈系·索灵 · 地界',
		desc: '妖灵会馆创始人明王的灵质空间——酆都。地界索灵之所：无数魂灵在此等待重生，是「重生之门」在人间的倒影。明王端坐于幽都深处，语气平静：「走错路的魂灵，会被我收走。你，也要进来吗？」',
		choices: {
			left: {text: '聆听轮回之理', effects: {daoHeart: 16, cultivation: 10}},
			center: {text: '求得魂灵碎片', effects: {treasure: '黑咻', fortune: -4}},
			right: {text: '感悟索灵之力', effects: {addCard: '摄魂术', health: -8}},
		},
	},
	{
		id: 'ss_rebirth_gate',
		realm: 4,
		name: '重生之门·灵质边界',
		owner: '？',
		theme: '空间系·轮回边界',
		desc: '传说中聚灵与散灵的边界。这里的灵质空间规则彻底紊乱：生灵与物质灵互相渗透，空间壁如薄纸般颤动。门的另一侧，隐约可见无数前世魂灵的回响——它们正在等待重生。',
		choices: {
			left: {text: '凝望轮回', effects: {daoHeart: 16, cultivation: 12}},
			center: {text: '吸纳散灵余烬', effects: {maxHealth: 10, fortune: 5}},
			right: {text: '触摸门扉', effects: {addCard: '领域·展开', health: -8}},
		},
	},
	// —— 馆主彩蛋 · 三足乌「虹（佳霖）」灵质空间（content/oc-rainbow.js）——
	...ocSpiritSpaces,
]

/** 按境界随机挑选一个灵质空间（避免重复：同局不重复出现同一空间） */
export function pickSpiritSpaceForRealm(realmIndex, usedSpaceIds = []) {
	const pool = spiritSpacePool.filter(
		(s) => s.realm === realmIndex && !usedSpaceIds.includes(s.id)
	)
	if (pool.length === 0) return null
	return pool[Math.floor(Math.random() * pool.length)]
}
