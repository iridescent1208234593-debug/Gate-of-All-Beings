/**
 * 灵境会馆 - 模拟子系统：远征（expedition）
 * 简化三阶段 tick 驱动：行路(60) → 目标事件(30) → 归途(60)，成功/失败结算。
 * 由 tickReducer 驱动（randomEvents 前）；开团通过 EXPEDITION_START / EXPEDITION_RETURN。
 */
import { round2, pushLog } from '../core/util.js';
import { boostReputation } from './relations.js';
import { EXPEDITION_TARGETS, getExpeditionTarget } from '../content/expeditionTargets.js';

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

/** 传送枢纽是否已建成（M7：建造中不可开团） */
export function hasHub(state) {
  return state.buildings.some(
    (b) => b.buildingId === 'chuansongshuniu' && (b.construction == null || b.construction >= (b.buildTime ?? 0))
  );
}

/** 是否有进行中的远征 */
export function hasActiveParty(state) {
  return Array.isArray(state.expedition.parties) && state.expedition.parties.length > 0;
}

/** 当前阶段总时长（tick） */
export function phaseDuration(party) {
  if (!party) return 0;
  return party.phase === 'travel' ? PHASE_TRAVEL : party.phase === 'event' ? PHASE_EVENT : PHASE_RETURN;
}

/** 当前阶段进度 0~1（供 UI 进度条 / 日报） */
export function partyProgress(party) {
  const dur = phaseDuration(party);
  return dur > 0 ? Math.min(1, party.phaseTicks / dur) : 0;
}

/** 可用于派发远征的空闲小妖（idle 且无 job，且不在进行中远征队） */
export function idleColonists(state) {
  const activeIds = new Set((state.expedition?.parties || []).flatMap((p) => p.colonistIds || []));
  return state.colonists.filter((c) => c.state === 'idle' && !c.job && !activeIds.has(c.id));
}

/** 开团：校验传送枢纽 / 人数 2~5 / 无进行中远征 / 小妖存在，通过则从 colonists 移除入队 */
export function start(state, payload = {}) {
  const colonistIds = Array.isArray(payload.colonistIds) ? payload.colonistIds : [];
  const target =
    typeof payload.target === 'string' && payload.target
      ? payload.target
      : EXPEDITION_TARGETS.length > 0
        ? EXPEDITION_TARGETS[Math.floor(Math.random() * EXPEDITION_TARGETS.length)].name
        : '未知秘境';

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
  // 保存队员快照（原对象引用），便于归队恢复
  const members = colonistIds.map((id) => state.colonists.find((c) => c.id === id));
  const targetRec = getExpeditionTarget(target);
  const party = {
    id: `exp${state.tick}`,
    colonistIds: [...colonistIds],
    colonists: members,
    target,
    targetDesc: targetRec ? targetRec.desc : '',
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

/** 结算并归队：返回 [colonists, resources, relations, eventLog] */
function settle(state, party, forceSuccess) {
  const success = forceSuccess ? true : Math.random() < SUCCESS_RATE;
  let colonists = state.colonists;
  let resources = { ...state.resources };
  let relations = state.relations;
  let eventLog = state.eventLog;

  if (success) {
    resources.spirit = round2(resources.spirit + SUCCESS_SPIRIT);
    const [settlements, gained] = boostReputation(state, SUCCESS_REPUTATION);
    relations = { ...relations, settlements };
    eventLog = pushLog(eventLog, `远征队凯旋「${party.target}」：灵质+${SUCCESS_SPIRIT}，声望+${gained}`);
    // 队员归队：用出发时快照恢复（重置为 idle 无工作）
    for (const oc of party.colonists || []) {
      colonists = [...colonists, { ...oc, job: null, state: 'idle' }];
    }
  } else {
    // 防御性处理仍在 colonists 中的队员扣血（出发时已移除，通常不会命中）
    colonists = colonists.map((c) => {
      if (!party.colonistIds.includes(c.id)) return c;
      return { ...c, hp: Math.max(1, c.hp - FAIL_HP_LOSS), job: null, state: 'idle' };
    });
    // 归队并按失败结算扣血（以出发时快照为准）
    for (const oc of party.colonists || []) {
      colonists = [...colonists, { ...oc, hp: Math.max(1, oc.hp - FAIL_HP_LOSS), job: null, state: 'idle' }];
    }
    const [settlements, lost] = boostReputation(state, -FAIL_REPUTATION);
    relations = { ...relations, settlements };
    eventLog = pushLog(eventLog, `远征队受挫「${party.target}」：小妖受伤（hp-${FAIL_HP_LOSS}），声望${lost}`);
  }
  return [colonists, resources, relations, eventLog];
}

/** 强制返程（EXPEDITION_RETURN / 调试用）：立即结算指定远征队（默认按成功率判定） */
export function settleParty(state, party, forceSuccess = false) {
  const [colonists, resources, relations, eventLog] = settle(state, party, forceSuccess);
  const parties = state.expedition.parties.filter((p) => p.id !== party.id);
  return { ...state, colonists, resources, relations, expedition: { ...state.expedition, parties }, eventLog };
}

/** tick：三阶段推进（travel → event → return → 结算） */
export function tick(state) {
  if (!hasActiveParty(state)) return state;

  let colonists = state.colonists;
  let resources = { ...state.resources };
  let relations = state.relations;
  let eventLog = state.eventLog;
  let parties = [];
  let settled = false;

  for (const p of state.expedition.parties) {
    let party = { ...p, phaseTicks: p.phaseTicks + 1 };
    const duration = phaseDuration(party);
    if (party.phaseTicks < duration) {
      parties.push(party);
      continue;
    }
    if (party.phase === 'travel') {
      party = { ...party, phase: 'event', phaseTicks: 0 };
      eventLog = pushLog(eventLog, `远征队抵达目标「${party.target}」，遭遇目标事件`);
      parties.push(party);
    } else if (party.phase === 'event') {
      party = { ...party, phase: 'return', phaseTicks: 0 };
      eventLog = pushLog(eventLog, `远征队「${party.target}」踏上归途`);
      parties.push(party);
    } else {
      const [nc, nr, nrel, nlog] = settle({ ...state, colonists, resources, relations, eventLog }, party, false);
      colonists = nc;
      resources = nr;
      relations = nrel;
      eventLog = nlog;
      settled = true;
    }
  }

  if (!settled) {
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
