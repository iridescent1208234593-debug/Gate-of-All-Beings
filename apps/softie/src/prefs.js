// softie 的用户偏好，落到统一存档（iridescently.save.v1），旧 localStorage 键自动迁移。
import { unifiedStorage } from '@lxh/shared-session/kv.js';

const store = unifiedStorage('softie');

export function getPref(key) {
  try { return store.getItem(key); } catch { return null; }
}

export function setPref(key, value) {
  try { store.setItem(key, value); } catch { /* 存储不可用时忽略 */ }
}
