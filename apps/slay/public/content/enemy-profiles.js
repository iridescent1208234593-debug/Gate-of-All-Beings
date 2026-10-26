import {characterByName} from '/shared/shared-data/catalog.js';
// 罗小黑战记·重生之门 —— 敌人世界观档案
// 来源：assets\罗小黑战记数据库\worldview_luoxiaohei_v4.db
//   characters（角色表） / spirit_lifecycle（灵质与聚灵概念） / locations（地点表）
//   以及游戏原创设定（离岛小妖等杂兵与重生之门终局单位）。
// 作用：将 content/dungeon-encounters.js 中的敌人与世界观设定打通，
//       战斗界面展示敌人的所属势力、物种与背景档案（见 ui/player.js）。

export const enemyProfiles = {
	// —— 离岛组织 · 风息一伙（第 4-5 层 金丹区）——
	离岛小妖: {
		formal: '离岛',
		affiliation: '离岛组织',
		species: '妖精',
		desc: '离岛据点里为风息一伙奔走的底层小妖，惯用藤蔓缠绕阻敌，声势浩大。',
		source: 'worldview.db·locations(离岛)',
	},
	天虎: {
		formal: '天虎',
		affiliation: '风息一伙',
		species: '妖精',
		desc: '风息一伙成员，虎形态妖精，从小跟着风息长大。体型魁梧却话极少，全片台词只有"肉""酒""嗯"。',
		source: 'worldview.db·characters(天虎)',
	},
	洛竹: {
		formal: '洛竹',
		affiliation: '风息一伙',
		species: '妖精',
		desc: '离岛成员，风息一伙。喜欢小黑，阳光可爱的绿发妖精，是电影中的温柔担当。',
		source: 'worldview.db·characters(洛竹)',
	},
	黑咻: {
		formal: '黑咻',
		affiliation: '罗小黑的尾巴分身',
		species: '小黑尾巴分裂出的分身',
		desc: '小黑尾巴分裂出的分身，通体漆黑的小猫，有独立意识，与小黑心意相通，忠诚可爱。',
		source: 'worldview.db·characters(黑咻)',
	},
	黑咻·分裂体: {
		formal: '黑咻',
		affiliation: '罗小黑的尾巴分身',
		species: '小黑尾巴分裂出的分身',
		desc: '黑咻进一步分裂的个体，漆黑小猫群汹涌而来，个体虽弱却数量惊人。',
		source: 'worldview.db·characters(黑咻)',
	},
	虚淮: {
		formal: '虚淮',
		affiliation: '风息一伙',
		species: '纯物质灵构成的妖精',
		desc: '由纯物质灵构成的妖精，离岛成员。冷静果断，实力很强，是风息的得力臂膀。',
		source: 'worldview.db·characters(虚淮)',
	},
	离岛首领·风息: {
		formal: '风息',
		affiliation: '离岛组织 / 龙游',
		species: '妖精（黑豹）',
		desc: '黑豹。离岛首领，为保护家园与人类产生矛盾，对人类仇恨且极端，对同伴却温柔负责，最终散灵化为树木。',
		source: 'worldview.db·characters(风息)',
	},
	风息·豪夺: {
		formal: '风息',
		affiliation: '离岛组织 / 龙游',
		species: '妖精（黑豹）',
		desc: '黑豹，离岛首领。豪夺生机、噬敌养己，是风息守护离岛时展露的凶悍一面。',
		source: 'worldview.db·characters(风息)',
	},

	// —— 灵偶 / 灵质守卫（爬塔守御单位）——
	灵偶·木人: {
		formal: '灵偶/傀儡',
		affiliation: '御灵术造物',
		species: '生灵与物质灵造物',
		desc: '直接用生灵和物质灵造出的类生命木偶，看似活物却没有太多自我意识，常被御灵师驱使守御一方。',
		source: 'worldview.db·spirit_lifecycle(灵偶/傀儡)',
	},
	灵质守卫: {
		formal: '灵质守卫',
		affiliation: '灵质空间',
		species: '灵气凝成的守卫',
		desc: '高阶御灵师以自身灵气凝成的空间守卫，游弋于灵质空间边界，驱逐一切擅闯者。',
		source: 'worldview.db·spirit_lifecycle + 游戏设定',
	},
	恶妖·缠藤: {
		formal: '恶妖',
		affiliation: '散落妖邪',
		species: '失控妖精',
		desc: '失控的恶妖，木灵暴走缠绕周身，凡被缠住的生灵皆被汲取灵气，沦为枯木。',
		source: '游戏原创设定（木系恶妖）',
	},

	// —— 团鼠 / 罗小白与灵溪众人 ——
	团鼠·暴走: {
		formal: '比丢',
		affiliation: '罗小黑',
		species: '团鼠',
		desc: '团鼠，因特殊皮毛被捕杀而濒危。看似呆实则狡猾敏捷，吃下物体会变成那种物体的颜色，只有小黑能制服它。',
		source: 'worldview.db·characters(比丢)',
	},
	罗小白·蓝玉盘: {
		formal: '罗小白',
		affiliation: '灵溪',
		species: '人类',
		desc: '善良活泼的小学生，罗小黑最好的朋友。持有老君赠送的顶级空间法宝蓝玉盘，异于常人的怪力不可小觑。',
		source: 'worldview.db·characters(罗小白)',
	},
	山新·游戏玩家: {
		formal: '山新',
		affiliation: '灵溪·四小只',
		species: '人类',
		desc: '罗小白的好友，在《众生之门》游戏中习得多种能力，被鸠老评价为"什么乱七八糟系"。自称血精灵的游戏高手。',
		source: 'worldview.db·characters(山新)',
	},
	三叔·横扫千军: {
		formal: '三叔',
		affiliation: '罗家岙',
		species: '人类',
		desc: '罗家岙居民，罗小白的三叔。沉默寡言用手语交流，却能扛着大捆木料修屋子，一身怪力。',
		source: 'worldview.db·characters(三叔)',
	},
	大爽·定点转移: {
		formal: '大爽',
		affiliation: '龙游会馆',
		species: '人类',
		desc: '空间系·转移能力者，负责龙游会馆的应急处理，曾利用传送系统疏散全部人类居民。',
		source: 'worldview.db·characters(大爽)',
	},

	// —— 妖灵会馆 · 执行者（化神区）——
	兆岳: {
		formal: '兆岳',
		affiliation: '妖灵会馆执行者',
		species: '妖精',
		desc: '妖灵会馆执行者，白发，身高198cm。加入会馆前被无限揍过，因此不太喜欢人类，尤其不喜欢无限。',
		source: 'worldview.db·characters(兆岳)',
	},
	执行者·白宜: {
		formal: '白宜',
		affiliation: '妖灵会馆·一级执行者',
		species: '妖精',
		desc: '妖灵会馆一级执行者，剑术高手，符纸化作剑刃。剑比人高的小个子妖精，流石会馆事件中对战无限。',
		source: 'worldview.db·characters(白宜)',
	},
	执行者·乙: {
		formal: '乙',
		affiliation: '妖灵会馆一级执行者',
		species: '蝙蝠妖怪',
		desc: '蝙蝠妖怪，池年徒弟，一级执行者。活泼话多，是执行者团队里的气氛调节者。',
		source: 'worldview.db·characters(乙)',
	},
	鹿野·追毫锁定: {
		formal: '鹿野',
		affiliation: '妖灵会馆感知组组长',
		species: '妖精（战争遗孤）',
		desc: '妖灵会馆感知组组长，战争遗孤被无限所救。开发生灵系"追毫"，独立好强，曾与小黑联手击败灵遥。',
		source: 'worldview.db·characters(鹿野)',
	},
	鸠老·造物仿生: {
		formal: '鸠老',
		affiliation: '妖灵会馆',
		species: '妖精',
		desc: '乐天派老妖精执行者，洞府被开发成景点，自己进去还要买门票。擅长以灵力仿生造物。',
		source: 'worldview.db·characters(鸠老)',
	},
	鸠老·仿生兽: {
		formal: '鸠老',
		affiliation: '妖灵会馆',
		species: '仿生造物',
		desc: '鸠老制造的仿生兽，看似活物却无自我意识，攻防一体，是鸠老的得意造物。',
		source: 'worldview.db·characters(鸠老)',
	},
	昊天·斗帅宫妖王: {
		formal: '昊天',
		affiliation: '妖灵会馆一级执行者',
		species: '妖精',
		desc: '妖灵会馆一级执行者，坐镇斗帅宫的妖王级战力，具体资料暂未公开。',
		source: 'worldview.db·characters(昊天)',
	},
	执行者·无限: {
		formal: '无限',
		affiliation: '妖灵会馆（最强执行者）',
		species: '人类（已成仙）',
		desc: '妖灵会馆最强执行者，世界最强的神，小黑的师父。曾一人一剑破城使罗城不战而降，兴国年号定为"无限元年"。',
		source: 'worldview.db·characters(无限)',
	},

	// —— 府先生团队（天明珠抢夺事件）——
	破老: {
		formal: '破老',
		affiliation: '府先生团队',
		species: '蛤蟆（蛙）妖',
		desc: '蛤蟆（蛙）妖，自带隐身技能的体术宗师，风度翩翩。与老府、青丘、酒仙、千针同伙，为救友人抢夺天明珠。',
		source: 'worldview.db·characters(破老)',
	},
	青丘: {
		formal: '青丘',
		affiliation: '府先生团队',
		species: '妖精（锁御师）',
		desc: '锁御师，双角长耳、总闭着眼的妖精，眯眯眼都是怪物。心思缜密，为救朋友与老府一伙夺取天明珠。',
		source: 'worldview.db·characters(青丘)',
	},
	千针: {
		formal: '千针',
		affiliation: '府先生团队',
		species: '鼠妖',
		desc: '鼠妖，灰白毛发扎辫子，额有手里剑标志。与府先生一伙为救友人抢夺天明珠，无法区分人类与人形妖精。',
		source: 'worldview.db·characters(千针)',
	},
	府先生·酒仙: {
		formal: '老府（府先生）',
		affiliation: '妖灵会馆-灵溪会馆',
		species: '老虎妖精',
		desc: '老虎妖精，脾气暴躁、话多、超级自恋、一身蛮力。自称讨厌人类，说话东北口音但不是东北虎。',
		source: 'worldview.db·characters(老府)',
	},
	府先生·千针: {
		formal: '老府（府先生）',
		affiliation: '妖灵会馆-灵溪会馆',
		species: '老虎妖精',
		desc: '老虎妖精与鼠妖千针联手，蛮力与针雨齐下，攻势如潮。',
		source: 'worldview.db·characters(老府/千针)',
	},
	府先生·破老: {
		formal: '老府（府先生）',
		affiliation: '妖灵会馆-灵溪会馆',
		species: '老虎妖精',
		desc: '老虎妖精与体术宗师破老并肩作战，一力降十会，拳脚带风。',
		source: 'worldview.db·characters(老府/破老)',
	},

	// —— 北域 · 那伽（金丹-元婴区）——
	那伽·灵主: {
		formal: '那伽',
		affiliation: '北域 / 妖灵会馆长老',
		species: '妖精',
		desc: '北域之主，为延续寿命布局多年，以数千妖精性命要挟老君交出治愈系清凝。反被灵誓束缚，一生谋划化为泡影。',
		source: 'worldview.db·characters(那伽)',
	},
	那伽·领域: {
		formal: '那伽',
		affiliation: '北域',
		species: '妖精',
		desc: '北域之主展开领域，灵压铺天盖地，无数妖精的灵气皆被其吞噬。',
		source: 'worldview.db·characters(那伽)',
	},
	那伽·北域之主: {
		formal: '那伽',
		affiliation: '北域',
		species: '妖精',
		desc: '北域之主。三百年后与老君一战落败，最终靠接受灵誓保命，由强大反派沦为笑柄。',
		source: 'worldview.db·characters(那伽)',
	},

	// —— 老君阁 / 蓝溪镇（元婴区）——
	谛听·侦查鹰犬: {
		formal: '谛听',
		affiliation: '妖灵会馆/酆都（幽都）',
		species: '上古神兽',
		desc: '上古神兽，原为明王麾下守卫，后随老君。看护天明珠时被小黑盗走，拥有三匹会变黄色翅膀的侦查鹰犬。',
		source: 'worldview.db·characters(谛听)',
	},
	卡里·灵植守卫: {
		formal: '卡里',
		affiliation: '灵溪会馆（馆长）',
		species: '妖精',
		desc: '灵溪会馆馆长，御灵系木，催生的植物可存续存活，是会馆主要经济来源之一，也是《众生之门》游戏策划。',
		source: 'worldview.db·characters(卡里)',
	},
	木落仙人·巨灵阵: {
		formal: '木落仙人',
		affiliation: '神兽/神仙·妖灵会馆长老',
		species: '妖精',
		desc: '上仙，曾寄灵于树精灵七果体内。被阿根逼出后借木系灵石恢复原身，以巨灵阵镇守一方。',
		source: 'worldview.db·characters(木落仙人)',
	},
	冬冬·时滞: {
		formal: '东东',
		affiliation: '龙游会馆（执行者）',
		species: '妖精（执行者）',
		desc: '龙游会馆执行者，社会身份是学生。曾指挥鸟类搬运零件救下客机，能力可令周围时间迟滞。',
		source: 'worldview.db·characters(东东)',
	},
	老君·灵誓试炼: {
		formal: '老君',
		affiliation: '妖灵会馆创始人、蓝溪镇',
		species: '妖精（已封神）',
		desc: '妖灵会馆三大创始神之一，1400岁"神仙"。立誓百年不出君阁，以灵誓试炼考验来者心性，闭关期间沉迷ACG。',
		source: 'worldview.db·characters(老君)',
	},
	玄离·冰火双域: {
		formal: '玄离',
		affiliation: '老君/蓝溪镇（曾）；深山/阿根（现）',
		species: '妖精（犬科/螭龙）',
		desc: '深山犬科妖精，随老君清凝游历。曾染上那伽之灵，冰火双域齐开，被尊为"山神"，爱吃肘子。',
		source: 'worldview.db·characters(玄离)',
	},
	明王·阎罗噬魂: {
		formal: '阎明（明王）',
		affiliation: '妖灵会馆创始人',
		species: '妖精（已封神）',
		desc: '妖灵会馆三大创始人之一、三神之一，与老君并列的"明王"。灵质空间为酆都，阎罗噬魂吞噬万灵。',
		source: 'worldview.db·characters(阎明)',
	},

	// —— 苍南会馆 / 妖王（化神区）——
	哪吒·三头六臂: {
		formal: '哪吒',
		affiliation: '妖灵会馆创始人之一',
		species: '妖精',
		desc: '暴躁的妖王，妖灵会馆创始人之一，黑发黑瞳身高123cm。三头六臂时攻势如潮，是第二部电影主角团。',
		source: 'worldview.db·characters(哪吒)',
	},
	孙悟空·斗帅妖王: {
		formal: '孙悟空',
		affiliation: '妖灵会馆（神兽/神仙类）',
		species: '神兽/神仙',
		desc: '由妖王成神的存在，与哪吒同列妖王。在被神化之后，老君对其实力评价为"一般般"。',
		source: 'worldview.db·characters(孙悟空)',
	},
	西木子·戏梦: {
		formal: '西木子',
		affiliation: '苍南会馆五大长老之一',
		species: '狐妖',
		desc: '狐妖，很早就跟随老君，因为很少出手而实力成迷。眯眯眼玩世不恭，实则智谋顶尖，是可靠的"定海神针"。',
		source: 'worldview.db·characters(西木子)',
	},
	灵遥·流石之影: {
		formal: '灵遥',
		affiliation: '妖灵会馆（前长老，被捕）',
		species: '妖精',
		desc: '妖灵会馆前长老，流石事件主谋。曾支持人妖共和，后思想动摇，以流石甲袭击鹿野与小黑，败后被逮捕。',
		source: 'worldview.db·characters(灵遥)',
	},

	// —— 终局 · 重生之门（第 9 层）——
	重生之门·门灵: {
		formal: '重生之门·门灵',
		affiliation: '重生之门',
		species: '聚灵与散灵边界之意志',
		desc: '聚灵与散灵边界之门所化的意志，守护轮回真相的终极试炼，打通此门者可窥见重生的奥秘。',
		source: '游戏原创设定（终局主题单位）',
	},
	门灵·回响: {
		formal: '门灵·回响',
		affiliation: '重生之门',
		species: '门灵残响',
		desc: '重生之门深处回荡的门灵残响，轮回的回音愈战愈强，是终局之门前最后的低语。',
		source: '游戏原创设定（终局主题单位）',
	},
}

/**
 * 按敌人名取档案；未收录的敌人返回 null（战斗界面仅展示基础信息）。
 * @param {string|undefined} name
 * @returns {object|null}
 */
export const enemyProfileByName = name => {
 const native=(name&&enemyProfiles[name])||null;
 const character=characterByName(name);
 return character?{...native,characterId:character.id,formal:character.name,species:character.species,affiliation:character.affiliation,desc:character.summary,source:character.sourceUrl}:native;
}

/**
 * 档案总数（供验证脚本断言）。
 */
export const enemyProfileCount = Object.keys(enemyProfiles).length
