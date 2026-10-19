/**
 * Worldview vocabulary. Six ability systems and five elements are separate axes.
 * 六系（ABILITY_SYSTEMS）与五行（ELEMENTS）为两个独立轴。
 * 注意：御灵为「驾驭五行元素」之能力，本身无独立元素领域；御灵系角色的
 * element 取其所驾驭的五行（如 御灵·金），故 ELEMENT_LABELS 融合视图不单列御灵。
 */
export const ABILITY_SYSTEMS = Object.freeze({
  yuling: '御灵', shengling: '生灵', zaowu: '造物',
  kongjian: '空间', xinling: '心灵', suoyu: '锁御',
});
export const ELEMENTS = Object.freeze({jin:'金', mu:'木', shui:'水', huo:'火', tu:'土'});
export const WORLD_SCHEMA_VERSION = 1;
export const HERO_CHARACTER_IDS = Object.freeze({xiaohei:1, wuxian:2, fengxi:3});
export const CHARACTER_AFFINITIES = Object.freeze({
  1: Object.freeze({element:'jin', systems:['yuling','kongjian']}),
  2: Object.freeze({element:'jin', systems:['yuling','kongjian']}),
  3: Object.freeze({element:'mu', systems:['yuling','shengling']}),
});
