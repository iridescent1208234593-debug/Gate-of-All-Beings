// 验证：灵质修行 ↔ 主爬塔 双向联动（灵质共鸣等级 A 方向 + 轮回感悟 B 方向）
// 运行：node temp_verify/verify-lingzhi-crossover.js
import {readFileSync} from 'node:fs'
import {fileURLToPath, pathToFileURL} from 'node:url'
import path from 'node:path'

// —— mock localStorage（在调用前注入；与 save-system.setStorage 思路一致）——
const mem = new Map()
globalThis.localStorage = {
	getItem: (k) => (mem.has(k) ? mem.get(k) : null),
	setItem: (k, v) => mem.set(k, String(v)),
	removeItem: (k) => mem.delete(k),
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const lb = await import(pathToFileURL(path.join(__dirname, '../public/content/lingzhi-bonus.js')))

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
	if (cond) {
		pass++
		console.log(`PASS ${name}`)
	} else {
		fail++
		console.log(`FAIL ${name} ${extra}`)
	}
}

// ===== 1. A 方向：灵质共鸣等级（修行 → 爬塔）=====
const prog = {
	shards: 150,
	bestFloor: 7,
	wins: 5,
	unlockedCharacters: ['walker', 'a', 'b'],
	unlockedCards: ['x', 'y', 'z', 'w', 'v'],
	unlockedRelics: ['r1', 'r2', 'r3'],
	claimedAchievements: {a: true, b: true, c: true},
}
check('A1 等级折算=5（7/2=3 + 5/4=1 + 150/80=1）', lb.computeLingzhiLevel(prog) === 5, `got ${lb.computeLingzhiLevel(prog)}`)
const aw = lb.computeLingzhiAwakening(prog)
check('A2 觉醒档 gold=40 atk=5 def=5', aw.gold === 40 && aw.atkBonus === 5 && aw.defBonus === 5, JSON.stringify(aw))

// applyLingzhiAwakening 依赖 loadProgress（读 localStorage）→ 先写入进度
localStorage.setItem('lxz-lingzhi-xiuxing-v1', JSON.stringify(prog))
const state = {player: {gold: 0, maxHealth: 72, currentHealth: 72, maxEnergy: 3, currentEnergy: 3}, meta: {}}
lb.applyLingzhiAwakening(state)
check('A3 开局注入初始灵石 gold=40', state.player.gold === 40, `got ${state.player.gold}`)
check('A4 常驻被动 player.lingzhiAwakening.level=5', state.player.lingzhiAwakening?.level === 5, JSON.stringify(state.player.lingzhiAwakening))
check('A5 meta 记录觉醒来源', state.meta.lingzhiAwakening?.name === '灵质亲和·轮回', JSON.stringify(state.meta.lingzhiAwakening))
check(
	'A6 被动汇总 atkBonus=5 / defBonus=5',
	lb.lingzhiAwakeningPassiveTotal(state.player, 'atkBonus') === 5 && lb.lingzhiAwakeningPassiveTotal(state.player, 'defBonus') === 5
)

// 未觉醒：空进度不注入
localStorage.setItem('lxz-lingzhi-xiuxing-v1', JSON.stringify({shards: 0, bestFloor: 0, wins: 0}))
const state0 = {player: {gold: 0}, meta: {}}
lb.applyLingzhiAwakening(state0)
check('A7 未觉醒不注入 gold/被动', state0.player.gold === 0 && !state0.player.lingzhiAwakening)

// ===== 2. B 方向：轮回感悟（爬塔 → 修行反哺）=====
const fbWin = lb.computeRunFeedback({dungeon: {y: 11}}, true) // 通关 12 层
check('B1 通关(12层) 感悟=176 → 残片1', fbWin.gainedExp === 176 && fbWin.gainedShards === 1, JSON.stringify(fbWin))
const fbLose = lb.computeRunFeedback({dungeon: {y: 4}}, false) // 败北 5 层
check('B2 败北(5层) 感悟=60 → 残片0', fbLose.gainedExp === 60 && fbLose.gainedShards === 0, JSON.stringify(fbLose))

// 反哺写入：先用旧格式进度（无 crossoverExp 字段）验证兼容性
localStorage.setItem('lxz-lingzhi-xiuxing-v1', JSON.stringify({shards: 30, bestFloor: 3, wins: 1}))
const fb = lb.feedbackLingzhiFromRun({dungeon: {y: 11}}, true)
check('B3 反哺返回值 crossoverExp=176', fb && fb.crossoverExp === 176, JSON.stringify(fb))
const saved = JSON.parse(localStorage.getItem('lxz-lingzhi-xiuxing-v1'))
check('B4 进度已持久化 crossoverExp=176', saved.crossoverExp === 176, JSON.stringify(saved))
check('B5 残片入账 30+1=31', saved.shards === 31, `got ${saved.shards}`)
check('B6 旧字段保留（存档兼容）', saved.bestFloor === 3 && saved.wins === 1)
const line = lb.lingzhiFeedbackLine(fb)
check('B7 反哺文案', line.includes('轮回感悟 +176') && line.includes('残片 +1'), line)

// 二次反哺累加
lb.feedbackLingzhiFromRun({dungeon: {y: 11}}, true)
const saved2 = JSON.parse(localStorage.getItem('lxz-lingzhi-xiuxing-v1'))
check('B8 多次结算累加 crossoverExp=352', saved2.crossoverExp === 352, `got ${saved2.crossoverExp}`)

// ===== 3. 主爬塔接线（源码断言）=====
const actionsSrc = readFileSync(path.join(__dirname, '../public/game/actions.js'), 'utf8')
check('C1 actions.js 导入 applyLingzhiAwakening', actionsSrc.includes('applyLingzhiAwakening'))
check('C2 actions.js 开局调用 applyLingzhiAwakening(state)', /applyLingzhiAwakening\(state\)/.test(actionsSrc))
const playCardAtk = actionsSrc.match(/lingzhiAwakeningPassiveTotal\(newState\.player, 'atkBonus'\)/g) || []
const playCardDef = actionsSrc.match(/lingzhiAwakeningPassiveTotal\(newState\.player, 'defBonus'\)/g) || []
check('C3 playCard 攻击加成链挂接', playCardAtk.length === 1, `got ${playCardAtk.length}`)
check('C4 playCard 格挡加成链挂接', playCardDef.length === 1, `got ${playCardDef.length}`)

const appSrc = readFileSync(path.join(__dirname, '../public/ui/app.js'), 'utf8')
check('C5 app.js 导入 feedbackLingzhiFromRun', appSrc.includes('feedbackLingzhiFromRun'))
check('C6 app.js 结算处调用反哺', appSrc.includes('this.lingzhiFeedback = feedbackLingzhiFromRun'))
check('C7 app.js 结算界面展示 lingzhiText', appSrc.includes('${lingzhiText}'))

console.log(`\n===== 结果：${pass} PASS / ${fail} FAIL =====`)
process.exit(fail ? 1 : 0)
