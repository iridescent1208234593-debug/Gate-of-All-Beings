import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const projectRoot = path.resolve(
  process.env.IRIDESCENTLY_PROJECT_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
);
export const releaseRoot = path.join(projectRoot, '.releases');
export const candidateRoot = path.join(releaseRoot, 'candidate');

function gitValue(args) {
  const result = spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() || null : null;
}

function safeRepositoryUrl(value) {
  if (!value) return null;
  const scp = value.match(/^[^@]+@([^:]+):(.+)$/);
  if (scp) return `https://${scp[1]}/${scp[2].replace(/\.git$/, '')}`;
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.href.replace(/\.git$/, '');
  } catch {
    return null;
  }
}

async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function filesIn(dir, prefix = '') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await filesIn(path.join(dir, entry.name), name));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Release artifacts must be regular files/directories: ${name}`);
  }
  return files.sort();
}

export async function recordCandidate(component, metadata = {}) {
  const dir = path.join(candidateRoot, component);
  const hashes = {};
  for (const name of await filesIn(dir)) hashes[name] = await hashFile(path.join(dir, name));
  const status = gitValue(['status', '--porcelain', '--untracked-files=normal']);
  const remote = gitValue(['remote', 'get-url', 'origin']);
  const record = {
    schema: 1,
    component,
    builtAt: new Date().toISOString(),
    sourceRepository: safeRepositoryUrl(remote),
    sourceBranch: gitValue(['branch', '--show-current']),
    sourceHead: gitValue(['rev-parse', 'HEAD']),
    sourceDirty: Boolean(status),
    buildEnvironment: { node: process.version, platform: process.platform, arch: process.arch },
    ...metadata,
    files: hashes,
  };
  await mkdir(candidateRoot, { recursive: true });
  await writeFile(path.join(candidateRoot, `${component}.json`), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

export async function verifyCandidate(component) {
  const record = JSON.parse(await readFile(path.join(candidateRoot, `${component}.json`), 'utf8'));
  if (record.schema !== 1 || record.component !== component || !record.files || typeof record.files !== 'object') {
    throw new Error(`Invalid ${component} candidate record; rebuild first.`);
  }
  const dir = path.join(candidateRoot, component);
  const names = await filesIn(dir);
  if (!names.length || JSON.stringify(names) !== JSON.stringify(Object.keys(record.files).sort())) {
    throw new Error(`${component} candidate file set changed; rebuild first.`);
  }
  for (const name of names) {
    if (await hashFile(path.join(dir, name)) !== record.files[name]) throw new Error(`${component} SHA-256 mismatch: ${name}`);
  }
  return record;
}
