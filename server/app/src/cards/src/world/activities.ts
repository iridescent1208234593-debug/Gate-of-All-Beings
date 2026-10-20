/**
 * 玩法适配器：每种 Activity 只负责「开始」和「把结束状态翻译成 ActivityResult」。
 * 卡牌出行是其中一种；重生之门、留在会馆也走同一个出口，结果都交给 commitResult 写进众生牌录。
 */
import { HEROES } from '../game/core/content';
import { createRebirthRun, createRun } from '../game/core/engine';
import type { AdventureRun, HeroId, RebirthElement, RunState } from '../game/core/types';
import { canStartExpedition, RULES } from './rules';
import type { ActivityResult, ActivitySession, Change, ExpeditionLoadout, Ledger, RebirthLoadout, WorldState } from './types';

export const heroOf = (characterId: number) => (Object.values(HEROES).find(h => h.characterId === characterId)?.id) as HeroId | undefined;
export const companionIds = () => Object.values(HEROES).map(h => h.characterId);

export function defaultLoadout(world: WorldState, preferred?: number): ExpeditionLoadout {
  const ids = Object.keys(world.companions);
  const pick = (preferred !== undefined && world.companions[preferred]?.condition !== 'fallen' ? String(preferred) : undefined)
    ?? ids.find(id => world.companions[id].condition === 'healthy') ?? ids.find(id => world.companions[id].condition !== 'fallen') ?? ids[0];
  return { companion: pick, deck: world.companions[pick]?.carry ? 'carry' : 'starter', region: 'forest-path', risk: 'calm', items: [], herbs: 0, gear: [] };
}

export type ExpeditionSession = ActivitySession<AdventureRun, ExpeditionLoadout>;
export type RebirthSession = ActivitySession<RunState, RebirthLoadout>;

export function startExpedition(world: WorldState, ledger: Ledger, loadout: ExpeditionLoadout, seed: number, ecoCards: string[] = []): ExpeditionSession {
  const id = Number(loadout.companion), hero = heroOf(id);
  if (!hero) throw new Error('这位同行者还不能出行。');
  const ok = canStartExpedition(world, id);
  if (!ok.ok) throw new Error(ok.reason);
  if (loadout.region !== 'forest-path') throw new Error('这片区域还没有路。');
  const care = world.companions[id];
  const carry = care.condition === 'wounded' && loadout.deck === 'carry' ? care.carry : undefined;
  // 重伤者无论带哪套牌，都只有一半生命。
  const wound = care.condition === 'wounded' ? (carry ?? { deck: [], relics: [] }) : undefined;
  let run = createRun(hero, seed, !!ledger.characters[id]?.sealed, ecoCards, wound && wound.deck.length ? wound : undefined);
  if (wound && !wound.deck.length) run = { ...run, hp: Math.max(1, Math.floor(run.maxHp / 2)), maxHp: Math.max(1, Math.floor(run.maxHp / 2)) };
  return { id: `expedition:${hero}:${seed >>> 0}`, activity: 'expedition', startedDay: world.day, loadout: structuredClone(loadout), state: run };
}

const BATTLE = new Set(['battle', 'elite', 'boss']);

/** Encounter Resolution：把一局的结局统一成奖励、损失、伤势、羁绊、灵卡与地点变化。 */
export function expeditionResult(session: ExpeditionSession, world: WorldState, ledger: Ledger, early = false): ActivityResult {
  const run = session.state, id = Number(session.loadout.companion), hero = HEROES[run.hero];
  const outcome = early ? 'returned' : run.phase === 'victory' ? 'victory' : run.phase === 'defeat' ? 'defeat' : null;
  if (!outcome) throw new Error('这次出行还没有结束。');
  if (early && run.phase !== 'map') throw new Error('只有在两段路之间才能折返。');
  const changes: Change[] = [];
  const known = new Set(world.codex.cards);
  const seen = (card: string, via: Extract<Change, { kind: 'card' }>['via']) => { if (!known.has(card)) { known.add(card); changes.push({ kind: 'card', card, via }); } };
  for (const card of hero.starter) seen(card, 'start');
  for (const { action } of run.log) {
    if (action.type === 'reward' && action.card) seen(action.card, 'reward');
    if (action.type === 'buy') seen(action.card, 'shop');
  }
  const care = world.companions[id];
  let carry: ActivityResult['carry'];
  if (outcome === 'victory') {
    changes.push({ kind: 'resource', key: 'spirit', amount: RULES.victorySpirit }, { kind: 'bond', character: id, amount: RULES.victoryBond }, { kind: 'place', place: 'forest-path', state: 'cleared' });
    if (!world.places['deep-forest'].discovered) changes.push({ kind: 'place', place: 'deep-forest', state: 'discovered' }, { kind: 'world-event', id: 'deep-forest-seen', text: '林间小径的尽头，看见了更深的林子。' });
  } else if (outcome === 'defeat') {
    for (const key of ['spirit', 'herb', 'food'] as const) {
      const lost = Math.floor(ledger.resources[key] * RULES.defeatDrop);
      if (lost) changes.push({ kind: 'resource', key, amount: -lost });
    }
    changes.push({ kind: 'bond', character: id, amount: RULES.defeatBond });
    if (care.condition === 'healthy') { changes.push({ kind: 'wound', character: id }); carry = { [id]: { deck: structuredClone(run.deck), relics: [...run.relics] } }; }
    else changes.push({ kind: 'fall', character: id });
  } else changes.push({ kind: 'bond', character: id, amount: RULES.returnBond });
  const battlesWon = run.visited.filter(n => BATTLE.has(run.nodes.find(x => x.id === n)?.kind ?? '')).length - (outcome === 'defeat' ? 1 : 0);
  const notes = {
    victory: `和${hero.name}穿过了整片林子，回到会馆时天色已晚。`,
    defeat: care.condition === 'healthy' ? `${hero.name}受了重伤，被扶回会馆，路上丢了一些东西。` : `${hero.name}再一次倒下了，需要很久才能恢复。`,
    returned: `走到第 ${run.floor + 1} 段路，${hero.name}决定先回去。`,
  };
  return {
    id: session.id, activity: 'expedition', outcome, place: session.loadout.region, companions: [id], changes, carry, time: 'day',
    title: outcome === 'victory' ? '穿过林间小径' : outcome === 'defeat' ? '林间受挫' : '林间折返',
    note: notes[outcome],
    encounter: { floors: Math.max(0, run.floor + 1), battlesWon: Math.max(0, battlesWon), boss: outcome === 'victory' },
  };
}

/** 留在会馆：占用今天，不冒险，园圃多一点收成。 */
export function stayResult(world: WorldState): ActivityResult {
  return {
    id: `stay:${world.day}`, activity: 'stay', title: '在会馆过一天', outcome: 'completed', place: 'lodge', companions: [], time: 'day',
    changes: [{ kind: 'resource', key: 'herb', amount: 1 }], note: '整理了园圃，晒了草药。',
  };
}

export interface LedgerRecord { id: string; mode: string; resources: Partial<Record<string, number>>; summary: string; at: number }

/** 重生之门是同一个世界里的特殊活动：它在账本里的结算回执被翻译成见闻（资源已结算，只记录不重复入账）。 */
export function rebirthResults(world: WorldState, recent: LedgerRecord[]): ActivityResult[] {
  // 只有结算回执（rebirth-run:）是一段旅途；旧页调试接口写的对局记录等其他条目不进众生牌录。
  const fresh = recent.filter(r => r.mode === 'slay' && r.id.startsWith('rebirth-run:') && !world.imported.includes(r.id)).sort((a, b) => a.at - b.at);
  let daytime = world.daypart === 'morning';
  return fresh.map(r => {
    const time = daytime ? 'day' as const : 'none' as const;
    daytime = false;
    const changes: Change[] = Object.entries(r.resources)
      .filter((e): e is [Extract<Change, { kind: 'resource' }>['key'], number] => ['spirit', 'herb', 'food', 'soul', 'shards'].includes(e[0]) && typeof e[1] === 'number' && e[1] !== 0)
      .map(([key, amount]) => ({ kind: 'resource' as const, key, amount, settled: true }));
    return {
      id: `rebirth:${r.id}`, receipt: r.id, activity: 'rebirth-gate' as const, title: '重生之门', outcome: 'completed' as const,
      place: 'rebirth-gate' as const, companions: [], changes, time, note: r.summary || '从重生之门回来了。',
    };
  });
}

/** 重生之门的结算（与 Codex 共同进度的规则一致）：走通带回 20 灵质 + 2 草药，散灵带回 5 灵质。 */
export const REBIRTH_REWARD = { victory: { spirit: 20, herb: 2 }, defeat: { spirit: 5 } } as const;

/** 今日灵机按众生牌录的游戏日轮换（原实现按现实日期；统一到游戏日，不混入现实时间）。 */
export const rebirthDailyKey = (world: WorldState) => `游戏日-${world.day}`;

/** 重生之门是同一个世界里的特殊活动：不需要同行者（全员陨落时也能去），修行者是玩家自己，不会给官方角色施加伤势。 */
export function startRebirth(world: WorldState, loadout: RebirthLoadout, seed: number): RebirthSession {
  if (world.daypart !== 'morning') throw new Error('天色已晚，今天先歇下，明早再去重生之门。');
  const state = createRebirthRun({ element: loadout.element as RebirthElement, branch: loadout.branch, guild: loadout.guild, difficulty: loadout.difficulty, dailyKey: rebirthDailyKey(world) }, seed);
  return { id: `rebirth:${loadout.element}:${seed >>> 0}`, activity: 'rebirth-gate', startedDay: world.day, loadout: structuredClone(loadout), state };
}

export function rebirthResult(session: RebirthSession, world: WorldState, early = false): ActivityResult {
  const run = session.state;
  const outcome = early ? 'returned' : run.phase === 'victory' ? 'victory' : run.phase === 'defeat' ? 'defeat' : null;
  if (!outcome) throw new Error('这一世的修行还没有结束。');
  if (early && run.phase !== 'map') throw new Error('只有在两段路之间才能离开重生之门。');
  const changes: Change[] = [];
  const known = new Set(world.codex.cards);
  const seen = (card: string, via: Extract<Change, { kind: 'card' }>['via']) => { if (!known.has(card)) { known.add(card); changes.push({ kind: 'card', card, via }); } };
  for (const c of run.deck) seen(c.card, 'start');
  for (const { action } of run.log) {
    if (action.type === 'reward' && action.card) seen(action.card, 'reward');
    if (action.type === 'buy') seen(action.card, 'shop');
  }
  if (outcome === 'victory') {
    for (const [key, amount] of Object.entries(REBIRTH_REWARD.victory)) changes.push({ kind: 'resource', key: key as 'spirit', amount });
    changes.push({ kind: 'place', place: 'rebirth-gate', state: 'cleared' });
  } else if (outcome === 'defeat') changes.push({ kind: 'resource', key: 'spirit', amount: REBIRTH_REWARD.defeat.spirit });
  const battlesWon = run.visited.filter(n => BATTLE.has(run.nodes.find(x => x.id === n)?.kind ?? '')).length - (outcome === 'defeat' ? 1 : 0);
  return {
    id: session.id, activity: 'rebirth-gate', outcome, place: 'rebirth-gate', companions: [], changes, time: 'day',
    title: outcome === 'victory' ? '推开重生之门' : outcome === 'defeat' ? '重生之门 · 散灵' : '从重生之门折返',
    note: outcome === 'victory' ? `本命${session.loadout.element}行的修行者走到了最后一层，门后是新的一世。` : outcome === 'defeat' ? `在第 ${run.floor + 1} 层魂灵散去，带回了一点灵质。` : `走到第 ${run.floor + 1} 层，先回来了。`,
    encounter: { floors: Math.max(0, run.floor + 1), battlesWon: Math.max(0, battlesWon), boss: outcome === 'victory' },
  };
}
