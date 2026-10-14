import path from 'node:path';
import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { projectRoot, recordCandidate } from './release-artifacts.mjs';

rmSync(path.join(projectRoot, '.releases/candidate/site.json'), { force: true });
const result = spawnSync('python', ['ops/build-site.py'], { cwd: projectRoot, stdio: 'inherit' });
if (result.status !== 0) throw new Error('Site source export failed');
const gate = spawnSync(process.execPath, ['server/app/src/cards/scripts/build-gate-embed.mjs'], { cwd: projectRoot, stdio: 'inherit', env: { ...process.env, GATE_OUTFILE: path.join(projectRoot, '.releases/candidate/site/portal/huiguan/assets/gate/gate-scene.js') } });
if (gate.status !== 0) throw new Error('Gate candidate build failed');
await recordCandidate('site');
