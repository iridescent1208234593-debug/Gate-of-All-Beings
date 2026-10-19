// 回归验证：灵质空间抉择（makeSpiritChoice）悟得概念词条时，洞悉日志不能写进 immer 已冻结的结果
// （此前 pushLog(next, ...) 会抛 TypeError: Cannot add property N, object is not extensible）。
// 运行：node server/app/src/slay-the-web/temp_verify/verify-spirit-choice-insight.js
import {register} from 'node:module'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(__dirname, '../../../../..')
// 浏览器里 /shared/ 由门户映射到仓库根目录；Node 里用 resolve hook 做同样的映射
register(
	'data:text/javascript,' +
		encodeURIComponent(
			`export async function resolve(s,c,n){return s.startsWith('/shared/')?n(${JSON.stringify(pathToFileURL(repo).href)}+s,c):n(s,c)}`
		)
)

const load = (p) => import(pathToFileURL(path.join(__dirname, '../public', p)).href)
const actions = (await load('game/actions.js')).default
const {createTestDungeon} = await load('content/dungeon-encounters.js')
const {spiritSpacePool} = await load('content/spirit-spaces.js')
const {conceptArticles} = await load('content/articles-data.js')
const {getCollection, markMany} = await load('content/collection-progress.js')
const {getCurrRoom} = await load('game/utils-state.js')

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

// 与游戏一致：开局 → 布置地图 → 站在一间灵质空间房里（自动冻结保持默认开启）
const space = spiritSpacePool.find((s) => s.id === 'ss_awaken')
const side = 'right' // 扩张边界：生命上限 +6 · 道心 -3（不加卡、不给法宝，避免牵出其他词条）
const freshState = () => {
	const state = actions.setDungeon(actions.createNewGame('木'), createTestDungeon())
	state.dungeon.y = 1
	state.dungeon.graph[1][0].room = {type: 'spirit-space', space}
	return state
}
const summaryText = `【${space.name}】选择「${space.choices[side].text}」：道心 -3 · 生命上限 +6`

// 1) 还有未收集的概念词条：必然悟得一条，这正是线上崩溃的路径
{
	const state = freshState()
	const logBefore = state.log.length
	let next
	try {
		next = actions.makeSpiritChoice(state, {side, space})
	} catch (e) {
		check('1 悟得词条时 makeSpiritChoice 不抛错', false, `${e.name}: ${e.message}`)
	}
	if (next) {
		check('1 悟得词条时 makeSpiritChoice 不抛错', true)
		const last = next.log.at(-1)
		const insight = last?.text.match(/^灵识洞悉：悟得「(.+)」$/)?.[1]
		check('1 最后一条日志是灵识洞悉（event）', insight && last.kind === 'event', JSON.stringify(last))
		check('1 洞悉的是概念词条', conceptArticles().some((a) => a.name === insight), insight)
		check('1 词条已入图鉴', getCollection().articles.includes(insight))
		check('1 洞悉日志前一条是本次抉择摘要', next.log.at(-2)?.text === summaryText, JSON.stringify(next.log.at(-2)))
		check('1 本次只新增两条日志', next.log.length === logBefore + 2, `${logBefore} → ${next.log.length}`)
		check('1 抉择已记在房间上', getCurrRoom(next).choiceMade === side)
		check('1 效果已生效', next.player.maxHealth === state.player.maxHealth + 6 && next.player.daoHeart === state.player.daoHeart - 3)
		check('1 结果仍是冻结的不可变状态', Object.isFrozen(next) && Object.isFrozen(next.log))
		check('1 不改动传入的旧状态', state.log.length === logBefore && getCurrRoom(state).choiceMade === undefined)
	}
}

// 2) 概念词条已全部集齐：不悟得、不追加洞悉日志，行为与以前一致
{
	markMany('articles', conceptArticles().map((a) => a.name))
	const state = freshState()
	let next
	try {
		next = actions.makeSpiritChoice(state, {side, space})
		check('2 集齐后 makeSpiritChoice 不抛错', true)
	} catch (e) {
		check('2 集齐后 makeSpiritChoice 不抛错', false, `${e.name}: ${e.message}`)
	}
	if (next) {
		check('2 最后一条日志仍是抉择摘要', next.log.at(-1)?.text === summaryText, JSON.stringify(next.log.at(-1)))
		check('2 没有洞悉日志', !next.log.some((l) => l.text.startsWith('灵识洞悉')))
	}
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exitCode = fail ? 1 : 0
