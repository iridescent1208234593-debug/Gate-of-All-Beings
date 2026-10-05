// 罗小黑战记·重生之门 —— 馆主彩蛋 · 三足乌「虹（佳霖）」
// 素材来源：用户的原创角色人设站 https://oc.iridescently.xyz（西木会馆 · 馆长设定页）
// 性质：同人彩蛋数据。「虹（佳霖）」是站主「佳霖」的原创三足乌角色，
//   不属于《罗小黑战记》官方角色，作为馆主彩蛋独立于官方图鉴展示。
// 数据 schema 与既有模块对齐，便于后续接入爬塔流程：
//   卡牌对齐 content/cards.js；法宝对齐 content/cultivation.js treasures；
//   事件对齐 content/worldview-events.js；灵质空间对齐 content/spirit-spaces.js。

// ============ 一、角色档案 ============
export const ocCharacter = {
	id: 'oc_rainbow',
	name: '虹（佳霖）',
	sub: '代号/名字：虹 / 佳霖 · 妖精 · 上古三足乌后裔',
	species: '妖精（三足乌，上古鸦科神鸟后裔）',
	gender: '男',
	age: 1468,
	height: '人形约 178cm',
	affiliation: '西木会馆（曾加入，已约三百年未归）',
	faction: '中立',
	food: '杂食，最喜欢吃果冻',
	personality:
		'温和，习惯先照顾别人感受；放心不下的人都会悄悄看着；热爱自然，讨厌无节制城市扩张；爱好和平，乐于分享灵质能力，平时喜欢呆在自己的球形灵质空间里，但也有热情的时候。',
	appearance:
		'黑发，琥珀色眼。真身为黑羽鎏金翅的三足金乌，展翅时翅缘淌虹光。人形常穿深红紫色的外袍——深得近黑，如同凝固的暮色；内衬金橙色，如同暮色里藏着一轮落日。',
	background:
		'上古三足乌的后裔。北周明帝二年（558年）曾被人捉住，当作祥瑞献给皇帝，趁夜逃出，从此四处游荡，收集各种存有灵力的发光石头（无主空间），并细致安放和安抚其中原本的残魂记忆。曾加入西木会馆，与馆长西木子相识，但已约300年没回去。常在雨后的虹光里出现，会找找有没有第一时间反射虹光的发光石头；遇到登门拜访的也十分热情好客，看到需要帮助的情况就会主动帮忙。',
	likes: ['温柔的人', '可爱的事物', '雨后初晴', '发光的小物什'],
	dislikes: ['没有光亮的感觉', '被打扰的安眠魂灵', '无节制的城市扩张'],
	abilityTags: ['生灵系', '空间系'],
}

// ============ 二、能力 ============
export const ocAbilities = [
	{
		id: 'oc_ab_shiyi',
		name: '拾遗',
		system: '生灵系',
		desc: '吸收死者遗留的散灵物质，汲取灵力。本质是分解者——把消散的灵力浓缩、归档、保存，收容无主空间。',
	},
	{
		id: 'oc_ab_hongzhijian',
		name: '「虹之间」',
		system: '空间系',
		desc: '灵质空间，收纳无主空间及其中残魂，承载记忆与死去魂灵——收藏室兼安魂所，内有一口用灵力维持恒温的温泉。',
	},
	{
		id: 'oc_ab_xianguang',
		name: '衔光（唤光）',
		system: '生灵系',
		desc: '与他人牵起光丝，联系越深光越亮，靠光确认彼此安好。光亮就是牵挂的刻度——所以怕「没有光亮的感觉」。',
	},
	{
		id: 'oc_ab_hongguang',
		name: '虹光幻影（隐藏能力）',
		system: '心灵系',
		desc: '织出日辉与虹色光影，以光与暗生成幻境，可笼罩黑暗、影响生物情绪。iridescent——日之光织成虹。现已不用。',
	},
]

// ============ 三、专属法宝（对齐 cultivation.js treasures schema） ============
export const ocArtifacts = {
	'扶桑枝': {
		id: '扶桑枝',
		type: 'weapon',
		rarity: 5,
		realm: 3,
		passive: {atkBonus: 3, fortune: 5},
		desc: '东方汤谷太阳栖息的神树之枝，持之可掌握御灵系·木。三足乌从东方起飞，不在西方落脚——日出之树与他的血脉同频。',
	},
}

// ============ 四、专属卡牌（对齐 cards.js schema，供后续接入卡池） ============
export const ocCards = [
	{
		name: '拾遗',
		element: '生灵',
		type: 'skill',
		energy: 1,
		block: 6,
		target: 'player',
		image: 'apteryx-mantelli.jpg',
		description: '吸收散灵余韵。获得 6 点格挡。',
		upgrade() {
			this.block = 9
			this.upgraded = true
			this.name = '拾遗+'
			this.description = '吸收散灵余韵。获得 9 点格挡。'
		},
	},
	{
		name: '衔光',
		element: '生灵',
		type: 'skill',
		energy: 1,
		powers: {weak: 2},
		target: 'enemy',
		image: 'angel-messenger.jpg',
		description: '牵起一缕光丝，令敌人虚弱 2 层。',
		upgrade() {
			this.powers.weak = 3
			this.upgraded = true
			this.name = '衔光+'
			this.description = '牵起一缕光丝，令敌人虚弱 3 层。'
		},
	},
	{
		name: '金乌展翅',
		element: '火',
		type: 'attack',
		energy: 2,
		damage: 12,
		target: 'enemy',
		image: 'the-angel-of-death.jpg',
		description: '展翅时翅缘淌虹光。造成 12 点伤害。',
		upgrade() {
			this.damage = 16
			this.upgraded = true
			this.name = '金乌展翅+'
			this.description = '展翅时翅缘淌虹光。造成 16 点伤害。'
		},
	},
	{
		name: '虹间安魂',
		element: '空间',
		type: 'skill',
		energy: 2,
		block: 12,
		target: 'player',
		image: 'angel-messenger.jpg',
		description: '展开「虹之间」收容残魂。获得 12 点格挡。',
		upgrade() {
			this.block = 16
			this.upgraded = true
			this.name = '虹间安魂+'
			this.description = '展开「虹之间」收容残魂。获得 16 点格挡。'
		},
	},
]

// ============ 五、专属灵质空间（对齐 spirit-spaces.js schema） ============
export const ocSpiritSpaces = [
	{
		id: 'ss_oc_hongzhijian',
		realm: 2,
		name: '虹之间',
		owner: '虹（佳霖）· 三足乌',
		theme: '空间系 · 安魂收藏',
		desc: '你误入一处藏在虹光里的灵质空间——无数发光石头悬浮其间，每块都收容着一段残魂记忆。主人是三足乌后裔「虹」，正细心擦拭一块刻着太阳鸟纹的河姆渡骨器残片。他抬头看你，琥珀色的眼睛里闪过高天流云：「迷路了吗？坐坐吧，我这儿……收留了很多回不去家的魂。」',
		choices: {
			left: {text: '帮忙安放残魂', effects: {daoHeart: 10, fortune: 5}},
			center: {text: '泡一泡恒温温泉', effects: {maxHealth: 6, cultivation: 4}},
			right: {text: '请他拨亮一缕光丝', effects: {addCard: '金刃', fortune: 3}},
		},
	},
]

// ============ 六、专属事件（对齐 worldview-events.js schema） ============
export const ocEvents = [
	{
		id: 'e_oc_rainbow_meet',
		realm: 1,
		title: '雨后虹光 · 三足乌',
		description:
			'雨后初晴，一道虹光横跨山野。虹光尽头，一只黑羽鎏金的巨鸟收翅落地，化作黑发琥珀瞳的青年。他歪头看你，指尖亮起一缕光丝：「咦，你能看见我？那……交个朋友？」',
		choices: {
			left: {text: '接过光丝', effects: {daoHeart: 10, fortune: 5}},
			right: {text: '请教拾遗之术', effects: {cultivation: 15}},
		},
	},
	{
		id: 'e_oc_rainbow_huiguan',
		realm: 2,
		title: '西木会馆的旧客',
		description:
			'路过一座挂着陌生牌匾的会馆，门边坐着个青年，正盯着招牌发呆。他回头看你：「这馆子……以前叫西木会馆来着？我叫虹，三百年没回来了，馆子怕是连名字都换了。」',
		choices: {
			left: {text: '陪他聊会馆旧事', effects: {daoHeart: 12, fortune: 4}},
			right: {text: '邀他同行走一程', effects: {cultivation: 10, maxHealth: 4}},
		},
	},
	{
		id: 'e_oc_rainbow_shiyi',
		realm: 3,
		title: '安魂者',
		description:
			'战场上散灵弥漫，一只三足乌缓缓掠过，翅缘虹光卷起无主的残魂，轻轻放入随身的光石。他望向你：「聚灵而生，散灵而归——我只是帮它们回家。」',
		choices: {
			left: {text: '帮他安放残魂', effects: {daoHeart: 15, fortune: 8}},
			right: {text: '感悟生死之道', effects: {cultivation: 20, daoHeart: -3}},
		},
	},
]

// ============ 七、隐藏设定 · 彩蛋（源自人设站 22 条） ============
export const ocEggFacts = [
	{title: '名字的由来', content: '「霖」是雨，「乌」是日——雨过天晴见虹。虹、佳霖与三足乌，是一环扣一环的名字。'},
	{title: '妖界真名', content: '踆乌——《淮南子》载「日中有踆乌」，是三足乌的正式古名。平时不用，藏起来了。'},
	{title: '1468岁的来历', content: '北周明帝二年（558年），史书记载「顺阳献三足乌」——那年他差点被捉去献给皇帝当祥瑞。从那时算起，恰好1468年。'},
	{title: '三足乌小史', content: '最早是「金乌负日」——古人相信太阳是神鸟驮着飞的，河姆渡、仰韶的彩陶上就有太阳鸟纹，那时还是二足。西汉《淮南子》说「日中有踆乌」，东汉《论衡》才明确「三足」——汉代人信「阳成于三」，给太阳鸟加了一足。南北朝时它成了祥瑞，《宋书》载「三足乌，王者慈孝天地则至」。到明代，三足乌退下神坛变成装饰纹样。'},
	{title: '衔光（唤光）', content: '与在意的人之间牵起光丝，联系越深光越亮——所以怕「没有光亮的感觉」，光亮就是牵挂的刻度。'},
	{title: '扶桑枝', content: '扶桑是东方汤谷里太阳栖息的神树（西方日落之树叫若木，不能用）；持此枝可通御灵系·木。'},
	{title: '拾遗', content: '本质是分解者，吸收死者遗留的散灵、收容无主空间；灵质空间「虹之间」就是他的收藏室兼安魂所。'},
	{title: '果冻', content: '亮晶晶还会晃——乌鸦天性，看到发光的东西就走不动道。'},
	{title: '衣着的秘密', content: '深红紫近黑，如同凝固的暮色；内衬金橙，如同暮色里藏着一轮落日——三足乌本就是落日与虹光变的。'},
	{title: '虹光幻影（隐藏能力）', content: '曾经的心灵系能力：织出日辉与虹色光影，以光与暗生成幻境，可笼罩黑暗、影响生物情绪。iridescent——日之光织成虹。现已不用。'},
	{title: '十日传说', content: '《山海经·大荒南经》载「汤谷上有扶木，一日方至，一日方出，皆载于乌」——上古有十只金乌，每日轮流驮日巡天。他是十日的后裔，血脉里流淌着背负光明的本能。十日后被后羿射落九只，他是最小那只的后代，所以格外珍惜光。'},
	{title: '后羿射日', content: '后羿射落九日，本质是射杀了九只三足乌。他是那场浩劫幸存者的后裔——所以对弓箭有本能的警惕，但也理解后羿的苦衷。他收集无主空间的习惯，某种程度上也是在替祖先赎罪。'},
	{title: '扶桑与若木', content: '扶桑在东方汤谷，是日出之树；若木在西方虞渊，是日落之树。他持扶桑枝而非若木枝，因为三足乌从东方起飞，不在西方落脚。若木属阴，持之则暮气沉沉，三足乌用了会犯困。'},
	{title: '河姆渡太阳鸟', content: '七千年前河姆渡遗址的「双鸟朝阳」象牙蝶形器，是已知最早的太阳鸟图像——两只鸟夹着太阳。那是三足乌祖先还在二足时代的模样。他灵质空间里收藏的最古老发光石头，就是刻有太阳鸟纹的河姆渡骨器残片。'},
	{title: '仰韶彩陶鸟纹', content: '仰韶文化庙底沟类型的彩陶上有大量鸟纹，从写实到抽象演变——那是上古人类对太阳鸟崇拜的浓缩过程。他的拾遗能力本质上也在做同样的事：把消散的灵力浓缩、归档、保存。'},
	{title: '汤谷沐浴', content: '《山海经》说金乌每日从汤谷起飞前要先沐浴。他保留了这个习性——特别爱泡温泉和热水澡，泡完才精神抖擞。冷水澡会让他一整天都蔫蔫的。所以他的灵质空间里有一口用灵力维持恒温的温泉。'},
	{title: '日中黑子', content: '古人说「日中有踆乌」，现代天文学认为这是人类最早对太阳黑子的观测记录——黑子形状像鸟。他的琥珀色眼睛里偶尔会闪过暗点，那就是三足乌血脉在与太阳共鸣的证据。天文学家说太阳黑子有11年周期，他说他的心情也有。'},
	{title: '西王母与三青鸟', content: '《山海经》载西王母有三青鸟，为之取食。三青鸟和三足乌是远亲——都是神鸟，但三青鸟是信使，三足乌是太阳。他偶尔会收到三青鸟传来的消息，都是些「西王母问你最近怎么样」之类的客套话。他回「挺好的」，然后继续摆弄发光石头。'},
	{title: '金乌负日的重量', content: '上古金乌每日驮日巡天，那是何等重量——一颗恒星的引力压在三只爪子上。他的后裔继承了这个本能：背负。所以他习惯先照顾别人感受，不是矫情，是基因里写着「扛得住」。但他自己也需要有人托一把。'},
	{title: '虞渊与归墟', content: '若木所在的虞渊是日落之处，归墟是万水归流之海。三足乌的归宿本是西方——但他偏偏留在了东方，因为东方有扶桑、有汤谷、有日出。他选择做日出的鸟，不做日落的鸟。所以他的名字里没有「暮」字，只有「霖」（雨）和「虹」（雨后之光）。'},
	{title: '楚地太阳崇拜', content: '楚国是太阳崇拜最盛的地方。屈原《九歌·东君》写的就是太阳神：「暾将出兮东方，照吾槛兮扶桑」。他第一次读到这首诗的时候愣了很久，觉得屈原写的就是自己——「青云衣兮白霓裳，举长矢兮射天狼」，虽然他不会射箭。'},
	{title: '高句丽壁画三足乌', content: '高句丽古墓壁画中有大量三足乌形象，与太阳、蟾蜍（月亮）并列。朝鲜半岛的三足乌信仰从中国传入，成为王权象征。他曾游历过辽东和半岛北部，在那些壁画前站了很久——看到自己祖先被画在别人的墓室里，感觉挺奇妙的。'},
]

// ============ 八、统计 ============
export const ocStats = {
	abilities: ocAbilities.length,
	artifacts: Object.keys(ocArtifacts).length,
	cards: ocCards.length,
	spiritSpaces: ocSpiritSpaces.length,
	events: ocEvents.length,
	eggFacts: ocEggFacts.length,
}
