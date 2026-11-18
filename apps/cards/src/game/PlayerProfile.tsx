import siteDomains from '../../../../packages/site-domains/index.mjs';
import { uploadDisplayUrl } from './core/identityAssets';
import './player-profile.css';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { accountScope, assertIdentitySaveTarget, buildIdentitySave, EMPTY_IDENTITY, IDENTITY_LIMIT, readGuestIdentity, readGuestRoster, resolveProfileSnapshot, withRosterIds, writeGuest, type Account, type GateIdentity } from './profileScope';
export { EMPTY_IDENTITY, GUEST_IDENTITY_KEY, GUEST_ROSTER_KEY, IDENTITY_LIMIT, accountScope, identityComplete, readGuestIdentity } from './profileScope';
export type { Account, GateIdentity } from './profileScope';
export const identityAssetUrl = (asset: string) => uploadDisplayUrl(asset, siteDomains.url('huiguan'));
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
        const { identity: nextIdentity, roster: nextRoster } = resolveProfileSnapshot(nextAccount, profile);
        scope.current = nextScope;
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
    const { payload, create, expectedScope } = buildIdentitySave(draft, account);
    if (scope.current !== expectedScope) throw new Error('账户状态已变化，请重新打开形象设置。');
    const revision = generation.current;
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
    assertIdentitySaveTarget(expectedScope, scope.current, revision, generation.current);
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
