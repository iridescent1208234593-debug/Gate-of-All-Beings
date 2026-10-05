// 罗小黑战记·重生之门 —— 组织与分馆成员聚合模块
// 数据来源：assets\罗小黑战记数据库\worldview_luoxiaohei_v4.db（organizations / org_branches / characters.affiliation）
// 用途：从 allCharacters 的 affiliation 字段按关键词聚合出各组织/分馆的成员名单，供图鉴页组织板块展示
// 字段：branchMembers 分馆成员 / organizationMembers 组织成员 / memberCountFor / membersOf

import {allCharacters} from './worldview-data.js'

// 妖灵会馆七大分馆（对应数据库 org_branches，苍南为总馆）
export const BRANCHES = [
	{branch: '苍南（总馆）', keywords: ['苍南', '总会馆', '总馆']},
	{branch: '灵溪', keywords: ['灵溪']},
	{branch: '龙游', keywords: ['龙游']},
	{branch: '流石', keywords: ['流石']},
	{branch: '洞桥', keywords: ['洞桥']},
	{branch: '粤东', keywords: ['粤东']},
	{branch: '寒木', keywords: ['寒木']},
]

// 主要组织（对应数据库 organizations 表）
export const ORGANIZATIONS = [
	{org: '妖灵会馆', keywords: ['会馆', '执行者', '感知组', '长老'], exclude: []},
	{org: '执行者', keywords: ['执行者', '一级执行者'], exclude: []},
	{org: '感知组', keywords: ['感知组', '感知'], exclude: []},
	{org: '离岛组织', keywords: ['离岛', '风息一伙', '风息阵营', '风息'], exclude: []},
	{org: '流石会馆', keywords: ['流石会馆', '流石'], exclude: []},
]

// 归一化名字（去括号别名/后缀），用于成员去重与校验
const norm = (s) => (s || '').replace(/[（(].*?[)）]/g, '').trim()

// 判断角色是否命中某组关键词：affiliation 文本包含任一关键词即命中
const hit = (affiliation, keywords) => keywords.some((k) => affiliation.includes(k))

// 聚合：某组关键词命中的成员名单（去重、按原名返回）
export const membersOf = (keywords, extraExclude = []) => {
	const seen = new Set()
	const out = []
	for (const c of allCharacters) {
		const aff = c.affiliation || ''
		if (!aff) continue
		if (extraExclude.some((k) => aff.includes(k))) continue
		if (!hit(aff, keywords)) continue
		const key = norm(c.name)
		if (seen.has(key)) continue
		seen.add(key)
		out.push(c.name)
	}
	return out
}

// 各分馆成员：分馆关键词命中，且排除其他分馆关键词（避免"灵溪会馆"同时命中多个分馆），但保留本分馆归属
export const branchMembers = BRANCHES.map(({branch, keywords}) => {
	const other = BRANCHES.filter((b) => b.branch !== branch).flatMap((b) => b.keywords)
	return {
		branch,
		keywords,
		members: membersOf(keywords, other),
	}
})

// 各组织成员（流石会馆条目并入分馆统计，这里保留独立组织视图）
export const organizationMembers = ORGANIZATIONS.map(({org, keywords, exclude}) => ({
	org,
	keywords,
	members: membersOf(keywords, exclude || []),
}))

// 统计速查
export const orgStats = Object.fromEntries(
	organizationMembers.map(({org, members}) => [org, members.length])
)
export const branchStats = Object.fromEntries(
	branchMembers.map(({branch, members}) => [branch, members.length])
)
export const totalBranchMembers = branchMembers.reduce((n, b) => n + b.members.length, 0)

// 按组织/分馆名取成员
export const membersOfOrg = (name) => {
	const o = organizationMembers.find((x) => x.org === name)
	return o ? o.members : []
}
export const membersOfBranch = (name) => {
	const b = branchMembers.find((x) => x.branch === name)
	return b ? b.members : []
}
