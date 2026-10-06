/**
 * 六大系元数据（《罗小黑战记》灵质力体系）
 *
 * 数据锚点：worldview_luoxiaohei_v4.db
 *   - ability_systems#2「六大系」总体定义
 *   - ability_branches#1..#6、#7(强化系)、#8(治愈系)
 *
 * 兼容性红线：本文件的 id 与 zszm/src 侧 shared-types/world.js 的
 * ABILITY_SYSTEMS 键名 **完全一致**（yuling / suoyu / zaowu / xinling /
 * shengling / kongjian），保证两侧可以互相引用而无需映射表。
 * 展示顺序采用任务口径：御灵 → 锁御 → 造物 → 心灵 → 生灵 → 空间。
 * 雷达图轴序另见 RADAR_AXIS_ORDER（对齐 shared-ui radar6 默认轴序）。
 */

/** 六大系的标准 id（任务口径顺序） */
export const SIX_SYSTEM_IDS = Object.freeze([
  'yuling',
  'suoyu',
  'zaowu',
  'xinling',
  'shengling',
  'kongjian',
]);

/**
 * 雷达图 / 徽章墙的轴序。
 * 与 shared-ui/lxh-ui.js 的 radar6 默认 labels
 * ['御灵系','心灵系','空间系','锁御系','造物系','生灵系'] 一一对应。
 */
export const RADAR_AXIS_ORDER = Object.freeze([
  'yuling',
  'xinling',
  'kongjian',
  'suoyu',
  'zaowu',
  'shengling',
]);

/**
 * 六大系定义。
 *
 * innate=true 表示「无法后天习得」——目前只有空间系。
 * 派生算法会强制：innate 系在无文本证据时数值归零（忠于世界观）。
 */
export const SIX_SYSTEMS = Object.freeze({
  yuling: Object.freeze({
    id: 'yuling',
    name: '御灵系',
    glyph: '御',
    color: '#c8963c',
    wash: '#f6d089',
    innate: false,
    summary: '最基本的能力，分支为金木水火土；妖精因聚灵而生，天生具有御灵能力。',
    branches: Object.freeze(['金（攻击）', '木（生长）', '水（控制/冰）', '火（爆发）', '土（防御）']),
    representatives: Object.freeze(['罗小黑', '无限', '谛听', '鹿野']),
    source: 'ability_branches#1',
  }),
  suoyu: Object.freeze({
    id: 'suoyu',
    name: '锁御系',
    glyph: '锁',
    color: '#8a7f5c',
    wash: '#e3d9bb',
    innate: false,
    summary: '与法宝、法器、阵法相关的能力，如灵御、制灵；强度往往由「持有法宝品阶」决定。',
    branches: Object.freeze(['灵御', '制灵', '法宝', '法器', '阵法']),
    representatives: Object.freeze(['老君', '罗小白', '谛听']),
    source: 'ability_branches#6',
  }),
  zaowu: Object.freeze({
    id: 'zaowu',
    name: '造物系',
    glyph: '造',
    color: '#7a9a6a',
    wash: '#d9e6cf',
    innate: false,
    summary: '重构物体、改变物体性质与样貌；可依靠灵质空间中的物质灵「无中生有」。',
    branches: Object.freeze(['重构', '改变性质', '改变样貌', '无中生有']),
    representatives: Object.freeze(['鸠老']),
    source: 'ability_branches#3',
  }),
  xinling: Object.freeze({
    id: 'xinling',
    name: '心灵系',
    glyph: '心',
    color: '#8f7fb8',
    wash: '#e0d8ef',
    innate: false,
    summary: '与精神力相关，包括读心、心灵操纵、傀儡等。',
    branches: Object.freeze(['传音', '傀儡', '戏梦', '摄心', '读心']),
    representatives: Object.freeze(['老君']),
    source: 'ability_branches#5',
  }),
  shengling: Object.freeze({
    id: 'shengling',
    name: '生灵系',
    glyph: '生',
    color: '#6f9e7c',
    wash: '#d5e8db',
    innate: false,
    summary: '与生命相关的能力：洞察、观灵、豪夺、隐匿、治愈、追毫等；含强化系、治愈系两个子分支。',
    branches: Object.freeze(['洞察', '观灵', '豪夺', '隐匿', '治愈', '追毫']),
    subBranches: Object.freeze(['强化系', '治愈系']),
    representatives: Object.freeze(['鹿野', '风息', '李清凝']),
    source: 'ability_branches#2, #7, #8',
  }),
  kongjian: Object.freeze({
    id: 'kongjian',
    name: '空间系',
    glyph: '空',
    color: '#5b7fa8',
    wash: '#d3e0ef',
    innate: true,
    summary: '一切空间上的不连续变化，或时间上的加速与减缓；特殊形态为「领域」。',
    branches: Object.freeze(['吞噬', '传送', '转移', '蕴藏', '领域']),
    representatives: Object.freeze(['罗小黑', '无限', '老君']),
    source: 'ability_branches#4',
    rule: '无法后天习得，一个灵质空间只能附带一个空间系能力；失去空间系能力会因灵质空间衰竭而死。',
  }),
});

/** 按展示顺序排列的数组形式 */
export const SIX_SYSTEM_LIST = Object.freeze(SIX_SYSTEM_IDS.map((id) => SIX_SYSTEMS[id]));

/** 取六大系中文名 */
export function systemName(id) {
  return SIX_SYSTEMS[id] ? SIX_SYSTEMS[id].name : id;
}
