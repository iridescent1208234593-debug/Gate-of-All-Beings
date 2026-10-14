import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { rename } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { candidateRoot, projectRoot, releaseRoot, verifyCandidate } from './release-artifacts.mjs';

// Windows file scanners can briefly hold a just-copied directory open.
async function promoteRename(source, target) {
  for (let attempt = 0; ; attempt++) {
    try { await rename(source, target); return; }
    catch (error) {
      if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 12) throw error;
      await delay(Math.min(500, 50 * (attempt + 1)));
    }
  }
}

const command = process.argv[2];
if (!['homepage', 'modules', 'site'].includes(command) || process.argv.length > 3) {
  throw new Error('Usage: node ops/publish-release.mjs homepage|modules|site');
}
const components = command === 'modules' ? ['modules', 'homepage'] : [command];
const productionRecord = path.join(releaseRoot, 'production.json');
const previous = existsSync(productionRecord) ? JSON.parse(readFileSync(productionRecord, 'utf8')) : { components: [] };
// Validate every candidate before touching any production output.
const records = await Promise.all(components.map(verifyCandidate));
const homepage = path.join(candidateRoot, 'homepage');
if (command !== 'site' && (!existsSync(path.join(homepage, 'index.html')) || !existsSync(path.join(homepage, 'assets/homepage/homepage.js')))) {
  throw new Error('Homepage candidate is incomplete.');
}
if (command === 'modules') {
  for (const name of ['management', 'ecology', 'cards', 'softie', 'juling', 'slay', 'aeon']) {
    if (!existsSync(path.join(candidateRoot, 'modules', name, 'index.html'))) throw new Error(`Missing module: ${name}`);
  }
}
const promotionRoot = path.join(releaseRoot, '.promotion');
if (existsSync(promotionRoot)) throw new Error('An unfinished publish exists in .releases/.promotion; inspect it before retrying.');
mkdirSync(releaseRoot, { recursive: true });
mkdirSync(promotionRoot);
// Copy first, so a copy error leaves the running site intact.
const swaps = [];
if (command === 'modules') {
  for (const name of ['management', 'ecology', 'cards', 'softie', 'juling', 'slay', 'aeon']) {
    swaps.push({ source: `modules/${name}`, target: `server/app/modules/${name}` });
  }
}
if (command === 'site') {
  swaps.push({ source: 'site', target: '.releases/production/site' });
} else {
  swaps.push({ source: 'homepage/assets/homepage', target: 'portal/www/assets/homepage' });
// Update HTML last, after its matching assets are in place.
swaps.push({ source: 'homepage/index.html', target: 'portal/www/index.html' });
}
const completed = [];
try {
  for (const component of components) cpSync(path.join(candidateRoot, component), path.join(promotionRoot, component), { recursive: true });
  for (const [index, swap] of swaps.entries()) {
    const target = path.join(projectRoot, swap.target);
    const backup = path.join(promotionRoot, 'previous', String(index));
    const entry = { target, backup, oldMoved: false, installed: false };
    completed.push(entry);
    mkdirSync(path.dirname(target), { recursive: true });
    mkdirSync(path.dirname(backup), { recursive: true });
    if (existsSync(target)) {
      await promoteRename(target, backup);
      entry.oldMoved = true;
    }
    await promoteRename(path.join(promotionRoot, swap.source), target);
    entry.installed = true;
  }
  const merged = [...(previous.components || []).filter(record => !components.includes(record.component)), ...records];
  const nextRecord = path.join(promotionRoot, 'production.json');
  writeFileSync(nextRecord, `${JSON.stringify({ publishedAt: new Date().toISOString(), components: merged }, null, 2)}\n`);
  await promoteRename(nextRecord, productionRecord);
} catch (error) {
  const rollbackErrors = [];
  for (const entry of completed.reverse()) {
    try {
      if (entry.installed) rmSync(entry.target, { recursive: true, force: true });
      if (entry.oldMoved) await promoteRename(entry.backup, entry.target);
    } catch (rollbackError) {
      rollbackErrors.push(`${entry.target}: ${rollbackError.message}`);
    }
  }
  if (rollbackErrors.length) throw new Error(`${error.message}; rollback incomplete; backups retained in ${promotionRoot}: ${rollbackErrors.join('; ')}`);
  rmSync(promotionRoot, { recursive: true, force: true });
  throw new Error(`${error.message}; previous production outputs restored.`);
}
try {
  rmSync(promotionRoot, { recursive: true, force: true });
} catch (error) {
  console.warn(`[publish] Published successfully; previous outputs remain in ${promotionRoot}: ${error.message}`);
}
console.log(`[publish] Explicitly published ${components.join(' + ')}. Production record: .releases/production.json`);
