// 罗小黑战记·重生之门 —— 灵偶铸造台
// 展示 content/golem-craft.js golems 表：玩家可主动消耗「生灵/物质灵」铸造灵偶，
// 铸造后本局永久生效被动加成（造物系·无中生有：以生灵塑形、以物质灵凝体）。
// 铸造校验/结算在 game/actions.js forgeGolem action 内完成（复用 craftGolem）。
import {html} from '../web_modules/htm/preact/standalone.module.js'
import {golems, ownedGolems, golemStatus} from '../content/golem-craft.js'

const PASSIVE_LABELS = {
	atkBonus: (v) => `攻击 +${v}`,
	defBonus: (v) => `格挡 +${v}`,
	hpRegen: (v) => `每回合回复 ${v} 生命`,
	fortune: (v) => `福缘 +${v}`,
	maxHealth: (v) => `最大生命 +${v}`,
	daoHeart: (v) => `道心 +${v}`,
}
const formatPassives = (passive = {}) =>
	Object.entries(passive)
		.map(([k, v]) => (PASSIVE_LABELS[k] ? PASSIVE_LABELS[k](v) : null))
		.filter(Boolean)
		.join(' · ') || '无'

const REALM_LABELS = ['凡物', '通灵', '类生', '灵生']

export default function GolemForgePanel({player, onForge, onBack}) {
	const p = player || {}
	const status = golemStatus(p)
	const ownedIds = new Set(ownedGolems(p).map((g) => g.id))

	return html`
		<div class="Splash ForgePanel">
			<h1 medium>灵偶铸造台</h1>
			<p center class="PanelMuted">
				造物系·无中生有 —— 以生灵塑形、以物质灵凝体。铸造的灵偶看似有生命，却无自我意识，只认铸造者的灵，本局永久随行助战。
			</p>
			<p center class="ForgeResources">
				生灵 ${status.shengling} · 物质灵 ${status.wuzhi} · 已铸灵偶 ${status.count} 尊
			</p>

			${golems.map((g) => {
				const owned = ownedIds.has(g.id)
				const shenglingOk = status.shengling >= g.shenglingNeed
				const wuzhiOk = status.wuzhi >= g.wuzhiNeed
				const affordable = shenglingOk && wuzhiOk
				return html`<section class="PanelSection ForgeItem ${owned ? 'ForgeItem--owned' : ''}">
					<div class="ForgeItem-head">
						<p class="PanelItemTitle">
							${g.name}
							<span class="PanelMuted">${REALM_LABELS[g.realm] || '凡物'}</span>
							${owned ? html`<span class="ForgeBadge">已铸</span>` : ''}
						</p>
						<p class="ForgeCost">
							生灵 <b class="${shenglingOk ? '' : 'ForgeCost--short'}">${g.shenglingNeed}</b>
							· 物质灵 <b class="${wuzhiOk ? '' : 'ForgeCost--short'}">${g.wuzhiNeed}</b>
						</p>
					</div>
					<p class="PanelMuted">${g.desc}</p>
					<p class="PanelLine ForgePassive">${formatPassives(g.passive)}</p>
					<p class="PanelMuted ForgeSource">${g.source}</p>
					${owned
						? html`<button disabled>已铸造 · 随行助战</button>`
						: html`<button
								disabled=${!affordable}
								onclick=${() => onForge(g.id)}
							>
								${affordable ? '铸造' : '资源不足'}
							</button>`}
				</section>`
			})}

			<ul class="Options">
				<li><button onclick=${onBack}>返回菜单</button></li>
			</ul>
		</div>
	`
}
