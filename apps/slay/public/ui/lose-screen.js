import {html} from '../web_modules/htm/preact/standalone.module.js'
import {getLegacy, legacyLevel} from '../content/soul-legacy.js'
import {
	getSessionUnlocks,
	sessionUnlockCount,
	totalCollected,
	TYPE_LABELS,
} from '../content/collection-progress.js'
import {loadProgress, collectionSummary} from '../game/lingzhi-progress.js'
import {computeLingzhiBonus} from '../content/lingzhi-bonus.js'

// 罗小黑战记·重生之门 —— 散灵转世结算界面
// 失败（散灵）结算：与胜利结算界面（win-screen.js）对仗。
// 呼应「重生之门」主题 —— 灵质空间衰竭、生灵散尽并非终点：
// 魂灵跨局传承（soul-legacy.js），每一次散灵都是下一世重生的养料。
// 本局魂灵结算摘要（settlement）由 app.js 结算后经 index.js 传入；
// 跨世存档由 settleRun 写入 localStorage，此处通过 getLegacy 读取渲染。

const LoseScreen = (props) => {
	const legacy = getLegacy()
	const level = legacy && legacy.soul > 0 ? legacyLevel(legacy.soul) : null
	const settlement = props.settlement
	// 图鉴收录：本局新增 + 历史累计
	const sessionUnlocks = getSessionUnlocks()
	const sessionCount = sessionUnlockCount()
	const total = totalCollected()
	const unlockSummary = Object.entries(sessionUnlocks)
		.map(([t, names]) => `${TYPE_LABELS[t] || t}×${names.length}`)
		.join('、')
	// 灵质修行联动：修行进度反哺下一世开局
	const lzProgress = loadProgress()
	const lzSummary = collectionSummary(lzProgress)
	const lzBonus = computeLingzhiBonus(lzProgress)
	const hasLzBonus = lzBonus.bonuses.fortune || lzBonus.bonuses.daoHeart || lzBonus.bonuses.maxHealth || lzBonus.bonuses.extraEnergy
	const lzBonusParts = []
	if (lzBonus.bonuses.extraEnergy) lzBonusParts.push(`每回合能量 +${lzBonus.bonuses.extraEnergy}`)
	if (lzBonus.bonuses.maxHealth) lzBonusParts.push(`生命 +${lzBonus.bonuses.maxHealth}`)
	if (lzBonus.bonuses.fortune) lzBonusParts.push(`福缘 +${lzBonus.bonuses.fortune}`)
	if (lzBonus.bonuses.daoHeart) lzBonusParts.push(`道心 +${lzBonus.bonuses.daoHeart}`)
	return html`
		<article class="Splash Splash--fadein">
			<h1 style="margin-top:10vh">你散灵了</h1>
			<h2>生灵归于天地，魂灵踏入轮回</h2>
			<div class="Splash-details Article">
				<p>
					灵质空间衰竭的瞬间，你望见了聚灵的星光与散灵的长河交汇——妖精聚灵而生，散灵而亡。
					可魂灵从未真正消散，它们只是换一种方式，等待重生。
				</p>
				<p>这一世结束了。下一世，你会带着前世的魂灵归来。</p>
			</div>
			${settlement &&
			html`
				<div class="Splash-details Article">
					<p><strong>魂灵结算</strong></p>
					<p>本世获得魂灵 +${settlement.gainedSoul}（累计 ${settlement.totalSoul}）</p>
					<p>魂灵等级：「${settlement.level.name}」—— ${settlement.level.desc}</p>
					${settlement.soulSeed ? html`<p>局内凝结魂灵种子 ${settlement.soulSeed} 颗，已随散灵折入轮回</p>` : ''}
				</div>
			`}
			${legacy &&
			html`
				<div class="Splash-details Article">
					<p><strong>轮回纪事</strong></p>
					<p>
						已轮回 ${legacy.runs || 0} 世 · 通关重生之门 ${legacy.wins || 0} 次 · 最远到达第
						${legacy.bestFloor || 0} 层
					</p>
					${level ? html`<p>${level.desc}</p>` : null}
				</div>
			`}
			<div class="Splash-details Article">
				<p><strong>图鉴收录</strong></p>
				<p>
					${sessionCount
						? `本局新解锁 ${sessionCount} 项：${unlockSummary}`
						: '本局未解锁新图鉴条目'}
				</p>
				<p>
					累计收录 ${total} 项 ·
					<a href="collection.html" style="color:inherit">打开图鉴 →</a>
				</p>
			</div>
			<div class="Splash-details Article">
				<p><strong>灵质修行联动</strong></p>
				<p>修行已解锁 ${lzSummary.collected}/${lzSummary.total} 条目 · 已领 ${lzBonus.claimedCount} 成就 · 残片 ${lzProgress.shards}</p>
				${hasLzBonus
					? html`
						<p>下一世开局：${lzBonusParts.join('、')}</p>
						<p style="color: var(--game-teal-soft)">来源：${lzBonus.source} —— ${lzBonus.tier.desc}${lzBonus.achDesc ? ` ${lzBonus.achDesc}` : ''}</p>
					`
					: html`<p style="color: var(--qc-dim)">修行尚未形成联动加成——在灵质空间继续修行，解锁残片与成就，下一世将获得开局加持。</p>`}
			</div>
			<ul class="Options">
				<li><button autofocus onClick=${props.onLoose}>再入轮回</button></li>
			</ul>
		</article>
	`
}

export default LoseScreen
