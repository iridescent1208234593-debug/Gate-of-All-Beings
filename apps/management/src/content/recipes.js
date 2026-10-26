/**
 * 灵境会馆 - 内容数据层：配方合成表（R1，对齐 CDDA recipes + construction 心智模型）
 *
 * 字段结构（CDDA recipes.json 的本地化投影）：
 * - result.type: 'item'     → 产物入资源计数库存（yaogao / mufang / fulu / huigu / faqiPei 等键）
 *                'resource' → 产物直接入全局资源（spirit / food / faqi）
 *   产物一律写入 state.resources[result.id]（item 即计数库存键），结算逻辑统一。
 * - requires.building: 必需建筑 id（需已建成且有空位，对应 CDDA 的 station/tools 门槛）
 * - requires.skill:   五行技能要求 { element, minLevel }，制造需对应五行小妖且修为等级达标
 * - tools:            预留工具位（CDDA tools 数组；本作暂无工具概念，留空占位）
 * - materials:        材料消耗（键为资源/材料 id：wood/herb/stone/ore/spirit/food/faqi）
 * - timeTicks:        单件工作耗时（tick，4 tick/秒）
 * - autolearn:        免研究、建筑落地即自动学会（同 CDDA auto-learn recipes 放行语义）
 *
 * 材料闭环（产物与消耗均为游戏内真实可获取途径）：
 * - wood/herb/stone/ore：gather 采集，来自地图资源点（树木/草药/石头/矿脉），见 GATHER_MATERIAL_TILE
 * - spirit/food：既有祭坛/灵田/资源点被动产出；faqi：既有锻造坊产出
 * - item 型产物（药膏/方材/符/酿/胚料）为自产自用储备：药膏自动医疗即时闭环，
 *   其余作为后续里程碑（木构建筑建材 / 战斗符箓 / 灵宴 / 真法器锻造）的储备。
 */
/** 材料/产物显示名 */
export const MATERIAL_NAMES = {
  // 既有资源
  spirit: '灵质',
  food: '食物',
  faqi: '法器',
  // 采集材料（gather 获得）
  wood: '灵木',
  herb: '草药',
  stone: '石料',
  ore: '矿料',
  // 合成产物（item 型计数库存 / resource 直入资源）
  yaogao: '凝神药膏',
  mufang: '灵木方材',
  fulu: '安神符',
  huigu: '灵果酿',
  faqiPei: '五行法器胚',
};

/** 可采集材料 → 对应地图资源点类型（tile.resource.type） */
export const GATHER_MATERIAL_TILE = {
  wood: 'tree',
  herb: 'herb',
  stone: 'stone',
  ore: 'ore',
};

/** 可采集材料键集合（jobAI 补料派活只认这些键） */
export const GATHER_MATERIALS = Object.keys(GATHER_MATERIAL_TILE);

/** 配方产出物品清单（item 型产物说明，供 UI 展示/后续系统引用） */
export const RESULT_ITEMS = [
  { id: 'yaogao', name: '凝神药膏', desc: '外敷灵药，伤重时小妖自动敷用以愈合伤势' },
  { id: 'faqiPei', name: '五行法器胚', desc: '熔铸而成法器雏形，是锻造真法器/装备的素材储备' },
  { id: 'mufang', name: '灵木方材', desc: '规整的灵木建材，供后续木构建筑/防震骨架使用' },
  { id: 'fulu', name: '安神符', desc: '安抚心神的符箓，可压制抑郁等精神异常（后续系统）' },
  { id: 'huigu', name: '灵果酿', desc: '以灵果佳酿与灵质陈酿的琼浆，日后可办灵宴（后续系统）' },
];

/** 配方列表 */
export const RECIPES = [
  {
    id: 'craft_yaogao',
    name: '凝神药膏',
    desc: '以草药配伍灵质研磨成膏，涂敷伤处以愈合伤势',
    type: 'craft',
    result: { type: 'item', id: 'yaogao', amount: 1 },
    requires: {
      building: 'lianyaolu',
      skill: { element: 'mu', minLevel: 1 },
    },
    tools: [],
    materials: { herb: 3, spirit: 20 },
    timeTicks: 60,
    autolearn: true,
  },
  {
    id: 'craft_faqi',
    name: '五行法器胚',
    desc: '取稀有矿料在锻造坊熔铸法器雏形，是锻造真法器的根基',
    type: 'craft',
    result: { type: 'item', id: 'faqiPei', amount: 1 },
    requires: {
      building: 'duanzaofang',
      skill: { element: 'jin', minLevel: 1 },
    },
    tools: [],
    materials: { ore: 4, spirit: 40 },
    timeTicks: 80,
    autolearn: true,
  },
  {
    id: 'craft_mufang',
    name: '灵木方材',
    desc: '将灵木剖方刨光，制成规整的建材方材',
    type: 'craft',
    result: { type: 'item', id: 'mufang', amount: 1 },
    requires: {
      building: 'gongfang',
      skill: { element: 'mu', minLevel: 1 },
    },
    tools: [],
    materials: { wood: 2, spirit: 5 },
    timeTicks: 50,
    autolearn: true,
  },
  {
    id: 'craft_fulu',
    name: '安神符',
    desc: '以草药汁画符于灵木纸，安定心神的护身符',
    type: 'craft',
    result: { type: 'item', id: 'fulu', amount: 1 },
    requires: {
      building: 'fulutai',
      skill: { element: 'shui', minLevel: 1 },
    },
    tools: [],
    materials: { herb: 2, wood: 1, spirit: 15 },
    timeTicks: 60,
    autolearn: true,
  },
  {
    id: 'craft_huigu',
    name: '灵果酿',
    desc: '以灵果佳酿为底，注入灵质封坛陈酿的琼浆',
    type: 'craft',
    result: { type: 'item', id: 'huigu', amount: 1 },
    requires: {
      building: 'jiufang',
      skill: { element: 'huo', minLevel: 1 },
    },
    tools: [],
    materials: { food: 6, spirit: 10 },
    timeTicks: 60,
    autolearn: true,
  },
  {
    id: 'craft_linglu',
    name: '灵质凝露',
    desc: '将石料与草药投入炼药炉凝炼，萃出浓缩灵质',
    type: 'craft',
    result: { type: 'resource', id: 'spirit', amount: 30 },
    requires: {
      building: 'lianyaolu',
      skill: { element: 'tu', minLevel: 1 },
    },
    tools: [],
    materials: { stone: 2, herb: 1, spirit: 8 },
    timeTicks: 50,
    autolearn: true,
  },
];

export const RECIPE_MAP = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export function getRecipe(id) {
  return RECIPE_MAP[id] || null;
}

/** 配方五行技能 → 显示文案（如「木行一阶」） */
export function skillLabel(recipe) {
  const s = recipe.requires && recipe.requires.skill;
  if (!s || !s.element) return '不限五行';
  const elName = { jin: '金', mu: '木', shui: '水', huo: '火', tu: '土' }[s.element] || s.element;
  const rank = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][(s.minLevel || 1) - 1] || String(s.minLevel || 1);
  return `${elName}行${rank}阶`;
}
