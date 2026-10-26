// 罗小黑战记·重生之门 —— 灵质天赋（八大能力系）
// 设定依据：content/worldview-data.js（abilitySystems / ability_branches，源自 worldview_luoxiaohei_v4.db 的
//   ability_systems / ability_branches / dual_skills 表）：
//   御灵系（金木水火土分支）/ 生灵系（洞察、观灵、豪夺、隐匿、治愈、追毫）/ 造物系（重构、无中生有）/
//   空间系（传送、领域、吞噬）/ 心灵系（读心、心灵操纵、傀儡）/ 锁御系（灵御、制灵）/
//   强化系（生灵系分支：巨力、强化、爆力、迅身，代表电影《不再流浪》强化系使用者）/
//   治愈系（生灵系分支：极其罕见，以治疗为主，代表李清凝、阎明）。
// 机制：
//   1. 开局在「本命御灵系（五行共鸣）」之外，再选一个「灵质天赋」——灵质空间「因先天天赋拥有偏向」（worldview 原句）。
//      灵质天赋与五行本命正交：五行决定共鸣加成，天赋决定八大系的领域倾向。
//   2. 每系天赋 = 一个被动加成（与法宝/羁绊/五行共用 atkBonus/defBonus/hpRegen/fortune/daoHeart 键）
//      + 一张专属开局卡（加入初始卡组，体现该系代表性能力）
//   3. 锁御系额外以「灵御」天赋开局获得一件法宝（与世界观「与法宝、法器相关的能力」呼应）。
//   4. 双系合技（dual_skills 表）：造物系→「画灵」（生灵系+造物系）、心灵系→「灵誓」（生灵系+心灵系，
//      代表老君）。拥有对应天赋者在开局觉醒双系合技卡，体现「双系合技」的稀有能力。
// 兼容性：旧存档无 branch 字段 → 视为未选择天赋（不报错、无加成），保持存档可继续。

// 八大能力系天赋数据
export const abilityBranches = [
	{
		id: 'yuling',
		name: '御灵系',
		title: '御灵·攻伐',
		element: '金',
		flavor: '最基本的能力，分支为金木水火土。金（攻击）、木（生长）、水（控制/冰）、火（爆发）、土（防御）。你的灵质空间五行之气格外精纯，攻伐凌厉——开局按本命五行额外觉醒一张五行分支卡（御金·锋锐/御木·生长/御水·流转/御火·爆发/御土·厚德）。',
		passive: {atkBonus: 1},
		starterCard: '雷灵闪',
		// 五行分支联动：本命五行对应一张御灵系分支卡，开局加入卡组（御灵系「分支为金木水火土」）
		branchCards: {
			金: '御金·锋锐',
			木: '御木·生长',
			水: '御水·流转',
			火: '御火·爆发',
			土: '御土·厚德',
		},
		starterTreasure: null,
		representative: '天虎、无限（最强御灵系）',
	},
	{
		id: 'shengling',
		name: '生灵系',
		title: '生灵·愈生',
		element: '木',
		flavor: '与生命相关的能力：洞察、观灵、豪夺、隐匿、治愈、追毫。代表：鹿野（追毫）、清凝（治愈）、风息（豪夺）。生命链接——与其他生命共享生命力。',
		passive: {hpRegen: 1},
		starterCard: '眷灵',
		starterTreasure: null,
		representative: '清凝、鹿野、风息',
	},
	{
		id: 'zaowu',
		name: '造物系',
		title: '造物·重构',
		element: '土',
		flavor: '重构物体，改变物体性质与样貌，可依靠灵质空间中的物质灵无中生有。代表角色：鸠老。',
		passive: {defBonus: 1},
		starterCard: '重构',
		dualSkill: '画灵',
		starterTreasure: null,
		representative: '鸠老',
	},
	{
		id: 'kongjian',
		name: '空间系',
		title: '空间·觉性',
		element: '水',
		flavor: '空间上的不连续变化，或时间上的加速/减缓。特殊能力为「领域」。常见：吞噬、传送、转移、蕴藏。代表：小黑（传送+领域）、无限（吞噬）。空间系附着于灵质空间，无法后天习得——你的空间觉性是与生俱来的天赋。',
		passive: {fortune: 2},
		starterCard: '瞬移',
		starterTreasure: null,
		representative: '小黑、无限、阿根',
	},
	{
		id: 'xinling',
		name: '心灵系',
		title: '心灵·洞察',
		element: '火',
		flavor: '与精神力相关：读心、心灵操纵、傀儡等。你的灵识敏锐，道心坚固，能窥见人心与妖念。',
		passive: {daoHeart: 5},
		starterCard: '读心',
		dualSkill: '灵誓',
		starterTreasure: null,
		representative: '老君（灵誓）、阎明（摄魂）',
	},
	{
		id: 'suoyu',
		name: '锁御系',
		title: '锁御·御器',
		element: '土',
		flavor: '与法宝、法器相关的能力，如灵御、制灵。你与法器亲和，开局即有一件法宝随行。',
		passive: {defBonus: 1},
		starterCard: '御灵环',
		starterTreasure: '定心镜',
		representative: '鸠老（灵御）、七臂（七星锁）',
	},
	{
		id: 'qianghua',
		name: '强化系',
		title: '强化·体魄',
		element: '火',
		flavor: '生灵系分支，强化自身或他人的体质与力量，技能有巨力、强化、爆力、迅身等。代表：电影《不再流浪》中的强化系使用者。你以肉身横渡灵质空间，越战越强——每层力量使伤害+1，开局即觉醒「巨力」。',
		passive: {atkBonus: 2},
		starterCard: '巨力',
		starterTreasure: null,
		representative: '《不再流浪》强化系使用者',
	},
	{
		id: 'zhiyu',
		name: '治愈系',
		title: '治愈·回春',
		element: '木',
		flavor: '生灵系分支，极其罕见，以治疗为主。代表：李清凝、阎明。你的灵质天生蕴养生机，每回合持续回春，开局即觉醒「治愈灵光」。',
		passive: {hpRegen: 2},
		starterCard: '治愈灵光',
		starterTreasure: null,
		representative: '李清凝、阎明',
	},
]

/** @param {string} id @returns {object|undefined} */
export const abilityBranchById = (id) => abilityBranches.find((b) => b.id === id)

/** 汇总灵质天赋的某一被动数值（与 elementPassiveTotal / treasurePassiveTotal / bondPassiveTotal 对齐） */
export function branchPassiveTotal(player, key) {
	if (!player || !player.branch) return 0
	const branch = abilityBranchById(player.branch)
	return branch?.passive?.[key] || 0
}

// 战斗结算在五行被动 / 法宝 / 羁绊之后统一叠加灵质天赋被动（见 game/actions.js damageBlockTotal / endTurn）
