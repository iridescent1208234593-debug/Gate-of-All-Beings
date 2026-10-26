// 罗小黑战记·重生之门 —— 纪年回响模块
// 数据来源：content/timeline-data.js（提取自 worldview_luoxiaohei_v4.db 的 timeline 表 19 条纪年事件 + character_events 角色剧情线）
// 机制：爬塔推进到新区域入口楼层（龙游/离岛/北域/老君阁/苍南会馆）时，
//   事件房优先触发「纪年回响」——重历该区域对应的历史纪年，获得小幅修炼/道心奖励。
// 与 buildRelationEvent（关系重逢）同属 dynamic 动态事件，UI 完全复用事件房。
// 楼层对应 content/dungeon-encounters.js 的 REGION_FOR_FLOOR；事件文本全部取自
// timeline-data.js 的 timelineEras / characterStorylines，不新增设定。
import {timelineEras, characterStorylines} from './timeline-data.js'

// —— 区域纪年配置：floor 为区域入口楼层（首次进入该区域的 graph y）——
// events 文本引用自 timeline-data.js（timelineEras.*.events / characterStorylines.*.events）
export const REGION_ECHOES = [
	{
		floor: 3,
		regionKey: 'longyou',
		regionName: '龙游',
		era: '电影1（约4年前）',
		note: '龙游事件 · 风息之乱与小黑拜师',
		events: [
			'小黑家园被毁，流落城市',
			'风息利用小黑后被无限追击',
			'无限收小黑为徒',
			'风息夺走小黑的灵质空间',
			'小黑与无限联手击败风息',
		],
	},
	{
		floor: 5,
		regionKey: 'lidao',
		regionName: '离岛',
		era: '电影1（约4年前）',
		note: '离岛 · 风息的老家',
		events: [
			'在离岛建立据点，拉拢反人类妖精',
			'展开领域报复人类，被小黑和无限击败',
			'自裁化作巨树，成为风息公园',
		],
	},
	{
		floor: 6,
		regionKey: 'beiyu',
		regionName: '北域',
		era: '古代',
		note: '北域 · 那伽与清凝的旧事',
		events: [
			'那伽威胁清凝，老君联合众神击败那伽',
			'清凝被送往北域三百年',
			'老君救回清凝，诈称已死，立誓百年不出君阁',
		],
	},
	{
		floor: 7,
		regionKey: 'laojunge',
		regionName: '老君阁',
		era: '古代',
		note: '蓝溪镇 · 老君与清凝的旧事',
		events: [
			'老君创立蓝溪镇，收留战争难民',
			'老君收清凝为徒',
			'老君救回清凝，诈称已死，立誓百年不出君阁',
		],
	},
	{
		floor: 9,
		regionKey: 'huiguan',
		regionName: '苍南会馆',
		era: '电影2（约2年前）',
		note: '流石事件 · 无限蒙冤与洗冤',
		events: [
			'流石会馆被人类袭击',
			'无限被诬陷软禁',
			'小黑与鹿野一起为无限洗冤',
		],
	},
]

// 楼层 → 事件 realm（与 cultivation.js realmForFloor 梯度对齐，供 UI 分档）
const ECHO_REALM_BY_FLOOR = {3: 1, 5: 2, 6: 2, 7: 3, 9: 4}

// 奖励梯度（对齐 worldview-events.js memoryRewardForRealm）
const echoRewardForRealm = (realmIndex) => {
	if (realmIndex >= 4) return {left: {cultivation: 18, daoHeart: 8}, right: {fortune: 10, maxHealth: 7}}
	if (realmIndex >= 2) return {left: {cultivation: 14, daoHeart: 6}, right: {fortune: 8, maxHealth: 5}}
	return {left: {cultivation: 10, daoHeart: 4}, right: {fortune: 6, maxHealth: 3}}
}

const echoEventId = (echo) => `e_echo_${echo.regionKey}`

/** 根据一条区域纪年配置，动态构造「纪年回响」事件 */
export function buildTimelineEcho(echo) {
	const realmIndex = ECHO_REALM_BY_FLOOR[echo.floor] ?? 1
	const reward = echoRewardForRealm(realmIndex)
	const eventList = echo.events.map((e) => `「${e}」`).join('')
	return {
		id: echoEventId(echo),
		realm: realmIndex,
		dynamic: true,
		echo: true,
		title: `纪年回响 · ${echo.regionName}`,
		description:
			`踏入${echo.regionName}，灵质空间泛起${echo.era}的纪年回响——${echo.note}。` +
			`往事如烟：${eventList}。` +
			'你驻足良久，这段历史的分量缓缓沉入你的灵识。',
		choices: {
			left: {text: '静观其变', effects: reward.left},
			right: {text: '汲取回响', effects: reward.right},
		},
	}
}

/**
 * 按楼层返回该区域入口的纪年回响事件；非入口楼层或已触发过返回 null。
 * @param {number} floor 当前楼层（graph y）
 * @param {Set|string[]} [usedEventIds] 已触发事件 id 集合，用于每局每区域只触发一次
 */
export function pickTimelineEchoForFloor(floor, usedEventIds = []) {
	const echo = REGION_ECHOES.find((r) => r.floor === floor)
	if (!echo) return null
	const id = echoEventId(echo)
	if (usedEventIds && (usedEventIds.includes ? usedEventIds.includes(id) : usedEventIds.has(id))) return null
	return buildTimelineEcho(echo)
}

/** 按事件 id（e_echo_<regionKey>）反查区域纪年配置；非回响事件返回 null */
export function echoMetaByEventId(eventId) {
	if (!eventId || !eventId.startsWith('e_echo_')) return null
	const regionKey = eventId.slice('e_echo_'.length)
	return REGION_ECHOES.find((r) => r.regionKey === regionKey) || null
}

// 汇总统计（供 verify 脚本 / 图鉴引用）
export const timelineEchoStats = {
	count: REGION_ECHOES.length,
	eras: [...new Set(REGION_ECHOES.map((r) => r.era))],
	floors: REGION_ECHOES.map((r) => r.floor),
}
