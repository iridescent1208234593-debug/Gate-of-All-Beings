// 统一存档适配器：给各模块一个与 localStorage 同形的接口，
// 实际写入统一命名空间 `iridescently.save.v1`，并自动迁移旧键。
// Node 环境无 localStorage 时退回进程内 Map（测试安全）。
import { publish } from './bus.js';

const NS = 'iridescently.save.v1';
const mem = new Map();

function ls() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function readAll() {
  const store = ls();
  if (!store) return Object.fromEntries(mem);
  try {
    const raw = JSON.parse(store.getItem(NS) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  const store = ls();
  if (!store) {
    mem.clear();
    for (const k of Object.keys(all)) mem.set(k, all[k]);
    return;
  }
  try {
    store.setItem(NS, JSON.stringify(all));
  } catch { /* 配额/隐私模式：静默失败 */ }
}

/** 返回某模块专属的 localStorage 同形存储。 */
export function unifiedStorage(module) {
  const prefix = 'm:' + module + ':';
  return {
    getItem(key) {
      const all = readAll();
      if (prefix + key in all) return all[prefix + key];
      const store = ls();
      if (store) {
        try {
          const legacy = store.getItem(key);
          if (legacy !== null) {
            all[prefix + key] = legacy;
            writeAll(all);
            return legacy;
          }
        } catch { /* ignore */ }
      }
      return null;
    },
    setItem(key, value) {
      const all = readAll();
      const v = String(value);
      all[prefix + key] = v;
      writeAll(all);
      publish('save', { key: prefix + key, value: v });
    },
    removeItem(key) {
      const all = readAll();
      delete all[prefix + key];
      writeAll(all);
      publish('save', { key: prefix + key });
    },
    clear() {
      const all = readAll();
      for (const k of Object.keys(all)) if (k.startsWith(prefix)) delete all[k];
      writeAll(all);
    },
    key() { return null; },
    get length() { return 0; },
  };
}
