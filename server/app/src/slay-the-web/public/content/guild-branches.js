// 罗小黑战记·重生之门 —— 妖精会分馆出身（Guild Branch Origin）
// 数据来源：assets\罗小黑战记数据库\worldview_luoxiaohei_v4.db
//   organizations（妖灵会馆：管理妖精事务的组织，维护人妖平衡，下设各分馆和执行者）
//   org_branches（妖灵会馆七大分馆：苍南总馆、灵溪、龙游、流石、洞桥、粤东、寒木）
//   locations（苍南会馆=上古无主灵质空间改造而成；灵溪=罗小白家所在小镇，馆长卡里；
//              龙游=风息诞生地，馆长潘靖；流石会馆=馆长大松，第二部电影中遭人类袭击全员遇难）
//   characters.affiliation（各分馆成员：西木子/卡里/潘靖/大松/郑信毅/空空/大志等）
// 机制：
//   1. 开局出身一家妖灵会馆分馆（可指定，缺省随机），获得该分馆「馆训」被动
//      —— 呼应世界观「妖灵会馆维护人妖平衡」，御灵师以会馆分馆为出身与后盾。
//   2. 馆训被动与五行/灵质天赋/法宝/羁绊/灵偶共用 atkBonus/defBonus/hpRegen/fortune/daoHeart/maxHealth 键，
//      在战斗结算统一叠加（见 game/actions.js damageBlockTotal / endTurn）。
//   3. 分馆出身只提供馆训被动，不占卡位/法宝位；后续可在局内触发分馆支援事件深化该体系。
// 兼容性：旧存档无 guild 字段 → 无出身分馆（不报错、无加成），保持存档可继续。

// 妖灵会馆七大分馆（对应数据库 org_branches；苍南为总馆）
export const guildBranches = [
	{
		id: 'cangnan',
		name: '苍南总馆',
		title: '馆训·执法威仪',
		flavor: '妖灵会馆总馆，由上古无主灵质空间改造而成，五大长老坐镇，执行者中枢。出身于此，执法者的威仪与灵识的坚固刻入魂灵——道心 +5。',
		desc: '上古无主灵质空间改造而成的主会馆，妖灵会馆的总部。长老与执行者云集，是维护人妖平衡的最强后盾。',
		representative: '西木子（五大长老）、无限（最强执行者）',
		passive: {daoHeart: 5},
	},
	{
		id: 'lingxi',
		name: '灵溪分馆',
		title: '馆训·溪畔灵秀',
		flavor: '罗小白家所在的小镇，人妖共居的灵秀之地，馆长卡里。溪畔灵气汇聚，机缘自来——福缘 +2。',
		desc: '位于罗小白家所在的小镇，人妖和谐共居。馆长卡里，四小只也活跃于此。',
		representative: '卡里（馆长）、山新、涅帕、秃贝',
		passive: {fortune: 2},
	},
	{
		id: 'longyou',
		name: '龙游分馆',
		title: '馆训·生灵绵长',
		flavor: '风息诞生地，出入口位于龙游市，馆长潘靖。龙游森林生灵浓郁，滋养体魄——最大生命 +5。',
		desc: '龙游市中的妖灵会馆分馆。风息曾在此展开领域，馆长潘靖，执行者团队活跃。',
		representative: '潘靖（馆长）、花轮、冠萱、东东',
		passive: {maxHealth: 5},
	},
	{
		id: 'liushi',
		name: '流石分馆',
		title: '馆训·馆殇不屈',
		flavor: '馆长大松，第二部电影中遭人类袭击全员遇难。悲壮之馆的遗志化作锐意——攻击 +1。',
		desc: '妖灵会馆分馆之一。馆长大松，清泉、明月等皆为馆中成员。曾遭人类袭击，全员遇难。',
		representative: '大松（馆长）、清泉、明月、小玉',
		passive: {atkBonus: 1},
	},
	{
		id: 'dongqiao',
		name: '洞桥分馆',
		title: '馆训·守桥如心',
		flavor: '山间守桥分馆，往来妖精与行旅皆受其护。守桥如守心，御守见长——格挡 +1。',
		desc: '妖灵会馆分馆之一，郑信毅等馆员驻守，守护一方通路。',
		representative: '郑信毅',
		passive: {defBonus: 1},
	},
	{
		id: 'yuedong',
		name: '粤东分馆',
		title: '馆训·海阔心宽',
		flavor: '南海之滨的分馆，往来商旅与妖精汇聚。海阔天空，心性豁达，灵识澄明——道心 +3。',
		desc: '妖灵会馆分馆之一，位于南海之滨，往来通达。',
		representative: '空空',
		passive: {daoHeart: 3},
	},
	{
		id: 'hanmu',
		name: '寒木分馆',
		title: '馆训·寒木凌霜',
		flavor: '北境寒木之地的分馆。寒木凌霜，生机内敛，战后缓缓回灵——每回合回复 1 点生命。',
		desc: '妖灵会馆分馆之一，地处寒木之地，馆员体魄坚韧。',
		representative: '大志',
		passive: {hpRegen: 1},
	},
]

/** @param {string} id @returns {object|undefined} */
export const guildById = (id) => guildBranches.find((g) => g.id === id)

/** 随机出身一家分馆 */
export const randomGuildId = () => guildBranches[Math.floor(Math.random() * guildBranches.length)].id

/** 汇总出身分馆的馆训被动数值（与 branchPassiveTotal / elementPassiveTotal 对齐） */
export function guildPassiveTotal(player, key) {
	if (!player || !player.guild) return 0
	const guild = guildById(player.guild)
	return guild?.passive?.[key] || 0
}

// 馆训被动在战斗结算中与五行 / 灵质天赋 / 法宝 / 羁绊 / 今日灵机 / 灵偶统一叠加（见 game/actions.js damageBlockTotal / endTurn）

// —— 局内分馆支援事件 ——
// 机制：出身分馆的御灵师爬塔途中，事件房有 30% 概率先触发本馆支援事件
// （代表角色登场、赠予馆中恩惠），深化「妖灵会馆为御灵师后盾」的出身体系。
// 接入点：content/worldview-events.js pickGuildSupportEvent → game/dungeon.js V 节点分支。
// 效果字段与世界观事件一致（cultivation/daoHeart/fortune/health/maxHealth/addCard/treasure），
// 由 game/actions.js makeEventChoice 统一应用；addCard 卡名须存在于 content/cards.js，
// treasure 法宝 id 须存在于 content/cultivation.js 的 treasures。

/** 七大分馆支援事件（每个分馆一个，guildId 对应 guildBranches 的 id） */
export const guildSupportEvents = [
	{
		id: 'e_guild_cangnan',
		guildId: 'cangnan',
		portrait: '无限',
		title: '总馆驰援',
		description:
			'夜路之上，一道剑意无声而至——总馆执行者无限立于檐角，剑未出鞘，灵压已覆满长街："会馆的人，走到哪里都有人兜底。"他随手一弹，一缕剑意没入你眉心。',
		choices: {
			left: {text: '循剑意悟道', effects: {daoHeart: 8, cultivation: 10}},
			right: {text: '请执行者试招', effects: {maxHealth: 5, addCard: '金刃'}},
		},
	},
	{
		id: 'e_guild_lingxi',
		guildId: 'lingxi',
		portrait: '卡里',
		title: '溪畔送行',
		description:
			'灵溪分馆的邮差追了一路，塞给你一个油纸包——馆长卡里托人捎来的："出远门的孩子，带上家里的味道。"纸包还温着，像是刚出锅的鱼。',
		choices: {
			left: {text: '收下干粮', effects: {maxHealth: 6, fortune: 3}},
			right: {text: '给四小只回信', effects: {daoHeart: 6, fortune: 5}},
		},
	},
	{
		id: 'e_guild_longyou',
		guildId: 'longyou',
		portrait: '潘靖',
		title: '龙游护林',
		description:
			'龙游森林深处，馆长潘靖正带人巡林，一眼认出你腰间的会馆令，递来一枚护林符："森林会记住每一个会馆的孩子。"符上缠着生机勃勃的藤须。',
		choices: {
			left: {text: '随队巡林', effects: {cultivation: 12, maxHealth: 4}},
			right: {text: '讨教御木之道', effects: {addCard: '木缚藤蔓', daoHeart: 4}},
		},
	},
	{
		id: 'e_guild_liushi',
		guildId: 'liushi',
		portrait: '大松',
		title: '遗志相托',
		description:
			'流石分馆的旧址废墟上，大松的旧部认出你的出身，沉默良久，从怀中取出一盏旧灯："馆没了，馆训还在。这盏魂灯，替流石照一段路。"',
		choices: {
			left: {text: '接过魂灯', effects: {treasure: '魂灯', daoHeart: 5}},
			right: {text: '为故馆立誓', effects: {daoHeart: 8, cultivation: 8}},
		},
	},
	{
		id: 'e_guild_dongqiao',
		guildId: 'dongqiao',
		portrait: '郑信毅',
		title: '守桥人',
		description:
			'山间桥头，郑信毅拄着长刀值夜，见你风尘仆仆，让出半张草席："守桥人最懂路人的脚程。歇一晚，天亮再走。"桥下溪水潺潺，篝火正旺。',
		choices: {
			left: {text: '歇脚借火', effects: {health: 14, daoHeart: 3}},
			right: {text: '替守半夜', effects: {fortune: 6, daoHeart: 5}},
		},
	},
	{
		id: 'e_guild_yuedong',
		guildId: 'yuedong',
		portrait: '空空',
		title: '海风寄信',
		description:
			'粤东海港，一只猫妖叼着信追上来——分馆给每个出馆弟子的「平安笺」。"到了那边，记得报个平安。"海风咸咸的，信纸暖暖的。',
		choices: {
			left: {text: '收下平安笺', effects: {fortune: 8, daoHeart: 3}},
			right: {text: '托付家书', effects: {daoHeart: 6, cultivation: 8}},
		},
	},
	{
		id: 'e_guild_hanmu',
		guildId: 'hanmu',
		portrait: '大志',
		title: '寒木暖炉',
		description:
			'北境寒木林，大雪封路。大志在雪地里支起一口热汤锅，远远招呼你："寒木馆的人，饿着肚子过不了冬。"汤锅里咕嘟咕嘟冒着白汽。',
		choices: {
			left: {text: '喝碗热汤', effects: {health: 15, daoHeart: 3}},
			right: {text: '讨教体魄之术', effects: {maxHealth: 6, addCard: '土盾'}},
		},
	},
]

/** 出身分馆的支援事件（无出身分馆返回 undefined） */
export const guildSupportEvent = (guildId) => guildSupportEvents.find((e) => e.guildId === guildId)
