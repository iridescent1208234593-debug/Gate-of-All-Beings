// 统一存档：一个带 schema 版本的命名空间，供各模块共享/迁移。
// 每个模块用它自己的 key 存局部状态，统一入口用它存路由等公共状态。
import { publish, subscribe } from './bus.js';

export const SCHEMA_VERSION = 1;
const KEY = 'iridescently.save.v1';

export function readSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function get(key) {
  return readSave()[key];
}

export function set(key, value) {
  const next = { ...readSave(), [key]: value, schemaVersion: SCHEMA_VERSION };
  localStorage.setItem(KEY, JSON.stringify(next));
  publish('save', { key, value });
  return next;
}

export function patch(values) {
  const next = { ...readSave(), ...values, schemaVersion: SCHEMA_VERSION };
  localStorage.setItem(KEY, JSON.stringify(next));
  publish('save', values);
  return next;
}

/** 订阅其他模块的存档变更，返回取消函数。 */
export function onSave(handler) {
  return subscribe('save', handler);
}

/** 清空本命名空间（不触碰各模块自己的旧存档）。 */
export function clear() {
  localStorage.removeItem(KEY);
  publish('save', {});
}
