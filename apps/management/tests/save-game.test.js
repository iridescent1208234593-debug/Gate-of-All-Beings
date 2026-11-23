import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unifiedStorage} from '@lxh/shared-session/kv.js';
import {createInitialState} from '../src/core/gameState.js';
import {login, logout, restoreSession} from '../src/systems/account.js';
import {readLocalSave, openSave, saveGame} from '../src/systems/saveGame.js';

const storage = unifiedStorage('management');
const key = (uid = 'guest') => 'lingjing-huiguan-save-' + uid;
const snapshot = (state, version = '0.2.0') => JSON.stringify({version, state});

test('legacy and current saves load; invalid data is explicit and never overwritten', async () => {
  const state = createInitialState();
  storage.setItem(key(), snapshot({...state, version: '0.1.0'}, '0.1.0'));
  assert.equal(readLocalSave(null).status, 'ok');
  storage.setItem(key(), snapshot(state));
  assert.equal(readLocalSave(null).status, 'ok');
  for (const [bad, message] of [
    ['{invalid', /无法读取/],
    [snapshot({...state, space: undefined}), /字段缺失或损坏/],
    [snapshot(state, '9.0.0'), /版本不兼容/],
    [snapshot({...state, version: '9.0.0'}), /版本不兼容/],
  ]) {
    storage.setItem(key(), bad);
    const slot = await openSave(null);
    assert.match(slot.hint, message);
    assert.equal(slot.state, null);
    assert.equal(saveGame(state, slot), false);
    assert.equal(storage.getItem(key()), bad);
  }
  storage.removeItem(key());
});

test('account switches isolate snapshots; unavailable or invalid cloud protects both good copies', async (t) => {
  const state = createInitialState();
  const guest = {...state, tick: 1};
  const alice = {...state, tick: 2};
  const bob = {...state, tick: 3};
  storage.setItem(key(), snapshot(guest));
  storage.setItem(key('11'), snapshot(alice));
  storage.setItem(key('22'), snapshot(bob));
  let active = null, outage = false, malformed = false, unrelated404 = false, failLogout = false;
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    const path = new URL(url).pathname;
    if (path === '/api/auth') {
      active = JSON.parse(opts.body).username === 'one' ? '11' : '22';
      return Response.json({user: {kind: 'local', uid: active}});
    }
    if (path === '/api/user') return Response.json({logged_in: !!active, user_id: active, kind: 'local'});
    if (path === '/api/game/load') {
      if (outage) throw new Error('fixture offline');
      if (malformed) return Response.json({ok: true, state: {version:'8.0.0'}});
      if (unrelated404) return Response.json({error:'not found'}, {status:404});
      if (active === '11') return Response.json({ok: true, state: {...alice, tick: 4}});
      return Response.json({error:'暂无云存档'}, {status:404});
    }
    if (path === '/api/game/save') {
      writes.push([active,JSON.parse(opts.body).state.tick]);
      return Response.json({ok: true});
    }
    if (path === '/api/logout') {
      if (failLogout) throw new Error('fixture offline');
      active = null;
      return Response.json({ok: true});
    }
    throw new Error('unexpected test route');
  });

  const before = await openSave(null);
  assert.equal(before.state.tick, 1);
  const a = (await login('one', 'fixture')).user;
  outage = true;
  const offline = await openSave(a);
  assert.equal(offline.state.tick, 2);
  assert.match(offline.hint, /云端存档暂不可读取/);
  assert.equal(saveGame({...state, tick: 5}, offline), false);
  outage = false;
  malformed = true;
  const invalid = await openSave(a);
  assert.equal(invalid.state.tick, 2);
  assert.match(invalid.hint, /版本不兼容/);
  assert.equal(saveGame(state, invalid), false);
  malformed = false;
  unrelated404 = true;
  assert.equal((await openSave(a)).writable, false, 'an unrelated 404 does not prove the cloud is empty');
  unrelated404 = false;
  assert.deepEqual(writes, []);

  const online = await openSave(a);
  assert.equal(online.state.tick, 4);
  assert.equal(saveGame(online.state, online), true);
  const b = (await login('two', 'fixture')).user;
  const available = await openSave(b);
  assert.equal(available.state.tick, 3);
  assert.equal(saveGame(online.state, online), false, 'Alice cannot write with Bob selected');
  assert.equal(saveGame(before.state, before), false, 'guest slot is stale while signed in');
  assert.equal(saveGame(available.state, available), true);
  failLogout = true;
  await assert.rejects(logout(), /fixture offline/);
  assert.equal((await openSave(b)).state.tick, 3);
  failLogout = false;
  await logout();
  assert.equal(saveGame(available.state, available), false, 'Bob cannot write after logout');
  assert.equal((await openSave(null)).state.tick, 1);
  assert.equal(readLocalSave(a).state.tick, 4);
  assert.equal(readLocalSave(b).state.tick, 3);
  assert.deepEqual(writes, [['11',4],['22',3]]);

  await login('one', 'fixture');
  active = null; // Authoritative session no longer exists.
  assert.equal(await restoreSession(), null);
  assert.equal(readLocalSave().state.tick, 1);
});
