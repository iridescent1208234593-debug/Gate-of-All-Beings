import {html, Component} from '../web_modules/htm/preact/standalone.module.js'
import {
	weak as weakPower,
	vulnerable as vulnerablePower,
	regen as regenPower,
	strength as strengthPower,
	monsterRegen as monsterRegenPower,
} from '../game/powers.js'
import {weatherForFloor, weatherPhaseInfo, resonanceInfo} from '../content/element-mastery.js'
import {formatDailyPassive} from '../content/daily.js'
import {skillEffectByName} from '../content/skill-effects.js'
import {enemyProfileByName} from '../content/enemy-profiles.js'
import {abilityBranchById} from '../content/ability-branches.js'
import {guildById} from '../content/guild-branches.js'
import {lingStatus, transformStageInfo, nextTransformInfo} from '../content/ling-gather.js'
import {REGION_NAMES, regionForMonster} from '../content/dungeon-encounters.js'

// 御灵系技能悬浮提示：优先展示技能效果描述；未收录效果时退化为原名展示。
const skillEffectTitle = (skill) => {
	const effect = skillEffectByName(skill)
	return effect ? `御灵系技能「${skill}」· ${effect.desc}` : `御灵系技能：${skill}`
}

// 羁绊被动效果中文标签（键与 actions.js bondPassiveTotal 对齐）
const BOND_PASSIVE_LABELS = {
	atkBonus: '攻击',
	defBonus: '格挡',
	hpRegen: '每回合回复',
	fortune: '福缘',
	maxHealth: '最大生命',
	daoHeart: '道心',
}

// 羁绊被动 → 可读文本（如「福缘 +6 · 道心 +3」）
const bondPassiveText = (bond) => {
	const parts = Object.entries(bond.passive || {}).map(([k, v]) => {
		const label = BOND_PASSIVE_LABELS[k]
		if (!label) return `${k}+${v}`
		return k === 'hpRegen' ? `${label} ${v} 点` : `${label} +${v}`
	})
	return parts.join(' · ') || '无被动'
}

// 羁绊详情悬浮文本：类型 / 结缘对象 / 背景描述 / 被动加成
const bondTitle = (bond) =>
	`【${bond.type}】${bond.name} · 结缘「${bond.partner}」\n${bond.desc}\n被动：${bondPassiveText(bond)}`

// 灵质天赋（八大能力系）查询：由 id 取分支数据，供玩家面板展示
const branchById = (id) => abilityBranchById(id)

export const Player = (props) => {
	return html`<${Target} ...${props} type="player" />`
}

export const Monster = (props) => {
	const monster = props.model
	const state = props.gameState
	// {damage: 6, block: 2}
	const intent = monster.intents[monster.nextIntent]

	function MonsterIntent([type, amount]) {
		const weakened = monster.powers.weak
		const vulnerable = state.player.powers.vulnerable
		const strength = monster.powers.strength

		if (type === 'damage' && weakened) amount = weakPower.use(amount)
		if (type === 'damage' && vulnerable) amount = vulnerablePower.use(amount)
		if (type === 'damage' && strength) amount = strength + amount

		let tooltip = ''
		let icon = type
		if (type === 'damage') tooltip = `将造成 ${amount} 点伤害${strength ? `（含力量 +${strength}）` : ''}`
		if (type === 'block') tooltip = `将格挡 ${amount} 点伤害`
		if (type === 'weak') tooltip = `将施加 ${amount} 层虚弱`
		if (type === 'vulnerable') tooltip = `将施加 ${amount} 层易伤`
		if (type === 'strength') {
			tooltip = `获得 ${amount} 层力量：造成的伤害 +${amount}（持续）`
			icon = 'damage'
		}
		if (type === 'regen') {
			tooltip = `获得 ${amount} 层回灵：每回合回复 ${amount} 点生命（持续）`
			icon = 'potion-green'
		}
		if (type === 'heal') {
			tooltip = `立即回复 ${amount} 点生命`
			icon = 'potion-green'
		}

		// Don't reveal how many stacks will be applied.
		if (type === 'vulnerable' || type === 'weak') amount = undefined

		return html`
			<div class="Target-intent ${tooltip && 'tooltipped tooltipped-n'}" aria-label="${tooltip}">
				<img alt=${type} src="ui/images/${icon}.png" /> ${amount}
			</div>
		`
	}

	return html`
		<${Target} ...${props} type="enemy">
			${intent && Object.entries(intent).map((intent) => MonsterIntent(intent))}
		<//>
	`
}

class Target extends Component {
	componentDidUpdate(prevProps) {
		// Keep track of how much hp we might have lost.
		const lostHealth = prevProps.model.currentHealth - this.props.model.currentHealth
		if (lostHealth > 0) this.setState({lostHealth})
		// Keep track of how much block we gained.
		// const gainedBlock = this.props.model.block - prevProps.model.block
		// if (gainedBlock > 0) this.setState({gainedBlock})
	}

	render({model, type, name, children, gameState}, state) {
		const isDead = model.currentHealth < 1
		const hp = isDead ? 0 : model.currentHealth
		// 敌人世界观档案：所属势力 / 物种 / 背景描述，悬浮于「档案」标签查看（来自 content/enemy-profiles.js）
		const lore = type === 'enemy' ? enemyProfileByName(model.name) : null
		const loreTitle = lore
			? `所属：${lore.affiliation}\n物种：${lore.species}\n${lore.desc}\n（源自：${lore.source}）`
			: ''
		// 怪物来源区域徽章：命中 MONSTER_REGIONS 时展示区域短名，悬浮查看世界观详情（全区域可出的未标注怪不展示）
		const regionInfo = type === 'enemy' ? REGION_NAMES[regionForMonster(model.name)] : null
		// Boss 第二阶段转场：半血进入狂暴后，展示「第二阶段」徽标与转场台词（phase2Quote）
		const isPhase2 = type === 'enemy' && model.phase2Active && !!model.phase2Quote
		const quote = isPhase2 ? model.phase2Quote : model.quote
		// 五行天时：当前楼层相位（player 面板展示，随 dungeon.y 轮转）
		const weatherEl = gameState?.dungeon ? weatherForFloor(gameState.dungeon.y) : null
		const weatherInfo = weatherEl ? weatherPhaseInfo(weatherEl) : null
		// 灵机共振：今日灵机当值五行与当前楼层天时同向时，天地同频（稀有日增益）
		const resonance = weatherEl ? resonanceInfo(weatherEl, model.daily?.element || null) : null
		return html`
			<div class=${`Target${isDead ? ' Target--isDead' : ''}`} data-type=${type}>
				<h2><span class="Target-name">${name}</span> ${type === 'enemy' && model.element ? html`<span class="Target-element Target-element--monster" title="敌方五行·${model.element}系（同系共鸣 / 本命克制攻击+1；敌方克制你时伤害+1）">${model.element}系</span>` : ''} ${type === 'enemy' && model.skill ? html`<span class="Target-skill" title="${skillEffectTitle(model.skill)}">${model.skill}</span>` : ''} ${type === 'enemy' && lore ? html`<span class="Target-lore tooltipped tooltipped-s tooltipped-multiline" aria-label="${loreTitle}">档案</span>` : ''} ${type === 'enemy' && regionInfo ? html`<span class="Target-region tooltipped tooltipped-s tooltipped-multiline" aria-label="来源区域：${regionInfo.flavor}">${regionInfo.name}</span>` : ''} ${children} ${isPhase2 && html`<span class="Target-phase2Badge">第二阶段</span>`}</h2>
				${type === 'enemy' && quote && html`<p class="Target-quote${isPhase2 ? ' Target-quote--phase2' : ''}">「${quote}」</p>`}
				<${Healthbar} max=${model.maxHealth} value=${hp} block=${model.block} />
				${type === 'player' && html`
					<div class="Target-cultivation">
						${model.element ? html`<span class="Target-element" title="本命御灵系·五行共鸣：同系卡牌伤害/格挡+2，相生+1，本命克制时攻击+1">本命·${model.element}</span>` : ''}
						${model.branch && branchById(model.branch) ? html`<span class="Target-element Target-element--branch" title="灵质天赋（本作分类）：${branchById(model.branch).flavor}">天赋·${branchById(model.branch).name}</span>` : ''}
						${model.guild && guildById(model.guild) ? html`<span class="Target-element Target-element--guild" title="出身分馆（妖灵会馆）：${guildById(model.guild).flavor}">馆·${guildById(model.guild).name}</span>` : ''}
						${weatherInfo ? html`<span class="Target-element Target-element--weather" title="当前楼层天时：${weatherInfo.flavor}。打出同系卡牌伤害/格挡+1；同系敌方攻击伤害+1">${weatherInfo.name}</span>` : ''}
						${resonance?.active ? html`<span class="Target-element Target-element--resonance tooltipped tooltipped-s tooltipped-multiline" aria-label="灵机共振：今日${model.daily?.elementName}与当前楼层天时同向，天地同频。同系卡牌伤害/格挡额外+1；同系敌方攻击伤害+1">共振·${model.daily?.elementName || resonance.element}</span>` : ''}
						${model.daily?.blessingId ? html`<span class="Target-element Target-element--daily tooltipped tooltipped-s tooltipped-multiline" aria-label="今日灵机 · ${model.daily.elementName}：祝福「${model.daily.name}」—— ${formatDailyPassive(model.daily.passive)}${model.daily.desc ? `。${model.daily.desc}` : ''}${model.daily.elementFlavor ? `（${model.daily.elementFlavor}）` : ''}">灵机·${model.daily.name}</span>` : ''}
						${model.realmName || '炼气期'} · 修为 ${model.cultivation || 0}/100 · 道心 ${model.daoHeart || 0} · 福缘 ${model.fortune || 0} · 金币 ${model.gold || 0}
						${model.shengling !== undefined ? html`<span class="Target-element Target-element--ling tooltipped tooltipped-s tooltipped-multiline" aria-label="聚灵修炼（生灵/物质灵双资源）：御灵师借天时聚灵积累，达标后化形进阶。当前阶段「${transformStageInfo(model).name}」——${transformStageInfo(model).desc}${nextTransformInfo(model) ? `。化形需求：生灵 ${nextTransformInfo(model).shenglingNeed} · 物质灵 ${nextTransformInfo(model).wuzhiNeed}，化形后${nextTransformInfo(model).rewardText}` : ''}">${transformStageInfo(model).name} · 生灵 ${model.shengling}/${nextTransformInfo(model)?.shenglingNeed ?? 'MAX'} · 物质灵 ${model.wuzhi || 0}/${nextTransformInfo(model)?.wuzhiNeed ?? 'MAX'}</span>` : ''}
						${model.treasures && model.treasures.length ? ` · 法宝：${model.treasures.map((t) => t.name).join('、')}` : ''}
						${model.cyclePressure
							? html`<span class="tooltipped tooltipped-s tooltipped-multiline" aria-label="越接近重生之门，生灵越枯竭，灵质空间承受的压迫越强。抵达重生之门后，每回合结束将承受压迫/5 的轮回侵蚀（无视格挡，道心每 10 点抵 1）。"> · 轮回压迫 ${model.cyclePressure}</span>`
							: ''}
					</div>
					${model.soulLegacy && html`
						<div class="Target-soulLegacy">传承「${model.soulLegacy.levelName}」· 魂灵 ${model.soulLegacy.soul}（生命 +${model.soulLegacy.hpBonus} · 福缘 +${model.soulLegacy.fortuneBonus}）</div>
					`}
					${model.bonds && model.bonds.length ? html`
						<div class="Target-bonds">羁绊：${model.bonds.map((b) => html`<span class="Target-bond tooltipped tooltipped-s tooltipped-multiline" aria-label="${bondTitle(b)}">${b.name}（${b.partner}）</span>`).join('、')}</div>
					` : ''}
					${model.golems && model.golems.length ? html`
						<div class="Target-golems">灵偶：${model.golems.map((g) => g.name).join('、')}</div>
					` : ''}`}
				<${Powers} powers=${model.powers} />
				<div class="Target-combatText Split">
					<${FCT} key=${model.block} value=${model.block} class="FCT FCT--block" />
					<${FCT} key=${hp} value=${state.lostHealth} />
				</div>
			</div>
		`
	}
}

// A bar that shows the player's current and maximum health as well as any block.
function Healthbar({value, max, block}) {
	return html`
		<div class="Healthbar ${block ? `Healthbar--hasBlock` : ''}">
			<p class="Healthbar-label">
				<span>${value}/${max}</span>
			</p>
			<div class="Healthbar-bar" style=${`width: ${(value / max) * 100}%`}></div>
			<div class="Healthbar-bar Healthbar-blockBar" style=${`width: ${(block / max) * 100}%`}>
				${block > 0 ? block : ''}
			</div>
		</div>
	`
}

// Shows currently active powers.
const Powers = (props) => {
	return html`
		<div class="Target-powers">
			<${Power} amount=${props.powers.strength} power=${strengthPower} />
			<${Power} amount=${props.powers.monsterRegen} power=${monsterRegenPower} />
			<${Power} amount=${props.powers.vulnerable} power=${vulnerablePower} />
			<${Power} amount=${props.powers.regen} power=${regenPower} />
			<${Power} amount=${props.powers.weak} power=${weakPower} />
		</div>
	`
}

const Power = ({power, amount}) => {
	if (!amount) return null
	return html`<span class="tooltipped tooltipped-s" aria-label=${power.description}>
		${power.name} ${amount}
	</span>`
}

// Floating Combat Text. Give it a number and it'll animate it.
function FCT(props) {
	// This avoids animation the value "0".
	if (!props.value) return html`<p></p>`
	return html`<p class="FCT" ...${props}>${props.value}</p>`
}
