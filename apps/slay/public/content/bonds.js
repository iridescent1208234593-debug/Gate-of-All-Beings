// 罗小黑战记·重生之门 —— 羁绊系统数据模块
// 数据来源：content/relations-data.js（提取自 worldview_luoxiaohei_v4.db 的 character_relations）
// 玩法定位：爬塔中通过「羁绊事件」（世界观事件 / 灵质空间）与核心角色结缘，
//   羁绊一旦结下本局永久生效，提供战斗被动加成 —— 你不再是孤身闯门的散修。
// 效果字段与法宝 passive 保持一致（由 game/actions.js 统一汇总）：
//   atkBonus 攻击加成 / defBonus 格挡加成 / hpRegen 每回合回复生命 /
//   fortune 福缘 / maxHealth 最大生命 / daoHeart 道心（后三者获得时立即生效）
// 恩怨类羁绊同样可以结缘：与宿敌的对抗执念会化作力量（atkBonus），
// 呼应世界观中「恨意亦是灵」的聚灵设定。

export const bonds = [
	// ---------- 羁绊 ----------
	{
		id: 'bond_hei',
		name: '黑猫之友',
		partner: '罗小黑',
		type: '羁绊',
		desc: '灵溪镇那只爱说话的小黑猫把你当成了朋友。它承诺：遇到麻烦，会替你挡在前面。',
		passive: {fortune: 6, daoHeart: 3},
	},
	{
		id: 'bond_xiaobai',
		name: '小白的邀请',
		partner: '罗小白',
		type: '羁绊',
		desc: '罗小白邀请你去她家吃饭。家的气息让灵质空间更稳固，气血也养得更好。',
		passive: {maxHealth: 5, daoHeart: 3},
	},
	{
		id: 'bond_bidiu',
		name: '团鼠的信任',
		partner: '比丢',
		type: '羁绊',
		desc: '比丢啃了你半袋干粮，从此认定你是好人。它圆滚滚地跟着你，打架时偶尔会帮忙。',
		passive: {atkBonus: 1, maxHealth: 3},
	},
	{
		id: 'bond_shanxin',
		name: '山新的日常',
		partner: '山新',
		type: '羁绊',
		desc: '山新约你一起遛猫、打游戏。凡尘的日常像一盏灯，照得道心越发清明。',
		passive: {daoHeart: 6, fortune: 3},
	},
	{
		id: 'bond_huangshou',
		name: '皇受的粘人',
		partner: '皇受',
		type: '羁绊',
		desc: '皇受不知为何赖上了你——整天"喵喵"叫着蹭你。猫妖的直觉很灵，跟着你总能捡到好东西。',
		passive: {fortune: 8},
	},
	{
		id: 'bond_gen',
		name: '玄离的赠言',
		partner: '玄离 / 阿根',
		type: '羁绊',
		desc: '蓝溪镇的阿根（实为玄离化身）赠你一句忠告："妖的一生很长，别把力气花在恨上。"',
		passive: {maxHealth: 4, fortune: 4},
	},

	// ---------- 师门 ----------
	{
		id: 'bond_wuxian',
		name: '执行者的认可',
		partner: '无限',
		type: '师门',
		desc: '无限认可了你的身手，随手点拨了几式御灵手法。金系灵力的锋锐感，从此留在你的指尖。',
		passive: {atkBonus: 2},
	},
	{
		id: 'bond_luyeshi',
		name: '师姐的指教',
		partner: '鹿野',
		type: '师门',
		desc: '鹿野教了你一套感知妖精灵力的呼吸法。习惯了她的「追毫」式，你对危险的嗅觉更敏锐了。',
		passive: {defBonus: 1, daoHeart: 3},
	},

	// ---------- 关联 ----------
	{
		id: 'bond_laojun',
		name: '老君阁论道',
		partner: '老君',
		type: '关联',
		desc: '老君邀你在蓝玉盘边喝了盏茶。上古大妖的一句点拨，让你的防御术法圆融了不少。',
		passive: {defBonus: 2, daoHeart: 3},
	},
	{
		id: 'bond_diting',
		name: '谛听的凝视',
		partner: '谛听',
		type: '关联',
		desc: '谛听看了你一眼，什么也没说。但之后每逢受伤，总有一股温和的灵流护住你的心脉。',
		passive: {hpRegen: 1},
	},
	{
		id: 'bond_xuhuai',
		name: '虚淮的印记',
		partner: '虚淮',
		type: '关联',
		desc: '虚淮在你手背上留了一道空间印记，说是"迷路时好用"。印记者，气运总不会太差。',
		passive: {fortune: 5, defBonus: 1},
	},

	// ---------- 恩怨 ----------
	{
		id: 'bond_fengxi',
		name: '风息的余念',
		partner: '风息',
		type: '恩怨',
		desc: '你在风息散灵的林木间站了很久。那份执拗的恨与遗憾化作一缕灵缠上你的剑——恨意，也是灵。',
		passive: {atkBonus: 3},
	},

	// ---------- 师门 · 新缘 ----------
	{
		id: 'bond_qingning',
		name: '清凝的灵愈',
		partner: '清凝',
		type: '师门',
		desc: '蓝溪镇三和堂的医者、老君入室弟子清凝为你梳理了淤堵的灵脉。柔和的治愈之灵留在你的灵质空间里，往后的伤，总会好得快些。',
		passive: {hpRegen: 1, maxHealth: 3},
	},
	{
		id: 'bond_zeyu',
		name: '泽宇的追毫',
		partner: '泽宇',
		type: '师门',
		desc: '鹿野的唯一弟子泽宇教你感知灵力的诀窍——像他师父那样，在战斗前一息便察觉到杀机落在何处。',
		passive: {defBonus: 1, daoHeart: 3},
	},

	// ---------- 羁绊 · 新缘 ----------
	{
		id: 'bond_luozhu',
		name: '洛竹的枝条',
		partner: '洛竹',
		type: '羁绊',
		desc: '风息一伙的同伴洛竹与你击掌为约。森林妖精的生机顺着木系灵力缠上你的臂膀，枯木也能抽出新芽。',
		passive: {maxHealth: 4, fortune: 3},
	},

	// ---------- 关联 · 新缘 ----------
	{
		id: 'bond_panjing',
		name: '馆长的棋局',
		partner: '潘靖',
		type: '关联',
		desc: '龙游会馆馆长潘靖拉你下了盘棋。这位昔日的燕国军师看人极准，说与你投缘，临别赠了你一枚温润的棋子。',
		passive: {fortune: 5, daoHeart: 3},
	},
	{
		id: 'bond_dongdong',
		name: '东东的鸟哨',
		partner: '东东',
		type: '关联',
		desc: '龙游会馆的东东教你用口哨指挥灵鸟侦查。晨光里鸟群应声而起，替你巡遍了方圆十里——有它们在前，战局总亮堂几分。',
		passive: {atkBonus: 1, daoHeart: 3},
	},

	// ---------- 恩怨 · 新缘 ----------
	{
		id: 'bond_naga',
		name: '那伽的觊觎',
		partner: '那伽',
		type: '恩怨',
		desc: '北域长老那伽的目光落在你身上——三百年前他觊觎清凝的治愈之力，如今又在你身上嗅到相同的灵息。被强敌盯上，恨意与警觉反而淬炼了你的锋芒。',
		passive: {atkBonus: 3},
	},

	// ---------- 关联 · 旧友与神兽 ----------
	{
		id: 'bond_kali',
		name: '分馆的酒约',
		partner: '卡里 / 潘靖',
		type: '关联',
		desc: '灵溪分馆馆长卡里与龙游馆长潘靖约你喝过一场酒。两位馆长的交情化作温润的灵光护着你——会馆的路，走到哪里都有熟门熟路的照应。',
		passive: {fortune: 4, daoHeart: 2},
	},
	{
		id: 'bond_baihu',
		name: '神兽手足',
		partner: '白虎 / 青龙',
		type: '羁绊',
		desc: '上古四大神兽中的白虎与青龙邀你旁观了一局天地之棋。神兽的平衡之道渗入你的灵质空间，让守御如山海般沉稳。',
		passive: {defBonus: 1, maxHealth: 4},
	},
	{
		id: 'bond_zhijiao',
		name: '生死至交',
		partner: '无限 / 老君',
		type: '关联',
		desc: '无限与老君这对至交好友，让你看到了"信任"最重的样子。这份情谊落在你身上，化作一层若有若无的护持。',
		passive: {defBonus: 1, fortune: 3},
	},
	{
		id: 'bond_lanyupan',
		name: '蓝玉盘的约定',
		partner: '老君 / 罗小白',
		type: '关联',
		desc: '老君把蓝玉盘递到你手中，托你替罗小白看看她长大后的世界。这份跨越四百年的牵挂，让气运也温柔了几分。',
		passive: {fortune: 3, maxHealth: 4},
	},
	{
		id: 'bond_jiuyou',
		name: '雾中旧识',
		partner: '虚淮 / 谛听',
		type: '关联',
		desc: '北域寒雾中，虚淮与谛听这对旧识不约而同放慢了脚步。神兽的默契护住你的心脉——旧友相逢处，伤也轻三分。',
		passive: {hpRegen: 1, fortune: 3},
	},
	{
		id: 'bond_longyou',
		name: '龙游旧友',
		partner: '闵翔 / 风息',
		type: '羁绊',
		desc: '闵翔与风息在离岛看海的旧时光，被你应下了一个"替他们记着"的约定。有些东西，得有人记着才不会散——记着的人，手也稳些。',
		passive: {atkBonus: 1, daoHeart: 3},
	},
]

/** 按 id 查找羁绊 */
export const bondById = (id) => bonds.find((b) => b.id === id)
