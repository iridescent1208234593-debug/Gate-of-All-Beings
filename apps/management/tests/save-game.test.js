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

  const conflict = await openSave(a);
  assert.equal(conflict.state.tick, 2, 'prefer the protected local copy when cloud differs');
  assert.equal(conflict.writable, false);
  assert.match(conflict.hint, /保留两份/);
  assert.equal(saveGame(conflict.state, conflict), false);
  assert.equal(readLocalSave(a).state.tick, 2);
  assert.deepEqual(writes, []);
  storage.setItem(key('11'), snapshot({...alice, tick: 4}));

  const online = await openSave(a);
  assert.equal(online.writable, true, 'equivalent copies remain writable');
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

test('unconfirmed local-only progress survives same-account reentry', async t => {
  const state = createInitialState();
  const cloud = {...state, tick: 4};
  storage.removeItem(key('33'));
  let active = false, saves = 0;
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    const path = new URL(url).pathname;
    if (path === '/api/auth') { active = true; return Response.json({user: {kind: 'local', uid: '33'}}); }
    if (path === '/api/logout') { active = false; return Response.json({ok: true}); }
    if (path === '/api/game/load') { assert(active); return Response.json({ok: true, state: cloud}); }
    if (path === '/api/game/save') { saves++; return Response.json({ok: true}); }
    throw new Error('unexpected test route');
  });
  const a = (await login('one', 'fixture')).user;
  const old = await openSave(a);
  assert.equal(saveGame({...cloud, tick: 9}, old, {localOnly: true}), true);
  await logout();
  await login('one', 'fixture');
  const resumed = await openSave(a);
  assert.equal(resumed.state.tick, 9);
  assert.equal(resumed.writable, true, 'same-owner local progress is safe when the confirmed cloud base is unchanged');
  assert.equal(saveGame(resumed.state, resumed, {localOnly: true}), true);
  assert.equal(readLocalSave(a).state.tick, 9);
  assert.equal(cloud.tick, 4);
  cloud.tick = 6; // Another device wrote against the same base.
  const conflict = await openSave(a);
  assert.match(conflict.hint, /保留两份/);
  assert.equal(conflict.state.tick, 9);
  assert.equal(saveGame(conflict.state, conflict), false);
  assert.equal(saves, 0);
  await logout();
});

test('detects a local slot changed by another mounted copy before writing', async () => {
  const state = createInitialState();
  storage.setItem(key(), snapshot(state));
  const slot = await openSave(null);
  assert.equal(slot.writable, true);
  storage.setItem(key(), snapshot({...state, tick: 9}));
  assert.equal(saveGame({...state, tick: 5}, slot), false);
  assert.equal(slot.writable, false);
  assert.match(slot.hint, /发生变化/);
  assert.equal(readLocalSave(null).state.tick, 9);
  storage.removeItem(key());
});

test('wait for cloud POST acknowledgement without overwriting newer local work', async t => {
  const state = createInitialState();
  let remote = {...state, tick: 2};
  let releasePost;
  const gate = new Promise(resolve => { releasePost = resolve; });
  const sent = [];
  const uid = '44';
  storage.removeItem(key(uid));
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    const path = new URL(url).pathname;
    if (path === '/api/auth') return Response.json({user: {kind: 'local', uid}});
    if (path === '/api/logout') return Response.json({ok: true});
    if (path === '/api/game/load') return Response.json({ok: true, state: remote});
    if (path === '/api/game/save') {
      const sentState = JSON.parse(opts.body).state;
      sent.push(sentState.tick);
      await gate;
      remote = sentState;
      return Response.json({ok: true});
    }
    throw new Error('unexpected test route');
  });
  const user = (await login('one', 'fixture')).user;
  const slot = await openSave(user);
  assert.equal(saveGame({...state, tick: 3}, slot), true);
  assert.equal(saveGame({...state, tick: 4}, slot), true);
  assert.deepEqual(sent, [3]);
  assert.equal(readLocalSave(user).state.tick, 4);
  releasePost();
  await slot.pendingCloud;
  assert.equal(remote.tick, 3);
  const reopened = await openSave(user);
  assert.equal(reopened.state.tick, 4);
  assert.equal(reopened.writable, true);

  const raw = storage.getItem(key(uid));
  assert.equal(readLocalSave({kind: 'usso', uid}).status, 'invalid');
  assert.equal(storage.getItem(key(uid)), raw, 'do not assign same numeric ID across login kinds');
  await logout();
});
