import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const operationsRoot = path.resolve(
  process.env.IRIDESCENTLY_OPS_ROOT || 'E:/External Projects/Iridescently Operations',
);
const entryName = process.argv[2];
if (!entryName || !/^[\w./-]+\.(?:mjs|py)$/.test(entryName) || entryName.split(/[\\/]/).includes('..')) {
  throw new Error('Usage: node tools/ops/run-ops.mjs <operations-entry.mjs|operations-entry.py> [args...]');
}
const entry = path.resolve(operationsRoot, entryName);
if (entry !== operationsRoot && !entry.startsWith(`${operationsRoot}${path.sep}`)) {
  throw new Error(`Refusing to run outside the operations directory: ${entryName}`);
}
if (!existsSync(entry)) throw new Error(`Operations tool not found: ${entry}. Set IRIDESCENTLY_OPS_ROOT to its directory.`);
const result = spawnSync(
  entry.endsWith('.py') ? (process.env.PYTHON || 'python') : process.execPath,
  [entry, ...process.argv.slice(3)], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      IRIDESCENTLY_PROJECT_ROOT: projectRoot,
      IRIDESCENTLY_OPS_ROOT: operationsRoot,
    },
  });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
