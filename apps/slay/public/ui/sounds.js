import * as Tone from '../web_modules/tone.js'

// 短音效引擎：用 Tone.js 合成轻量交互/战斗音效，与 bgm.js（场景音乐）互不干扰。
// 所有方法在首次调用时尝试解锁 AudioContext（浏览器自动播放策略要求用户手势后生效）。
// 说明：tone.js 在 Node 下不可运行，功能级验证通过静态结构校验完成（见 temp_verify/verify_sfx.mjs）。

// Create synths and connect it to the main output (your speakers).
const polySynth = new Tone.PolySynth(Tone.AMSynth, {volume: -36}).toDestination()
const amSynth = new Tone.AMSynth({volume: -14}).toDestination()

// 自动播放策略：每个音效方法先尝试 Tone.start()（幂等，仅首次真正启动 AudioContext）。
const unlock = () => Tone.start().catch(() => {})

function startGame() {
	unlock()
	polySynth.triggerAttackRelease(['D4', 'F4', 'A4', 'C5', 'E5'], 0.7)
}

const selectCard = () => {
	unlock()
	// initialize the noise and start
	const noise = new Tone.Noise({
		type: 'brown',
		fadeOut: 0.07,
		volume: -33,
	}).start()

	// make an autofilter to shape the noise
	const autoFilter = new Tone.AutoFilter({
		frequency: '5n',
		baseFrequency: 3000,
		octaves: 2,
	})
		.toDestination()
		.start()
	autoFilter.stop('+0.1')

	// connect the noise
	noise.connect(autoFilter)
	// start the autofilter LFO
	noise.stop('+0.04')
}

function endTurn() {
	unlock()
	// initialize the noise and start
	const noise = new Tone.Noise({
		type: 'pink',
		fadeOut: 0.2,
		volume: -28,
	}).start()

	// make an autofilter to shape the noise
	const autoFilter = new Tone.AutoFilter({
		frequency: '2n',
		baseFrequency: 200,
		octaves: 2,
	})
		.toDestination()
		.start()
	autoFilter.stop('+0.4')

	// connect the noise
	noise.connect(autoFilter)
	// start the autofilter LFO
	noise.stop('+0.2')
}

function startTurn() {
	unlock()
	/* synth.triggerAttackRelease('C4', '8n') */

	// initialize the noise and start
	const noise = new Tone.Noise({
		type: 'pink',
		fadeOut: 0.4,
		volume: -33,
	}).start()

	// make an autofilter to shape the noise
	const autoFilter = new Tone.AutoFilter({
		frequency: '2n',
		baseFrequency: 800,
		octaves: 1,
	})
		.toDestination()
		.start()
	autoFilter.stop('+0.25')

	// connect the noise
	noise.connect(autoFilter)
	// start the autofilter LFO
	noise.stop('+0.3')
}

function cardToHand() {
	unlock()
	// initialize the noise and start
	const noise = new Tone.Noise({
		type: 'pink',
		fadeOut: 0.1,
		volume: -35,
	}).start()

	// make an autofilter to shape the noise
	const autoFilter = new Tone.AutoFilter({
		frequency: '2n',
		baseFrequency: 1000,
		octaves: 1,
	})
		.toDestination()
		.start()
	autoFilter.stop('+0.08')

	// connect the noise
	noise.connect(autoFilter)
	// start the autofilter LFO
	noise.stop('+0.1')
}

function playCard({card}) {
	unlock()
	// 五行音色：金=金属高亮、木=柔和上行、水=滑音、火=短促爆发、土=低沉顿音
	const ELEM_NOTE = {金: ['C6', 'G6'], 木: ['E5', 'A5'], 水: ['G4', 'B4'], 火: ['A4', 'C6'], 土: ['D4', 'G4']}
	const notes = card && card.element ? ELEM_NOTE[card.element] : undefined
	if (notes) {
		amSynth.triggerAttackRelease(notes[0], 0.12)
		amSynth.triggerAttackRelease(notes[1], 0.15, Tone.now() + 0.06)
		return
	}
	const cardType = card.damage ? 'attack' : 'defense'
	if (cardType === 'attack') {
		playAttackCard()
	}
	if (cardType === 'defense') {
		playDefenseCard()
	}
}

const playAttackCard = () => {
	amSynth.triggerAttackRelease('G#3', 0.2)
}

const playDefenseCard = () => {
	amSynth.triggerAttackRelease('G#2', 0.02)
}

// —— 补充场景音效（2026-08-26）——
// 战斗胜利：明亮上行五声琶音（宫调）
function victory() {
	unlock()
	const now = Tone.now()
	;['C5', 'D5', 'E5', 'G5', 'A5', 'C6'].forEach((n, i) => {
		polySynth.triggerAttackRelease(n, 0.3, now + i * 0.07)
	})
}

// 败北：下行低沉（生灵散尽）
function defeat() {
	unlock()
	const now = Tone.now()
	;['E4', 'C4', 'A3', 'F3', 'D3'].forEach((n, i) => {
		amSynth.triggerAttackRelease(n, 0.5, now + i * 0.14)
	})
}

// 获得卡牌/战利品：双音点缀
function cardReward() {
	unlock()
	amSynth.triggerAttackRelease('C5', 0.15)
	amSynth.triggerAttackRelease('G5', 0.25, Tone.now() + 0.09)
}

// 商店购买：上行动机
function buyItem() {
	unlock()
	amSynth.triggerAttackRelease('G4', 0.1)
	amSynth.triggerAttackRelease('C5', 0.25, Tone.now() + 0.12)
}

// 篝火休息：温暖长音
function campfireRest() {
	unlock()
	amSynth.triggerAttackRelease('E4', 0.6)
	amSynth.triggerAttackRelease('A4', 0.9, Tone.now() + 0.18)
}

// Boss 战开场：低音警示
function bossEnter() {
	unlock()
	amSynth.triggerAttackRelease('A2', 0.8)
	amSynth.triggerAttackRelease('A2', 0.8, Tone.now() + 0.28)
	amSynth.triggerAttackRelease('C3', 1.4, Tone.now() + 0.56)
}

export default {
	startGame,
	startTurn,
	endTurn,
	selectCard,
	cardToHand,
	playCard,
	victory,
	defeat,
	cardReward,
	buyItem,
	campfireRest,
	bossEnter,
}
