import path from 'node:path';
import { rmSync, cpSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { candidateRoot, projectRoot, recordCandidate } from '../release/release-artifacts.mjs';
import { fileURLToPath } from 'node:url';
import { buildRuntime } from './build-runtime.mjs';

rmSync(path.join(candidateRoot, 'site.json'), { force: true });
const result = spawnSync(process.env.PYTHON || 'python', ['-X', 'utf8', fileURLToPath(new URL('./build-site.py', import.meta.url))], { cwd: projectRoot, stdio: 'inherit', env: { ...process.env, IRIDESCENTLY_PROJECT_ROOT: projectRoot, PYTHONDONTWRITEBYTECODE: '1' } });
if (result.status !== 0) throw new Error('Site source export failed');
const gate = spawnSync(process.execPath, ['apps/cards/scripts/build-gate-embed.mjs'], { cwd: projectRoot, stdio: 'inherit', env: { ...process.env, GATE_OUTFILE: path.join(candidateRoot, 'site/apps/huiguan/assets/gate/gate-scene.js') } });
if (gate.status !== 0) throw new Error('Gate candidate build failed');
await buildRuntime(path.join(candidateRoot, 'site'));

// 节气画廊（apps/www）是 Vite 工程：脚本里有 png/css/音频的资源导入、?url 后缀，
// 以及 three 的裸模块名，浏览器无法直接解析。必须构建后把产物并入站点候选，
// 否则线上会出现 MIME 报错与 Failed to resolve module specifier "three"，画廊全白。
const homepage = spawnSync(process.execPath, ['apps/www/scripts/build-homepage.mjs'], { cwd: projectRoot, stdio: 'inherit' });
if (homepage.status !== 0) throw new Error('Homepage build failed');
const homepageOut = path.join(candidateRoot, 'homepage');
const wwwOut = path.join(candidateRoot, 'site/apps/www');
if (existsSync(homepageOut) && existsSync(wwwOut)) {
  if (existsSync(path.join(homepageOut, 'assets'))) {
    cpSync(path.join(homepageOut, 'assets'), path.join(wwwOut, 'assets'), { recursive: true });
  }
  const builtIndex = path.join(homepageOut, 'index.html');
  if (existsSync(builtIndex)) cpSync(builtIndex, path.join(wwwOut, 'homepage.html'));
  console.log('[build-site] 节气画廊构建产物已并入 site/apps/www');
}
await recordCandidate('site', { buildCommand: 'npm run build:site' });
