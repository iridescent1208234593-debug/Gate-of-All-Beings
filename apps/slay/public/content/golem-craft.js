// 罗小黑战记·重生之门 —— 灵偶造物模块
// 设定来源：worldview_luoxiaohei_v4.db·spirit_lifecycle（灵偶/傀儡）——
//   「灵偶/傀儡：直接用生灵和物质灵造出的类似生命的物体，看起来是活的但没有太多自我意识。」
//   造物系能力（ability_branches）：重构 / 无中生有——御灵师以生灵塑形、以物质灵凝体。
//   世界观实例：老君身边那只已有几百岁的傀儡；老君阁守门的灵偶；爬塔中遭遇的「灵偶·木人」。
// 玩法定位：御灵师在爬塔途中可借「造物」之能，消耗已聚敛的生灵/物质灵（ling-gather.js 双资源），
//   铸造灵偶随行助战。灵偶是"活着的造物"——看似有生命，却无自我意识，只认铸造者的灵。
//   灵偶铸造后本局永久生效，提供战斗被动加成（与法宝/羁绊/灵机被动字段对齐，由 game/actions.js 统一汇总）：
//   atkBonus 攻击加成 / defBonus 格挡加成 / hpRegen 每回合回复生命 /
//   fortune 福缘 / maxHealth 最大生命 / daoHeart 道心
// 存储：player.golems = [{id, name}]（铸造去重，同一灵偶仅铸一次）

// 灵偶数据表：按境界（所需生灵/物质灵门槛）从低到高排列
// shenglingNeed / wuzhiNeed 为铸造所需消耗；passive 为铸造后永久被动
export const golems = [
	{
		id: 'golem_muren',
		name: '灵偶·木人',
		realm: 0,
		desc: '以山中朽木为骨、以生灵塑形、以物质灵凝体的初阶灵偶。它笨拙地朝你拱了拱手——像老君阁门前那些守门的木偶，忠实地立在主人身侧。',
		shenglingNeed: 10,
		wuzhiNeed: 5,
		passive: {maxHealth: 3, defBonus: 1},
		passiveText: '最大生命 +3 · 格挡 +1',
		source: 'spirit_lifecycle·灵偶/傀儡',
	},
	{
		id: 'golem_shiyu',
		name: '灵偶·石侍',
		realm: 0,
		desc: '以山岩为胚、以双灵灌注的灵偶。石质的躯体沉重而稳固，立在身前如一道小墙。传说老君阁的守门灵偶皆是这般石心木骨，千年不移。',
		shenglingNeed: 18,
		wuzhiNeed: 12,
		passive: {defBonus: 2, fortune: 2},
		passiveText: '格挡 +2 · 福缘 +2',
		source: 'spirit_lifecycle·灵偶/傀儡',
	},
	{
		id: 'golem_zhikui',
		name: '灵偶·纸傀',
		realm: 1,
		desc: '以符纸叠成的小傀儡，生灵入纸便"活"了过来。它轻飘飘地贴在你肩头，替你挡开暗处袭来的灵刃。造物系中「无中生有」的入门手段。',
		shenglingNeed: 25,
		wuzhiNeed: 8,
		passive: {atkBonus: 1, fortune: 3},
		passiveText: '攻击 +1 · 福缘 +3',
		source: 'ability_branches·造物系（无中生有）',
	},
	{
		id: 'golem_shouling',
		name: '灵偶·守门',
		realm: 2,
		desc: '你复刻了老君阁守门灵偶的形制——石心木骨，眸中一点灵火。它立于你身前，气度沉稳，仿佛真的守着某扇看不见的门。',
		shenglingNeed: 40,
		wuzhiNeed: 35,
		passive: {defBonus: 3, maxHealth: 5},
		passiveText: '格挡 +3 · 最大生命 +5',
		source: 'worldview-events·老君阁守门灵偶',
	},
	{
		id: 'golem_laojun',
		name: '灵偶·百岁傀',
		realm: 3,
		desc: '你以最精纯的生灵与物质灵，仿照老君那只活了数百年的傀儡铸成此偶。它安静地跟在你身后，像一位沉默的故人——造物至此，已是"类生命"。',
		shenglingNeed: 60,
		wuzhiNeed: 50,
		passive: {atkBonus: 2, daoHeart: 5},
		passiveText: '攻击 +2 · 道心 +5',
		source: 'characters·老君（傀儡已有几百岁）',
	},
]

/** 按 id 取灵偶详情 */
export function golemById(id) {
	return golems.find((g) => g.id === id) || null
}

/** 玩家已铸灵偶详情列表（无则空数组） */
export function ownedGolems(player = {}) {
	return (player.golems || []).map((g) => golemById(typeof g === 'string' ? g : g.id)).filter(Boolean)
}

/**
 * 铸造判定：检查资源是否足够、是否已铸过、灵偶是否存在。
 * @param {object} player 玩家状态（含 shengling / wuzhi / golems）
 * @param {string} golemId 灵偶 id
 * @returns {{ok: boolean, reason?: string, golem?: object}}
 */
export function canCraftGolem(player = {}, golemId) {
	const golem = golemById(golemId)
	if (!golem) return {ok: false, reason: '未知灵偶'}
	const owned = (player.golems || []).some((g) => (typeof g === 'string' ? g : g.id) === golemId)
	if (owned) return {ok: false, reason: '已铸造过该灵偶'}
	if ((player.shengling || 0) < golem.shenglingNeed) return {ok: false, reason: '生灵不足'}
	if ((player.wuzhi || 0) < golem.wuzhiNeed) return {ok: false, reason: '物质灵不足'}
	return {ok: true, golem}
}

/**
 * 执行铸造：消耗生灵/物质灵，登记灵偶并应用永久被动。
 * @param {object} player 玩家状态（直接修改）
 * @param {string} golemId 灵偶 id
 * @returns {{ok: boolean, reason?: string, golem?: object, reward?: object}}
 */
export function craftGolem(player = {}, golemId) {
	const ready = canCraftGolem(player, golemId)
	if (!ready.ok) return ready
	const golem = ready.golem
	player.shengling = Math.max(0, (player.shengling || 0) - golem.shenglingNeed)
	player.wuzhi = Math.max(0, (player.wuzhi || 0) - golem.wuzhiNeed)
	if (!Array.isArray(player.golems)) player.golems = []
	player.golems.push({id: golem.id, name: golem.name})
	const passive = golem.passive || {}
	const reward = {}
	if (passive.atkBonus) player.atkBonus = Math.min(999, (player.atkBonus || 0) + passive.atkBonus)
	if (passive.defBonus) player.defBonus = Math.min(999, (player.defBonus || 0) + passive.defBonus)
	if (passive.hpRegen) player.hpRegen = Math.min(99, (player.hpRegen || 0) + passive.hpRegen)
	if (passive.fortune) player.fortune = Math.min(999, (player.fortune || 0) + passive.fortune)
	if (passive.maxHealth) {
		player.maxHealth = Math.min(9999, (player.maxHealth || 0) + passive.maxHealth)
		player.currentHealth = Math.min(player.maxHealth, (player.currentHealth || 0) + passive.maxHealth)
	}
	if (passive.daoHeart) player.daoHeart = Math.min(999, (player.daoHeart || 0) + passive.daoHeart)
	reward.passive = passive
	return {ok: true, golem, reward}
}

/**
 * 灵偶被动汇总：跨所有已铸灵偶累加指定被动字段。
 * @param {object} player 玩家状态
 * @param {string} key 被动字段（atkBonus / defBonus / hpRegen / fortune / maxHealth / daoHeart）
 * @returns {number}
 */
export function golemPassiveTotal(player = {}, key) {
	return ownedGolems(player).reduce((sum, g) => sum + (g.passive?.[key] || 0), 0)
}

/** 灵偶状态摘要（供菜单 / 日志展示） */
export function golemStatus(player = {}) {
	const list = ownedGolems(player)
	return {
		count: list.length,
		names: list.map((g) => g.name),
		shengling: player.shengling || 0,
		wuzhi: player.wuzhi || 0,
	}
}
