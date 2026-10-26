import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const temporary = await mkdtemp(path.join(os.tmpdir(), 'iridescently-release-test-'));
const previous = { ...process.env };
try {
  process.env.IRIDESCENTLY_ENVIRONMENT = 'test';
  process.env.IRIDESCENTLY_STORAGE_ROOT = temporary;
  for (const name of ['IRIDESCENTLY_DATA_ROOT', 'IRIDESCENTLY_ASSETS_ROOT', 'IRIDESCENTLY_CACHE_ROOT', 'IRIDESCENTLY_RELEASE_ROOT']) delete process.env[name];
  const { candidateRoot, recordCandidate, releaseRoot, verifyCandidate } = await import('./release-artifacts.mjs');
  assert.ok(releaseRoot.startsWith(temporary + path.sep));
  const component = path.join(candidateRoot, 'test-component');
  await mkdir(component, { recursive: true });
  await writeFile(path.join(component, 'index.html'), '<p>fixture</p>');
  const record = await recordCandidate('test-component', { buildCommand: 'fixture', sourceHead: 'cannot override commit' });
  assert.match(record.sourceHead, /^[a-f0-9]{40}$/);
  assert.match(record.files['index.html'], /^[a-f0-9]{64}$/);
  assert.equal((await verifyCandidate('test-component')).sourceHead, record.sourceHead);
  await writeFile(path.join(component, 'index.html'), '<p>tampered</p>');
  await assert.rejects(verifyCandidate('test-component'), /SHA-256 mismatch/);
  await assert.rejects(recordCandidate('../outside'), /Invalid release component/);
  console.log('[release-artifacts] isolated root, commit trace, hash/tamper and traversal checks passed');
} finally {
  process.env = previous;
  await rm(temporary, { recursive: true, force: true });
}
