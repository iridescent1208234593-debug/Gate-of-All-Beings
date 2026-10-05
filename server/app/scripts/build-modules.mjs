// 把所有 web 游戏挂到 server/app/modules/<name>/（内路径）。
// - 已并入源码的三模块（cards/management/ecology）从 server/app/src 构建
// - 其余游戏从 games/ 构建或拷贝；静态站必要时修正根绝对链接
// 用法：node server/app/scripts/build-modules.mjs
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(appDir, 'src');
const outRoot = path.join(appDir, 'modules');

function reset(dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
}

function viteModule(srcDir, destName) {
  const r = spawnSync(process.execPath,
    [path.join(srcDir, 'node_modules/vite/bin/vite.js'), 'build', '--base', `/app/modules/${destName}/`],
    { cwd: srcDir, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${destName} build failed`);
  const dest = path.join(outRoot, destName);
  reset(dest);
  cpSync(path.join(srcDir, 'dist'), dest, { recursive: true });
  console.log(`[vite] ${destName}`);
}

function copyModule(srcDir, destName, filter) {
  const dest = path.join(outRoot, destName);
  reset(dest);
  cpSync(srcDir, dest, { recursive: true, filter });
  console.log(`[copy] ${destName}`);
}

function walk(dir, fn) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

// 全部游戏源码已并入 server/app/src
for (const name of ['management', 'ecology', 'cards']) viteModule(path.join(srcRoot, name), name);
viteModule(path.join(srcRoot, 'softie-webgpu'), 'softie');
copyModule(path.join(srcRoot, 'juling', 'public'), 'juling');
copyModule(path.join(srcRoot, 'slay-the-web', 'public'), 'slay');
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

// slay 的 ui/images 原为指向共享素材的联接，拷贝会丢失 -> 重建 junction
const slayImages = path.join(outRoot, 'slay', 'ui', 'images');
const sharedImages = path.join(appDir, '..', '..', 'shared', 'shared-ui', 'AI image', 'images');
try {
  rmSync(slayImages, { recursive: true, force: true });
  symlinkSync(sharedImages, slayImages, 'junction');
  console.log('[link] slay ui/images -> shared assets');
} catch (e) {
  console.error('[warn] slay ui/images link failed:', e.message);
}

// The root homepage is Gallery-first; publish its shell and discovered assets with the site build.
const homepageBuild = spawnSync(process.execPath,
  [path.join(appDir, '..', '..', 'portal', 'www', 'scripts', 'build-homepage.mjs')],
  { cwd: path.resolve(appDir, '..', '..'), stdio: 'inherit' });
if (homepageBuild.status !== 0) throw new Error('Homepage build failed');
