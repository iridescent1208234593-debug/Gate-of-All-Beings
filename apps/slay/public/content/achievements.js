import { unifiedStorage } from '/shared/shared-session/kv.js';
const localStorage = unifiedStorage('slay');
// 罗小黑战记·重生之门 —— 成就系统（Achievements）
// 成就数据 + 纯函数判定 + 跨局持久化解锁。
// 存储键：lxz-rebirth-achievements-v1（localStorage，跨局保留，与局内存档 lxz-rebirth-run-v1 / 魂灵 luoxiaohei-rebirth-soul-legacy 互补）
// 判定上下文 context 由结算接入点（ui/app.js render 结算块）构造：
//   runState: { won, player: {element, gold, currentHealth, maxHealth}, bossesDefeated: [本局已击败 Boss 名] }
//   legacy: settleRun 返回值（runs/wins/soul 均为结算后数值）
//   collectionCount: totalCollected() 图鉴跨局收集总数
//   achievementState: 成就存档（elementWins 各系通关次数 / totalBosses 跨局累计击败 Boss 数）
// Boss 名对齐 content/dungeon-encounters.js 的 bosses / regionBossPools / finalBossPool。
// 世界观依据：content/worldview-data.js（风息/那伽/老君/玄离/明王/无限/灵遥/门灵）。

export const ACHIEVEMENT_KEY = 'lxz-rebirth-achievements-v1'

export const ACHIEVEMENT_CATEGORIES = {
	progress: '轮回',
	boss: '强敌',
	element: '五行',
	collection: '收集',
	challenge: '挑战',
}

export const ACHIEVEMENTS = [
	// ==================== 轮回 / 进程 ====================
	{
		id: 'first-run',
		name: '初入轮回',
		desc: '完成第一局冒险，无论散灵或通关。',
		category: 'progress',
		icon: '🌱',
		condition: {type: 'runs', min: 1},
		rewardTitle: '轮回初醒',
		rewardSoul: 30,
	},
	{
		id: 'win-gate',
		name: '穿过重生之门',
		desc: '首次通关「重生之门」，窥见轮回的真相。',
		category: 'progress',
		icon: '🚪',
		condition: {type: 'wins', min: 1},
		rewardTitle: '重生者',
		rewardSoul: 100,
	},
	{
		id: 'runs-5',
		name: '五世轮回',
		desc: '累计轮回 5 世，魂灵一次次重归天地。',
		category: 'progress',
		icon: '♻️',
		condition: {type: 'runs', min: 5},
		rewardTitle: '五世行者',
		rewardSoul: 40,
	},
	{
		id: 'runs-15',
		name: '十五世轮回',
		desc: '累计轮回 15 世，轮回的尽头是重生。',
		category: 'progress',
		icon: '🌀',
		condition: {type: 'runs', min: 15},
		rewardTitle: '轮回见证者',
		rewardSoul: 80,
	},
	{
		id: 'soul-1000',
		name: '魂灵千点',
		desc: '累计魂灵达到 1000，「轮回」级传承觉醒。',
		category: 'progress',
		icon: '🔮',
		condition: {type: 'soul', min: 1000},
		rewardTitle: '凝魂大能',
		rewardSoul: 50,
	},

	// ==================== 强敌 / 区域 Boss ====================
	{
		id: 'boss-fengxi',
		name: '风息之败',
		desc: '击败离岛首领「风息」——豪夺的执念归于平静。',
		category: 'boss',
		icon: '🌬️',
		condition: {type: 'boss', names: ['离岛首领·风息']},
		rewardTitle: '风止',
		rewardSoul: 40,
	},
	{
		id: 'boss-naga',
		name: '北域之战',
		desc: '击败北域领主「那伽」，渊啸之寒为之平息。',
		category: 'boss',
		icon: '🐍',
		condition: {type: 'boss', names: ['那伽·领域', '那伽·北域之主']},
		rewardTitle: '破渊',
		rewardSoul: 40,
	},
	{
		id: 'boss-laojun',
		name: '灵誓试炼',
		desc: '击败「老君·灵誓试炼」——老君的道，你接住了。',
		category: 'boss',
		icon: '☯️',
		condition: {type: 'boss', names: ['老君·灵誓试炼']},
		rewardTitle: '破誓者',
		rewardSoul: 40,
	},
	{
		id: 'boss-xuanli',
		name: '冰火双域',
		desc: '击败「玄离·冰火双域」，炎域圣火亦不能拦你。',
		category: 'boss',
		icon: '❄️',
		condition: {type: 'boss', names: ['玄离·冰火双域']},
		rewardTitle: '冰火不侵',
		rewardSoul: 40,
	},
	{
		id: 'boss-mingwang',
		name: '明王之试',
		desc: '击败「明王·阎罗噬魂」——吞噬魂灵之路到此为止。',
		category: 'boss',
		icon: '👹',
		condition: {type: 'boss', names: ['明王·阎罗噬魂']},
		rewardTitle: '噬魂克星',
		rewardSoul: 40,
	},
	{
		id: 'boss-wuxian',
		name: '最强执行者',
		desc: '击败「执行者·无限」，剑域亦为你所破。',
		category: 'boss',
		icon: '⚔️',
		condition: {type: 'boss', names: ['执行者·无限']},
		rewardTitle: '剑域破者',
		rewardSoul: 50,
	},
	{
		id: 'boss-lingyao',
		name: '流石之影',
		desc: '击败「灵遥·流石之影」，断金阵碎于脚下。',
		category: 'boss',
		icon: '🗿',
		condition: {type: 'boss', names: ['灵遥·流石之影']},
		rewardTitle: '断金破阵',
		rewardSoul: 40,
	},
	{
		id: 'boss-gate-spirit',
		name: '门灵之约',
		desc: '击败「重生之门·门灵」——聚灵与散灵，皆归你管。',
		category: 'boss',
		icon: '⛩️',
		condition: {type: 'boss', names: ['重生之门·门灵']},
		rewardTitle: '开门者',
		rewardSoul: 80,
	},

	// ==================== 五行 / 精通 ====================
	{
		id: 'element-mastery',
		name: '五行归一',
		desc: '以金、木、水、火、土五种本命御灵系各通关一次。',
		category: 'element',
		icon: '🌈',
		condition: {type: 'element-wins', elements: ['金', '木', '水', '火', '土']},
		rewardTitle: '五行宗师',
		rewardSoul: 80,
	},

	// ==================== 收集 / 财富 / 挑战 ====================
	{
		id: 'collector-30',
		name: '初窥图鉴',
		desc: '世界观图鉴累计收集 30 条（角色/敌人/事件/灵质空间/卡牌/法宝/地点/剧情）。',
		category: 'collection',
		icon: '📖',
		condition: {type: 'collect', min: 30},
		rewardTitle: '求知者',
		rewardSoul: 30,
	},
	{
		id: 'collector-100',
		name: '百物博览',
		desc: '世界观图鉴累计收集 100 条，罗小黑宇宙尽收眼底。',
		category: 'collection',
		icon: '📚',
		condition: {type: 'collect', min: 100},
		rewardTitle: '百晓生',
		rewardSoul: 60,
	},
	{
		id: 'collect-characters-20',
		name: '群妖志',
		desc: '图鉴收录 20 位角色（含 OC），人妖共世的众生相尽入卷中。',
		category: 'collection',
		icon: '👥',
		condition: {type: 'category-collect', category: 'characters', min: 20},
		rewardTitle: '识百妖',
		rewardSoul: 30,
	},
	{
		id: 'collect-cards-30',
		name: '卡牌藏家',
		desc: '图鉴收录 30 张卡牌，御灵招式与灵质运用皆可入卷。',
		category: 'collection',
		icon: '🃏',
		condition: {type: 'category-collect', category: 'cards', min: 30},
		rewardTitle: '藏卷人',
		rewardSoul: 30,
	},
	{
		id: 'collect-spaces-6',
		name: '灵境旅人',
		desc: '图鉴收录 6 处灵质空间，灵质之界的边界等你丈量。',
		category: 'collection',
		icon: '🌌',
		condition: {type: 'category-collect', category: 'spaces', min: 6},
		rewardTitle: '灵境行者',
		rewardSoul: 30,
	},
	{
		id: 'collect-bonds-3',
		name: '羁绊初结',
		desc: '图鉴收录 3 段羁绊，人妖之间的真情亦有迹可循。',
		category: 'collection',
		icon: '🤝',
		condition: {type: 'category-collect', category: 'bonds', min: 3},
		rewardTitle: '结缘者',
		rewardSoul: 30,
	},
	{
		id: 'wealth-200',
		name: '富甲一方',
		desc: '单局内累计持有金币达到 200。',
		category: 'collection',
		icon: '🪙',
		condition: {type: 'gold', min: 200},
		rewardTitle: '聚宝灵主',
		rewardSoul: 30,
	},
	{
		id: 'flawless',
		name: '完胜轮回',
		desc: '通关「重生之门」且剩余生命不低于一半——毫发无伤地穿过轮回。',
		category: 'challenge',
		icon: '💎',
		condition: {type: 'flawless', minHealthRatio: 0.5},
		rewardTitle: '无伤行者',
		rewardSoul: 60,
	},
	{
		id: 'boss-slayer-3',
		name: '过关斩将',
		desc: '跨局累计击败 3 个区域/最终 Boss。',
		category: 'challenge',
		icon: '🏆',
		condition: {type: 'boss-count', min: 3},
		rewardTitle: '御灵猎手',
		rewardSoul: 60,
	},
]

// 空成就存档
export function emptyAchievementState() {
	return {unlocked: {}, elementWins: {金: 0, 木: 0, 水: 0, 火: 0, 土: 0}, totalBosses: 0}
}

/** 读取跨局成就存档（浏览器外环境返回 null） */
export function getAchievementState() {
	if (typeof localStorage === 'undefined') return null
	try {
		const raw = localStorage.getItem(ACHIEVEMENT_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw)
		const base = emptyAchievementState()
		return {
			unlocked: parsed.unlocked || base.unlocked,
			elementWins: Object.assign(base.elementWins, parsed.elementWins || {}),
			totalBosses: parsed.totalBosses || 0,
		}
	} catch (err) {
		console.warn('成就存档读取失败', err)
		return null
	}
}

/** 写入跨局成就存档 */
export function saveAchievementState(state) {
	if (typeof localStorage === 'undefined') return
	try {
		localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(state))
	} catch (err) {
		console.warn('成就存档写入失败', err)
	}
}

/** 是否已解锁 */
export function isUnlocked(id, state) {
	return Boolean(state?.unlocked?.[id])
}

/** 已解锁数量 */
export function unlockedCount(state) {
	return Object.keys(state?.unlocked || {}).length
}

/**
 * 纯函数：判断单条成就是否达成（不依赖 localStorage，便于验证与测试）。
 * @param {object} achievement
 * @param {object} context 判定上下文（结构见文件头注释）
 * @returns {boolean}
 */
export function evaluateAchievement(achievement, context = {}) {
	const cond = achievement?.condition
	if (!cond) return false
	const {runState = {}, legacy = {}, collectionCount = 0, achievementState = {}} = context
	const player = runState.player || {}
	const bosses = Array.isArray(runState.bossesDefeated) ? runState.bossesDefeated : []
	switch (cond.type) {
		case 'runs':
			return (legacy.runs || 0) >= (cond.min || 0)
		case 'wins':
			return (legacy.wins || 0) >= (cond.min || 0)
		case 'soul':
			return (legacy.soul || 0) >= (cond.min || 0)
		case 'gold':
			return (player.gold || 0) >= (cond.min || 0)
		case 'collect':
			return collectionCount >= (cond.min || 0)
		case 'category-collect': {
			const byType = context.collectionByType || {}
			return (byType[cond.category]?.length || 0) >= (cond.min || 0)
		}
		case 'boss':
			return (cond.names || []).some((n) => bosses.includes(n))
		case 'boss-count':
			return (achievementState.totalBosses || 0) >= (cond.min || 0)
		case 'element-wins': {
			const wins = achievementState.elementWins || {}
			return (cond.elements || []).every((el) => (wins[el] || 0) >= 1)
		}
		case 'flawless': {
			if (!runState.won) return false
			const ratio = Math.max(0, player.currentHealth || 0) / Math.max(1, player.maxHealth || 1)
			return ratio >= (cond.minHealthRatio || 0.5)
		}
		default:
			return false
	}
}

/**
 * 结算入口：更新跨局累计字段、解锁新成就并持久化。
 * @param {object} context 判定上下文（结构见文件头注释）
 * @returns {object[]} 本次新解锁的成就数组（无新解锁时为空数组）
 */
export function checkAchievements(context = {}) {
	const state = getAchievementState() || emptyAchievementState()
	const {runState = {}} = context
	const player = runState.player || {}

	// 更新跨局累计字段（先于判定，保证五行归一/斩妖如麻等累计型成就在本局生效）
	if (runState.won && player.element && state.elementWins) {
		state.elementWins[player.element] = (state.elementWins[player.element] || 0) + 1
	}
	if (Array.isArray(runState.bossesDefeated)) {
		state.totalBosses = (state.totalBosses || 0) + runState.bossesDefeated.length
	}

	const nextContext = {...context, achievementState: state}
	const newly = []
	for (const ach of ACHIEVEMENTS) {
		if (state.unlocked[ach.id]) continue
		if (evaluateAchievement(ach, nextContext)) {
			state.unlocked[ach.id] = {unlockedAt: Date.now()}
			newly.push(ach)
		}
	}
	// 无条件持久化：即使本轮无新成就，elementWins/totalBosses 等跨局累计字段也必须落盘，
	// 否则后续局次读取到旧存档，五行归一/斩妖如麻等累计型成就永远无法达成。
	saveAchievementState(state)
	return newly
}

export default {ACHIEVEMENTS, ACHIEVEMENT_KEY, evaluateAchievement, checkAchievements, getAchievementState, isUnlocked, unlockedCount}
