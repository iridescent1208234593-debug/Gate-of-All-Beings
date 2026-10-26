import {storageCapacity} from '../systems/storageCapacity.js';
import { importEcology } from '../systems/ecology.js';
/**
 * 灵境会馆 - 单向数据流核心：reducer
 * Action → reducer → GameState（纯函数，每次返回新 state）
 */
import { ActionTypes } from './actionTypes.js';
import { TICK_GAME_SECONDS, MINUTES_PER_DAY } from './gameState.js';
import { clamp, round2, pushLog } from './util.js';
import * as spiritSpace from '../systems/spiritSpace.js';
import * as building from '../systems/building.js';
import * as farming from '../systems/farming.js';
import * as jobAI from '../systems/jobAI.js';
import * as colonist from '../systems/colonist.js';
import * as crafting from '../systems/crafting.js';
import * as randomEvents from '../systems/randomEvents.js';
import * as combat from '../systems/combat.js';
import * as tech from '../systems/tech.js';
import * as relations from '../systems/relations.js';
import * as expedition from '../systems/expedition.js';
import * as dailyReport from '../systems/dailyReport.js';
import { getBuilding } from '../content/buildings.js';
import { canAdvance, nextEra, getEra } from '../content/eras.js';

export function reducer(state, action) {
  if(action.type==='IMPORT_ECOLOGY') return importEcology(state,action.packet);
  switch (action.type) {
    case ActionTypes.TICK:
      return tickReducer(state);

    case ActionTypes.SET_SPEED: {
      const rate = clamp(action.payload.rate | 0, 1, 3);
      return { ...state, speed: rate };
    }

    case ActionTypes.TOGGLE_PAUSE:
      return { ...state, paused: !state.paused };

    case ActionTypes.BUILD_PLACE:
      return applyStorageCap(building.place(state, action.payload));

    case ActionTypes.BUILD_MOVE:
      return building.move(state, action.payload);

    case ActionTypes.BUILD_DEMOLISH:
      return building.cancel(state, action.payload);

    case ActionTypes.SPACE_EXPAND:
      return spiritSpace.expand(state, action.payload.dir || 'east');

    case ActionTypes.SET_SETTINGS:
      return {
        ...state,
        settings: { ...state.settings, ...(action.payload || {}) },
        eventLog: pushLog(state.eventLog, '已更新会馆设置'),
      };

    case ActionTypes.ADD_COLONIST:
      return colonist.add(state, action.payload || {});

    case ActionTypes.ADD_RESOURCE:
      return applyStorageCap(addResource(state, action.payload || {}));

    case ActionTypes.DEBUG_FILL_NEEDS:
      return colonist.fillNeeds(state, action.payload || {});

    case ActionTypes.TRIGGER_EVENT:
      return randomEvents.trigger(state, action.payload || {});

    case ActionTypes.RESEARCH_START:
      return tech.start(state, action.payload || {});

    case ActionTypes.CANCEL_RESEARCH:
      return tech.cancel(state);

    case ActionTypes.ERA_ADVANCE: {
      if (!canAdvance(state)) {
        return { ...state, eventLog: pushLog(state.eventLog, '时代跃迁条件未满足') };
      }
      const next = nextEra(state);
      const eraDef = getEra(next);
      return {
        ...state,
        era: next,
        eventLog: pushLog(state.eventLog, `✨ 时代跃迁：进入「${eraDef.name}」！${eraDef.desc}`),
      };
    }

    case ActionTypes.EXPEDITION_START:
      return expedition.start(state, action.payload || {});

    case ActionTypes.EXPEDITION_RETURN: {
      // 调试/测试用：立即结算进行中的远征队
      const party = state.expedition.parties[0];
      if (!party) return state;
      return expedition.settleParty(state, party, true);
    }

    // ---- R1 配方合成：入队 / 取消排队 ----
    case ActionTypes.CRAFT_ENQUEUE:
      return crafting.enqueue(state, action.payload && action.payload.recipeId);

    case ActionTypes.CRAFT_CANCEL:
      return crafting.cancel(state, action.payload && action.payload.recipeId);

    default:
      return state;
  }
}

/** TICK：推进一个模拟 tick，依次驱动各子系统 */
function tickReducer(state) {
  let s = { ...state, tick: state.tick + 1 };

  // 游戏时钟
  const totalSec = s.tick * TICK_GAME_SECONDS;
  const minute = totalSec % MINUTES_PER_DAY;
  const day = Math.floor(totalSec / MINUTES_PER_DAY);
  s.time = { day, minute };

  // 子系统依次 tick（顺序即依赖顺序）
  s = building.tick(s);
  s = spiritSpace.tick(s);
  s = farming.tick(s);
  s = jobAI.tick(s);
  // R1 合成：jobAI 派活之后、colonist 结算之前（先派活后结算/自动医疗）
  s = crafting.tick(s);
  s = colonist.tick(s);
  // 研究进度（需要 jobAI 派活后、资源结算后推进）
  s = tech.tick(s);
  // 人类聚落关系 + 远征（在 randomEvents 前，避免事件与远征互相干扰）
  s = relations.tick(s);
  s = expedition.tick(s);
  // 信息中枢日报（有中枢时每 100 tick 汇总要闻，反映本 tick 状态）
  s = dailyReport.tick(s);
  // 随机事件（可能调起 combat.trigger 生成敌人）→ 战斗结算
  s = randomEvents.tick(s);
  s = combat.tick(s);

  // 资源存储上限（灵仓扩容）
  s = applyStorageCap(s);

  // 给日志补 tick 标记（兼容 pushLog 生成的 [t] 前缀，统一补真实 tick 号）
  if (s.eventLog.length > 0) {
    s.eventLog = s.eventLog.map((e) => (e.startsWith('[t] ') ? `[t${s.tick}] ${e.slice(4)}` : e));
  }
  return s;
}

function addResource(state, payload) {
  const resources = { ...state.resources };
  if (payload.spirit) resources.spirit = round2(Math.max(0, resources.spirit + payload.spirit));
  if (payload.food) resources.food = round2(Math.max(0, resources.food + payload.food));
  return { ...state, resources };
}

/** 资源存储上限：基础上限 + 每座已建成灵仓扩容；超限截断并写日志（每 tick 至多一次提示） */
export function applyStorageCap(state) {
  const cap = storageCapacity(state);
  const resources = { ...state.resources };
  let capped = false;
  for (const k of Object.keys(cap)) {
    const cur = resources[k] ?? 0;
    if (cur > cap[k]) {
      resources[k] = round2(cap[k]);
      capped = true;
    }
  }
  if (capped && state.tick % 10 === 0) {
    return { ...state, resources, eventLog: pushLog(state.eventLog, '仓库已满，部分资源溢散') };
  }
  return { ...state, resources };
}

export { pushLog };
