import { unifiedStorage } from '@lxh/shared-session/kv.js';
const localStorage = unifiedStorage('management');
/**
 * 灵境会馆 - 存档读档
 * localStorage 本地存档（按账号 uid 隔离）+ huiguan 账号云存档（登录后自动同步）。
 * version 校验 + JSON 往返。
 */
import { currentUser, saveCloud, loadCloud } from './account.js';

const STORAGE_PREFIX = 'lingjing-huiguan-save';
const SAVE_VERSION = '0.2.0';

function storageKey() {
  const uid = (currentUser() || {}).uid;
  return uid ? `${STORAGE_PREFIX}-${uid}` : `${STORAGE_PREFIX}-guest`;
}

/** 保存当前状态：本地必写；已登录时异步上传云存档（失败静默，不阻塞游戏） */
export function saveGame(state) {
  try {
    const data = JSON.stringify({
      version: SAVE_VERSION,
      savedAt: Date.now(),
      state,
    });
    localStorage.setItem(storageKey(), data);
  } catch (err) {
    console.error('[saveGame] local save failed:', err);
    return false;
  }
  const user = currentUser();
  if (user) {
    saveCloud(state).catch((err) => console.warn('[saveGame] cloud save failed:', err.message));
  }
  return true;
}

/** 读取存档（失败或版本不符返回 null） */
export function loadGame() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) {
      const data = JSON.parse(raw);
      const okVersion = data.version === SAVE_VERSION || data.version === '0.1.0';
      if (okVersion && data.state) return data.state;
    }
  } catch (err) {
    console.error('[saveGame] local load failed:', err);
  }
  return null;
}

/** 是否有可用本地存档 */
export function hasSave() {
  try {
    return !!localStorage.getItem(storageKey());
  } catch {
    return false;
  }
}

/** 清除当前账号的本地存档 */
export function clearSave() {
  try {
    localStorage.removeItem(storageKey());
  } catch {
    /* ignore */
  }
}

/** 尝试从云端读档（登录用户），成功返回存档，否则 null */
export async function loadCloudSave() {
  const user = currentUser();
  if (!user) return null;
  try {
    const state = await loadCloud();
    return state || null;
  } catch (err) {
    console.warn('[saveGame] cloud load failed:', err.message);
    return null;
  }
}
