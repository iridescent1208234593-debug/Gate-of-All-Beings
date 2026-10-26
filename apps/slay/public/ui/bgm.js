import { unifiedStorage } from '/shared/shared-session/kv.js';
const localStorage = unifiedStorage('slay');
// 场景背景音乐引擎：用 Tone.js 合成东方奇幻氛围音景，随游戏场景切换。
// 设计：每个场景 = 五声音阶琶音 loop（可配低音 drone 与长音 pad），
//       根音 / 五声序列 / 速度 / 织体密度区分氛围（灵溪晨雾→战斗→Boss→胜利/失败）。
// 与 sounds.js（短音效）互不干扰；setScene 幂等，同一场景不重复启停。
// 说明：数据与 tone.js 在 Node 下不可运行，功能级验证通过静态结构校验完成（见 temp_verify/verify_bgm.mjs）。

import * as Tone from '../web_modules/tone.js'

// —— 场景音景定义 ——
// root: 根音（东方感以 A3/D3/A2 等为基底）
// scale: 相对根音的半音序列（羽调五声 [0,3,5,7,10] / 宫调五声 [0,2,4,7,9]）
// bpm:  曲速；织体密度由 arp 节奏决定（whole/half/quarter/eighth/sixteenth）
// pad:  是否叠加长音 pad 和弦；bass: 是否叠加低音 drone
// volume: 各合成器基准音量（dB，负值越大越安静）
export const SCENES = {
	// 启动/标题：灵溪晨雾，慢速羽调琶音 + 空气感 pad
	menu: {
		root: 'A3',
		scale: [0, 3, 5, 7, 10],
		bpm: 66,
		arpStep: '8n',
		arpPattern: 'slow',
		pad: true,
		bass: false,
		volume: -34,
	},
	// 地图漫游：D 宫调，中速五声 + 低音 drone
	map: {
		root: 'D3',
		scale: [0, 2, 4, 7, 9],
		bpm: 80,
		arpStep: '8n',
		arpPattern: 'mid',
		pad: true,
		bass: true,
		volume: -33,
	},
	// 普通战斗：A 羽调低音区，紧迫感
	battle: {
		root: 'A2',
		scale: [0, 3, 5, 7, 10],
		bpm: 106,
		arpStep: '8n',
		arpPattern: 'mid',
		pad: false,
		bass: true,
		volume: -31,
	},
	// 精英战：升速加密度
	elite: {
		root: 'E2',
		scale: [0, 3, 5, 7, 10],
		bpm: 118,
		arpStep: '16n',
		arpPattern: 'fast',
		pad: false,
		bass: true,
		volume: -30,
	},
	// 区域守门 Boss：C 低音 + pad 压阵
	boss: {
		root: 'C2',
		scale: [0, 3, 5, 7, 10],
		bpm: 126,
		arpStep: '16n',
		arpPattern: 'fast',
		pad: true,
		bass: true,
		volume: -28,
	},
	// 最终 Boss「重生之门」：加入半音紧张音，最快最密
	finale: {
		root: 'C2',
		scale: [0, 1, 3, 5, 7, 10],
		bpm: 134,
		arpStep: '16n',
		arpPattern: 'fast',
		pad: true,
		bass: true,
		volume: -27,
	},
	// 商店/妖灵会馆补给站：G 宫调轻快
	shop: {
		root: 'G3',
		scale: [0, 2, 4, 7, 9],
		bpm: 94,
		arpStep: '8n',
		arpPattern: 'mid',
		pad: true,
		bass: false,
		volume: -35,
	},
	// 篝火：温暖慢速
	campfire: {
		root: 'E3',
		scale: [0, 3, 5, 7, 10],
		bpm: 58,
		arpStep: '4n',
		arpPattern: 'slow',
		pad: true,
		bass: false,
		volume: -35,
	},
	// 世界观/修仙事件：神秘感
	event: {
		root: 'F3',
		scale: [0, 2, 4, 7, 9],
		bpm: 70,
		arpStep: '4n',
		arpPattern: 'slow',
		pad: true,
		bass: false,
		volume: -36,
	},
	// 剧情回想：追忆，慢而悠远
	story: {
		root: 'D3',
		scale: [0, 3, 5, 7, 10],
		bpm: 62,
		arpStep: '4n',
		arpPattern: 'slow',
		pad: true,
		bass: false,
		volume: -36,
	},
	// 通关：明亮上行琶音
	victory: {
		root: 'C4',
		scale: [0, 2, 4, 7, 9],
		bpm: 90,
		arpStep: '8n',
		arpPattern: 'rise',
		pad: true,
		bass: false,
		volume: -32,
	},
	// 败北：低沉慢速
	defeat: {
		root: 'A2',
		scale: [0, 3, 5, 7, 10],
		bpm: 52,
		arpStep: '2n',
		arpPattern: 'slow',
		pad: false,
		bass: true,
		volume: -34,
	},
}

// —— 灵质修行活动音景 ——
// 独立活动（lingzhi-xiuxing.js），与主游戏楼层区域无关；复用同一套 Tone.js 播放架构，
// 通过 setLingzhiScene(name) 切换，不经过 floorRegion。
// 气质取自 worldview_luoxiaohei_v4.db spirit_lifecycle 的「灵质回路」概念：
//   主页/选角：空灵澄澈，像灵在空间中缓缓流转；
//   战斗：紧凑但比主游戏战斗更"回路"感（同一音列高八度行进）；
//   守门 Boss：低音压阵，加 pad 拉开纵深；
//   胜利：明亮上行；失败：低沉慢速。
export const LINGZHI_SCENES = {
	home: {
		root: 'E3',
		scale: [0, 3, 5, 7, 10],
		bpm: 62,
		arpStep: '4n',
		arpPattern: 'slow',
		pad: true,
		bass: false,
		volume: -35,
	},
	select: {
		root: 'G3',
		scale: [0, 2, 4, 7, 9],
		bpm: 76,
		arpStep: '8n',
		arpPattern: 'mid',
		pad: true,
		bass: false,
		volume: -35,
	},
	battle: {
		root: 'A3',
		scale: [0, 3, 5, 7, 10],
		bpm: 108,
		arpStep: '8n',
		arpPattern: 'mid',
		pad: false,
		bass: true,
		volume: -31,
	},
	elite: {
		root: 'E3',
		scale: [0, 3, 5, 7, 10],
		bpm: 118,
		arpStep: '16n',
		arpPattern: 'fast',
		pad: false,
		bass: true,
		volume: -30,
	},
	boss: {
		root: 'C3',
		scale: [0, 3, 5, 7, 10],
		bpm: 124,
		arpStep: '16n',
		arpPattern: 'fast',
		pad: true,
		bass: true,
		volume: -28,
	},
	victory: {
		root: 'C4',
		scale: [0, 2, 4, 7, 9],
		bpm: 90,
		arpStep: '8n',
		arpPattern: 'rise',
		pad: true,
		bass: false,
		volume: -32,
	},
	defeat: {
		root: 'A2',
		scale: [0, 3, 5, 7, 10],
		bpm: 54,
		arpStep: '4n',
		arpPattern: 'slow',
		pad: true,
		bass: false,
		volume: -35,
	},
}

// —— 区域音景基调（BGM 区域化）——
// 世界观依据：content/dungeon-encounters.js 的 REGION_FOR_FLOOR（楼层→区域），
// 区域气质取自 worldview_luoxiaohei_v4.db 的 locations/organizations：
//   龙游（风息公园一带，森林苍翠）/ 离岛（北域边缘海岛，海风萧瑟）/
//   北域（那伽领地，冰寒荒凉）/ 老君阁（蓝溪镇，上古隐居，仙气空灵）/
//   苍南会馆（妖灵会馆总部，执法威严）。
// 机制：地图漫游/战斗/精英/Boss 四类场景按当前楼层套用区域基调（字段局部覆盖），
//   其余场景（商店/篝火/事件/剧情/结算）保持通用音景；新手层与最终 Boss 层用基础场景。
// floorRegion 与 content/dungeon-encounters.js 的 REGION_FOR_FLOOR 保持一致：
//   y=1-2 新手层 / y=3-4 龙游 / y=5 离岛 / y=6 北域 / y=7-8 老君阁 / y=9 苍南会馆 / y=10 重生之门
export const REGION_MOODS = {
	longyou: {
		name: '龙游·风息公园',
		flavor: '森林苍翠，风过叶响，人妖共居的城镇在暮色中渐亮灯火。',
		map: {root: 'E3', scale: [0, 3, 5, 7, 10], bpm: 84, arpStep: '8n', arpPattern: 'mid', pad: true, bass: true, volume: -33},
		battle: {root: 'A2', scale: [0, 3, 5, 7, 10], bpm: 108, arpStep: '8n', arpPattern: 'mid', pad: false, bass: true, volume: -31},
		elite: {root: 'E2', scale: [0, 3, 5, 7, 10], bpm: 120, arpStep: '16n', arpPattern: 'fast', pad: false, bass: true, volume: -30},
		boss: {root: 'C2', scale: [0, 3, 5, 7, 10], bpm: 124, arpStep: '16n', arpPattern: 'fast', pad: true, bass: true, volume: -28},
	},
	lidao: {
		name: '离岛·黑市海风',
		flavor: '北域边缘的海岛，黑市行商往来，海风裹着咸腥与旧事。',
		map: {root: 'G3', scale: [0, 3, 5, 7, 10], bpm: 76, arpStep: '8n', arpPattern: 'mid', pad: true, bass: true, volume: -34},
		battle: {root: 'D2', scale: [0, 3, 5, 7, 10], bpm: 104, arpStep: '8n', arpPattern: 'mid', pad: false, bass: true, volume: -31},
		elite: {root: 'A2', scale: [0, 3, 5, 7, 10], bpm: 116, arpStep: '16n', arpPattern: 'fast', pad: false, bass: true, volume: -30},
		boss: {root: 'D2', scale: [0, 3, 5, 7, 10], bpm: 122, arpStep: '16n', arpPattern: 'fast', pad: true, bass: true, volume: -28},
	},
	beiyu: {
		name: '北域·冰寒领地',
		flavor: '那伽的领地，冰寒之气终年不散，三百年的对峙凝成风雪。',
		map: {root: 'A2', scale: [0, 3, 5, 7, 10], bpm: 60, arpStep: '4n', arpPattern: 'slow', pad: true, bass: true, volume: -35},
		battle: {root: 'E2', scale: [0, 3, 5, 7, 10], bpm: 112, arpStep: '8n', arpPattern: 'mid', pad: false, bass: true, volume: -31},
		elite: {root: 'B2', scale: [0, 3, 5, 7, 10], bpm: 120, arpStep: '16n', arpPattern: 'fast', pad: false, bass: true, volume: -30},
		boss: {root: 'A2', scale: [0, 3, 5, 7, 10], bpm: 126, arpStep: '16n', arpPattern: 'fast', pad: true, bass: true, volume: -28},
	},
	laojunge: {
		name: '老君阁·空灵仙居',
		flavor: '蓝溪镇相邻的上古灵质空间，老君隐居之所，试炼与货摊并存。',
		map: {root: 'A3', scale: [0, 2, 4, 7, 9], bpm: 68, arpStep: '8n', arpPattern: 'slow', pad: true, bass: false, volume: -35},
		battle: {root: 'E3', scale: [0, 2, 4, 7, 9], bpm: 100, arpStep: '8n', arpPattern: 'mid', pad: true, bass: false, volume: -31},
		elite: {root: 'A3', scale: [0, 2, 4, 7, 9], bpm: 112, arpStep: '16n', arpPattern: 'fast', pad: false, bass: false, volume: -30},
		boss: {root: 'E2', scale: [0, 2, 4, 7, 9], bpm: 122, arpStep: '16n', arpPattern: 'fast', pad: true, bass: true, volume: -28},
	},
	huiguan: {
		name: '苍南会馆·执法威严',
		flavor: '妖灵会馆总部，上古无主灵质空间改造而成，长老与执行者云集。',
		map: {root: 'D3', scale: [0, 2, 4, 7, 9], bpm: 82, arpStep: '8n', arpPattern: 'mid', pad: true, bass: true, volume: -33},
		battle: {root: 'G2', scale: [0, 2, 4, 7, 9], bpm: 110, arpStep: '8n', arpPattern: 'mid', pad: false, bass: true, volume: -31},
		elite: {root: 'D3', scale: [0, 2, 4, 7, 9], bpm: 120, arpStep: '16n', arpPattern: 'fast', pad: false, bass: true, volume: -30},
		boss: {root: 'G2', scale: [0, 2, 4, 7, 9], bpm: 128, arpStep: '16n', arpPattern: 'fast', pad: true, bass: true, volume: -28},
	},
}

// 楼层（graph y）→ 区域 key；与 content/dungeon-encounters.js 的 REGION_FOR_FLOOR 对齐
const floorRegion = (floor) => {
	const f = Number.isFinite(floor) ? Math.floor(floor) : 0
	if (f <= 2) return null
	if (f <= 4) return 'longyou'
	if (f === 5) return 'lidao'
	if (f === 6) return 'beiyu'
	if (f <= 8) return 'laojunge'
	if (f === 9) return 'huiguan'
	return null
}

// 可区域化的场景：shop/campfire/event/story/victory/defeat/finale 保持通用
const REGION_SCENE_KEYS = ['map', 'battle', 'elite', 'boss']

// 解析生效配置：基础场景 + 区域 mood 局部覆盖；无区域 mood 返回基础场景
// 灵质修行模式（lingzhiMode=true）直接取 LINGZHI_SCENES，不走楼层区域。
function resolveSceneConfig(name, floor) {
	if (lingzhiMode) return LINGZHI_SCENES[name] || null
	const base = SCENES[name]
	if (!base) return null
	const regionKey = floorRegion(floor)
	const mood = regionKey ? REGION_MOODS[regionKey] : null
	if (!mood || !REGION_SCENE_KEYS.includes(name) || !mood[name]) return base
	return {...base, ...mood[name]}
}

// 五声音阶琶音走向（相对 scale 索引）：mid 为上下行，slow 为稀疏下行，fast 为密集上下行，rise 为上行
const PATTERNS = {
	slow: [0, -1, -2, -1],
	mid: [0, 1, 2, 1, 0, -1, -2, -1],
	fast: [0, 1, 2, 3, 2, 1, 0, -1, -2, -1, 0, 1],
	rise: [0, 1, 2, 3, 4, 3, 2, 1],
}

let current = null
let currentFloor = 0
let currentKey = null
// 灵质修行活动模式：为 true 时 setLingzhiScene 生效，setScene 应被忽略
let lingzhiMode = false
let arpSynth = null
let bassSynth = null
let padSynth = null
let arpLoop = null
let bassLoop = null
let padLoop = null
let patternIdx = 0
// 静音偏好：持久化到 localStorage，刷新/重开对局后保持玩家选择
const MUTE_KEY = 'lxh_bgm_muted'
let muted = localStorage.getItem(MUTE_KEY) === '1'

// 音名 ↔ MIDI 换算（统一用 # 号，Tone.js 原生支持）
const NOTE_TO_MIDI = {C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11}
const MIDI_TO_NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// 根音（如 'A3'）加上半音偏移（可为负）转音名
function noteFor(offset) {
	const m = /^([A-G][#b]?)(-?\d)$/.exec(resolveSceneConfig(current, currentFloor).root)
	const base = NOTE_TO_MIDI[m[1]] + (Number(m[2]) + 1) * 12
	const midi = base + offset
	return MIDI_TO_NAME[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1)
}

function buildSynths() {
	if (arpSynth) return
	arpSynth = new Tone.PolySynth(Tone.Synth, {
		volume: -34,
		oscillator: {type: 'triangle'},
		envelope: {attack: 0.01, decay: 0.15, sustain: 0.25, release: 0.6},
	}).toDestination()
	bassSynth = new Tone.Synth({
		volume: -30,
		oscillator: {type: 'sine'},
		envelope: {attack: 0.02, decay: 0.3, sustain: 0.5, release: 1.2},
	}).toDestination()
	padSynth = new Tone.PolySynth(Tone.Synth, {
		volume: -40,
		oscillator: {type: 'sine'},
		envelope: {attack: 1.2, decay: 0.6, sustain: 0.5, release: 2.5},
	}).toDestination()
}

function clearLoops() {
	;[arpLoop, bassLoop, padLoop].forEach((loop) => {
		if (loop) {
			loop.dispose()
		}
	})
	arpLoop = bassLoop = padLoop = null
	if (Tone.getTransport().state === 'started') {
		Tone.getTransport().stop()
	}
}

function playArpStep() {
	if (muted || !current) return
	const s = resolveSceneConfig(current, currentFloor)
	const pattern = PATTERNS[s.arpPattern] || PATTERNS.mid
	const step = pattern[patternIdx % pattern.length]
	patternIdx++
	const scale = s.scale
	const octaveJump = Math.floor(Math.abs(step) / scale.length) * 12 * Math.sign(step || 1)
	const semis = scale[(((step % scale.length) + scale.length) % scale.length)] + octaveJump
	arpSynth.triggerAttackRelease(noteFor(semis), s.arpStep === '16n' ? '16n' : '8n')
}

function playBassStep() {
	if (muted || !current) return
	// 根音与五度交替
	const semis = patternIdx % 2 === 0 ? 0 : 7
	bassSynth.triggerAttackRelease(noteFor(semis), '2n')
}

function playPadStep() {
	if (muted || !current) return
	const s = resolveSceneConfig(current, currentFloor)
	// 三音 pad：根音、三度/四度、五度
	const scale = s.scale
	const chord = [noteFor(0), noteFor(scale[1] || 4), noteFor(scale[2] || 7)]
	padSynth.triggerAttackRelease(chord, '2n')
}

/**
 * 切换到指定场景音景（幂等：同场景+同楼层区域则忽略）。
 * @param {string} name - SCENES 的键名
 * @param {number} [floor] - 当前楼层（graph y），用于区域音景基调；缺省按基础场景
 */
export function setScene(name, floor) {
	if (!Object.prototype.hasOwnProperty.call(SCENES, name)) return
	if (lingzhiMode) return // 灵质修行活动进行中，主游戏音景让位
	const regionKey = floorRegion(floor) || 'base'
	const key = `${name}@${regionKey}`
	if (currentKey === key) return
	// 尝试解锁 AudioContext（浏览器自动播放策略；首次需要用户手势）
	Tone.start().catch(() => {})
	buildSynths()
	stop()
	current = name
	currentFloor = Number.isFinite(floor) ? floor : 0
	currentKey = key
	patternIdx = 0
	const s = resolveSceneConfig(name, currentFloor)
	Tone.getTransport().bpm.value = s.bpm
	if (s.arpStep) {
		arpLoop = new Tone.Loop(playArpStep, s.arpStep)
		arpLoop.start(0)
	}
	if (s.bass) {
		bassLoop = new Tone.Loop(playBassStep, '1n')
		bassLoop.start(0)
	}
	if (s.pad) {
		padLoop = new Tone.Loop(playPadStep, '2n')
		padLoop.start(0)
	}
	if (Tone.getTransport().state !== 'started') {
		Tone.getTransport().start()
	}
}

/** 停止并释放全部音景（回到无声状态）。 */
export function stop() {
	clearLoops()
	current = null
	currentKey = null
	lingzhiMode = false
	patternIdx = 0
}

/**
 * 切换到灵质修行活动音景（幂等：同场景则忽略）。
 * @param {string} name - LINGZHI_SCENES 的键名（home/select/battle/elite/boss/victory/defeat）
 */
export function setLingzhiScene(name) {
	if (!Object.prototype.hasOwnProperty.call(LINGZHI_SCENES, name)) return
	lingzhiMode = true
	const key = `lxz:${name}`
	if (currentKey === key) return
	// 尝试解锁 AudioContext（浏览器自动播放策略；首次需要用户手势）
	Tone.start().catch(() => {})
	buildSynths()
	stop()
	current = name
	currentFloor = 0
	currentKey = key
	lingzhiMode = true
	patternIdx = 0
	const s = LINGZHI_SCENES[name]
	Tone.getTransport().bpm.value = s.bpm
	if (s.arpStep) {
		arpLoop = new Tone.Loop(playArpStep, s.arpStep)
		arpLoop.start(0)
	}
	if (s.bass) {
		bassLoop = new Tone.Loop(playBassStep, '1n')
		bassLoop.start(0)
	}
	if (s.pad) {
		padLoop = new Tone.Loop(playPadStep, '2n')
		padLoop.start(0)
	}
	if (Tone.getTransport().state !== 'started') {
		Tone.getTransport().start()
	}
}

/** 静音/恢复（不停止 transport，快速开关）。偏好写入 localStorage 持久化。 */
export function setMuted(on) {
	muted = Boolean(on)
	try {
		localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
	} catch (e) {
		/* localStorage 不可用时静音仅对本次会话生效 */
	}
}

/** 切换静音状态并返回新状态。 */
export function toggleMute() {
	setMuted(!muted)
	return muted
}

export function isMuted() {
	return muted
}

/** 当前场景名。 */
export function getScene() {
	return current
}

export default {
	SCENES,
	REGION_MOODS,
	LINGZHI_SCENES,
	setScene,
	setLingzhiScene,
	stop,
	setMuted,
	toggleMute,
	isMuted,
	getScene,
}
