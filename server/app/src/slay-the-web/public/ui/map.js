import {Component, html} from '../web_modules/htm/preact/standalone.module.js'
import {random as randomBetween} from '../game/utils.js'
import {isRoomCompleted} from '../game/utils-state.js'
import {locationForFloor} from '../game/dungeon.js'
import {weatherForFloor, weatherPhaseInfo, WEATHER_ORDER, resonanceInfo} from '../content/element-mastery.js'
import {todayDaily} from '../content/daily.js'

export default function map(props) {
	const {x, y, pathTaken, locations} = props.dungeon
	// 地图 graph 共 12 行：y=0 起点（灵溪）/ y=1..10 十层主题 / y=11 最终 Boss（重生之门）。
	// 楼层地点主题只有 10 项（floor 0-9），需经 locationForFloor 将 graph y 映射到主题：
	//   y=0 → 灵溪（起点） / y=1 → 灵溪 / … / y=10 → 重生之门 / y=11 → 重生之门（最终战）。
	const currentLocation = locationForFloor(y - 1)
	// 天时相位：当前楼层五行天时（与战斗 weatherForFloor 同源，供选路预览）。
	const weatherEl = weatherForFloor(y)
	const weatherInfo = weatherEl ? weatherPhaseInfo(weatherEl) : null
	// 灵机共振：今日灵机当值五行（日期确定性，与开局应用一致）
	const dailyEl = todayDaily().element?.element || null
	const resonance = weatherEl ? resonanceInfo(weatherEl, dailyEl) : null

	return html`
		<div class="MapContainer">
			<${SlayMap} dungeon=${props.dungeon} x=${x} y=${y} onSelect=${props.onMove}><//>

			<footer class="MapFooter">
				<h2>历程</h2>
				${currentLocation
					? html`
							<p class="MapLocation">
								第 ${y} 层 · ${currentLocation.name}
								${currentLocation.desc ? html`<span class="MapLocationDesc">${currentLocation.desc}</span>` : ''}
								${currentLocation.flavor ? html`<span class="MapLocationFlavor">${currentLocation.flavor}</span>` : ''}
							</p>
						`
					: html`<p>当前位置：第 ${y} 层 · 节点 ${x}</p>`}
				${weatherInfo
					? html`
							<p class="MapWeather" data-element=${weatherEl}>
								<span class="MapWeatherBadge">天时</span>
								<span class="MapWeatherName">${weatherInfo.name}</span>
								<span class="MapWeatherFlavor">${weatherInfo.flavor}</span>
								<span class="MapWeatherHint">顺天应时：同系卡牌伤害/格挡 +1</span>
							</p>
						`
					: ''}
				${resonance?.active
					? html`
							<p class="MapWeather MapWeather--resonance" data-resonance=${resonance.element}>
								<span class="MapWeatherBadge">灵机共振</span>
								<span class="MapWeatherName">${resonance.desc}</span>
								<span class="MapWeatherHint">${resonance.element}系卡牌伤害/格挡额外 +1</span>
							</p>
						`
					: ''}
				<ul>
					${pathTaken.map((path) => html`<li>${path.y}.${path.x}</li>`)}
				</ul>
			</footer>
		</div>
	`
}

export class SlayMap extends Component {
	componentDidMount() {
		// trigger update..
		this.setState({universe: 42})
	}

	componentDidUpdate(prevProps) {
		// Let CSS know about the amount of rows and cols we have.
		this.base.style.setProperty('--rows', Number(prevProps.dungeon.graph.length))
		this.base.style.setProperty('--columns', Number(prevProps.dungeon.graph[1].length))

		// Add references to our DOM elements on the graph. Why?
		// no set state because we don't want to rerender
		if (!this.didDrawPaths) {
			this.didDrawPaths = true
			const resizeObserver = new ResizeObserver(() => {
				console.log('Drawing map')
				this.drawPaths()
			})
			resizeObserver.observe(this.base)
		}
	}

	// Draws SVG lines between the DOM nodes from the dungeon's path.
	drawPaths() {
		this.props.dungeon.paths.forEach((path, index) => {
			this.drawPath(path, index)
		})
	}

	drawPath(path, preferredIndex) {
		const containerElement = this.base
		const graph = this.props.dungeon.graph
		const debug = false

		const nodeFromMove = ([row, col]) => graph[row][col]
		// 按 slay-map-row 选择器取行节点（兼容 slay-map 内的水墨背景层等装饰元素，不依赖 childNodes 索引）
		const rows = [...containerElement.querySelectorAll(':scope > slay-map-row')]
		const elFromNode = ([row, col]) => (rows[row] ? rows[row].childNodes[col] : null)

		if (!containerElement) throw new Error('Missing container element')

		// Create an empty <svg> to hold our path. And remove previous if we are drawing agian.
		const id = `path${preferredIndex}`
		let svg = containerElement.querySelector(`svg#${id}`)
		if (svg) svg.remove()
		svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
		svg.id = id
		svg.classList.add('paths')
		containerElement.appendChild(svg)

		// For each move, add a <line> element from a to b.
		if (debug) console.groupCollapsed('drawing path', preferredIndex)
		path.forEach((move, index) => {
			const a = nodeFromMove(move[0])
			const b = nodeFromMove(move[1])
			const aEl = elFromNode(move[0])
			const bEl = elFromNode(move[1])

			if (debug) console.groupEnd()
			// Create a line between each element.
			const aPos = getPosWithin(aEl, containerElement)
			const bPos = getPosWithin(bEl, containerElement)
			if (!aPos.top) {
				throw Error(
					"Could not render the svg path. Is the graph's container element rendered/visible?"
				)
			}
			const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
			line.setAttribute('x1', String(aPos.left + aPos.width / 2))
			line.setAttribute('y1', String(aPos.top + aPos.height / 2))
			line.setAttribute('x2', String(bPos.left + bPos.width / 2))
			line.setAttribute('y2', String(bPos.top + bPos.height / 2))
			svg.appendChild(line)
			line.setAttribute('length', String(line.getTotalLength()))
			// 逐格水墨 · 笔触长度与路径序号写入 CSS 变量，供"笔墨逐段绘制"动画使用
			line.style.setProperty('--line-len', String(line.getTotalLength()))
			line.style.setProperty('--path-i', String(preferredIndex))
			aEl.setAttribute('linked', true)
			bEl.setAttribute('linked', true)
			if (debug) console.log(`Move no. ${index} is from ${a} to ${b}`)
		})
		if (debug) console.groupEnd()
	}

	render(props) {
		const {dungeon, x, y} = props

		if (!dungeon.graph) throw new Error('No graph to render. This should not happen?', dungeon)

		// 今日灵机当值五行（日期确定性，供各楼层共振标记）
		const dailyEl = todayDaily().element?.element || null

		const edgesFromCurrentNode = dungeon.graph[y][x].edges

		return html`
			<slay-map>
				<!-- 逐格水墨地图 · 背景层：远山 / 雾霭 / 飞鸟 / 墨点（纯装饰，不参与寻路与点击） -->
				<div class="MapInkScenery" aria-hidden="true">
					<svg class="MapInkMountains" viewBox="0 0 600 1200" preserveAspectRatio="xMidYMid slice">
						<path class="MapInkMtn MapInkMtn--far" d="M0,360 Q80,280 170,320 T360,280 T600,310 L600,1200 L0,1200 Z"/>
						<path class="MapInkMtn MapInkMtn--mid" d="M0,470 Q120,390 260,430 T520,390 T600,440 L600,1200 L0,1200 Z"/>
						<path class="MapInkMtn MapInkMtn--near" d="M0,610 Q140,530 300,570 T600,540 L600,1200 L0,1200 Z"/>
					</svg>
					<span class="MapInkMist MapInkMist--1"></span>
					<span class="MapInkMist MapInkMist--2"></span>
					<span class="MapInkBird MapInkBird--1"></span>
					<span class="MapInkBird MapInkBird--2"></span>
					<span class="MapInkDot MapInkDot--1"></span>
					<span class="MapInkDot MapInkDot--2"></span>
					<span class="MapInkDot MapInkDot--3"></span>
				</div>
				${dungeon.graph.map((row, rowIndex) => {
					// 每行（楼层）左侧地点轴：y=0 起点灵溪 / y=1..10 十层主题 / y=11 最终战重生之门
					const loc = locationForFloor(rowIndex - 1)
					// 每行天时相位（与战斗同步，按楼层轮转）
					const rowWeather = weatherForFloor(rowIndex)
					const rowWeatherInfo = weatherPhaseInfo(rowWeather)
					// 每行灵机共振标记：今日当值五行与行天时同向时高亮该行（data-resonance 供 CSS 提示）
					const rowResonance = rowWeather ? resonanceInfo(rowWeather, dailyEl) : null
					return html`
						<slay-map-row
							current=${rowIndex === y}
							data-loc=${loc ? loc.name : ''}
							data-weather=${rowWeather}
							data-resonance=${rowResonance?.active ? rowResonance.element : ''}
							title=${`${loc ? `${loc.name}：${loc.desc}` : loc ? loc.name : ''}${rowWeatherInfo ? `　【天时】${rowWeatherInfo.name} · ${rowWeatherInfo.flavor}` : ''}${rowResonance?.active ? `　【灵机共振】${rowResonance.desc}` : ''}`}
						>
							${row.map((node, nodeIndex) => {
								const isCurrent = rowIndex === y && nodeIndex === x
								const isConnected = edgesFromCurrentNode.has(node.id)
								const completedCurrentRoom = isRoomCompleted(dungeon.graph[y][x].room)
								const canVisit = isConnected && completedCurrentRoom
								return html`<slay-map-node
									key=${`${rowIndex}${nodeIndex}`}
									style=${`--node-i:${rowIndex}`}
									type=${Boolean(node.type)}
									node-type=${node.type}
									current=${isCurrent}
									can-visit=${Boolean(canVisit)}
									did-visit=${node.didVisit}
									data-desc=${nodeDesc(node.type)}
									onClick=${() => props.onSelect({x: nodeIndex, y: rowIndex})}
								>
									<span class="node-icon">${nodeIcon(node.type)}</span><span class="node-label">${nodeLabel(node.type)}</span>
								</slay-map-node>`
							})}
						</slay-map-row>
					`
				})}
			</slay-map>
		`
	}
}

// —— 节点类型：水墨印章字 + 中文标签 + 逐格说明（罗小黑世界观）——
const NODE_TYPE_META = {
	start: {icon: '灵', label: '起点', desc: '起点 · 灵溪'},
	M: {icon: '战', label: '战斗', desc: '战斗 · 遭遇妖兽'},
	C: {icon: '憩', label: '休整', desc: '休整 · 篝火营帐'},
	S: {icon: '市', label: '集市', desc: '集市 · 妖灵会馆补给'},
	V: {icon: '缘', label: '奇遇', desc: '奇遇 · 世界观事件'},
	E: {icon: '锐', label: '精英', desc: '精英 · 强敌拦路'},
	Z: {icon: '域', label: '灵域', desc: '灵域 · 灵质空间'},
	T: {icon: '忆', label: '剧情', desc: '剧情 · 往事重现'},
	B: {icon: '王', label: '守门', desc: '守门 · 区域首领'},
	boss: {icon: '门', label: '终局', desc: '终局 · 重生之门'},
}
function nodeIcon(type) {
	if (!type) return ''
	return (NODE_TYPE_META[type] || {icon: '?'}).icon
}
function nodeLabel(type) {
	if (!type) return ''
	return (NODE_TYPE_META[type] || {label: '未知'}).label
}
function nodeDesc(type) {
	if (!type) return ''
	return (NODE_TYPE_META[type] || {desc: '未知节点'}).desc
}

// Since el.offsetLeft doesn't respect CSS transforms,
// and getBounding.. is relative to viewport, not parent, we need this utility.
/**
 *
 * @param {HTMLElement} el
 * @param {HTMLElement} container
 * @returns {{top: number, left: number, width: number, height: number}}
 */
function getPosWithin(el, container) {
	if (!el) throw new Error('Could not find DOM node for graph row node')
	if (!container) throw new Error('missing container')
	const parent = container.getBoundingClientRect()
	const rect = el.getBoundingClientRect()
	return {
		top: rect.top - parent.top,
		left: rect.left - parent.left,
		width: rect.width,
		height: rect.height,
	}
}

// resizeObserver.unobserve(element)
