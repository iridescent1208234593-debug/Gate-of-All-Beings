import path from 'node:path';
import { rmSync } from 'node:fs';
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
await recordCandidate('site', { buildCommand: 'npm run build:site' });
