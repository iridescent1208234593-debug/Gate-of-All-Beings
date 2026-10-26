// 主题色板（禁止在代码里硬编码色值，统一引用此模块）
export const COLORS = {
  bg: 0x0d1117,
  ground: 0x1c2733,
  groundLine: 0x2a3a4a,
  cell: [
    0x5a9e8f, // 松绿
    0x7fbf7f, // 草绿
    0xd4a840, // 描金
    0x6fa8dc, // 水蓝
    0xc97bb8, // 藤紫
    0xe0805a, // 赭红
  ],
  food: 0xffcf5c,      // 能量团（暖金）
  weak: 0x9aa7b8,      // 濒死细胞（能量过低时的虚弱色）
  light: {
    sky: 0xffffff,     // 半球光天空色
    ground: 0x334455,  // 半球光地面色
    sun: 0xffffff,     // 主平行光
    off: 0x000000,     // 无发光（濒死关掉自发光）
  },
  meshBase: 0xffffff,  // InstancedMesh 材质基色（逐实例颜色叠加于此）
  senseRing: 0x6fd6ff, // 悬停感知圈（淡青）
  hudText: '#e6e1d5',
  // ---- stage-07 有机体专用模块色（体细胞随有机体色系基因取 cell 调色板）----
  organism: {
    flagellum: 0x66c7e8,  // 鞭毛：亮青（高速机动）
    mouth: 0xe0805a,      // 口器：赭红（捕食吸收）
    chloroplast: 0x86c96a, // 叶绿体：草亮绿（光合产能）
    claw: 0xd9534f,       // stage-11 捕食爪：肉食红（与 trophic.carnivore 同源，顶层消费者标识）
  },
  nnBrain: 0xa98bff,      // stage-14 神经网络个体标识色（紫：带“极简大脑”的谱系）
  // ---- stage-09 生成编辑器（组装模式）专用色 ----
  orgEditor: {
    ring: 0xd4a840,     // 被组装有机体的地面选中环（描金，与 HUD 强调色同源）
    gridSlot: 0x1c2733, // 网格空格底色（DOM 色块经 cssHex 转换）
    gridEdge: 0x2a3a4a, // 网格格线 / 边框
    ghost: 0x6fa8dc,    // 新增模块的“待放置”提示色
  },
  // ---- stage-10 环境分区地面色带（富营养 -> 贫瘠）----
  envZone: {
    rich: 0x2f5d4a,   // 富营养区（深绿，食物丰沛）
    mid: 0x263c4a,    // 过渡区（青灰）
    poor: 0x2a2f36,   // 贫瘠区（石墨灰，食物稀缺）
  },
  // ---- stage-10 世代趋势图配色（DOM Canvas2D）----
  chart: {
    bg: 0x141c24,     // 图表底色
    grid: 0x2a3a4a,   // 网格线
    frame: 0x9fb0bd,  // 坐标轴 / 图例文字
    all: 0xd4a840,    // 全体平均模块数（描金）
    rich: 0x86c96a,   // 富营养区平均模块数（草绿）
    poor: 0x9aa7b8,   // 贫瘠区平均模块数（灰）
  },
  // ---- stage-11 网格环境（草地/水域/沙地瓦片）----
  tile: {
    grass: 0x2c4a34,  // 草地：植被基底（可生长植物）
    water: 0x1b3350,  // 水域：不产植物
    sand: 0x4a4133,   // 沙地：岸线贫瘠地
  },
  // ---- stage-11 生产者（植物）与生态金字塔图例 ----
  plant: {
    young: 0x4f9d5d,  // 幼株：生物量低
    ripe: 0x9adf8f,   // 成熟：生物量高（能量足）
  },
  trophic: {
    producer: 0x9adf8f,  // 生产者（植物）
    herbivore: 0xd4a840, // 草食者
    carnivore: 0xd9534f, // 肉食者
  },
  // ---- stage-12 昼夜循环（天色 / 光色按光照系数在夜-昼端点间插值）----
  dayNight: {
    bgDay: 0x1d3145,      // 白昼天色（偏亮蓝灰，衬出地面）
    bgNight: 0x080b10,    // 深夜天色（近黑）
    skyDay: 0x9fc4e8,     // 白昼环境光·天空色（日光）
    skyNight: 0x2a3a52,   // 夜间环境光·天空色（冷月色）
    groundDay: 0x4a5a48,  // 白昼环境光·地面反射色
    groundNight: 0x1b2230,// 夜间环境光·地面反射色
    sunDay: 0xfff2d6,     // 白昼主光（暖白日光）
    sunNight: 0x9db8e0,   // 夜间主光（冷月色）
    fogDay: 0x1a2b3c,     // 白昼雾色（与天色同源）
    fogNight: 0x0a0e13,   // 夜间雾色（更暗，视距短）
    tempHot: 0xd9534f,    // 温度读数偏暖（与肉食红同源）
    tempCold: 0x6fa8dc,   // 温度读数偏冷（与水蓝同源）
  },
  // ---- stage-12 经营面板读数色（DOM 覆盖层）----
  eco: {
    day: 0xd4a840,      // 白昼光照条（描金，与 HUD 强调色同源）
    night: 0x3a5a86,    // 夜晚光照条（冷蓝，呼应夜间灯光）
    energy: 0x86c96a,   // 总能量读数（草绿，与富营养带同源）
  },
  // ---- stage-13 环境干预（地面点击菜单 / 地表改写 / 气候读数；色值一律走本文件 token）----
  intervention: {
    menuBg: 0x141c24,    // 菜单底色（与面板同源，DOM 经 cssHex 转换）
    menuEdge: 0x2a3a4a,  // 菜单边框
    seed: 0x86c96a,      // 播种植物按钮（生产者草绿）
    drain: 0xc8b48a,     // 排水成陆按钮（沙地色：露出陆地）
    fill: 0x6fa8dc,      // 注水成湖按钮（水蓝）
    warm: 0xd9534f,      // 升温按钮（与肉食红同源）
    cool: 0x6fa8dc,      // 降温按钮（与水蓝同源）
    coldFit: 0x6fa8dc,   // 冷适应（保温型，多体细胞）读数
    warmFit: 0xd4a840,   // 暖适应（散热型，单细胞）读数
    pick: 0x9adf8f,      // 被选中的地面格高亮方框
  },

  // ---- stage-15 群体与领地（src/core/tribe.js + renderer 群体标识）----
  // 群体配色：按群体 id 稳定取色，成员/领地圈/悬浮标记共用同一色源，一眼可辨「谁跟谁是一伙」
  tribe: {
    palette: [
      0x5a9e8f, 0xd4a840, 0x7fa8d8, 0xc47ba0,
      0x86c96a, 0xd08a5a, 0x9a8fd0, 0x6fbfb8,
    ],
    selected: 0xf0e6c8,  // 被选中群体（面板点击 / 点中成员）的标识色
    target: 0xd4a840,    // 「移动」指令目标点标记色（与强调色同源）
    forbidden: 0xd9534f, // 「繁殖禁令」生效标记色（与肉食红同源，表“禁止”语义）
  },

  // ---- stage-16 文明：资源点（水/食物/矿物三色）与科技/城市标识 ----
  // 三色资源与既有语义色同源，玩家凭颜色即可对应资源类型
  resource: {
    water: 0x6fa8dc,   // 水点（水蓝，与水瓦片同源）
    food: 0x86c96a,    // 食物点（草绿，与生产者同源）
    mineral: 0xd4a840, // 矿物点（描金，与强调色同源）
  },
  civ: {
    nodeSpent: 0x3a4653,   // 采空枯竭的资源点（石墨灰：无货可采）
    gatherRing: 0x9adf8f,  // 采集中的节点脉动圈（草亮绿，表“正在取用”）
    techOn: 0xd4a840,      // 已解锁科技（描金）
    techOff: 0x55636e,     // 未解锁科技（暗灰）
    city: 0xf0e6c8,        // 建城后的城市核心（暖白，与群体选中色同源）
    cityRing: 0xd4a840,    // 城邦范围圈（描金）
    fireGlow: 0xffcf5c,    // 火科技照明暖光（与食物团同源的暖金）
  },
};

// 十六进制数值 -> CSS 色串（DOM 覆盖层色块用；色源仍只来自本文件 token）
export function cssHex(v) {
  return '#' + v.toString(16).padStart(6, '0');
}

