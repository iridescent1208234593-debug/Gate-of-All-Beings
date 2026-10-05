// 聚灵修炼·化形模块
// 设定来源：content/worldview-data.js 灵质循环概念（提取自 worldview_luoxiaohei_v4.db）——
//   「聚灵：生灵汇聚形成精灵、精灵与物质灵结合演变成妖精的过程，是妖精诞生的方式」
//   「精灵：生灵汇聚后形成的没有实体的存在形态」
//   「散灵：生命终结时生灵飘散回归自然」
// 数值参考：games\juling\engine.js（PHASE_LING 天时相位 / TRANSFORM 化形门槛），
//           天时相位数据已由 element-mastery.js weatherPhases 提供（shengling/wuzhi/decay 字段）。
// 玩法定位：御灵师在爬塔途中可借天时聚灵，积累「生灵/物质灵」双资源；
//           达标后化形进阶（精灵 → 妖精 → 大妖），获得生命、道心等永久增益。

import {weatherPhaseInfo} from './element-mastery.js'

// 聚灵修炼配置（对齐 wuxing-game：初始生灵 20 / 化形门槛 40 / 基础获取 4+3）
export const LING_CFG = {
	INIT_SHENGLING: 20, // 初始生灵（孕育中的生命底蕴）
	INIT_WUZHI: 0, // 初始物质灵
	BASE_GATHER_S: 4, // 聚灵基础生灵
	BASE_GATHER_W: 3, // 聚灵基础物质灵
	MAX_SHENGLING: 999,
	MAX_WUZHI: 999,
}

// 化形阶段：按「精灵 → 妖精 → 大妖」递进（参考 spirit_lifecycle：生灵与物质灵交织方成实体）
// shenglingNeed / wuzhiNeed 为「化形进入该阶段」所需门槛（达标后消耗对应数额完成化形）；
// 精灵为初始形态无门槛，妖精 40/40、大妖 90/90（对齐 wuxing-game TRANSFORM_S/TRANSFORM_W=40）。
export const transformStages = [
	{
		stage: 0,
		name: '精灵·无形',
		desc: '生灵汇聚成灵，尚无实体——你仍在聚灵孕育之中。',
		shenglingNeed: 0,
		wuzhiNeed: 0,
		reward: {maxHealth: 0, daoHeart: 0},
		rewardText: '——',
	},
	{
		stage: 1,
		name: '妖精·化形',
		desc: '生灵与物质灵交织成形，灵质空间稳固，可显化妖形。',
		shenglingNeed: 40,
		wuzhiNeed: 40,
		reward: {maxHealth: 8, daoHeart: 5},
		rewardText: '生命上限 +8 · 道心 +5',
	},
	{
		stage: 2,
		name: '大妖·通灵',
		desc: '灵质空间自成一域，生灵鼎盛——传说中的大妖之境。',
		shenglingNeed: 90,
		wuzhiNeed: 90,
		reward: {maxHealth: 12, daoHeart: 8},
		rewardText: '生命上限 +12 · 道心 +8',
	},
]

/** 当前化形阶段详情（按玩家 transformStage 索引，越界取最后一段） */
export function transformStageInfo(player = {}) {
	const idx = Math.min(player.transformStage || 0, transformStages.length - 1)
	return transformStages[idx]
}

/** 下一化形阶段详情（满阶返回 null） */
export function nextTransformInfo(player = {}) {
	const idx = (player.transformStage || 0) + 1
	if (idx >= transformStages.length) return null
	return transformStages[idx]
}

/**
 * 一次聚灵获取量：按当前楼层天时相位计算（基础值 + 相位倾向），
 * 与 element-mastery.js weatherPhases 的 shengling/wuzhi/decay 字段联动。
 * @param {string|null} weatherElement 当前楼层天时（weatherForFloor）
 * @returns {{shengling: number, wuzhi: number, decay: number, element: string|null}}
 */
export function gatherLing(weatherElement) {
	const ph = weatherPhaseInfo(weatherElement)
	if (!ph) return {shengling: LING_CFG.BASE_GATHER_S, wuzhi: LING_CFG.BASE_GATHER_W, decay: 0, element: null}
	return {
		shengling: LING_CFG.BASE_GATHER_S + ph.shengling,
		wuzhi: LING_CFG.BASE_GATHER_W + ph.wuzhi,
		decay: ph.decay || 0,
		element: ph.element,
	}
}

/**
 * 聚灵修炼：把一次聚灵收益累加到玩家身上（clamp 上限），并返回本次变动明细。
 * @param {object} player 玩家状态（含 shengling / wuzhi）
 * @param {string|null} weatherElement 当前楼层天时
 * @returns {{gain: {shengling:number, wuzhi:number, decay:number, element:string|null}, before: number, after: number}}
 */
export function applyGatherLing(player, weatherElement) {
	const gain = gatherLing(weatherElement)
	const before = {shengling: player.shengling || 0, wuzhi: player.wuzhi || 0}
	player.shengling = Math.min((player.shengling || 0) + gain.shengling, LING_CFG.MAX_SHENGLING)
	player.wuzhi = Math.min((player.wuzhi || 0) + gain.wuzhi, LING_CFG.MAX_WUZHI)
	return {gain, before, after: {shengling: player.shengling, wuzhi: player.wuzhi}}
}

/**
 * 化形判定：检查玩家当前阶段是否已达标，返回可化形的目标阶段（未达标返回 null）。
 * @param {object} player 玩家状态
 * @returns {{stage: object, idx: number}|null}
 */
export function checkTransform(player = {}) {
	const idx = player.transformStage || 0
	if (idx >= transformStages.length - 1) return null
	const next = transformStages[idx + 1]
	if ((player.shengling || 0) >= next.shenglingNeed && (player.wuzhi || 0) >= next.wuzhiNeed) {
		return {stage: next, idx: idx + 1}
	}
	return null
}

/**
 * 执行化形：消耗当前阶段所需生灵/物质灵，推进 transformStage 并应用奖励。
 * @param {object} player 玩家状态（直接修改）
 * @returns {{ok: boolean, stage: object|null, reward: object}}
 */
export function performTransform(player = {}) {
	const ready = checkTransform(player)
	if (!ready) return {ok: false, stage: null, reward: {}}
	const stage = ready.stage
	player.shengling = Math.max(0, (player.shengling || 0) - stage.shenglingNeed)
	player.wuzhi = Math.max(0, (player.wuzhi || 0) - stage.wuzhiNeed)
	player.transformStage = ready.idx
	const reward = stage.reward || {}
	if (reward.maxHealth) player.maxHealth = Math.min(9999, (player.maxHealth || 0) + reward.maxHealth)
	if (reward.maxHealth) player.currentHealth = Math.min(player.maxHealth, (player.currentHealth || 0) + reward.maxHealth)
	if (reward.daoHeart) player.daoHeart = Math.min(999, (player.daoHeart || 0) + reward.daoHeart)
	if (reward.cultivation) player.cultivation = Math.min(100, (player.cultivation || 0) + reward.cultivation)
	return {ok: true, stage, reward}
}

/** 玩家聚灵状态摘要（供日志 / UI 使用） */
export function lingStatus(player = {}) {
	const stage = transformStageInfo(player)
	return {
		shengling: player.shengling || 0,
		wuzhi: player.wuzhi || 0,
		stageName: stage.name,
		stage: stage.stage,
	}
}
