import {uuid, shuffle, random as randomBetween} from './utils.js'
import {StartRoom, CampfireRoom, EventRoom, SpiritSpaceRoom, ShopRoom, StoryRoom} from './dungeon-rooms.js'
import {pickWorldviewEventForRealm, pickGuildSupportEvent} from '../content/worldview-events.js'
import {pickLxzEventForRealm} from '../content/lxz-events.js'
import {pickSpiritSpaceForRealm} from '../content/spirit-spaces.js'
import {pickEpisodeForFloor} from '../content/episodes-data.js'
import {pickTimelineEchoForFloor} from '../content/timeline-echoes.js'
import {
	easyMonsters,
	monsters,
	elites,
	bosses,
	regionBossPools,
	finalBossPool,
	MONSTER_REGIONS,
	REGION_FOR_FLOOR,
} from '../content/dungeon-encounters.js'
import {pickEventForRealm, realmForFloor} from '../content/cultivation.js'
import {createShop} from '../content/shop.js'
import {locations} from '../content/worldview-data.js'

// —— 爬塔楼层地点主题（罗小黑战记·重生之门）——
// 每层对应一个世界观地点：0-8 层数据对齐 worldview-data.js 的 locations，
// 第 9 层为最终主题层「重生之门」。进度与 cultivation.js 的境界推进对齐：
// 0-1 炼气·凡尘初醒 / 2-3 筑基 / 4-5 金丹 / 6-7 元婴 / 8 化神 / 9 重生之门（Boss 层）。
const FLOOR_LOCATION_ORDER = [
	'灵溪', // 0 起点：罗小白家所在小镇，妖灵会馆分馆
	'罗家岙', // 1 炼气：罗小白老家
	'龙游', // 2 筑基：风息诞生地，龙游分会
	'风息公园', // 3 筑基：风息散灵后建立的公园
	'离岛', // 4 金丹：风息一伙据点
	'北域', // 5 金丹：那伽领地
	'老君阁', // 6 元婴：老君灵质空间
	'蓝溪镇', // 7 元婴：老君灵质空间内的人类城镇
	'苍南会馆', // 8 化神：妖灵会馆总部
	'重生之门', // 9 最终层：聚灵与散灵的边界（点题）
]

export const floorLocations = FLOOR_LOCATION_ORDER.map((name, floor) => {
	const base = locations.find((loc) => loc.name === name)
	return {
		floor,
		name,
		desc:
			base?.desc ||
			(name === '重生之门'
				? '传说中聚灵与散灵的边界。打通此门者，可窥见轮回的真相——这是「重生之门」的最后一战。'
				: ''),
		flavor:
			base?.flavor ||
			(name === '重生之门'
				? '门扉高悬于轮回之隙，聚灵与散灵的洪流在此汇聚。推开此门，便是生死边界，也是「重生」的起点——这一战，决定所有灵的去留。'
				: ''),
	}
})

// 供 UI 层读取当前层的地点主题
export const locationForFloor = (floor) =>
	floorLocations[Math.min(Math.max(floor, 0), floorLocations.length - 1)]

// 区域守门 Boss 层（graph 层 index：y=0 start，y=1..10 楼层，y=11 最终 Boss）：
//   y=5 离岛（金丹）→ 风息；y=6 北域（金丹）→ 那伽；
//   y=7 老君阁（元婴）→ 老君/玄离；y=8 蓝溪镇（元婴）→ 明王；
//   y=9 苍南会馆（化神）→ 无限/灵遥；对应 regionBossPools 各子池。
const REGION_BOSS_FLOORS = [5, 6, 7, 8, 9]

/**
 * A procedural generated dungeon map for Slay the Web. Again, heavily inspired by Slay the Spire.
 * @param {object} options
 * @param {number} options.width how many nodes on each floor
 * @param {number} options.height how many floors
 * @param {number} options.minRoom minimum amount of rooms to generate per floor
 * @param {number} options.maxRoom maximum amount of rooms to generate per floor
 * @param {string} options.roomTypes a string like "MMCE". Repeat a letter to increase the chance of it appearing. M=Monster, C=Campfire, E=Elite. For example "MMMCE" gives 60% chance of a monster, 20% chance of a campfire and 20% chance of an elite.
 * @param {string} options.customPaths The "customPaths" argument should be a string of indexes from where to draw the paths, for example "530" would draw three paths. First at index 5, then 3 and finally 0.
 * @returns {object} dungeon {id, graph, paths, x, y, pathTaken}
 */

const defaultOptions = {
	width: 10,
	height: 6,
	minRooms: 2,
	maxRooms: 5,
	roomTypes: 'MMVCEZST',
	// customPaths: '123'
}

/**
 * @typedef {object} DUNGEON
 * @param {string} id
 */

/**
 * Creates a new dungeon, complete with graph and paths.
 * @param {object} options
 * @returns {DUNGEON}
 */
export default function Dungeon(options = {}) {
	// 必须浅拷贝 defaultOptions，避免 Object.assign 把本次调用（如 guild）写回模块级默认值，
	// 否则后续不带 guild 的地牢会残留上一次的出身分馆。
	options = Object.assign({}, defaultOptions, options)

	const graph = generateGraph(options)
	const paths = generatePaths(graph, options.customPaths)

	// Add ".edges" to each node from the paths, so we know which connections it has.
	// Would be cool if this was part of "generatePaths".
	const nodeFromMove = ([floor, node]) => graph[floor][node]
	paths.forEach((path) => {
		path.forEach((move) => {
			const a = nodeFromMove(move[0])
			const b = nodeFromMove(move[1])
			// a.edges.add(b)
			a.edges.add(b.id)
		})
	})

	// Add "room" to all valid node in the graph.
	// 分馆支援事件每局最多触发一次：首个命中 e_guild_* 的事件房生成后，后续 V 节点不再传入出身分馆。
	let guildSupportSpawned = false
	// 纪年回响每局每区域仅触发一次：记录已生成的 e_echo_* 事件 id。
	const timelineEchoUsed = new Set()
	graph.forEach((floor, floorNumber) => {
		floor.map((node) => {
			if (node.type) {
				node.room = decideRoomType(node.type, floorNumber, guildSupportSpawned ? undefined : options.guild, timelineEchoUsed)
				if (node.room?.event?.id?.startsWith('e_guild_')) guildSupportSpawned = true
			}
		})
	})

	return {
		id: uuid(),
		graph,
		paths,
		x: 0,
		y: 0,
		pathTaken: [{x: 0, y: 0}],
		locations: floorLocations, // 楼层地点主题，供地图 UI 展示
	}
}

const pick = (types) => shuffle(Array.from(types))[0]

/**
 * Decide which type the node should be #balance
 * @param {string} nodeTypes - a specially formatted string
 * @param {number} floor
 * @returns {string} node type character
 */
function decideNodeType(nodeTypes, floor) {
	let types = nodeTypes
	if (floor < 2) return 'M'
	if (floor < 3) return pick('MVCZST')
	if (floor > 6) return pick('MMEECZVST') // 高层：精英为主，保留事件节点 V，使元婴/化神世界观事件可触发
	return pick(types)
}

/**
 * Decide which (random) room the node's type should be.
 * @param {string} nodeType
 * @param {number} floor
 * @param {string=} guild - 出身分馆 id（妖灵会馆分馆出身者，事件房优先触发本馆支援事件）
 * @returns {object} room
 */
function decideRoomType(nodeType, floor, guild, timelineEchoUsed /*, graph*/) {
	const pickRandomFromObj = (obj) => obj[shuffle(Object.keys(obj))[0]]
	// 楼层地点主题过滤：按当前楼层世界观地点优先抽取该区域怪物，
	// 区域池为空时回退全局池，保证任何楼层都有怪可出（content/dungeon-encounters.js MONSTER_REGIONS）。
	const pickForRegion = (pool, f) => {
		const region = REGION_FOR_FLOOR(f)
		const names = region ? MONSTER_REGIONS[region] || [] : []
		const candidates = names.filter((n) => Object.prototype.hasOwnProperty.call(pool, n))
		return candidates.length
			? pool[candidates[Math.floor(Math.random() * candidates.length)]]
			: pickRandomFromObj(pool)
	}
	const withDifficulty = (room, difficulty) => {
		// 必须浅拷贝而非原地修改：easyMonsters/monsters/elites/bosses 是模块级静态房间对象，
		// 首次对局中 immer produce 会深度冻结它们；若原地写 difficulty，
		// 玩家重开新游戏（第二次 createNewGame）时再次写入将抛
		// 「Cannot assign to read only property」直接崩溃。
		return {...room, difficulty}
	}
	if (floor === 0) return StartRoom()
	if (nodeType === 'C') return CampfireRoom()
	if (nodeType === 'S') {
		// 商店房：妖灵会馆补给站 / 集市，出售卡牌、法宝与疗伤（content/shop.js）
		return ShopRoom(createShop(floor))
	}
	if (nodeType === 'V') {
		// 纪年回响：区域入口楼层（龙游/离岛/北域/老君阁/苍南会馆）优先重历该区域
		// 历史纪年（content/timeline-echoes.js，提取自数据库 timeline 表），每局每区域仅一次。
		const timelineEcho = pickTimelineEchoForFloor(floor, timelineEchoUsed)
		if (timelineEcho) {
			timelineEchoUsed.add(timelineEcho.id)
			return EventRoom(timelineEcho)
		}
		// 事件房：出身妖灵会馆分馆者 30% 概率先触发本馆支援事件（代表角色登场，
		// 深化「会馆为御灵师后盾」；每局同馆支援事件仅一次，见 content/guild-branches.js）。
		// 其余仍为 世界观事件 / 蓝溪镇篇章剧情事件 / 修仙事件 三池混合（45% / 30% / 25%）。
		// 篇章事件按境界分布在炼气~化神（content/lxz-events.js），让玩家在爬塔途中重历蓝溪镇关键剧情。
		const realmIndex = realmForFloor(floor)
		if (guild && Math.random() < 0.3) {
			const guildEvent = pickGuildSupportEvent(guild)
			if (guildEvent) return EventRoom(guildEvent)
		}
		const roll = Math.random()
		const useWorldview = roll < 0.45
		const useLxz = !useWorldview && roll < 0.75
		const event = useWorldview
			? pickWorldviewEventForRealm(realmIndex)
			: useLxz
				? pickLxzEventForRealm(realmIndex)
				: pickEventForRealm(realmIndex)
		if (event) return EventRoom(event)
		// 兜底：依次尝试另外两池；皆空时退化为怪物房。
		const fallbackEvent = useWorldview
			? pickEventForRealm(realmIndex) || pickLxzEventForRealm(realmIndex)
			: useLxz
				? pickWorldviewEventForRealm(realmIndex) || pickEventForRealm(realmIndex)
				: pickWorldviewEventForRealm(realmIndex) || pickLxzEventForRealm(realmIndex)
		if (fallbackEvent) return EventRoom(fallbackEvent)
		return floor < 3 ? pickRandomFromObj(easyMonsters) : withDifficulty(pickForRegion(monsters, floor), 'normal')
	}
	if (nodeType === 'M' && floor < 2) return withDifficulty(pickRandomFromObj(easyMonsters), 'easy')
	if (nodeType === 'M') return withDifficulty(pickForRegion(monsters, floor), 'normal')
	if (nodeType === 'E') return withDifficulty(pickForRegion(elites, floor), 'elite')
	if (nodeType === 'Z') {
		// 灵质空间房：闯入御灵师/妖精的灵质空间（或自身空间觉醒），三选一探索。
		const space = pickSpiritSpaceForRealm(realmForFloor(floor))
		if (space) return SpiritSpaceRoom(space)
		return floor < 3 ? withDifficulty(pickRandomFromObj(easyMonsters), 'easy') : withDifficulty(pickForRegion(monsters, floor), 'normal')
	}
	if (nodeType === 'T') {
		// 剧情回想房：重历 TV 动画剧集片段（content/episodes-data.js），追忆往事获小奖励。
		const episode = pickEpisodeForFloor(floor)
		if (episode) return StoryRoom(episode)
		return floor < 3 ? withDifficulty(pickRandomFromObj(easyMonsters), 'easy') : withDifficulty(pickForRegion(monsters, floor), 'normal')
	}
	if (nodeType === 'B') {
		// 区域守门 Boss：按楼层地点主题抽取对应阶段的 Boss
		// （金丹离岛风息 / 金丹北域那伽 / 元婴老君阁老君玄离 / 元婴蓝溪镇明王 / 化神苍南会馆无限灵遥）。
		const regionIndex = REGION_BOSS_FLOORS.indexOf(floor)
		const pool = regionBossPools[regionIndex] || Object.keys(bosses)
		const key = pool[Math.floor(Math.random() * pool.length)]
		return withDifficulty(bosses[key], 'boss')
	}
	if (nodeType === 'boss') {
		// 最终 Boss 层：只从「重生之门终局池」抽取（门灵 + 高阶大能），
		// 避免早期剧情 Boss 出现在最终战，点题「重生之门」。
		const key = finalBossPool[Math.floor(Math.random() * finalBossPool.length)]
		return withDifficulty(bosses[key], 'boss')
	}
	throw new Error(`Could not match node type "${nodeType}" with a dungeon room`)
}

/**
 * Returns a "graph" array representation of the map we want to render.
 * Each nested array represents a floor with nodes.
 * All nodes have a type.
 * Nodes with type of `false` are filler nodes nededed for the layout.

	graph = [
		[startNode]
		[node, node, node],
		[node, node, node],
		[node, node, node],
		[bossNode]
	]
 * @param {object} options
 * @returns {array} - graph
 */
export function generateGraph(options = {}) {
	// 同样必须浅拷贝，避免把本次调用（customPaths/guild 等）写回模块级 defaultOptions。
	options = Object.assign({}, defaultOptions, options)
	const {height, width, minRooms, maxRooms} = options

	function Node(type) {
		return {id: uuid(), type: type || false, edges: new Set(), room: undefined}
	}

	const graph = []

	// Fill up each floor with nodes.
	for (let floorNumber = 0; floorNumber < height; floorNumber++) {
		const floor = []

		// On each floor, X amount of nodes contain an actual room
		let desiredAmountOfRooms = randomBetween(minRooms, maxRooms)
		if (desiredAmountOfRooms > width) desiredAmountOfRooms = width

		// Create the "room" nodes
		for (let i = 0; i < desiredAmountOfRooms; i++) {
			const nodeType = decideNodeType(options.roomTypes, floorNumber)
			floor.push(Node(nodeType))
		}

		// And fill it up with "empty" nodes.
		while (floor.length < width) {
			floor.push(Node(false))
		}

		// 区域 Boss 层：将该层随机一个有效节点替换为守门 Boss 节点（graph y = floorNumber + 1）。
		if (REGION_BOSS_FLOORS.includes(floorNumber + 1)) {
			const candidates = floor.filter((n) => n.type)
			if (candidates.length) {
				candidates[Math.floor(Math.random() * candidates.length)].type = 'B'
			}
		}

		// Randomize the order.
		graph.push(shuffle(floor))
	}

	// Finally, add start end end nodes, in this order.
	graph.unshift([Node('start')])
	graph.push([Node('boss')])

	return graph
}

/**
 * Returns an array of possible paths from start to finish.
 * @param {object} graph - dungeon graph
 * @param {string} customPaths - the "customPath" on the `Dungeon` function
 * @returns {array} customPaths a list of paths
 */
export function generatePaths(graph, customPaths) {
	const paths = []

	if (customPaths) {
		Array.from(customPaths).forEach((value) => {
			const path = findPath(graph, Number(value))
			paths.push(path)
		})
	} else {
		// Otherwise draw a path for each column.
		graph[1].forEach((column, index) => {
			const path = findPath(graph, index)
			paths.push(path)
		})
	}

	return paths
}

// Finds a path from start to finish in the graph.
// Pass it an index of the column you'd like the path to follow where possible.
// Returns an array of moves. Each move contains the Y/X coords of the graph.
// Starting node connects to all nodes on the first floor
// End node connects to all nodes on the last floor
// Note, it is Y/X and not X/Y.
// [
// 	[[0, 0], [1,4]], <-- first move.
// 	[[1, 4], [2,1]] <-- second move
// ]
export function findPath(graph, preferredIndex, debug = false) {
	let path = []
	let lastVisited
	if (debug) console.groupCollapsed('finding path', preferredIndex)

	// Look for a free node in the next floor to the right of the "desired index".
	const validNode = (node) => node && Boolean(node.type)

	// Walk through each floor.
	for (let [floorIndex, floor] of graph.entries()) {
		if (debug) console.group(`floor ${floorIndex}`)
		const nextFloor = graph[floorIndex + 1]
		let aIndex = preferredIndex
		let bIndex = preferredIndex

		// If on last floor, stop drawing.
		if (!nextFloor) {
			if (debug) console.log('no next floor, stopping')
			if (debug) console.groupEnd()
			break
		}

		// Find the node we came from.
		let a = lastVisited
		const newAIndex = floor.indexOf(a)
		if (a) {
			if (debug) console.log('changing a index to', newAIndex)
			aIndex = newAIndex
		} else {
			if (debug) console.log('forcing "from" to first node in floor')
			a = floor[0]
			aIndex = 0
		}
		if (!a) throw Error('missing from')

		// Find the node we are going to.
		// Search to the right of our index.
		let b
		for (let i = bIndex; i < nextFloor.length; i++) {
			if (debug) console.log('searching forwards', i)
			let node = nextFloor[i]
			if (validNode(node)) {
				if (debug) console.log('choosing', i)
				b = node
				bIndex = i
				break
			}
		}
		// No result? Search to the left instead.
		if (!b) {
			for (let i = bIndex; i >= 0; i--) {
				if (debug) console.log('searching backwards', i)
				let node = nextFloor[i]
				if (validNode(node)) {
					if (debug) console.log('choosing', i)
					b = node
					bIndex = i
					break
				}
			}
			if (!b) throw Error('missing to')
		}
		lastVisited = b

		if (debug) console.log(`connected floor ${floorIndex}:${aIndex} to ${floorIndex + 1}:${bIndex}`)
		const moveA = [floorIndex, aIndex]
		const moveB = [floorIndex + 1, bIndex]
		path.push([moveA, moveB])
		if (debug) console.groupEnd()
	}

	if (debug) console.groupEnd()
	return path
}

// For debugging purposes, logs a text representation of the map.
export function graphToString(graph) {
	graph.forEach((floor, floorNumber) => {
		let str = `${String(floorNumber).padStart(2, '0')}   `
		floor.forEach((node) => {
			if (!node.type) {
				str = str + ' '
			} else {
				str = str + node.type
			}
		})
		console.log(str)
	})
}
