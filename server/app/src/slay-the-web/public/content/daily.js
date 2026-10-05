// 罗小黑战记·重生之门 —— 今日灵机（每日轮回祝福）
// 以现实日期为种子，确定性生成"今日五行当值"与"今日灵机祝福"：
// 每日一局开局自动应用一项灵机被动，跨局 meta 的轻量每日挑战元素。
// 设定：天地灵机随日月流转而变，妖精与修行者顺天应时，得一日之佑。
// 存储：不持久化（日期即种子，天然跨日轮换）；本局记录写入 state.player.daily。

// 五行当值池（与 element-mastery.js 的 ELEMENTS 保持一致）
const DAILY_ELEMENTS = [
	{element: '金', name: '金气当值', flavor: '肃杀收敛，锋芒自生'},
	{element: '木', name: '木气当值', flavor: '万物生发，生机盎然'},
	{element: '水', name: '水气当值', flavor: '流转不息，福泽绵长'},
	{element: '火', name: '火气当值', flavor: '灵潮澎湃，灼灼其华'},
	{element: '土', name: '土气当值', flavor: '厚德载物，稳如泰山'},
]

// 灵机祝福池（被动字段与法宝/羁绊/本命被动白名单对齐）
const DAILY_BLESSINGS = [
	{id: 'lingchao', name: '灵潮初涌', desc: '天地生灵流转不息，福缘自至。', passive: {fortune: 3}},
	{id: 'houtu', name: '厚土承灵', desc: '大地厚载，灵质空间稳固。', passive: {maxHealth: 6}},
	{id: 'jinfeng', name: '金锋淬炼', desc: '锋芒内敛，御灵之力凝练。', passive: {atkBonus: 2}},
	{id: 'mulin', name: '木灵回春', desc: '回春之力缠绕周身，生生不息。', passive: {hpRegen: 1}},
	{id: 'huoyan', name: '火灵激涌', desc: '灵潮澎湃，攻守兼备。', passive: {atkBonus: 1, maxHealth: 3}},
	{id: 'lingjue', name: '灵觉通明', desc: '灵觉澄澈，道心稳固。', passive: {daoHeart: 4}},
	{id: 'juling', name: '聚灵之泽', desc: '灵泽汇聚，福缘与生机同至。', passive: {fortune: 2, maxHealth: 3}},
	{id: 'wanwu', name: '万物生发', desc: '生灵萌动，周而复始。', passive: {hpRegen: 1, fortune: 1}},
	{id: 'lingcang', name: '灵藏微启', desc: '灵藏微启，见闻化为底蕴。', passive: {daoHeart: 2, fortune: 1}},
	{id: 'guben', name: '固本培元', desc: '固本培元，稳守灵台。', passive: {maxHealth: 5, defBonus: 1}},
]

// 被动字段 → 中文文案（与 menu.js PASSIVE_LABELS 对齐）
const PASSIVE_LABELS = {
	atkBonus: (v) => `攻击 +${v}`,
	defBonus: (v) => `格挡 +${v}`,
	hpRegen: (v) => `每回合回复 ${v} 生命`,
	fortune: (v) => `福缘 +${v}`,
	maxHealth: (v) => `最大生命 +${v}`,
	daoHeart: (v) => `道心 +${v}`,
}

// djb2 字符串哈希：确定性散列，同一日期永远得到同一灵机
export function dailySeed(dateStr) {
	let h = 5381
	for (let i = 0; i < dateStr.length; i++) {
		h = ((h << 5) + h + dateStr.charCodeAt(i)) >>> 0
	}
	return h
}

// 日期 → YYYY-MM-DD（本地时区，避免 UTC 偏移导致跨日错位）
export function dateStrOf(date = new Date()) {
	const y = date.getFullYear()
	const m = String(date.getMonth() + 1).padStart(2, '0')
	const d = String(date.getDate()).padStart(2, '0')
	return `${y}-${m}-${d}`
}

// 今日灵机：按日期确定性选出五行当值与祝福
export function todayDaily(date = new Date()) {
	const dateStr = dateStrOf(date)
	const seed = dailySeed(dateStr)
	const element = DAILY_ELEMENTS[seed % DAILY_ELEMENTS.length]
	const blessing = DAILY_BLESSINGS[Math.floor(seed / 7) % DAILY_BLESSINGS.length]
	return {
		dateStr,
		seed,
		element,
		blessing,
	}
}

// 祝福被动 → 中文文案
export function formatDailyPassive(passive = {}) {
	return Object.entries(passive)
		.map(([k, v]) => (PASSIVE_LABELS[k] ? PASSIVE_LABELS[k](v) : null))
		.filter(Boolean)
		.join('、') || '无'
}

// 开局应用今日灵机：被动写入 player，并记录本局 daily 信息（幂等：同一日期仅生效一次）
export function applyDailyBlessing(state, daily = todayDaily()) {
	if (!state?.player) return state
	const p = state.player
	// 幂等保护：同一日期已应用过今日灵机则跳过，防止重复叠加
	if (p.daily?.date === daily.dateStr) return state
	const {element, blessing} = daily
	if (blessing?.passive?.atkBonus) p.atkBonus = (p.atkBonus || 0) + blessing.passive.atkBonus
	if (blessing?.passive?.defBonus) p.defBonus = (p.defBonus || 0) + blessing.passive.defBonus
	if (blessing?.passive?.maxHealth) {
		p.maxHealth += blessing.passive.maxHealth
		p.currentHealth += blessing.passive.maxHealth
	}
	if (blessing?.passive?.fortune) p.fortune += blessing.passive.fortune
	if (blessing?.passive?.daoHeart) p.daoHeart += blessing.passive.daoHeart
	if (blessing?.passive?.hpRegen) p.hpRegen = (p.hpRegen || 0) + blessing.passive.hpRegen
	p.daily = {
		date: daily.dateStr,
		blessingId: blessing?.id || null,
		name: blessing?.name || null,
		desc: blessing?.desc || null,
		passive: blessing?.passive || {},
		element: element?.element || null,
		elementName: element?.name || null,
		elementFlavor: element?.flavor || null,
	}
	return state
}

// 供 UI 展示的纯数据入口
export function dailyBlessings() {
	return DAILY_BLESSINGS.map((b) => ({...b}))
}
