import {html, Component} from '../web_modules/htm/preact/standalone.module.js'
import {REGION_NAMES, regionForMonster} from '../content/dungeon-encounters.js'

const getEnemiesStats = (dungeon) => {
	const stats = {
		killed: 0,
		encountered: 0,
		maxHealth: 0,
		finalHealth: 0,
	}
	/* 区域征伐：按怪物来源区域（MONSTER_REGIONS）统计击杀数；未标注区域（全区域可出）不计入 */
	const regionStats = {}
	/* for each path taken (room) in the dungeon, get some stats */
	dungeon.pathTaken.forEach((usedNode) => {
		const nodeData = dungeon.graph[usedNode.y][usedNode.x]
		/* find some stats about the enemies encountered */
		if (nodeData.room && nodeData.room.monsters) {
			/* how many encountered monsters */
			stats.encountered += nodeData.room.monsters.length
			nodeData.room.monsters.forEach((monster) => {
				/* how many killed monsters? */
				if (monster.currentHealth <= 0) {
					stats.killed += 1
					const rk = regionForMonster(monster.name)
					if (rk) regionStats[rk] = (regionStats[rk] || 0) + 1
				}
				/* monsters total life */
				stats.finalHealth += monster.currentHealth
				stats.maxHealth += monster.maxHealth
			})
		}
	})
	stats.regionStats = regionStats
	return stats
}

export default class DungeonStats extends Component {
	render({state}) {
		const {dungeon} = state
		const stats = getEnemiesStats(dungeon)
		return html`
			<h2>爬塔统计</h2>
			<ul>
				<li>遭遇敌人：${stats.encountered}</li>
				<li>击杀敌人：${stats.killed}</li>
				<li>敌人总血量：${stats.maxHealth}</li>
				<li>剩余血量合计：${stats.finalHealth}</li>
			</ul>
			<h2>区域征伐</h2>
			<ul>
				${Object.entries(REGION_NAMES).map(
					([key, info]) => html`<li title="${info.flavor}">${info.name}：${stats.regionStats[key] ? `已征伐（击杀 ${stats.regionStats[key]}）` : '未涉足'}</li>`
				)}
			</ul>
		`
	}
}
