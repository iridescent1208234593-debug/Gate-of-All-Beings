// 测试用模块加载钩子：让 node --test 直接加载 Next.js 路由源码，且不连接数据库。
// - "@/..." 路径别名 → src/...（补全 .ts / index.ts）
// - 无扩展名的相对导入 → 补全 .ts / index.ts
// - "@/server/activation"、"@/server/admin" → 记录调用的桩模块（业务层不在本测试范围）
// - "next/server"（CommonJS，无法被 ESM 具名导入）→ 具名导出的薄封装
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = new URL('../../', import.meta.url);
const srcRoot = new URL('src/', appRoot);
const STUBBED = {
  '@/server/activation': new URL('server/activation/service.ts', srcRoot),
  '@/server/admin': new URL('server/admin/service.ts', srcRoot),
};

function withTsExtension(url) {
  const base = fileURLToPath(url);
  for (const candidate of ['', '.ts', '.tsx', '/index.ts']) {
    const path = base + candidate;
    if (existsSync(path) && statSync(path).isFile()) return pathToFileURL(path).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  const fromSrc = context.parentURL?.startsWith(srcRoot.href);

  if (specifier in STUBBED) {
    return { url: `activation-test:stub?module=${encodeURIComponent(specifier)}`, shortCircuit: true };
  }
  if (specifier === 'next/server' && fromSrc) {
    return { url: 'activation-test:next-server', shortCircuit: true };
  }
  if (specifier.startsWith('@/')) {
    const url = withTsExtension(new URL(specifier.slice(2), srcRoot));
    if (url) return { url, shortCircuit: true };
  }
  if (fromSrc && (specifier.startsWith('./') || specifier.startsWith('../'))) {
    const url = withTsExtension(new URL(specifier, context.parentURL));
    if (url) return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === 'activation-test:next-server') {
    const packageJson = fileURLToPath(new URL('package.json', appRoot));
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        import { createRequire } from 'node:module';
        const server = createRequire(${JSON.stringify(packageJson)})('next/server');
        export const NextRequest = server.NextRequest;
        export const NextResponse = server.NextResponse;
      `,
    };
  }

  if (url.startsWith('activation-test:stub?')) {
    const specifier = decodeURIComponent(new URL(url).searchParams.get('module'));
    const source = readFileSync(STUBBED[specifier], 'utf8');
    const names = [...source.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map((m) => m[1]);
    return {
      format: 'module',
      shortCircuit: true,
      source: names
        .map((name) => `export function ${name}(...args) {
          (globalThis.__adminRouteStubCalls ??= []).push(${JSON.stringify(name)});
          return Promise.resolve(globalThis.__adminRouteStubResult?.(${JSON.stringify(name)}, args));
        }`)
        .join('\n'),
    };
  }

  return nextLoad(url, context);
}
