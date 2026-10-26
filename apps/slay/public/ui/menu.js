import {html, useState} from '../web_modules/htm/preact/standalone.module.js'
import History from './history.js'
import AchievementsPanel from './achievements.js'
import GolemForgePanel from './golem-forge.js'
import {getLegacy, legacyLevel} from '../content/soul-legacy.js'
import {currentCollectionBonus} from '../content/collection-bonus.js'
import {locationForFloor} from '../game/dungeon.js'
import {elementMasteryByElement} from '../content/element-mastery.js'
import {formatDailyPassive} from '../content/daily.js'
import {abilityBranchById, branchPassiveTotal} from '../content/ability-branches.js'

const save = (state) => (window.location.hash = encodeURIComponent(JSON.stringify(state)))
const abandonGame = () => (window.location = window.location.origin)

// —— 被动加成 → 中文文案（键与法宝/羁绊/本命被动对齐）——
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
		.join('、') || '无'

const sumPassive = (list, key) => (list || []).reduce((s, x) => s + (x.passive?.[key] || 0), 0)

const TREASURE_TYPE_LABEL = {weapon: '武器', armor: '护甲', accessory: '饰品'}

// 修行面板：本命御灵 / 境界修为 / 法宝 / 羁绊 / 魂灵传承 / 当前地点 明细
function CultivationPanel({gameState, onBack}) {
	const player = gameState?.player || {}
	const dungeon = gameState?.dungeon
	const loc = dungeon ? locationForFloor(dungeon.y) : null
	const mastery = player.element ? elementMasteryByElement(player.element) : null
	const branch = player.branch ? abilityBranchById(player.branch) : null
	const treasuresList = player.treasures || []
	const bondsList = player.bonds || []
	const legacy = player.soulLegacy

	const atk =
		sumPassive(treasuresList, 'atkBonus') +
		sumPassive(bondsList, 'atkBonus') +
		branchPassiveTotal(player, 'atkBonus') +
		(mastery?.passive?.atkBonus || 0) +
		(player.daily?.passive?.atkBonus || 0)
	const def =
		sumPassive(treasuresList, 'defBonus') +
		sumPassive(bondsList, 'defBonus') +
		branchPassiveTotal(player, 'defBonus') +
		(mastery?.passive?.defBonus || 0) +
		(player.daily?.passive?.defBonus || 0)
	const hpRegen =
		sumPassive(treasuresList, 'hpRegen') +
		sumPassive(bondsList, 'hpRegen') +
		branchPassiveTotal(player, 'hpRegen') +
		(mastery?.passive?.hpRegen || 0) +
		(player.daily?.passive?.hpRegen || 0)

	return html`
		<div class="Splash CultivationPanel">
			<h1 medium>修行面板</h1>

			${loc &&
			html`<p class="PanelLine PanelLoc">
				当前地点 · ${loc.name}${loc.desc ? ` —— ${loc.desc}` : ''}
			</p>
			${loc?.flavor ? html`<p class="PanelMuted">${loc.flavor}</p>` : ''}`}

			${mastery &&
			html`<section class="PanelSection">
				<h3>本命御灵 · ${mastery.title}</h3>
				<p class="PanelMuted">${mastery.role}</p>
				<p class="PanelMuted">${mastery.flavor}</p>
				<p class="PanelLine">本命被动：${formatPassives(mastery.passive)}</p>
			</section>`}

			${branch &&
			html`<section class="PanelSection">
				<h3>灵质天赋 · ${branch.name}</h3>
				<p class="PanelMuted">${branch.title} · 代表：${branch.representative}</p>
				<p class="PanelMuted">${branch.flavor}</p>
				<p class="PanelLine">天赋被动：${formatPassives(branch.passive)}</p>
				${branch.dualSkill
					? html`<p class="PanelLine">双系合技：开局觉醒「${branch.dualSkill}」卡</p>`
					: ''}
			</section>`}
			${!branch && player.branch === undefined &&
			html`<section class="PanelSection">
				<h3>灵质天赋</h3>
				<p class="PanelMuted">旧存档未觉醒灵质天赋。新开局时可选八大能力系天赋，获得天赋被动与专属卡牌。</p>
			</section>`}

			<section class="PanelSection">
				<h3>修行</h3>
				<p class="PanelLine">${player.realmName || '炼气期'} · 修为 ${player.cultivation || 0}/100</p>
				<p class="PanelLine">
					生命 ${player.currentHealth}/${player.maxHealth} · 道心 ${player.daoHeart || 0} · 福缘 ${player.fortune || 0} · 金币 ${player.gold || 0}
				</p>
				${player.soulSeed
					? html`<p class="PanelLine">魂灵种子 ${player.soulSeed}（散灵时折入轮回 · 每颗折算 +8 魂灵）</p>`
					: ''}
				${player.cyclePressure
					? html`<p class="PanelLine">轮回压迫 ${player.cyclePressure}</p>`
					: ''}
				<p class="PanelLine">
					战斗加成合计：${atk ? `攻击 +${atk}` : '攻击 +0'}${def ? ` · 格挡 +${def}` : ' · 格挡 +0'}${hpRegen ? ` · 每回合回复 ${hpRegen} 生命` : ''}
				</p>
			</section>

			${player.daily?.blessingId
				? html`<section class="PanelSection">
					<h3>今日灵机 · ${player.daily.elementName}</h3>
					<p class="PanelLine">祝福「${player.daily.name}」—— ${formatDailyPassive(player.daily.passive)}</p>
					${player.daily.desc ? html`<p class="PanelMuted">${player.daily.desc}</p>` : ''}
					${player.daily.elementFlavor ? html`<p class="PanelMuted">${player.daily.elementFlavor}</p>` : ''}
				</section>`
				: ''}

			<section class="PanelSection">
				<h3>法宝（${treasuresList.length}）</h3>
				${treasuresList.length
					? treasuresList.map(
							(t) => html`<div class="PanelItem">
								<p class="PanelItemTitle">${t.name} <span class="PanelMuted">${TREASURE_TYPE_LABEL[t.type] || ''}</span></p>
								<p class="PanelLine">${formatPassives(t.passive)}</p>
								${t.desc ? html`<p class="PanelMuted">${t.desc}</p>` : ''}
							</div>`
					  )
					: html`<p class="PanelMuted">尚无法宝。闯荡秘境、探访灵质空间，机缘自会降临。</p>`}
			</section>

			<section class="PanelSection">
				<h3>羁绊（${bondsList.length}）</h3>
				${bondsList.length
					? bondsList.map(
							(b) => html`<div class="PanelItem">
								<p class="PanelItemTitle">${b.name} <span class="PanelMuted">${b.partner} · ${b.type}</span></p>
								<p class="PanelLine">${formatPassives(b.passive)}</p>
								${b.desc ? html`<p class="PanelMuted">${b.desc}</p>` : ''}
							</div>`
					  )
					: html`<p class="PanelMuted">尚未结缘。遇见有缘之人时，记得回应他们的心意。</p>`}
			</section>

			${legacy &&
			html`<section class="PanelSection">
				<h3>魂灵传承</h3>
				<p class="PanelLine">传承「${legacy.levelName}」· 魂灵 ${legacy.soul}（生命 +${legacy.hpBonus} · 福缘 +${legacy.fortuneBonus}）</p>
			</section>`}

			${(() => {
				const bonus = currentCollectionBonus()
				const applied = player.collectionBonus
				if (!bonus.tier) {
					return html`<section class="PanelSection">
						<h3>万灵归藏</h3>
						<p class="PanelLine">灵藏未启。累计收录 ${bonus.count} 项世界观见闻，收录满 ${bonus.next.threshold} 项可觉醒「${bonus.next.name}」。</p>
					</section>`
				}
				const totalText = formatPassives(bonus.total)
				const appliedText = applied ? formatPassives(applied.total) : totalText
				return html`<section class="PanelSection">
					<h3>万灵归藏</h3>
					<p class="PanelLine">灵藏「${bonus.tier.name}」· 收录 ${bonus.count} 项（${appliedText}）</p>
					${bonus.next
						? html`<p class="PanelMuted">距「${bonus.next.name}」还差 ${bonus.next.threshold - bonus.count} 项。</p>`
						: html`<p class="PanelMuted">万灵归藏，灵质空间自成一方天地。</p>`}
				</section>`
			})()}

			<ul class="Options">
				<li><button onclick=${onBack}>返回菜单</button></li>
			</ul>
		</div>
	`
}

export default function Menu({game, gameState, onUndo, onForgeGolem}) {
	const [showPanel, setShowPanel] = useState(false)
	const [showAchievements, setShowAchievements] = useState(false)
	const [showForge, setShowForge] = useState(false)
	const legacy = getLegacy()
	const level = legacy && legacy.soul > 0 ? legacyLevel(legacy.soul) : null

	if (showForge) {
		return html`<${GolemForgePanel} player=${gameState?.player} onForge=${onForgeGolem} onBack=${() => setShowForge(false)} />`
	}

	if (showAchievements) {
		return html`<${AchievementsPanel} onBack=${() => setShowAchievements(false)} />`
	}

	if (showPanel) {
		return html`<${CultivationPanel} gameState=${gameState} onBack=${() => setShowPanel(false)} />`
	}

	return html`
		<div class="Splash">
			<h1 medium>重生之门 · 罗小黑战记同人</h1>

			${legacy &&
			html`<p class="SoulSettle">
				魂灵传承：${legacy.soul} · 「${level.name}」 · 已轮回 ${legacy.runs || 0} 世
			</p>`}

			<ul class="Options">
				<li>
					<button
						onclick=${() => (window.location.href = 'collection.html')}
						title="查看卡牌、角色、地点、法宝、敌人、灵质空间、事件、五行、纪年等世界观图鉴"
					>
						世界观图鉴
					</button>
				</li>
				<li>
					<button
						onclick=${() => (window.location.href = 'stats.html')}
						title="查看魂灵传承、灵质修行、成就、五行掌握、世界观收集等跨局战绩总览"
					>
						修行总览
					</button>
				</li>
				<li>
					<button onclick=${() => setShowPanel(true)} title="查看本命御灵、境界、法宝、羁绊与魂灵传承明细">
						修行面板
					</button>
				</li>
				<li>
					<button onclick=${() => setShowForge(true)} title="消耗生灵/物质灵铸造灵偶，随行助战（造物系·无中生有）">
						灵偶铸造台
					</button>
				</li>
				<li>
					<button onclick=${() => setShowAchievements(true)} title="查看跨局成就与已解锁称号">
						成就
					</button>
				</li>
				<li>
					<button
						onclick=${() => save(gameState)}
						title="存档会保存在网址里，复制它即可分享"
					>
						保存
					</button>
				</li>
				<li>
					<button onclick=${() => abandonGame()}>放弃游戏</button>
				</li>
			</ul>

			<${History} future=${game.future.list} past=${game.past.list} />

			${game.past.list.length &&
			html`<p>
				<button onclick=${() => onUndo()}>
					<u>撤</u>
					销
				</button>

				<br />
			</p>`}

		</div>
	`
}
