// 游戏站登录入口：并入西木会馆(huiguan)账户系统，共享 .iridescently.xyz 登录态
// 未登录显示「登录/注册」，点击跳转 huiguan 登录页（带回跳参数）
// 已登录显示用户名与退出按钮
import {html, render, Component} from '../web_modules/htm/preact/standalone.module.js'

const HUIGUAN_BASE = 'https://huiguan.iridescently.xyz'

export default class AccountBar extends Component {
	constructor() {
		super()
		this.state = {state: 'checking', user: null}
	}
	componentDidMount() {
		this.events = new AbortController()
		this.checkLogin()
	}
	componentWillUnmount() {
		this.events.abort()
		clearTimeout(this.logoutTimer)
	}
	async checkLogin() {
		try {
			const r = await fetch(`${HUIGUAN_BASE}/api/user`, {credentials: 'include', signal: this.events.signal})
			if (!r.ok) throw new Error('bad status ' + r.status)
			const d = await r.json()
			this.setState({state: 'done', user: d && d.logged_in ? d : null})
		} catch (e) {
			if (this.events.signal.aborted) return
			// 网络不可达/未部署域名时静默隐藏，不影响离线游玩
			this.setState({state: 'done', user: null})
		}
	}
	handleLogout() {
		fetch(`${HUIGUAN_BASE}/api/logout`, {credentials: 'include', redirect: 'manual'})
			.catch(() => {})
			.finally(() => {
				this.logoutTimer = setTimeout(() => location.reload(), 200)
			})
	}
	render(props, {state, user}) {
		if (state === 'checking') return html`<div class="QcAccountBar QcAccountBar--hidden"></div>`
		const next = encodeURIComponent(location.href)
		if (!user)
			return html`
				<div class="QcAccountBar">
					<a class="QcAccountBar-btn QcAccountBar-login" href="${`${HUIGUAN_BASE}/?next=${next}`}">登录 / 注册</a>
				</div>
			`
		const name = user.nickname || user.username || '用户'
		return html`
			<div class="QcAccountBar">
				<span class="QcAccountBar-name" title="西木会馆账号">${name}</span>
				<button class="QcAccountBar-btn QcAccountBar-logout" onClick=${() => this.handleLogout()}>退出</button>
			</div>
		`
	}
}

// 挂载容器不存在（如 collection.html 等子页）时不渲染，避免报错
export function mountAccountBar() {
	const mount = document.getElementById('QcAccountBar')
	if (!mount) return () => {}
	render(html`<${AccountBar} />`, mount)
	return () => render(null, mount)
}
if (!document.getElementById('SlayTheWeb')) mountAccountBar()
