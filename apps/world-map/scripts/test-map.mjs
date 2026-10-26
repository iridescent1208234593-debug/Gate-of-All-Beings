import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
for (const [command, args] of [
  [process.execPath, ['--experimental-strip-types', '--test', 'scripts/coordinates.test.mjs']],
  [python, ['scripts/test-tiles.py']],
]) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
