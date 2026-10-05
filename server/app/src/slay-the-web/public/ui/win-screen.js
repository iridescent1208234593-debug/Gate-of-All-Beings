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
// 多结局系统：通关时展示本局轮回走向（content/endings.js）
import {unlockedEndingCount} from '../content/endings.js'

// 罗小黑战记·重生之门 —— 胜利结算界面
// 通关「重生之门」后展示：轮回真相文案 + 本局魂灵结算 + 跨世传承战绩。
// 本局魂灵结算摘要（settlement）由 app.js 结算后经 index.js 传入；
// 跨世存档由 settleRun 写入 localStorage，此处通过 getLegacy 读取渲染。

const WinScreen = (props) => {
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
	// 本局结局（settlement.ending 由 app.js 结算时判定注入）
	const ending = settlement?.ending || null
	const endingCount = unlockedEndingCount()
	return html`
		<article class="Splash Splash--fadein">
			<h1 style="margin-top:10vh">你穿过了重生之门</h1>
			<h2>聚灵与散灵的边界，在你身后缓缓合拢</h2>
			${ending &&
			html`
				<div class="Splash-details Article EndingBox">
					<p class="EndingName">轮回走向 ·「${ending.name}」<span class="EndingSub">${ending.subtitle}</span></p>
					<p>${ending.desc}</p>
					<p class="EndingCondition">判定条件：${ending.conditionDesc}</p>
					<p class="EndingMeta">已解锁结局 ${endingCount} 种（含本次）—— 换一种活法，再入轮回，去集齐不同的重生。</p>
				</div>
			`}
			<div class="Splash-details Article">
				<p>
					门灵散去，轮回的真相如潮水涌来——魂灵从未真正消散，它们只是换一种方式，等待重生。
				</p>
				<p>你的这一世，就此画上句号。可故事，才刚刚开始。</p>
			</div>
			${settlement &&
			html`
				<div class="Splash-details Article">
					<p><strong>魂灵结算</strong></p>
					<p>本世获得魂灵 +${settlement.gainedSoul}（累计 ${settlement.totalSoul}）</p>
					<p>魂灵等级：「${settlement.level.name}」—— ${settlement.level.desc}</p>
					${settlement.soulSeed ? html`<p>局内凝结魂灵种子 ${settlement.soulSeed} 颗，已随轮回折入魂灵</p>` : ''}
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
				<li><button autofocus onClick=${props.onNewGame}>再入轮回</button></li>
			</ul>
		</article>
	`
}

export default WinScreen
