/**
 * 御灵五行元数据
 *
 * 说明：五行是「御灵系」的分支体系，与六大系是**两套独立的轴**
 * （见 shared-types/world.js 注释："Six ability systems and five elements
 * are separate axes"）。因此本模块不并入 six-systems.js。
 *
 * 生克关系为世界观常识固化，供后续对战系统（相性加成）直接引用。
 */

export const FIVE_ELEMENT_IDS = Object.freeze(['jin', 'mu', 'shui', 'huo', 'tu']);

export const FIVE_ELEMENTS = Object.freeze({
  jin: Object.freeze({
    id: 'jin',
    name: '金',
    glyph: '金',
    color: '#c9a227',
    wash: '#f0e2b6',
    trait: '攻击',
    sheng: 'shui', // 金生水
    ke: 'mu', //      金克木
  }),
  mu: Object.freeze({
    id: 'mu',
    name: '木',
    glyph: '木',
    color: '#5f9e5f',
    wash: '#d6ead6',
    trait: '生长',
    sheng: 'huo', //  木生火
    ke: 'tu', //      木克土
  }),
  shui: Object.freeze({
    id: 'shui',
    name: '水',
    glyph: '水',
    color: '#4f86b8',
    wash: '#d3e4f2',
    trait: '控制/冰',
    sheng: 'mu', //   水生木
    ke: 'huo', //     水克火
  }),
  huo: Object.freeze({
    id: 'huo',
    name: '火',
    glyph: '火',
    color: '#c85a3c',
    wash: '#f2d6cc',
    trait: '爆发',
    sheng: 'tu', //   火生土
    ke: 'jin', //     火克金
  }),
  tu: Object.freeze({
    id: 'tu',
    name: '土',
    glyph: '土',
    color: '#a28455',
    wash: '#eadfc8',
    trait: '防御',
    sheng: 'jin', //  土生金
    ke: 'shui', //    土克水
  }),
});

export const FIVE_ELEMENT_LIST = Object.freeze(FIVE_ELEMENT_IDS.map((id) => FIVE_ELEMENTS[id]));

/** 无五行属性时的占位（如普通人类、未记载） */
export const NO_ELEMENT = Object.freeze({
  id: 'none',
  name: '无属性',
  glyph: '无',
  color: '#9aa5a0',
  wash: '#e6e9e5',
  trait: '常态',
  sheng: null,
  ke: null,
});

export function elementName(id) {
  if (id === 'none' || !FIVE_ELEMENTS[id]) return NO_ELEMENT.name;
  return FIVE_ELEMENTS[id].name;
}

/** 相性：a 与 b 的生克关系（供对战系统使用） */
export function elementRelation(a, b) {
  const A = FIVE_ELEMENTS[a];
  const B = FIVE_ELEMENTS[b];
  if (!A || !B) return { type: 'neutral', delta: 0 };
  if (A.ke === b) return { type: 'ke', delta: 0.15 }; // 我克
  if (B.ke === a) return { type: 'beike', delta: -0.15 }; // 克我
  if (A.sheng === b) return { type: 'sheng', delta: 0.08 }; // 我生
  if (B.sheng === a) return { type: 'beisheng', delta: -0.05 }; // 生我
  return { type: 'neutral', delta: 0 };
}
