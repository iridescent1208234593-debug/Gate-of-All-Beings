import { createRequire } from 'node:module';
import path from 'node:path';
import { projectRoot } from './release-artifacts.mjs';

/** Bundle existing API factories so sealed releases need no workspace dependencies. */
export async function buildRuntime(siteRoot) {
  const { build } = createRequire(path.join(projectRoot, 'apps/cards/package.json'))('esbuild');
  for (const [entry, output] of [
    ['apps/cards/server/balance-service.ts', 'apps/cards/server/balance-service.mjs'],
    ['apps/softie/server/spirit-service.js', 'apps/softie/server/spirit-service.mjs'],
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
