/**
 * 灵质修行的玩法适配器：WorldState → Activity → Result。
 * 开始时从世界与开局配置建立局内状态；结束时把局内状态翻译成 ActivityResult，交给 commitResult 写进手记。
 * 不自己改资源余额或世界状态。
 */
import type { ActivityResult, ActivitySession, Change, WorldState } from '../../world/types';
import { createLingzhiRun, LINGZHI_CHARACTERS } from './engine';
import type { LingzhiLoadout, LingzhiRun } from './types';

export type LingzhiSession = ActivitySession<LingzhiRun, LingzhiLoadout>;

/** 原 settleRun：通关得 30 残片并折 30 魂灵；散灵（失败）折 5 魂灵；中途离开没有奖励。 */
export const LINGZHI_REWARD = { victory: { shards: 30, soul: 30 }, defeat: { soul: 5 } } as const;

/** 灵质修行占用白天：和重生之门一样只能在清晨开始，不需要同行者，也不会给同行者伤势。 */
export function startLingzhi(world: WorldState, loadout: LingzhiLoadout, seed: number): LingzhiSession {
  if (world.daypart !== 'morning') throw new Error('天色已晚，今天先歇下，明早再进灵质回路。');
  const state = createLingzhiRun(loadout, seed);
  return { id: `lingzhi:${loadout.character}:${seed >>> 0}`, activity: 'lingzhi', startedDay: world.day, loadout: structuredClone(loadout), state };
}

export function lingzhiResult(session: LingzhiSession, early = false): ActivityResult {
  const run = session.state;
  const outcome = early ? 'returned' : run.phase === 'victory' ? 'victory' : run.phase === 'defeat' ? 'defeat' : null;
  if (!outcome) throw new Error('这次修行还没有结束。');
  if (early && run.phase !== 'map') throw new Error('只有在两段路之间才能离开灵质回路。');
  const who = LINGZHI_CHARACTERS[run.character]?.name ?? '修行者';
  const changes: Change[] = [];
  if (outcome === 'victory') {
    for (const [key, amount] of Object.entries(LINGZHI_REWARD.victory)) changes.push({ kind: 'resource', key: key as 'shards' | 'soul', amount });
    changes.push({ kind: 'place', place: 'lingzhi-circuit', state: 'cleared' });
  } else if (outcome === 'defeat') changes.push({ kind: 'resource', key: 'soul', amount: LINGZHI_REWARD.defeat.soul });
  const floor = Math.max(1, run.floor);
  return {
    id: session.id, activity: 'lingzhi', outcome, place: 'lingzhi-circuit', companions: [], changes, time: 'day',
    title: outcome === 'victory' ? '贯通灵质回路' : outcome === 'defeat' ? '灵质回路 · 散灵' : '从灵质回路折返',
    note: outcome === 'victory' ? `以${who}之身击败守门者，回路里的灵质凝成残片带了回来。`
      : outcome === 'defeat' ? `在第 ${floor} 层灵质散去，留下一点魂灵的感悟。` : `走到第 ${floor} 层，先回来了。`,
    encounter: { floors: Math.max(0, run.floor), battlesWon: run.battlesWon, boss: outcome === 'victory' },
  };
}
