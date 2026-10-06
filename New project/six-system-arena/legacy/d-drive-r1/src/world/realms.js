/**
 * 修炼境界阶梯
 *
 * 数据锚点：worldview_luoxiaohei_v4.db → cultivation_realm（6 阶）
 *   qi 练气 / foundation 筑基 / golden 金丹 / nascent 元婴 / deity 化神 /
 *   tribulation 渡劫
 *
 * 派生扩展（非 DB 数据）：额外补一个虚拟阶 `mortal`（凡俗），
 * 用于「无灵质力的普通人类」，order=0，方便排序与展示。
 */

export const REALM_IDS = Object.freeze([
  'mortal',
  'qi',
  'foundation',
  'golden',
  'nascent',
  'deity',
  'tribulation',
]);

export const REALMS = Object.freeze({
  mortal: Object.freeze({
    id: 'mortal',
    name: '凡俗',
    order: 0,
    tier: '无灵质力',
    virtual: true,
    note: '普通人类，无灵质力。本阶为派生扩展，不在 DB cultivation_realm 中。',
  }),
  qi: Object.freeze({ id: 'qi', name: '练气', order: 1, tier: '入门', virtual: false }),
  foundation: Object.freeze({ id: 'foundation', name: '筑基', order: 2, tier: '小成', virtual: false }),
  golden: Object.freeze({ id: 'golden', name: '金丹', order: 3, tier: '中坚', virtual: false }),
  nascent: Object.freeze({ id: 'nascent', name: '元婴', order: 4, tier: '强者', virtual: false }),
  deity: Object.freeze({ id: 'deity', name: '化神', order: 5, tier: '一方霸主', virtual: false }),
  tribulation: Object.freeze({
    id: 'tribulation',
    name: '渡劫',
    order: 6,
    tier: '上古 / 神明',
    virtual: false,
  }),
});

/** 未判定时的占位（DB 无「角色 → 境界」字段，多数角色为未判定） */
export const UNKNOWN_REALM = 'unknown';

export const REALM_LIST = Object.freeze(REALM_IDS.map((id) => REALMS[id]));

export function realmName(id) {
  if (!id || id === UNKNOWN_REALM) return '未判定';
  return REALMS[id] ? REALMS[id].name : id;
}

export function realmOrder(id) {
  if (!id || !REALMS[id]) return -1;
  return REALMS[id].order;
}
