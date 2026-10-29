import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveEntryRoute } from './entry-flow';

test('入口等待资料解析完成后再路由', () => {
  assert.equal(resolveEntryRoute({ loading: true, resolved: false, creatingNew: false, identityComplete: false }), 'wait');
  assert.equal(resolveEntryRoute({ loading: false, resolved: false, creatingNew: false, identityComplete: false }), 'wait');
});

test('资料不完整的新玩家先进入初始化', () => {
  assert.equal(resolveEntryRoute({ loading: false, resolved: true, creatingNew: false, identityComplete: false }), 'onboarding');
  assert.equal(resolveEntryRoute({ loading: false, resolved: true, creatingNew: true, identityComplete: true }), 'onboarding');
});

test('资料完整玩家才进入门场景', () => {
  assert.equal(resolveEntryRoute({ loading: false, resolved: true, creatingNew: false, identityComplete: true }), 'door');
});
