import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { candidateRoot, recordCandidate } from './release-artifacts.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(projectRoot, 'server', 'app', 'src', 'cards');
const output = path.join(candidateRoot, 'cards');
const relative = path.relative(candidateRoot, output);
if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
  throw new Error(`Refusing to clean outside candidate output: ${output}`);
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
const vite = path.join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const result = spawnSync(process.execPath, [vite, 'build', '--base', '/app/modules/cards/', '--outDir', output, '--emptyOutDir'], {
  cwd: appRoot,
  stdio: 'inherit',
});
if (result.status !== 0) throw new Error('Cards production build failed.');

const record = await recordCandidate('cards');
console.log(`[cards] Candidate ready: ${output}; ${Object.keys(record.files).length} hashed files.`);
