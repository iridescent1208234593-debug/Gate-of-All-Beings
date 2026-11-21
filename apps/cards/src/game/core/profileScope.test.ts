import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_IDENTITY,
  GUEST_IDENTITY_KEY,
  GUEST_ROSTER_KEY,
  accountScope,
  assertIdentitySaveTarget,
  buildIdentitySave,
  readGuestIdentity,
  readGuestRoster,
  resolveProfileSnapshot,
  writeGuest,
  type Account,
  type GateIdentity,
  type GuestStorage,
} from '../profileScope.ts';

const localA: Account = { logged_in: true, kind: 'local', user_id: 'A' };
const localB: Account = { logged_in: true, kind: 'local', user_id: 'B' };
const guest: Account = { logged_in: false };
const guestIdentity: GateIdentity = {
  ...EMPTY_IDENTITY, id: 'guest-main', display_name: '访客甲', species_name: '人类',
  avatar_frame_id: 'r01', avatar_mode: 'default',
};
const identityA: GateIdentity = {
  ...EMPTY_IDENTITY, id: 'a-main', display_name: '账户甲', species_name: '猫妖', avatar_mode: 'upload',
  avatar_asset_id: `/assets/uploads/${'a'.repeat(64)}.webp`, avatar_frame_id: 'r02',
};
const identityB: GateIdentity = {
  ...EMPTY_IDENTITY, id: 'b-main', display_name: '账户乙', species_name: '妖精', avatar_mode: 'upload',
  avatar_asset_id: `/assets/uploads/${'b'.repeat(64)}.webp`, avatar_frame_id: 'r03',
};

function memoryStorage(): GuestStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: key => { values.delete(key); },
  };
}

function accountProfile(account: Account, identity: GateIdentity, identities: GateIdentity[] = [identity]) {
  return { logged_in: true, owner: { kind: account.kind, user_id: account.user_id }, identity, identities };
}

test('scope names keep anonymous, local A and USSO A apart', () => {
  assert.equal(accountScope(guest), 'anonymous');
  assert.equal(accountScope(localA), 'local:A');
  assert.equal(accountScope({ logged_in: true, kind: 'usso', uid: 'A' }), 'usso:A');
  assert.notEqual(accountScope(localA), accountScope({ logged_in: true, kind: 'usso', uid: 'A' }));
});

test('guest entry restores only the guest draft from this tab', () => {
  const storage = memoryStorage();
  writeGuest([guestIdentity], guestIdentity, storage);

  const snapshot = resolveProfileSnapshot(guest, { logged_in: false, owner: null, identity: identityA, identities: [identityA] }, storage);

  assert.deepEqual(snapshot.identity, guestIdentity);
  assert.deepEqual(snapshot.roster, [guestIdentity]);
  assert.equal(storage.getItem(GUEST_IDENTITY_KEY), JSON.stringify(guestIdentity));
  assert.equal(storage.getItem(GUEST_ROSTER_KEY), JSON.stringify([guestIdentity]));
});

test('signing in as A adopts only A profile and never writes the guest draft to A', () => {
  const storage = memoryStorage();
  writeGuest([guestIdentity], guestIdentity, storage);
  const guestBefore = { identity: storage.getItem(GUEST_IDENTITY_KEY), roster: storage.getItem(GUEST_ROSTER_KEY) };

  const snapshot = resolveProfileSnapshot(localA, accountProfile(localA, identityA), storage);

  assert.deepEqual(snapshot.identity, identityA);
  assert.deepEqual(snapshot.roster, [identityA]);
  assert.equal(snapshot.identity.display_name, '账户甲');
  assert.equal(storage.getItem(GUEST_IDENTITY_KEY), guestBefore.identity);
  assert.equal(storage.getItem(GUEST_ROSTER_KEY), guestBefore.roster);

  // A brand-new account with no saved row starts empty, not from the guest draft.
  const emptyAccount = resolveProfileSnapshot(localA, {
    logged_in: true, owner: { kind: 'local', user_id: 'A' }, identity: null, identities: [],
  }, storage);
  assert.equal(emptyAccount.identity.display_name, '');
  assert.deepEqual(emptyAccount.roster, []);
});

test('switching A to B never reuses A identity, roster or avatar', () => {
  const storage = memoryStorage();
  writeGuest([guestIdentity], guestIdentity, storage);

  const a = resolveProfileSnapshot(localA, accountProfile(localA, identityA), storage);
  const b = resolveProfileSnapshot(localB, accountProfile(localB, identityB), storage);

  assert.deepEqual(a.identity, identityA);
  assert.deepEqual(b.identity, identityB);
  assert.notEqual(b.identity.avatar_asset_id, a.identity.avatar_asset_id);
  assert.deepEqual(b.roster.map(item => item.id), ['b-main']);
  assert.ok(!b.roster.some(item => item.display_name === identityA.display_name));
});

test('logging out restores the guest draft instead of the previous account', () => {
  const storage = memoryStorage();
  writeGuest([guestIdentity], guestIdentity, storage);
  resolveProfileSnapshot(localA, accountProfile(localA, identityA), storage);
  resolveProfileSnapshot(localB, accountProfile(localB, identityB), storage);

  const afterLogout = resolveProfileSnapshot(guest, { logged_in: false, owner: null, identity: null, identities: [] }, storage);

  assert.deepEqual(afterLogout.identity, guestIdentity);
  assert.deepEqual(afterLogout.roster, [guestIdentity]);
  assert.equal(storage.getItem(GUEST_IDENTITY_KEY), JSON.stringify(guestIdentity));
  assert.ok(!JSON.stringify([...storage.values]).includes(identityA.display_name));
  assert.ok(!JSON.stringify([...storage.values]).includes(identityB.display_name));
});

test('refreshing the same account is stable and does not read another account', () => {
  const storage = memoryStorage();
  writeGuest([guestIdentity], guestIdentity, storage);

  const first = resolveProfileSnapshot(localA, accountProfile(localA, identityA), storage);
  const refreshed = resolveProfileSnapshot(localA, accountProfile(localA, identityA), storage);

  assert.deepEqual(refreshed, first);
  assert.notEqual(refreshed.identity.display_name, identityB.display_name);
});

test('mismatched read responses are rejected instead of mixing owners', () => {
  const storage = memoryStorage();
  writeGuest([guestIdentity], guestIdentity, storage);

  assert.throws(() => resolveProfileSnapshot(localA, accountProfile(localB, identityB), storage), /账户状态刚刚变化/);
  assert.throws(() => resolveProfileSnapshot(localA, { logged_in: false, owner: null, identity: null, identities: [] }, storage), /账户状态刚刚变化/);
  assert.throws(() => resolveProfileSnapshot(guest, accountProfile(localA, identityA), storage), /账户状态刚刚变化/);
  assert.throws(() => resolveProfileSnapshot(localA, {
    logged_in: true, owner: { kind: 'local' }, identity: identityA, identities: [identityA],
  }, storage), /账户状态刚刚变化/);
});

test('save payload binds account drafts to A and leaves guest drafts unowned', () => {
  const newGuest = buildIdentitySave({ ...guestIdentity, id: '', display_name: '  访客乙  ' }, guest);
  assert.equal('expected_owner' in newGuest.payload, false);
  assert.equal(newGuest.payload.create, undefined);
  assert.equal(newGuest.create, true);
  assert.equal(newGuest.expectedScope, 'anonymous');
  assert.equal(newGuest.payload.display_name, '访客乙');

  const newAccount = buildIdentitySave({ ...identityA, id: '', display_name: '  账户甲  ' }, localA);
  assert.deepEqual(newAccount.payload.expected_owner, { kind: 'local', user_id: 'A' });
  assert.equal(newAccount.payload.create, true);
  assert.equal(newAccount.create, true);
  assert.equal(newAccount.expectedScope, 'local:A');

  const existingAccount = buildIdentitySave(identityA, localA);
  assert.equal(existingAccount.payload.create, undefined);
  assert.equal(existingAccount.create, false);
});

test('a save that started under A cannot commit after switching to B', () => {
  assert.doesNotThrow(() => assertIdentitySaveTarget('local:A', 'local:A', 2, 2));
  assert.throws(() => assertIdentitySaveTarget('local:A', 'local:B', 2, 2), /账户已切换/);
  assert.throws(() => assertIdentitySaveTarget('local:A', 'local:A', 2, 3), /账户已切换/);
});

test('guest roster keeps multiple identities and clears only the active pointer on logout', () => {
  const storage = memoryStorage();
  const guestB: GateIdentity = {
    ...EMPTY_IDENTITY, id: 'guest-b', display_name: '访客乙', species_name: '妖精',
    avatar_frame_id: 'r04', avatar_mode: 'default',
  };
  writeGuest([guestIdentity, guestB], guestB, storage);

  assert.equal(readGuestIdentity(storage).id, 'guest-b');
  assert.deepEqual(readGuestRoster(readGuestIdentity(storage), storage).map(item => item.id), ['guest-main', 'guest-b']);

  writeGuest([guestIdentity], null, storage);
  assert.equal(readGuestIdentity(storage).display_name, '');
  assert.equal(storage.getItem(GUEST_IDENTITY_KEY), null);
  assert.deepEqual(readGuestRoster(readGuestIdentity(storage), storage).map(item => item.id), ['guest-main']);
});
