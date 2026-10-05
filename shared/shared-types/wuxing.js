/**
 * @file 五行（Wu Xing）基础常量与归一化工具。
 * 纯 JS ES Modules + JSDoc，零依赖，禁止 TypeScript。
 * 约束：常量内部只存 ASCII key，中文只作为 `label` 展示值存在。
 */

/**
 * 五行条目：ASCII key + 中文展示名 + 战斗定位。
 * @typedef {Object} WuxingEntry
 * @property {'jin'|'mu'|'shui'|'huo'|'tu'} key ASCII 键（与所在对象键名一致）
 * @property {string} label 中文展示名（单个中文字）
 * @property {string} role 战斗定位（攻击 / 生长 / 控制 / 爆发 / 防御）
 */

/**
 * 五行主表（冻结）。
 * @type {Readonly<Record<'jin'|'mu'|'shui'|'huo'|'tu', WuxingEntry>>}
 */
export const WUXING = Object.freeze({
  jin: Object.freeze({ key: 'jin', label: '金', role: '攻击' }),
  mu: Object.freeze({ key: 'mu', label: '木', role: '生长' }),
  shui: Object.freeze({ key: 'shui', label: '水', role: '控制' }),
  huo: Object.freeze({ key: 'huo', label: '火', role: '爆发' }),
  tu: Object.freeze({ key: 'tu', label: '土', role: '防御' }),
});

/**
 * 五行 key 顺序表（冻结）。顺序即 WUXING 的声明顺序。
 * @type {readonly ['jin','mu','shui','huo','tu']}
 */
export const WUXING_KEYS = Object.freeze(/** @type {any} */ (Object.keys(WUXING)));

/**
 * 五行 key → 中文 label 映射（冻结），由 WUXING 派生，避免手写重复数据。
 * @type {Readonly<Record<'jin'|'mu'|'shui'|'huo'|'tu', string>>}
 */
export const WUXING_LABELS = Object.freeze(
  /** @type {any} */ (
    Object.fromEntries(WUXING_KEYS.map((key) => [key, WUXING[key].label]))
  ),
);

/**
 * 中文 label → key 反向映射（内部使用，不导出）。由 WUXING_LABELS 反向生成。
 * @type {Readonly<Record<string, 'jin'|'mu'|'shui'|'huo'|'tu'>>}
 */
const LABEL_TO_WUXING_KEY = Object.freeze(
  /** @type {any} */ (
    Object.fromEntries(Object.entries(WUXING_LABELS).map(([key, label]) => [label, key]))
  ),
);

/**
 * 判断是否为合法五行 key（**精确匹配，不做归一化**）。
 * 中文字符串（如 `'金'`）必须返回 false。
 * @param {*} value 待判断的值
 * @returns {boolean} 是否为合法 ASCII 五行 key
 */
function hasWuxingKey(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(WUXING, value);
}

/**
 * 将任意输入归一为五行 key。兼容拼音（含大小写与首尾空白）与中文 label。
 * @param {*} input 原始输入，如 `'jin'` / `'JIN'` / `' 金 '` / `'金'`
 * @returns {'jin'|'mu'|'shui'|'huo'|'tu'|null} 归一后的 key；非法或非字符串返回 null
 * @example
 * toWuxingKey(' 金 '); // 'jin'
 * toWuxingKey('SHUI'); // 'shui'
 * toWuxingKey('雷');   // null
 */
export function toWuxingKey(input) {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (raw === '') return null;
  const lowered = raw.toLowerCase();
  if (hasWuxingKey(lowered)) return /** @type {any} */ (lowered);
  const byLabel = LABEL_TO_WUXING_KEY[raw];
  return byLabel === undefined ? null : byLabel;
}

/**
 * 五行 key → 中文 label。
 * @param {*} key 五行 key（ASCII，精确匹配）
 * @returns {string|null} 中文 label；非法 key 返回 null
 * @example
 * toWuxingLabel('jin'); // '金'
 * toWuxingLabel('金');  // null
 */
export function toWuxingLabel(key) {
  return hasWuxingKey(key) ? WUXING[/** @type {any} */ (key)].label : null;
}

/**
 * 判断输入是否为合法五行 key（**仅 key 合法才算 true**）。
 * @param {*} value 待判断的值
 * @returns {boolean} 是否为合法五行 key；`'金'` 返回 false
 * @example
 * isWuxing('jin'); // true
 * isWuxing('金');  // false
 */
export function isWuxing(value) {
  return hasWuxingKey(value);
}

/**
 * 查询五行的战斗定位。
 * @param {*} key 五行 key（ASCII，精确匹配）
 * @returns {string|null} 定位描述（如 `'攻击'`）；非法 key 返回 null
 * @example
 * wuxingRole('jin'); // '攻击'
 */
export function wuxingRole(key) {
  return hasWuxingKey(key) ? WUXING[/** @type {any} */ (key)].role : null;
}
