// 罗小黑战记·重生之门 —— 商店系统（妖灵会馆补给站 / 集市）
// 设定依据：content/worldview-data.js 的地点与组织（灵溪镇、龙游分会、离岛黑市、老君阁、苍南会馆）
// 机制：
//   1. 商店房（地图 S 节点）按楼层主题命名，出售卡牌 / 法宝 / 疗伤三档商品
//   2. 玩家通过战斗胜利获得金币（game/actions.js collectBattleReward），
//      在商店中用金币购买（game/actions.js buyItem）
//   3. 商品价格：卡牌按费用（energy）定价，法宝按稀有度（rarity）定价
import cards from './cards.js'
import {treasures} from './cultivation.js'
import {REGION_BOSS_LOOT} from './dungeon-encounters.js'

// 商店主题：按楼层对应世界观地点
const SHOP_THEMES = [
	{floors: [0, 1], name: '灵溪镇·集市', owner: '灵溪镇摊贩', desc: '罗小白家所在的小镇，妖灵会馆分馆就在镇口。摊贩们见惯了来往的妖精与执行者，只要灵石够数，什么都卖。'},
	{floors: [2, 3], name: '龙游分会·补给站', owner: '妖灵会馆龙游分会', desc: '风息诞生的地方，分会在此驻守。执行者出任务前都来这里补充干粮与灵材。'},
	{floors: [4, 5], name: '离岛·黑市', owner: '神秘行商', desc: '离岛与北域之间的黑市，买卖不问来路。那伽领地附近的行商胆子极大，也最会抬价。'},
	{floors: [6, 7], name: '老君阁·货摊', owner: '老君阁弟子', desc: '老君灵质空间内的货摊，蓝溪镇的居民也常来采买。货架上摆着老君炼制的器物。'},
	{floors: [8, 9], name: '苍南会馆·藏库', owner: '苍南会馆执事', desc: '妖灵会馆总部的藏库，只有得到认可的执行者才能入内选购。守卫森严，货真价实。'},
]

export const shopThemeForFloor = (floor) => {
	const theme = SHOP_THEMES.find((t) => t.floors.includes(Math.min(Math.max(floor, 0), 9)))
	return theme || SHOP_THEMES[0]
}

// 卡牌定价：按费用（energy）——0费辅助/1费常规/2费强力/3费重击
export const cardPrice = (card) => ({0: 16, 1: 24, 2: 34, 3: 46}[card.energy] || 24)

// 法宝定价：按稀有度（rarity）
export const treasurePrice = (treasure) => ({2: 36, 3: 46, 4: 56, 5: 72}[treasure.rarity] || 46)

// 疗伤档：花 30 金币回复 25% 最大生命
export const HEAL_OPTION = {
	id: 'shop_heal',
	kind: 'heal',
	name: '疗伤温养',
	price: 30,
	ratio: 0.25,
	desc: '灵泉温养，恢复最大生命的 25%。',
}

/**
 * 生成一次商店内容。
 * @param {number} floor - 当前楼层（0-9），用于商店主题与商品梯度
 * @returns {{theme: object, items: Array}}
 */
export function createShop(floor) {
	const theme = shopThemeForFloor(floor)
	const items = []

	// 1) 随机 3 张卡牌（按当前楼层梯度加权，避免低层买到全部强卡）
	const shuffledCards = [...cards].sort(() => Math.random() - 0.5)
	const cardPool = shuffledCards.filter((c) => {
		if (floor < 3) return c.energy <= 1 // 低层只出轻量卡
		if (floor < 6) return true
		return true // 高层全量
	})
	const pickedCards = []
	for (const c of cardPool) {
		if (pickedCards.length >= 3) break
		if (!pickedCards.includes(c.name)) pickedCards.push(c.name)
	}
	pickedCards.forEach((cardName) => {
		const card = cards.find((c) => c.name === cardName)
		items.push({
			id: `shop_card_${cardName}`,
			kind: 'card',
			cardName,
			name: card.name,
			price: cardPrice(card),
			desc: card.description,
			element: card.element,
		})
	})

	// 2) 1-2 件法宝（按楼层放宽稀有度；区域 Boss 专属战利品不进商店，仅由对应 Boss 掉落）
	const lootIds = new Set(Object.values(REGION_BOSS_LOOT))
	const treasurePool = Object.values(treasures).filter((t) => (floor < 3 ? t.rarity <= 3 : true) && !lootIds.has(t.id))
	const pickedTreasures = [...treasurePool].sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.5 ? 1 : 2)
	pickedTreasures.forEach((t) => {
		items.push({
			id: `shop_treasure_${t.id}`,
			kind: 'treasure',
			treasureId: t.id,
			name: t.id,
			price: treasurePrice(t),
			desc: t.desc,
			rarity: t.rarity,
		})
	})

	// 3) 疗伤选项
	items.push({...HEAL_OPTION})

	return {theme, items}
}
