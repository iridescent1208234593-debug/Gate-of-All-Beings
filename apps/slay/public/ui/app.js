// Third party dependencies
import {html, Component} from '../web_modules/htm/preact/standalone.module.js'
import gsap from './animations.js'
// @ts-ignore
import Flip from '../web_modules/gsap/Flip.js'

// Game logic
import createNewGame from '../game/new-game.js'
import {locationForFloor} from '../game/dungeon.js'
import {createCard, getCardRewards} from '../game/cards.js'
import {getCurrRoom, isCurrRoomCompleted, isDungeonCompleted} from '../game/utils-state.js'
import {saveRun, clearRun, beginRun, runIdentity} from '../game/save-system.js'
import {reportResult} from '/shared/shared-session/progress.js'
import {realms} from '../content/cultivation.js'
import {settleRun, awardSoul} from '../content/soul-legacy.js'
// 灵质修行双向联动：主爬塔结算 → 修行进度「轮回感悟」反哺（content/lingzhi-bonus.js）
import {feedbackLingzhiFromRun, lingzhiFeedbackLine} from '../content/lingzhi-bonus.js'
// 多结局系统：通关时按本局状态判定轮回走向（content/endings.js）
import {decideEnding, markEndingUnlocked} from '../content/endings.js'
import {markCollected, markMany, totalCollected, getCollection, drainCollectionToasts, TYPE_LABELS} from '../content/collection-progress.js'
import {checkAchievements} from '../content/achievements.js'
// 世界观事件角色立绘：portrait 名 → assets/characters/ 图片相对 URL（无图返回 null）
import {eventPortrait} from '../content/worldview-events.js'
// Boss 战前置文本：区域守门 Boss / 最终 Boss 的战前剧情旁白（content/boss-intros.js）
import {bossIntroFor} from '../content/boss-intros.js'
// Boss 战后文本：击败区域守门 Boss / 最终 Boss 后的战败退场语（content/boss-epilogues.js）
import {bossEpilogueFor} from '../content/boss-epilogues.js'
// 纪年回响：事件 id 反查区域纪年配置（content/timeline-echoes.js），用于回响事件房的徽记渲染
import {echoMetaByEventId} from '../content/timeline-echoes.js'
import * as backend from '../game/backend.js'

// UI Components
import Cards from './cards.js'
import Map from './map.js'
import {Overlay, OverlayWithButton} from './overlays.js'
import {Player, Monster} from './player.js'
import CardChooser from './card-chooser.js'
import CampfireRoom from './campfire.js'
import ShopRoom from './shop.js'
import Menu from './menu.js'
import StartRoom from './start-room.js'
import DungeonStats from './dungeon-stats.js'
import enableDragDrop from './dragdrop.js'
// 战斗日志面板：展示五行克制 / 天时加成 / 轮回侵蚀 / 突破 / 掉落等逐条战况记录
import BattleLog from './battle-log.js'

// 短音效：战斗/交互反馈（Tone.js 合成，见 sounds.js；音量低，不干扰 BGM）
import sfx from './sounds.js'

// 场景背景音乐：随房间/战斗/结局切换东方音景（音量低，不干扰音效；stw.bgm.setMuted(true) 可静音）
import bgm from './bgm.js'

const load = () => JSON.parse(decodeURIComponent(window.location.hash.split('#')[1]))

// 灵质天赋专属选项判定：branchChoice.branch 可为单 id 或 id 数组，匹配玩家八大系天赋即亮出专属选项
const branchChoiceActive = (bc, playerBranch) =>
	Array.isArray(bc?.branch) ? bc.branch.includes(playerBranch) : bc?.branch === playerBranch

// 由当前对局状态推断 BGM 场景：死亡→败北 / 通关→胜利 / 房间类型→对应音景
function sceneForState(state) {
	if (!state || !state.player) return 'menu'
	if (state.player.currentHealth < 1) return 'defeat'
	if (isDungeonCompleted(state)) return 'victory'
	const room = getCurrRoom(state)
	if (!room) return 'map'
	if (room.type === 'monster') {
		if (isCurrRoomCompleted(state)) return 'map'
		const diff = room.difficulty || room.monsters?.[0]?.difficulty
		if (diff === 'boss') return state.dungeon?.y >= 9 ? 'finale' : 'boss'
		if (diff === 'elite') return 'elite'
		return 'battle'
	}
	if (room.type === 'shop') return 'shop'
	if (room.type === 'campfire') return 'campfire'
	if (room.type === 'event') return 'event'
	if (room.type === 'story') return 'story'
	return 'map'
}

export default class App extends Component {
	constructor() {
		super()
		// Props
		this.base = undefined
		this.state = {collectionToasts: []}
		this.game = {}
		this.overlayIndex = 11
		this.soulSettled = false
		this.lastSettlement = null
		// 本局已击败的 Boss 名（去重，结算时供成就系统判定）
		this.defeatedBosses = []
		// 本局结算新解锁的成就（render 展示用）
		this.newAchievements = []
		// 本局已展示战前旁白的 Boss 名（去重，避免重复弹窗；随移动重置）
		this.bossIntroShownName = null
		// 场景音效防重标记：render 为纯函数多次调用，仅首次触发胜利/败北/Boss 警示音
		this.sfxFlags = {}
		// 局内"图鉴收录"即时提示浮层：轮询 collection-progress toast 队列
		this.collectionToastTimer = null
		this.collectionToastHideTimer = null
		this.lastCollectionToastAt = 0

		// Scope methods
		this.playCard = this.playCard.bind(this)
		this.handlePlayerReward = this.handlePlayerReward.bind(this)
		this.handleCampfireChoice = this.handleCampfireChoice.bind(this)
		this.handleEventChoice = this.handleEventChoice.bind(this)
		this.handleSpiritChoice = this.handleSpiritChoice.bind(this)
		this.handleBuyItem = this.handleBuyItem.bind(this)
		this.handleCollectBattleReward = this.handleCollectBattleReward.bind(this)
		this.goToNextRoom = this.goToNextRoom.bind(this)
		this.toggleOverlay = this.toggleOverlay.bind(this)
		this.handleMapMove = this.handleMapMove.bind(this)
	}
	componentDidMount() {
		// Set up a new game
		const game = createNewGame(this.props.element, this.props.branch, this.props.difficulty, this.props.guild)
		this.game = game

		// 优先恢复局内存档（localStorage，由 index.js handleContinue 传入）；
		// 其次回退 URL hash 分享存档；都没有则从新局开始。
		const resumeState = this.props.savedState
		if (resumeState && resumeState.player && resumeState.dungeon) {
			this.game.state = resumeState
			this.setState(resumeState, this.dealCards)
		} else {
			const savedGameState = window.location.hash && load()
			if (savedGameState) {
				this.game.state = savedGameState
				this.setState(savedGameState, this.dealCards)
			} else {
				this.setState(game.state, this.dealCards)
			}
		}

		// 开局落盘一次自动存档（之后每次 update 都会刷新）
		beginRun(this.game.state)
		saveRun(this.game.state)

		// 开局按当前房间播放场景 BGM（后续状态变更由 update 同步切换）
		bgm.setScene(sceneForState(this.game.state), this.game.state.dungeon?.y)

		sfx.startGame()

		// 轮询"图鉴收录"即时提示队列：markCollected 新收录 → 右下角浮层提示
		this.collectionToastTimer = setInterval(() => this.pollCollectionToasts(), 700)

		this.enableConsole()
	}
	componentWillUnmount() {
		this.disposeDragDrop?.()
		if (this.collectionToastTimer) clearInterval(this.collectionToastTimer)
		if (this.collectionToastHideTimer) clearTimeout(this.collectionToastHideTimer)
		bgm.stop()
		if (window.stw?.game === this.game) delete window.stw
	}
	// 消费收集提示队列：距上次展示 ≥1.6s 才弹出（避免战斗连收多条时闪烁），3.4s 后自动消失
	pollCollectionToasts() {
		const now = Date.now()
		if (now - this.lastCollectionToastAt < 1600) return
		const toasts = drainCollectionToasts()
		if (!toasts.length) return
		this.lastCollectionToastAt = now
		this.setState({
			collectionToasts: toasts.map((t) => `${TYPE_LABELS[t.type] || t.type}「${t.name}」`),
		})
		clearTimeout(this.collectionToastHideTimer)
		this.collectionToastHideTimer = setTimeout(() => {
			this.setState({collectionToasts: []})
		}, 3400)
	}
	enableConsole() {
		// Enable a "console" in the browser.
		console.log(`欢迎来到「罗小黑战记·重生之门」控制台。一些示例：
stw.game.state.player.maxHealth = 999; stw.update()
stw.game.enqueue({type: 'drawCards', amount: 2})
stw.update()
stw.dealCards()`)
		// @ts-ignore
		window.stw = {
			game: this.game,
			update: this.update.bind(this),
			createCard,
			dealCards: this.dealCards.bind(this),
			iddqd() {
				// console.log(this.game.state)
				this.game.enqueue({type: 'iddqd'})
				this.update(() => {
					// console.log(this.game.state)
				})
			},
			getRuns() {
				return backend.getRuns()
			},
			postRun() {
				return backend.postRun(this.game)
			},
			bgm,
		}
	}
	update(callback) {
		this.game.dequeue()
		this.setState(this.game.state, callback)
		// 每次状态变更后自动落盘局内存档（中途退出可继续冒险）
		saveRun(this.game.state)
		// 每次状态变更后同步场景 BGM（setScene 幂等，同场景不重启）
		bgm.setScene(sceneForState(this.game.state), this.game.state.dungeon?.y)
	}
	undo() {
		this.game.undo()
		this.setState(this.game.state, this.dealCards)
		saveRun(this.game.state)
		bgm.setScene(sceneForState(this.game.state), this.game.state.dungeon?.y)
	}
	/**
	 * Plays a card while juggling DOM animations and set state.
	 * @param {string} cardId
	 * @param {string} target
	 * @param {HTMLElement} cardElement
	 */
	playCard(cardId, target, cardElement) {
		// Play the card.
		const card = this.state.hand.find((c) => c.id === cardId)
		this.game.enqueue({type: 'playCard', card, target})

		const supportsFlip = typeof Flip !== 'undefined'
		let flip

		// For the hand animation later.
		if (supportsFlip) flip = Flip.getState('.Hand .Card')

		// Create a clone on top of the card to animate.
		const clone = cardElement.cloneNode(true)
		clone.dataset.slayOwner = "play-card"
		this.base.appendChild(clone)
		if (supportsFlip) Flip.fit(clone, cardElement, {absolute: true})

		// Update state and re-enable dragdrop
		this.update(() => {
			this.disposeDragDrop?.()
			this.disposeDragDrop = enableDragDrop(this.base, this.playCard)

			sfx.playCard({card, target})

			// Animate cloned card away
			gsap.effects.playCard(clone).then(() => {
				clone.remove()
			})

			// Reposition hand
			if (supportsFlip) {
				Flip.from(flip, {
					duration: 0.3,
					ease: 'power3.inOut',
					absolute: true,
				})
			}
		})
	}
	endTurn() {
		sfx.endTurn()
		gsap.effects.discardHand('.Hand .Card', {
			onComplete: reallyEndTurn.bind(this),
		})
		function reallyEndTurn() {
			this.game.enqueue({type: 'endTurn'})
			this.update(this.dealCards)
		}
	}
	// Animate the cards in and make sure any new cards are draggable.
	dealCards() {
		gsap.effects.dealCards('.Hand .Card')
		sfx.startTurn()
		this.disposeDragDrop?.()
		this.disposeDragDrop = enableDragDrop(this.base, this.playCard)
	}
	toggleOverlay(el) {
		if (typeof el === 'string') el = this.base.querySelector(el)
		el.toggleAttribute('open')
		el.style.zIndex = this.overlayIndex
		this.overlayIndex++
	}
	handleShortcuts(event) {
		const {key} = event
		const keymap = {
			e: () => this.endTurn(),
			u: () => this.undo(),
			Escape: () => {
				// let openOverlays = this.base.querySelectorAll('.Overlay:not(#Menu)[open]')
				let openOverlays = this.base.querySelectorAll(
					'#Deck[open], #DrawPile[open], #DiscardPile[open], #Map[open]'
				)
				openOverlays.forEach((el) => el.removeAttribute('open'))
				this.toggleOverlay('#Menu')
			},
			d: () => this.toggleOverlay('#Deck'),
			a: () => this.toggleOverlay('#DrawPile'),
			s: () => this.toggleOverlay('#DiscardPile'),
			m: () => this.toggleOverlay('#Map'),
			l: () => this.toggleOverlay('#BattleLog'),
		}
		keymap[key] && keymap[key]()
	}
	handlePlayerReward(choice, card) {
		this.game.enqueue({type: 'addCardToDeck', card})
		// 收集进度：获得新卡即收录
		if (card) markCollected('cards', card.name)
		this.setState({didPickCard: card})
		sfx.cardReward()
		this.update()
	}
	handleCampfireChoice(choice, reward) {
		// Depending on the choice, run an action.
		if (choice === 'rest') {
			reward = Math.floor(this.game.state.player.maxHealth * 0.3)
			this.game.enqueue({type: 'addHealth', target: 'player', amount: reward})
		}
		if (choice === 'upgradeCard') {
			this.game.enqueue({type: 'upgradeCard', card: reward})
		}
		if (choice === 'removeCard') {
			this.game.enqueue({type: 'removeCard', card: reward})
		}
		// 篝火反馈音效
		sfx.campfireRest()
		// Store the result.
		this.game.enqueue({type: 'makeCampfireChoice', choice, reward})
		// Update twice (because two actions were enqueued)
		this.update(this.update)
		this.goToNextRoom()
	}
	// 修仙事件抉择：应用一念仙途事件效果（修为/道心/福缘/生命/法宝等）
	handleEventChoice(side) {
		const room = getCurrRoom(this.state)
		const event = room.event
		this.game.enqueue({type: 'makeEventChoice', side, event})
		this.update()
	}
	// 灵质空间抉择：三选一探索，应用空间内抉择效果
	handleSpiritChoice(side) {
		const room = getCurrRoom(this.state)
		const space = room.space
		this.game.enqueue({type: 'makeSpiritChoice', side, space})
		this.update()
	}
	// 商店购买：按商品结算金币与物品（game/actions.js buyItem 内含校验）
	handleBuyItem(item) {
		// 收集进度：购入卡牌/法宝即收录
		if (item?.kind === 'card' && item.cardName) markCollected('cards', item.cardName)
		else if (item?.kind === 'treasure' && item.treasureId) markCollected('artifacts', item.treasureId)
		this.game.enqueue({type: 'buyItem', item})
		sfx.buyItem()
		this.update()
	}
	// 灵偶铸造台：消耗生灵/物质灵主动铸造灵偶（game/actions.js forgeGolem 内含校验与日志）
	handleForgeGolem(golemId) {
		this.game.enqueue({type: 'forgeGolem', golemId})
		sfx.buyItem()
		this.update()
	}
	// 战斗胜利结算：领取金币战利品（每场战斗仅可领取一次）
	handleCollectBattleReward() {
		this.game.enqueue({type: 'collectBattleReward'})
		sfx.cardReward()
		this.update()
	}
	// 剧情回想：追忆剧集往事，领取奖励并记录已看集数
	handleStoryReward() {
		this.game.enqueue({type: 'rewardStory'})
		this.update()
	}
	goToNextRoom() {
		console.log('Go to next room, toggling map')
		this.toggleOverlay('#Map')
	}
	handleMapMove(move) {
		console.log('Made a move')
		this.toggleOverlay('#Map')
		this.setState({didPickCard: false})
		// 进入新房间后重置 Boss 战前旁白展示标记（同一位 Boss 每局仅展示一次）
		this.bossIntroShownName = null
		this.game.enqueue({type: 'move', move})
		this.update(this.dealCards)
	}
	// 音乐开关：切换场景 BGM 静音，偏好持久化（bgm.js 内部写 localStorage）
	toggleMusic() {
		bgm.toggleMute()
		this.setState({})
	}
	render(props, state) {
		if (!state.player) return
		const isDead = state.player.currentHealth < 1
		const didWin = isCurrRoomCompleted(state)
		const didWinEntireGame = isDungeonCompleted(state)
		const room = getCurrRoom(state)
		const noEnergy = !state.player.currentEnergy
		// 纪年回响：事件房为回响事件（echo 标记）时，反查区域纪年配置用于差异化渲染
		const echoMeta = room && room.type === 'event' && room.event && room.event.echo ? echoMetaByEventId(room.event.id) : null
		// Boss 战前旁白：进入区域守门 Boss / 最终 Boss 房时，展示一段战前剧情旁白（场景+铺垫+出场台词）
		const isBossFight = !!room && room.type === 'monster' && !didWin && !isDead && (
			room.difficulty === 'boss' || (room.monsters || []).some((m) => m.difficulty === 'boss')
		)
		const bossMonster = isBossFight ? (room.monsters || []).find((m) => m.difficulty === 'boss' || !m.difficulty) : null
		const bossName = bossMonster ? bossMonster.name : null
		const bossIntro = bossName ? bossIntroFor(bossName) : null
		const showBossIntro = isBossFight && bossIntro && this.bossIntroShownName !== bossName
		// Boss 战后文本：胜利结算时若当前为 Boss 房，取已击败 Boss 的退场语（与战前旁白对称）
		const victoryBoss =
			!isDead && didWin && room && room.type === 'monster' &&
			(room.difficulty === 'boss' || (room.monsters || []).some((m) => m.difficulty === 'boss'))
				? (room.monsters || []).find((m) => m.difficulty === 'boss' || !m.difficulty) || null
				: null
		const bossEpilogue = victoryBoss ? bossEpilogueFor(victoryBoss.name) : null

		// —— 场景音效触发（带防重标记，render 多次调用只播一次）——
		if (isDead && !this.sfxFlags.dead) {
			this.sfxFlags.dead = true
			sfx.defeat()
		} else if (didWinEntireGame && !this.sfxFlags.winGame) {
			this.sfxFlags.winGame = true
			sfx.victory()
		} else if (!didWinEntireGame && didWin && room && room.type === 'monster' && !this.sfxFlags.winBattle) {
			this.sfxFlags.winBattle = true
			sfx.victory()
		}
		if (
			room &&
			room.type === 'monster' &&
			!didWin &&
			!isDead &&
			(room.difficulty === 'boss' || (room.monsters || []).some((m) => m.difficulty === 'boss')) &&
			!this.sfxFlags.bossIn
		) {
			this.sfxFlags.bossIn = true
			sfx.bossEnter()
		}

		// 收集进度登记：进入房间即记录遇见的世界观条目（模块内部去重，幂等安全）
		if (room) {
			if (room.type === 'monster') markMany('enemies', (room.monsters || []).map((m) => m.name))
			else if (room.type === 'event' && room.event) markCollected('events', room.event.title)
			else if (room.type === 'spirit-space' && room.space) markCollected('spaces', room.space.name)
			else if (room.type === 'story' && room.episode) markCollected('stories', `第 ${room.episode.num} 集 · ${room.episode.title}`)
		}
		if (state.dungeon) {
			const locNow = locationForFloor(state.dungeon.y)
			if (locNow) markCollected('locations', locNow.name)
		}

		// 成就系统：登记本局已击败的 Boss（去重；didWin=当前房间已通关）
		if (room && room.type === 'monster' && didWin && !isDead) {
			const isBossRoom =
				room.difficulty === 'boss' || (room.monsters || []).some((m) => m.difficulty === 'boss')
			if (isBossRoom) {
				;(room.monsters || []).forEach((m) => {
					if (m.name && !this.defeatedBosses.includes(m.name)) this.defeatedBosses.push(m.name)
				})
			}
		}

		// 魂灵传承结算：散灵或通关时结算一次（写入跨局存档，供界面展示）
		if ((isDead || didWinEntireGame) && !this.soulSettled) {
			this.soulSettled = true
			this.lastSettlement = settleRun(state, didWinEntireGame)
			// 账户积分 / 排行榜：按到达层数上榜，同一局重试不重复计分（访客不上榜）
			void reportResult('slay', {score: state.dungeon.y + 1, won: didWinEntireGame, ref: 'slay:' + runIdentity(state)})
			// 灵质修行反哺：主爬塔结算折为「轮回感悟」写入修行进度（残片/修行经验），实现爬塔 → 修行联动
			// （反哺公式与资源规则详见 content/lingzhi-bonus.js：每 100 感悟折 1 残片，单局最多 2 片）
			this.lingzhiFeedback = feedbackLingzhiFromRun(state, didWinEntireGame)
			// 多结局判定：仅通关时按本局状态决定轮回走向，并记录解锁
			if (didWinEntireGame) {
				const ending = decideEnding(state.player)
				this.lastSettlement.ending = ending
				markEndingUnlocked(ending.id)
			}
			// 成就系统：结算时检查解锁（跨局持久化，localStorage key: lxz-rebirth-achievements-v1）
			this.newAchievements = checkAchievements({
				runState: {
					won: didWinEntireGame,
					player: state.player,
					bossesDefeated: [...this.defeatedBosses],
				},
				legacy: this.lastSettlement,
				collectionCount: totalCollected(),
				collectionByType: getCollection(),
			})
			// 成就奖励：新解锁成就按 rewardSoul 发放跨局魂灵（与魂灵传承联动，可能直接提升魂灵等级）
			this.achievementSoulReward = 0
			if (this.newAchievements && this.newAchievements.length) {
				this.achievementSoulReward = this.newAchievements.reduce((s, a) => s + (a.rewardSoul || 0), 0)
				if (this.achievementSoulReward > 0) {
					const awarded = awardSoul(this.achievementSoulReward)
					if (awarded && this.lastSettlement) {
						this.lastSettlement.totalSoul = awarded.soul
						this.lastSettlement.level = awarded.level
					}
				}
			}
			// 本局已结束：清除局内存档，避免结算后仍显示"继续游戏"
			clearRun()
		}
		const soulText = this.lastSettlement
			? html`<p center class="SoulSettle">魂灵 +${this.lastSettlement.gainedSoul}（累计 ${this.lastSettlement.totalSoul}）${this.lastSettlement.soulSeed ? ` · 本局凝结魂灵种子 ${this.lastSettlement.soulSeed} 颗折入轮回` : ''} · 达到「${this.lastSettlement.level.name}」${this.lastSettlement.wins > 0 ? ` · 已通关 ${this.lastSettlement.wins} 次` : ''}</p>`
			: null
		const achievementText =
			this.newAchievements && this.newAchievements.length
				? html`<p center class="SoulSettle">成就解锁：${this.newAchievements
						.map((a) => `${a.icon} ${a.name} · 称号「${a.rewardTitle}」${a.rewardSoul ? ` · 魂灵 +${a.rewardSoul}` : ''}`)
						.join(' ｜ ')}${this.achievementSoulReward > 0 ? html`<br/><span>轮回之力垂青：魂灵 +${this.achievementSoulReward}（计入传承）</span>` : ''}</p>`
				: null
		// 灵质修行反哺展示：主爬塔结算折入的轮回感悟（残片/修行经验），见 content/lingzhi-bonus.js
		const lingzhiText = this.lingzhiFeedback
			? html`<p center class="SoulSettle">${lingzhiFeedbackLine(this.lingzhiFeedback)}</p>`
			: null

		// There's a lot here because I did not want to split into too many files.
		return html`
			<div class="App" tabindex="0" onKeyDown=${(e) => this.handleShortcuts(e)}>
				<figure class="App-background" data-room-index=${state.dungeon.y}></div>

				<button
					class="MusicToggle"
					onclick=${() => this.toggleMusic()}
					title="切换场景音乐（偏好会被记住，控制台可用 stw.bgm 精细调节）"
				>
					${bgm.isMuted() ? '音乐：关' : '音乐：开'}
				</button>

				${
					(this.state.collectionToasts || []).length &&
					html`<div class="CollectionToasts" aria-live="polite">
						${this.state.collectionToasts.map((t) => html`<div class="CollectionToast">见闻收录 · ${t}</div>`)}
					</div>`
				}

				${
					showBossIntro &&
					html`<${Overlay}>
						<div class="EventRoom BossIntro">
							<h1 center>「${bossIntro.quote}」</h1>
							<p center class="EventRoom-realm">${realms[state.player.realmIndex]?.name || ''} · 修为 ${state.player.cultivation}/100 · 道心 ${state.player.daoHeart} · 福缘 ${state.player.fortune} · 地点：${bossIntro.floor}</p>
							<p center class="BossIntro-scene">${bossIntro.scene}</p>
							<p center class="BossIntro-prelude">${bossIntro.prelude}</p>
							<p center><button onclick=${() => { this.bossIntroShownName = bossName; this.setState({}) }}>迎战</button></p>
						</div>
					<//> `
				}

				${
					room.type === 'start DISABLED' &&
					html`<${Overlay}><${StartRoom} onContinue=${this.goToNextRoom} /><//>`
				}

				${
					isDead &&
					html`<${Overlay}>
						<p center>你倒下了。</p>
						<p center class="SoulSettle">生灵散尽，魂灵归于天地……</p>
						${soulText}
						${achievementText}
						${lingzhiText}
						<${DungeonStats} state=${state}><//>
						<button onclick=${() => this.props.onLoose(this.lastSettlement)}>踏入轮回</button>
					<//> `
				}

				${
					didWinEntireGame &&
					html`<${Overlay}>
						<p center><button onclick=${() => this.props.onWin(this.lastSettlement)}>你赢了！</button></p>
						<p center class="SoulSettle">你穿过了重生之门，魂灵圆满……</p>
						${soulText}
						${achievementText}
						${lingzhiText}
						<${DungeonStats} state=${state}><//>
					<//> `
				}

				${
					!didWinEntireGame &&
					didWin &&
					room.type === 'monster' &&
					html`<${Overlay}>
						<h1 center medium>胜利！继续前进！</h1>
						${bossEpilogue
							? html`<div class="BossEpilogue">
									<p center class="BossEpilogue-quote">「${bossEpilogue.quote}」</p>
									<p center class="BossEpilogue-text">${bossEpilogue.epilogue}</p>
									<p center class="BossEpilogue-reward">战利品：${bossEpilogue.reward}</p>
								</div>`
							: ''}
						${!room.rewardCollected
							? html`
									<p center><button onclick=${() => this.handleCollectBattleReward()}>收取战利品</button></p>
							  `
							: html`<p center class="BattleReward">
									战利品：金币 +${room.goldReward || 0}${room.bossTreasureId ? html` · 法宝「${room.bossTreasureId}」已入囊中` : ''}
								</p>`}
						${!state.didPickCard
							? html`
									<p center>这是你的奖励，选一张加入卡组吧。</p>

									<${CardChooser}
										cards=${getCardRewards(3)}
										gameState=${state}
										didSelectCard=${(card) => this.handlePlayerReward('addCard', card)}
									/>
							  `
							: html`<p center>已将 <strong>${state.didPickCard.name}</strong> 加入卡组。</p>`}
						<p center><button onclick=${() => this.goToNextRoom()}>前往下一房间</button></p>
					<//> `
				}

				${
					room.type === 'campfire' &&
					html`<${Overlay}>
						<${CampfireRoom}
							gameState=${state}
							onChoose=${this.handleCampfireChoice}
							onContinue=${this.goToNextRoom}
						/>
					<//>`
				}

				${room.type === 'event' && html`<${Overlay}>
						<div class="EventRoom${echoMeta ? ' EchoRoom' : ''}">
							${eventPortrait(room.event)
								? html`<img class="EventRoom-image" src=${eventPortrait(room.event)} alt="立绘" />`
								: ''}
							${echoMeta
								? html`<p class="EchoRoom-badge">纪年回响</p>
										<p class="EchoRoom-era">${echoMeta.regionName} · ${echoMeta.era}</p>
										<p class="EchoRoom-note">${echoMeta.note}</p>`
								: ''}
							<h1 center>${room.event.title}</h1>
							<p center class="EventRoom-realm">${realms[state.player.realmIndex]?.name || ''} · 修为 ${state.player.cultivation}/100 · 道心 ${state.player.daoHeart} · 福缘 ${state.player.fortune}${state.player.treasures.length ? ` · 法宝 ${state.player.treasures.map((t) => t.name).join('、')}` : ''}</p>
							<p center>${room.event.description}</p>
							${!room.choiceMade
								? html`<div class="EventRoom-choices">
										<button onclick=${() => this.handleEventChoice('left')}>${room.event.choices.left.text}</button>
										<button onclick=${() => this.handleEventChoice('right')}>${room.event.choices.right.text}</button>
										${room.event.branchChoice && branchChoiceActive(room.event.branchChoice, state.player.branch)
											? html`<button class="EventRoom-choice EventRoom-choice--branch" onclick=${() => this.handleEventChoice('branch')}>${room.event.branchChoice.text}</button>`
											: ''}
									</div>`
								: html`<p center>你做出了选择。</p>
										<p center><button onclick=${() => this.goToNextRoom()}>继续前进</button></p>`}
						</div>
					<//>`
				}

				${room.type === 'spirit-space' && html`<${Overlay}>
						<div class="EventRoom">
							<h1 center>🌀 ${room.space.name}</h1>
							<p center class="EventRoom-realm">${realms[state.player.realmIndex]?.name || ''} · 修为 ${state.player.cultivation}/100 · 道心 ${state.player.daoHeart} · 福缘 ${state.player.fortune}${state.player.treasures.length ? ` · 法宝 ${state.player.treasures.map((t) => t.name).join('、')}` : ''}</p>
							<p center class="EventRoom-space">灵质空间 · ${room.space.theme} · 开辟者：${room.space.owner}</p>
							<p center>${room.space.desc}</p>
							${!room.choiceMade
								? html`<div class="EventRoom-choices">
										<button onclick=${() => this.handleSpiritChoice('left')}>${room.space.choices.left.text}</button>
										<button onclick=${() => this.handleSpiritChoice('center')}>${room.space.choices.center.text}</button>
										<button onclick=${() => this.handleSpiritChoice('right')}>${room.space.choices.right.text}</button>
									</div>`
								: html`<p center>你在灵质空间中做出了选择，空间微微震颤。</p>
										<p center><button onclick=${() => this.goToNextRoom()}>离开灵质空间</button></p>`}
						</div>
					<//>`
				}

				${room.type === 'story' && html`<${Overlay}>
						<div class="EventRoom StoryRoom">
							<h1 center>剧情回想 · 第 ${room.episode.num} 集「${room.episode.title}」</h1>
							<p center class="EventRoom-realm">${realms[state.player.realmIndex]?.name || ''} · 修为 ${state.player.cultivation}/100 · 道心 ${state.player.daoHeart} · 福缘 ${state.player.fortune}${state.player.treasures.length ? ` · 法宝 ${state.player.treasures.map((t) => t.name).join('、')}` : ''}</p>
							${room.episode.overview
								? html`<p center class="StoryRoom-overview">${room.episode.overview}</p>`
								: html`<p center>（这段往事的记忆已然模糊……）</p>`}
							${room.episode.cast && room.episode.cast.length
								? html`<p center class="StoryRoom-cast">登场：${room.episode.cast.join('、')}</p>`
								: ''}
							${!room.rewarded
								? html`<p center><button onclick=${() => this.handleStoryReward()}>追忆往事</button></p>`
								: html`<p center class="StoryRoom-reward">${room.reward ? `追忆所得：道心 +${room.reward.daoHeart} · 福缘 +${room.reward.fortune} · 修为 +${room.reward.cultivation}` : ''}</p>
										<p center><button onclick=${() => this.goToNextRoom()}>继续前进</button></p>`}
						</div>
					<//>`
				}

				${room.type === 'shop' && html`<${Overlay}>
						<${ShopRoom}
							shop=${room.shop}
							player=${state.player}
							onBuy=${this.handleBuyItem}
							onContinue=${this.goToNextRoom}
						/>
					<//>`
				}

				<div class="Targets Split">
					<div class="Targets-group">
						<${Player} model=${state.player} name="御灵师" />
					</div>
					<div class="Targets-group">
						${
							room.monsters &&
							room.monsters.map(
								(monster) => html`<${Monster} model=${monster} gameState=${state} name=${monster.name || '妖'} />`
							)
						}
					</div>
				</div>

				<div class="Split ${noEnergy ? 'no-energy' : ''}">
					<div class="EnergyBadge">
							<span class="tooltipped tooltipped-e tooltipped-multiline" aria-label="Cards costs energy and this badge shows how much you have left this turn. Next turn your energy is refilled.">${
								state.player.currentEnergy
							}/${state.player.maxEnergy}</span>
					</div>
					<p class="Actions">
						<button class="EndTurn" onclick=${() => this.endTurn()}>
							<u>结</u>束回合
						</button>
					</p>
				</div>

				<div class="Hand">
					<${Cards} gameState=${state} type="hand" />
				</div>

				<${OverlayWithButton} id="Menu" topleft>
					<button onClick=${() => this.toggleOverlay('#Menu')}><u>Esc</u> 关闭</button>
					<div class="Overlay-content">
							<${Menu} gameState=${state} game=${this.game} onUndo=${() => this.undo()} onForgeGolem=${(id) => this.handleForgeGolem(id)} />
					</div>
				<//>

				<${OverlayWithButton} id="Map" open=${room.type === 'start'} topright key=${1}>
					${
						room.type !== 'start' &&
						html`<button align-right onClick=${() => this.toggleOverlay('#Map')}>
							<u>M</u> 地图
						</button>`
					}
					<div class="Overlay-content">
						<${Map} dungeon=${state.dungeon} onMove=${this.handleMapMove} />
					</div>
				<//>

				<${OverlayWithButton} id="Deck" topright topright2>
					<button onClick=${() => this.toggleOverlay('#Deck')}><u>D</u> 卡组 ${state.deck.length}</button>
					<div class="Overlay-content">
						<${Cards} gameState=${state} type="deck" />
					</div>
				<//>

				<${OverlayWithButton} id="DrawPile" bottomleft>
					<button class="tooltipped tooltipped-ne" aria-label="即将按随机顺序抽到的牌" onClick=${() =>
						this.toggleOverlay('#DrawPile')}>抽<u>牌</u>堆 ${state.drawPile.length}</button>
					<div class="Overlay-content">
						<${Cards} gameState=${state} type="drawPile" />
					</div>
				<//>

				<${OverlayWithButton} id="DiscardPile" bottomright>
					<button onClick=${() =>
						this.toggleOverlay(
							'#DiscardPile'
						)} align-right class="tooltipped tooltipped-nw tooltipped-multiline" aria-label="已经打出的牌。抽牌堆抽空后，这些牌会洗回抽牌堆。">弃<u>牌</u>堆 ${
			state.discardPile.length
		}</button>
					<div class="Overlay-content">
						<${Cards} gameState=${state} type="discardPile" />
					</div>
				<//>

				<${OverlayWithButton} id="BattleLog" bottomleft2>
					<button class="tooltipped tooltipped-n tooltipped-multiline" aria-label="逐条查看五行克制、天时加成、轮回侵蚀、境界突破、战利品与事件抉择的战况记录（快捷键 L）" onClick=${() =>
						this.toggleOverlay('#BattleLog')}>战<u>记</u></button>
					<div class="Overlay-content">
						<${BattleLog} log=${state.log} />
					</div>
				<//>
		</div>
		`
	}
}
