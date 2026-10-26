import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import type { OutputBundle } from 'rollup';

// Writes preload-manifest.json next to index.html. The start screen hands it to zszm-sw.js:
// critical files stay cached until the version changes, extra files only for the current page load.
// version is a hash of every emitted file name; Vite names carry content hashes, so any content change moves it.
const CRITICAL_CHUNKS = /\/src\/(game\/(GameApp|ModeHall|PlayerAvatar)|onboarding\/PlayerOnboarding|embed\/gateEmbed)\.tsx?$/;
const CRITICAL_ASSETS = /src\/gate\/(door-assets|audio)\//;
const FONT = /\.(ttf|otf|woff2?)$/;

export type PreloadEntry = { url: string; size: number };
export type PreloadManifest = { version: string; critical: PreloadEntry[]; extra: PreloadEntry[] };

function size(item: OutputBundle[string]) {
  return item.type === 'chunk' ? Buffer.byteLength(item.code) : typeof item.source === 'string' ? Buffer.byteLength(item.source) : item.source.byteLength;
}

export function preloadManifestPlugin(): Plugin {
  let base = '/';
  return {
    name: 'zszm-preload-manifest',
    apply: 'build',
    configResolved(config) { base = config.base; },
    generateBundle(_options, bundle) {
      const critical = new Set<string>();
      const visit = (fileName: string) => {
        const item = bundle[fileName];
        // Fonts (several MB each) stay extra: the size limit for slow connections then applies to them.
        if (!item || critical.has(fileName) || FONT.test(fileName)) return;
        critical.add(fileName);
        if (item.type !== 'chunk') return;
        item.imports.forEach(visit);
        item.viteMetadata?.importedCss.forEach(visit);
        item.viteMetadata?.importedAssets.forEach(visit);
      };
      for (const item of Object.values(bundle)) {
        // moduleIds, not facadeModuleId: Rollup leaves the facade empty when a lazy entry shares its chunk.
        if (item.type === 'chunk' && (item.isEntry || item.moduleIds.some(id => CRITICAL_CHUNKS.test(id.replace(/\\/g, '/'))))) visit(item.fileName);
        if (item.type === 'asset' && item.originalFileNames.some(name => CRITICAL_ASSETS.test(name.replace(/\\/g, '/')))) visit(item.fileName);
      }
      const files = Object.keys(bundle).filter(name => name.startsWith('assets/') && !name.endsWith('.map')).sort();
      const entry = (name: string): PreloadEntry => ({ url: base + name, size: size(bundle[name]) });
      const manifest: PreloadManifest = {
        version: createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 16),
        critical: files.filter(name => critical.has(name)).map(entry),
        extra: files.filter(name => !critical.has(name)).map(entry),
      };
      this.emitFile({ type: 'asset', fileName: 'preload-manifest.json', source: JSON.stringify(manifest) });
    },
  };
}
