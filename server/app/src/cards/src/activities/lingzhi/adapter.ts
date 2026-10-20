/**
 * 灵质修行的玩法适配器：WorldState → Activity → Result。
 * 开始时从世界与开局配置建立局内状态；结束时把局内状态翻译成 ActivityResult，交给 commitResult 写进众生牌录。
 * 不自己改资源余额或世界状态。
 */
import type { ActivityResult, ActivitySession, Change, WorldState } from '../../world/types';
import { createLingzhiRun, LINGZHI_CHARACTERS } from './engine';
import type { LingzhiLoadout, LingzhiRun } from './types';

export type LingzhiSession = ActivitySession<LingzhiRun, LingzhiLoadout>;

/** 通关带回 30 灵质；散灵（失败）带回 5 灵质；中途离开没有奖励。原 settleRun 的残片 / 魂灵改为众生牌录共用的灵质。 */
export const LINGZHI_REWARD = { victory: { spirit: 30 }, defeat: { spirit: 5 } } as const;

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
    changes.push({ kind: 'resource', key: 'spirit', amount: LINGZHI_REWARD.victory.spirit });
    changes.push({ kind: 'place', place: 'lingzhi-circuit', state: 'cleared' });
  } else if (outcome === 'defeat') changes.push({ kind: 'resource', key: 'spirit', amount: LINGZHI_REWARD.defeat.spirit });
  const floor = Math.max(1, run.floor);
  return {
    id: session.id, activity: 'lingzhi', outcome, place: 'lingzhi-circuit', companions: [], changes, time: 'day',
    title: outcome === 'victory' ? '贯通灵质回路' : outcome === 'defeat' ? '灵质回路 · 散灵' : '从灵质回路折返',
    note: outcome === 'victory' ? `以${who}之身击败守门者，把回路里凝起的灵质带了回来。`
      : outcome === 'defeat' ? `在第 ${floor} 层灵质散去，只带回一点灵质。` : `走到第 ${floor} 层，先回来了。`,
    encounter: { floors: Math.max(0, run.floor), battlesWon: run.battlesWon, boss: outcome === 'victory' },
  };
}
