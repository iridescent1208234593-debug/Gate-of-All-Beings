/**
 * @file 修仙境界常量与查询工具。
 * 与 DB 表 `cultivation_realm` 的 6 行严格一致（realm_key / realm_name / order_index）。
 * 纯 JS ES Modules + JSDoc，零依赖。
 */

/**
 * 境界条目。
 * @typedef {Object} RealmEntry
 * @property {string} realm_key ASCII 键（'qi' / 'foundation' / ...）
 * @property {string} realm_name 中文境界名（'练气' / '筑基' / ...）
 * @property {number} order_index 序位（从 1 开始，严格递增）
 */

/**
 * 境界主表（冻结，6 条，与 DB `cultivation_realm` 表逐行一致）。
 * @type {readonly RealmEntry[]}
 */
export const REALMS = Object.freeze([
  Object.freeze({ realm_key: 'qi', realm_name: '练气', order_index: 1 }),
  Object.freeze({ realm_key: 'foundation', realm_name: '筑基', order_index: 2 }),
  Object.freeze({ realm_key: 'golden', realm_name: '金丹', order_index: 3 }),
  Object.freeze({ realm_key: 'nascent', realm_name: '元婴', order_index: 4 }),
  Object.freeze({ realm_key: 'deity', realm_name: '化神', order_index: 5 }),
  Object.freeze({ realm_key: 'tribulation', realm_name: '渡劫', order_index: 6 }),
]);

/**
 * 境界 key 顺序表（冻结）。
 * @type {readonly string[]}
 */
export const REALM_KEYS = Object.freeze(/** @type {any} */ (REALMS.map((r) => r.realm_key)));

/**
 * 按 key 查询境界条目。
 * @param {*} key 境界 key（ASCII，精确匹配）
 * @returns {RealmEntry|null} 命中条目（冻结）；未命中返回 null
 * @example
 * realmByKey('golden'); // { realm_key:'golden', realm_name:'金丹', order_index:3 }
 */
export function realmByKey(key) {
  if (typeof key !== 'string') return null;
  return REALMS.find((r) => r.realm_key === key) ?? null;
}

/**
 * 按中文境界名查询境界条目。
 * @param {*} name 中文境界名（如 `'练气'`，忽略首尾空白）
 * @returns {RealmEntry|null} 命中条目（冻结）；未命中返回 null
 * @example
 * realmByName('练气'); // { realm_key:'qi', realm_name:'练气', order_index:1 }
 */
export function realmByName(name) {
  if (typeof name !== 'string') return null;
  const target = name.trim();
  if (target === '') return null;
  return REALMS.find((r) => r.realm_name === target) ?? null;
}

/**
 * 查询境界序位。
 * @param {*} key 境界 key
 * @returns {number|null} order_index；非法 key 返回 null
 * @example
 * realmOrder('qi'); // 1
 */
export function realmOrder(key) {
  const entry = realmByKey(key);
  return entry === null ? null : entry.order_index;
}

/**
 * 查询下一境界。
 * @param {*} key 当前境界 key
 * @returns {RealmEntry|null} 下一境界条目（冻结）；已是最高境界或 key 非法返回 null
 * @example
 * nextRealm('qi');          // { realm_key:'foundation', ... }
 * nextRealm('tribulation'); // null
 */
export function nextRealm(key) {
  const order = realmOrder(key);
  if (order === null) return null;
  return REALMS.find((r) => r.order_index === order + 1) ?? null;
}

/**
 * 计算两个境界的序位差（升序比较器语义：a 早于 b 时为负数）。
 * @param {*} a 境界 key，或含 `realm_key` / `order_index` 的条目对象
 * @param {*} b 境界 key，或含 `realm_key` / `order_index` 的条目对象
 * @returns {number|null} `order_index(a) - order_index(b)`；任一参数无法解析返回 null
 * @example
 * compareRealm('qi', 'golden');    // -2
 * compareRealm('deity', 'deity');  // 0
 */
export function compareRealm(a, b) {
  const left = orderOf(a);
  const right = orderOf(b);
  if (left === null || right === null) return null;
  return left - right;
}

/**
 * 将入参解析为 order_index（接受境界 key 或条目对象）。
 * @param {*} value 境界 key 或条目对象
 * @returns {number|null} order_index；无法解析返回 null
 */
function orderOf(value) {
  if (typeof value === 'string') return realmOrder(value);
  if (value !== null && typeof value === 'object') {
    if (typeof value.realm_key === 'string') return realmOrder(value.realm_key);
    if (typeof value.order_index === 'number') return value.order_index;
  }
  return null;
}
