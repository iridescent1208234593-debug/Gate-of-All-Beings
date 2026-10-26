// Local immutable release assembly. This module has no remote/service operations.
import { createHash, randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, openSync, closeSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import runtimePaths from '../services/platform/runtime-paths.cjs';
import { candidateRoot, releaseRoot, verifyCandidate } from './release-artifacts.mjs';

const channel = path.join(releaseRoot, 'channels', `${runtimePaths.environment}.json`);
const digest = value => createHash('sha256').update(value).digest('hex');
const releasePattern = /^\d{8}T\d{9}Z-[a-f0-9]{12}-[a-f0-9]{12}$/;

function filesIn(directory, prefix = '') {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const key = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...filesIn(path.join(directory, entry.name), key));
    else if (entry.isFile()) result.push(key);
    else throw new Error(`Release rejects symbolic links and special files: ${key}`);
  }
  return result.sort();
}

function hashes(directory) {
  return Object.fromEntries(filesIn(directory).map(key => [key, digest(readFileSync(path.join(directory, key)))]));
}

export function verifyRelease(id) {
  if (!releasePattern.test(id)) throw new Error('Invalid release ID');
  const directory = path.join(releaseRoot, 'store', id);
  if (realpathSync(directory) !== path.resolve(directory) || realpathSync(path.join(directory, 'site')) !== path.resolve(directory, 'site')) throw new Error('Release directories must not be symbolic links');
  const manifest = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 1 || manifest.id !== id || typeof manifest.sourceHead !== 'string' ||
      !id.endsWith(`-${manifest.sourceHead.slice(0, 12)}-${digest(JSON.stringify(manifest.files)).slice(0, 12)}`) ||
      JSON.stringify(manifest.files) !== JSON.stringify(hashes(path.join(directory, 'site')))) {
    throw new Error(`Release manifest/hash verification failed: ${id}`);
  }
  return { directory, manifest, manifestSha256: digest(readFileSync(path.join(directory, 'manifest.json'))) };
}

function currentChannel() {
  if (!existsSync(channel)) return null;
  const value = JSON.parse(readFileSync(channel, 'utf8'));
  if (value.schema !== 1 || value.environment !== runtimePaths.environment || !releasePattern.test(value.current)) throw new Error('Invalid current release channel');
  return value;
}

function activate(id) {
  const verified = verifyRelease(id);
  const previous = currentChannel();
  const next = {
    schema: 1, environment: runtimePaths.environment,
    current: id, previous: previous?.current || null,
    site: `store/${id}/site`, sourceHead: verified.manifest.sourceHead,
    manifestSha256: verified.manifestSha256, updatedAt: new Date().toISOString(),
  };
  const temporary = `${channel}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`);
  try { renameSync(temporary, channel); }
  finally { rmSync(temporary, { force: true }); }
  return next;
}

async function withLock(run) {
  mkdirSync(path.dirname(channel), { recursive: true });
  const lock = `${channel}.lock`;
  const handle = openSync(lock, 'wx');
  try { return await run(); }
  finally { closeSync(handle); rmSync(lock); }
}

export async function sealRelease({ allowDirty = false } = {}) {
  return withLock(async () => {
    const records = await Promise.all(['site', 'modules', 'homepage'].map(verifyCandidate));
    if (new Set(records.map(record => record.sourceHead)).size !== 1) throw new Error('Candidates must come from the same source commit');
    if (!allowDirty && records.some(record => record.sourceDirty)) throw new Error('Commit changes and rebuild clean candidates before sealing');
    const sourceHead = records[0].sourceHead;
    if (!/^[a-f0-9]{40}$/.test(sourceHead)) throw new Error('Candidates require a valid source commit');
    const staging = path.join(releaseRoot, `.sealing-${randomUUID()}`);
    try {
      const site = path.join(staging, 'site');
      mkdirSync(staging);
      cpSync(path.join(candidateRoot, 'site'), site, { recursive: true });
      cpSync(path.join(candidateRoot, 'modules'), path.join(site, 'dist', 'modules'), { recursive: true });
      cpSync(path.join(candidateRoot, 'homepage'), path.join(site, 'apps', 'www'), { recursive: true });
      // The source candidates must still verify after copying; a concurrent build cannot be sealed accidentally.
      const after = await Promise.all(records.map(record => verifyCandidate(record.component)));
      if (JSON.stringify(after) !== JSON.stringify(records)) throw new Error('Candidate manifests changed during sealing');
      const files = hashes(site);
      for (const record of records) {
        const prefix = { site: '', modules: 'dist/modules/', homepage: 'apps/www/' }[record.component];
        for (const [key, hash] of Object.entries(record.files)) {
          // Generated module/homepage output deliberately overlays the source snapshot.
          if (record.component === 'site' && (key.startsWith('dist/modules/') || key === 'apps/www/index.html' || key.startsWith('apps/www/assets/homepage/'))) continue;
          if (files[prefix + key] !== hash) throw new Error(`Copied artifact hash mismatch: ${record.component}/${key}`);
        }
      }
      const id = `${new Date().toISOString().replace(/[-:.]/g, '')}-${sourceHead.slice(0, 12)}-${digest(JSON.stringify(files)).slice(0, 12)}`;
      const manifest = { schema: 1, id, sourceHead, createdAt: new Date().toISOString(), components: records, files };
      writeFileSync(path.join(staging, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
      const store = path.join(releaseRoot, 'store');
      mkdirSync(store, { recursive: true });
      renameSync(staging, path.join(store, id));
      return activate(id);
    } finally { rmSync(staging, { recursive: true, force: true }); }
  });
}

export async function rollbackRelease(id) {
  return withLock(() => activate(id));
}

export async function main(args = process.argv.slice(2)) {
  const [command, id, ...extra] = args;
  if (extra.length || !['all', 'rollback'].includes(command) || (command === 'all' && id) || (command === 'rollback' && !id)) {
    throw new Error('Usage: node scripts/publish-release.mjs all | rollback RELEASE_ID. Partial source-tree publishing is retired; rebuild all three candidates.');
  }
  const result = command === 'all' ? await sealRelease() : await rollbackRelease(id);
  console.log(JSON.stringify(result, null, 2));
  console.log('[release] Local channel updated. Services were not restarted; persistent data was not changed.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
