import {html, Component} from '../web_modules/htm/preact/standalone.module.js'
import {canPlay} from '../game/conditions.js'
import {cardResonanceInfo} from '../content/element-mastery.js'
// —— 罗小黑世界观卡牌图标（public/assets/cards/*.svg）——
// 优先按卡牌原图 slug 匹配专属图标，否则按五行/系别映射元素印章。
const ELEMENT_ICONS = {
	金: 'metal',
	木: 'wood',
	水: 'water',
	火: 'fire',
	土: 'earth',
	生灵: 'spirit',
	空间: 'space',
	心灵: 'mind',
	造物: 'artifact',
	锁御: 'lock',
	通用: 'common',
}
const CARD_ICONS = {
	'the-angel-of-death.jpg': 'sword',
	't.jpg': 'black-cat',
	'a-line-of-composed-type.jpg': 'fire-spear',
	'2.jpg': 'jade-disk',
	'6.jpg': 'ice-fire',
	'codices.jpg': 'seven-star',
	'alice-holds-the-white-king.jpg': 'devour',
	'vernal-equinox.jpg': 'domain',
	'mask-of-the-faceless.png': 'mirror',
	'bare-feet-of-god.jpg': 'white-tiger',
	'h-sperling-horrified.jpg': 'purple-flame',
}

export function cardIcon(card) {
	const specific = CARD_ICONS[card.image]
	if (specific) return `/assets/cards/${specific}.svg`
	const key = ELEMENT_ICONS[card.element]
	if (key) return `/assets/cards/${key}.svg`
	return '/assets/cards/common.svg'
}


export default class Cards extends Component {
	// props = {gameState: {}, type ''}
	render(props) {
		const cards = props.gameState[props.type]
		return html` <div class="Cards">${cards.map((card) => Card(card, props.gameState))}</div> `
	}
}

export function Card(card, gameState) {
	const isDisabled = !canPlay(card, gameState)
	const image = cardIcon(card)
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
				<figure class="Card-media">
					<img src=${image} alt=${card.name} />
				</figure>
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
