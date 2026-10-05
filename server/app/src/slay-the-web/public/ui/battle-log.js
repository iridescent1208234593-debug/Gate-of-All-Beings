import {html} from '../web_modules/htm/preact/standalone.module.js'

// 战斗日志面板（重生之门）：展示 state.log 中的逐条战况记录。
// 日志种类决定左侧色条：dmg 伤害 / def 格挡 / heal 治疗 / debuff 负面 / warn 警示（轮回侵蚀、Boss 二阶段） /
// break 突破 / reward 奖励 / event 事件 / info 一般（移动、力量累积）。
const KIND_CLASS = {
	dmg: 'battle-log--dmg',
	def: 'battle-log--def',
	heal: 'battle-log--heal',
	debuff: 'battle-log--debuff',
	warn: 'battle-log--warn',
	break: 'battle-log--break',
	reward: 'battle-log--reward',
	event: 'battle-log--event',
	info: 'battle-log--info',
}

const BattleLog = ({log}) => {
	const entries = log || []
	if (!entries.length) {
		return html`<div class="BattleLog">
			<p class="BattleLog-empty">尚无战况记录。打出第一张牌，开启你的重生之旅。</p>
		</div>`
	}
	return html`
		<div class="BattleLog">
			<p class="BattleLog-head">战况记录（最近 ${entries.length} 条）</p>
			<ul class="BattleLog-list">
				${entries
					.slice(-40)
					.reverse()
					.map(
						(entry) => html`
							<li class=${'BattleLog-item ' + (KIND_CLASS[entry.kind] || 'battle-log--info')}>
								<span class="BattleLog-turn">${entry.turn}</span>
								<span class="BattleLog-text">${entry.text}</span>
							</li>
						`
					)}
			</ul>
		</div>
	`
}

export default BattleLog
