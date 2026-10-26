import {html, render, Component} from '../web_modules/htm/preact/standalone.module.js'
import App from './app.js'
import SplashScreen from './splash-screen.js'
import WinScreen from './win-screen.js'
import LoseScreen from './lose-screen.js'
import LingzhiXiuxingActivity from './lingzhi-xiuxing.js'
import {resetSessionUnlocks} from '../content/collection-progress.js'
import {loadRun} from '../game/save-system.js'
import {mountAccountBar} from './account-bar.js'
import bgm from './bgm.js'
import {disposeAnimations} from './animations.js'
import {initializeSharedProgress,flushSharedProgress,disposeSharedProgress} from '../game/shared-progress.js'

/** @enum {string} */
const GameModes = {
	splash: 'splash',
	gameplay: 'gameplay',
	win: 'win',
	loose: 'loose',
	lingzhiXiuxing: 'lingzhiXiuxing',
}

/**
 * Our root component for the game.
 * Controls what to render.
 */
class SlayTheWeb extends Component {
	constructor() {
		super()
		this.state = {
			// The game mode to start in.
			gameMode: GameModes.splash,
		}
		this.handleWin = this.handleWin.bind(this)
		this.handleNewGame = this.handleNewGame.bind(this)
		this.handleContinue = this.handleContinue.bind(this)
		this.handleLoose = this.handleLoose.bind(this)
		this.handleLingzhiXiuxing = this.handleLingzhiXiuxing.bind(this)
	}
	handleLingzhiXiuxing() {
		this.setState({gameMode: GameModes.lingzhiXiuxing})
	}
	handleNewGame(element, branch, difficulty, guild) {
		this.setState({gameMode: GameModes.gameplay, element, branch, difficulty, guild, savedState: undefined})
		// 新开局：清空"本局图鉴解锁"记录，结算界面按局展示新增
		resetSessionUnlocks()
		// Clear any previous saved game.
		window.history.pushState('', document.title, window.location.pathname)
	}
	handleContinue(element) {
		// 优先恢复 localStorage 局内存档；无则回退 URL hash 分享存档；都没有则新开一局
		const saved = loadRun()
		if (saved) {
			this.setState({gameMode: GameModes.gameplay, element, branch: saved?.player?.branch, savedState: saved})
			return
		}
		if (window.location.hash) {
			try {
				const hashState = JSON.parse(decodeURIComponent(window.location.hash.split('#')[1]))
				if (hashState && hashState.player && hashState.dungeon) {
					this.setState({gameMode: GameModes.gameplay, element, branch: hashState.player?.branch, savedState: hashState})
					return
				}
			} catch (err) {
				/* hash 存档损坏则按新局处理 */
			}
		}
		this.handleNewGame(element)
	}
	handleWin(settlement) {
		this.setState({gameMode: GameModes.win, lastSettlement: settlement})
	}
	handleLoose(settlement) {
		this.setState({gameMode: GameModes.loose, lastSettlement: settlement})
	}
	render(props, {gameMode, element, branch, difficulty, guild, savedState}) {
		if (gameMode === GameModes.splash)
			return html`<${SplashScreen}
				onNewGame=${this.handleNewGame}
				onContinue=${this.handleContinue}
				onLingzhiXiuxing=${this.handleLingzhiXiuxing}
			/>`
		if (gameMode === GameModes.gameplay)
			return html` <${App} element=${element} branch=${branch} difficulty=${difficulty} guild=${guild} savedState=${savedState} onWin=${this.handleWin} onLoose=${this.handleLoose} /> `
		if (gameMode === GameModes.win)
			return html` <${WinScreen} settlement=${this.state.lastSettlement} onNewGame=${this.handleNewGame} /> `
		if (gameMode === GameModes.loose)
			return html` <${LoseScreen} settlement=${this.state.lastSettlement} onLoose=${this.handleNewGame} /> `
		if (gameMode === GameModes.lingzhiXiuxing)
			return html` <${LingzhiXiuxingActivity} onExit=${() => this.setState({gameMode: GameModes.splash})} /> `
	}
}

const mount = document.querySelector('#SlayTheWeb')
await initializeSharedProgress()
render(html` <${SlayTheWeb} /> `, mount)
const disposeAccountBar = mountAccountBar()
let disposed = false
window.__iridescentlyDispose = () => {
	if (disposed) return
	disposed = true
	disposeAnimations(mount)
	bgm.stop()
	render(null, mount)
	disposeAccountBar()
	flushSharedProgress().then(disposeSharedProgress).catch(console.error)
}
