import { accessSync, constants, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { rename } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { candidateRoot, projectRoot, releaseRoot, verifyCandidate } from './release-artifacts.mjs';

function logFilesystem(operation, source, destination, attempt, phase, error = null) {
  const entry = {
    timestamp: new Date().toISOString(), operation, source, destination, attempt, phase,
    errno: error?.errno ?? null,
    code: error?.code ?? null,
    syscall: error?.syscall ?? null,
    path: error?.path ?? null,
    dest: error?.dest ?? null,
  };
  try { process.stderr.write(`[release-fs] ${JSON.stringify(entry)}\n`); } catch {}
}

function filesystemStep(operation, source, destination, attempt, run) {
  logFilesystem(operation, source, destination, attempt, 'start');
  try {
    const result = run();
    if (result && typeof result.then === 'function') {
      return result.then(value => {
        logFilesystem(operation, source, destination, attempt, 'success');
        return value;
      }, error => {
        logFilesystem(operation, source, destination, attempt, 'error', error);
        throw error;
      });
    }
    logFilesystem(operation, source, destination, attempt, 'success');
    return result;
  } catch (error) {
    logFilesystem(operation, source, destination, attempt, 'error', error);
    throw error;
  }
}

// Windows file scanners can briefly hold a just-copied directory open.
async function promoteRename(source, target) {
  for (let attempt = 0; ; attempt++) {
    try {
      await filesystemStep('rename', source, target, attempt + 1, () => rename(source, target));
      return;
    }
    catch (error) {
      if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 12) throw error;
      await delay(Math.min(500, 50 * (attempt + 1)));
    }
  }
}

const command = process.argv[2];
const moduleNames = ['management', 'ecology', 'cards', 'world-map', 'softie', 'juling', 'slay', 'aeon'];
if (!['homepage', 'modules', 'cards', 'world-map', 'site'].includes(command) || process.argv.length > 3) {
  throw new Error('Usage: node ops/publish-release.mjs homepage|modules|cards|world-map|site');
}
const components = command === 'modules' ? ['modules', 'homepage'] : [command];
const productionRecord = path.join(releaseRoot, 'production.json');
const previous = existsSync(productionRecord) ? JSON.parse(readFileSync(productionRecord, 'utf8')) : { components: [] };
// Validate every candidate before touching any production output.
const records = await Promise.all(components.map(verifyCandidate));
if (command === 'site') {
  const target = path.join(releaseRoot, 'production', 'site');
  const promotion = path.join(releaseRoot, '.promotion');
  const previousParent = path.join(promotion, 'previous');
  const volume = value => path.parse(path.resolve(value)).root.toLowerCase();
  const cwd = path.resolve(process.cwd());
  const normalizedTarget = `${path.resolve(target)}${path.sep}`.toLowerCase();
  const cwdIsInsideTarget = cwd.toLowerCase() === path.resolve(target).toLowerCase() || cwd.toLowerCase().startsWith(normalizedTarget);
  let productionParentWritable = false;
  let releaseRootWritable = false;
  try { accessSync(path.dirname(target), constants.W_OK); productionParentWritable = true; } catch {}
  try { accessSync(releaseRoot, constants.W_OK); releaseRootWritable = true; } catch {}
  const preflight = {
    timestamp: new Date().toISOString(), candidateManifestVerified: true,
    candidateExists: existsSync(path.join(candidateRoot, 'site')),
    productionExists: existsSync(target), unfinishedPromotionExists: existsSync(promotion),
    candidateVolume: volume(path.join(candidateRoot, 'site')),
    productionVolume: volume(target), previousVolume: volume(path.join(previousParent, '0')),
    sameVolume: volume(path.join(candidateRoot, 'site')) === volume(target) && volume(target) === volume(path.join(previousParent, '0')),
    productionParentWritable, releaseRootWritable, publisherCwd: cwd, publisherCwdInsideProduction: cwdIsInsideTarget,
    serviceLockState: 'NOT_QUERIED',
  };
  try { process.stderr.write(`[release-preflight] ${JSON.stringify(preflight)}\n`); } catch {}
}
const homepage = path.join(candidateRoot, 'homepage');
if (['homepage', 'modules'].includes(command) && (!existsSync(path.join(homepage, 'index.html')) || !existsSync(path.join(homepage, 'assets/homepage/homepage.js')))) {
  throw new Error('Homepage candidate is incomplete.');
}
if (command === 'cards' && !existsSync(path.join(candidateRoot, 'cards', 'index.html'))) {
  throw new Error('Cards candidate is incomplete.');
}
if (command === 'world-map' && !existsSync(path.join(candidateRoot, 'world-map', 'index.html'))) {
  throw new Error('World map candidate is incomplete.');
}
if (command === 'modules') {
  for (const name of moduleNames) {
    if (!existsSync(path.join(candidateRoot, 'modules', name, 'index.html'))) throw new Error(`Missing module: ${name}`);
  }
}
const promotionRoot = path.join(releaseRoot, '.promotion');
if (existsSync(promotionRoot)) throw new Error('An unfinished publish exists in .releases/.promotion; inspect it before retrying.');
filesystemStep('mkdir', null, releaseRoot, 1, () => mkdirSync(releaseRoot, { recursive: true }));
filesystemStep('mkdir', null, promotionRoot, 1, () => mkdirSync(promotionRoot));
// Copy first, so a copy error leaves the running site intact.
const swaps = [];
if (command === 'modules') {
  for (const name of moduleNames) {
    swaps.push({ source: `modules/${name}`, target: `server/app/modules/${name}` });
  }
}
if (command === 'cards') swaps.push({ source: 'cards', target: 'server/app/modules/cards' });
if (command === 'world-map') swaps.push({ source: 'world-map', target: 'server/app/modules/world-map' });
if (command === 'site') {
  swaps.push({ source: 'site', target: '.releases/production/site' });
} else if (command === 'homepage' || command === 'modules') {
  swaps.push({ source: 'homepage/assets/homepage', target: 'portal/www/assets/homepage' });
// Update HTML last, after its matching assets are in place.
swaps.push({ source: 'homepage/index.html', target: 'portal/www/index.html' });
}
const completed = [];
try {
  for (const [attempt, component] of components.entries()) {
    const source = path.join(candidateRoot, component);
    const destination = path.join(promotionRoot, component);
    filesystemStep('copy', source, destination, attempt + 1, () => cpSync(source, destination, { recursive: true }));
  }
  for (const [index, swap] of swaps.entries()) {
    const target = path.join(projectRoot, swap.target);
    const backup = path.join(promotionRoot, 'previous', String(index));
    const entry = { target, backup, oldMoved: false, installed: false };
    completed.push(entry);
    filesystemStep('mkdir', null, path.dirname(target), index + 1, () => mkdirSync(path.dirname(target), { recursive: true }));
    filesystemStep('mkdir', null, path.dirname(backup), index + 1, () => mkdirSync(path.dirname(backup), { recursive: true }));
    if (existsSync(target)) {
      await promoteRename(target, backup);
      entry.oldMoved = true;
    }
    await promoteRename(path.join(promotionRoot, swap.source), target);
    entry.installed = true;
  }
  const merged = [...(previous.components || []).filter(record => !components.includes(record.component)), ...records];
  const nextRecord = path.join(promotionRoot, 'production.json');
  filesystemStep('writeFile', null, nextRecord, 1, () => writeFileSync(nextRecord, `${JSON.stringify({ publishedAt: new Date().toISOString(), components: merged }, null, 2)}\n`));
  await promoteRename(nextRecord, productionRecord);
} catch (error) {
  const rollbackErrors = [];
  for (const entry of completed.reverse()) {
    try {
      if (entry.installed) filesystemStep('rm', entry.target, null, 1, () => rmSync(entry.target, { recursive: true, force: true }));
      if (entry.oldMoved) await promoteRename(entry.backup, entry.target);
    } catch (rollbackError) {
      rollbackErrors.push(`${entry.target}: ${rollbackError.message}`);
    }
  }
  if (rollbackErrors.length) throw new Error(`${error.message}; rollback incomplete; backups retained in ${promotionRoot}: ${rollbackErrors.join('; ')}`);
  filesystemStep('rm', promotionRoot, null, 1, () => rmSync(promotionRoot, { recursive: true, force: true }));
  throw new Error(`${error.message}; previous production outputs restored.`);
}
try {
  filesystemStep('rm', promotionRoot, null, 1, () => rmSync(promotionRoot, { recursive: true, force: true }));
} catch (error) {
  console.warn(`[publish] Published successfully; previous outputs remain in ${promotionRoot}: ${error.message}`);
}
console.log(`[publish] Explicitly published ${components.join(' + ')}. Production record: .releases/production.json`);
