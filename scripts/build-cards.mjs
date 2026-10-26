import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { candidateRoot, projectRoot, recordCandidate } from './release-artifacts.mjs';

const appRoot = path.join(projectRoot, 'apps', 'cards');
const output = path.join(candidateRoot, 'cards');
const publicStage = path.join(candidateRoot, '.cards-public');
const relative = path.relative(candidateRoot, output);
if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
  throw new Error(`Refusing to clean outside candidate output: ${output}`);
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
rmSync(publicStage, { recursive: true, force: true });
mkdirSync(publicStage, { recursive: true });
const trackedPublic = execFileSync('git', ['ls-files', '-z', 'apps/cards/public'], { cwd: projectRoot, encoding: 'utf8' })
  .split('\0').filter(Boolean);
for (const file of trackedPublic) {
  const relative = file.slice('apps/cards/public/'.length);
  const source = path.resolve(projectRoot, file);
  const target = path.resolve(publicStage, relative);
  const targetRelative = path.relative(publicStage, target);
  if (!targetRelative || targetRelative === '..' || targetRelative.startsWith(`..${path.sep}`) || path.isAbsolute(targetRelative)) {
    throw new Error(`Refusing to copy outside staged public assets: ${file}`);
  }
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(source, target);
}

const viteEntry = path.join(appRoot, 'node_modules', 'vite', 'dist', 'node', 'index.js');
const { build } = await import(pathToFileURL(viteEntry).href);
try {
  await build({
    root: appRoot,
    configFile: path.join(appRoot, 'vite.config.ts'),
    base: '/app/modules/cards/',
    publicDir: publicStage,
    build: { outDir: output, emptyOutDir: true },
  });
} catch (error) {
  throw new Error('Cards production build failed.', { cause: error });
} finally {
  rmSync(publicStage, { recursive: true, force: true });
}

const record = await recordCandidate('cards', { buildCommand: 'npm run build:cards' });
console.log(`[cards] Candidate ready: ${output}; ${Object.keys(record.files).length} hashed files.`);
