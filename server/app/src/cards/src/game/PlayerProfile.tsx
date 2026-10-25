import siteDomains from '../../../../../../shared/site-domains.mjs';
import './player-profile.css';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type Account = { logged_in: boolean; kind?: string; user_id?: string; uid?: string; name?: string; nickname?: string; picture?: string; account_avatar_url?: string };
export type GateIdentity = { schema_version: 1; id?: string; display_name: string; species_name: string; species_kind?: string; species_family?: string; species_sub?: string; species_note?: string; avatar_asset_id: string; avatar_frame_id: string; avatar_mode: 'default'|'upload'|'account'|'oc'; source_oc_id: string };
export const EMPTY_IDENTITY: GateIdentity = { schema_version: 1, id: '', display_name: '', species_name: '', species_kind: '', species_family: '', species_sub: '', species_note: '', avatar_asset_id: '', avatar_frame_id: '', avatar_mode: 'default', source_oc_id: '' };
export const GUEST_IDENTITY_KEY = 'zszm.gateIdentity.v1';
export const GUEST_ROSTER_KEY = 'zszm.gateIdentities.v1';
export const IDENTITY_LIMIT = 6;
export const accountScope = (account: Account) => account.logged_in ? `${account.kind}:${account.user_id ?? account.uid}` : 'anonymous';
export const identityComplete = (identity: GateIdentity) => Boolean(identity.display_name.trim() && identity.species_name.trim() && (identity.avatar_asset_id || identity.avatar_frame_id));
export const identityAssetUrl = (asset: string) => asset.startsWith('/assets/uploads/') ? `${siteDomains.url('huiguan')}${asset}` : asset;
export function readGuestIdentity(): GateIdentity {
  try {
    const saved = JSON.parse(sessionStorage.getItem(GUEST_IDENTITY_KEY) || 'null');
    return saved?.schema_version === 1 ? { ...EMPTY_IDENTITY, ...saved, id: saved.id || 'main' } : { ...EMPTY_IDENTITY };
  } catch { return { ...EMPTY_IDENTITY }; }
}
function readGuestRoster(active: GateIdentity): GateIdentity[] {
  let roster: GateIdentity[] = [];
  try { const saved = JSON.parse(sessionStorage.getItem(GUEST_ROSTER_KEY) || '[]'); if (Array.isArray(saved)) roster = saved.map(item => ({ ...EMPTY_IDENTITY, ...item })); } catch { /* fall back to the active identity */ }
  if (!roster.length && active.display_name) roster = [active];
  return roster;
}
function writeGuest(roster: GateIdentity[], active: GateIdentity | null) {
  sessionStorage.setItem(GUEST_ROSTER_KEY, JSON.stringify(roster));
  if (active) sessionStorage.setItem(GUEST_IDENTITY_KEY, JSON.stringify(active));
  else sessionStorage.removeItem(GUEST_IDENTITY_KEY);
}
const withRosterIds = (list: unknown, active: GateIdentity) => {
  const roster = Array.isArray(list) ? list.map(item => ({ ...EMPTY_IDENTITY, ...item })) : [];
  return roster.length ? roster : active.display_name ? [{ ...active, id: active.id || 'main' }] : [];
};
async function request(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try { return await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init, signal: controller.signal }); }
  finally { window.clearTimeout(timeout); }
}
async function blobData(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
  });
}
type ProfileContext = {
  account: Account; identity: GateIdentity; identities: GateIdentity[]; loading: boolean; resolved: boolean; error: string;
  refresh: () => Promise<void>; saveIdentity: (identity: GateIdentity, image?: Blob | null) => Promise<GateIdentity>;
  selectIdentity: (id: string) => Promise<void>; deleteIdentity: (id: string) => Promise<void>;
};
const Context = createContext<ProfileContext | null>(null);

/** Shared by the entrance, player HUD and existing identity editor. Account/OC remain separate. */
export function PlayerProfileProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account>({ logged_in: false });
  const [identity, setIdentity] = useState<GateIdentity>({ ...EMPTY_IDENTITY });
  const [identities, setIdentities] = useState<GateIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState('');
  const scope = useRef('pending');
  const generation = useRef(0);
  const active = useRef(false);
  const refreshing = useRef<Promise<void> | null>(null);
  const saving = useRef(false);
  const refresh = useCallback(() => {
    if (saving.current) return Promise.resolve();
    if (refreshing.current) return refreshing.current;
    const task = (async () => {
      try {
        const [accountResponse, profileResponse] = await Promise.all([request('/api/sso-user'), request('/api/gate/identity')]);
        if (!accountResponse.ok || !profileResponse.ok) throw new Error('暂时无法读取玩家资料，请重试。');
        const [user, profile] = await Promise.all([accountResponse.json(), profileResponse.json()]);
        if (!active.current) return;
        const nextAccount: Account = user?.logged_in ? { ...user, user_id: String(user.user_id ?? user.uid ?? ''), account_avatar_url: user.account_avatar_url || profile.account_avatar_url || '' } : { logged_in: false };
        const nextScope = accountScope(nextAccount);
        if (scope.current !== nextScope) {
          generation.current++;
          setIdentity({ ...EMPTY_IDENTITY }); setIdentities([]); setResolved(false);
        }
        setAccount(nextAccount);
        if (Boolean(profile.logged_in) !== nextAccount.logged_in || (nextAccount.logged_in && `${profile.owner?.kind}:${profile.owner?.user_id}` !== nextScope)) throw new Error('账户状态刚刚变化，请重试。');
        scope.current = nextScope;
        // Never migrate a previous guest/account into a newly signed-in account.
        const nextIdentity = nextAccount.logged_in ? { ...EMPTY_IDENTITY, ...(profile.identity || {}) } : readGuestIdentity();
        const nextRoster = nextAccount.logged_in ? withRosterIds(profile.identities, nextIdentity) : readGuestRoster(nextIdentity);
        setIdentity(current => JSON.stringify(current) === JSON.stringify(nextIdentity) ? current : nextIdentity);
        setIdentities(current => JSON.stringify(current) === JSON.stringify(nextRoster) ? current : nextRoster);
        setResolved(true);
        setError('');
      } catch (reason) {
        if (active.current) setError((reason as Error).name === 'AbortError' ? '玩家资料请求超时，请重试。' : (reason as Error).message);
      } finally { if (active.current) setLoading(false); }
    })();
    refreshing.current = task;
    void task.finally(() => { refreshing.current = null; });
    return task;
  }, []);
  useEffect(() => {
    active.current = true;
    void refresh();
    const onReturn = () => { void refresh(); };
    window.addEventListener('pageshow', onReturn); window.addEventListener('focus', onReturn);
    return () => { active.current = false; window.removeEventListener('pageshow', onReturn); window.removeEventListener('focus', onReturn); };
  }, [refresh]);
  const saveIdentity = useCallback(async (draft: GateIdentity, image?: Blob | null) => {
    if (refreshing.current) await refreshing.current;
    if (saving.current) throw new Error('玩家资料正在保存，请稍候。');
    saving.current = true;
    try {
    const expectedScope = accountScope(account);
    if (scope.current !== expectedScope) throw new Error('账户状态已变化，请重新打开形象设置。');
    const revision = generation.current;
    const create = !draft.id;
    const payload = { ...draft, ...(account.logged_in ? { expected_owner: { kind: account.kind, user_id: account.user_id } } : {}), ...(create && account.logged_in ? { create: true } : {}), schema_version: 1 as const, display_name: draft.display_name.trim().slice(0, 60), species_name: draft.species_name.trim().slice(0, 100) };
    if (!payload.display_name || !payload.species_name) throw new Error('请填写名称和种族。');
    let next: GateIdentity;
    let roster: GateIdentity[];
    if (account.logged_in) {
      let response: Response;
      if (image) {
        const form = new FormData();
        form.set('metadata', JSON.stringify({ ...payload, avatar_asset_id: '' })); form.set('image', image, 'gate-avatar.webp');
        response = await request('/api/gate/identity', { method: 'POST', body: form });
      } else {
        if (/^(data:|blob:)/.test(payload.avatar_asset_id)) throw new Error('请重新选择头像图片后保存。');
        response = await request('/api/gate/identity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || '玩家资料保存失败');
      if (`${result.owner?.kind}:${result.owner?.user_id}` !== expectedScope) throw new Error('资料所属账户已变化，请重新读取。');
      next = { ...EMPTY_IDENTITY, ...result.identity };
      roster = withRosterIds(result.identities, next);
    } else {
      next = { ...payload, id: draft.id || Math.random().toString(16).slice(2, 14), avatar_asset_id: image ? await blobData(image) : payload.avatar_asset_id };
      if (next.avatar_asset_id.startsWith('blob:')) throw new Error('头像尚未保存，请重新选择图片。');
      const current = readGuestRoster(readGuestIdentity());
      if (create && current.length >= IDENTITY_LIMIT) throw new Error(`最多保存 ${IDENTITY_LIMIT} 个形象，请先删除一个。`);
      roster = current.some(item => item.id === next.id) ? current.map(item => item.id === next.id ? next : item) : [...current, next];
    }
    if (revision !== generation.current || expectedScope !== scope.current) throw new Error('账户已切换，请重新确认玩家资料。');
    if (!account.logged_in) {
      try { writeGuest(roster, next); }
      catch { throw new Error('浏览器本地空间不足，头像没能保存；登录会馆账户后可以跨设备保存。'); }
    }
    if (active.current) { setIdentity(next); setIdentities(roster); }
    return next;
    } finally { saving.current = false; }
  }, [account]);
  /** Switch to or remove a saved identity; removing the last one sends the player back to onboarding. */
  const changeRoster = useCallback(async (action: 'select'|'delete', id: string) => {
    if (refreshing.current) await refreshing.current;
    if (saving.current) throw new Error('玩家资料正在保存，请稍候。');
    saving.current = true;
    try {
      if (scope.current !== accountScope(account)) throw new Error('账户状态已变化，请重新打开形象设置。');
      let next: GateIdentity | null; let roster: GateIdentity[];
      if (account.logged_in) {
        const response = await request(`/api/gate/identity/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, expected_owner: { kind: account.kind, user_id: account.user_id } }) });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || '操作失败');
        next = result.identity ? { ...EMPTY_IDENTITY, ...result.identity } : null;
        roster = next ? withRosterIds(result.identities, next) : [];
      } else {
        const activeId = readGuestIdentity().id;
        const current = readGuestRoster(readGuestIdentity());
        const target = current.find(item => item.id === id);
        if (!target) throw new Error('这个形象已不存在。');
        roster = action === 'delete' ? current.filter(item => item.id !== id) : current;
        next = action === 'select' ? target : roster.find(item => item.id === activeId) || roster[0] || null;
        writeGuest(roster, next);
      }
      if (active.current) { setIdentity(next || { ...EMPTY_IDENTITY }); setIdentities(roster); }
    } finally { saving.current = false; }
  }, [account]);
  const selectIdentity = useCallback((id: string) => changeRoster('select', id), [changeRoster]);
  const deleteIdentity = useCallback((id: string) => changeRoster('delete', id), [changeRoster]);
  return <Context.Provider value={{ account, identity, identities, loading, resolved, error, refresh, saveIdentity, selectIdentity, deleteIdentity }}>{children}</Context.Provider>;
}
export function usePlayerProfile() {
  const value = useContext(Context);
  if (!value) throw new Error('PlayerProfileProvider is required');
  return value;
}
