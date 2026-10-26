// 罗小黑战记·重生之门 —— 角色登场记录（Episode Appearances）
// 数据来源：content/episodes-data.js（提取自 worldview_luoxiaohei_v4.db 的 episode_characters 表，
//          已按 characters 表白名单过滤声优/路人，831 条登场记录 → 47 位角色）
// 用途：为图鉴页「角色图鉴」提供反向视图 —— 某位角色在哪些剧集登场。
//       正向视图（剧集→登场角色）由 episodes-data.js 的 episodeList.cast 承担，
//       本模块聚合反向索引（角色→登场集数列表），与角色生平大事记（character-events.js）
//       互补：生平是剧情节点，登场记录是出演足迹。
// 说明：cast 为空数组的集次不参与索引；同角色按集数升序排列。
import {episodeList} from './episodes-data.js'

// 角色名 → [{num, title}, ...]（按 num 升序；title 为空时只显示集数）
const index = {}
for (const ep of episodeList) {
	if (!ep || !Array.isArray(ep.cast) || ep.cast.length === 0) continue
	for (const name of ep.cast) {
		if (!name) continue
		if (!index[name]) index[name] = []
		index[name].push({num: ep.num, title: ep.title || ''})
	}
}
for (const name of Object.keys(index)) {
	index[name].sort((a, b) => a.num - b.num)
}

// 某角色的登场记录（无则返回空数组）
export function appearancesForCharacter(name) {
	if (!name) return []
	return index[name] || []
}

// 出场集数标签：用于角色卡片 lines —— "登场 12 集"
export function appearanceLine(name) {
	const list = appearancesForCharacter(name)
	if (!list.length) return null
	return `登场 ${list.length} 集`
}

// 统计：有登场记录的角色数 / 总集次（供图鉴标题展示）
export const appearanceStats = (() => {
	let total = 0
	for (const name of Object.keys(index)) total += index[name].length
	return {characters: Object.keys(index).length, total}
})()

// 全部有登场记录的角色名（调试/检索用）
export const appearedNames = Object.keys(index)
