/**
 * 灵境会馆 - 内容数据层：聚落时代研究科技树
 * 纯数据。cost: 启动研究消耗的灵质；durationTicks: 研究总时长（研究台工作 tick 数）；
 * requires: 前置研究 id 列表；unlocks: 完成解锁的建筑 id 列表。
 */
export const RESEARCH = [
  {
    id: 'lingchu',
    name: '御灵启蒙',
    desc: '领悟御灵基础，为进阶研究奠基',
    cost: { spirit: 80 },
    durationTicks: 300,
    requires: [],
    unlocks: [],
  },
  {
    id: 'wuxing',
    name: '五行共鸣',
    desc: '立五行碑，令全员需求衰减放缓',
    cost: { spirit: 120 },
    durationTicks: 400,
    requires: ['lingchu'],
    unlocks: ['wuxingbei'],
  },
  {
    id: 'cangku',
    name: '仓库技艺',
    desc: '修筑灵仓，大幅提升资源储存上限',
    cost: { spirit: 100 },
    durationTicks: 350,
    requires: ['lingchu'],
    unlocks: ['warehouse'],
  },
  {
    id: 'shouwang',
    name: '守望结界',
    desc: '布下结界石，震慑妖物降低袭击概率',
    cost: { spirit: 140 },
    durationTicks: 450,
    requires: ['wuxing'],
    unlocks: ['jieshishi'],
  },
  {
    id: 'huiguan',
    name: '会馆雏形',
    desc: '搭建会馆大厅雏形，聚拢人心恢复社交',
    cost: { spirit: 160 },
    durationTicks: 500,
    requires: ['cangku'],
    unlocks: ['hall'],
  },
  // ---- 结盟时代 ----
  {
    id: 'jieqi',
    name: '结界加固',
    desc: '以灵质加固守护结界，筑起结界塔威慑妖物',
    cost: { spirit: 180 },
    durationTicks: 550,
    requires: ['wuxing'],
    unlocks: ['jietata'],
  },
  {
    id: 'faqi',
    name: '法器锻造',
    desc: '锻造坊中熔铸法器，为会馆积蓄制胜之器',
    cost: { spirit: 200 },
    durationTicks: 600,
    requires: ['cangku'],
    unlocks: ['duanzaofang'],
  },
  {
    id: 'renyaowaijiao',
    name: '人妖外交',
    desc: '架起传信塔，与人类聚落互通有无、缔结盟约（跃迁结盟时代关键）',
    cost: { spirit: 240 },
    durationTicks: 650,
    requires: ['jieqi'],
    unlocks: ['chuanxint'],
  },
  // ---- 会馆时代 ----
  {
    id: 'chuansongzhen',
    name: '传送阵',
    desc: '开辟传送枢纽，灵质空间与外界互通（跃迁会馆时代关键）',
    cost: { spirit: 300 },
    durationTicks: 800,
    requires: ['renyaowaijiao'],
    unlocks: ['chuansongshuniu'],
  },
  {
    id: 'xinxizhongshu',
    name: '信息中枢',
    desc: '建起信息中枢，汇集全馆灵境要闻',
    cost: { spirit: 340 },
    durationTicks: 900,
    requires: ['chuansongzhen'],
    unlocks: ['xinxizhongshu'],
  },
  {
    id: 'julinggongye',
    name: '聚灵工业化',
    desc: '灵质抽取工业化，灵质产出提升 20%',
    cost: { spirit: 380 },
    durationTicks: 1000,
    requires: ['xinxizhongshu'],
    unlocks: [],
  },
];

export const RESEARCH_MAP = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));

export function getResearch(id) {
  return RESEARCH_MAP[id] || null;
}

/** 是否满足前置（unlocked 为已完成研究 id 数组） */
export function canResearch(state, id) {
  const def = getResearch(id);
  if (!def) return false;
  return def.requires.every((rid) => state.tech.unlocked.includes(rid));
}

/** 建筑是否需要研究解锁（需要时返回研究 id，无需返回 null） */
export function buildingResearch(buildingId) {
  for (const r of RESEARCH) {
    if (r.unlocks.includes(buildingId)) return r.id;
  }
  return null;
}

/** 建筑是否已解锁可建造 */
export function buildingUnlocked(state, buildingId) {
  const rid = buildingResearch(buildingId);
  if (!rid) return true;
  return state.tech.unlocked.includes(rid);
}
