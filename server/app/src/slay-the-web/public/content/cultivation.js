// 修仙系统内容：境界 / 事件池 / 法宝
// 素材移植自「一念仙途」(xiuxiancardgame) 的 realm、chapter_milestones、karma、treasures 数据
// 事件效果支持字段：
//   cultivation  修为增减（满100突破境界）
//   daoHeart     道心增减
//   fortune      福缘增减
//   health       当前生命增减
//   maxHealth    最大生命增减
//   addCard      加入一张卡（卡名须存在于 content/cards.js）
//   treasure     获得一件法宝（id 须存在于本文件 treasures）
// 馆主彩蛋：三足乌「虹（佳霖）」专属法宝（content/oc-rainbow.js）
import {ocArtifacts} from './oc-rainbow.js'

export const realms = [
	{
		name: '炼气',
		chapter: '凡尘初醒',
		desc: '灵气入体，初窥门径。',
		lifespanBonus: 0,
	},
	{
		name: '筑基',
		chapter: '宗门风云',
		desc: '气旋成基，踏入宗门。',
		lifespanBonus: 5,
	},
	{
		name: '金丹',
		chapter: '丹心问道',
		desc: '金丹凝聚，正魔相争。',
		lifespanBonus: 8,
	},
	{
		name: '元婴',
		chapter: '碎丹成婴',
		desc: '丹碎成婴，因果初显。',
		lifespanBonus: 12,
	},
	{
		name: '化神',
		chapter: '神游太虚',
		desc: '元神化神，一念千里。',
		lifespanBonus: 20,
	},
	{
		name: '渡劫',
		chapter: '天劫飞升',
		desc: '九九雷劫，飞升在望。',
		lifespanBonus: 30,
	},
]

// 每境界的突破奖励
export const breakthroughBonus = {
	maxHealth: 10,
	daoHeart: 5,
}

// 法宝（移植自一念仙途 treasures.json，适配 Slay the Web 战斗机制）
// 被动效果在 actions.js 挂接：
//   hpRegen  每回合结束回复生命
//   atkBonus 攻击卡伤害加成
//   defBonus 格挡卡加成
//   fortune  福缘加成
export const treasures = {
	'灵泉葫芦': {
		id: '灵泉葫芦',
		type: 'accessory',
		rarity: 2,
		realm: 0,
		passive: {hpRegen: 2},
		desc: '永远温热的葫芦，装的是灵泉之水。装备后每回合回复少量生命。',
	},
	'玄铁甲': {
		id: '玄铁甲',
		type: 'armor',
		rarity: 2,
		realm: 1,
		passive: {defBonus: 3},
		desc: '玄铁锻造的护甲。格挡更加坚实，打出的防御牌额外+3格挡。',
	},
	'剑心佩': {
		id: '剑心佩',
		type: 'weapon',
		rarity: 3,
		realm: 2,
		passive: {atkBonus: 3},
		desc: '青云剑宗内门弟子的信物。每张攻击牌额外造成+3伤害。',
	},
	'天机罗盘': {
		id: '天机罗盘',
		type: 'accessory',
		rarity: 4,
		realm: 3,
		passive: {fortune: 10},
		desc: '天机道院的星象法器。福缘+10，秘境与机缘更青睐你。',
	},
	// ---- 罗小黑世界观法宝（源自 content/worldview-data.js artifacts）----
	'天明珠': {
		id: '天明珠',
		type: 'accessory',
		rarity: 4,
		realm: 2,
		passive: {fortune: 8},
		desc: '老君至宝，存放于老君阁灵质空间。福缘+8，机缘更青睐你。',
	},
	'定心镜': {
		id: '定心镜',
		type: 'armor',
		rarity: 3,
		realm: 2,
		passive: {defBonus: 4},
		desc: '老君所赐法宝，定心守神。防御牌额外+4格挡。',
	},
	'蓝玉盘': {
		id: '蓝玉盘',
		type: 'accessory',
		rarity: 5,
		realm: 3,
		passive: {hpRegen: 3},
		desc: '老君所赠顶级空间系法宝，可定点空间位移（冷却三十日）。每回合回复3点生命。',
	},
	'琼圆盾': {
		id: '琼圆盾',
		type: 'armor',
		rarity: 4,
		realm: 3,
		passive: {defBonus: 6},
		desc: '老君所赐，用作最后防御。防御牌额外+6格挡。',
	},
	// ---- 罗小黑世界观法宝（二）：源自 worldview_luoxiaohei_v4.db articles 表 ----
	'若木': {
		id: '若木',
		type: 'weapon',
		rarity: 3,
		realm: 2,
		passive: {atkBonus: 4},
		desc: '能伤害妖精的特殊材料，制成子弹曾用于袭击流石会馆。每张攻击牌额外造成+4伤害。',
	},
	'拾贰集': {
		id: '拾贰集',
		type: 'accessory',
		rarity: 3,
		realm: 2,
		passive: {fortune: 8},
		desc: '老君曾因无聊立下诸多誓言，被众妖精整理成十二本书。福缘+8。',
	},
	'众生之门': {
		id: '众生之门',
		type: 'accessory',
		rarity: 4,
		realm: 3,
		passive: {atkBonus: 5},
		desc: '人气极高的VR游戏，妖精和人类都可参与，山新等人在其中习得御灵系、心灵系能力。每张攻击牌额外造成+5伤害。',
	},
	'黑咻': {
		id: '黑咻',
		type: 'accessory',
		rarity: 4,
		realm: 3,
		passive: {defBonus: 5},
		desc: '小黑尾巴分裂出的独立意识生命体，可变成翅膀、小鸟或绳子，也能互相传送。防御牌额外+5格挡。',
	},
	// ---- 罗小黑世界观法宝（三）：源自 database/pages/老君的法宝.md ----
	'八卦镜盘': {
		id: '八卦镜盘',
		type: 'accessory',
		rarity: 3,
		realm: 2,
		passive: {fortune: 6},
		desc: '镜背饰有八卦凸纹，可用于远程观察。福缘+6，提前看破凶兆。',
	},
	'辟火珠': {
		id: '辟火珠',
		type: 'accessory',
		rarity: 3,
		realm: 2,
		passive: {atkBonus: 4},
		desc: '老君所炼避火之珠，曾借予一凡尝试接近太阳。每张攻击牌额外造成+4伤害。',
	},
	'碧玉甲': {
		id: '碧玉甲',
		type: 'armor',
		rarity: 4,
		realm: 3,
		passive: {defBonus: 6},
		desc: '可抵挡攻击，穿着时可贴身移动；失去意识时会自行触发护主。防御牌额外+6格挡。',
	},
	'方寸盒': {
		id: '方寸盒',
		type: 'accessory',
		rarity: 3,
		realm: 2,
		passive: {hpRegen: 2},
		desc: '小小方寸，内藏乾坤，可收纳灵药温养己身。每回合回复2点生命。',
	},
	'魂灯': {
		id: '魂灯',
		type: 'accessory',
		rarity: 3,
		realm: 2,
		passive: {hpRegen: 3},
		desc: '老君以魂力点亮的灯盏，可温养神魂。每回合回复3点生命。',
	},
	'碎叶': {
		id: '碎叶',
		type: 'weapon',
		rarity: 4,
		realm: 3,
		passive: {atkBonus: 6},
		desc: '以无限旧剑重铸而成，赠还无限。每一击都带着旧日锋芒，攻击牌额外造成+6伤害。',
	},
	'预蝉': {
		id: '预蝉',
		type: 'accessory',
		rarity: 4,
		realm: 3,
		passive: {defBonus: 5},
		desc: '可感知周围的危险，蝉鸣先至、灾祸后至。防御牌额外+5格挡。',
	},
	'天灵丹': {
		id: '天灵丹',
		type: 'accessory',
		rarity: 5,
		realm: 3,
		passive: {hpRegen: 5},
		desc: '肉体受伤，只要没死即可激发，瞬间恢复伤势。每回合回复5点生命。',
	},
	// ---- 区域守门 Boss 专属战利品（对应 dungeon-encounters.js REGION_BOSS_LOOT）----
	// 击败对应区域的守门 Boss / 最终 Boss 时必定掉落（仅一次，重复击败回退通用池）。
	'风息之种': {
		id: '风息之种',
		type: 'accessory',
		rarity: 3,
		realm: 3,
		passive: {hpRegen: 2},
		desc: '离岛一战，风息散灵化树后遗留的种子。木系生机凝而不散，每回合回复2点生命。',
	},
	'北域寒晶': {
		id: '北域寒晶',
		type: 'armor',
		rarity: 3,
		realm: 3,
		passive: {defBonus: 5},
		desc: '北域之主那伽镇守千年的冰晶，蕴含凛冬寒意。防御牌额外+5格挡。',
	},
	'灵誓契': {
		id: '灵誓契',
		type: 'accessory',
		rarity: 4,
		realm: 4,
		passive: {fortune: 8},
		desc: '老君阁试炼所获，一页出自拾贰集的灵誓残页，言出法随。福缘+8。',
	},
	'冰火玄晶': {
		id: '冰火玄晶',
		type: 'weapon',
		rarity: 4,
		realm: 4,
		passive: {atkBonus: 4},
		desc: '玄离冰火双域交锋后凝成的晶石，寒焰同存。每张攻击牌额外造成+4伤害。',
	},
	'阎罗令': {
		id: '阎罗令',
		type: 'weapon',
		rarity: 4,
		realm: 4,
		passive: {atkBonus: 5},
		desc: '明王镇守蓝溪镇酆都所持之令，可号令魂灵、噬敌心神。每张攻击牌额外造成+5伤害。',
	},
	'流石令': {
		id: '流石令',
		type: 'accessory',
		rarity: 5,
		realm: 5,
		passive: {fortune: 10},
		desc: '流石会馆执行者信物，印有妖灵会馆徽记，得妖灵认可者方可得见。福缘+10。',
	},
	'门灵之钥': {
		id: '门灵之钥',
		type: 'accessory',
		rarity: 5,
		realm: 5,
		passive: {hpRegen: 4},
		desc: '重生之门·门灵消散后凝成的钥匙，是轮回边界的凭证。每回合回复4点生命。',
	},
	// ---- 罗小黑世界观法宝（四）：源自 worldview_luoxiaohei_v4.db spirit_lifecycle 法器灵物（43 条）转正 ----
	// 炼气 · 丹药灵果（老君炼制 / 誓言录）
	'护灵丹': {
		id: '护灵丹',
		type: 'accessory',
		rarity: 2,
		realm: 0,
		passive: {hpRegen: 1},
		desc: '老君炼制的护体丹药，身体出现中毒症状时使用，失去意识便会自行触发。每回合回复1点生命。',
	},
	'涪灵丹': {
		id: '涪灵丹',
		type: 'accessory',
		rarity: 2,
		realm: 0,
		passive: {maxHealth: 4},
		desc: '老君炼制的疗伤丹，TV21话特别附送给小黑疗伤，并托纸条向无限问好。服用后最大生命+4。',
	},
	'青灵果': {
		id: '青灵果',
		type: 'accessory',
		rarity: 2,
		realm: 0,
		passive: {maxHealth: 5},
		desc: '誓言录中记载的灵果，进入锁御宫方可获得。服用后最大生命+5。',
	},
	'指灵戒': {
		id: '指灵戒',
		type: 'accessory',
		rarity: 2,
		realm: 0,
		passive: {fortune: 5},
		desc: '老君戴在指间的灵戒，可导引灵气。福缘+5，机缘更青睐你。',
	},
	// 筑基 · 空间储物与护具
	'乾坤袋': {
		id: '乾坤袋',
		type: 'accessory',
		rarity: 3,
		realm: 1,
		passive: {fortune: 6},
		desc: '空间法器，内含由生物死后处理形成的无主灵质空间，可收纳物品（电影2中出现）。福缘+6。',
	},
	'流石甲': {
		id: '流石甲',
		type: 'armor',
		rarity: 3,
		realm: 1,
		passive: {defBonus: 4},
		desc: '流石会馆护甲，妖灵会馆徽记暗藏甲内。防御牌额外+4格挡。',
	},
	'百药柜': {
		id: '百药柜',
		type: 'accessory',
		rarity: 3,
		realm: 1,
		passive: {hpRegen: 2},
		desc: '老君存放丹药的柜子，与炼丹息息相关。每回合回复2点生命。',
	},
	'唤灵石': {
		id: '唤灵石',
		type: 'accessory',
		rarity: 3,
		realm: 1,
		passive: {atkBonus: 2},
		desc: '可唤醒灵石之力的法器，与灵质空间共鸣。每张攻击牌额外造成+2伤害。',
	},
	// 金丹 · 高阶法器与神器
	'空间简片': {
		id: '空间简片',
		type: 'armor',
		rarity: 4,
		realm: 2,
		passive: {defBonus: 5},
		desc: '老君持有的空间系法宝，薄如竹简，可直接转移攻击。防御牌额外+5格挡。',
	},
	'盏铃对戒': {
		id: '盏铃对戒',
		type: 'accessory',
		rarity: 4,
		realm: 2,
		passive: {fortune: 8},
		desc: '定点传送法宝，实现两地互换，原属百丰山，经无限争夺后获得。福缘+8。',
	},
	'飞去来': {
		id: '飞去来',
		type: 'weapon',
		rarity: 4,
		realm: 2,
		passive: {atkBonus: 3},
		desc: '可回旋飞出的神器，一去一来皆有杀机。每张攻击牌额外造成+3伤害。',
	},
	'本命灵石': {
		id: '本命灵石',
		type: 'accessory',
		rarity: 4,
		realm: 2,
		passive: {maxHealth: 8},
		desc: '与妖精本命关联的灵石，本命所系、生机所依。最大生命+8。',
	},
	// 元婴 · 传说法宝
	'风火乾坤圈': {
		id: '风火乾坤圈',
		type: 'weapon',
		rarity: 5,
		realm: 3,
		passive: {atkBonus: 4},
		desc: '哪吒的法宝：乾坤圈与风火轮实为相同的三个环，尺寸可变、可分可合，化为手环藏于衣下。每张攻击牌额外造成+4伤害。',
	},
	// ---- 法器灵物转正（五）：worldview_luoxiaohei_v4.db spirit_lifecycle 剩余法器灵物（2026-08-29 补录）----
	'玄清丹': {
		id: '玄清丹',
		type: 'accessory',
		rarity: 3,
		realm: 1,
		passive: {maxHealth: 6},
		desc: '老君丹药，收入誓言录中，条件是有人能逼老君出手。服用后最大生命+6。',
	},
	'虚灵草': {
		id: '虚灵草',
		type: 'accessory',
		rarity: 3,
		realm: 1,
		passive: {hpRegen: 2},
		desc: '蕴含虚灵之力的灵草，形态飘忽不定。每回合回复2点生命。',
	},
	'大御镜盘': {
		id: '大御镜盘',
		type: 'armor',
		rarity: 4,
		realm: 2,
		passive: {defBonus: 5},
		desc: '与八卦镜盘相似的镜面法器，用途未明，可折射来敌攻势。防御牌额外+5格挡。',
	},
	'灵珠': {
		id: '灵珠',
		type: 'accessory',
		rarity: 5,
		realm: 3,
		passive: {fortune: 10},
		desc: '上古灵器，蕴含精纯灵质力，机缘自会寻来。福缘+10。',
	},
	'游地简': {
		id: '游地简',
		type: 'weapon',
		rarity: 5,
		realm: 3,
		passive: {atkBonus: 5},
		desc: '可游走大地的神器简牍，来历神秘，一击即走、行踪难觅。每张攻击牌额外造成+5伤害。',
	},
	// ---- 法器灵物转正（六）：worldview_luoxiaohei_v4.db spirit_lifecycle 法器灵物全量收官（2026-08-30 补录）----
	'斥冰焰': {
		id: '斥冰焰',
		type: 'weapon',
		rarity: 3,
		realm: 2,
		passive: {atkBonus: 4},
		desc: '冰焰类法器，寒焰相生、焚而不灼。每张攻击牌额外造成+4伤害。',
	},
	'焚焰火': {
		id: '焚焰火',
		type: 'weapon',
		rarity: 3,
		realm: 2,
		passive: {atkBonus: 4},
		desc: '火焰类法器，黑面罩与独角兽曾用以克冰，焰势炽烈。每张攻击牌额外造成+4伤害。',
	},
	'巨灵阵': {
		id: '巨灵阵',
		type: 'armor',
		rarity: 4,
		realm: 2,
		passive: {defBonus: 5},
		desc: '大型战斗阵法/法器，聚灵成阵、以阵御敌。防御牌额外+5格挡。',
	},
	'木系灵核': {
		id: '木系灵核',
		type: 'accessory',
		rarity: 5,
		realm: 3,
		passive: {hpRegen: 4},
		desc: '木系神器灵核，与木落仙人相关，蕴含生生不息之力。每回合回复4点生命。',
	},
	'凝天丹': {
		id: '凝天丹',
		type: 'accessory',
		rarity: 3,
		realm: 1,
		passive: {maxHealth: 6},
		desc: '凝聚天地灵气的丹药，服之可凝练灵质力。服用后最大生命+6。',
	},
	'清丹': {
		id: '清丹',
		type: 'accessory',
		rarity: 2,
		realm: 1,
		passive: {maxHealth: 4},
		desc: '清灵涤浊的丹药，可净化体内浊气。服用后最大生命+4。',
	},
	'闭气丸': {
		id: '闭气丸',
		type: 'accessory',
		rarity: 2,
		realm: 1,
		passive: {fortune: 6},
		desc: '老君所持丹药，服后可在水下呼吸、避水通气。福缘+6。',
	},
	'噬灵药': {
		id: '噬灵药',
		type: 'accessory',
		rarity: 4,
		realm: 2,
		passive: {fortune: 8},
		desc: '可吞噬灵质力的药物，用途成谜，似能暗中夺取他人灵质。福缘+8。',
	},
	'风灵草': {
		id: '风灵草',
		type: 'accessory',
		rarity: 2,
		realm: 0,
		passive: {hpRegen: 2},
		desc: '风属性灵草，随风摇曳、聚风成息，身轻如风。每回合回复2点生命。',
	},
	'灵心草': {
		id: '灵心草',
		type: 'accessory',
		rarity: 2,
		realm: 1,
		passive: {hpRegen: 2},
		desc: '养护心神之灵草，可安定灵识、稳固道心。每回合回复2点生命。',
	},
	'曲晶方': {
		id: '曲晶方',
		type: 'armor',
		rarity: 3,
		realm: 2,
		passive: {defBonus: 4},
		desc: '晶体类法器，可折射灵质力、偏转来敌攻势。防御牌额外+4格挡。',
	},
	'千音石': {
		id: '千音石',
		type: 'accessory',
		rarity: 3,
		realm: 2,
		passive: {fortune: 6},
		desc: '音类灵石，可传千音、辨万声，耳聪目明、洞察先机。福缘+6。',
	},
	'乌木': {
		id: '乌木',
		type: 'weapon',
		rarity: 2,
		realm: 1,
		passive: {atkBonus: 3},
		desc: '灵木材料，质坚而蕴灵，锻为兵刃锋锐内蕴。每张攻击牌额外造成+3伤害。',
	},
	'锁灵枷': {
		id: '锁灵枷',
		type: 'armor',
		rarity: 4,
		realm: 2,
		passive: {defBonus: 6},
		desc: '束缚/封锁类法器，可锁灵、禁锢灵质力，攻守兼备。防御牌额外+6格挡。',
	},
	'断金阵': {
		id: '断金阵',
		type: 'weapon',
		rarity: 4,
		realm: 3,
		passive: {atkBonus: 5},
		desc: '金属性阵法，锋锐破敌，可断金裂石。每张攻击牌额外造成+5伤害。',
	},
	// ---- 馆主彩蛋 · 三足乌「虹（佳霖）」专属法宝（content/oc-rainbow.js）----
	...ocArtifacts,
}

// 事件池：按境界(0-5)分组。每个事件二选一。
// 移植自一念仙途 chapter_milestones.json 的 MILESTONE 与 karma.json 的因果事件。
export const eventPool = [
	// ---------- 炼气 · 凡尘初醒 ----------
	{
		id: 'e_qi_realm',
		realm: 0,
		title: '灵根觉醒',
		description:
			'丹田深处，沉寂多年的经脉突然颤动。你感受到一缕若有若无的灵气在体内流转——这就是修行者所说的"气感"。但你的灵根似乎残缺不全，仅有剑脉微微回应。',
		choices: {
			left: {text: '追寻剑脉', effects: {cultivation: 15, daoHeart: 10}},
			right: {text: '修补灵根', effects: {cultivation: 10, health: -5, fortune: 5}},
		},
	},
	{
		id: 'e_qi_chance',
		realm: 0,
		title: '初遇机缘',
		description:
			'你在一座废弃道观中发现了半卷古朴的修炼法门，其上文字已模糊不清，但隐隐透出不凡之气。观外有散修路过，似乎也察觉到了此地的灵气波动。',
		choices: {
			left: {text: '独吞功法', effects: {cultivation: 20, daoHeart: -3}},
			right: {text: '分享机缘', effects: {cultivation: 10, fortune: 3, daoHeart: 5}},
		},
	},
	{
		id: 'e_qi_treasure',
		realm: 0,
		title: '灵泉葫芦',
		description:
			'一位重伤的采药人在山涧旁奄奄一息。他怀里抱着一只温热的葫芦——灵泉之水凝成的法宝。他说，若你能替他送药回家，这葫芦便是谢礼。',
		choices: {
			left: {text: '施救送药', effects: {treasure: '灵泉葫芦', daoHeart: 5}},
			right: {text: '取走葫芦', effects: {treasure: '灵泉葫芦', daoHeart: -10}},
		},
	},
	// ---------- 筑基 · 宗门风云 ----------
	{
		id: 'e_found_join',
		realm: 1,
		title: '拜入宗门',
		description:
			'你正式踏入宗门山门。青云缭绕的三宗四派各有千秋——剑宗以战养道，丹霞谷以药证道，天机阁以算问道。长老们的目光落在这位灵根残缺却意志过人的少年身上。',
		choices: {
			left: {text: '效忠师门', effects: {cultivation: 15, daoHeart: 5, fortune: 5}},
			right: {text: '保持距离', effects: {cultivation: 8, daoHeart: -3, fortune: 8}},
		},
	},
	{
		id: 'e_found_mission',
		realm: 1,
		title: '师门历练',
		description:
			'长老派你下山执行第一次外出任务——调查一座偏远山村的异象。村民称夜半时分有黑影在山间游荡，牲畜接连失踪。你背上行囊，踏出山门。',
		choices: {
			left: {text: '调查真相', effects: {cultivation: 12, daoHeart: 3}},
			right: {text: '先保村民', effects: {cultivation: 6, daoHeart: 8, fortune: 3}},
		},
	},
	{
		id: 'e_found_treasure',
		realm: 1,
		title: '玄铁甲',
		description:
			'铁匠铺里挂着一件玄铁锻造的护甲，通体乌黑、泛着冷光。老板说这是一位金丹前辈的旧物，因缺灵石而典当。你的宗门令牌恰好能抵一部分价。',
		choices: {
			left: {text: '典当购甲', effects: {treasure: '玄铁甲', cultivation: -5}},
			right: {text: '讨价还价', effects: {treasure: '玄铁甲', fortune: 3}},
		},
	},
	// ---------- 金丹 · 丹心问道 ----------
	{
		id: 'e_golden_realm',
		realm: 2,
		title: '秘境探索',
		description:
			'宗门藏经阁中藏着通往太虚秘境的传送阵。秘境中时间流速与外界不同，一日可抵百日苦修。但秘境深处亦有大恐怖——上古禁制与凶兽横行。',
		choices: {
			left: {text: '深入秘境', effects: {cultivation: 20, health: -15, fortune: 8}},
			right: {text: '只在边缘修行', effects: {cultivation: 12, daoHeart: 3}},
		},
	},
	{
		id: 'e_golden_choice',
		realm: 2,
		title: '正魔抉择',
		description:
			'一位黑衣女子拦住了你的去路。她的修为深不可测，周身散发着令人窒息的威压。"正道之路步步为营，你何不随我入魔道——那里没有规矩，只有力量。"',
		choices: {
			left: {text: '严词拒绝', effects: {daoHeart: 10, fortune: 5, cultivation: 5}},
			right: {text: '犹豫动摇', effects: {cultivation: 10, daoHeart: -5}},
		},
	},
	{
		id: 'e_golden_treasure',
		realm: 2,
		title: '剑心佩',
		description:
			'拍卖会上，一枚剑心佩被推上台——青云剑宗内门弟子的信物，蕴含先手剑意。台下修士竞价激烈，而你怀中刚好揣着宗门历练的赏赐。',
		choices: {
			left: {text: '倾囊竞拍', effects: {treasure: '剑心佩', cultivation: -5}},
			right: {text: '以功换佩', effects: {treasure: '剑心佩', daoHeart: -5}},
		},
	},
	// ---------- 元婴 · 碎丹成婴 ----------
	{
		id: 'e_nascent_karma',
		realm: 3,
		title: '因果清算',
		description:
			'修真界的因果轮盘开始转动。你过去种下的善因与恶因同时发芽——有人在远方因你的善举而得救，也有人在暗处因你的冷漠而记恨。此刻所有选择都浮出水面。',
		choices: {
			left: {text: '偿还因果', effects: {daoHeart: 5, cultivation: 3, fortune: 5}},
			right: {text: '快意恩仇', effects: {cultivation: 10, daoHeart: -3}},
		},
	},
	{
		id: 'e_nascent_fox',
		realm: 3,
		title: '狐影再现',
		description:
			'你曾在山中救过一只白狐。今天，一个白衣女子出现在你面前——她的眼睛像极了那只狐狸。她手里捧着一枚丹药，正是你最需要的凝婴丹。',
		choices: {
			left: {text: '接过丹药', effects: {cultivation: 20, daoHeart: 10}},
			right: {text: '询问她的身份', effects: {daoHeart: 15, fortune: 10}},
		},
	},
	{
		id: 'e_nascent_treasure',
		realm: 3,
		title: '天机罗盘',
		description:
			'天机阁的算师端详你许久，忽而抚须而笑："你这小辈福缘不浅，却缺一件堪舆法器。"他取出一只青铜罗盘，指针无风自转，指向秘境深处。',
		choices: {
			left: {text: '拜谢收下', effects: {treasure: '天机罗盘', daoHeart: 5}},
			right: {text: '推辞不受', effects: {daoHeart: 10, fortune: 5}},
		},
	},
	// ---------- 化神 · 神游太虚 ----------
	{
		id: 'e_deity_fate',
		realm: 4,
		title: '宿命抉择',
		description:
			'道心深处升起一个声音——你的灵根残缺本应无法修行，是"混沌漏洞"体质让你逆天而行。天机阁的长老警告你："混沌体质要么成仙要么成魔，没有第三条路。"此刻你必须面对自己的宿命。',
		choices: {
			left: {text: '顺应天命', effects: {daoHeart: 10, cultivation: 12}},
			right: {text: '我命由我', effects: {cultivation: 18, daoHeart: -5, fortune: 10}},
		},
	},
	{
		id: 'e_deity_crack',
		realm: 4,
		title: '世界崩塌',
		description:
			'天边出现了一道裂缝——不是比喻，是真正的空间裂缝。天道正在崩塌。所有化神以上的修士都感受到了这股震动。苍生涂炭的征兆已经出现。你该怎么做？',
		choices: {
			left: {text: '守护苍生', effects: {daoHeart: 8, health: -15, fortune: 5}},
			right: {text: '抓住机遇', effects: {cultivation: 20, fortune: 10, daoHeart: -5}},
		},
	},
	// ---------- 渡劫 · 天劫飞升 ----------
	{
		id: 'e_trib_heart',
		realm: 5,
		title: '心魔大劫',
		description:
			'第六十道劫雷不再劈在身上——它劈在心上。你的心魔显形了：它有着你的脸，穿着你的衣服，但眼神中充满愤恨与不甘。它质问你的每一个选择、每一道伤口。',
		choices: {
			left: {text: '直面心魔', effects: {daoHeart: 15, cultivation: 10, health: -5}},
			right: {text: '斩杀心魔', effects: {cultivation: 15, daoHeart: -5}},
		},
	},
	{
		id: 'e_trib_fox',
		realm: 5,
		title: '白狐报恩·终章',
		description:
			'白衣女子终于坦言——她就是你救过的那只白狐。她原本计划用千年修为为你挡一次天劫，但天道发现了她的打算。现在——她需要用另一种方式报恩。',
		choices: {
			left: {text: '让她传你秘术', effects: {cultivation: 30, fortune: 20, daoHeart: 10}},
			right: {text: '要她保重自己', effects: {daoHeart: 25, fortune: 15}},
		},
	},
]

// 按楼层（dungeon.graph 下标）决定当前境界：0=start, 1-8=中间层, 9=boss
export function realmForFloor(floor) {
	if (floor <= 0) return 0
	if (floor <= 2) return 0 // 炼气
	if (floor <= 4) return 1 // 筑基
	if (floor <= 6) return 2 // 金丹
	if (floor <= 7) return 3 // 元婴
	return 4 // 化神（boss 层前）
}

// 从指定境界的事件池中随机挑一个未触发过的事件
export function pickEventForRealm(realmIndex, usedEventIds = []) {
	const pool = eventPool.filter((e) => e.realm === realmIndex && !usedEventIds.includes(e.id))
	if (pool.length === 0) return null
	return pool[Math.floor(Math.random() * pool.length)]
}
