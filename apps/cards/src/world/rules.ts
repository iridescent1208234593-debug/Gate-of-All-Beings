/**
 * 世界规则：所有时间都用游戏日推进，不读现实时钟。
 * World State → Activity → Result → Journal Commit → World State 中的「提交」一步在这里完成，全部是纯函数。
 */
import { RESOURCE_KEYS_LIST } from './resources';
import type {
  ActivityResult, Assignment, Change, CharacterId, CompanionCare, Condition, Journal, JournalEntry,
  Ledger, PlaceId, PlaceState, ResourceKey, WorldSnapshot, WorldState,
} from './types';

/** 数值都是可调的设计常量。 */
export const RULES = {
  victorySpirit: 20, victoryBond: 6,
  defeatDrop: 0.25, defeatBond: 2, returnBond: 1,
  /** 重伤者被安排「休养」满这么多夜，并消耗草药，即痊愈。 */
  healNights: 2, healHerbs: 2,
  /** 全员陨落后，经过这么多夜一起恢复。 */
  reviveNights: 2,
  nightSpirit: 2, gardenHerbs: 2, gardenBond: 1, practiceBond: 3, restSpirit: 4,
  sealBond: 9, sealSpirit: 12,
  journalLimit: 200,
} as const;

const PLACES: PlaceId[] = ['lodge', 'forest-path', 'deep-forest', 'rebirth-gate', 'lingzhi-circuit'];
const place = (discovered: boolean): PlaceState => ({ discovered, visits: 0, cleared: 0 });

export function conditionOf(deaths = 0): Condition { return deaths >= 2 ? 'fallen' : deaths === 1 ? 'wounded' : 'healthy'; }
export function deathsOf(condition: Condition) { return condition === 'fallen' ? 2 : condition === 'wounded' ? 1 : 0; }

/** 首次进入众生牌录时，从共享账本（伤亡计数）和同行者名单建立世界。 */
export function createWorld(companions: { id: CharacterId; assignment?: Assignment }[], ledger: Ledger): WorldState {
  return {
    version: 1, day: 1, daypart: 'morning',
    companions: Object.fromEntries(companions.map(c => [String(c.id), {
      assignment: c.assignment ?? 'garden', condition: conditionOf(ledger.characters[c.id]?.deaths), nights: 0,
    } satisfies CompanionCare])),
    places: Object.fromEntries(PLACES.map(p => [p, place(p !== 'deep-forest')])) as Record<PlaceId, PlaceState>,
    codex: { cards: [], characters: companions.map(c => c.id) },
    imported: [],
  };
}

export function emptySnapshot(world: WorldState): WorldSnapshot {
  return { version: 1, world, journal: { entries: [], seenThrough: null }, activity: null };
}

export const allFallen = (w: WorldState) => Object.values(w.companions).every(c => c.condition === 'fallen');

export type Availability = { ok: true; reason?: undefined } | { ok: false; reason: string };
export function canStartExpedition(w: WorldState, companion?: CharacterId): Availability {
  if (w.daypart !== 'morning') return { ok: false, reason: '天色已晚，今天先歇下，明早再出行。' };
  if (allFallen(w)) return { ok: false, reason: '同行者都已倒下，需要静养几夜。这段时间可以去重生之门走走。' };
  if (companion !== undefined && w.companions[companion]?.condition === 'fallen') return { ok: false, reason: '这位同行者已经陨落，暂时不能同行。' };
  return { ok: true };
}

/** 把一组变化落到世界与账本增量上；不修改入参。 */
export function applyChanges(world: WorldState, ledger: Ledger, changes: Change[]) {
  const w = structuredClone(world);
  const resources: Partial<Record<ResourceKey, number>> = {};
  const roster: Ledger['characters'] = {};
  const touch = (id: CharacterId) => (roster[id] ??= {});
  const bondOf = (id: CharacterId) => roster[id]?.bond ?? ledger.characters[id]?.bond ?? 0;
  for (const c of changes) {
    switch (c.kind) {
      case 'resource': if (!c.settled) resources[c.key] = (resources[c.key] ?? 0) + c.amount; break;
      case 'bond': touch(c.character).bond = Math.max(0, bondOf(c.character) + c.amount); break;
      case 'wound': case 'fall': case 'recover': {
        const care = w.companions[c.character];
        if (!care) throw new Error('众生牌录里没有这位同行者：' + c.character);
        care.condition = c.kind === 'wound' ? 'wounded' : c.kind === 'fall' ? 'fallen' : 'healthy';
        care.nights = 0;
        if (c.kind === 'recover') delete care.carry;
        touch(c.character).deaths = deathsOf(care.condition);
        break;
      }
      case 'seal': touch(c.character).sealed = true; break;
      case 'card': if (!w.codex.cards.includes(c.card)) w.codex.cards.push(c.card); break;
      case 'meet':
        if (!w.codex.characters.includes(c.character)) w.codex.characters.push(c.character);
        touch(c.character).discovered = true; break;
      case 'place': {
        const p = w.places[c.place];
        p.discovered = true;
        if (c.state === 'cleared') p.cleared++;
        break;
      }
      case 'world-event': break;
    }
  }
  for (const key of Object.keys(resources) as ResourceKey[]) {
    if (ledger.resources[key] + (resources[key] ?? 0) < 0) throw new Error('资源不足：' + key);
  }
  return { world: w, resources, roster };
}

/** 一夜过去：照料分工、养伤、全员陨落后的恢复，都在这里按游戏日结算。 */
export function nightResult(world: WorldState, ledger: Ledger, names: (id: CharacterId) => string): ActivityResult {
  const changes: Change[] = [{ kind: 'resource', key: 'spirit', amount: RULES.nightSpirit }];
  let herbs = ledger.resources.herb;
  const fallenAll = allFallen(world);
  // 从最后一位倒下的同行者算起，大家一起恢复。
  const reviveAll = fallenAll && Math.min(...Object.values(world.companions).map(c => c.nights)) + 1 >= RULES.reviveNights;
  for (const [key, care] of Object.entries(world.companions)) {
    const id = Number(key);
    if (care.condition === 'healthy') {
      if (care.assignment === 'garden') { changes.push({ kind: 'resource', key: 'herb', amount: RULES.gardenHerbs }, { kind: 'bond', character: id, amount: RULES.gardenBond }); herbs += RULES.gardenHerbs; }
      if (care.assignment === 'practice') changes.push({ kind: 'bond', character: id, amount: RULES.practiceBond });
      if (care.assignment === 'rest') changes.push({ kind: 'resource', key: 'spirit', amount: RULES.restSpirit });
    }
    if (care.condition === 'wounded' && care.assignment === 'rest' && care.nights + 1 >= RULES.healNights && herbs >= RULES.healHerbs) {
      herbs -= RULES.healHerbs;
      changes.push({ kind: 'resource', key: 'herb', amount: -RULES.healHerbs }, { kind: 'recover', character: id, from: 'wounded' });
    }
    if (reviveAll) changes.push({ kind: 'recover', character: id, from: 'fallen' });
  }
  const recovered = changes.filter((c): c is Extract<Change, { kind: 'recover' }> => c.kind === 'recover').map(c => names(c.character));
  return {
    id: `night:${world.day}`, activity: 'night', title: `第 ${world.day} 夜`, outcome: 'completed', place: 'lodge',
    companions: Object.keys(world.companions).map(Number), changes, time: 'night',
    note: recovered.length ? `${recovered.join('、')}的伤好了。` : fallenAll ? '大家还在静养。' : '会馆的灯熄了，园圃里有虫鸣。',
  };
}

export function sealResult(world: WorldState, ledger: Ledger, id: CharacterId, name: string): ActivityResult {
  const r = ledger.characters[id];
  if (r?.sealed) throw new Error(`${name}已经封灵。`);
  if ((r?.bond ?? 0) < RULES.sealBond || ledger.resources.spirit < RULES.sealSpirit) throw new Error(`封灵需要 ${RULES.sealBond} 点默契和 ${RULES.sealSpirit} 灵质。`);
  return {
    id: `seal:${id}`, activity: 'seal', title: `与${name}封灵`, outcome: 'completed', place: 'lodge', companions: [id],
    changes: [{ kind: 'resource', key: 'spirit', amount: -RULES.sealSpirit }, { kind: 'seal', character: id }], time: 'none',
    note: '默契凝成一张灵卡，下次出行会带在身边。',
  };
}

/** 提交前的时段检查：占用白天的玩法只能早上开始，过夜只能在晚上。 */
function advanceClock(w: WorldState, time: ActivityResult['time']) {
  if (time === 'day') {
    if (w.daypart !== 'morning') throw new Error('今天已经出过门了。');
    w.daypart = 'evening';
  } else if (time === 'night') {
    if (w.daypart !== 'evening') throw new Error('还没到晚上。');
    w.day++; w.daypart = 'morning';
    for (const care of Object.values(w.companions)) care.nights++;
  }
}

export interface CommitOutcome {
  snapshot: WorldSnapshot;
  entry: JournalEntry;
  resources: Partial<Record<ResourceKey, number>>;
  roster: Ledger['characters'];
  duplicate: boolean;
}

/** Journal Commit：把结果写进众生牌录并更新世界。重复提交同一结果 ID 不会再次生效。 */
export function commitResult(snapshot: WorldSnapshot, ledger: Ledger, result: ActivityResult, now = Date.now()): CommitOutcome {
  const existing = snapshot.journal.entries.find(e => e.id === result.id);
  if (existing) return { snapshot, entry: existing, resources: {}, roster: {}, duplicate: true };
  const { world, resources, roster } = applyChanges(snapshot.world, ledger, result.changes);
  const entry: JournalEntry = { ...withoutTime(result), day: snapshot.world.day, daypart: snapshot.world.daypart, at: now };
  advanceClock(world, result.time);
  if (result.place && result.activity !== 'night') world.places[result.place].visits++;
  for (const [id, carry] of Object.entries(result.carry ?? {})) if (world.companions[id]?.condition === 'wounded') world.companions[id].carry = structuredClone(carry);
  if (result.receipt && !world.imported.includes(result.receipt)) world.imported = [...world.imported, result.receipt].slice(-RULES.journalLimit);
  const journal: Journal = { ...snapshot.journal, entries: [...snapshot.journal.entries, entry].slice(-RULES.journalLimit) };
  return { snapshot: { ...snapshot, world, journal, activity: snapshot.activity?.id === result.id ? null : snapshot.activity }, entry, resources, roster, duplicate: false };
}

function withoutTime({ time: _time, carry: _carry, ...rest }: ActivityResult) { return rest; }

/** 尚未翻阅过的见闻，按时间顺序。 */
export function unseenEntries(journal: Journal): JournalEntry[] {
  if (!journal.seenThrough) return journal.entries;
  const i = journal.entries.findIndex(e => e.id === journal.seenThrough);
  return i < 0 ? journal.entries : journal.entries.slice(i + 1);
}

export function markSeen(snapshot: WorldSnapshot): WorldSnapshot {
  const last = snapshot.journal.entries.at(-1);
  return last ? { ...snapshot, journal: { ...snapshot.journal, seenThrough: last.id } } : snapshot;
}

/** 回到众生牌录时的变化摘要：把多条见闻合并成玩家一眼能看到的几类变化。 */
export interface ReturnSummary {
  resources: Partial<Record<ResourceKey, number>>;
  bonds: Record<string, number>;
  conditions: Record<string, Change['kind']>;
  newCards: string[];
  places: { place: PlaceId; state: 'discovered' | 'cleared' }[];
  sealed: CharacterId[];
  met: CharacterId[];
}
export function summarize(entries: JournalEntry[]): ReturnSummary {
  const s: ReturnSummary = { resources: {}, bonds: {}, conditions: {}, newCards: [], places: [], sealed: [], met: [] };
  for (const c of entries.flatMap(e => e.changes)) {
    if (c.kind === 'resource') s.resources[c.key] = (s.resources[c.key] ?? 0) + c.amount;
    else if (c.kind === 'bond') s.bonds[c.character] = (s.bonds[c.character] ?? 0) + c.amount;
    else if (c.kind === 'wound' || c.kind === 'fall' || c.kind === 'recover') s.conditions[c.character] = c.kind;
    else if (c.kind === 'card' && !s.newCards.includes(c.card)) s.newCards.push(c.card);
    else if (c.kind === 'place') s.places.push({ place: c.place, state: c.state });
    else if (c.kind === 'seal') s.sealed.push(c.character);
    else if (c.kind === 'meet') s.met.push(c.character);
  }
  for (const k of RESOURCE_KEYS_LIST) if (s.resources[k] === 0) delete s.resources[k];
  return s;
}
