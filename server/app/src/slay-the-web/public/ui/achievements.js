// 罗小黑战记·重生之门 —— 成就面板
// 跨局成就总览：样式对齐修行面板（CultivationPanel）的 Splash / PanelSection / PanelItem 体系，
// 数据与 content/achievements.js 的跨局存档（lxz-rebirth-achievements-v1）联动。
// 入口：menu.js 的「成就」按钮（Menu → AchievementsPanel → 返回菜单）。
import {html} from '../web_modules/htm/preact/standalone.module.js'
import {ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, getAchievementState} from '../content/achievements.js'

// 达成条件 → 中文提示（仅未解锁成就展示）
const conditionText = (cond) => {
	switch (cond?.type) {
		case 'runs':
			return `累计轮回 ${cond.min} 世`
		case 'wins':
			return `累计通关 ${cond.min} 次`
		case 'soul':
			return `累计魂灵达到 ${cond.min}`
		case 'gold':
			return `单局金币达到 ${cond.min}`
		case 'collect':
			return `图鉴收集 ${cond.min} 条`
		case 'boss':
			return `击败 ${cond.names.join(' / ')}`
		case 'boss-count':
			return `跨局累计击败 ${cond.min} 个 Boss`
		case 'element-wins':
			return `以 ${cond.elements.join('、')} 五系各通关一次`
		case 'flawless':
			return `通关「重生之门」且剩余生命不低于 ${Math.round((cond.minHealthRatio || 0.5) * 100)}%`
		default:
			return ''
	}
}

export default function AchievementsPanel({onBack}) {
	const state = getAchievementState() || {unlocked: {}, elementWins: {}, totalBosses: 0}
	const unlocked = state.unlocked || {}
	const total = ACHIEVEMENTS.length
	const count = Object.keys(unlocked).length
	const groups = Object.keys(ACHIEVEMENT_CATEGORIES).map((cat) => ({
		cat,
		label: ACHIEVEMENT_CATEGORIES[cat],
		items: ACHIEVEMENTS.filter((a) => a.category === cat),
	}))

	return html`
		<div class="Splash AchievementsPanel">
			<h1 medium>成就</h1>
			<p class="PanelLine">已解锁 ${count} / ${total}</p>

			${groups.map(
				(g) => html`<section class="PanelSection">
					<h3>
						${g.label}（${g.items.filter((a) => unlocked[a.id]).length}/${g.items.length}）
					</h3>
					${g.items.map(
						(a) =>
							html`<div class="PanelItem ${unlocked[a.id] ? '' : 'Achievement-locked'}">
								<p class="PanelItemTitle">
									${a.icon} ${a.name}
									<span class="PanelMuted">
										${unlocked[a.id] ? `✓ 已解锁 · 称号「${a.rewardTitle}」` : '未解锁'}
									</span>
								</p>
								<p class="PanelLine">${a.desc}</p>
								<p class="PanelMuted">${a.rewardSoul ? `魂灵奖励 +${a.rewardSoul}` : ''}${unlocked[a.id] ? ` · 解锁于 ${new Date(unlocked[a.id].unlockedAt).toLocaleDateString()}` : ` · 达成条件：${conditionText(a.condition)}`}</p>
							</div>`
					)}
				</section>`
			)}

			<ul class="Options">
				<li><button onclick=${onBack}>返回菜单</button></li>
			</ul>
		</div>
	`
}
