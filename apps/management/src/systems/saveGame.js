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

export function readLocalSave(user = currentUser()) {
  try {
    const raw = localStorage.getItem(storageKey(user));
    if (raw === null) return {status: 'missing'};
    const data = JSON.parse(raw);
    return readSnapshot(data?.state, data?.version);
  } catch {
    return {status: 'invalid', reason: '本地存档无法读取'};
  }
}

/** Inspect the destination slot before allowing any write, even when a fallback is playable. */
export async function openSave(user) {
  const local = readLocalSave(user);
  let remote = {status: 'missing'};
  if (user) {
    try {
      const state = await loadCloud();
      if (state) remote = readSnapshot(state, state.version);
    } catch {
      remote = {status: 'unavailable', reason: '云端存档暂不可读取，请在联网后重新进入'};
    }
  }
  if (!sameOwner(user, currentUser())) return null;
  const reason = local.reason || remote.reason;
  return {
    user, state: remote.state || local.state || null, writable: !reason,
    hint: reason ? `${reason}。当前可临时游玩，原存档保留，暂不保存。` :
      remote.state ? '已读取云端存档' : local.state ? '已读取本地存档' : '',
  };
}

/** Never write a stale game to a slot after account identity changes. */
export function saveGame(state, slot, {localOnly = false} = {}) {
  if (!slot?.writable || !sameOwner(slot.user, currentUser())) return false;
  if (readLocalSave(slot.user).status === 'invalid') return false;
  try {
    localStorage.setItem(storageKey(slot.user), JSON.stringify({
      version: SAVE_VERSION, savedAt: Date.now(), state,
    }));
  } catch (err) {
    console.error('[saveGame] local save failed:', err);
    return false;
  }
  if (localOnly) return true;
  const built = (state.buildings || []).filter((b) => b.construction == null || b.construction >= (b.buildTime ?? 0)).length;
  void reportProgress('management', built);
  if (slot.user) {
    saveCloud(state).catch((err) => console.warn('[saveGame] cloud save failed:', err.message));
  }
  return true;
}
