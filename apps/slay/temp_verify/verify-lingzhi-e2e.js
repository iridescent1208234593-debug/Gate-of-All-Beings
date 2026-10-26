// 端到端验证：主爬塔 createNewGame 真实读取修行进度并注入「灵质共鸣」加成
// 运行：node temp_verify/verify-lingzhi-e2e.js
import {fileURLToPath, pathToFileURL} from 'node:url'
import path from 'node:path'

const mem = new Map()
globalThis.localStorage = {
	getItem: (k) => (mem.has(k) ? mem.get(k) : null),
	setItem: (k, v) => mem.set(k, String(v)),
	removeItem: (k) => mem.delete(k),
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 修行进度：level 5（bestFloor=7 → 3 + wins=5 → 1 + shards=150 → 1）
localStorage.setItem(
	'lxz-lingzhi-xiuxing-v1',
	JSON.stringify({
		shards: 150,
		bestFloor: 7,
		wins: 5,
		unlockedCharacters: ['walker', 'a', 'b'],
		unlockedCards: ['x', 'y', 'z', 'w', 'v'],
		unlockedRelics: ['r1', 'r2', 'r3'],
		claimedAchievements: {a: true, b: true, c: true},
	})
)

const actionsMod = await import(pathToFileURL(path.join(__dirname, '../public/game/actions.js')))
const actions = actionsMod.default || actionsMod

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

const state = actions.createNewGame('火')
check('E2E-1 开局注入灵石 gold=40', state.player.gold === 40, `got ${state.player.gold}`)
check('E2E-2 常驻被动 level=5', state.player.lingzhiAwakening?.level === 5, JSON.stringify(state.player.lingzhiAwakening))
check('E2E-3 meta 记录来源', state.meta?.lingzhiAwakening?.name === '灵质亲和·轮回', JSON.stringify(state.meta?.lingzhiAwakening))

// 空修行进度：无注入（兼容未修行用户）
localStorage.setItem('lxz-lingzhi-xiuxing-v1', JSON.stringify({shards: 0, bestFloor: 0, wins: 0}))
const state0 = actions.createNewGame('火')
check('E2E-4 未修行开局 gold=0 且无被动', state0.player.gold === 0 && !state0.player.lingzhiAwakening, `gold=${state0.player.gold}`)

console.log(`\n===== 结果：${pass} PASS / ${fail} FAIL =====`)
process.exit(fail ? 1 : 0)
