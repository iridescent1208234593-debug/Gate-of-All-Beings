import { unifiedStorage } from '/shared/shared-session/kv.js';
const localStorage = unifiedStorage('slay');
// 罗小黑战记·重生之门 —— 收集进度模块
// 玩家在爬塔中遇见角色/敌人/事件/灵质空间/卡牌/法宝后自动登记，
// 图鉴页据此展示"已收录 / 未收录"与收集进度（localStorage 持久化，跨局保留）。
// 存储键：lxhz-rebirth-collection

const STORAGE_KEY = 'lxhz-rebirth-collection'

// 可收集类别（与图鉴板块一一对应）
export const COLLECTIBLE_TYPES = ['characters', 'enemies', 'events', 'spaces', 'cards', 'artifacts', 'locations', 'stories', 'bonds', 'golems', 'articles', 'lingzhi', 'staff']

const empty = () => {
	const data = {}
	COLLECTIBLE_TYPES.forEach((t) => (data[t] = []))
	return data
}

export function getCollection() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return empty()
		const parsed = JSON.parse(raw)
		const data = empty()
		COLLECTIBLE_TYPES.forEach((t) => {
			data[t] = Array.isArray(parsed[t]) ? parsed[t] : []
		})
		return data
	} catch (e) {
		return empty()
	}
}

function save(data) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
	} catch (e) {
		// localStorage 不可用时静默失败，不影响游戏
	}
}

// 登记一个条目；重复登记自动去重，返回是否新增
export function markCollected(type, name) {
	if (!COLLECTIBLE_TYPES.includes(type) || !name) return false
	const data = getCollection()
	if (data[type].includes(name)) return false
	data[type].push(name)
	save(data)
	recordSession(type, name)
	return true
}

// 批量登记
export function markMany(type, names) {
	if (!COLLECTIBLE_TYPES.includes(type) || !names || !names.length) return 0
	const data = getCollection()
	let added = 0
	names.forEach((n) => {
		if (n && !data[type].includes(n)) {
			data[type].push(n)
			added++
		}
	})
	if (added) {
		save(data)
		names.forEach((n) => {
			if (n) recordSession(type, n)
		})
	}
	return added
}

export function isCollected(type, name) {
	if (!COLLECTIBLE_TYPES.includes(type) || !name) return false
	return getCollection()[type].includes(name)
}

// 某类别进度：{collected, total, ratio}
export function getProgress(type, total) {
	const collected = getCollection()[type].length
	return {
		collected: Math.min(collected, total),
		total,
		ratio: total ? Math.min(collected / total, 1) : 0,
	}
}

// 清空收集记录（图鉴页提供重置按钮）
export function resetCollection() {
	save(empty())
}

// ============ 本局解锁追踪 ============
// 每次开局（ui/index.js handleNewGame）调用 resetSessionUnlocks 清空；
// markCollected / markMany 登记"首次新增"时同步记入 sessionStorage，
// 结算界面据此展示"本局图鉴新增"，刷新/关页不影响历史收集，只影响本局记录。
const SESSION_KEY = 'lxhz-rebirth-session-unlocks'

function getSessionData() {
	try {
		const raw = sessionStorage.getItem(SESSION_KEY)
		if (!raw) return empty()
		const parsed = JSON.parse(raw)
		const data = empty()
		COLLECTIBLE_TYPES.forEach((t) => {
			data[t] = Array.isArray(parsed[t]) ? parsed[t] : []
		})
		return data
	} catch (e) {
		return empty()
	}
}

function saveSession(data) {
	try {
		sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
	} catch (e) {
		// sessionStorage 不可用时静默失败，仅影响本局统计展示
	}
}

function recordSession(type, name) {
	try {
		const data = getSessionData()
		if (!data[type].includes(name)) {
			data[type].push(name)
			saveSession(data)
		}
	} catch (e) {
		// 忽略记录失败
	}
	recordToast(type, name)
}

// ============ 局内即时提示队列（见闻收录 toast） ============
// markCollected / markMany 新增时同步入队，ui/app.js 定时消费后在局内弹出
// "图鉴收录：xxx" 浮层提示，让玩家在战斗中即时感知收集反馈（不依赖结算界面）。
const TOAST_KEY = 'lxhz-rebirth-collection-toast'
const TOAST_LIMIT = 8 // 队列上限，超出丢弃最旧的

function getToasts() {
	try {
		const raw = sessionStorage.getItem(TOAST_KEY)
		return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []
	} catch (e) {
		return []
	}
}

function saveToasts(list) {
	try {
		sessionStorage.setItem(TOAST_KEY, JSON.stringify(list))
	} catch (e) {
		// sessionStorage 不可用时静默失败，仅影响浮层提示
	}
}

function recordToast(type, name) {
	const list = getToasts()
	list.push({type, name, at: Date.now()})
	if (list.length > TOAST_LIMIT) list.splice(0, list.length - TOAST_LIMIT)
	saveToasts(list)
}

// 消费并清空即时提示队列（ui/app.js 轮询调用，返回 [{type, name, at}]）
export function drainCollectionToasts() {
	const list = getToasts()
	if (list.length) saveToasts([])
	return list
}

// 清空即时提示队列（开局时随本局解锁记录一并重置）
export function resetCollectionToasts() {
	saveToasts([])
}

// 清空本局解锁记录（开局时调用）
export function resetSessionUnlocks() {
	saveSession(empty())
	resetCollectionToasts()
}

// 本局新解锁条目：{type: [names]}，仅含本局首次新增
export function getSessionUnlocks() {
	const data = getSessionData()
	const out = {}
	COLLECTIBLE_TYPES.forEach((t) => {
		if (data[t].length) out[t] = data[t]
	})
	return out
}

// 本局新解锁条目总数
export function sessionUnlockCount() {
	const data = getSessionData()
	return COLLECTIBLE_TYPES.reduce((s, t) => s + data[t].length, 0)
}

// 历史累计收集条目总数（跨局）
export function totalCollected() {
	const data = getCollection()
	return COLLECTIBLE_TYPES.reduce((s, t) => s + data[t].length, 0)
}

// 类别中文名（结算界面展示用）
export const TYPE_LABELS = {
	characters: '角色',
	enemies: '敌人',
	events: '事件',
	spaces: '灵质空间',
	cards: '卡牌',
	artifacts: '法宝',
	locations: '地点',
	stories: '剧情',
	bonds: '羁绊',
	golems: '灵偶',
	articles: '词条',
	lingzhi: '灵质修行',
}
