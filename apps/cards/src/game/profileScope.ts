/** Account/guest profile scope rules shared by the Gate profile provider.
 *
 * The provider owns React state; these helpers own the parts that must be
 * provable without a browser: which storage key a session belongs to, whether
 * a server profile may be adopted, and how a save draft is bound to its owner.
 */
export type Account = { logged_in: boolean; kind?: string; user_id?: string; uid?: string; name?: string; nickname?: string; picture?: string; account_avatar_url?: string };
export type GateIdentity = { schema_version: 1; id?: string; display_name: string; species_name: string; species_kind?: string; species_family?: string; species_sub?: string; species_note?: string; avatar_asset_id: string; avatar_frame_id: string; avatar_mode: 'default'|'upload'|'account'|'oc'; source_oc_id: string };
export type GateProfileResponse = {
  logged_in?: boolean;
  identity?: Partial<GateIdentity> | null;
  identities?: unknown;
  owner?: { kind?: string; user_id?: string } | null;
};
export type GuestStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type IdentitySavePayload = GateIdentity & {
  expected_owner?: { kind?: string; user_id?: string };
  create?: true;
};

export const EMPTY_IDENTITY: GateIdentity = { schema_version: 1, id: '', display_name: '', species_name: '', species_kind: '', species_family: '', species_sub: '', species_note: '', avatar_asset_id: '', avatar_frame_id: '', avatar_mode: 'default', source_oc_id: '' };
export const GUEST_IDENTITY_KEY = 'zszm.gateIdentity.v1';
export const GUEST_ROSTER_KEY = 'zszm.gateIdentities.v1';
export const IDENTITY_LIMIT = 6;
export const accountScope = (account: Account) => account.logged_in ? `${account.kind}:${account.user_id ?? account.uid}` : 'anonymous';
export const identityComplete = (identity: GateIdentity) => Boolean(identity.display_name.trim() && identity.species_name.trim() && (identity.avatar_asset_id || identity.avatar_frame_id));

function guestStorage(): GuestStorage {
  return sessionStorage;
}

/** Read the active guest identity from the current tab. Never falls back to an account row. */
export function readGuestIdentity(storage: GuestStorage = guestStorage()): GateIdentity {
  try {
    const saved = JSON.parse(storage.getItem(GUEST_IDENTITY_KEY) || 'null');
    return saved?.schema_version === 1 ? { ...EMPTY_IDENTITY, ...saved, id: saved.id || 'main' } : { ...EMPTY_IDENTITY };
  } catch { return { ...EMPTY_IDENTITY }; }
}

export function readGuestRoster(active: GateIdentity, storage: GuestStorage = guestStorage()): GateIdentity[] {
  let roster: GateIdentity[] = [];
  try { const saved = JSON.parse(storage.getItem(GUEST_ROSTER_KEY) || '[]'); if (Array.isArray(saved)) roster = saved.map(item => ({ ...EMPTY_IDENTITY, ...item })); } catch { /* fall back to the active identity */ }
  if (!roster.length && active.display_name) roster = [active];
  return roster;
}

export function writeGuest(roster: GateIdentity[], active: GateIdentity | null, storage: GuestStorage = guestStorage()) {
  storage.setItem(GUEST_ROSTER_KEY, JSON.stringify(roster));
  if (active) storage.setItem(GUEST_IDENTITY_KEY, JSON.stringify(active));
  else storage.removeItem(GUEST_IDENTITY_KEY);
}

export const withRosterIds = (list: unknown, active: GateIdentity): GateIdentity[] => {
  const roster = Array.isArray(list) ? list.map(item => ({ ...EMPTY_IDENTITY, ...item })) : [];
  return roster.length ? roster : active.display_name ? [{ ...active, id: active.id || 'main' }] : [];
};

/** Validate the two parallel profile reads and choose the matching data source.
 *
 * A guest response may only populate guest state; a signed-in response may only
 * populate the identity owned by that exact (kind, user_id). A mismatch throws
 * instead of adopting whichever response arrived first.
 */
export function resolveProfileSnapshot(account: Account, profile: GateProfileResponse, storage: GuestStorage = guestStorage()): { identity: GateIdentity; roster: GateIdentity[] } {
  const ownerScope = `${profile.owner?.kind}:${profile.owner?.user_id}`;
  if (Boolean(profile.logged_in) !== account.logged_in || (account.logged_in && ownerScope !== accountScope(account))) throw new Error('账户状态刚刚变化，请重试。');
  // Never migrate a previous guest/account into a newly signed-in account.
  const identity = account.logged_in ? { ...EMPTY_IDENTITY, ...(profile.identity || {}) } : readGuestIdentity(storage);
  const roster = account.logged_in ? withRosterIds(profile.identities, identity) : readGuestRoster(identity, storage);
  return { identity, roster };
}

/** Build the exact payload and guard values for one identity save. */
export function buildIdentitySave(draft: GateIdentity, account: Account) {
  const expectedScope = accountScope(account);
  const create = !draft.id;
  const payload: IdentitySavePayload = {
    ...draft,
    ...(account.logged_in ? { expected_owner: { kind: account.kind, user_id: account.user_id } } : {}),
    ...(create && account.logged_in ? { create: true } : {}),
    schema_version: 1,
    display_name: draft.display_name.trim().slice(0, 60),
    species_name: draft.species_name.trim().slice(0, 100),
  };
  return { payload, create, expectedScope };
}

/** A save may only update the scope and generation it started under. */
export function assertIdentitySaveTarget(expectedScope: string, currentScope: string, revision: number, generation: number) {
  if (currentScope !== expectedScope || revision !== generation) throw new Error('账户已切换，请重新确认玩家资料。');
}
