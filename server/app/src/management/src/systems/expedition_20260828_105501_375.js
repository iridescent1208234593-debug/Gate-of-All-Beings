/**
 * 灵境会馆 - 模拟子系统：远征（expedition）
 * 简化三阶段 tick 驱动：行路(60) → 目标事件(30) → 归途(60)，成功/失败结算。
 * 由 tickReducer 驱动（randomEvents 前）；开团/返程通过 EXPEDITION_START / EXPEDITION_RETURN。
 */
import { round2, pushLog } from '../core/util.js';
import { boostReputation } from './relations.js';

export const MODULE = { id: 'expedition', name: '远征', milestone: 'M3 时代跃迁', enabled: true };

export const PHASE_TRAVEL = 60;
export const PHASE_EVENT = 30;
export const PHASE_RETURN = 60;
export const SUCCESS_RATE = 0.7;
export const SUCCESS_SPIRIT = 50;
export const SUCCESS_REPUTATION = 10;
export const FAIL_HP_LOSS = 30;
export const FAIL_REPUTATION = 5;
export const MIN_PARTY = 2;
export const MAX_PARTY = 5;

/** 传送枢纽是否已建成 */
export function hasHub(state) {
  return state.buildings.some((b) => b.buildingId === 'chuansongshuniu');
}

/** 是否有进行中的远征 */
export function hasActiveParty(state) {
  return Array.isArray(state.expedition.parties) && state.expedition.parties.length > 0;
}

/** 开团：校验传送枢纽 / 人数 2~5 / 无进行中远征 / 小妖存在，通过则从 colonists 移除入队 */
export function start(state, payload = {}) {
  const colonistIds = Array.isArray(payload.colonistIds) ? payload.colonistIds : [];
  const target = typeof payload.target === 'string' && payload.target ? payload.target : '未知秘境';

  if (!hasHub(state)) {
    return { ...state, eventLog: pushLog(state.eventLog, '尚未建造传送枢纽，无法开启远征') };
  }
  if (hasActiveParty(state)) {
    return { ...state, eventLog: pushLog(state.eventLog, '已有远征队在外，无法再次开启') };
  }
  if (colonistIds.length < MIN_PARTY || colonistIds.length > MAX_PARTY) {
    return { ...state, eventLog: pushLog(state.eventLog, `远征队需 ${MIN_PARTY}~${MAX_PARTY} 名小妖`) };
  }
  const idSet = new Set(state.colonists.map((c) => c.id));
  if (!colonistIds.every((id) => idSet.has(id))) {
    return { ...state, eventLog: pushLog(state.eventLog, '远征队员不存在') };
  }

  const removed = new Set(colonistIds);
  const colonists = state.colonists.filter((c) => !removed.has(c.id));
  const party = {
    id: `exp${state.tick}`,
    colonistIds: [...colonistIds],
    target,
    phase: 'travel',
    phaseTicks: 0,
  };
  return {
    ...state,
    colonists,
    expedition: { ...state.expedition, parties: [...state.expedition.parties, party] },
    eventLog: pushLog(state.eventLog, `远征队（${colonistIds.length} 妖）出发前往「${target}」`),
  };
}

/** 强制返程（EXPEDITION_RETURN / 结算共用）：把进行中的远征队立即带回并结算 */
export function settleParty(state, party, forceSuccess = false) {
  const success = forceSuccess ? true : Math.random() < SUCCESS_RATE;
  const removed = new Set(party.colonistIds);
  const colonists = state.colonists.map((c) => {
    if (!removed.has(c.id)) return c;
    return { ...c, job: null, state: 'idle' };
  });
  let resources = { ...state.resources };
  let relations = state.relations;
  let eventLog = state.eventLog;

  if (success) {
    resources.spirit = round2(resources.spirit + SUCCESS_SPIRIT);
    const [settlements, gained] = boostReputation(state, SUCCESS_REPUTATION);
    relations = { ...relations, settlements };
    eventLog = pushLog(eventLog, `远征队凯旋「${party.target}」：灵质+${SUCCESS_SPIRIT}，声望+${gained}`);
  } else {
    resources.spirit = round2(resources.spirit);
    let hpLost = false;
    for (let i = 0; i < colonists.length; i++) {
      const c = colonists[i];
      if (removed.has(c.id) && c.hp > FAIL_HP_LOSS) {
        colonists[i] = { ...c, hp: Math.max(1, c.hp - FAIL_HP_LOSS) };
        hpLost = true;
      }
    }
    const [settlements, lost] = boostReputation(state, -FAIL_REPUTATION);
    relations = { ...relations, settlements };
    eventLog = pushLog(eventLog, `远征队受挫「${party.target}」：小妖受伤（hp-${FAIL_HP_LOSS}），声望${lost >= 0 ? '' : ''}${lost}`);
  }

  const parties = state.expedition.parties.filter((p) => p.id !== party.id);
  return { ...state, colonists, resources, relations, expedition: { ...state.expedition, parties } };
}

/** tick：三阶段推进（travel → event → return → 结算） */
export function tick(state) {
  if (!hasActiveParty(state)) return state;

  let colonists = state.colonists;
  let resources = { ...state.resources };
  let relations = state.relations;
  let eventLog = state.eventLog;
  let parties = [];
  let changed = false;

  for (const p of state.expedition.parties) {
    let party = { ...p, phaseTicks: p.phaseTicks + 1 };
    const duration = party.phase === 'travel' ? PHASE_TRAVEL : party.phase === 'event' ? PHASE_EVENT : PHASE_RETURN;
    if (party.phaseTicks < duration) {
      parties.push(party);
      continue;
    }
    changed = true;
    if (party.phase === 'travel') {
      party = { ...party, phase: 'event', phaseTicks: 0 };
      eventLog = pushLog(eventLog, `远征队抵达目标「${party.target}」，遭遇目标事件`);
      parties.push(party);
    } else if (party.phase === 'event') {
      party = { ...party, phase: 'return', phaseTicks: 0 };
      eventLog = pushLog(eventLog, `远征队「${party.target}」踏上归途`);
      parties.push(party);
    } else {
      // return 完成 → 结算
      const success = Math.random() < SUCCESS_RATE;
      if (success) {
        resources.spirit = round2(resources.spirit + SUCCESS_SPIRIT);
        const [settlements, gained] = boostReputation({ ...state, relations }, SUCCESS_REPUTATION);
        relations = { ...relations, settlements };
        eventLog = pushLog(eventLog, `远征队凯旋「${party.target}」：灵质+${SUCCESS_SPIRIT}，声望+${gained}`);
      } else {
        const removed = new Set(party.colonistIds);
        colonists = colonists.map((c) => {
          if (!removed.has(c.id)) return c;
          return { ...c, hp: Math.max(1, c.hp - FAIL_HP_LOSS), job: null, state: 'idle' };
        });
        const [settlements, lost] = boostReputation({ ...state, relations }, -FAIL_REPUTATION);
        relations = { ...relations, settlements };
        eventLog = pushLog(eventLog, `远征队受挫「${party.target}」：小妖受伤（hp-${FAIL_HP_LOSS}），声望${lost}`);
      }
      // 队员归队：把远征中的小妖放回 colonists
      const back = party.colonistIds.filter((id) => !colonists.some((c) => c.id === id));
      for (const id of back) {
        colonists.push({ ...state.colonists.find((c) => c.id === id), job: null, state: 'idle' });
      }
    }
  }

  if (!changed) {
    return { ...state, expedition: { ...state.expedition, parties } };
  }
  return {
    ...state,
    colonists,
    resources,
    relations,
    expedition: { ...state.expedition, parties },
    eventLog,
  };
}
