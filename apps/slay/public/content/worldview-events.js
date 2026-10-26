// 罗小黑战记·重生之门 —— 世界观事件池
// 设定来源：content/worldview-data.js（提取自 worldview_luoxiaohei_v4.db）
// 本模块将《罗小黑战记》的角色、地点、组织、法宝与「聚灵/散灵/灵质空间/御灵系/妖灵会馆」等
// 核心设定改编为爬塔事件，与 content/cultivation.js 的修仙事件池共同驱动事件房（地图 V 节点）。
// 效果字段与 cultivation.js 保持一致，由 game/actions.js 的 makeEventChoice 统一应用：
//   cultivation 修为增减（满100突破境界） / daoHeart 道心 / fortune 福缘 /
//   health 当前生命 / maxHealth 最大生命 / addCard 加入卡（须存在于 content/cards.js）/
//   treasure 获得法宝（id 须存在于 content/cultivation.js 的 treasures）
import {characters, locations, organizations, artifacts} from './worldview-data.js'
import {relations} from './relations-data.js'
// 馆主彩蛋：三足乌「虹（佳霖）」专属事件（content/oc-rainbow.js）
import {ocEvents} from './oc-rainbow.js'
// 角色立绘映射：portrait 名 → 图片 URL（content/character-images.js，图片位于 assets/characters/）
import {characterImages} from './character-images.js'
// 分馆支援事件：出身妖灵会馆分馆者，局内触发本馆代表角色支援（content/guild-branches.js）
import {guildSupportEvents} from './guild-branches.js'
// 角色生平大事记：核心角色关键剧情节点（content/character-events.js，提取自 worldview_luoxiaohei_v4.db 的 character_events 表）
import {characterEvents} from './character-events.js'

// 引用说明：角色 / 地点 / 组织 / 法宝均来自世界观数据，避免与剧情设定脱节。
const R = characters // 角色表
const L = locations // 地点表
const O = organizations // 组织表

// 世界观事件池：按境界(0-4)分组（realmForFloor 最高返回 4，渡劫境界不在爬塔地图出现）
export const worldviewEventPool = [
	// ---------- 炼气 · 凡尘初醒（初入妖精世界） ----------
	{
		id: 'e_wv_poly_awaken',
		realm: 0,
		title: '聚灵初醒',
		description:
			'你的灵质空间在沉睡多年后第一次震颤——空间内逸散的生灵开始缓缓汇聚。老妖精说过，妖精是聚灵而生，散灵而亡。此刻你隐约触摸到了这层生死的边界。',
		choices: {
			left: {text: '静心聚灵', effects: {cultivation: 15, daoHeart: 5, soulSeed: 1}},
			right: {text: '感悟外灵', effects: {cultivation: 8, fortune: 8}},
		},
		// 灵质天赋专属：生灵系/治愈系与生命灵质同源，可循散灵脉络感知灵脉去向
		branchChoice: {
			branch: ['shengling', 'zhiyu'],
			text: '以生灵感知灵脉',
			effects: {cultivation: 25, soulSeed: 2},
		},
	},
	{
		id: 'e_wv_cat_talk',
		realm: 0,
		portrait: '罗小黑',
		title: '会说话的猫',
		description:
			'在灵溪镇的屋檐下，一只通体漆黑的小猫忽然开口说话："你身上……有妖精的味道。"它歪着头打量你，尾巴尖轻轻晃动。猫妖并不多见，你更没想到它会主动搭话。',
		choices: {
			left: {text: '交个朋友', effects: {daoHeart: 10, fortune: 5, addCard: '金刃'}},
			right: {text: '保持警惕', effects: {cultivation: 8, daoHeart: -3}},
		},
		// 灵质天赋专属：心灵系可读心，看穿小猫的真实来意，交好不落陷阱
		branchChoice: {
			branch: 'xinling',
			text: '读心窥其来意',
			effects: {daoHeart: 15, fortune: 8},
		},
	},
	{
		id: 'e_wv_sense_group',
		realm: 0,
		title: '观灵之眼',
		description:
			'妖灵会馆感知组的人在灵溪附近追查一名失控妖精。为首者目光如炬——据说那是鹿野开发的「追毫」之术，能辨识灵力实时追踪目标。她瞥见了你，似乎把你当成了目标。',
		choices: {
			left: {text: '上前澄清', effects: {cultivation: 10, fortune: 5, daoHeart: 3}},
			right: {text: '绕道而行', effects: {fortune: 3, daoHeart: -2}},
		},
	},
	{
		id: 'e_wv_bidiu_rampage',
		realm: 0,
		portrait: '比丢',
		title: '团鼠暴走',
		description:
			'深山里传来一声巨响——被放生的团鼠比丢不知从哪吞了一块金属，圆滚滚的身子瞬间巨大化，皮毛泛着危险的蓝光。它一看到你便横冲直撞过来，只有碰上它的眉心才能让它安静下来。',
		choices: {
			left: {text: '冒险安抚', effects: {daoHeart: 10, health: -5, fortune: 5}},
			right: {text: '以灵制服', effects: {cultivation: 10, addCard: '木缚藤蔓'}},
		},
	},
	{
		id: 'e_wv_luojiashan_home',
		realm: 0,
		portrait: '罗小白',
		title: '罗家岙夜话',
		description:
			'你借宿在罗家岙——罗小白的老家，爷爷和阿根生活的地方。夜里村外传来异响，小白的三叔抄起扁担就要出门："都别慌，有我呢！"月光下，你隐约看见村口站着一个浑身寒气的身影。',
		choices: {
			left: {text: '随三叔守村', effects: {maxHealth: 5, daoHeart: 5}},
			right: {text: '独自探查', effects: {cultivation: 12, fortune: 3}},
		},
	},
	{
		id: 'e_wv_bond_hei',
		realm: 0,
		portrait: '罗小黑',
		title: '黑猫拦路',
		description:
			'灵溪镇的屋檐下，一只通体漆黑的小猫跳到你面前，尾巴尖轻轻晃动："喂，你身上有妖精的味道。"它歪着头打量你——是那只叫罗小黑的黑猫妖。它似乎觉得你顺眼，愿意和你走一段路。',
		choices: {
			left: {text: '交个朋友', effects: {bond: 'bond_hei', daoHeart: 5}},
			right: {text: '客气道别', effects: {cultivation: 10, fortune: 3}},
		},
	},
	{
		id: 'e_wv_bond_xiaobai',
		realm: 0,
		portrait: '罗小白',
		title: '小白的邀请',
		description:
			'灵溪镇口，一个扎着双马尾的女孩抱着团鼠拦住你，眼睛亮晶晶的："喂！你就是那只小黑猫说的朋友吧？来我家吃饭吧，爷爷烧的鱼可好吃了！"——罗小白，镇上有名的"大力士"，家里还养着会说话的小黑猫和总偷吃金属的团鼠。她笑得没心没肺，却让人心里暖融融的。',
		choices: {
			left: {text: '应邀赴约', effects: {bond: 'bond_xiaobai', daoHeart: 5}},
			right: {text: '道谢离开', effects: {cultivation: 8, fortune: 5}},
		},
	},
	{
		id: 'e_wv_bond_bidiu',
		realm: 0,
		portrait: '比丢',
		title: '团鼠偷吃',
		description:
			'扎营时，一只圆滚滚的团鼠神不知鬼不觉地啃光了你的干粮。它吃得肚子滚圆，抬头看到你，竟不逃，反而"吱"地叫了一声，像是在打招呼——这是比丢，罗小白家的团鼠，能吞下一切金属。',
		choices: {
			left: {text: '分它一半', effects: {bond: 'bond_bidiu', fortune: 3}},
			right: {text: '赶走它', effects: {cultivation: 8, daoHeart: -3}},
		},
	},
	{
		id: 'e_wv_bond_shanxin',
		realm: 0,
		portrait: '山新',
		title: '山新的邀约',
		description:
			'你在灵溪镇的公园里遇到一个女孩，正被一只大猫追得满场跑——山新，小白的邻居。她停下来喘着气打量你："喂，你会抓猫吗？"她大概只是想找个人一起遛猫、打游戏。',
		choices: {
			left: {text: '帮她一把', effects: {bond: 'bond_shanxin', daoHeart: 3}},
			right: {text: '婉言谢绝', effects: {fortune: 5, cultivation: 5}},
		},
	},
	// ---------- 筑基 · 宗门风云（妖灵会馆） ----------
	{
		id: 'e_wv_guild_invite',
		realm: 1,
		portrait: '卡里',
		title: '灵溪会馆',
		description:
			'灵溪会馆的馆长卡里站在树苗前，手里捏着一根新催生的枝条。他笑眯眯地递来一块会馆令牌："入会吗？会馆管饭，还管维护人妖平衡。"在他身后，会馆的屋檐下挂着风铃，风一吹便叮当作响。',
		choices: {
			left: {text: '加入妖灵会馆', effects: {daoHeart: 8, cultivation: 10, maxHealth: 5}},
			right: {text: '独行修行', effects: {cultivation: 12, daoHeart: -3}},
		},
	},
	{
		id: 'e_wv_executor_duty',
		realm: 1,
		title: '执行者巡游',
		description:
			'一名违规吞噬生灵的妖精在集市现身，妖灵会馆的执行者奉命将其制伏。战斗波及了你——箭在弦上，你要么出手相助，要么退到一旁保全自己。',
		choices: {
			left: {text: '协助制伏', effects: {cultivation: 12, daoHeart: 5, health: -5}},
			right: {text: '旁观记录', effects: {fortune: 6, daoHeart: 2}},
		},
	},
	{
		id: 'e_wv_dragonyou_sign',
		realm: 1,
		portrait: '潘靖',
		title: '龙游风云',
		description:
			'龙游城传来异动传闻——有人声称在城郊看见了会走动的树影。龙游会馆的潘靖馆长正亲自坐镇调查。潘靖曾是燕国军师，因刺杀皇帝失败为老君所救，如今是一馆之长。他或许需要人手。',
		choices: {
			left: {text: '前往龙游调查', effects: {cultivation: 12, fortune: 6, health: -5}},
			right: {text: '留在灵溪', effects: {daoHeart: 5, cultivation: 6}},
		},
	},
	{
		id: 'e_wv_liushi_fall',
		realm: 1,
		portrait: '大松',
		title: '流石残碑',
		description:
			'你路过一座残破的会馆——门匾上"流石"二字依稀可辨。馆长大松与全馆同僚，曾在一夜之间尽数倒在人类袭击之下。青石阶上还留着当年搏斗的痕迹，风穿过空荡的厅堂，呜咽如泣。',
		choices: {
			left: {text: '祭拜亡者', effects: {daoHeart: 10, maxHealth: 3}},
			right: {text: '搜寻遗物', effects: {fortune: 8, daoHeart: -3}},
		},
	},
	{
		id: 'e_wv_kali_tree',
		realm: 1,
		portrait: '卡里',
		title: '灵溪会馆·树商',
		description:
			'灵溪会馆馆长卡里又在街角卖树了——他催生树木的手艺一绝，树枝上挂满了新结的灵果。"帮我把这批树苗送到老君阁，工钱好说。"他笑眯眯地看着你，尾巴尖愉快地晃了晃。',
		choices: {
			left: {text: '帮忙送树', effects: {cultivation: 10, fortune: 5, daoHeart: 3}},
			right: {text: '讨教木系之术', effects: {maxHealth: 4, daoHeart: 4}},
		},
	},
	{
		id: 'e_wv_bond_wuxian',
		realm: 1,
		portrait: '无限',
		title: '雾中来客',
		description:
			'晨雾未散，一道白衣人影在溪边驻足——妖灵会馆执行者无限，正沿龙游方向巡查。他瞥见你练功，淡淡道："手法尚可，破绽太多。"说着随手递来一式御灵的诀窍。传闻他连斩妖都不需要拔剑。',
		choices: {
			left: {text: '虚心受教', effects: {bond: 'bond_wuxian', daoHeart: 5}},
			right: {text: '目送离去', effects: {cultivation: 10, fortune: 3}},
		},
	},
	{
		id: 'e_wv_bond_xuhuai',
		realm: 1,
		portrait: '虚淮',
		title: '迷路的传送师',
		description:
			'一个青色身影在树林里转来转去——虚淮，空间系妖精，出了名的路痴。他挠挠头朝你笑："这位朋友，灵溪会馆往哪边走？"他大概又是靠传送门把自己传丢了。',
		choices: {
			left: {text: '带他认路', effects: {bond: 'bond_xuhuai', daoHeart: 3}},
			right: {text: '指点方向后离开', effects: {fortune: 6, cultivation: 6}},
		},
	},
	// ---------- 金丹 · 丹心问道（离岛与立场） ----------
	{
		id: 'e_wv_island_call',
		realm: 2,
		title: '离岛来客',
		description:
			'一只沉默的大个子妖精在渡口等你，身后跟着笑容灿烂的同伴。他们说自己是离岛的人——风息领导的妖精组织，主张从人类手中夺回土地。他们邀请你上岛坐坐，语气真诚得让人不忍拒绝。',
		choices: {
			left: {text: '赴约离岛', effects: {cultivation: 18, daoHeart: -5, fortune: 5}},
			right: {text: '婉言谢绝', effects: {daoHeart: 8, fortune: 3}},
		},
	},
	{
		id: 'e_wv_space_trial',
		realm: 2,
		title: '灵质空间试炼',
		description:
			'一位高阶妖精向你敞开了自己的灵质空间——里面规则由开辟者制定，草木倒悬、时间流速异常。这是难得的机会，也是一场豪赌：领域内受伤，可能比外界更加致命。',
		choices: {
			left: {text: '深入探索', effects: {cultivation: 15, fortune: 8, health: -10}},
			right: {text: '谨慎退出', effects: {daoHeart: 5, cultivation: 8}},
		},
		// 灵质天赋专属：空间系天生觉性、无法后天习得，领域规则对空间系游刃有余
		branchChoice: {
			branch: 'kongjian',
			text: '以空间觉性游刃其间',
			effects: {cultivation: 25, fortune: 10},
		},
	},
	{
		id: 'e_wv_tianmingzhu',
		realm: 2,
		portrait: '老君',
		title: '天明珠之争',
		description:
			'府先生一伙为了救一位友人，正在打老君阁天明珠的主意。老君阁的守卫严阵以待，而你恰好身在阁中。这枚至宝是留给老君阁的，还是可以成为你护身的依仗？',
		choices: {
			left: {text: '协助守卫', effects: {daoHeart: 10, health: -8, treasure: '天明珠'}},
			right: {text: '两不相帮', effects: {cultivation: 10, fortune: 3}},
		},
	},
	{
		id: 'e_wv_laojun_golem',
		realm: 2,
		portrait: '老君',
		title: '老君阁守门灵偶',
		description:
			'老君阁的守门灵偶立在门侧，石心木骨，眸中一点灵火，仿佛已经站了几百年。据说老君身边那只傀儡更是活了数百岁——造物以生灵塑形、以物质灵凝体，看似是活的，却没有太多自我意识。你盯着它，忽然觉得自己也能造出一尊。',
		choices: {
			left: {text: '仿制守门灵偶', effects: {craftGolem: 'golem_shouling', cultivation: 5}},
			right: {text: '参悟造物之理', effects: {cultivation: 15, daoHeart: 5}},
		},
	},
	{
		id: 'e_wv_zhaoyue_grudge',
		realm: 2,
		portrait: '兆岳',
		title: '兆岳的敌意',
		description:
			'一名火土双系的执行者拦在你面前，抱着手臂冷笑："无限那家伙带出来的，没一个好东西。"他是兆岳，当年被无限揍进会馆的记仇妖精。他显然想借机与你过过招。',
		choices: {
			left: {text: '正面应战', effects: {cultivation: 18, health: -10, daoHeart: -3}},
			right: {text: '报上师承化解', effects: {daoHeart: 8, fortune: 5}},
		},
	},
	{
		id: 'e_wv_cangnan_hq',
		realm: 2,
		title: '苍南总馆',
		description:
			'你抵达苍南会馆——妖灵会馆总馆，由上古无主灵质空间改造而成。踏入的瞬间，浓郁的灵质力扑面而来。据说这里同时容纳着感知组与各地分馆的精英，是老君等创始人留下的根基。',
		choices: {
			left: {text: '入灵质空间修行', effects: {cultivation: 15, fortune: 5, health: -8}},
			right: {text: '拜访感知组', effects: {daoHeart: 8, cultivation: 8}},
		},
	},
	{
		id: 'e_wv_bond_huangshou',
		realm: 2,
		portrait: '皇受',
		title: '赖上的橘猫',
		description:
			'灵溪镇屋檐下，一只橘色的胖猫蹲在墙头看你——皇受，罗小黑的朋友，性格傲娇又粘人。它"喵"地一声跳下来，绕着你转了三圈，然后理直气壮地往你脚边一躺。猫妖的直觉很灵，它大概是闻到了你身上的好东西。',
		choices: {
			left: {text: '任它蹭着', effects: {bond: 'bond_huangshou', fortune: 5}},
			right: {text: '塞把小鱼干', effects: {fortune: 8, daoHeart: -2}},
		},
	},
	{
		id: 'e_wv_bond_fengxi',
		realm: 2,
		portrait: '风息',
		title: '离岛遗恨',
		description:
			'龙游旧城，你站在一株枯树前——风息曾在这里试图夺回妖精的家园，最终散灵于草木之间。他的执念、他的恨意与遗憾，仍残留在林间的灵流中。你若伸手触碰，那缕恨意便会缠上你的术法。',
		choices: {
			left: {text: '承接执念', effects: {bond: 'bond_fengxi', daoHeart: -5}},
			right: {text: '静立凭吊', effects: {daoHeart: 10, fortune: 5}},
		},
	},
	// ---------- 元婴 · 碎丹成婴（蓝溪镇与老君） ----------
	{
		id: 'e_wv_lanxi_ruins',
		realm: 3,
		title: '蓝溪镇遗梦',
		description:
			'老君灵质空间深处，一座被时光遗忘的城镇静静矗立——蓝溪镇，曾受老君庇护的人类城镇，迁镇后已成废墟。街角的医馆匾额还写着"三和堂"，清凝的故事似乎还留在每一块青石板上。',
		choices: {
			left: {text: '探查遗迹', effects: {cultivation: 15, fortune: 8, health: -8}},
			right: {text: '祭拜先人', effects: {daoHeart: 10, maxHealth: 5}},
		},
	},
	{
		id: 'e_wv_qingning_legend',
		realm: 3,
		portrait: '清凝',
		title: '清凝的传说',
		description:
			'你在一卷旧札记上读到蓝溪镇的传说：天生治愈之力的清凝，可消耗自身灵力以生灵修补魂灵、起死回生。她曾用这份力量救过整座城镇，也因这份力量被那伽觊觎三百年。',
		choices: {
			left: {text: '寻访治愈之术', effects: {maxHealth: 5, daoHeart: 5}},
			right: {text: '参悟生灵之道', effects: {cultivation: 12, fortune: 3}},
		},
	},
	{
		id: 'e_wv_naga_shadow',
		realm: 3,
		portrait: '那伽',
		title: '北域囚影',
		description:
			'北域深处传来求救的灵讯——那是被那伽囚禁的生灵在挣扎。那伽为延续寿命曾企图夺取清凝的治愈能力，如今他的阴影仍笼罩北域。潜入营救，意味着可能直面这位长老级的存在。',
		choices: {
			left: {text: '冒险营救', effects: {daoHeart: 12, fortune: 8, health: -15}},
			right: {text: '明哲保身', effects: {cultivation: 12, daoHeart: -3}},
		},
	},
	{
		id: 'e_wv_oldjun_hall',
		realm: 3,
		title: '锁御宫试炼',
		description:
			'老君阁灵质空间深处，锁御宫与斗帅宫相对而立。锁御宫以法宝法器为尊，斗帅宫以战法为要。守门的灵偶静静看着你："选一道门。御灵之道，止于一念。"',
		choices: {
			left: {text: '闯斗帅宫', effects: {cultivation: 20, health: -15, fortune: 5}},
			right: {text: '参悟锁御', effects: {daoHeart: 10, cultivation: 8}},
		},
		// 灵质天赋专属：锁御系与法宝法器亲和，守门灵偶感应到御器之缘
		branchChoice: {
			branch: 'suoyu',
			text: '引动法宝共鸣',
			effects: {cultivation: 20, daoHeart: 8, fortune: 5},
		},
	},
	{
		id: 'e_wv_heal_legacy',
		realm: 3,
		portrait: '清凝',
		title: '三和堂遗方',
		description:
			'蓝溪镇的废墟里，你从三和堂医馆的残柜中翻出一卷泛黄的药方——清凝所留。天生治愈之力的她，可消耗自身灵力以生灵修补魂灵、起死回生。卷尾一行小字："医者，以己身渡人。"',
		choices: {
			left: {text: '研习治愈之术', effects: {maxHealth: 8, daoHeart: 5}},
			right: {text: '参悟生灵之道', effects: {cultivation: 15, daoHeart: 3}},
		},
		// 灵质天赋专属：治愈系天生蕴养生机，可凭同源之力补全遗方
		branchChoice: {
			branch: 'zhiyu',
			text: '以治愈之灵补全遗方',
			effects: {maxHealth: 12, daoHeart: 8},
		},
	},
	{
		id: 'e_wv_lanyupan_gift',
		realm: 3,
		portrait: '罗小白',
		title: '蓝玉盘·空间传承',
		description:
			'老君阁的藏室深处，一枚泛着幽蓝光泽的玉盘悬于阵心——那是老君所赠罗小白的顶级空间系法宝蓝玉盘，可定点空间位移，三十日方能用上一次。守阁的灵偶静静看你良久，缓缓让开道路："有缘者，自可取之。"',
		choices: {
			left: {text: '承接蓝玉盘', effects: {treasure: '蓝玉盘', daoHeart: 5}},
			right: {text: '参悟空间之道', effects: {cultivation: 15, fortune: 5}},
		},
	},
	{
		id: 'e_wv_qiongyuan_guard',
		realm: 3,
		portrait: '鹿野',
		title: '琼圆盾·最后防御',
		description:
			'北域边界，一名失控的妖精正在暴走。感知组组长鹿野以金属丝线缠住它，腕间一面圆盾泛着微光——老君所赐的琼圆盾，是她留作最后防御的底牌。"我挡正面，你断它后路！"她头也不回地朝你喊。',
		choices: {
			left: {text: '合力制伏', effects: {treasure: '琼圆盾', health: -10, daoHeart: 8}},
			right: {text: '旁观金系战法', effects: {cultivation: 12, addCard: '金刃'}},
		},
	},
	{
		id: 'e_wv_bond_laojun',
		realm: 3,
		portrait: '老君',
		title: '老君阁茶会',
		description:
			'老君阁的庭院里，一位白发老者正侍弄一株灵茶——老君，妖界声望极高的上古大妖，年龄超一千四百岁。他看你一眼，随手推过一盏茶："坐。赶路的人，也该喝口热的。"',
		choices: {
			left: {text: '陪老君论道', effects: {bond: 'bond_laojun', daoHeart: 5}},
			right: {text: '求一枚灵果', effects: {maxHealth: 5, fortune: 5}},
		},
	},
	{
		id: 'e_wv_bond_diting',
		realm: 3,
		portrait: '谛听',
		title: '幽冥一瞥',
		description:
			'酆都地界，上古神兽谛听伏在幽冥入口处，紫云焰在它周身明灭。它缓缓睁开眼，目光穿过你落在虚空某处："你身上……有很长的路。想让我多看几眼，还是就此别过？"',
		choices: {
			left: {text: '承它一瞥', effects: {bond: 'bond_diting', daoHeart: 5}},
			right: {text: '拱手告退', effects: {cultivation: 15, fortune: 5}},
		},
	},
	// ---------- 化神 · 神游太虚（散灵与轮回） ----------
	{
		id: 'e_wv_windrest_tree',
		realm: 4,
		title: '风息之树',
		description:
			'龙游的这座公园里，一片林木静静生长——那是风息散灵后化作的森林。他曾想夺回妖精的家园，最终生灵散尽却并未完全消散，而是以另一种方式留在了这里。木叶在风中沙沙作响，像在诉说未尽的话。',
		choices: {
			left: {text: '感悟散灵', effects: {daoHeart: 12, cultivation: 10, soulSeed: 2}},
			right: {text: '收集逸散之灵', effects: {cultivation: 15, daoHeart: -3}},
		},
	},
	{
		id: 'e_wv_rebirth_gate',
		realm: 4,
		title: '重生之门',
		description:
			'你在一处古老遗迹前停步——门上刻着聚灵与散灵的纹路：生命在孕育时吸收生灵凝成魂灵，死亡时生灵回归天地，而妖精则聚灵而生。这扇门，据说通往魂灵轮回的源头，是"重生之门"的由来。',
		choices: {
			left: {text: '踏入轮回', effects: {maxHealth: 8, daoHeart: 8, soulSeed: 2}},
			right: {text: '保守观望', effects: {fortune: 10, cultivation: 8}},
		},
	},
	{
		id: 'e_wv_oldjun_oath',
		realm: 4,
		portrait: '老君',
		title: '老君灵誓',
		description:
			'云雾深处，一位白发老者倚着石台看你——妖界声望极高的老君，年龄超一千四百岁。他缓缓开口："灵誓，以魂灵为契。宣读灵誓可让人达成共识并绑定魂灵，违反誓言者直接魂灭。你可愿与我立一誓？"',
		choices: {
			left: {text: '立下灵誓', effects: {daoHeart: 15, fortune: 10}},
			right: {text: '婉言推辞', effects: {fortune: 6, daoHeart: -2, cultivation: 5}},
		},
	},
	{
		id: 'e_wv_wuxian_trial',
		realm: 4,
		portrait: '无限',
		title: '无限试炼',
		description:
			'一道人影负手立在断崖之巅，白衣猎猎——无限，妖灵会馆最强执行者，已成仙的世界至强。当年他一人一剑破城，使罗城不战而降。此刻他低头看你："走到这里，也算不易。接我一剑，或是转身。"',
		choices: {
			left: {text: '接下这一剑', effects: {cultivation: 25, health: -15, daoHeart: 5, addCard: '御金击'}},
			right: {text: '虚心求教', effects: {daoHeart: 12, fortune: 8}},
		},
	},
	{
		id: 'e_wv_diting_fire',
		realm: 4,
		portrait: '谛听',
		title: '谛听·酆都夜行',
		description:
			'夜色浓得化不开，你误入酆都地界——上古神兽谛听正蹲在幽冥入口处打盹，紫云焰在它周身明灭。它睁开眼："小家伙，走错了地方。要么让我的紫云焰送你一程，要么听我说个故事。"',
		choices: {
			left: {text: '求借定心镜', effects: {treasure: '定心镜', daoHeart: -3}},
			right: {text: '参悟紫云焰', effects: {cultivation: 18, addCard: '紫云焰'}},
		},
	},
	{
		id: 'e_wv_hualing_art',
		realm: 4,
		title: '画灵之技',
		description:
			'一位造物系妖精在溪边闭目凝神，指尖虚点，凭空绘出一只振翅的灵鸟——画灵，生灵系与造物系的双系合技。生灵赋予其魂，造物赋予其形。她睁开眼，将手诀缓缓演给你看。',
		choices: {
			left: {text: '参悟画灵', effects: {daoHeart: 10, cultivation: 10, addCard: '画灵'}},
			right: {text: '观摩造物', effects: {cultivation: 15, fortune: 5}},
		},
		// 灵质天赋专属：造物系以重构之道印证画灵，悟得无中生有之技
		branchChoice: {
			branch: 'zaowu',
			text: '以重构印证画灵',
			effects: {daoHeart: 12, cultivation: 12, addCard: '无中生有'},
		},
	},
	{
		id: 'e_wv_bond_gen',
		realm: 4,
		portrait: '阿根',
		title: '蓝溪镇的赠言',
		description:
			'蓝溪镇遗址，一个穿蓝衣的青年站在镇口等你——阿根，罗小白的表哥，实为上古神兽玄离的化身，潜伏于人类之中。他神色温和："妖的一生很长，别把力气花在恨上。"说完化作一头蓝白色的鹿，消失在雾中。',
		choices: {
			left: {text: '记下忠告', effects: {bond: 'bond_gen', daoHeart: 5}},
			right: {text: '追问玄离往事', effects: {cultivation: 20, daoHeart: -3}},
		},
	},
	{
		id: 'e_wv_bond_luyeshi',
		realm: 4,
		portrait: '鹿野',
		title: '追毫之约',
		description:
			'苍南总馆，感知组组长鹿野倚着栏杆，腕间金属丝线随指尖翻飞——金系感知型妖精，擅长以丝线追踪妖灵力。她挑眉看你："站那么远做什么？过来，教你一手追毫术。妖灵力会骗眼睛，但骗不了这根线。"',
		choices: {
			left: {text: '学追毫术', effects: {bond: 'bond_luyeshi', daoHeart: 3}},
			right: {text: '请教金系战法', effects: {cultivation: 18, addCard: '金刃'}},
		},
	},
	// —— 羁绊事件 · 新缘（对应 content/bonds.js 新增羁绊）——
	{
		id: 'e_wv_bond_panjing',
		realm: 1,
		portrait: '潘靖',
		title: '龙游棋局',
		description:
			'龙游会馆的庭院里，潘靖馆长独自对着一局残棋——这位昔日的燕国军师、为救老君而刺杀皇帝失败的传奇人物，如今握着茶杯轻笑："会下棋么？会馆的日子闷得很，来陪我坐坐。"',
		choices: {
			left: {text: '陪馆主对弈', effects: {bond: 'bond_panjing', daoHeart: 3}},
			right: {text: '讨教军略', effects: {cultivation: 12, daoHeart: 3}},
		},
	},
	{
		id: 'e_wv_bond_dongdong',
		realm: 1,
		portrait: '东东',
		title: '会馆的鸟哨',
		description:
			'龙游会馆的屋顶上，一个青年正对着一群灵鸟低声说话——东东，会馆的执行者，天生能指挥鸟类。他回头看见你，打了个唿哨，群鸟立刻四散而去："找东西？让它们帮你看，这附近没有它们找不到的。"',
		choices: {
			left: {text: '请鸟群相助', effects: {bond: 'bond_dongdong', fortune: 3}},
			right: {text: '婉谢侦查', effects: {cultivation: 10, fortune: 5}},
		},
	},
	{
		id: 'e_wv_bond_zeyu',
		realm: 2,
		portrait: '泽宇',
		title: '追毫传人',
		description:
			'苍南总馆的廊下，一个青年正用金属丝线缠着一枚落叶——泽宇，感知组组长鹿野的唯一弟子。他见你盯着丝线，咧嘴一笑："师父说妖灵力会骗眼睛，但骗不了线。想学么？"',
		choices: {
			left: {text: '学追毫之术', effects: {bond: 'bond_zeyu', daoHeart: 3}},
			right: {text: '请教感知', effects: {cultivation: 12, fortune: 3}},
		},
	},
	{
		id: 'e_wv_bond_luozhu',
		realm: 2,
		portrait: '洛竹',
		title: '林间来客',
		description:
			'林间小径上，一个青年倚着树干，指尖绕着一缕木系灵力——洛竹，风息一伙的同伴，来自森林的妖精。他抬眼看你："你是小黑的旧友？他说过你。森林喜欢你这样的人。"他说着，折下一根青枝递给你。',
		choices: {
			left: {text: '接过青枝', effects: {bond: 'bond_luozhu', daoHeart: 3}},
			right: {text: '谢绝同行', effects: {cultivation: 12, fortune: 3}},
		},
	},
	{
		id: 'e_wv_bond_qingning',
		realm: 3,
		portrait: '清凝',
		title: '三和堂的医者',
		description:
			'蓝溪镇废墟的三和堂，一个白衣女子在残垣间整理药柜——清凝，老君入室弟子，天生治愈之力。她指尖流过温润的灵光，修补着旧伤与断壁："医者以己身渡人。你若不赶路，我帮你看看旧伤。"',
		choices: {
			left: {text: '承其疗愈', effects: {bond: 'bond_qingning', maxHealth: 3}},
			right: {text: '辞别研习', effects: {maxHealth: 5, daoHeart: 3}},
		},
	},
	{
		id: 'e_wv_bond_naga',
		realm: 3,
		portrait: '那伽',
		title: '北域长老的目光',
		description:
			'北域的寒雾里，一道身影远远望向你——那伽，北域的长老级大妖。三百年前他觊觎清凝的治愈之力，将蓝溪镇逼入绝境；如今他打量你的目光，像在看一件待价而沽的器物。他并未动手，只留下意味深长的一句："你身上……有故人的味道。"',
		choices: {
			left: {text: '直面敌意', effects: {bond: 'bond_naga', daoHeart: -3}},
			right: {text: '隐匿行踪', effects: {cultivation: 15, fortune: 5}},
		},
	},
	// ---------- 新缘 · 旧友与神兽 ----------
	{
		id: 'e_wv_bond_kali',
		realm: 1,
		portrait: '卡里',
		title: '分馆的酒约',
		description:
			'龙游会馆后院的石桌前，灵溪分馆馆长卡里与龙游馆长潘靖又凑到了一起。两人拍着桌互不服输："上次是我先倒的？胡说！那是茶太烫！"结果三杯下肚双双趴桌。潘靖醉眼朦胧地拉住你："后生，替、替我送他回灵溪……"话没说完便打起呼噜。',
		choices: {
			left: {text: '送卡里回灵溪', effects: {bond: 'bond_kali', daoHeart: 5}},
			right: {text: '趁乱溜走', effects: {cultivation: 12, fortune: 3}},
		},
	},
	{
		id: 'e_wv_bond_longyou',
		realm: 2,
		portrait: '闵翔',
		title: '龙游旧友',
		description:
			'离岛海边的礁石上，闵翔吹着口琴，风息抱膝坐在一旁。海风把琴声吹得很远。"当年在龙游，我们也是这样看海的。"闵翔停下琴声，朝你眨眨眼："替我们记着这些日子——有些东西，得有人记着才不会散。"风息没有说话，只是把一片叶子放在琴孔边。',
		choices: {
			left: {text: '应下这个约定', effects: {bond: 'bond_longyou', daoHeart: 5}},
			right: {text: '问他们的过去', effects: {cultivation: 12, fortune: 3}},
		},
	},
	{
		id: 'e_wv_bond_jiuyou',
		realm: 2,
		portrait: '虚淮',
		title: '雾中旧识',
		description:
			'北域的寒雾里，虚淮与谛听一前一后停住脚步。谛听嗅了嗅空气："姓虚淮的，你还是老样子。"虚淮哈出一口白气："你不也是，成天趴在人家门口。"两只神兽谁也没有回头，却都不约而同地放慢了步子——像是在等谁同行。',
		choices: {
			left: {text: '跟上同行', effects: {bond: 'bond_jiuyou', daoHeart: 5}},
			right: {text: '远远目送', effects: {cultivation: 12, fortune: 4}},
		},
	},
	{
		id: 'e_wv_bond_baihu',
		realm: 4,
		portrait: '白虎',
		title: '神兽对弈',
		description:
			'老君阁外的云海上，白虎与青龙相对而坐，面前悬着一盘空无一子的棋盘。"天地为局，众生为子。"青龙的声音如钟磬般悠远，"你既然走到这里，便替我们落一子吧。"白虎眯起眼，尾巴在你脚边轻轻一扫——它也想听听你的答案。',
		choices: {
			left: {text: '落子入局', effects: {bond: 'bond_baihu', daoHeart: 5}},
			right: {text: '旁观不语', effects: {cultivation: 15, fortune: 5}},
		},
	},
	{
		id: 'e_wv_bond_lanyupan',
		realm: 3,
		portrait: '老君',
		title: '蓝玉盘的涟漪',
		description:
			'蓝溪镇旧址的石桥上，老君摩挲着腰间一枚蓝玉盘，忽然笑了："从前有个小姑娘，也爱缠着我讨这玉盘。"他把玉盘递到你面前，"替我看一眼——她长大后的世界，是什么模样。"玉盘上映着粼粼水光，像一句跨越四百年的托付。',
		choices: {
			left: {text: '接过玉盘', effects: {bond: 'bond_lanyupan', daoHeart: 5}},
			right: {text: '问蓝溪镇的往事', effects: {cultivation: 12, fortune: 5}},
		},
	},
	{
		id: 'e_wv_bond_zhijiao',
		realm: 4,
		portrait: '无限',
		title: '老友的茶',
		description:
			'苍南会馆的檐下，无限与老君相对而坐。老君端着茶盏不紧不慢："当年要不是我，你这把剑早就断在龙游了。"无限难得没有回嘴，只把杯中茶一饮而尽，朝你抬了抬下巴："记着，这样的朋友，一辈子遇不到几个。"',
		choices: {
			left: {text: '敬二人一杯', effects: {bond: 'bond_zhijiao', daoHeart: 5}},
			right: {text: '请教当年旧事', effects: {cultivation: 15, fortune: 3}},
		},
	},
	// ---------- 众生之门 VR 事件（小说/众生之门篇设定）----------
	// 数据来源：worldview_luoxiaohei_v4.db characters 表（佛岚 / MT / 三三阵营 / 李冶 / 奎恩东特等），
	// 将《众生之门》VR 游戏的玩家生态与终极任务改编为爬塔事件。
	{
		id: 'e_wv_zszm_mt',
		realm: 0,
		portrait: 'MT',
		title: '游戏向导的问候',
		description:
			'你打盹的功夫，眼前忽然亮起一片光幕——一个圆滚滚的虚拟向导从光幕里蹦出来，绕着圈打量你："检测到灵力波动，欢迎来到众生之门！"它是 MT，众生之门 VR 的向导，据说名字取自木头老师英文名的前两个字母。它眨眨眼："玩家等级为零，要现在开始吗？"',
		choices: {
			left: {text: '进入游戏', effects: {cultivation: 15, fortune: 5}},
			right: {text: '婉拒下线', effects: {daoHeart: 5, health: 3}},
		},
	},
	{
		id: 'e_wv_zszm_sansan',
		realm: 1,
		title: '三三阵营的招募',
		description:
			'众生之门服务器的公会广场上，一支人类小队正在招人——领头的是冷静果断的三三，身后站着攻守兼备的弓手阿显。他们打算去刷一个高难副本，缺个能打能扛的帮手。三三打量你一番："跟不跟？出了事我兜底。"',
		choices: {
			left: {text: '加入小队', effects: {cultivation: 10, addCard: '追毫'}},
			right: {text: '独自刷图', effects: {cultivation: 12, fortune: 3}},
		},
	},
	{
		id: 'e_wv_zszm_folan',
		realm: 2,
		portrait: '佛岚',
		title: '妖王佛岚的赞赏',
		description:
			'VR 世界的中央浮空岛上，妖王佛岚的虚影缓缓浮现，声如洪钟："终极任务，妖王佛岚的赞赏——从零升至两百级且不红名、六十级后击杀若干红名玩家、通关全部副本、集齐全部专属道具。"它顿了顿："此任务只能接一次，失败即失去唯一通关机会。"你忽然想起，小黑曾猜测这或许是执行者的考核。',
		choices: {
			left: {text: '接下任务', effects: {daoHeart: 10, fortune: 8, maxHealth: 5}},
			right: {text: '量力而行', effects: {cultivation: 12, daoHeart: 3}},
		},
	},
	{
		id: 'e_wv_zszm_redname',
		realm: 3,
		title: '红名堵截',
		description:
			'众生之门的野外小径上，一个头顶红名的玩家拦住了你。他周身灵力凝实，显然是个以猎杀玩家为乐的狠角色——在 VR 里被击败虽不会真死，但一身修为会跌得很难看，还要背上装备损失。他舔了舔嘴角："借你的等级一用。"',
		choices: {
			left: {text: '正面迎战', effects: {cultivation: 16, addCard: '金刃'}},
			right: {text: '传送脱身', effects: {fortune: 6, maxHealth: 3}},
		},
	},
	{
		id: 'e_wv_zszm_kuein',
		realm: 4,
		title: '规则失序者',
		description:
			'众生之门的世界忽然出现一片无法渲染的灰白空洞——规则失序者奎恩东特从空洞中走出。它不受游戏规则约束，所过之处副本崩塌、任务失效。它瞥了你一眼，声音像坏掉的音轨："这个世界……不该只有一套规则。"远处，似乎还有更庞大的阴影在窥视。',
		choices: {
			left: {text: '直面失序', effects: {cultivation: 18, daoHeart: 8}},
			right: {text: '退回现实', effects: {fortune: 10, maxHealth: 7}},
		},
	},
	// —— 馆主彩蛋 · 三足乌「虹（佳霖）」专属事件（content/oc-rainbow.js）——
	...ocEvents,
]

// —— 关系重逢（动态事件）——
// 数据来源：content/relations-data.js（提取自 worldview_luoxiaohei_v4.db 的 character_relations）
// 将 271 条角色关系动态改编为爬塔事件：师门 / 羁绊 / 恩怨 / 关联四类，
// 与手工事件池共用同一套效果字段（cultivation/daoHeart/fortune/health/maxHealth/addCard/treasure/bond）。
// 设计原则：恩怨类高风险高回报（恨意亦是灵），师门类偏传承悟道，羁绊/关联类偏日常增益。

// 关系类型 → 出现境界（0-1 凡尘/筑基偏日常，2-3 金丹/元婴偏传承，4+ 化神偏冲突）
const relationRealmForType = {
	羁绊: 0,
	关联: 1,
	师门: 2,
	恩怨: 4,
}

const relationEventId = (relation) => `e_rel_${relations.indexOf(relation)}`

// 根据一条关系数据动态构造事件（左右双选项，效果量级对齐手工事件池）
export function buildRelationEvent(relation) {
	const {a, b, type, desc} = relation
	const realm = relationRealmForType[type] ?? 1
	const base = {
		id: relationEventId(relation),
		realm,
		dynamic: true,
		// 动态关系事件立绘兜底：从关系双方中查找可用角色图
		relationNames: [a, b],
	}
	if (type === '师门') {
		return {
			...base,
			title: `师门旧事：${a}与${b}`,
			description: `你在一处废弃的修行地偶遇一段旧日回响——${a}与${b}的师门过往如烟似雾地在灵质空间里重现。${desc}。你驻足良久，那缕传承之意缓缓没入你的灵质空间。`,
			choices: {
				left: {text: '承接传承', effects: {cultivation: 12, daoHeart: 4}},
				right: {text: '遥拜而退', effects: {daoHeart: 6, fortune: 3}},
			},
		}
	}
	if (type === '羁绊') {
		return {
			...base,
			title: `旧友重逢：${a}与${b}`,
			description: `前路的烟火气里传来一阵笑闹——${a}与${b}正并肩而行。${desc}。看见你，他们停下来，像老友一样招呼你一起歇脚。`,
			choices: {
				left: {text: '应邀同行', effects: {fortune: 6, daoHeart: 3}},
				right: {text: '赠礼告别', effects: {maxHealth: 4, fortune: 2}},
			},
		}
	}
	if (type === '恩怨') {
		return {
			...base,
			title: `宿怨回响：${a}与${b}`,
			description: `灵质空间骤然变得沉重——${a}与${b}的恩怨在你眼前如走马灯般掠过。${desc}。那股恨意与执念是真实的灵，化作两股气流缠绕在你周身，等你抉择。`,
			choices: {
				left: {text: '借恨铸锋', effects: {cultivation: 16, daoHeart: -3}},
				right: {text: '守住本心', effects: {daoHeart: 8, fortune: 3, health: -3}},
			},
		}
	}
	// 关联
	return {
		...base,
		title: `因缘一瞥：${a}与${b}`,
		description: `一桩与${a}、${b}有关的旧事在风中传来。${desc}。你虽未亲历，却从这缕因缘中嗅到了命运交错的气息。`,
		choices: {
			left: {text: '顺缘而行', effects: {fortune: 5, daoHeart: 3}},
			right: {text: '修心养气', effects: {maxHealth: 3, cultivation: 8}},
		},
	}
}

// 按境界从关系网中抽一条未触发过的关系，动态生成事件；全部触发过则退回随机一条
export function relationEventForRealm(realmIndex, usedEventIds = []) {
	const typePool = relations.filter((r) => relationRealmForType[r.type] <= realmIndex)
	if (typePool.length === 0) return null
	const fresh = typePool.filter((r) => !usedEventIds.includes(relationEventId(r)))
	const source = fresh.length > 0 ? fresh : typePool
	const relation = source[Math.floor(Math.random() * source.length)]
	return buildRelationEvent(relation)
}

// 从指定境界的世界观事件池中随机挑一个未触发过的事件；
// 手工事件池取尽或触发「关系重逢」时（30% 概率），改用 relations-data.js 动态生成关系事件
// —— 角色回忆（动态事件）——
// 数据来源：content/character-events.js（提取自 worldview_luoxiaohei_v4.db 的 character_events 表，74 条）
// 将 16 位核心角色的生平大事记改编为爬塔「回忆」事件：在灵质空间的罅隙间撞见角色旧日回响。
// 与关系事件同为 dynamic 事件，立绘通过 relationNames 查找 character-images.js；有立绘的角色优先，
// 无立绘角色（极光/白虎）不参与抽取，保证回忆事件都有画面。
// 奖励按境界分档（0-1 凡尘/筑基偏日常，2-3 金丹/元婴偏传承，4 化神偏重），量级对齐手工事件池。

const memoryRewardForRealm = (realmIndex) => {
	if (realmIndex >= 4) return {left: {cultivation: 18, daoHeart: 8}, right: {fortune: 10, maxHealth: 7}}
	if (realmIndex >= 2) return {left: {cultivation: 14, daoHeart: 6}, right: {fortune: 8, maxHealth: 5}}
	return {left: {cultivation: 10, daoHeart: 4}, right: {fortune: 6, maxHealth: 3}}
}

const memoryEventId = (name, eventText) => `e_mem_${name}_${eventText}`

/** 根据一位角色的一条生平大事，动态构造「角色回忆」事件（含该角色立绘） */
export function buildCharacterMemoryEvent(name, eventText, realmIndex) {
	const reward = memoryRewardForRealm(realmIndex)
	return {
		id: memoryEventId(name, eventText),
		realm: Math.min(realmIndex, 4),
		dynamic: true,
		relationNames: [name],
		title: `回忆·${name}`,
		description:
			`灵质空间的罅隙间忽然浮起一段旧日回响——那是${name}的生平一瞬：${eventText}。` +
			'往事如烟，却在你心头留下灼痕。你驻足良久，那缕记忆的余温缓缓没入你的灵识。',
		choices: {
			left: {text: '静观其变', effects: reward.left},
			right: {text: '赠一线善缘', effects: reward.right},
		},
	}
}

/** 按境界从核心角色中随机抽一位（仅限有立绘者），从其生平中随机抽一条事件；全部触发过则退回随机一条 */
export function pickCharacterMemoryEvent(realmIndex, usedEventIds = []) {
	const withPortrait = characterEvents.filter((c) => characterImages[c.name])
	if (withPortrait.length === 0) return null
	const fresh = withPortrait.filter((c) => c.events.some((e) => !usedEventIds.includes(memoryEventId(c.name, e))))
	const source = fresh.length > 0 ? fresh : withPortrait
	const character = source[Math.floor(Math.random() * source.length)]
	const eventText = character.events[Math.floor(Math.random() * character.events.length)]
	return buildCharacterMemoryEvent(character.name, eventText, realmIndex)
}

// 从指定境界的世界观事件池中随机挑一个未触发过的事件；
// 先以 20% 概率触发「角色回忆」（character-events.js），再走手工池 /
// 关系重逢（30% 概率，relations-data.js）双轨；手工池取尽同样退回动态关系事件。
export function pickWorldviewEventForRealm(realmIndex, usedEventIds = []) {
	if (Math.random() < 0.2) {
		const memory = pickCharacterMemoryEvent(realmIndex, usedEventIds)
		if (memory) return memory
	}
	const pool = worldviewEventPool.filter((e) => e.realm === realmIndex && !usedEventIds.includes(e.id))
	if (pool.length === 0) return relationEventForRealm(realmIndex, usedEventIds)
	if (Math.random() < 0.3) {
		const dynamic = relationEventForRealm(realmIndex, usedEventIds)
		if (dynamic) return dynamic
	}
	return pool[Math.floor(Math.random() * pool.length)]
}


// 分馆支援事件：出身妖灵会馆分馆者，局内事件房有概率触发本馆支援
// （七大分馆各一，见 content/guild-branches.js guildSupportEvents）。
// 同一局内同一分馆支援事件只触发一次（usedEventIds 过滤，与世界观事件同机制）。
export function pickGuildSupportEvent(guildId, usedEventIds = []) {
	if (!guildId) return null
	const event = guildSupportEvents.find((e) => e.guildId === guildId && !usedEventIds.includes(e.id))
	return event || null
}

// —— 角色立绘映射（供 ui/app.js 事件房渲染使用）——
// portrait 字段是角色名；eventPortrait 返回 assets/characters/ 下的图片相对 URL（无图返回 null）。
// 动态关系事件（buildRelationEvent）没有 portrait 字段，改为在关系双方（relationNames）中找第一张可用立绘。
export function eventPortrait(event) {
	if (!event) return null
	if (event.portrait) return characterImages[event.portrait] || null
	if (event.dynamic && event.relationNames) {
		for (const name of event.relationNames) {
			const url = characterImages[name]
			if (url) return url
		}
	}
	return null
}
