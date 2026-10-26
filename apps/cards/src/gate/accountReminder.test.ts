import assert from 'node:assert/strict';
import test from 'node:test';
import { needsAccountAfterOnboarding } from './accountReminder';

test('a completed guest identity still needs the Huiguan account prompt', async () => {
  const request = async (_url: string, init: RequestInit) => {
    assert.equal(init.credentials, 'same-origin');
    assert.equal(init.cache, 'no-store');
    return { ok: true, json: async () => ({ logged_in: false }) } as Response;
  };
  assert.equal(await needsAccountAfterOnboarding(false, request as typeof fetch), true);
});

test('a real logged-in session suppresses the prompt even if the old state was guest', async () => {
  const request = async () => ({ ok: true, json: async () => ({ logged_in: true }) }) as Response;
  assert.equal(await needsAccountAfterOnboarding(false, request as typeof fetch), false);
});

test('a failed recheck uses the previously verified session state', async () => {
  const failed = async () => { throw new Error('network'); };
  assert.equal(await needsAccountAfterOnboarding(false, failed as typeof fetch), true);
  assert.equal(await needsAccountAfterOnboarding(true, failed as typeof fetch), false);
});
