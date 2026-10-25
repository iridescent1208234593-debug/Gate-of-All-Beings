import { createRequire } from 'node:module';
import path from 'node:path';
import { projectRoot } from './release-artifacts.mjs';

/** Bundle existing API factories so sealed releases need no workspace dependencies. */
export async function buildRuntime(siteRoot) {
  const { build } = createRequire(path.join(projectRoot, 'server/app/src/cards/package.json'))('esbuild');
  for (const [entry, output] of [
    ['server/app/src/cards/server/balance-service.ts', 'server/app/src/cards/server/balance-service.mjs'],
    ['server/app/src/softie-webgpu/server/spirit-service.js', 'server/app/src/softie-webgpu/server/spirit-service.mjs'],
  ]) {
    await build({
      entryPoints: [path.join(projectRoot, entry)],
      outfile: path.join(siteRoot, output),
      bundle: true, platform: 'node', format: 'esm', target: 'node24',
      banner: { js: "import {createRequire as __iridescentlyCreateRequire} from 'node:module';const require=__iridescentlyCreateRequire(import.meta.url);" },
      logLevel: 'warning',
    });
  }
}
