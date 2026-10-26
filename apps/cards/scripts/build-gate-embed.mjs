/**
 * 门动画嵌入式内核打包脚本
 *
 * 把 src/embed/gateEmbed.ts 打成自包含 IIFE 单文件（three 内联），
 * 供 huiguan 静态站以 <script> 直接引用，不引入 React。
 *
 * 用法：node scripts/build-gate-embed.mjs
 */

import { build } from 'esbuild';
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'src', 'embed', 'gateEmbed.ts');
const projectRoot = path.resolve(root, '../..');
const outfile = process.env.GATE_OUTFILE || path.join(projectRoot, '.releases/candidate/gate/gate-scene.js');

mkdirSync(path.dirname(outfile), { recursive: true });

await build({
  entryPoints: [entry],
  absWorkingDir: root,
  bundle: true,
  format: 'iife',
  globalName: 'LXHGate',
  platform: 'browser',
  target: 'es2019',
  minify: true,
  loader: { '.json': 'json' },
  legalComments: 'none',
  outfile,
  write: true,
  metafile: true,
  logLevel: 'info',
});

const size = statSync(outfile).size;
console.log(`\n[gate-embed] 产物绝对路径: ${outfile}`);
console.log(`[gate-embed] 字节数: ${size} (${(size / 1024 / 1024).toFixed(3)} MB)`);
if (size > 3 * 1024 * 1024) {
  console.log('[gate-embed] 警告: 产物超过 3MB，请关注首屏加载成本。');
}
