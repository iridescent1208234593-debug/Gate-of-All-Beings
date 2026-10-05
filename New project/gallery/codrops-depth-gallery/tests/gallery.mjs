import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createColor } from 'colorthief'
import { discoverGallery, encodePath } from '../gallery-plugin.js'
import { mapAtmosphere } from '../src/data/palette.js'

const directory = await mkdtemp(path.join(os.tmpdir(), 'depth-gallery-test-'))
try {
  for (const name of [
    '图10.png',
    '图2.jpg',
    '图1.jpeg',
    '空 格（贺图）(a)#%&+.WEBP',
    'ignored.gif',
  ]) {
    await writeFile(path.join(directory, name), 'fixture')
  }
  const files = await discoverGallery(directory)
  assert.equal(files.length, 4)
  assert.deepEqual(
    files.filter((file) => /^图/.test(file.filename)).map((file) => file.title),
    ['图1', '图2', '图10']
  )
  for (const file of files) assert.equal(decodeURIComponent(encodePath(file.name)), file.name)
  assert.deepEqual(files, await discoverGallery(directory))
  await writeFile(path.join(directory, '图3.png'), 'new fixture')
  assert.equal((await discoverGallery(directory)).length, 5)
} finally {
  assert.ok(
    path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep + 'depth-gallery-test-')
  )
  await rm(directory, { recursive: true })
}

const swatch = (r, g, b, proportion) => {
  const color = createColor(r, g, b, 100)
  return { hex: color.hex(), oklch: color.oklch(), population: 100, proportion }
}
for (const rgb of [
  [0, 0, 0],
  [255, 255, 255],
  [128, 128, 128],
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
]) {
  const palette = [swatch(...rgb, 1)]
  const mood = mapAtmosphere({ palette, swatches: {} })
  for (const value of Object.values(mood)) assert.match(value, /^#[0-9a-f]{6}$/)
  assert.notEqual(mood.background, mood.blob1)
  assert.notEqual(mood.blob1, mood.blob2)
}
const blue = swatch(50, 100, 160, 0.99)
const outlier = swatch(255, 0, 0, 0.01)
assert.deepEqual(
  mapAtmosphere({ palette: [blue, outlier], swatches: { Vibrant: outlier } }),
  mapAtmosphere({ palette: [blue], swatches: {} })
)
assert.throws(() => mapAtmosphere({ palette: [], swatches: {} }))

// Exercise the actual worker pipeline without browser decoding or a test framework.
globalThis.ImageData = class {
  constructor(data, width, height) {
    this.data = data
    this.width = width
    this.height = height
  }
}
let workerResult
globalThis.self = {
  postMessage: (result) => {
    workerResult = result
  },
}
await import('../src/data/palette-worker.js')
const transparent = new Uint8ClampedArray(16 * 16 * 4)
for (let offset = 0; offset < transparent.length; offset += 4)
  transparent.set([255, 0, 255, 0], offset)
self.onmessage({ data: { id: 1, pixels: new ImageData(transparent, 16, 16) } })
assert.equal(workerResult.error, 'No opaque pixels')
for (let offset = 0; offset < transparent.length / 2; offset += 4)
  transparent.set([20, 130, 200, 255], offset)
self.onmessage({ data: { id: 2, pixels: new ImageData(transparent, 16, 16) } })
assert.equal(workerResult.result.source, 'auto')
assert.deepEqual(
  workerResult.result.palette.map((color) => color.hex),
  ['#1482c8']
)
console.log(
  'Discovery, natural sort, URL encoding, growth, mapping extremes, outliers and transparent-pixel checks passed.'
)
