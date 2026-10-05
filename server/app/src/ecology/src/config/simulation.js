import { COLORS } from './colors.js';
export const WORLD = {
  bounds: 46,          // 场地半宽，x/z ∈ [-bounds, bounds]
  floorY: 0,

  // ---- stage-02 代谢与进食 ----
  cellStartCount: 80,     // 初始细胞数
  cellRadius: [0.5, 1.1], // stage-02 固定区间（stage-03 起由基因映射，见 GENOME.size）
  cellSpeed: [3.0, 7.0],  // stage-02 固定区间（stage-03 起由基因映射，见 GENOME.speed）
  energyStart: [50, 85],  // 初始能量区间
  maxEnergy: 130,         // 能量上限（吸收后封顶）
  weakEnergyFrac: 0.25,   // 低于该能量比例视为濒死
  drainBase: 2.6,         // 基础能耗/秒
  drainVar: 0.2,          // 个体能耗浮动 ±20%
  senseRange: 10,         // stage-02 固定感知（stage-03 起由基因映射，见 GENOME.perception）
  turnSeek: 4.0,          // 趋向食物转向速率（弧度/秒）
  turnWander: 1.6,        // 无目标时巡游转向速率
  wanderFreq: 0.7,        // 巡游时每秒随机改向概率
  absorbGap: 0.5,         // 吸收判定额外间隙
  absorbSlowDist: 3.0,    // 靠近食物开始减速的距离
  slowFactor: 0.45,       // 减速比例
  weakSlowFactor: 0.15,   // 濒死减速比例（几乎停住）
  foodTarget: 90,         // 食物池目标数量
  foodEnergy: [18, 30],   // 单团食物能量区间
  foodRegenPerSec: 6,     // 食物再生速度（团/秒；stage-10 由 10 收紧，使供给与需求同量级）
  foodRegenZoneBase: 0.25, // 分区再生基线：各区速率 = foodRegenPerSec × (base + 该带丰度)
  foodRadius: [0.30, 0.44],
  reseedCount: 24,        // 全灭保护：重新播种数量

  // ---- stage-04 分裂繁殖与自然选择 ----
  splitEnergyFrac: 0.9,   // 能量达到上限该比例即触发分裂
  splitChildFrac: 0.5,    // 分裂后父与子各保留的能量比例
  maxCells: 130,          // 种群上限，超出后按能量从弱到强淘汰
  maxSplitPerTick: 10,    // 每 tick 最多分裂数（繁殖节律，避免瞬间爆群）
  splitOffset: 1.4,       // 子代出生位置相对父的偏移
  autoEvoSeconds: 6,      // 每 N 秒结算一代存活基因统计（auto-evo）

  // ---- stage-05 3D 外观基因化 ----
  maxInstances: 220,     // 细胞 InstancedMesh 容量（>= 种群上限 + 单 tick 分裂余量）

  // ---- stage-06 细胞编辑器 MVP ----
  evoStart: 8,           // 初始进化点（编辑器预算）
  evoPointPerSplit: 1,   // 每次分裂繁殖 +1 进化点
  evoEnergyPerPoint: 140,// 吸收能量累计该值 +1 进化点（鼓励进食策略）
  editorAttrStep: 0.05,  // 编辑器 +/- 按钮单步调整的基因值
  editorCostPerStep: 1,  // 每步调整消耗的进化点
  editorShowCount: 3,    // 应用基因后向场景投放的展示子代数

  // ---- stage-07 多细胞模块模型（organism）----
  orgStartCount: 8,      // 初始有机体数量（演示体 + 同胞 + 随机体；stage-15 起演示体带同胞成群体）
  orgMax: 24,            // 有机体数量上限（spawn/渲染容量上限）
  orgReseedCount: 4,     // 有机体全灭后的重新播种数
  orgGridSize: 3,        // 模块布局网格边长（gx/gy ∈ 0..2）
  orgSpacing: 1.5,       // 模块格间距（世界单位）
  orgBodyRadius: 1.1,    // body 模块半径
  orgModuleRadius: 0.5,  // 其它模块半径（鞭毛/口器/叶绿体）
  orgMaxEnergyBase: 120, // 有机体能量基础上限
  orgBodyEnergy: 26,     // 每多一个 body 模块 + 能量上限
  orgDrainExtraBody: 0.18,   // 每 body 模块能耗系数增量（体积更重；stage-10 抬高以放大体型维持成本差异）
  orgDrainExtraModule: 0.16, // 每模块数能耗系数增量（维持更多结构；stage-10 同上）
  orgDrainQuadModule: 0.02,  // 模块数的二次能耗系数（结构堆叠的边际维持成本递增；stage-10 体型取舍）
  orgFlagSpeedBonus: 0.14,   // 每个 flagellum 模块 + 移动速度比例
  orgMouthAbsorb: 0.4,       // 每个 mouth 模块 + 吸收量比例
  orgPhotoPerSec: 3.2,       // 每个 chloroplast 模块每秒被动产能
  orgEatRangeBase: 1.6,      // 有机体进食基础判定半径
  orgEatRangeBody: 0.3,      // 每 body 模块 + 进食半径
  orgEatRangeMouth: 0.25,    // 每 mouth 模块 + 进食半径

  // ---- stage-08 有机体行为（behaviors.js）----
  orgSizeBodyWeight: 4,       // 体型分：body 模块权重（大块头）
  orgSizeModuleWeight: 0.5,   // 体型分：其余模块权重
  orgFleeSizeRatio: 1.5,      // 体型比达到该值 -> 小者视为威胁并逃跑
  orgFleeSenseMul: 1.25,      // 威胁感知范围放大倍率（警觉）
  orgFleeMinRange: 12,        // 威胁感知保底半径（基因感知再小也能察觉近处大个体）
  orgChaseSizeRatio: 1.5,     // 体型比达到该值 -> 大者把小者当压制对象
  orgChaseRange: 16,          // 压制视野（独立于基因感知半径）
  orgChaseEnergyFrac: 0.45,   // 能量比例高于该值才有力气压制
  orgChaseProb: 0.8,          // 每秒触发压制的概率（避免全场互追）
  orgFleeBoost: 1.18,         // 逃跑速度倍率（略快于巡航，可逃脱）
  orgPhotoEnergyFrac: 0.55,   // 能量比例高于该值且无口器需要时倾向停留光合
  orgPhotoChloroPref: 2,      // 叶绿体达到该数量时即使近处有食物也优先光合
  orgPhotoRestMul: 1.6,       // 停留光合时叶绿体产能倍率
  orgDrainMulSeek: 1.0,       // 觅食行动成本
  orgDrainMulFlee: 1.6,       // 逃跑行动成本（全力逃逸更耗能）
  orgDrainMulChase: 1.25,     // 压制行动成本
  orgDrainMulPhoto: 0.4,      // 停留光合行动成本（休养生息省能）
  orgDrainMulWander: 0.9,     // 巡游行动成本

  // ---- stage-09 生成编辑器（网格组装）----
  orgEditorAddCost: 2,      // 添加一个模块消耗的进化点
  orgEditorAddEnergy: 12,   // 添加一个模块额外消耗的有机体能量（应用时一次性结算）
  orgEditorMinEnergy: 20,   // 组装结算后有机体能量不得低于该值（能量不足则无法再添加）
  orgEditorMinBody: 1,      // 合法布局至少保留 1 个 body 模块

  // ---- stage-10 世代演化与体型趋势（环境分区 + 有机体繁殖）----
  envZoneCount: 3,              // 环境分区数（沿 x 轴均分为纵向营养带）
  envZoneRichness: [1.0, 0.55, 0.2], // 各区营养丰度：富营养 -> 过渡 -> 贫瘠
  envFoodScarcity: 0.9,         // 全局食物稀缺系数（<1 收紧供给，形成竞争压力）
  envZoneQuotaPow: 1.0,         // 食物配额按丰度分摊的指数偏置（>1 让富营养带独占更多供给，拉大分区能量差）
  envBandOpacity: 0.3,          // 环境分区地面色带透明度
  orgSplitEnergyFrac: 0.85,     // 有机体能量达上限该比例即触发分裂繁殖
  orgSplitChildFrac: 0.5,       // 分裂后父/子各保留的能量比例
  orgMaxSplitPerTick: 2,        // 每 tick 最多发生的有机体分裂数（繁殖节律）
  orgSplitOffset: 2.0,          // 子代出生相对父的位置偏移
  orgMinModules: 3,             // 有机体最少模块数（布局变异删减下限）
  orgAutoEvoSeconds: 10,        // 每 N 秒结算一代有机体（模块布局 + 分区统计）
  orgEvoHistoryMax: 60,         // 世代记录最多保留条数（趋势图数据窗）
  orgSpawnWeightSmooth: 0.25,   // spawn 分区权重平滑系数（保留基础概率，避免某区绝育）
  orgSpawnMinWeight: 0.05,      // spawn 分区权重下限（保证每区仍有 5% 采样机会）
  orgPioneerCount: 2,           // 某营养带整代无存活时播入的殖民者数量（孢子扩散）
  orgZoneCapMin: 2,             // 每个营养带的种群承载下限（按丰度分摊 orgMax，贫瘠带也留得住 2 只）
  orgCrossZoneFoodPenalty: 60,  // 跨营养带觅食的等效距离惩罚（个体日常只在本带觅食；本带断粮时才外扩）
  orgHomePull: 0.5,             // 归巢拉力系数：偏离出生带越远，越被拉回本带（本地适应）
  orgHomeSpeedCap: 1.3,         // 归巢后的速度上限倍率（相对个体基础速度）
  orgPhotoZoneBase: 0.05,       // 初级生产力基线：贫瘠带光合收益 = base + (1-base)*该带丰度（接近 0 时产能几乎完全由本带丰度决定）
  orgGrazePerSec: 12.0,         // 本地初级生产力摄食基速（/秒）：收入随摄食器官规模 × 本带丰度增长，贫瘠带只供得起小体型
  orgStarveRatio: 0.3,          // （参考值）能量维持比例的濒危线：HUD/观察口径用，不作出局判据
  // stage-10 选择压力口径修正：出局判据从“能量比例”改为“可维持秒数”(energy/drainPerSec)。
  // 比例口径下大个体 maxEnergy 高、比例下降慢，反而更耐饿，会把体型分异拉反；
  // 秒数口径直接看“存量还能撑多久”，模块多（耗能高）的个体在低产区先撑不住。
  orgStarveSeconds: 9,          // 生存线：可维持秒数低于该值即饥饿出局
  orgCullMode: 'reserve',       // 满员削峰口径：'reserve' 比能量储量（富带向大体型倾斜）/ 'vitality' 比可维持秒数
  orgZoneModuleCap: [9, 7, 5],  // 各营养带的模块数承载力上限：低产区养不起太多细胞模块
  orgFoodZoneBase: 0.4,         // 进食能量基线：贫瘠带食物营养密度 = base + (1-base)*该带丰度
  orgSplitCooldown: 10,         // 分裂后成熟期（秒），期间不再分裂，给种群周转留出节律

  // ---- stage-11 网格地形（草地/水域/沙地）+ 生态金字塔（植物-草食-肉食）----
  // 地形：由种子噪声生成高度场，再按分位数切成三类瓦片（比例恒定，任何种子都稳定）
  mapCols: 24,                  // 网格列数（沿 x）
  mapRows: 24,                  // 网格行数（沿 z）
  mapSeed: 20260910,            // 地形随机种子（同种子 -> 同地图，便于验收与回归）
  mapWaterFrac: 0.22,           // 水域占比（高度场低分位）
  mapSandFrac: 0.14,            // 沙地占比（水域之上的岸线）
  mapCoarse: 6,                 // 噪声粗网格边长（越小地形越破碎）
  tileLift: 0.015,              // 瓦片层相对地面的抬升（避免与地面/色带 z-fighting）
  tileFill: 0.94,               // 瓦片填充率（<1 留出格线，网格感更清楚）
  tileOpacity: 0.92,            // 瓦片不透明度（略透出下层营养带色带，两层信息叠加可见）
  plantRadius: 0.34,            // 植物判定半径（渲染与取食共用）
  // 生产者（植物）：只在草地萌发，生物量随时间恢复
  plantTarget: 130,             // 植物存量目标（草地承载量）
  plantRegenPerSec: 5.5,        // 新株萌发速率（株/秒，仅草地且未达目标时）
  plantGrowPerSec: 2.0,         // 单株生物量恢复速率（/秒）
  plantMaxBiomass: 26,          // 单株生物量上限（= 可供取食的能量池）
  plantStartBiomass: 12,        // 初始/新萌发植株的生物量
  plantMinBiomass: 0.8,         // 生物量低于该值的植株被啃食殆尽（从场景移除，由萌发补位）
  plantBitePerSec: 12,          // 草食者取食基速（生物量/秒），再乘吸收倍率与本带丰度
  plantEnergyPerBiomass: 1.5,   // 生物量 -> 能量换算（1 生物量 = 1.5 能量，与食物团同量级）
  plantZoneBase: 0.15,          // 初级生产力基线：本带植物能量 = base + (1-base)*丰度（贫瘠带草地极瘦）
  plantRenderSlack: 40,         // 植物渲染实例冗余（萌发瞬时可能略超存量目标）
  plantRenderMinScale: 0.5,     // 幼株渲染缩放下限（生物量 0 时）——成熟株缩放到 1.0
  // 营养级（食性）：diet 由模块构成决定
  orgClawAttack: 1,             // 每个捕食爪的攻击力（HUD/捕食判定强度）
  orgEatRangeClaw: 0.3,         // 每 claw 模块 + 进食（接触）半径
  clawEvolveChance: 0.08,       // 随机布局/变异中出现捕食爪的权重（低频，肉食为演化分支而非默认）
  herbivoreGrazeMul: 0.5,       // 草食者的初级生产力摄食折扣（主粮是植物，碎屑仅垫底）
  herbivoreFoodMul: 0.6,        // 草食者吸食悬浮营养团的折扣
  carnivoreGrazeMul: 0.06,      // 肉食者几乎不能靠初级生产力过活（必须捕猎）
  carnivoreFoodMul: 0.15,       // 肉食者吸食营养团的折扣
  carnivorePreyRatio: 1.1,      // 肉食者眼中的可捕猎体型比（比通用压制阈值低：獠牙就是捕食权）
  carnivoreHuntRange: 22,       // 肉食者捕猎视野（独立于基因感知）
  carnivoreChaseEnergyFrac: 0.1,// 肉食者饥饿也会出击（通用压制需 45% 能量，肉食者不设此限）
  carnivoreContactGap: 0.85,    // 接触判定余量（eatRange + 该值内即视为咬中）
  carnivoreAssimilation: 0.6,   // 捕食能量同化率（猎物存量能量转入捕食者的比例）
  carnivoreBiomassBonus: 6,     // 每模块的肉量补偿能量（小猎物也有肉可吃）
  carnivoreKillCooldown: 8,     // 捕食后冷却（秒）：同一只肉食者不能连续屠场，保住猎物种群
  carnivoreEnergyCost: 6,       // 每次捕食的额外行动开销（咬合消耗）
  maxKillsPerTick: 1,           // 每 tick 全场最多发生的捕食次数（捕食节律，防瞬间清场）
  carnivoreSatietyFrac: 0.95,   // 能量达到上限该比例即视为饱腹，不再捕猎（避免无差别屠场）
  carnivoreMinEff: 0.35,        // 捕食同化效率下限：猎物再大也至少能咬下三成五（体型比缩放的下限）
  orgStartCarnivores: 1,        // 初始肉食者数量（保证食物链一开场就有顶层消费者）
  // ---- stage-11 取食链判定（植物 -> 草食者 -> 肉食者）----
  plantBiteGap: 0.35,           // 草食者够到植株的判定余量（eatRange + plantRadius + 该值）
  carnivoreContactPerModule: 0.25, // 猎物每多一个模块，被咬中的判定半径增量（大猎物更易被咬中）
  orgCarnivoreReseed: 1,        // 顶层消费者全灭保护：场上没有肉食者时补播的「猎手」数量
  carnivoreShareCap: 0.5,       // stage-11 捕食者配额：肉食者繁殖上限 = max(1, ceil(草食数*该比例))，
                                // 防止天敌在猎物不足时继续增殖、把金字塔顶端撑到比底端还宽
  carnivoreReseedMinPrey: 2,    // stage-11 补播猎手所需的草食存栏下限：猎物太少不再空降天敌

  // ---- stage-12 昼夜循环 + 时间流速 + 生态经营面板 ----
  dayCycleSeconds: 72,          // 一昼夜的实时秒数（1x 流速下，便于观察完整昼夜）
  dayStartPhase: 0.35,          // 初始相位（0=午夜，0.5=正午；0.35 为清晨将亮）
  dayNightMin: 0.12,            // 深夜光照系数下限（不会全黑，仍可辨物）
  maxStepSeconds: 0.1,          // 单 tick 世界步长上限（倍速下的稳定性保护）
  tempDayC: 28,                 // 白昼地图温度（℃，正午）
  tempNightC: 8,                // 夜晚地图温度（℃，午夜）
  photoLightBase: 0.2,          // 叶绿体产能的夜间基线：夜里只剩正午的两成
  visionLightBase: 0.45,        // 感知半径的夜间基线：夜里视野缩到白天四成五
  timeScaleOptions: [1, 2, 3],  // 可选时间流速（倍速）
  timeScaleDefault: 1,          // 默认时间流速

  // ---- stage-13 环境干预（播种植物 / 排水注水改瓦片 / 调温度）----
  climateTempBase: 18,           // 基线气候温度（℃，玩家调温的出发点）
  tempOffsetStep: 5,             // 每次调温步长（℃）
  tempOffsetLimit: 25,           // 基线温度偏移上限（±℃，防一键冰封/蒸干）
  climateOptimalBase: 24,        // 单细胞个体最适温度（℃，偏暖）
  climateInsulationPerBody: 3.5, // 每多一个体细胞的保温效应（最适温度下移 ℃，大块头耐寒）
  climateToleranceC: 5,          // 温度耐受带（℃）：偏离最适温度在此范围内无额外开销
  climateDrainPerStress: 0.08,   // 每超耐受带 1℃ -> 维持耗能 +8%（可维持秒数随之缩短）
  climateColdBodyMin: 3,         // body 模块数 ≥ 该值 -> 冷适应（多体细胞保温型）
  climateWarmBodyMax: 1,         // body 模块数 ≤ 该值 -> 暖适应（散热型）
  climatePlantMinC: 6,           // 初级生产力适宜温度下限（℃）
  climatePlantMaxC: 32,          // 适宜温度上限（℃）
  climatePlantMinMul: 0.2,       // 极端温度下植物生长/萌发的最低倍率（不至于绝收）
  climatePlantDecayPerC: 0.05,   // 每偏离适宜区间 1℃ 的生产力衰减
  interventionSeedCount: 8,      // 一次“播种植物”在目标格补种的株数
  interventionSeedRadius: 6,     // 播种作用半径（世界单位）：在点击点附近草地上撒种
  interventionSeedBiomass: 22,   // 播种株初始生物量（高于自然萌发的 2~6，救急立竿见影）
  interventionSeedOverflow: 1.25, // 播种允许的存量溢出上限（相对 plantTarget 的倍率）
  interventionMarkerOpacity: 0.95, // 干预目标格高亮方框不透明度
  interventionMarkerLift: 0.05,    // 高亮方框离地抬升（避免与瓦片 z-fighting）
  interventionMenuRadius: 6,       // 播种提示：菜单里展示的作用半径（世界单位，仅文案用）

  // ---- stage-14 简易神经网络个体（src/core/nn.js）----
  nnSpawnChance: 0.5,              // 初始/补播个体携带神经网络（“有脑”）的概率
  nnEvolveChance: 0.15,            // 无脑个体繁殖时“突变出神经网络”的概率（认知起源）
  nnWeightMutateRate: 0.25,        // 每次繁殖每个权重被扰动的概率
  nnWeightMutateAmount: 0.35,      // 单次扰动幅度（±，均匀分布）
  nnWeightLimit: 3,                // 权重绝对值上限（防数值爆炸）
  nnSenseRangeMul: 1,           // 有脑个体感知半径倍率：更早发现食物/威胁（认知优势的物理基础）
  nnSeekBias: 0.75,                // 决策层觅食先验偏置（无学习条件下替代训练，避免随机网络空转）
  nnSeekBiasNearFood: 0.45,        // 食物/植物进入视野时叠加的额外觅食倾向（有粮优先吃，别浪费动作）
  nnLossChance: 0.15,              // 带脑个体繁殖时子代丢失神经网络的概率（“认知起源”的反向流，保证无脑个体不被彻底淘汰、两类谱系长期共存可比）
  nnForageMul: 1,               // 带脑个体的取食效率加成（认知优势落到“吃得更多”这一可见结果）
  nnMarkLerp: 0.22,                // 渲染时带脑个体向标识色混合的比例（一眼可辨“会思考”的谱系）
  nnHudShareDigits: 0,             // HUD 占比小数位（0 = 只显示整数百分比）

  // ---- stage-15 群体与领地（src/core/tribe.js + renderer 群体标识）----
  tribeJoinDist: 12,               // 簇内两个个体并入同一群体的最大间距（世界单位）
  tribeMinMembers: 2,              // 成「群体」所需最少成员数（落单个体不显示领地、不接受指令）
  tribeMatchMul: 2.5,              // 跨 tick 复用群体的中心匹配距离倍率（保能量池与指令）
  tribeRadiusMin: 3.0,             // 领地圈最小半径（刚聚拢时不至于缩成一个点）
  tribeRadiusMax: 14,              // 领地圈半径上限（避免一个群体把全图圈住）
  tribeRadiusMul: 1.6,             // 领地半径 = 成员到中心的最大距离 × 本系数
  tribePoolPerMember: 60,          // 公共能量池容量基数（按成员数伸缩）
  tribePoolMax: 900,               // 公共能量池容量上限
  tribeEmitFrac: 0.7,              // 成员能量高于 maxEnergy × 本比例的部分才上缴公共池
  tribeEmitPerSec: 1.2,            // 每秒上缴「超额能量」的比例（0..1/秒）
  tribeDrawFrac: 0.5,              // 成员能量低于 maxEnergy × 本比例时开始从公共池领取
  tribeDrawPerSec: 2.0,            // 每秒补足「缺口」的比例（0..1/秒）
  tribeRingLift: 0.09,             // 领地圈离地高度（避免与瓦片 z-fighting）
  tribeRingInner: 0.88,            // 领地圈环带内径占比（1 = 细线；运行时按群体半径缩放）
  tribeRingOpacity: 0.3,           // 领地圈基础透明度
  tribeRingOpacitySel: 0.62,       // 被选中群体的领地圈透明度（点击选中即高亮）
  tribeMarkHeight: 7.5,            // 群体悬浮标记高度
  tribeMarkSize: 0.8,              // 群体悬浮标记大小
  tribeMarkOpacity: 0.78,          // 群体悬浮标记透明度
  tribeTargetLift: 0.11,           // 「移动」指令目标点标记离地高度
  tribeTargetScale: 2.4,           // 「移动」指令目标点标记尺寸（世界单位）
  tribeMemberLerp: 0.35,           // 选中群体成员向标识色混合的比例（一眼看出“谁属于这个群体”）
  tribeRenderMax: 10,              // 同时渲染的群体标识上限（按成员数取前 N）
  tribePanelMax: 6,                // 面板最多列出的群体行数（按成员数取前 N，避免面板过长）

  // ---- stage-16 文明最小闭环（src/core/civilization.js）----
  civNodePerKind: 2,               // 每类资源点数量（水/食物/矿物，共 3 类 6 点）
  civNodeSpread: [8, 20],          // 资源点相对部落锚点的落点距离区间（围着部落成环，开局就有单位够得着）
  civNodeSpotTries: 40,            // 每个资源点寻找合法陆地格的最大尝试次数（单个方位角内）
  civNodeAngleTries: 12,           // 方位角落水时的偏转重试轮数（左右交替扫描）
  civNodeAngleStep: 0.52,          // 每次偏转的弧度步长（约 30°）
  civNodeAngleJitter: 0.3,         // 方位角抖动幅度（避免多点共线，保持环状错落）
  civNodeRadius: 12,               // 采集作用半径（群体成员进入该范围即来采集）
  civNodeUnitCap: 3,               // 单点同时采集单位上限（边际递减，避免开局爆速）
  civNodeGatherPerSec: 0.12,       // 每采集单位每秒入库资源量（约 3~4 分钟走完建城闭环）
  civNodeStock: 90,                // 单点总储量（采空即枯竭，需转而开发其它资源点）
  civHarvestResearch: 0.7,         // 每入库 1 资源折算的研究点数
  civNightGatherMul: 0.45,         // 夜间采集衰减下限（未解锁火科技时；火=照明）
  civFireGatherMul: 1.15,          // 火科技（照明/聚居）对采集的加成
  civFireResearchMul: 1.25,        // 火科技（烹饪）对研究产出的加成
  civToolsGatherMul: 1.6,          // 工具科技：采集效率加成
  civResCapMul: 1.5,               // 资源存量上限 = 建城需求 × 本系数（封顶后不再入库）
  civBuildWater: 60,               // 建城所需水资源
  civBuildFood: 60,                // 建城所需食物资源
  civBuildMineral: 60,             // 建城所需矿物资源
  civProgressWeightRes: 0.45,      // 文明进度权重：资源入库
  civProgressWeightTech: 0.3,      // 文明进度权重：科技解锁
  civProgressWeightSettle: 0.25,   // 文明进度权重：聚落规模（历史最多采集单位）
  civCityUnits: 6,                 // 达到「聚落」规模所需的采集单位数（settle 项分母）
  civCityRadius: 12,               // 建城后城邦范围圈半径（世界单位）
  civNodeLift: 0.42,               // 资源点离地高度（浮在地表，避免与瓦片 z-fighting）
  civNodeScale: 1.05,              // 资源点基准尺寸
  civNodeSpentScale: 0.5,          // 采空后的资源点缩放（视觉上“蔫下去”）
  civGatherPulse: 0.22,            // 采集中的节点尺寸脉动幅度
  civNodeRingScale: 0.42,          // 采集作用圈渲染半径（相对 civNodeRadius）
  civNodeRingOpacity: 0.34,        // 采集作用圈透明度
  civCityLift: 0.14,               // 城市地面标识离地高度
  civCityCoreScale: 1.6,           // 城市核心尺寸
  civFireLightHeight: 6,           // 火科技照明灯高度
  civFireLightDay: 0.25,           // 火科技照明在白天的基础强度
  civFireLightNight: 1.5,          // 火科技照明在夜间的额外强度（照明加成肉眼可见）
  civVictoryDelay: 0.6,            // 建城后延迟多少秒弹胜利页（留出场景闪现时间）
civAutoArriveMul: 0.55,          // 自动派遣的「到位」判定：群体中心进入 采集半径×本系数 即视为在作业（不再驱赶）
civAutoStickyMul: 0.5,           // 目标点黏性：已派往的点在选点打分上减 采集半径×本系数（避免两群来回抢点抖动）
civAutoDispatch: true,           // 文明层自动派遣总开关（关掉后必须玩家手动下指令，用于对照验收）
};

// ---- stage-03 基因数据模型 ----
// 基因值统一为 0..1 归一化；此处给出基因->表型的映射区间与变异参数
export const GENOME = {
  speed: [2.6, 8.8],        // speed 基因 -> 巡航速度（快慢差异肉眼明显）
  size: [0.42, 1.5],        // size 基因 -> 体型半径
  perception: [3.2, 18],    // perception 基因 -> 食物感知半径
  metabolism: [0.6, 1.4],   // metabolism 基因 -> 能耗倍率
  colorCount: COLORS.cell.length, // color 基因 -> 从调色板取的档位数
  mutationRate: 0.4,        // 每个基因发生变异的概率
  mutationAmount: 0.25,     // 单次变异幅度（相对 ±）
};
