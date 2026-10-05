import {html, Component} from '../web_modules/htm/preact/standalone.module.js'

export default class StartRoom extends Component {
	render() {
		return html`
			<h1 center medium>旅程开始…</h1>
			<ul class="Options">
				<li><button onclick=${() => this.props.onContinue()}>打开地图</button></li>
			</ul>
			<p center>
				<button onclick=${() => (window.location = window.location.origin)}>离开</button>
			</p>
		`
	}
}
