// 统一存档适配器：给各模块一个与 localStorage 同形的接口，
// 实际写入统一命名空间 `iridescently.save.v1`，并自动迁移旧键。
// Node 环境无 localStorage 时退回进程内 Map（测试安全）。
import { publish } from './bus.js';

const NS = 'iridescently.save.v1';
const mem = new Map();

function ls() {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

export function readNamespace() {
  const store = ls();
  if (!store) return Object.fromEntries(mem);
  try {
    const raw = JSON.parse(store.getItem(NS) || '{}');
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid save namespace');
    return raw;
  } catch (error) { throw new Error('统一存档损坏，原数据已保留。', {cause:error}); }
}

export function writeNamespace(all) {
  const store = ls();
  if (!store) {
    mem.clear();
    for (const k of Object.keys(all)) mem.set(k, all[k]);
    return;
  }
  store.setItem(NS, JSON.stringify(all));
}

/** 返回某模块专属的 localStorage 同形存储。 */
export function unifiedStorage(module) {
  const readAll=readNamespace,writeAll=writeNamespace;
  const prefix = 'm:' + module + ':';
  return {
    getItem(key) {
      const all = readAll();
      if (prefix + key in all) return all[prefix + key];
      const store = ls();
      if (store) {
        const legacy = store.getItem(key);
        if (legacy !== null) {
          all[prefix + key] = legacy;
          writeAll(all);
          publish('save', {key:prefix+key,value:legacy});
          return legacy;
        }
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
      all[prefix + key] = null; // Tombstone: a cleared slot must not resurrect its legacy key.
      writeAll(all);
      publish('save', { key: prefix + key });
    },
    clear() {
      const all = readAll();
      for (const k of Object.keys(all)) if (k.startsWith(prefix)) all[k] = null;
      writeAll(all);
      publish('save', { key: prefix });
    },
    key(index) { const all=readAll();return Object.keys(all).filter(k=>k.startsWith(prefix)&&all[k]!==null)[index]?.slice(prefix.length) ?? null; },
    get length() { const all=readAll();return Object.keys(all).filter(k=>k.startsWith(prefix)&&all[k]!==null).length; },
  };
}
