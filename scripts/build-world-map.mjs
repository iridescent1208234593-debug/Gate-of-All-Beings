import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { candidateRoot, projectRoot, recordCandidate } from './release-artifacts.mjs';

const appRoot = path.join(projectRoot, 'server', 'app', 'src', 'world-map');
const output = path.join(candidateRoot, 'world-map');
const viteEntry = path.join(projectRoot, 'node_modules', 'vite', 'dist', 'node', 'index.js');

if (!existsSync(viteEntry)) throw new Error('World map build requires root dependencies; run npm ci first.');
const { build } = await import(pathToFileURL(viteEntry).href);
await build({
  root: appRoot,
  configFile: path.join(appRoot, 'vite.config.ts'),
  base: '/app/modules/world-map/',
  build: { outDir: output, emptyOutDir: true },
});

const record = await recordCandidate('world-map');
console.log(`[world-map] Candidate ready: ${output}; ${Object.keys(record.files).length} hashed files.`);
