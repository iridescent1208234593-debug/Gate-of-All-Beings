// 罗小黑战记·重生之门 —— 「灵质修行」· 灵质空间节点数据
// 设定来源：assets\罗小黑战记数据库\worldview_luoxiaohei_v4.db
//   （灵质空间：每个生命体固有的物质空间，用于储存灵，与生命直接相关。
//     高阶妖精可开辟独立空间，内部规则由开辟者制定，是战斗与庇护的核心场所。
//     空间系能力附着于灵质空间，无法后天习得，一个灵质空间只能附带一个。）
// 文案与结构对齐 content/spirit-spaces.js（主爬塔灵质空间池）与 content/oc-rainbow.js（馆主彩蛋·虹之间），
//   效果字段对齐「灵质修行」独立战斗体系（content/lingzhi-events.js / game/lingzhi-engine.js）：
//   heal     回复 X 点生命
//   maxHp    提升 X 点最大生命（并回复等量）
//   loseHp   失去 X 点生命（最低保留 1 点）
//   shards   获得 X 修行残片（UI 层结算进修行进度）
//   addCard  获得指定灵术卡（cardId 须存在于 content/lingzhi-xiuxing.js 的 lingzhiCards）
//   relic    获得指定遗物（id 须存在于 content/lingzhi-xiuxing.js 的 lingzhiRelics）
//   removeCard 随机移除卡组 1 张卡（净化杂念）
// 玩法定位：灵质修行地图中段楼层会出现「境」节点（S），御灵师闯入他人灵质空间，
//   在空间内做出三选一抉择，获得生命 / 最大生命 / 修行残片 / 灵术卡 / 遗物等收益。

export const lingzhiSpaces = [
	// ---------- 炼气 · 灵质初醒（自身空间觉醒，灵溪/罗家岙附近） ----------
	{
		id: 'lz-ss_awaken',
		realm: 0,
		name: '领域·初绽',
		owner: '你自身',
		theme: '空间系·领域',
		desc: '你的灵质空间在沉睡多年后第一次完全展开——空间内部灰蒙蒙的，生灵如萤火般漂浮。传说高阶妖精可在此开辟独立领域，而你的空间，正传来微弱的、属于「重生之门」的回响。',
		options: [
			{label: '静心凝灵', desc: '回复 8 点生命', effect: {type: 'heal', amount: 8}},
			{label: '感应空间', desc: '获得卡牌「折跃」', effect: {type: 'addCard', card: 'zheyue'}},
			{label: '扩张边界', desc: '提升 6 点最大生命，失去 5 点生命', effect: {type: 'maxHp', amount: 6, lose: 5}},
		],
	},
	{
		id: 'lz-ss_ling_gather',
		realm: 0,
		name: '聚灵之地',
		owner: '妖精会·灵溪分馆（无名妖灵）',
		theme: '灵质循环·聚灵',
		desc: '一片生灵如萤火般明灭的原野——传说生灵汇聚可成精灵，精灵与物质灵交织方化为妖精。此地游离灵气充沛，正是御灵师借天时聚灵、孕育化形的好去处。风中隐约传来妖精会的低语：「聚灵，是万物成形的开端。」',
		options: [
			{label: '静坐聚灵', desc: '获得 10 修行残片', effect: {type: 'shards', amount: 10}},
			{label: '凝炼物质灵', desc: '回复 10 点生命', effect: {type: 'heal', amount: 10}},
			{label: '感知灵脉', desc: '获得卡牌「灵脉」', effect: {type: 'addCard', card: 'lingmai'}},
		],
	},
	{
		id: 'lz-ss_lixi_grove',
		realm: 0,
		name: '灵植温床',
		owner: '卡里（灵溪会馆馆长）',
		theme: '御灵系·木',
		desc: '灵溪会馆后院有一片卡里用木系御灵催生的小树林。他笑眯眯地站在树苗前：「进来坐坐？我这空间养树最好——木系妖精的灵质空间，生灵最旺。」树根下隐约埋着旧物。',
		options: [
			{label: '帮忙催生', desc: '回复 12 点生命', effect: {type: 'heal', amount: 12}},
			{label: '掘出旧物', desc: '获得遗物「灵潮」', effect: {type: 'relic', relic: 'lingchao'}},
			{label: '取一根灵枝', desc: '获得卡牌「藤缚」', effect: {type: 'addCard', card: 'tengfu'}},
		],
	},
	{
		id: 'lz-ss_game_gate',
		realm: 0,
		name: '众生之门·游戏空间',
		owner: '山新（灵溪·四小只）',
		theme: '虚拟空间·游戏世界',
		desc: '山新拉着你钻进《众生之门》——号称"真实到不可思议"的御灵游戏。灵质空间在这里以玩家身份出现：有数值面板、技能树、复活点，也有满地乱跑的小妖。山新拍拍胸脯：「别怕，死了还能复活——不过痛感可是真的哦！」',
		options: [
			{label: '组队刷怪', desc: '获得 12 修行残片，失去 4 点生命', effect: {type: 'shards', amount: 12, lose: 4}},
			{label: '领取新手礼包', desc: '获得遗物「灵镜」', effect: {type: 'relic', relic: 'lingjing'}},
			{label: '挑战隐藏Boss', desc: '获得卡牌「焰击」，失去 8 点生命', effect: {type: 'addCard', card: 'yanji', lose: 8}},
		],
	},
	// ---------- 炼气 · 罗家岙故里（设定源自 worldview 库 locations/characters 表） ----------
	{
		id: 'lz-ss_luojiashan_home',
		realm: 0,
		name: '罗家岙·故里灵境',
		owner: '罗云飞一家（罗小白/阿根）',
		theme: '御灵系·冰火 · 怪力 · 乡居',
		desc: '罗小白的老家罗家岙，爷爷罗云飞与堂哥阿根生活的地方。田埂间炊烟袅袅，爷爷的厨房永远飘着饭香；阿根的灵质空间据说是足球场大的极寒地狱，却能稳稳控住一团火焰。比丢在墙根啃出一排洞，小黑蹲在屋檐上打盹。这里的灵质空间没有大妖的领域规则，只有最平凡的、被守护着的家。',
		options: [
			{label: '帮爷爷收稻子', desc: '回复 10 点生命', effect: {type: 'heal', amount: 10}},
			{label: '观摩阿根控火', desc: '获得卡牌「冰心」', effect: {type: 'addCard', card: 'bingxin'}},
			{label: '投喂团鼠比丢', desc: '获得 12 修行残片，失去 4 点生命', effect: {type: 'shards', amount: 12, lose: 4}},
		],
	},
	// ---------- 筑基 · 领域残迹（龙游/风息公园） ----------
	{
		id: 'lz-ss_longyou_remnant',
		realm: 1,
		name: '龙游·领域残迹',
		owner: '风息（散灵后的遗留）',
		theme: '御灵系·木 · 领域残留',
		desc: '风息在龙游展开领域失败后，生灵散尽却未完全消散，化为一片茂密林木留在城中。树冠间仍残留着领域规则的痕迹——你若踏入，会被这片土地短暂接纳。',
		options: [
			{label: '感悟领域余韵', desc: '获得 14 修行残片', effect: {type: 'shards', amount: 14}},
			{label: '摘取灵果', desc: '提升 4 点最大生命，回复 8 点生命', effect: {type: 'maxHp', amount: 4, heal: 8}},
			{label: '顺着树根探秘', desc: '获得卡牌「藤击」，失去 5 点生命', effect: {type: 'addCard', card: 'tengji', lose: 5}},
		],
	},
	{
		id: 'lz-ss_park_spirit',
		realm: 1,
		name: '风息公园·新生灵域',
		owner: '散灵生灵',
		theme: '生灵汇聚',
		desc: '龙游市内，风息散灵后建立的风息公园。无数生灵在林木间流转、聚散，形成一个极罕见的「自发灵质场」——没有开辟者，却自成规则。此地的生灵格外温和。',
		options: [
			{label: '与生灵共鸣', desc: '获得 12 修行残片，回复 6 点生命', effect: {type: 'shards', amount: 12, heal: 6}},
			{label: '引灵入体', desc: '提升 6 点最大生命', effect: {type: 'maxHp', amount: 6}},
			{label: '捕捉游离灵偶', desc: '获得卡牌「灵群」', effect: {type: 'addCard', card: 'lingqun'}},
		],
	},
	{
		id: 'lz-ss_bookshop_dream',
		realm: 1,
		name: '龙游·画中书境',
		owner: '画虎',
		theme: '造物系·画灵 · 书境',
		desc: '龙游街角的书店由松鼠妖精画虎经营。他打了个响指，你脚下的地板化作墨迹，四周书架坍缩成一张宣纸——「欢迎来到我的画里。这里的规则很简单：能画出什么，就有什么。」',
		options: [
			{label: '观摩画技', desc: '获得 12 修行残片', effect: {type: 'shards', amount: 12}},
			{label: '取走店中藏书', desc: '获得遗物「绘具袋」', effect: {type: 'relic', relic: 'huijudai'}},
			{label: '习得画灵之术', desc: '获得卡牌「画灵」', effect: {type: 'addCard', card: 'hualing'}},
		],
	},
	// ---------- 金丹 · 他人领地（离岛/北域） ----------
	{
		id: 'lz-ss_lidao_base',
		realm: 2,
		name: '离岛·据点空间',
		owner: '风息一伙',
		theme: '空间系·传送门 · 木',
		desc: '离岛是风息一伙的据点，通过桥梁下的传送门可达。岛上的灵质空间由同伴共同维护：洛竹的藤蔓盘绕墙壁，虚淮留下传送印记，天虎在角落蜷成一团。这里对陌生来客并不友善。',
		options: [
			{label: '以礼叩门', desc: '获得 10 修行残片，回复 5 点生命', effect: {type: 'shards', amount: 10, heal: 5}},
			{label: '探查传送印记', desc: '获得卡牌「折跃」，失去 3 点生命', effect: {type: 'addCard', card: 'zheyue', lose: 3}},
			{label: '与守岛者切磋', desc: '获得 14 修行残片，失去 8 点生命', effect: {type: 'shards', amount: 14, lose: 8}},
		],
	},
	{
		id: 'lz-ss_beiyu_cage',
		realm: 2,
		name: '北域·囚笼',
		owner: '那伽',
		theme: '生灵系·植灵转移',
		desc: '那伽的领地北域，一片寒冷而压抑的空间。这里曾囚禁清凝三百年——治愈系灵力被抽离的痕迹至今仍在灵质空间壁上刻成纹路。深处有那伽的「灵主」在巡逻。',
		options: [
			{label: '破除旧禁制', desc: '获得 14 修行残片', effect: {type: 'shards', amount: 14}},
			{label: '搜刮囚室遗物', desc: '获得遗物「灵镜」', effect: {type: 'relic', relic: 'lingjing'}},
			{label: '速战速决离开', desc: '获得 10 修行残片，失去 8 点生命', effect: {type: 'shards', amount: 10, lose: 8}},
		],
	},
	{
		id: 'lz-ss_mulun_lingfeng',
		realm: 2,
		name: '灵风山·巨灵阵',
		owner: '木落仙人（灵风山）',
		theme: '空间系·巨灵阵 · 变小',
		desc: '灵风山深处，树精灵七果与花精灵粉末守着一段扭曲的空间。木落仙人留下的巨灵阵仍在运转：踏入阵中万物都会缩小，连你的灵质空间也被压成掌心大小。粉末骑着虎妞远远喊：「小心别踩到树苗！」',
		options: [
			{label: '参悟阵纹', desc: '获得 14 修行残片', effect: {type: 'shards', amount: 14}},
			{label: '搜罗迷你遗物', desc: '获得遗物「界锚」', effect: {type: 'relic', relic: 'jiemao'}},
			{label: '硬闯阵心', desc: '获得卡牌「虚界」，失去 6 点生命', effect: {type: 'addCard', card: 'xujie', lose: 6}},
		],
	},
	// ---------- 元婴 · 老君空间（老君阁/蓝溪镇） ----------
	{
		id: 'lz-ss_laojunge',
		realm: 3,
		name: '老君阁',
		owner: '老君',
		theme: '空间系·独立空间 · 锁御',
		desc: '老君闭关的灵质空间，内有锁御宫、斗帅宫等殿宇。空间规则由老君亲自制定：外来者不可飞行、不可喧哗、不可妄动法宝。传说天明珠曾存放于此，引来府先生一伙觊觎。',
		options: [
			{label: '拜谒锁御宫', desc: '获得 16 修行残片', effect: {type: 'shards', amount: 16}},
			{label: '寻访旧藏', desc: '获得遗物「坝心片」', effect: {type: 'relic', relic: 'baxinpian'}},
			{label: '偷学空间规则', desc: '获得卡牌「虚界」，失去 8 点生命', effect: {type: 'addCard', card: 'xujie', lose: 8}},
		],
	},
	{
		id: 'lz-ss_lanxizhen',
		realm: 3,
		name: '蓝溪镇·遗墟',
		owner: '老君（曾庇护）',
		theme: '空间系·迁镇 · 治愈',
		desc: '曾受老君庇护的人类城镇，迁入他的灵质空间后一度繁华：三和堂医馆的灯火、清凝问诊的身影、谛听镇守的街巷。迁镇后这里便废弃了，唯余空间残影与淡淡的治愈灵力。',
		options: [
			{label: '凭吊废墟', desc: '获得 14 修行残片', effect: {type: 'shards', amount: 14}},
			{label: '收集残存灵药', desc: '获得卡牌「繁生」', effect: {type: 'addCard', card: 'fansheng'}},
			{label: '修复一处结界', desc: '提升 8 点最大生命', effect: {type: 'maxHp', amount: 8}},
		],
	},
	{
		id: 'lz-ss_xuanli_shenshan',
		realm: 3,
		name: '深山·炎域',
		owner: '玄离（山神）',
		theme: '御灵系·冰火双空间',
		desc: '深山腹地，犬形妖精玄离静静蹲坐在雪线上。他的灵质空间一半冰封、一半燃烧——冰火双系在他体内共存数百年，如今化作「山神」的领域。炎域圣火在他掌心跳跃：「想取暖，还是想冷静？」',
		options: [
			{label: '参悟冰火', desc: '获得 16 修行残片', effect: {type: 'shards', amount: 16}},
			{label: '拾取炎域余烬', desc: '获得遗物「战旗」', effect: {type: 'relic', relic: 'zhanqi'}},
			{label: '感受炎域圣火', desc: '获得卡牌「冰心」，失去 8 点生命', effect: {type: 'addCard', card: 'bingxin', lose: 8}},
		],
	},
	{
		id: 'lz-ss_yifan_moon',
		realm: 3,
		name: '月宫·星途',
		owner: '一凡仙人',
		theme: '空间系·瞬身 · 星际',
		desc: '老君阁深处悬着一幅《奔月图》，画中残留着一凡仙人瞬身远行的空间印记。你触碰印记，顷刻间被抛上星空——脚下是月面，远处是地球，更远处是这位仙人追寻了数百年的「宇宙尽头」。',
		options: [
			{label: '凝望星辰', desc: '获得 15 修行残片', effect: {type: 'shards', amount: 15}},
			{label: '拾取月岩法宝', desc: '获得遗物「灵契」', effect: {type: 'relic', relic: 'lingqi'}},
			{label: '追逐星轨', desc: '获得卡牌「折跃」，失去 6 点生命', effect: {type: 'addCard', card: 'zheyue', lose: 6}},
		],
	},

	// ---------- 元婴 · 老君灵质空间建筑群（斗帅宫/锁御宫/星夜湖/清凝宫，设定源自世界观库 locations 表） ----------
	{
		id: 'lz-ss_doushuai_gong',
		realm: 3,
		name: '老君·斗帅宫',
		owner: '老君（灵质空间内对战之所）',
		theme: '御灵系·金 · 斗法场',
		desc: '老君灵质空间深处的一座开阔宫殿——斗帅宫，是开放给妖精对战之处。宫门大开，内里灵光纵横，天明珠任务曾在此留下痕迹。墙上的兵器架陈列着历代挑战者的兵器，灵台上却空无一物。',
		options: [
			{label: '挑战守宫灵将', desc: '获得 16 修行残片，失去 6 点生命', effect: {type: 'shards', amount: 16, lose: 6}},
			{label: '观摩灵将对决', desc: '获得卡牌「连击」', effect: {type: 'addCard', card: 'lianji'}},
			{label: '参悟斗法之理', desc: '获得遗物「灵契」', effect: {type: 'relic', relic: 'lingqi'}},
		],
	},
	{
		id: 'lz-ss_suoyu_gong',
		realm: 3,
		name: '老君·锁御宫',
		owner: '老君（灵质空间内封印/藏宝之地）',
		theme: '空间系·封印 · 藏宝',
		desc: '锁御宫设有复杂封印，是老君灵质空间内存放珍宝与封印重物之处。宫门上流转着细密的灵纹，封印之力层层叠叠，仿佛在低语着不可轻犯的警告。',
		options: [
			{label: '尝试解开一道封印', desc: '获得遗物「心棱镜」，失去 8 点生命', effect: {type: 'relic', relic: 'xinlengjing', lose: 8}},
			{label: '参悟封印灵纹', desc: '获得卡牌「盾涌」', effect: {type: 'addCard', card: 'dunyong'}},
			{label: '借封印之力稳固自身', desc: '提升 7 点最大生命', effect: {type: 'maxHp', amount: 7}},
		],
	},
	{
		id: 'lz-ss_xingye_lake',
		realm: 3,
		name: '老君·星夜湖',
		owner: '老君（灵质空间内湖泊）',
		theme: '水系御灵·倒映 · 星辉',
		desc: '老君灵质空间内的星夜湖，湖面如镜，倒映着不属于凡世的星空。蓝溪镇曾与它位于同一平面，后来空间折叠，这片湖泊便独自静卧在灵质空间背面，湖底沉着旧日灯火。',
		options: [
			{label: '掬饮湖心灵水', desc: '回复 14 点生命', effect: {type: 'heal', amount: 14}},
			{label: '打捞湖底旧物', desc: '获得遗物「坝心片」', effect: {type: 'relic', relic: 'baxinpian'}},
			{label: '泛舟追逐星轨', desc: '获得卡牌「潮涌」，失去 4 点生命', effect: {type: 'addCard', card: 'chaoyong', lose: 4}},
		],
	},
	{
		id: 'lz-ss_qingning_gong',
		realm: 3,
		name: '老君·清凝宫',
		owner: '老君（灵质空间内宫殿，与李清凝相关）',
		theme: '木系御灵·医心 · 药香',
		desc: '清凝宫是老君灵质空间内的一座宫殿，与医者李清凝渊源深厚。宫内药香袅袅，架上晾着干枯的灵草，案头还压着半卷未抄完的药方，仿佛主人只是暂离片刻。',
		options: [
			{label: '帮忙晾晒灵药', desc: '回复 12 点生命', effect: {type: 'heal', amount: 12}},
			{label: '抄录一页药方', desc: '获得卡牌「铁羽」', effect: {type: 'addCard', card: 'tieyu'}},
			{label: '借药浴温养', desc: '提升 5 点最大生命，回复 8 点生命', effect: {type: 'maxHp', amount: 5, heal: 8}},
		],
	},
	// ---------- 元婴 · 老君·聚灵宫（设定源自 worldview 库 locations 表 id=33） ----------
	{
		id: 'lz-ss_juling_gong',
		realm: 3,
		name: '老君·聚灵宫',
		owner: '老君（灵质空间内宫殿）',
		theme: '空间系·聚灵 · 万灵回响',
		desc: '聚灵宫是老君灵质空间内的一座宫殿，与锁御、斗帅诸宫同列。殿内无甚陈设，唯有一方聚灵大阵终年运转：游离的生灵被缓缓牵引、沉淀，化作最纯净的灵力。据说老君闭关时，常在此静坐，聆听万灵汇聚的回响。你踏入殿门，仿佛听见整座空间的心跳。',
		options: [
			{label: '静坐参悟聚灵阵', desc: '获得 16 修行残片', effect: {type: 'shards', amount: 16}},
			{label: '引一道灵脉入体', desc: '获得卡牌「灵脉」', effect: {type: 'addCard', card: 'lingmai'}},
			{label: '借阵心温养灵质', desc: '提升 6 点最大生命，回复 8 点生命', effect: {type: 'maxHp', amount: 6, heal: 8}},
		],
	},
	// ---------- 化神 · 会馆与重生（苍南/重生之门） ----------
	{
		id: 'lz-ss_cangnan',
		realm: 4,
		name: '苍南会馆',
		owner: '妖灵会馆（上古无主灵质空间）',
		theme: '空间系·无主空间 · 秩序',
		desc: '由上古无主灵质空间改造而成的妖灵会馆总馆。无数执行者的灵质印记在此叠加：鹿野的追毫、鸠老的洞察、兆岳的凌荆。这里是妖精世界的秩序中枢，也是你踏入重生之门前最后的补给地。',
		options: [
			{label: '聆听会馆训诫', desc: '获得 16 修行残片', effect: {type: 'shards', amount: 16}},
			{label: '请求执行者赐宝', desc: '获得遗物「界锚」', effect: {type: 'relic', relic: 'jiemao'}},
			{label: '观摩御灵图谱', desc: '获得卡牌「灵誓」', effect: {type: 'addCard', card: 'lingshi'}},
		],
	},
	{
		id: 'lz-ss_mingwang_fengdu',
		realm: 4,
		name: '酆都·索灵地界',
		owner: '明王',
		theme: '治愈系·索灵 · 地界',
		desc: '妖灵会馆创始人明王的灵质空间——酆都。地界索灵之所：无数魂灵在此等待重生，是「重生之门」在人间的倒影。明王端坐于幽都深处，语气平静：「走错路的魂灵，会被我收走。你，也要进来吗？」',
		options: [
			{label: '聆听轮回之理', desc: '获得 18 修行残片', effect: {type: 'shards', amount: 18}},
			{label: '求得魂灵碎片', desc: '获得遗物「心棱镜」', effect: {type: 'relic', relic: 'xinlengjing'}},
			{label: '感悟索灵之力', desc: '获得卡牌「读心」，失去 8 点生命', effect: {type: 'addCard', card: 'duxin', lose: 8}},
		],
	},
	{
		id: 'lz-ss_rebirth_gate',
		realm: 4,
		name: '重生之门·灵质边界',
		owner: '？',
		theme: '空间系·轮回边界',
		desc: '传说中聚灵与散灵的边界。这里的灵质空间规则彻底紊乱：生灵与物质灵互相渗透，空间壁如薄纸般颤动。门的另一侧，隐约可见无数前世魂灵的回响——它们正在等待重生。',
		options: [
			{label: '凝望轮回', desc: '获得 20 修行残片', effect: {type: 'shards', amount: 20}},
			{label: '吸纳散灵余烬', desc: '提升 10 点最大生命，回复 8 点生命', effect: {type: 'maxHp', amount: 10, heal: 8}},
			{label: '触摸门扉', desc: '获得卡牌「虚界」，失去 8 点生命', effect: {type: 'addCard', card: 'xujie', lose: 8}},
		],
	},
	// ---------- 馆主彩蛋 · 三足乌「虹（佳霖）」灵质空间（设定源自 oc.iridescently.xyz） ----------
	{
		id: 'lz-ss_hongzhijian',
		realm: 2,
		name: '虹之间',
		owner: '虹（佳霖）· 三足乌',
		theme: '空间系· 安魂收藏',
		desc: '你误入一处藏在虹光里的灵质空间——无数发光石悬浮其间，每块都收容着一段残魂记忆。主人是三足乌后裔「虹」，正细心擦拭一块刻着太阳鸟纹的河姆渡骨器残片。他抬头看你，瑠璃色的眼睛里闪过高天流云：「迷路了吗？坐坐吧，我这儿……收留了很多回不去的魂。」',
		options: [
			{label: '帮忙安放残魂', desc: '获得 12 修行残片', effect: {type: 'shards', amount: 12}},
			{label: '泡一泡恒温温泉', desc: '提升 4 点最大生命，回复 10 点生命', effect: {type: 'maxHp', amount: 4, heal: 10}},
			{label: '请他拨亮一缕光丝', desc: '获得卡牌「心潮」', effect: {type: 'addCard', card: 'xinchao'}},
		],
	},
	// ---------- 筑基 · 松山青云洞 / 兰溪新镇（设定源自 worldview 库 locations/characters 表） ----------
	{
		id: 'lz-ss_qingyun_dong',
		realm: 1,
		name: '松山·青云洞',
		owner: '鸠老（松山青云洞原洞主）',
		theme: '生灵系·洞察 · 造物系·仿生',
		desc: '松山深处的青云洞，曾是执行者鸠老修炼之所。洞壁刻满生灵系·洞察的灵纹——据说他一眼便能看穿能力属性与弱点；石台上陈列着以灵力仿制的逼真造物，真假难辨，仿佛每一件都在呼吸。',
		options: [
			{label: '参悟洞察灵纹', desc: '获得 12 修行残片', effect: {type: 'shards', amount: 12}},
			{label: '取走一件仿生造物', desc: '获得卡牌「绘涌」', effect: {type: 'addCard', card: 'huiyong'}},
			{label: '唤出洞主残影试炼', desc: '获得 16 修行残片，失去 8 点生命', effect: {type: 'shards', amount: 16, lose: 8}},
		],
	},
	{
		id: 'lz-ss_lanxi_xinju',
		realm: 1,
		name: '兰溪·新镇灵境',
		owner: '兰溪镇民（蓝溪镇迁出后的新城镇）',
		theme: '空间系·迁镇 · 新生',
		desc: '蓝溪镇迁出后的新城镇兰溪，是无限向兴帝讨要苍山之南、横阳之北的土地上建起的家园，无限十二年完成搬迁。新镇的灵质空间由无数镇民的灵共同维系——没有大妖的领域规则，却有最朴素的生机。每一块砖瓦，都记得从蓝溪镇带来的记忆。',
		options: [
			{label: '帮镇民修葺灵宅', desc: '获得 6 修行残片，回复 8 点生命', effect: {type: 'shards', amount: 6, heal: 8}},
			{label: '参加迁镇庆典', desc: '提升 4 点最大生命，回复 6 点生命', effect: {type: 'maxHp', amount: 4, heal: 6}},
			{label: '寻访旧镇遗物', desc: '获得 12 修行残片', effect: {type: 'shards', amount: 12}},
		],
	},
	// ---------- 金丹 · 流石会馆残甲（设定源自 worldview 库 locations/characters 表） ----------
	{
		id: 'lz-ss_liushi_kongting',
		realm: 2,
		name: '流石会馆·残甲空庭',
		owner: '大松（流石会馆馆长）',
		theme: '锁御系·流石甲 · 战殇',
		desc: '流石会馆的灵质空间，静默如碑。锁御系大师、馆长大松独创的法器流石甲曾在此护住整座会馆；大殿前广场的焦痕犹在，那场变故之后，会馆的妖精再未归来。一具残甲立在庭心，像沉默的守望者。',
		options: [
			{label: '于残甲前静立', desc: '获得 14 修行残片', effect: {type: 'shards', amount: 14}},
			{label: '拾取流石甲片', desc: '提升 6 点最大生命', effect: {type: 'maxHp', amount: 6}},
			{label: '复现守馆之战', desc: '获得 18 修行残片，失去 10 点生命', effect: {type: 'shards', amount: 18, lose: 10}},
		],
	},
	// ---------- 元婴 · 老君君阁（设定源自 worldview 库 locations 表） ----------
	{
		id: 'lz-ss_junge_bigu',
		realm: 3,
		name: '君阁·百年闭关',
		owner: '老君（君阁闭关居所）',
		theme: '空间系·禁闭 · 灵誓',
		desc: '老君山巅的君阁，是老君立誓百年不出之所。阁门紧闭，门楣上灵誓的光纹若隐若现；阁内无甚陈设，只有满墙手抄的《西游记》批注与整架灵药。传说在此静坐一炷香，可暂忘世间纷扰。',
		options: [
			{label: '于阁前静坐参悟', desc: '获得 16 修行残片', effect: {type: 'shards', amount: 16}},
			{label: '借灵药温养灵脉', desc: '回复 14 点生命', effect: {type: 'heal', amount: 14}},
			{label: '斩断心头执念', desc: '随机移除 1 张卡（净化杂念）', effect: {type: 'removeCard'}},
		],
	},
	// ---------- 化神 · 寒木会馆信息中枢（设定源自 worldview 库 locations 表） ----------
	{
		id: 'lz-ss_hanmu_hub',
		realm: 4,
		name: '寒木会馆·信息中枢',
		owner: '寒木会馆（妖灵会馆全球网络关联枢纽）',
		theme: '心灵系·传音 · 信息网',
		desc: '寒木会馆是妖灵会馆全球网络的关联枢纽——无数传音在此汇聚、分流、抵达。灵质空间内漂浮着细密的灵纹网络，每一缕都连着遥远某处的一封讯息。袭击过后，中枢仍以最后的余力守护着整个网络的记忆，仿佛整个世界的心跳都曾在此回响。',
		options: [
			{label: '聆听全网传音', desc: '获得 18 修行残片', effect: {type: 'shards', amount: 18}},
			{label: '撷取一缕远行讯息', desc: '获得卡牌「余烬」', effect: {type: 'addCard', card: 'yujin'}},
			{label: '借枢纽余力稳固自身', desc: '提升 8 点最大生命，回复 8 点生命', effect: {type: 'maxHp', amount: 8, heal: 8}},
		],
	},
]

/** 按境界随机挑选一个灵质空间（同局不重复出现同一空间） */
export function randomLingzhiSpace(realmIndex, excludeIds = []) {
	const pool = lingzhiSpaces.filter(
		(s) => s.realm === realmIndex && !excludeIds.includes(s.id)
	)
	if (pool.length === 0) return null
	return pool[Math.floor(Math.random() * pool.length)]
}
