// Stage 0 of docs/release-architecture-v2.md: does a live process whose cwd is inside
// .releases/production/site make the site publisher's directory rename fail with EPERM?
//
// Each scenario builds its own fake project tree under this folder, copies the real
// ops/publish-release.mjs + ops/release-artifacts.mjs into it unchanged, starts two
// stand-in services with the same cwd layout website-manager.py uses (line ~326):
//   portal     -> .releases/production/site/server
//   zszm-oauth -> .releases/production/site/server/app/src/cards
// stops some of them, then runs the copied publisher. Nothing outside this folder is touched;
// stand-ins listen on OS-assigned ports on 127.0.0.1 (never 8080/5174/5177/5178/4173).
//
// Usage: node work/publish-simulation-20261017/repro-cwd-lock.mjs [scenario ...]
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const realRoot = path.resolve(here, '..', '..');
const python = process.env.PYTHON || 'python';

const SERVICES = {
  portal: 'server',
  'zszm-oauth': 'server/app/src/cards',
};
const SCENARIOS = {
  'control-no-services': { start: [], stop: [] },
  'both-running': { start: ['portal', 'zszm-oauth'], stop: [] },
  'stop-portal-only': { start: ['portal', 'zszm-oauth'], stop: ['portal'] },
  'stop-oauth-only': { start: ['portal', 'zszm-oauth'], stop: ['zszm-oauth'] },
  'stop-both': { start: ['portal', 'zszm-oauth'], stop: ['portal', 'zszm-oauth'] },
};

function writeTree(dir, files) {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), text);
  }
}

function buildTree(root) {
  rmSync(root, { recursive: true, force: true });
  for (const name of ['publish-release.mjs', 'release-artifacts.mjs']) {
    mkdirSync(path.join(root, 'ops'), { recursive: true });
    cpSync(path.join(realRoot, 'ops', name), path.join(root, 'ops', name));
  }
  const layout = version => ({
    'VERSION.txt': `${version}\n`,
    'server/portal_server.py': `# fake portal ${version}\n`,
    'server/app/src/cards/server.py': `# fake zszm-oauth ${version}\n`,
  });
  writeTree(path.join(root, '.releases/production/site'), layout('old'));
  const candidate = path.join(root, '.releases/candidate/site');
  writeTree(candidate, layout('new'));
  // Same record shape as recordCandidate(), written directly so no git call is needed.
  const files = {};
  for (const name of Object.keys(layout('new')).sort()) {
    files[name] = createHash('sha256').update(readFileSync(path.join(candidate, name))).digest('hex');
  }
  writeFileSync(path.join(root, '.releases/candidate/site.json'),
    `${JSON.stringify({ schema: 1, component: 'site', builtAt: new Date().toISOString(), sourceHead: 'simulation', sourceDirty: false, files }, null, 2)}\n`);
}

function startService(root, key) {
  const cwd = path.join(root, '.releases/production/site', SERVICES[key]);
  const child = spawn(python, ['-m', 'http.server', '0', '--bind', '127.0.0.1'], { cwd, stdio: 'ignore', windowsHide: true });
  return { key, cwd, child, pid: child.pid };
}

function stopService(service) {
  return new Promise(resolve => {
    if (service.child.exitCode !== null || service.child.signalCode !== null) return resolve();
    service.child.once('exit', () => resolve());
    service.child.kill();
  });
}

async function runScenario(name) {
  const plan = SCENARIOS[name];
  const root = path.join(here, name);
  const lines = [];
  const note = text => { lines.push(`[repro] ${text}`); console.log(`[repro] ${name}: ${text}`); };
  buildTree(root);
  const services = plan.start.map(key => startService(root, key));
  // Give Python time to start and settle its cwd before measuring.
  await new Promise(resolve => setTimeout(resolve, 1500));
  for (const s of services) note(`started ${s.key} pid=${s.pid} alive=${s.child.exitCode === null} cwd=${s.cwd}`);
  for (const s of services.filter(s => plan.stop.includes(s.key))) {
    await stopService(s);
    note(`stopped ${s.key} pid=${s.pid} exitCode=${s.child.exitCode} signal=${s.child.signalCode}`);
  }
  const holders = services.filter(s => s.child.exitCode === null && s.child.signalCode === null);
  note(`still running with cwd inside production/site: ${holders.map(s => `${s.key}(pid=${s.pid})`).join(', ') || 'none'}`);
  const started = Date.now();
  const result = spawnSync(process.execPath, ['ops/publish-release.mjs', 'site'], { cwd: root, encoding: 'utf8' });
  const elapsed = Date.now() - started;
  lines.push(...(result.stderr || '').split(/\r?\n/).filter(Boolean));
  lines.push(...(result.stdout || '').split(/\r?\n/).filter(Boolean).map(line => `[stdout] ${line}`));
  const version = readFileSync(path.join(root, '.releases/production/site/VERSION.txt'), 'utf8').trim();
  const fsEvents = lines.filter(line => line.startsWith('[release-fs] ')).map(line => JSON.parse(line.slice(13)));
  const renameErrors = fsEvents.filter(e => e.operation === 'rename' && e.phase === 'error');
  const summary = {
    scenario: name,
    stillRunning: holders.map(s => s.key),
    publisherExit: result.status,
    elapsedMs: elapsed,
    productionVersionAfter: version,
    promotionLeftBehind: existsSync(path.join(root, '.releases/.promotion')),
    renameErrorCount: renameErrors.length,
    renameErrorCodes: [...new Set(renameErrors.map(e => `${e.code}/${e.errno}`))],
    firstFailedRename: renameErrors[0] ? { source: renameErrors[0].source, destination: renameErrors[0].destination } : null,
  };
  note(`summary ${JSON.stringify(summary)}`);
  await Promise.all(services.map(stopService));
  writeFileSync(path.join(here, `${name}.log`), `${lines.join('\n')}\n`);
  return summary;
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENARIOS);
for (const name of names) if (!SCENARIOS[name]) throw new Error(`Unknown scenario ${name}; choose from ${Object.keys(SCENARIOS).join(', ')}`);
const results = [];
for (const name of names) results.push(await runScenario(name));
writeFileSync(path.join(here, 'summary.json'), `${JSON.stringify({ ranAt: new Date().toISOString(), node: process.version, results }, null, 2)}\n`);
console.table(results.map(r => ({ scenario: r.scenario, running: r.stillRunning.join('+') || '-', exit: r.publisherExit, version: r.productionVersionAfter, renameErrors: r.renameErrorCount, codes: r.renameErrorCodes.join(' ') })));
