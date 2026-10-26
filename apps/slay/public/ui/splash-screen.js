import {html, Component} from '../web_modules/htm/preact/standalone.module.js'
import gsap from '../web_modules/gsap.js'
import {getLegacy, legacyPanel, SOUL_REALMS} from '../content/soul-legacy.js'
import {elementMasteries} from '../content/element-mastery.js'
import {abilityBranches} from '../content/ability-branches.js'
import {guildBranches} from '../content/guild-branches.js'
import {DIFFICULTIES} from '../content/difficulty.js'
import {todayDaily, formatDailyPassive} from '../content/daily.js'
import {hasRun} from '../game/save-system.js'
import {readGame,onGameChange} from '/shared/shared-session/game.js'
import {loadProgress, collectionSummary} from '../game/lingzhi-progress.js'
import {computeLingzhiBonus, lingzhiBonusLine, getLingzhiSettlement, lingzhiSettlementLine} from '../content/lingzhi-bonus.js'

export default class SplashScreen extends Component {
	constructor() {
		super()
		this.state = {element: null, branch: null, difficulty: 'normal', guild: null, showTutorial: false}
	}
	componentDidMount() {
		const refresh=()=>readGame().then(profile=>this.setState({sharedResources:profile.resources})).catch(console.error)
		refresh();this.stopSharedProgress=onGameChange(refresh)
		gsap.from('.Splash--fadein', {duration: 0.5, autoAlpha: 0, scale: 0.95})
		gsap.from('.Splash--fadein .Options', {
			delay: 0.2,
			duration: 1,
			y: -20,
			scale: 0.1,
			ease: 'bounce',
		})
		gsap.to('.Splash-spoder', {delay: 5, x: 420, y: 60, duration: 3})
	}
	componentWillUnmount(){this.stopSharedProgress?.()}
	render(props, state) {
		const legacy = getLegacy()
		const panel = legacyPanel(legacy)
		const daily = todayDaily()
		// 灵质修行状态摘要（进度本体在 lingzhi-progress；此处读取真实进度并计算联动加成）
		const lzProgress = loadProgress()
		const lzSummary = collectionSummary(lzProgress)
		const lzBonus = computeLingzhiBonus(lzProgress)
		// 灵质修行结算奖励（跨局待生效）：上一场修行结算的修为/道心/法宝，将在下一局爬塔开局承接
		const lzSettlement = getLingzhiSettlement()
		const startGame = () =>
			props.onNewGame(
				state.element || undefined,
				state.branch || undefined,
				state.difficulty || undefined,
				state.guild || undefined
			)
		return html`
			<article class="Splash Splash--fadein">
				<h1 style="margin-top:8vh">罗小黑战记·重生之门</h1>
				<h2>一场属于你和浏览器的爬塔冒险</h2>
				<p>共同旅途 · 灵质 ${state.sharedResources?.spirit??'—'} · 草药 ${state.sharedResources?.herb??'—'}　<a href="/app/modules/cards/#journey">查看同行名册与灵卡</a></p>
				<img class="Splash-spoder" src="ui/images/spoder.png" title="嘿，你好呀" />
				<div class="Splash-element">
					<p class="Splash-elementTitle">本命御灵系 · 五行共鸣（可跳过随机觉醒）</p>
					<div class="Splash-elementGrid">
						${elementMasteries.map(
							(m) => html`
								<button
									class=${`Splash-elementItem ${state.element === m.element ? 'is-selected' : ''}`}
									onClick=${() => this.setState({element: m.element})}
									title=${m.flavor}
								>
									<span class="Splash-elementSymbol">${m.element}</span>
									<span class="Splash-elementName">${m.title}</span>
									<span class="Splash-elementRole">${m.role}</span>
								</button>
							`
						)}
					</div>
					${state.element
						? html`<p class="Splash-elementHint">已选择「${state.element}」：${elementMasteries.find((m) => m.element === state.element).flavor}</p>`
						: html`<p class="Splash-elementHint">不选则随机觉醒一个五行系。</p>`}
				</div>
				<div class="Splash-element Splash-branch">
					<p class="Splash-elementTitle">灵质天赋 · 八大能力系（可跳过，无天赋偏向）</p>
					<div class="Splash-elementGrid Splash-branchGrid">
						${abilityBranches.map(
							(b) => html`
								<button
									class=${`Splash-elementItem Splash-branchItem ${state.branch === b.id ? 'is-selected' : ''}`}
									onClick=${() => this.setState({branch: state.branch === b.id ? null : b.id})}
									title=${b.flavor}
								>
									<span class="Splash-elementName">${b.name}</span>
									<span class="Splash-elementRole">${b.title}</span>
									${b.dualSkill ? html`<span class="Splash-elementDual">合技·${b.dualSkill}</span>` : ''}
								</button>
							`
						)}
					</div>
					${state.branch
						? html`<p class="Splash-elementHint">已选择「${abilityBranches.find((b) => b.id === state.branch).name}」：${abilityBranches.find((b) => b.id === state.branch).flavor}${abilityBranches.find((b) => b.id === state.branch).dualSkill ? ` 开局觉醒双系合技「${abilityBranches.find((b) => b.id === state.branch).dualSkill}」。` : ''}</p>`
						: html`<p class="Splash-elementHint">八大系天赋为灵质空间先天的偏向，选择后获得对应被动与专属开局卡；不选则无天赋。</p>`}
				</div>
				<div class="Splash-element Splash-guild">
					<p class="Splash-elementTitle">出身分馆 · 妖灵会馆七大分馆（可跳过，随机出身）</p>
					<div class="Splash-elementGrid Splash-guildGrid">
						${guildBranches.map(
							(g) => html`
								<button
									class=${`Splash-elementItem Splash-guildItem ${state.guild === g.id ? 'is-selected' : ''}`}
									onClick=${() => this.setState({guild: state.guild === g.id ? null : g.id})}
									title=${g.desc}
								>
									<span class="Splash-elementName">${g.name}</span>
									<span class="Splash-elementRole">${g.title}</span>
									<span class="Splash-elementGuildRep">${g.representative}</span>
								</button>
							`
						)}
					</div>
					${state.guild
						? html`<p class="Splash-elementHint">已选择「${guildBranches.find((g) => g.id === state.guild).name}」：${guildBranches.find((g) => g.id === state.guild).flavor}</p>`
						: html`<p class="Splash-elementHint">不选则随机出身一家分馆。出身分馆提供馆训被动，局内有机会遭遇本馆支援事件（每局一次）。</p>`}
				</div>
				<div class="Splash-element Splash-difficulty">
					<p class="Splash-elementTitle">试炼难度 · 轮回之境（默认「历练」）</p>
					<div class="Splash-elementGrid Splash-difficultyGrid">
						${DIFFICULTIES.map(
							(d) => html`
								<button
									class=${`Splash-elementItem Splash-difficultyItem ${state.difficulty === d.id ? 'is-selected' : ''}`}
									onClick=${() => this.setState({difficulty: d.id})}
									title=${d.desc}
								>
									<span class="Splash-elementSymbol">${d.icon}</span>
									<span class="Splash-elementName">${d.name}</span>
									<span class="Splash-elementRole">${d.desc}</span>
								</button>
							`
						)}
					</div>
					<p class="Splash-elementHint">难度影响敌人血量与战利品倍率：${DIFFICULTIES.map((d) => `${d.name}（血量 x${d.hpMult}${d.bossHpMult !== 1 ? ` / Boss x${d.bossHpMult}` : ''}，奖励 x${d.rewardMult}${d.startingHealthBonus ? `，开局生命 +${d.startingHealthBonus}` : ''}）`).join('；')}</p>
				</div>
				<ul class="Options">
					${location.hash || hasRun()
						? html`
							<li><button autofocus onClick=${props.onContinue}>继续游戏</button></li>
							<li><button autofocus onClick=${startGame}>新游戏</a></li>
				`
							: html`<li><button autofocus onClick=${startGame}>开始</a></li>`}
					<li><button onClick=${props.onLingzhiXiuxing}>灵质修行</button></li>
					<li><a class="Button" href="collection.html">世界观图鉴</a></li>
					<li><button onClick=${() => this.setState({showTutorial: !state.showTutorial})}>新手教程</a></li>
				</ul>
				<div class="Splash-details Article">
					<p><strong>今日灵机 · ${daily.element.name}</strong></p>
					<p>${daily.element.flavor}（${daily.dateStr}）</p>
					<p>灵机祝福「${daily.blessing.name}」—— ${formatDailyPassive(daily.blessing.passive)}</p>
					<p>${daily.blessing.desc}</p>
				</div>
				<div class="Splash-details Article">
					<p><strong>灵质修行 · 状态摘要</strong></p>
					<p>已解锁 ${lzSummary.collected}/${lzSummary.total} 条目（角色 ${lzProgress.unlockedCharacters.length} · 灵术卡 ${lzProgress.unlockedCards.length} · 遗物 ${lzProgress.unlockedRelics.length}）· 已领 ${lzBonus.claimedCount} 成就 · 残片 ${lzProgress.shards}</p>
					<p>修行 ${lzProgress.runs || 0} 次 · 通关 ${lzProgress.wins || 0} 次${lzSummary.collected >= 2 ? ` · 当前联动档位「${lzBonus.tier.name}」` : ''}</p>
					<p style="margin: 0.3rem 0 0; color: var(--game-teal-soft)">${lingzhiBonusLine({unlockedCount: lzBonus.unlockedCount, claimedCount: lzBonus.claimedCount, bonuses: lzBonus.bonuses, source: lzBonus.source})}</p>
				</div>
				${
					legacy &&
					panel &&
					html`
						<div class="Splash-details Article">
							<p><strong>魂灵传承</strong></p>
							<p>累计魂灵：${legacy.soul} · 传承「${panel.level.name}」${panel.hpBonus ? ` · 生命 +${panel.hpBonus} · 福缘 +${panel.fortuneBonus}` : ''}${legacy.lastResult ? ` · 上一世：${legacy.lastResult}（魂灵 +${legacy.lastGained}）` : ''}</p>
							<p>${panel.level.desc}</p>
							${panel.next
								? html`
									<div style="margin: 0.5rem 0 0.25rem">
										<div style="background: rgba(0,0,0,0.25); border-radius: 999px; height: 10px; overflow: hidden; max-width: 420px">
											<div style="width: ${panel.progress}%; height: 100%; background: linear-gradient(90deg, var(--qc-accent), var(--game-teal-soft)); border-radius: 999px; transition: width 0.4s"></div>
										</div>
										<p style="margin: 0.3rem 0 0; font-size: 0.85em; color: var(--game-teal-soft)">
											距下一传承「${panel.next.name}」还差 ${panel.nextNeed - legacy.soul} 魂灵（${panel.progress}%）
											${panel.nextGift ? ` · 将获得传承法宝「${panel.nextGift.name}」` : ''}
										</p>
									</div>
								`
								: html`<p style="margin: 0.3rem 0 0; color: var(--qc-gold)">已至「${panel.level.name}」圆满——轮回之上，再无所求。</p>`}
							${panel.giftTreasure ? html`<p>传承法宝：「${panel.giftTreasure.name}」—— ${panel.giftTreasure.desc}</p>` : ''}
							<p style="margin: 0.4rem 0 0.2rem; font-size: 0.85em; color: var(--qc-dim)">传承之路：${SOUL_REALMS.map((r, i) => [i > 0 ? ' → ' : '', r.name === panel.level.name ? html`<strong style="color:#f5d76e">「${r.name}」</strong>` : html`「${r.name}」`])}</p>
							<p>已轮回 ${legacy.runs || 0} 世 · 通关 ${legacy.wins || 0} 次 · 最远到达第 ${legacy.bestFloor || 0} 层</p>
						</div>
					`
				}
				${
					state.showTutorial &&
					html`
						<div class="Splash-details Article">
							<p><strong>这是在玩什么？</strong></p>
							<p>
								聚灵散灵，御灵而行——这是一场通往重生之门的卡牌冒险，考验你的规划与出牌时机。
							</p>
							<p>
								每回合从抽牌堆抽取 5 张牌。打出卡牌需要消耗能量，每回合你拥有 3 点能量。
							</p>
							<p>
								卡牌可以对怪物造成伤害、格挡敌方攻击，或让敌人陷入虚弱、易伤等状态，
								也能为自己回血或提供其他增益。多试试就明白了。
							</p>
							<p>注意，每当你结束回合，怪物就会行动。</p>
							<p>
								若你能在被击败前清空房间里的怪物，就能进入下一房间。也许会有奖励等着你。
								你能闯到终点吗？
							</p>

						</div>
					`
				}
			</article>
		`
	}
}
