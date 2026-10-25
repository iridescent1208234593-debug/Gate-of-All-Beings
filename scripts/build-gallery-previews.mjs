import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import runtimePaths from '../server/runtime-paths.cjs'

const projectRoot = path.resolve(process.env.IRIDESCENTLY_PROJECT_ROOT || process.cwd())
const { discoverGallery, previewName } = await import(pathToFileURL(path.join(projectRoot, 'portal/www/gallery-engine/gallery-plugin.js')))
const source = path.resolve(process.env.GALLERY_DIR || path.join(runtimePaths.assetsRoot, 'source/罗小黑战记数据库/罗小黑节气贺图（gallery素材）'))
const safeOutputRoot = path.join(runtimePaths.cacheRoot, 'homepage')
const output = path.resolve(process.env.GALLERY_PREVIEW_DIR || path.join(safeOutputRoot, 'gallery-previews'))
const relative = path.relative(safeOutputRoot, output)
if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`Preview output must stay under ${safeOutputRoot}`)
if (source === output || source.startsWith(output + path.sep) || output.startsWith(source + path.sep)) throw new Error('Preview output must not overlap original assets')

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg'
if (!existsSync(source) || !statSync(source).isDirectory()) {
  throw new Error(`Gallery source directory is missing or invalid: ${source}. Set GALLERY_DIR to a directory containing supported JPG, JPEG, PNG, or WebP images.`)
}
const files = await discoverGallery(source)
if (!files.length) throw new Error(`No supported gallery images found in ${source}. Set GALLERY_DIR to the intended local or externally mounted gallery directory.`)

rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })
let inputBytes = 0
let outputBytes = 0
for (const file of files) {
  const input = path.join(source, ...file.name.split('/'))
  const target = path.join(output, ...previewName(file.name).split('/'))
  mkdirSync(path.dirname(target), { recursive: true })
  const result = spawnSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-vf', "scale='min(1536,iw)':'min(1536,ih)':force_original_aspect_ratio=decrease",
    '-c:v', 'libwebp', '-quality', '88', '-compression_level', '6', '-loop', '0', target,
  ], { encoding: 'utf8', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`WebP preview failed for ${file.name}: ${result.stderr}`)
  inputBytes += statSync(input).size
  outputBytes += statSync(target).size
}

const report = {
  generatedAt: new Date().toISOString(),
  count: files.length,
  inputBytes,
  previewBytes: outputBytes,
  savedBytes: inputBytes - outputBytes,
  savedPercent: Number(((1 - outputBytes / inputBytes) * 100).toFixed(2)),
  settings: { maxDimension: 1536, webpQuality: 88, alpha: 'preserved by libwebp' },
}
writeFileSync(path.join(output, 'preview-report.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
