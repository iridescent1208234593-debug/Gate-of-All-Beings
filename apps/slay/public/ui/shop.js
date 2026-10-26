// 罗小黑战记·重生之门 —— 商店界面（妖灵会馆补给站 / 集市）
// 展示 content/shop.js createShop() 生成的商品：卡牌 / 法宝 / 疗伤
// 购买通过 game/actions.js 的 buyItem action 结算（金币校验 + 防重复购买在 action 内完成）
import {html} from '../web_modules/htm/preact/standalone.module.js'

const KIND_LABEL = {
	card: '卡牌',
	treasure: '法宝',
	heal: '疗伤',
}

export default function ShopRoom(props) {
	const {shop, player, onBuy, onContinue} = props
	if (!shop) return null
	const theme = shop.theme || {}
	const gold = player?.gold || 0

	return html`
		<div class="ShopRoom">
			<h1 center>🛒 ${theme.name || '集市'}</h1>
			<p center class="EventRoom-realm">${theme.owner || ''} · 金币 ${gold}</p>
			<p center>${theme.desc || ''}</p>

			<div class="ShopRoom-items">
				${shop.items.map(
					(item) => html`
						<div class="ShopItem ${item.sold ? 'sold' : ''} ${item.price > gold ? 'unaffordable' : ''}">
							<div class="ShopItem-head">
								<span class="ShopItem-kind">${KIND_LABEL[item.kind] || item.kind}</span>
								<strong class="ShopItem-name">${item.name}</strong>
								<span class="ShopItem-price">💰 ${item.price}</span>
							</div>
							<p class="ShopItem-desc">${item.desc || ''}</p>
							${item.sold
								? html`<button disabled>已售出</button>`
								: html`<button
										disabled=${item.price > gold}
										onclick=${() => onBuy(item)}
									>
										${item.price > gold ? '金币不足' : '购买'}
									</button>`}
						</div>
					`
				)}
			</div>

			<p center><button onclick=${() => onContinue()}>离开商店</button></p>
		</div>
	`
}
