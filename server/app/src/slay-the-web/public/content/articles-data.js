// 罗小黑战记·重生之门 —— 世界观词条（Articles / Lexicon）
// 数据来源：assets\罗小黑战记数据库\worldview_luoxiaohei_v4.db（articles 表，9 条设定词条）
// 用途：为图鉴页新增「世界观词条」区块，把散落在法宝、概念、事件里的关键设定词条集中展示，
//       供玩家理解「重生之门」世界观：天明珠 / 蓝玉盘 / 众生之门 / 黑咻 / 若木 / 拾贰集 / 聚灵散灵。
// 关联字段：
//   relatedTreasure —— 关联法宝 id（须存在于 content/cultivation.js treasures）
//   relatedCard     —— 关联卡名（须存在于 content/cards.js）
//   relatedTerm     —— 关联设定术语（对应 content/worldview-data.js spiritLifecycle / abilitySystems）

export const articles = [
	{
		name: '天明珠',
		category: '法宝·宝物',
		description: '老君阁的宝物，实际是老君发布的誓言录任务之一。TV 动画开篇罗小黑正是为盗取天明珠而重伤流落城市，也是「重生之门」轮回传承的至宝。',
		tags: ['法宝', '誓言录', '老君'],
		relatedTreasure: '天明珠',
	},
	{
		name: '蓝玉盘',
		category: '法宝·空间',
		description: '老君的空间系法宝，耳饰形态，可转移人去标记过的地方，赠送了一只给罗小白。与「重生之门」爬塔中的传送机制一脉相承。',
		tags: ['法宝', '空间系', '老君', '罗小白'],
		relatedTreasure: '蓝玉盘',
	},
	{
		name: '众生之门',
		category: '游戏·世界观',
		description: '一款人气极高的 VR 游戏，妖精和人类都可参与。TV 动画「众生之门篇」的核心舞台，也是本游戏「重生之门」的世界观命名来源。',
		tags: ['游戏', 'VR', '众生之门篇'],
	},
	{
		name: '黑咻（嘿咻）',
		category: '生灵·能力',
		description: '罗小黑尾巴分裂出的独立意识生命体，可用于传送。小黑空间系能力的具象化，游戏中「黑咻·分裂体」敌人由此而来。',
		tags: ['生灵', '罗小黑', '空间系', '传送'],
		relatedCard: '黑咻·分身',
	},
	{
		name: '若木',
		category: '材料·克制',
		description: '能伤害妖精的特殊材料，制成的子弹曾在第二部中用于袭击会馆。对妖精具有额外威胁的稀有素材。',
		tags: ['材料', '克制妖精', '第二部'],
		relatedTreasure: '若木',
	},
	{
		name: '拾贰集',
		category: '法宝·誓言',
		description: '老君曾因无聊立下诸多誓言，被众妖精整理成 12 本书。每一页都是一道约束老君的灵誓，与「灵誓」双系合技同源。',
		tags: ['法宝', '誓言', '老君', '灵誓'],
		relatedTreasure: '拾贰集',
	},
	{
		name: '聚灵与散灵',
		category: '概念·生命周期',
		description:
			'妖精生命周期的核心机制。聚灵：生灵汇聚形成精灵，精灵与物质灵结合演变为妖精，是妖精诞生的方式（如天虎在龙游森林聚灵诞生）。散灵：生物死亡后生灵消散回归自然，灵质空间衰竭导致死亡。魂灵足够强大时肉体消亡后可凝而不散。',
		tags: ['概念', '生命周期', '聚灵', '散灵'],
		relatedTerm: '聚灵',
	},
	{
		name: '散灵动画参考',
		category: '概念·视觉',
		description:
			'散灵是聚灵的逆过程：妖精死亡后生灵消散回归自然。标准散灵过程：身体渐透 → 生灵如蒲公英飘散 → 加速消融 → 光点升天 → 回归大地。特殊案例：风息化树——生灵向下沉降化为林木。',
		tags: ['概念', '散灵', '动画', '风息化树'],
		relatedTerm: '散灵',
	},
	{
		name: '妖精生命周期视觉系统',
		category: '概念·视觉',
		description:
			'妖精的完整生命周期：聚灵（诞生）→ 生存 → 散灵（死亡）。聚灵为生灵+物质灵汇聚成形，散灵为生灵消散回归自然。数据库 spirit_lifecycle 表记录了 12 个核心概念，包含详细的动画视觉设计规范，与「重生之门」的魂灵跨局传承机制对应。',
		tags: ['概念', '生命周期', '视觉设计', '魂灵传承'],
		relatedTerm: '魂灵',
	},
	{
		name: '灵',
		category: '概念·灵识',
		description:
			'罗小黑世界的基础物质，分为物质灵与生灵两类，存在于空间中、无处不在。肉眼不可见但能被感知，部分生物还能辨别灵的所有者（如鹿野的「追毫」之术）。',
		tags: ['概念', '灵', '物质灵', '生灵'],
		relatedTerm: '灵',
	},
	{
		name: '物质灵',
		category: '概念·灵识',
		description:
			'组成一切事物的基石，偏向物质层面的构成。少部分妖精主要由物质灵组成（如虚淮）。妖精诞生过程中，生灵汇聚成精灵后，须与物质灵结合方能演变成实体。',
		tags: ['概念', '物质灵', '虚淮'],
		relatedTerm: '物质灵',
	},
	{
		name: '生灵',
		category: '概念·灵识',
		description:
			'生命的象征。生灵会自行汇聚形成精灵，精灵与物质灵结合可演变为妖精。生物死后生灵消散回归自然；魂灵则是生灵长期凝聚后的高级形态。',
		tags: ['概念', '生灵', '生命'],
		relatedTerm: '生灵',
	},
	{
		name: '魂灵',
		category: '概念·灵识',
		description:
			'生命在孕育过程中吸收自然界生灵后孕育出的灵识，是意识与自我认知的载体。魂灵足够强大时，肉体消亡后可凝而不散——「重生之门」的跨局传承正由此而来。',
		tags: ['概念', '魂灵', '传承'],
		relatedTerm: '魂灵',
	},
	{
		name: '精灵',
		category: '概念·灵识',
		description:
			'生灵汇聚后形成的无实体存在形态，是妖精诞生过程中的中间阶段——已具备初步生命特征，但尚未与物质灵结合、没有固定实体。',
		tags: ['概念', '精灵', '聚灵'],
		relatedTerm: '精灵',
	},
	{
		name: '妖精',
		category: '概念·灵识',
		description:
			'聚灵而生的生物：生灵汇聚成精灵，精灵与物质灵结合演变为妖精。因其特殊的生成形式，天生便具有御灵能力，可在人形与妖形之间切换。',
		tags: ['概念', '妖精', '聚灵', '御灵'],
		relatedTerm: '妖精',
	},
	{
		name: '灵质空间',
		category: '概念·能力',
		description:
			'每个生命体固有的物质空间，用于储存灵，与生命直接相关——灵质空间衰竭时生命体便会死亡。大小与修为有关，属性由六大系决定，高阶妖精可将其开辟为独立世界。',
		tags: ['能力', '灵质空间', '六大系', '空间系'],
		relatedTerm: '灵质空间',
	},
	{
		name: '灵质力',
		category: '概念·能力',
		description:
			'本作中一切超自然能力的统称。每个人与妖都拥有储存灵质力的灵质空间；妖精因聚灵而生，天生具备御灵能力，通过修炼可增强并拓展灵质空间。',
		tags: ['能力', '灵质力', '御灵系'],
		relatedTerm: '灵质力',
	},
	{
		name: '固种论',
		category: '概念·文化',
		description:
			'妖精群体中广泛信奉的理论：妖精都是种子，现在所有生物（包括人族）都是由远古妖族繁衍变化而来，反映了妖精对自身起源的理解。',
		tags: ['文化', '信仰', '妖精'],
		relatedTerm: '固种论',
	},
	{
		name: '灵偶与傀儡',
		category: '概念·衍生',
		description:
			'直接用生灵和物质灵造出的仿生命体，看起来是活的却没有太多自我意识。凝聚魂灵的难度极高，故灵偶只是「活着的空壳」——老君阁守门灵偶即属此类。',
		tags: ['衍生', '灵偶', '傀儡', '老君阁'],
		relatedTerm: '灵偶',
	},
	{
		name: '风息化树',
		category: '概念·特殊',
		description:
			'风息在龙游展开领域失败后，生灵散尽却未完全消散，而是化为一片林木留在龙游——散灵的特殊形态。那份执拗的恨与遗憾化作灵，缠上了见证者的剑。',
		tags: ['特殊', '散灵', '风息', '龙游'],
		relatedTerm: '散灵',
	},
	{
		name: '森林聚灵环境',
		category: '概念·环境',
		description:
			'妖精聚灵诞生所需的严苛自然条件：人迹罕至的深山老林、生灵种类与数量充足、物质灵活跃、漫长时间。人类扩张正在压缩这类环境——人妖矛盾由此而来。',
		tags: ['环境', '聚灵', '原始森林'],
		relatedTerm: '聚灵',
	},
	{
		name: '天虎聚灵',
		category: '概念·实例',
		description:
			'天虎是在龙游森林中聚灵诞生的虎形妖精，原作电影番外漫画第 3 话《聚灵》详细展示了其诞生过程，是理解「聚灵」机制的核心案例。',
		tags: ['实例', '聚灵', '天虎', '龙游森林'],
		relatedTerm: '聚灵',
	},
]

/** 词条统计（供图鉴标题 small 展示） */
export const articleStats = {
	total: articles.length,
	categories: [...new Set(articles.map((a) => a.category))].length,
	withTreasure: articles.filter((a) => a.relatedTreasure).length,
	withCard: articles.filter((a) => a.relatedCard).length,
	withTerm: articles.filter((a) => a.relatedTerm).length,
}

/** 按词条名查找（未收录返回 undefined） */
export function articleByName(name) {
	return articles.find((a) => a.name === name)
}

/**
 * 词条-收集联动：给定获得/购买的法宝 id 或卡牌名，返回应自动解锁的关联词条名列表。
 * 依据词条上的 relatedTreasure / relatedCard 字段精确匹配；无关联时返回空数组。
 * @param {{treasureId?: string, cardName?: string}} got 本次获得的法宝 id / 卡牌名
 * @returns {string[]}
 */
export function articlesLinkedTo({treasureId, cardName}) {
	if (!treasureId && !cardName) return []
	return articles
		.filter((a) => (treasureId && a.relatedTreasure === treasureId) || (cardName && a.relatedCard === cardName))
		.map((a) => a.name)
}

/** 概念词条：未关联具体法宝/卡牌的法则类词条，仅能通过「灵质空间洞悉」解锁。 */
export function conceptArticles() {
	return articles.filter((a) => !a.relatedTreasure && !a.relatedCard)
}
