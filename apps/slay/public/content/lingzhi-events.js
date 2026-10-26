// 罗小黑战记·重生之门 —— 「灵质修行」灵质事件（奇遇）池
// 事件文案与设定来源：assets\罗小黑战记数据库\worldview_luoxiaohei_v4.db
//   spirit_lifecycle（灵质力生命周期术语：核心概念/能力体系/技能/法器灵物/特殊案例/环境条件等）、locations、character_events
// 用途：灵质回路中段随机出现的「缘」节点，选择不同选项获得不同收益/代价。
// effect 类型：
//   heal     回复 X 点生命
//   maxHp    提升 X 点最大生命（并回复等量）
//   loseHp   失去 X 点生命（最低保留 1 点）
//   shards   获得 X 修行残片（UI 层结算进修行进度）
// 所有文案为基于世界观库设定的同人整合，未编造库外设定。

export const lingzhiEvents = [
	{
		id: 'ev-lingjing',
		title: '定心镜的微光',
		flavor:
			'路边半埋着一面古朴铜镜。传说老君有「定心镜」可判断对方是否说谎，寻常仿品亦能映照心绪。镜中倒映的你目光澄澈，灵质力流转平稳。',
		options: [
			{label: '对镜凝神', desc: '回复 12 点生命', effect: {type: 'heal', amount: 12}},
			{label: '取镜而去', desc: '提升 4 点最大生命', effect: {type: 'maxHp', amount: 4}},
		],
	},
	{
		id: 'ev-lanyupan',
		title: '蓝玉盘的残响',
		flavor:
			'一块蓝玉碎片悬浮于空，边缘泛着空间涟漪。老君的蓝玉盘是空间系顶级法宝，可转移人去曾经标记过的地方——这块残片，似乎还认得归途。',
		options: [
			{label: '循着涟漪前行', desc: '回复 15 点生命（空间转移捷径）', effect: {type: 'heal', amount: 15}},
			{label: '炼化玉髓', desc: '提升 5 点最大生命', effect: {type: 'maxHp', amount: 5}},
		],
	},
	{
		id: 'ev-juling',
		title: '聚灵之地',
		flavor:
			'此处人迹罕至，生灵种类充足，物质灵格外活跃——正是「聚灵」诞生妖精所需的自然环境。空气中灵光浮沉，若在此修行，事半功倍。',
		options: [
			{label: '静坐吸纳', desc: '提升 6 点最大生命', effect: {type: 'maxHp', amount: 6}},
			{label: '引灵入体', desc: '回复 10 点生命', effect: {type: 'heal', amount: 10}},
		],
	},
	{
		id: 'ev-sanling',
		title: '散灵之林',
		flavor:
			'一片林木无风自动，叶间流转着淡青的灵光。传说风息在龙游展开领域失败后，生灵散尽却未完全消散，化为一片林木留于原处——这是散灵的特殊形态。',
		options: [
			{label: '踏入林中拾取灵光', desc: '失去 8 点生命，获得 25 残片', effect: {type: 'loseShards', lose: 8, shards: 25}},
			{label: '合十默哀后离开', desc: '回复 6 点生命', effect: {type: 'heal', amount: 6}},
		],
	},
	{
		id: 'ev-peiyuan',
		title: '培元试炼',
		flavor:
			'一位年迈的妖灵会馆前辈在此设下试炼。他擅长「培元」——培养、强化灵质力。若能通过他的考验，灵质空间将更为稳固。',
		options: [
			{label: '接受培元', desc: '提升 5 点最大生命', effect: {type: 'maxHp', amount: 5}},
			{label: '请教养气之法', desc: '回复 10 点生命', effect: {type: 'heal', amount: 10}},
		],
	},
	{
		id: 'ev-lingou',
		title: '灵偶的低语',
		flavor:
			'一具由生灵与物质灵捏成的灵偶倚在石边，看起来是活的，却没有太多自我意识。它缓缓抬手，指向一处藏有灵物碎片的裂隙。',
		options: [
			{label: '跟随灵偶指引', desc: '失去 5 点生命，获得 18 残片', effect: {type: 'loseShards', lose: 5, shards: 18}},
			{label: '为灵偶注入灵质力', desc: '回复 8 点生命', effect: {type: 'heal', amount: 8}},
		],
	},
	{
		id: 'ev-yuncang',
		title: '蕴藏之井',
		flavor:
			'一口枯井深处灵光隐现。空间系有「蕴藏」之技，可在灵质空间内储存灵质力——这口井曾被人用作天然的蕴藏之所，井底积着浓稠的灵。',
		options: [
			{label: '汲取井底灵泉', desc: '回复 16 点生命', effect: {type: 'heal', amount: 16}},
			{label: '拓印蕴藏之法', desc: '提升 3 点最大生命，获得 6 残片', effect: {type: 'maxShards', max: 3, shards: 6}},
		],
	},
	{
		id: 'ev-tianming',
		title: '天明珠的微光',
		flavor:
			'传说老君誓言录中有宝物「天明珠」，取得它需挑战玄离。此刻一枚仿明珠在夜色中浮沉，光晕温润，像在等待有缘的修行者。',
		options: [
			{label: '以灵质力温养明珠', desc: '获得 20 残片', effect: {type: 'shards', amount: 20}},
			{label: '借明珠光华疗伤', desc: '回复 12 点生命', effect: {type: 'heal', amount: 12}},
		],
	},
	{
		id: 'ev-huanling',
		title: '唤灵石共鸣',
		flavor:
			'一块唤灵石在灵脉交汇处微微震颤，可召唤灵石相关力量。共鸣声越来越响，仿佛有某种古老的灵正在苏醒。',
		options: [
			{label: '以血契共鸣', desc: '失去 6 点生命，提升 8 点最大生命', effect: {type: 'loseMax', lose: 6, max: 8}},
			{label: '以灵引共鸣', desc: '获得 12 残片', effect: {type: 'shards', amount: 12}},
		],
	},
	{
		id: 'ev-tunshi',
		title: '吞噬的诱惑',
		flavor:
			'暗处有低沉的声音蛊惑着你：「把灵质力交给我……或者，把别人的也夺来。」「豪夺」与「吞噬」之道，能速成，也会反噬。',
		options: [
			{label: '拒绝诱惑，紧守本心', desc: '回复 8 点生命', effect: {type: 'heal', amount: 8}},
			{label: '冒险一试吞噬之法', desc: '失去 10 点生命，获得 30 残片', effect: {type: 'loseShards', lose: 10, shards: 30}},
		],
	},
	{
		id: 'ev-baiyaogui',
		title: '百药柜残件',
		flavor:
			'废弃会馆的暗格里，半扇百药柜斜倚在墙边。老君以百药柜藏纳丹药，如今柜门洞开，几枚丹药在灵光中泛着温润色泽，药香与尘味混在一起。',
		options: [
			{label: '取天灵丹服下', desc: '提升 4 点最大生命', effect: {type: 'maxHp', amount: 4}},
			{label: '带走预蝉之鉴', desc: '获得遗物「灵镜」：战斗开始抽 1 张牌', effect: {type: 'relic', relic: 'lingjing'}},
		],
	},
	{
		id: 'ev-hualing',
		title: '画灵石壁',
		flavor:
			'一面石壁上刻着一幅未完成的灵偶图。无限曾以「画灵」之术让画中物活过来——画灵是生灵系与造物系的双系合技，若你能补完最后一笔，也许能收获一份造物之力。',
		options: [
			{label: '提笔补完灵偶', desc: '获得 1 张「绘涌」', effect: {type: 'addCard', card: 'huiyong'}},
			{label: '研读笔意', desc: '获得 15 残片', effect: {type: 'shards', amount: 15}},
		],
	},
	{
		id: 'ev-benshiling',
		title: '本命灵石',
		flavor:
			'一块本命灵石在灵脉交汇处缓缓脉动，与妖精本命相连。传闻以灵质力立誓共鸣，可结成临时灵契——灵誓之道，破誓者魂灭，立契者同心。',
		options: [
			{label: '立誓结契', desc: '获得遗物「灵契」：【灵斩】【唤灵】【灵爆】等伤害 +1', effect: {type: 'relic', relic: 'lingqi'}},
			{label: '引灵温养', desc: '获得 12 残片', effect: {type: 'shards', amount: 12}},
		],
	},
	{
		id: 'ev-xinchaojing',
		title: '心潮之井',
		flavor:
			'一汪倒映着星光的浅井，井水不深，却似乎能映出思绪。心灵系能力者曾在此修习「读心」与「戏梦」，井边残留着微弱的心印，随水波轻轻起伏。',
		options: [
			{label: '静观心印', desc: '获得 1 张「心潮」', effect: {type: 'addCard', card: 'xinchao'}},
			{label: '掬水洗心', desc: '回复 10 点生命', effect: {type: 'heal', amount: 10}},
		],
	},
	{
		id: 'ev-qingxiyu',
		title: '清洗之雨',
		flavor:
			'灵雾凝成的细雨落在林间，据说沾染此雨会洗净部分记忆。若能主动舍弃一段「杂念」，或许能腾出灵质空间，让修行更纯粹——清洗之道，向来有舍有得。',
		options: [
			{label: '洗净杂念', desc: '随机移除卡组中 1 张卡', effect: {type: 'removeCard'}},
			{label: '撑伞避雨', desc: '回复 8 点生命', effect: {type: 'heal', amount: 8}},
		],
	},
	{
		id: 'ev-duanjincan',
		title: '断金残阵',
		flavor:
			'一片断金阵的残迹，阵纹已毁去大半，却仍锁着一缕锋锐的灵光。锁御系以「制灵」「灵御」驾驭法宝，这残阵中似乎封存着可供汲取的灵质力。',
		options: [
			{label: '破阵取灵', desc: '失去 7 点生命，获得 30 残片', effect: {type: 'loseShards', lose: 7, shards: 30}},
			{label: '修复阵纹', desc: '提升 4 点最大生命', effect: {type: 'maxHp', amount: 4}},
		],
	},
	{
		id: 'ev-doushuaigong',
		title: '斗帅宫的回响',
		flavor:
			'一座青石擂台虚影浮现在回路深处——这是老君灵质空间中「斗帅宫」的回响，传说那里开放给妖精对战，天明珠任务亦与此地相关。一名素未谋面的执行者虚影立于台上，向你递出邀战的手势。',
		options: [
			{label: '登台应战', desc: '失去 9 点生命，获得 28 残片', effect: {type: 'loseShards', lose: 9, shards: 28}},
			{label: '观摩武艺', desc: '提升 3 点最大生命', effect: {type: 'maxHp', amount: 3}},
		],
	},
	{
		id: 'ev-suoyugong',
		title: '锁御宫的封印',
		flavor:
			'一扇半开的石门后透出幽光，门楣上残留着锁御系「制灵」「灵御」的阵纹痕迹。传说老君的锁御宫设下复杂封印、藏纳宝物，若能解开封禁，或可带走一缕灵光。',
		options: [
			{label: '解开封禁', desc: '获得遗物「战旗」：战斗开始力量 +1', effect: {type: 'relic', relic: 'zhanqi'}},
			{label: '研习阵纹', desc: '提升 5 点最大生命', effect: {type: 'maxHp', amount: 5}},
		],
	},
	{
		id: 'ev-xingyehu',
		title: '星夜湖的倒影',
		flavor:
			'一面倒映着星空的浅湖铺在回路中段，湖面没有边界，仿佛整片夜空都被收入其中——这是老君灵质空间中「星夜湖」的回响。蓝溪镇曾与它位于同一平面，后来灵质空间折叠，它便成了旧时光的倒影。',
		options: [
			{label: '临湖观想', desc: '回复 14 点生命', effect: {type: 'heal', amount: 14}},
			{label: '掬取星光', desc: '获得 1 张「心潮」', effect: {type: 'addCard', card: 'xinchao'}},
		],
	},
	{
		id: 'ev-qingninggong',
		title: '清凝宫的长明灯',
		flavor:
			'一座素净的宫阁虚影浮现在灵光中，门前悬着一盏长明灯——这是老君灵质空间中与李清凝相关的「清凝宫」回响。灯焰温润，仿佛还记着那位医者悬壶济世的旧事。',
		options: [
			{label: '借灯焰温养', desc: '回复 16 点生命', effect: {type: 'heal', amount: 16}},
			{label: '默祷片刻', desc: '提升 3 点最大生命', effect: {type: 'maxHp', amount: 3}},
		],
	},
	{
		id: 'ev-yaoshousenlin',
		title: '妖兽森林的暗影',
		flavor:
			'一片浓密的林木虚影在回路边缘生长，树影间隐约有兽瞳闪烁。传闻妖兽森林栖息着未被驯化的妖兽，灵质力格外浓郁，也格外危险——敢深入者，须付出代价。',
		options: [
			{label: '深入猎灵', desc: '失去 10 点生命，获得 32 残片', effect: {type: 'loseShards', lose: 10, shards: 32}},
			{label: '绕道而行', desc: '回复 8 点生命', effect: {type: 'heal', amount: 8}},
		],
	},
]

export function randomLingzhiEvent(excludeIds = []) {
	const pool = lingzhiEvents.filter((e) => !excludeIds.includes(e.id))
	if (!pool.length) return lingzhiEvents[Math.floor(Math.random() * lingzhiEvents.length)]
	return pool[Math.floor(Math.random() * pool.length)]
}

export const lingzhiEventStats = {
	events: lingzhiEvents.length,
}
