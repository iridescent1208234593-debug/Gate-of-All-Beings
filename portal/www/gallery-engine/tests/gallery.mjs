import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createColor } from 'colorthief'
import { loadEnv } from 'vite'
import { mapAtmosphere } from '../src/data/palette.js'

const directory = await mkdtemp(path.join(os.tmpdir(), 'depth-gallery-test-'))
const previewDirectory = await mkdtemp(path.join(os.tmpdir(), 'depth-gallery-previews-'))
process.env.GALLERY_PREVIEW_DIR = previewDirectory
const { discoverGallery, encodePath, externalGallery, resolveGalleryAssetBase } =
  await import('../gallery-plugin.js')
try {
  for (const name of [
    '图10.png',
    '图2.jpg',
    '图1.jpeg',
    '空 格（贺图）(a)#%&+.WEBP',
    'ignored.gif',
  ]) {
    await writeFile(path.join(directory, name), 'fixture')
    await writeFile(path.join(previewDirectory, `${name}.webp`), 'preview')
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
  await writeFile(path.join(previewDirectory, '图3.png.webp'), 'preview')
  assert.equal((await discoverGallery(directory)).length, 5)
  assert.equal(resolveGalleryAssetBase(), '')
  for (const [index, [override, expectedBase]] of [
    [undefined, '/assets/homepage'],
    ['', '/assets/homepage'],
    ['/custom/', '/custom'],
    ['https://cdn.example.invalid/assets///', 'https://cdn.example.invalid/assets'],
  ].entries()) {
    const plugin = externalGallery(directory)
    const outDir = `build-${index}`
    plugin.configResolved({
      root: directory,
      base: '/assets/homepage/',
      env: { VITE_ASSET_BASE_URL: override },
      build: { outDir },
    })
    await plugin.buildStart.call({ warn: () => {} })
    const source = plugin
      .load(plugin.resolveId('virtual:gallery'))
      .replaceAll('import.meta.env.BASE_URL', JSON.stringify('/assets/homepage/'))
    const { default: gallery } = await import(`data:text/javascript,${encodeURIComponent(source)}`)
    const prefix = `${expectedBase}/gallery-previews/`
    assert.equal(gallery.length, 5)
    for (const file of gallery) {
      assert.ok(file.url.startsWith(prefix), file.url)
      assert.equal(
        decodeURIComponent(file.url.slice(prefix.length).split('?')[0]),
        `${file.name}.webp`
      )
      assert.equal(
        decodeURIComponent(file.originalUrl.slice(file.originalUrl.indexOf('image=') + 6)),
        file.name
      )
      assert.match(file.url, /\?v=/)
    }
    await plugin.writeBundle()
    const copied = path.join(directory, outDir, '.gallery-originals', '图1.jpeg')
    await assert.rejects(stat(copied), { code: 'ENOENT' })
    const publicCopy = path.join(directory, outDir, 'gallery-files', '图1.jpeg')
    await assert.rejects(stat(publicCopy), { code: 'ENOENT' })
    const preview = path.join(directory, outDir, 'gallery-previews', '图1.jpeg.webp')
    if (override?.startsWith('https:')) await assert.rejects(stat(preview), { code: 'ENOENT' })
    else assert.equal(await readFile(preview, 'utf8'), 'preview')
    // Keep subsequent discovery independent of the test build output.
    await rm(path.join(directory, outDir), { recursive: true, force: true })
  }
  const previousOverride = process.env.VITE_ASSET_BASE_URL
  try {
    delete process.env.VITE_ASSET_BASE_URL
    assert.equal(resolveGalleryAssetBase(loadEnv('production', directory)), '')
    await writeFile(path.join(directory, '.env'), 'VITE_ASSET_BASE_URL=/common\n')
    await writeFile(
      path.join(directory, '.env.production.local'),
      'VITE_ASSET_BASE_URL=https://cdn.example.invalid/from-file/\n'
    )
    assert.equal(resolveGalleryAssetBase(loadEnv('development', directory)), '/common')
    assert.equal(
      resolveGalleryAssetBase(loadEnv('production', directory)),
      'https://cdn.example.invalid/from-file'
    )
    process.env.VITE_ASSET_BASE_URL = 'https://cdn.example.invalid/from-process///'
    assert.equal(
      resolveGalleryAssetBase(loadEnv('production', directory)),
      'https://cdn.example.invalid/from-process'
    )
    process.env.VITE_ASSET_BASE_URL = ''
    assert.equal(resolveGalleryAssetBase(loadEnv('production', directory)), '')
  } finally {
    if (previousOverride === undefined) delete process.env.VITE_ASSET_BASE_URL
    else process.env.VITE_ASSET_BASE_URL = previousOverride
  }
} finally {
  assert.ok(
    path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep + 'depth-gallery-test-')
  )
  await rm(directory, { recursive: true })
  await rm(previewDirectory, { recursive: true })
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
