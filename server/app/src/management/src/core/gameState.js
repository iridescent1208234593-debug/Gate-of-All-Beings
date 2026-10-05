/**
 * 灵境会馆 - GameState 工厂
 * 创建游戏初始状态（纯数据，不含逻辑）。
 */
import { COLONIST_TEMPLATES } from '../content/colonists.js';
import { getElement } from '../content/elements.js';
import { createNeeds } from '../content/needs.js';
import { getBuilding } from '../content/buildings.js';
import { randomTraits } from '../content/traits.js';
import { makeTile } from '../systems/spiritSpace.js';

/** 灵质空间网格尺寸 */
export const GRID = { width: 24, height: 16 };

/** 固定 tick 间隔：250ms = 4 tick/秒 */
export const TICK_MS = 250;

/** 1 tick 对应游戏时间（游戏秒） */
export const TICK_GAME_SECONDS = 30;

/** 1 游戏日 = 480 游戏分钟 */
export const MINUTES_PER_DAY = 480;

export function createInitialState() {
  // 网格（带随机资源点：树木/草药/石头/矿脉）
  const tiles = [];
  for (let y = 0; y < GRID.height; y++) {
    for (let x = 0; x < GRID.width; x++) {
      tiles.push(makeTile(x, y));
    }
  }

  const state = {
    version: '0.2.0',
    tick: 0,
    time: { day: 0, minute: 0 },
    speed: 2,
    paused: false,
    era: 'tribal',
    // R1：新增采集材料库存（灵木/草药/石料/矿料，稳定来源=地图资源点 gather 采集）
    // 初始给少量灵木/草药，便于开局体验首个配方；石料/矿料依赖后续建造+采集
    resources: { spirit: 200, food: 40, faqi: 0, wood: 2, herb: 2, stone: 0, ore: 0 },
    // R1：配方合成队列（FIFO，队首由 jobAI 派活给空闲小妖）
    crafting: { queue: [] },
    space: {
      width: GRID.width,
      height: GRID.height,
      tiles,
      spiritDensity: 1.0,
    },
    // 游戏设置：难度与随机事件频率（M5）
    settings: {
      difficulty: 'normal', // easy | normal | hard
      eventFrequency: 'normal', // low | normal | high
    },
    buildings: [],
    colonists: [],
    // 随机事件驻留列表（含剩余 duration），attack 型事件即时入战不驻留
    events: [],
    // 后续里程碑骨架状态
    tech: { unlocked: [], researching: null, progress: 0 },
    combat: { threats: [], battles: [], active: false, battleTicks: 0, cooldown: 0 },
    // 人类聚落关系：初始 1 个聚落「兴国边村」
    relations: {
      settlements: [
        { id: 'xingguo-village', name: '兴国边村', reputation: 30, ally: false, lastGiftTick: 0 },
      ],
    },
    expedition: { parties: [], log: [] },
    eventLog: [],
    nextIds: { building: 1, colonist: 1 },
    stats: {
      totalWorkDone: 0,
      totalSpiritProduced: 0,
      totalFoodProduced: 0,
      mealsEaten: 0,
      eventCount: 0,
      battlesWon: 0,
      battlesLost: 0,
      enemiesSlain: 0,
      // M8 按元素战利品累计
      loot: { spirit: 0, food: 0, faqi: 0 },
    },
  };

  // 初始建筑：灵质祭坛（10,7） + 窝棚（4,7），免费摆放
  placeInitialBuilding(state, 'altar', 10, 7);
  placeInitialBuilding(state, 'hut', 4, 7);

  // 初始小妖：五行模板各一只，围绕祭坛
  COLONIST_TEMPLATES.forEach((tpl, i) => {
    const el = getElement(tpl.element);
    const colonist = {
      id: `c${state.nextIds.colonist++}`,
      name: tpl.name,
      element: tpl.element,
      x: 8 + i,
      y: 10,
      needs: createNeeds(88),
      moodScore: 88,
      mood: 'green',
      state: 'idle',
      mentalState: 'normal',
      job: null,
      eatTimer: 0,
      workCount: 0,
      hp: tpl.hp ?? 100,
      maxHp: tpl.maxHp ?? 100,
      color: el.color,
      // M9 修为与性格特质
      cultivation: { level: 1, xp: 0 },
      traits: randomTraits(),
    };
    state.colonists.push(colonist);
  });

  return state;
}

function placeInitialBuilding(state, buildingId, gx, gy) {
  const def = getBuilding(buildingId);
  const inst = {
    id: `b${state.nextIds.building++}`,
    buildingId: def.id,
    x: gx,
    y: gy,
    w: def.size.w,
    h: def.size.h,
    hp: 100,
    workers: [],
    builtAt: 0,
    construction: def.buildTime ?? 0, // M7：初始建筑直接视为建成（construction>=buildTime）
    buildTime: def.buildTime ?? 0,
  };
  for (let y = gy; y < gy + def.size.h; y++) {
    for (let x = gx; x < gx + def.size.w; x++) {
      const idx = y * GRID.width + x;
      state.space.tiles[idx] = { ...state.space.tiles[idx], buildingId: inst.id };
    }
  }
  state.buildings.push(inst);
}
