// 局内存档系统：localStorage 保存/恢复当前对局快照。
// 配合 UI：自动存档（App.update 每次状态变更落盘）、继续游戏（SplashScreen）、结算清理（死亡/通关）。
// 与 menu.js 的 URL hash 保存互为补充：hash 用于分享整局；本模块用于本机中途退出后继续冒险。
// 玩家档案（profile）：跨会话保留的"修行/传承"总档案——灵质修行进度快照写入此档案，
// 主界面入口据此展示状态摘要，结算界面据此计算联动奖励（详见 content/lingzhi-bonus.js）。
const SAVE_KEY = 'lxz-rebirth-run-v1'
const PROFILE_KEY = 'lxz-rebirth-profile-v1'

// 可注入 storage（node 验证脚本注入内存 mock；浏览器默认使用全局 localStorage）
let injectedStorage = null
export function setStorage(s) {
	injectedStorage = s
}
function getStorage() {
	if (injectedStorage) return injectedStorage
	if (typeof localStorage !== 'undefined') return localStorage
	return null
}

// 快照合法性校验：必须包含可继续游玩的核心字段
export function isValidRunState(state) {
	if (!state || typeof state !== 'object') return false
	if (!state.player || typeof state.player !== 'object') return false
	if (!state.dungeon || !Array.isArray(state.dungeon.graph) || state.dungeon.graph.length === 0) return false
	if (!Array.isArray(state.deck) || !Array.isArray(state.drawPile)) return false
	if (state.player.currentHealth == null || state.player.maxHealth == null) return false
	return true
}

// 深拷贝 state；dungeon 节点 edges 是 Set，JSON 无法直接序列化（会变空对象 {}），
// 序列化时统一转数组、恢复时转回 Set，保证地图（map.js 依赖 edges.has）可继续移动。
function convertEdges(graph, toArray) {
	if (!graph || !Array.isArray(graph)) return graph
	for (const row of graph) {
		if (!Array.isArray(row)) continue
		for (const node of row) {
			if (!node || !node.edges) continue
			if (toArray && node.edges instanceof Set) node.edges = [...node.edges]
			else if (!toArray && Array.isArray(node.edges)) node.edges = new Set(node.edges)
		}
	}
	return graph
}

function cloneWithSets(obj) {
	if (obj instanceof Set) return [...obj].map(cloneWithSets)
	if (Array.isArray(obj)) return obj.map(cloneWithSets)
	if (obj && typeof obj === 'object') {
		const out = {}
		for (const key of Object.keys(obj)) out[key] = cloneWithSets(obj[key])
		return out
	}
	return obj
}

// 生成可落盘的序列化字符串（不改动原 state）
export function serializeRun(state) {
	const copy = cloneWithSets(state)
	convertEdges(copy?.dungeon?.graph, true)
	return JSON.stringify(copy)
}

// 从序列化字符串恢复 state（edges 数组转回 Set）
export function deserializeRun(json) {
	const state = JSON.parse(json)
	convertEdges(state?.dungeon?.graph, false)
	return state
}

/**
 * 保存当前对局快照。
 * @param {object} state 当前游戏 state（game.state）
 * @returns {boolean} 是否成功落盘
 */
export function saveRun(state) {
	const storage = getStorage()
	if (!storage) return false
	if (!isValidRunState(state)) return false
	try {
		const node = state.dungeon?.graph?.[state.dungeon.y]?.[state.dungeon.x]
		const payload = {
			version: 1,
			savedAt: Date.now(),
			floor: state.dungeon.y,
			roomType: node?.room?.type || null,
			state: JSON.parse(serializeRun(state)),
		}
		storage.setItem(SAVE_KEY, JSON.stringify(payload))
		return true
	} catch (err) {
		console.warn('局内存档写入失败:', err)
		return false
	}
}

/**
 * 读取局内存档。
 * @returns {object|null} 有效存档的 state；无存档/损坏时返回 null（损坏时自动清除）
 */
export function loadRun() {
	const storage = getStorage()
	if (!storage) return null
	let raw
	try {
		raw = storage.getItem(SAVE_KEY)
	} catch (err) {
		return null
	}
	if (!raw) return null
	try {
		const payload = JSON.parse(raw)
		if (!payload || !payload.state) return null
		if (!isValidRunState(payload.state)) {
			clearRun()
			return null
		}
		return deserializeRun(JSON.stringify(payload.state))
	} catch (err) {
		clearRun()
		return null
	}
}

/** 是否存在可继续的局内存档 */
export function hasRun() {
	const storage = getStorage()
	if (!storage) return false
	try {
		return Boolean(storage.getItem(SAVE_KEY))
	} catch (err) {
		return false
	}
}

/** 清除局内存档（结算后调用，避免通关/死亡后仍显示"继续游戏"） */
export function clearRun() {
	const storage = getStorage()
	if (!storage) return
	try {
		storage.removeItem(SAVE_KEY)
	} catch (err) {
		/* noop */
	}
}

// ============ 玩家档案（灵质修行进度快照，跨会话保留） ============
// 修行进度本体仍由 game/lingzhi-progress.js（lxz-lingzhi-xiuxing-v1）保管；
// 此处为主存档体系中的档案镜像：每次 saveProgress 同步写入，供主界面入口/结算界面快速读取摘要。

/**
 * 从修行进度生成档案摘要（只读聚合，不持有完整卡池数据）。
 * @param {object} progress lingzhi-progress.js 的进度对象
 * @returns {{shards:number, unlockedCharacters:number, unlockedCards:number, unlockedRelics:number, unlockedCount:number, claimedCount:number, runs:number, wins:number, bestTimeMs:number|null, lastRunDate:string|null, updatedAt:number}}
 */
export function lingzhiSummaryFrom(progress) {
	if (!progress || typeof progress !== 'object') return null
	const unlockedCharacters = Array.isArray(progress.unlockedCharacters) ? progress.unlockedCharacters.length : 0
	const unlockedCards = Array.isArray(progress.unlockedCards) ? progress.unlockedCards.length : 0
	const unlockedRelics = Array.isArray(progress.unlockedRelics) ? progress.unlockedRelics.length : 0
	return {
		shards: progress.shards || 0,
		unlockedCharacters,
		unlockedCards,
		unlockedRelics,
		unlockedCount: unlockedCharacters + unlockedCards + unlockedRelics,
		claimedCount: progress.claimedAchievements ? Object.keys(progress.claimedAchievements).length : 0,
		runs: progress.runs || 0,
		wins: progress.wins || 0,
		bestTimeMs: progress.bestTimeMs || null,
		lastRunDate: progress.lastRunDate || null,
		updatedAt: Date.now(),
	}
}

/**
 * 保存玩家档案（完整覆盖）。
 * @param {object} profile 档案对象（建议由 lingzhiSummaryFrom 生成）
 * @returns {boolean}
 */
export function saveProfile(profile) {
	const storage = getStorage()
	if (!storage || !profile) return false
	try {
		storage.setItem(PROFILE_KEY, JSON.stringify(profile))
		return true
	} catch (err) {
		console.warn('玩家档案写入失败:', err)
		return false
	}
}

/**
 * 读取玩家档案。
 * @returns {object|null} 无档案/损坏时返回 null
 */
export function loadProfile() {
	const storage = getStorage()
	if (!storage) return null
	try {
		const raw = storage.getItem(PROFILE_KEY)
		if (!raw) return null
		return JSON.parse(raw)
	} catch (err) {
		return null
	}
}

/** 是否存在玩家档案 */
export function hasProfile() {
	const storage = getStorage()
	if (!storage) return false
	try {
		return Boolean(storage.getItem(PROFILE_KEY))
	} catch (err) {
		return false
	}
}

/** 清除玩家档案（重置修行联动时使用） */
export function clearProfile() {
	const storage = getStorage()
	if (!storage) return
	try {
		storage.removeItem(PROFILE_KEY)
	} catch (err) {
		/* noop */
	}
}

/**
 * 同步修行进度到玩家档案：由 lingzhi-progress.saveProgress 调用，
 * 使修行进度在主存档体系中"留得下来"（跨会话可读、主界面可展示）。
 * @param {object} progress lingzhi-progress.js 的进度对象
 * @returns {object|null} 写入的档案摘要；失败返回 null
 */
export function syncLingzhiProfile(progress) {
	const summary = lingzhiSummaryFrom(progress)
	if (!summary) return null
	return saveProfile(summary) ? summary : null
}

/**
 * 读取档案中的修行摘要（主界面/结算界面展示用）。
 * @returns {object|null} lingzhiSummaryFrom 结构；未修行过返回 null
 */
export function getLingzhiSummary() {
	return loadProfile()
}

export default {saveRun, loadRun, hasRun, clearRun, setStorage, isValidRunState, saveProfile, loadProfile, hasProfile, clearProfile, syncLingzhiProfile, getLingzhiSummary, lingzhiSummaryFrom}
