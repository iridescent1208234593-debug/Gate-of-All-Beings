import assert from 'node:assert/strict'
import { placeGalleryControls } from '../../scripts/gallery-placement.mjs'

const view = { width: 375, height: 667 }
const size = { width: 140, height: 96 }
const place = (rect, viewport = view, footprint = size) =>
  placeGalleryControls(rect, viewport, footprint)
const overlaps = (rect, result, footprint = size) => result && !(
  result.x + footprint.width <= rect.left || result.x >= rect.right ||
  result.y + footprint.height <= rect.top || result.y >= rect.bottom
)

for (const [rect, side] of [
  [{ left: 16, right: 155, top: 180, bottom: 390 }, 'right'],
  [{ left: 220, right: 360, top: 180, bottom: 390 }, 'left'],
  [{ left: 40, right: 335, top: 160, bottom: 400 }, 'below'],
]) {
  const result = place(rect)
  assert.equal(result.side, side)
  assert.equal(overlaps(rect, result), false)
  assert.ok(result.x >= 8 && result.x + size.width <= view.width - 8)
}

const landscape = { width: 667, height: 375 }
const moving = [
  { left: 35, right: 310, top: 100, bottom: 290 },
  { left: 250, right: 455, top: 100, bottom: 290 },
  { left: 350, right: 645, top: 100, bottom: 290 },
]
for (const rect of moving) {
  const result = place(rect, landscape, { width: 140, height: 55 })
  assert.ok(result, 'landscape image has a safe side or vertical slot')
  assert.equal(overlaps(rect, result, { width: 140, height: 55 }), false)
}
for (const viewport of [view, { width: 390, height: 844 }, landscape, { width: 1440, height: 900 }]) {
  const footprint = { width: viewport.width <= 700 ? 140 : 190, height: 96 }
  for (let step = 0; step <= 40; step++) {
    const center = viewport.width * (0.18 + step / 40 * 0.64)
    const imageWidth = viewport.width * (0.25 + (step % 7) * 0.025)
    const rect = { left: center - imageWidth / 2, right: center + imageWidth / 2,
      top: viewport.height * 0.3, bottom: viewport.height * 0.66 }
    const result = place(rect, viewport, footprint)
    if (!result) continue
    assert.equal(overlaps(rect, result, footprint), false, 'moving/scaling image stays clear')
    assert.ok(result.x >= 8 && result.x + footprint.width <= viewport.width - 8)
    assert.ok(result.y >= 8 && result.y + footprint.height <= viewport.height - 8)
  }
}
assert.equal(place({ left: 4, right: 371, top: 4, bottom: 663 }), null,
  'hide controls rather than cover a nearly full-screen image')
const notch = { width: 667, height: 375, safeLeft: 44, safeRight: 44 }
const notchResult = place({ left: 35, right: 310, top: 100, bottom: 290 },
  notch, { width: 140, height: 55 })
assert.ok(notchResult && notchResult.x >= 44 && notchResult.x + 140 <= 623,
  'landscape placement respects safe-area insets')
assert.equal(place({ left: 30, right: 170, top: 30, bottom: 160 },
  { width: 320, height: 180 }, { width: 140, height: 190 }), null,
  'a tall expanded comment form must not overflow a short viewport')
console.log('Gallery placement tests passed')
