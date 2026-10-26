/**
 * @file 跨系统实体 id 的命名空间工具：`<system>:<localId>`。
 * 纯 JS ES Modules + JSDoc，零依赖。
 */

/**
 * 系统短标识联合类型。
 * @typedef {'eco'|'lj'|'stw'|'xx'} SystemId
 */

/**
 * 系统解析结果。
 * @typedef {Object} ParsedId
 * @property {SystemId} system 系统短标识
 * @property {string} localId 系统内本地 id（字符串形式）
 */

/**
 * 受支持的四个系统短标识（冻结）。
 * @type {readonly SystemId[]}
 */
export const SYSTEMS = Object.freeze(/** @type {any} */ (['eco', 'lj', 'stw', 'xx']));

/**
 * 系统短标识 → 仓库/项目名（冻结）。
 * @type {Readonly<Record<SystemId, string>>}
 */
export const SYSTEM_NAMES = Object.freeze({
  eco: 'ecoplanet3d-js',
  lj: 'lingjing-huiguan',
  stw: 'Slay-the-Web',
  xx: 'xiuxian-card',
});

/**
 * 系统短标识 → id 前缀（冻结）。
 * @type {Readonly<Record<SystemId, string>>}
 */
export const ID_PREFIX = Object.freeze({
  eco: 'eco:',
  lj: 'lj:',
  stw: 'stw:',
  xx: 'xx:',
});

/**
 * 判断是否为受支持的系统短标识。
 * @param {*} system 待判断的值
 * @returns {boolean} 是否为合法系统短标识
 */
function isSystem(system) {
  return typeof system === 'string' && SYSTEMS.includes(/** @type {any} */ (system));
}

/**
 * 生成命名空间 id。
 * @param {*} system 系统短标识：`'eco'` / `'lj'` / `'stw'` / `'xx'`
 * @param {*} localId 系统内本地 id（字符串或数字，不能为空）
 * @returns {string|null} 形如 `'eco:12'` 的 id；system 非法或 localId 为空 → null
 * @example
 * makeId('eco', 12); // 'eco:12'
 * makeId('bad', 1);  // null
 */
export function makeId(system, localId) {
  if (!isSystem(system)) return null;
  if (typeof localId !== 'string' && typeof localId !== 'number') return null;
  const local = String(localId).trim();
  if (local === '') return null;
  return `${ID_PREFIX[/** @type {any} */ (system)]}${local}`;
}

/**
 * 解析命名空间 id。
 * @param {*} id 形如 `'eco:12'` 的字符串
 * @returns {ParsedId|null} 解析结果；前缀未知、本地 id 缺失或非字符串 → null
 * @example
 * parseId('eco:12'); // { system: 'eco', localId: '12' }
 * parseId('eco:');   // null
 */
export function parseId(id) {
  if (typeof id !== 'string') return null;
  const raw = id.trim();
  for (const system of SYSTEMS) {
    const prefix = ID_PREFIX[system];
    if (raw.startsWith(prefix)) {
      const localId = raw.slice(prefix.length).trim();
      if (localId === '') return null;
      return { system, localId };
    }
  }
  return null;
}

/**
 * 判断 id 是否属于指定系统（前缀匹配 + 本地 id 非空）。
 * @param {*} system 系统短标识
 * @param {*} id 命名空间 id
 * @returns {boolean} 归属该系统的合法 id 返回 true
 * @example
 * isIdOf('stw', 'stw:12'); // true
 * isIdOf('stw', 'eco:12'); // false
 */
export function isIdOf(system, id) {
  const parsed = parseId(id);
  return parsed !== null && parsed.system === system;
}

/**
 * 判断值是否为可解析的命名空间 id。
 * @param {*} value 待判断的值
 * @returns {boolean} 可被 parseId 解析则 true
 * @example
 * isNamespacedId('xx:7'); // true
 * isNamespacedId('7');    // false
 */
export function isNamespacedId(value) {
  return parseId(value) !== null;
}
