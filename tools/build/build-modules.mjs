// Build into the external environment release root; publishing is separate.
// - Vite 模块从 apps/<名> 构建，静态模块从 apps/<名> 拷贝；静态站必要时修正根绝对链接
// 用法：node tools/build/build-modules.mjs
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { candidateRoot, recordCandidate } from '../release/release-artifacts.mjs';
import { buildMiniGames } from '../../apps/mini-games/build.mjs';

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(buildDir, '..', '..');
const srcRoot = path.join(repoRoot, 'apps');
const outRoot = path.join(candidateRoot, 'modules');
rmSync(path.join(candidateRoot, 'modules.json'), { force: true });
// A module-only build cannot leave an older homepage candidate eligible for
// the next sealed release.
rmSync(path.join(candidateRoot, 'homepage.json'), { force: true });
rmSync(path.join(candidateRoot, 'homepage'), { recursive: true, force: true });
reset(outRoot);

function reset(dest) {
  const relative = path.relative(candidateRoot, dest);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Refusing to clean outside candidate output: ${dest}`);
  }
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
}

function viteModule(srcDir, destName) {
  const dest = path.join(outRoot, destName);
  const localVite = path.join(srcDir, 'node_modules/vite/bin/vite.js');
  const workspaceVite = path.join(repoRoot, 'node_modules/vite/bin/vite.js');
  const vite = existsSync(localVite) ? localVite : workspaceVite;
  if (!existsSync(vite)) throw new Error(`${destName} requires Vite; run npm ci in the module or repository root`);
  const r = spawnSync(process.execPath,
    [vite, 'build', '--base', `/app/modules/${destName}/`, '--outDir', dest, '--emptyOutDir'],
    { cwd: srcDir, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${destName} build failed`);
  console.log(`[vite] ${destName}`);
}

function copyModule(srcDir, destName, filter) {
  const dest = path.join(outRoot, destName);
  reset(dest);
  cpSync(srcDir, dest, { recursive: true, filter });
  console.log(`[copy] ${destName}`);
}

function moduleAssets() {
  return JSON.parse(readFileSync(path.join(buildDir, 'module-assets.json'), 'utf8'));
}

function resolveOptionalAsset(override, configured) {
  const value = override || configured;
  if (!value) return null;
  const resolved = path.resolve(repoRoot, value);
  if (!existsSync(resolved)) throw new Error(`Configured module asset source does not exist: ${resolved}`);
  return resolved;
}

function walk(dir, fn) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

// 全部游戏源码位于 apps/
for (const name of ['management', 'ecology', 'cards']) viteModule(path.join(srcRoot, name), name);
viteModule(path.join(srcRoot, 'world-map'), 'world-map');
viteModule(path.join(srcRoot, 'softie'), 'softie');
copyModule(path.join(srcRoot, 'juling', 'public'), 'juling');
buildMiniGames(path.join(outRoot, 'mini-games'));
console.log('[copy] mini-games');
copyModule(path.join(srcRoot, 'slay', 'public'), 'slay');
cpSync(path.join(srcRoot, 'slay', 'LICENSE'), path.join(outRoot, 'slay', 'LICENSE'));
copyModule(path.join(srcRoot, 'aeon'), 'aeon',
  (src) => !/[\\/](\.git|\.github|node_modules|test|notes|research)([\\/]|$)/.test(src) && !src.endsWith('.md'));

// slay 的少量根绝对图标路径 /ui/... -> ui/...
walk(path.join(outRoot, 'slay'), (p) => {
  if (!p.endsWith('.html')) return;
  const s = readFileSync(p, 'utf8');
  const t = s.replace(/="\/ui\//g, '="ui/');
  if (t !== s) writeFileSync(p, t);
});
console.log('[fix] slay root-absolute /ui/');

// 重生之门的场景图、光标与小图标是可选素材（卡面来自模块自带的 assets/cards/*.svg）。
// 来源由 tools/build/module-assets.json 的 slay.images 或 IRIDESCENTLY_SLAY_IMAGES_DIR 指定；
// 未配置时不带这些素材构建，配置了却不存在则报错。候选产物复制真实文件，不依赖 junction。
const slayImages = path.join(outRoot, 'slay', 'ui', 'images');
rmSync(slayImages, { recursive: true, force: true });
const slayImageSource = resolveOptionalAsset(process.env.IRIDESCENTLY_SLAY_IMAGES_DIR, moduleAssets().slay?.images);
if (slayImageSource) {
  cpSync(slayImageSource, slayImages, { recursive: true, dereference: true });
  console.log(`[copy] slay images from ${slayImageSource}`);
} else {
  console.log('[skip] slay images: no source configured (tools/build/module-assets.json); building without optional art');
}

await recordCandidate('modules', { buildCommand: 'npm run build:modules' });
console.log(`[modules] Candidate ready: ${outRoot} — run npm run build:homepage and npm run build:site, then npm run release:seal.`);
