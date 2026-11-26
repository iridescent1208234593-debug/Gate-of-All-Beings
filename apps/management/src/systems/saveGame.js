import { unifiedStorage } from '@lxh/shared-session/kv.js';
import { reportProgress } from '@lxh/shared-session/progress.js';
import { currentUser, saveCloud, loadCloud } from './account.js';

const localStorage = unifiedStorage('management');
const STORAGE_PREFIX = 'lingjing-huiguan-save';
const SAVE_VERSION = '0.2.0';
const VERSIONS = [SAVE_VERSION, '0.1.0'];

function storageKey(user) {
  return `${STORAGE_PREFIX}-${user?.uid || 'guest'}`;
}

export function sameOwner(a, b) {
  return !a && !b || !!a && !!b && String(a.uid) === String(b.uid) &&
    (a.kind ?? 'local') === (b.kind ?? 'local');
}

// Only accept a trusted snapshot shape before invoking reducer, UI or autosave.
// Do not merge arbitrary missing fields into a newly generated world.
function usable(state) {
  const {space, resources, time, tech, combat, relations, expedition, stats, nextIds} = state ?? {};
  const int = n => Number.isInteger(n) && n >= 0;
  return int(state?.tick) && int(time?.day) && int(time?.minute) &&
    int(space?.width) && space.width > 0 && int(space?.height) && space.height > 0 &&
    Array.isArray(space.tiles) && space.tiles.length === space.width * space.height &&
    space.tiles.every(tile => tile && typeof tile === 'object') &&
    ['spirit', 'food', 'faqi'].every(key => Number.isFinite(resources?.[key]) && resources[key] >= 0) &&
    Array.isArray(state.buildings) && state.buildings.every(b => b && typeof b === 'object') &&
    Array.isArray(state.colonists) && state.colonists.every(c => c?.needs && Number.isFinite(c.hp)) &&
    Array.isArray(state.eventLog) && state.eventLog.every(entry => typeof entry === 'string') &&
    Array.isArray(state.events) && Array.isArray(tech?.unlocked) && Number.isFinite(tech.progress) &&
    Array.isArray(combat?.threats) && Array.isArray(combat.battles) &&
    Array.isArray(relations?.settlements) && Array.isArray(expedition?.parties) &&
    Array.isArray(expedition.log) && stats && int(nextIds?.building) && int(nextIds?.colonist);
}

function readSnapshot(state, version) {
  if (!VERSIONS.includes(version) || (state?.version != null && !VERSIONS.includes(state.version))) {
    return {status: 'invalid', reason: '存档版本不兼容'};
  }
  return usable(state) ? {status: 'ok', state} : {status: 'invalid', reason: '存档字段缺失或损坏'};
}

function inspectLocalSave(user) {
  try {
    const raw = localStorage.getItem(storageKey(user));
    if (raw === null) return {status: 'missing'};
    const data = JSON.parse(raw);
    if (data?.owner && !sameOwner(data.owner, user)) return {status: "invalid", reason: "本地存档属于另一账号。", raw};
    const cloudBase = data?.owner && /^[a-f0-9]{64}$/.test(data.cloudBase) ? data.cloudBase : undefined;
    return {...readSnapshot(data?.state, data?.version), raw, cloudBase};
  } catch {
    return {status: 'invalid', reason: '本地存档无法读取'};
  }
}

export function readLocalSave(user = currentUser()) {
  const {raw, cloudBase, ...result} = inspectLocalSave(user);
  return result;
}

// Save-state snapshots contain JSON. Object key order is not part of their identity.
function sameSnapshot(left, right) {
  const a = [ [left, right] ];
  while (a.length) {
    const [x, y] = a.pop();
    if (x === y) continue;
    if (!x || !y || typeof x !== "object" || typeof y !== "object" || Array.isArray(x) !== Array.isArray(y)) return false;
    const keys = Object.keys(x);
    if (keys.length !== Object.keys(y).length) return false;
    for (const key of keys) {
      if (!Object.hasOwn(y, key)) return false;
      a.push([x[key], y[key]]);
    }
  }
  return true;
}

// Canonical JSON fingerprint: do not infer save order from device clocks or simulation ticks.
async function snapshotFingerprint(state) {
  if (!state || !globalThis.crypto?.subtle) return undefined;
  try {
    const json = JSON.stringify(state, (_, value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
    });
    const hash = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined;
  }
}

/** Inspect the destination slot before allowing any write, even when a fallback is playable. */
export async function openSave(user) {
  const local = inspectLocalSave(user);
  let remote = {status: 'missing'};
  if (user) {
    try {
      const state = await loadCloud();
      if (state) remote = readSnapshot(state, state.version);
    } catch {
      remote = {status: 'unavailable', reason: '云端存档暂不可读取，请在联网后重新进入'};
    }
  }
  const cloudBase = await snapshotFingerprint(remote.state);
  const diverged = !!local.state && !!remote.state && !sameSnapshot(local.state, remote.state);
  // A known and unchanged cloud base proves local change belongs to this same owner.
  const changedLocally = !!local.cloudBase && cloudBase === local.cloudBase;
  const changedRemotely = diverged && !!local.cloudBase &&
    await snapshotFingerprint(local.state) === local.cloudBase;
  if (!sameOwner(user, currentUser())) return null;
  const conflict = diverged && !changedLocally && !changedRemotely;
  const state = changedRemotely ? remote.state : local.state || remote.state || null;
  const reason = local.reason || remote.reason || (conflict ? "本地与云端存档不同，已保留两份并显示本地存档" : "");
  return {
    user, state, writable: !reason,
    localRaw: local.raw, cloudBase, pendingCloud: null,
    hint: reason ? `${reason}。当前可临时游玩，原存档保留，暂不保存。` :
      state && state === remote.state ? '已读取云端存档' : local.state ? '已读取本地存档' : '',
  };
}

/** Never write a stale game to a slot after account identity changes. */
export function saveGame(state, slot, {localOnly = false} = {}) {
  if (!slot?.writable || !sameOwner(slot.user, currentUser())) return false;
  const local = inspectLocalSave(slot.user);
  if (local.status === "invalid" || local.raw !== slot.localRaw) {
    slot.writable = false;
    slot.hint = "本地存档在游戏载入后发生变化。已暂停保存，请关闭其他标签页并重新进入游戏。";
    return false;
  }
  try {
    const owner = slot.user ? {uid: String(slot.user.uid), kind: slot.user.kind ?? "local"} : undefined;
    const raw = JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), owner, cloudBase: slot.cloudBase, state });
    localStorage.setItem(storageKey(slot.user), raw);
    slot.localRaw = raw;
  } catch (err) {
    console.error('[saveGame] local save failed:', err);
    return false;
  }
  if (localOnly) return true;
  const built = (state.buildings || []).filter((b) => b.construction == null || b.construction >= (b.buildTime ?? 0)).length;
  void reportProgress('management', built);
  if (slot.user && !slot.pendingCloud) {
    // Send exactly the snapshot captured at click time, not a mutable game object.
    const snapshot = JSON.parse(slot.localRaw).state;
    slot.pendingCloud = saveCloud(snapshot)
      .then(async response => {
        if (!response?.ok) return;
        const digest = await snapshotFingerprint(snapshot);
        if (!digest || !sameOwner(slot.user, currentUser()) || !slot.writable) return;
        slot.cloudBase = digest;
        // Another save may have advanced our local snapshot while this POST was in flight.
        if (inspectLocalSave(slot.user).raw !== slot.localRaw) return;
        const raw = JSON.stringify({...JSON.parse(slot.localRaw), cloudBase: digest});
        localStorage.setItem(storageKey(slot.user), raw);
        slot.localRaw = raw;
      })
      .catch(err => console.warn('[saveGame] cloud save failed:', err.message))
      .finally(() => { slot.pendingCloud = null; });
  }
  return true;
}
