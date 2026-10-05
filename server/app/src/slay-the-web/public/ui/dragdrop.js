import {Draggable} from '../web_modules/gsap/Draggable.js'
import gsap from './animations.js'
import {cardHasValidTarget} from '../game/utils-state.js'
import sfx from './sounds.js'

// Class to add to the element we are dragging over.
const overClass = 'is-dragOver'

// Makes the card fly back into the hand.
function animateCardToHand(draggable) {
	return gsap.to(draggable.target, {x: draggable.startX, y: draggable.startY})
}

/**
 *
 * @param {HTMLElement} el
 * @returns {string}
 */
function getTargetStringFromElement(el) {
	const targetIndex = Array.from(el.parentNode.children).indexOf(el)
	return el.dataset.type + targetIndex
}

// 点击出牌支持：当前选中的手牌（拖拽出牌之外，提供"点击选中 → 点击目标打出"的交互）
let selectedCard = null

function clearSelection(targets) {
	if (!selectedCard) return
	selectedCard.classList.remove('is-selected')
	selectedCard = null
	targets.forEach((t) => t.classList.remove(overClass, 'is-targetable'))
}

export default function enableDragDrop(container, afterRelease) {
	const targets = container.querySelectorAll('.Target')
	const cards = container.querySelectorAll('.Hand .Card')

	// 点击合法目标：若已选中卡牌且目标合法，直接打出
	targets.forEach((target) => {
		target.addEventListener('click', (ev) => {
			if (!selectedCard) return
			ev.stopPropagation()
			const cardEl = selectedCard
			const targetString = getTargetStringFromElement(target)
			if (cardHasValidTarget(cardEl.getAttribute('data-card-target'), targetString)) {
				clearSelection(targets)
				afterRelease(cardEl.dataset.id, targetString, cardEl)
			}
		})
	})

	// 点击空白区域取消选中（点击卡片/目标本身不取消）
	container.addEventListener('click', (ev) => {
		if (!selectedCard) return
		if (ev.target.closest('.Hand .Card, .Target')) return
		clearSelection(targets)
	})

	cards.forEach((card) => {
		Draggable.create(card, {
			onPress() {
				// 记录按下位置，用于区分"点击"与"拖拽"
				this._pressX = this.x
				this._pressY = this.y
			},
			onDragStart() {
				// 一旦真正进入拖拽，取消选中状态
				if (selectedCard && selectedCard !== this.target) {
					clearSelection(targets)
				}
				sfx.selectCard()
			},
			// While dragging, highlight any targets we are dragging over.
			onDrag() {
				if (this.target.attributes.disabled) {
					this.endDrag()
				}
				let i = targets.length
				while (--i > -1) {
					// Highlight only if valid target.
					if (this.hitTest(targets[i], '40%')) {
						if (
							cardHasValidTarget(
								this.target.getAttribute('data-card-target'),
								getTargetStringFromElement(targets[i])
							)
						) {
							targets[i].classList.add(overClass)
						}
					} else {
						targets[i].classList.remove(overClass)
					}
				}
			},
			onRelease() {
				const cardEl = this.target

				// 位移小于阈值视为"点击"：切换选中状态（disabled 卡不可选中）
				const moved = Math.hypot(this.x - (this._pressX ?? this.x), this.y - (this._pressY ?? this.y))
				if (moved < 6) {
					if (cardEl.attributes.disabled) return animateCardToHand(this)
					if (selectedCard === cardEl) {
						clearSelection(targets)
					} else {
						clearSelection(targets)
						selectedCard = cardEl
						cardEl.classList.add('is-selected')
						// 高亮所有合法目标
						targets.forEach((t) => {
							if (
								cardHasValidTarget(
									cardEl.getAttribute('data-card-target'),
									getTargetStringFromElement(t)
								)
							) {
								t.classList.add('is-targetable')
							}
						})
					}
					return
				}

				// Which element are we dropping on?
				let targetEl
				let i = targets.length
				while (--i > -1) {
					if (this.hitTest(targets[i], '40%')) {
						targetEl = targets[i]
						break
					}
				}

				if (!targetEl) return animateCardToHand(this)

				// If card is allowed here, trigger the callback with target, else animate back.
				const targetString = getTargetStringFromElement(targetEl)
				if (cardHasValidTarget(cardEl.getAttribute('data-card-target'), targetString)) {
					clearSelection(targets)
					afterRelease(cardEl.dataset.id, targetString, cardEl)
				} else {
					animateCardToHand(this)
					sfx.cardToHand()
				}

				// Remove active class from any other targets.
				targets.forEach((t) => t.classList.remove(overClass))
			},
		})
	})
}
