/**
 * 灵境会馆 - 模拟子系统：人类聚落关系（relations）
 * 负责：声望衰减 / 自动结盟 / 定期进贡。由 tickReducer 驱动（randomEvents 前）。
 */
import { clamp, round2, pushLog } from '../core/util.js';

export const MODULE = { id: 'relations', name: '人类聚落关系', milestone: 'M3 时代跃迁', enabled: true };

/** 声望衰减周期（tick）与每次衰减量 */
export const REP_DECAY_TICKS = 50;
export const REP_DECAY_AMOUNT = 0.5;
/** 自动结盟声望阈值 */
export const ALLY_REPUTATION = 80;
/** 进贡门槛与周期 */
export const GIFT_REPUTATION = 50;
export const GIFT_INTERVAL_TICKS = 100;
export const GIFT_SPIRIT = 10;
export const GIFT_FOOD = 5;

/** 克隆聚落列表（浅拷贝结构） */
function cloneSettlements(state) {
  const ss = state.relations && state.relations.settlements;
  if (!Array.isArray(ss)) return [];
  return ss.map((s) => ({ ...s }));
}

/** 人类聚落声望提升（外交工作 / 远征成功共用），返回 [聚落数组, 实际提升量] */
export function boostReputation(state, amount) {
  const settlements = cloneSettlements(state);
  if (settlements.length === 0) return [settlements, 0];
  // 提升声望最低的聚落（鼓励扶持弱势聚落）
  let target = settlements[0];
  for (const s of settlements) {
    if (s.reputation < target.reputation) target = s;
  }
  const before = target.reputation;
  target.reputation = round2(clamp(target.reputation + amount, 0, 100));
  return [settlements, round2(target.reputation - before)];
}

export function tick(state) {
  const settlements = cloneSettlements(state);
  let resources = { ...state.resources };
  const logs = [];

  for (const s of settlements) {
    // 1) 声望衰减：每 50 tick 衰减 0.5（不随声望衰减掉出盟友）
    if (state.tick > 0 && state.tick % REP_DECAY_TICKS === 0) {
      s.reputation = round2(clamp(s.reputation - REP_DECAY_AMOUNT, 0, 100));
    }
    // 2) 自动结盟：声望 >= 80
    if (!s.ally && s.reputation >= ALLY_REPUTATION) {
      s.ally = true;
      logs.push(`声望破 80，「${s.name}」与我方缔结盟约`);
    }
    // 3) 进贡：声望 >= 50，每 100 tick 进贡一次
    if (s.reputation >= GIFT_REPUTATION && state.tick - s.lastGiftTick >= GIFT_INTERVAL_TICKS) {
      resources.spirit = round2(resources.spirit + GIFT_SPIRIT);
      resources.food = round2(resources.food + GIFT_FOOD);
      s.lastGiftTick = state.tick;
      logs.push(`「${s.name}」进贡：灵质+${GIFT_SPIRIT} 食物+${GIFT_FOOD}`);
    }
  }

  let eventLog = state.eventLog;
  for (const msg of logs) eventLog = pushLog(eventLog, msg);
  return { ...state, relations: { ...state.relations, settlements }, resources, eventLog };
}
