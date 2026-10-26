import {html, Component} from '../web_modules/htm/preact/standalone.module.js'
import {canPlay} from '../game/conditions.js'
import {cardResonanceInfo} from '../content/element-mastery.js'
// 卡面只显示文字：原卡图为无关的外部素材，已移除；元素印章仅重复类型文字，不再恢复。

export default class Cards extends Component {
	// props = {gameState: {}, type ''}
	render(props) {
		const cards = props.gameState[props.type]
		return html` <div class="Cards">${cards.map((card) => Card(card, props.gameState))}</div> `
	}
}

export function Card(card, gameState) {
	const isDisabled = !canPlay(card, gameState)
	// 五行共鸣徽标：显示该卡与玩家本命系的关系（同系/相生/本命克制/被克）
	const resonance = cardResonanceInfo(card.element, gameState?.player?.element)

	return html`
		<article
			class="Card"
			data-card-type=${card.type}
			data-card-target=${card.target}
			data-element=${card.element}
			key=${card.id}
			data-id=${card.id}
			disabled=${isDisabled}
		>
			<div class="Card-inner">
				<p class="Card-energy EnergyBadge">
					<span>${card.energy}</span>
				</p>
				<p class="Card-type">
					${card.type} · ${card.element}
					${resonance
						? html`<span class="Card-resonance Card-resonance--${resonance.cls}" title=${resonance.title}>${resonance.label}</span>`
						: ''}
				</p>
				<h3 class="Card-name">${card.name}</h3>
				<p class="Card-description">${card.description}</p>
			</div>
		</article>
	`
}
