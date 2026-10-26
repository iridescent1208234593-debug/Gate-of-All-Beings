/**
 * @file 元素体系常量与归一化工具：五系（五行）+ 五扩展系 + 通用，并负责「灵质空间」术语消歧。
 * 纯 JS ES Modules + JSDoc，零依赖。
 * 约束：常量内部只存 ASCII key，中文只作为 `label` 展示值存在。
 */

import { WUXING_KEYS, WUXING_LABELS } from './wuxing.js';

/**
 * 全量元素 id 联合类型。
 * @typedef {'jin'|'mu'|'shui'|'huo'|'tu'|'shengling'|'kongjian'|'xinling'|'zaowu'|'suoyu'|'generic'} ElementId
 */

/**
 * 五系之外的扩展元素系（id → 中文 label，冻结）。
 * @type {Readonly<{shengling:string, kongjian:string, xinling:string, zaowu:string, suoyu:string}>}
 */
export const EXTENDED_ELEMENTS = Object.freeze({
  shengling: '生灵系',
  kongjian: '空间系',
  xinling: '心灵系',
  zaowu: '造物系',
  suoyu: '锁御系',
});

/**
 * 卡牌 `element: '通用'` 的归一键。
 * @type {'generic'}
 */
export const GENERIC_ELEMENT_KEY = 'generic';

/**
 * 全量元素 id → 中文 label 映射（冻结，11 项）。
 * 五系由 WUXING_LABELS 派生，避免重复维护。
 * @type {Readonly<Record<ElementId, string>>}
 */
export const ELEMENT_LABELS = Object.freeze(
  /** @type {any} */ ({
    ...WUXING_LABELS,
    ...EXTENDED_ELEMENTS,
    [GENERIC_ELEMENT_KEY]: '通用',
  }),
);

/**
 * 全量元素 id 顺序表（冻结，11 项）：五系 + 五扩展系 + generic。
 * @type {readonly ElementId[]}
 */
export const ELEMENT_IDS = Object.freeze(/** @type {any} */ (Object.keys(ELEMENT_LABELS)));

/**
 * 中文 label → 元素 id 反向映射（内部使用），由 ELEMENT_LABELS 反向生成。
 * @type {Readonly<Record<string, ElementId>>}
 */
const LABEL_TO_ELEMENT_ID = Object.freeze(
  /** @type {any} */ (
    Object.fromEntries(Object.entries(ELEMENT_LABELS).map(([id, label]) => [label, id]))
  ),
);

/**
 * 判断是否为合法元素 id（**精确匹配，不做归一化**）。
 * @param {*} value 待判断的值
 * @returns {boolean} 是否为合法 ASCII 元素 id
 */
function hasElementId(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ELEMENT_LABELS, value);
}

/**
 * 将任意输入归一为元素 id。兼容五系中文/拼音、扩展系中文/拼音与「通用」。
 * @param {*} input 原始输入，如 `'金'` / `'jin'` / `'空间系'` / `'kongjian'` / `'通用'` / `'generic'`
 * @returns {ElementId|null} 归一后的元素 id；非法或非字符串返回 null
 * @example
 * toElementId('通用');   // 'generic'
 * toElementId('空间系'); // 'kongjian'
 * toElementId('金');     // 'jin'
 */
export function toElementId(input) {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (raw === '') return null;
  const lowered = raw.toLowerCase();
  if (hasElementId(lowered)) return /** @type {any} */ (lowered);
  const byLabel = LABEL_TO_ELEMENT_ID[raw];
  return byLabel === undefined ? null : byLabel;
}

/**
 * 判断输入是否为合法元素 id（**仅 key 合法才算 true**）。
 * @param {*} value 待判断的值
 * @returns {boolean} 是否为合法元素 id；`'金'` 返回 false
 */
export function isElementId(value) {
  return hasElementId(value);
}

/**
 * 元素 id → 中文 label。
 * @param {*} key 元素 id（ASCII，精确匹配）
 * @returns {string|null} 中文 label；非法 key 返回 null
 * @example
 * elementLabel('kongjian'); // '空间系'
 */
export function elementLabel(key) {
  return hasElementId(key) ? ELEMENT_LABELS[/** @type {any} */ (key)] : null;
}

/**
 * 判断元素 id 是否属于五行（前五系）。
 * @param {*} id 元素 id
 * @returns {boolean} 前五系返回 true，扩展系与 generic 返回 false
 * @example
 * isWuxingElement('jin');     // true
 * isWuxingElement('kongjian');// false
 */
export function isWuxingElement(id) {
  return typeof id === 'string' && WUXING_KEYS.includes(/** @type {any} */ (id));
}

// ---------------------------------------------------------------------------
// 术语消歧：三系统中「灵质空间」同词异义
// ---------------------------------------------------------------------------

/**
 * 灵质空间的两种语义取值（冻结）。
 * @type {Readonly<{BASE_SPIRIT_SPACE:'base', SPIRIT_SPACE_NODE:'node'}>}
 */
export const SPIRIT_SPACE_KIND = Object.freeze({
  BASE_SPIRIT_SPACE: 'base',
  SPIRIT_SPACE_NODE: 'node',
});

/**
 * 经营模拟（lingjing-huiguan）语义：玩家基地空间，
 * 结构为 `space: { width, height, tiles, spiritDensity }`。
 * @type {'base_spirit_space'}
 */
export const BASE_SPIRIT_SPACE = 'base_spirit_space';

/**
 * 卡牌战斗（Slay-the-Web / xiuxian-card）语义：探索节点房间。
 * @type {'spirit_space_node'}
 */
export const SPIRIT_SPACE_NODE = 'spirit_space_node';

/**
 * 依据系统标识解析「灵质空间」的语义类别，消除同词异义。
 * @param {*} system 系统标识：`'lj'`（经营模拟）/ `'stw'`（卡牌战斗）/ `'xx'`（修仙卡牌）
 * @returns {'base'|'node'|null} `'lj'` → `'base'`；`'stw'` / `'xx'` → `'node'`；其他 → null
 * @example
 * resolveSpiritSpaceKind('lj');  // 'base'
 * resolveSpiritSpaceKind('eco'); // null
 */
export function resolveSpiritSpaceKind(system) {
  if (typeof system !== 'string') return null;
  const key = system.trim().toLowerCase();
  if (key === 'lj') return SPIRIT_SPACE_KIND.BASE_SPIRIT_SPACE;
  if (key === 'stw' || key === 'xx') return SPIRIT_SPACE_KIND.SPIRIT_SPACE_NODE;
  return null;
}
