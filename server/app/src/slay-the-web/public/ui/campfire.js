import {html, Component} from '../web_modules/htm/preact/standalone.module.js'
import CardChooser from './card-chooser.js'

export default class CampfireRoom extends Component {
	rest() {
		this.props.onChoose('rest')
	}
	choose(choice, reward) {
		this.setState({
			choice,
			reward,
			isChoosingCard: !this.state.isChoosingCard,
		})
		if (reward) {
			this.props.onChoose(choice, reward)
		}
	}
	onSelectCard(card) {
		this.choose(this.state.choice, card)
	}
	render(props, state) {
		const {gameState} = props
		const {choice, isChoosingCard} = state
		let label = ''
		if (choice === 'upgradeCard') label = '选择一张卡牌进行升级'
		if (choice === 'removeCard') label = '选择一张卡牌进行移除'
		return html`
			<h1 center medium>篝火</h1>
			<ul class="Options">
				${isChoosingCard
					? html`
							<li>
								<button onclick=${() => this.setState({isChoosingCard: false})}>取消</button>
							</li>
					  `
					: html`
							<li><button onclick=${() => this.rest()}>休整</button></li>
							<li><button onclick=${() => this.choose('upgradeCard')}>升级卡牌</button></li>
							<li><button onclick=${() => this.choose('removeCard')}>移除卡牌</button></li>
					  `}
			</ul>
			${isChoosingCard &&
			html`<br />
				<p center>${label}</p>
				<${CardChooser}
					gameState=${gameState}
					cards=${gameState.deck}
					didSelectCard=${(card) => this.onSelectCard(card)}
				/>`}
			<p center>
				<button onclick=${() => this.props.onContinue()}>不用了，谢谢</button>
			</p>
		`
	}
}
