/** Worldview vocabulary. Six ability systems and five elements are separate axes. */
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
