import { unifiedStorage } from '/shared/shared-session/kv.js';
const localStorage = unifiedStorage('slay');
// 罗小黑战记·重生之门 —— 「灵质修行」独立进度系统
// 修行进度本体存于独立 key（lxz-lingzhi-xiuxing-v1，跨会话保留），
// 每次保存同时向主存档体系（save-system.js 玩家档案）写入快照，
// 主界面入口/结算界面据此展示修行摘要与联动奖励；解锁条目同步登记图鉴（collection-progress 'lingzhi' 类别）。
import {
	lingzhiCharacters,
	lingzhiCards,
	allLingzhiRelics,
	lingzhiAchievements,
} from '../content/lingzhi-xiuxing.js'
import {markCollected} from '../content/collection-progress.js'
import {syncLingzhiProfile} from './save-system.js'

const KEY = 'lxz-lingzhi-xiuxing-v1'

const defaultProgress = () => ({
	shards: 0, // 修行残片
	unlockedCharacters: ['walker'], // 默认解锁行者
	unlockedCards: ['yanji', 'tengji', 'lianji', 'lingmai', 'liexi'], // 默认解锁基础灵术卡（对应 cardId）
	unlockedRelics: ['jiemao', 'huijudai'], // 默认解锁界锚、绘具袋
	unlockTime: {}, // {type:id -> ISO 时间戳}，图鉴记录首次解锁时间
	claimedAchievements: {}, // achievementId -> true 已领取
	runs: 0, // 累计开始修行次数
	wins: 0, // 累计通关次数
	bestFloor: 0, // 历史最高到达层数（灵质回路共 7 层，第 7 层为守门 Boss；结算跨局奖励按此折算）
	bestTimeMs: null, // 最快通关时间(毫秒)
	lastRunDate: null, // 最近一次修行日期（YYYY-MM-DD）
	todayUsed: 0, // 今日已用次数
	longestBattleTurns: 0, // 历史最长单场战斗回合数（鏖战不休）
	walkerFirstWin: false, // 行者证道
	everUnlockedCharacter: false, // 新契觉醒
	everUnlockedCard: false, // 术式初开
	everUnlockedRelic: false, // 遗物结缘
	everFastWin: false, // 疾行证道
	everLongBattle: false, // 鏖战不休
})

export function loadProgress() {
	try {
		const raw = localStorage.getItem(KEY)
		if (!raw) return defaultProgress()
		return {...defaultProgress(), ...JSON.parse(raw)}
	} catch (e) {
		return defaultProgress()
	}
}

export function saveProgress(progress) {
	localStorage.setItem(KEY, JSON.stringify(progress))
	// 同步主存档体系玩家档案（修行进度快照），使修行进度跨会话在主游戏侧"留得下来"
	syncLingzhiProfile(progress)
}

// 今日日期字符串（本地时区）
export function todayStr() {
	const d = new Date()
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 每日免费次数：10 次。跨天自动重置（按 lastRunDate 判断）。
export function todayRemaining(progress) {
	if (progress.lastRunDate !== todayStr()) return 10
	return Math.max(0, 10 - (progress.todayUsed || 0))
}

// 记录一次开始修行：次数 +1、更新今日计数。返回是否消耗了免费次数（超出后仍可玩但不计免费）。
export function recordRunStart(progress) {
	const today = todayStr()
	const next = {...progress}
	if (next.lastRunDate !== today) {
		next.lastRunDate = today
		next.todayUsed = 0
	}
	next.todayUsed = (next.todayUsed || 0) + 1
	next.runs = (next.runs || 0) + 1
	return next
}

// 结算：通关时奖励残片并记录次数/最快时间/长战标记，同时折算「魂灵」。
// result: {won: bool, elapsedMs: number, maxTurnsInRun: number, characterId: string, awardShards?: bool}
// awardShards 默认 true；每日免费次数用尽后继续修行通关时不奖励残片与魂灵（wins/最快时间仍记录）。
// 魂灵折算对齐 content/soul-legacy.js 注释「局内奇遇（事件 / 灵质空间）可凝结魂灵种子，散灵时折入轮回」：
// 灵质回路试炼本身即在轮回之中——击败守门 Boss 折 30 魂灵，散灵（失败）折 5 魂灵，
// 由 UI 层通过 awardSoul 折入主游戏魂灵传承，下一世爬塔开局获得传承加成。
export function settleRun(progress, result) {
	const next = {...progress}
	let soulGained = 0
	if (result.won) {
		next.wins = (next.wins || 0) + 1
		if (result.awardShards !== false) {
			next.shards = (next.shards || 0) + 30
			soulGained = 30
		}
		if (!next.bestTimeMs || result.elapsedMs < next.bestTimeMs) {
			next.bestTimeMs = result.elapsedMs
		}
		if (result.elapsedMs < 20 * 60 * 1000) next.everFastWin = true
		if (result.characterId === 'walker') next.walkerFirstWin = true
	}
	if (result.maxTurnsInRun) {
		next.longestBattleTurns = Math.max(next.longestBattleTurns || 0, result.maxTurnsInRun)
		if (result.maxTurnsInRun >= 15) next.everLongBattle = true
	}
	// 记录历史最高到达层数（灵质回路 1-7 层，第 7 层即守门 Boss）；
	// 供跨局结算奖励按「守门 Boss 通关 / 最高层数」折算（见 content/lingzhi-bonus.js）
	if (result.floor) {
		next.bestFloor = Math.max(next.bestFloor || 0, result.floor)
	}
	// 失败亦折 5 魂灵（散灵感悟，仍在免费次数内）
	if (!result.won && result.awardShards !== false) soulGained = 5
	next.soulGained = soulGained
	return next
}

// 解锁条目：type ∈ characters/cards/relics，id 为对应 id/cardId。残片不足时返回 null。
export function tryUnlock(progress, type, id) {
	if (progress.unlockedCharacters.includes(id) || progress.unlockedCards.includes(id) || progress.unlockedRelics.includes(id)) {
		return {ok: false, reason: 'already'}
	}
	let pool, cost, unlockedKey
	if (type === 'characters') {
		pool = lingzhiCharacters
		cost = pool.find((c) => c.id === id)?.cost
		unlockedKey = 'unlockedCharacters'
	} else if (type === 'cards') {
		pool = lingzhiCards
		cost = pool.find((c) => c.cardId === id)?.cost
		unlockedKey = 'unlockedCards'
	} else {
		pool = allLingzhiRelics
		cost = pool.find((r) => r.id === id)?.cost
		unlockedKey = 'unlockedRelics'
	}
	if (cost == null) return {ok: false, reason: 'notfound'}
	if (progress.shards < cost) return {ok: false, reason: 'noshards', cost}
	const next = {...progress}
	next.shards -= cost
	next[unlockedKey] = [...next[unlockedKey], id]
	next.unlockTime[`${type}:${id}`] = new Date().toISOString()
	if (type === 'characters') next.everUnlockedCharacter = true
	if (type === 'cards') next.everUnlockedCard = true
	if (type === 'relics') next.everUnlockedRelic = true
	// 打通图鉴闭环：解锁的修行角色/灵术卡/遗物登记进图鉴 'lingzhi' 类别（collection.html 可查看）
	const itemName = pool.find((it) => (it.cardId || it.id) === id)?.name
	if (itemName) markCollected('lingzhi', itemName)
	return {ok: true, next}
}

// 领取成就奖励
export function claimAchievement(progress, achievementId) {
	const ach = lingzhiAchievements.find((a) => a.id === achievementId)
	if (!ach) return {ok: false}
	if (progress.claimedAchievements[achievementId]) return {ok: false, reason: 'claimed'}
	if (!achievementReady(progress, ach)) return {ok: false, reason: 'notready'}
	const next = {...progress, claimedAchievements: {...progress.claimedAchievements}}
	next.claimedAchievements[achievementId] = true
	next.shards += ach.reward
	return {ok: true, next}
}

// 成就达成判定（返回当前进度/目标）
export function achievementProgress(progress, ach) {
	switch (ach.id) {
		case 'chuta':
			return {current: progress.runs || 0, target: 1}
		case 'chuzheng':
			return {current: progress.wins || 0, target: 1}
		case 'qinxue':
			return {current: progress.runs || 0, target: 10}
		case 'wujie':
			return {current: progress.wins || 0, target: 5}
		case 'xingzhe':
			return {current: progress.walkerFirstWin ? 1 : 0, target: 1}
		case 'xinqi':
			return {current: progress.everUnlockedCharacter ? 1 : 0, target: 1}
		case 'shushi':
			return {current: progress.everUnlockedCard ? 1 : 0, target: 1}
		case 'yiwu':
			return {current: progress.everUnlockedRelic ? 1 : 0, target: 1}
		case 'jixing':
			return {current: progress.everFastWin ? 1 : 0, target: 1}
		case 'aozhan':
			return {current: progress.longestBattleTurns || 0, target: 15}
		default:
			return {current: 0, target: 1}
	}
}

export function achievementReady(progress, ach) {
	const p = achievementProgress(progress, ach)
	return p.current >= p.target
}

// 图鉴总览统计
export function collectionSummary(progress) {
	const total = lingzhiCharacters.length + lingzhiCards.length + allLingzhiRelics.length
	const collected = progress.unlockedCharacters.length + progress.unlockedCards.length + progress.unlockedRelics.length
	return {total, collected, remaining: total - collected}
}
