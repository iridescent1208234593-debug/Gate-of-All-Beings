import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temporary = mkdtempSync(path.join(os.tmpdir(), 'iridescently-seal-test-'));
const original = { ...process.env };
try {
  process.env.IRIDESCENTLY_ENVIRONMENT = 'test';
  process.env.IRIDESCENTLY_STORAGE_ROOT = temporary;
  for (const name of ['IRIDESCENTLY_DATA_ROOT', 'IRIDESCENTLY_ASSETS_ROOT', 'IRIDESCENTLY_CACHE_ROOT', 'IRIDESCENTLY_RELEASE_ROOT']) delete process.env[name];
  const { candidateRoot, recordCandidate, releaseRoot } = await import('./release-artifacts.mjs');
  const { sealRelease, rollbackRelease, verifyRelease } = await import('./publish-release.mjs');
  const fixtures = {
    'site/server/app.py': 'print("fixture")',
    'modules/cards/index.html': '<p>cards</p>',
    'homepage/index.html': '<p>homepage</p>',
    'homepage/assets/homepage/homepage.js': 'console.log("homepage")',
  };
  for (const [key, value] of Object.entries(fixtures)) {
    const target = path.join(candidateRoot, key);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, value);
  }
  for (const component of ['site', 'modules', 'homepage']) {
    await recordCandidate(component);
    const name = path.join(candidateRoot, `${component}.json`);
    const record = JSON.parse(readFileSync(name, 'utf8'));
    record.sourceDirty = true; // Deterministic dirty-fixture guard even on a clean checkout.
    writeFileSync(name, JSON.stringify(record));
  }
  const data = path.join(temporary, 'test', 'data', 'users.db');
  mkdirSync(path.dirname(data), { recursive: true });
  writeFileSync(data, 'persistent fixture bytes');
  await assert.rejects(sealRelease(), /Commit changes and rebuild clean candidates/);
  const first = await sealRelease({ allowDirty: true });
  const firstVerified = verifyRelease(first.current);
  assert.equal(readFileSync(path.join(firstVerified.directory, 'site', 'server', 'app', 'modules', 'cards', 'index.html'), 'utf8'), '<p>cards</p>');
  writeFileSync(path.join(candidateRoot, 'homepage', 'index.html'), '<p>updated homepage</p>');
  await recordCandidate('homepage');
  const second = await sealRelease({ allowDirty: true });
  assert.equal(second.previous, first.current);
  assert.equal(readFileSync(path.join(firstVerified.directory, 'site', 'portal', 'www', 'index.html'), 'utf8'), '<p>homepage</p>');
  const restored = await rollbackRelease(first.current);
  assert.equal(restored.current, first.current);
  assert.equal(restored.previous, second.current);
  assert.equal(readFileSync(data, 'utf8'), 'persistent fixture bytes');
  writeFileSync(path.join(firstVerified.directory, 'site', 'server', 'app.py'), 'tampered');
  await assert.rejects(rollbackRelease(first.current), /verification failed/);
  await assert.rejects(rollbackRelease('../outside'), /Invalid release ID/);
  console.log('[release] immutable assembly, clean guard, pointer rollback, tamper rejection and data preservation passed');
} finally {
  process.env = original;
  rmSync(temporary, { recursive: true, force: true });
}
