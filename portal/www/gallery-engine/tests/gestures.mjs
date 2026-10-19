import assert from 'node:assert/strict'
import { bindGalleryGestures } from '../../scripts/gallery-gestures.mjs'

class Target {
  handlers = new Map()
  addEventListener(name, callback) {
    this.handlers.set(name, callback)
  }
  removeEventListener(name) {
    this.handlers.delete(name)
  }
  fire(name, event) {
    this.handlers.get(name)?.(event)
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const tap = (target, pointerId, index, x = 10, y = 10) => {
  const event = {
    isPrimary: true,
    pointerType: 'touch',
    button: 0,
    pointerId,
    clientX: x,
    clientY: y,
  }
  target.fire('pointerdown', event)
  target.fire('pointerup', event)
}

const target = new Target()
let hit = 0
const calls = []
const dispose = bindGalleryGestures(
  target,
  () => hit,
  (index) => calls.push(`like:${index}`),
  (index) => calls.push(`love:${index}`),
  25
)

tap(target, 1, hit)
tap(target, 2, hit, 14, 12)
await wait(35)
assert.deepEqual(calls, ['love:0'], 'double tap replaces the pending single action')

tap(target, 3, hit)
await wait(35)
assert.deepEqual(calls, ['love:0', 'like:0'], 'single tap fires once after the double-tap window')

tap(target, 4, hit)
hit = 1
await wait(35)
assert.deepEqual(
  calls,
  ['love:0', 'like:0', 'like:0'],
  'a pending single action stays attached to its original image'
)

const down = {
  isPrimary: true,
  pointerType: 'mouse',
  button: 0,
  pointerId: 5,
  clientX: 0,
  clientY: 0,
}
target.fire('pointerdown', down)
target.fire('pointerup', { ...down, clientX: 20 })
await wait(35)
assert.deepEqual(
  calls,
  ['love:0', 'like:0', 'like:0'],
  'dragging the image does not count as a tap'
)

for (let id = 6; id < 10; id++) tap(target, id, hit)
await wait(35)
assert.deepEqual(calls.slice(-2), ['love:1', 'love:1'],
  'four rapid taps produce two loves without stray likes')

const held = { ...down, pointerId: 10, clientX: 12, clientY: 12 }
target.fire('pointerdown', held)
await wait(610)
target.fire('pointerup', held)
await wait(35)
assert.equal(calls.length, 5, 'long press does not trigger an image action')

dispose()
assert.equal(target.handlers.size, 0, 'disposal removes pointer listeners')
console.log('Gallery gesture tests passed')
