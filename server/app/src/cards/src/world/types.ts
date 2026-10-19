/**
 * 共同世界的核心类型。三层状态刻意分开：
 * - WorldState：长期世界（游戏日、同行者照料、地点、图鉴），不含任何单局细节；
 * - ActivitySession：正在进行的一次玩法（出行配置 + 该玩法自己的局内状态，例如 RunState）；
 * - Journal：只追加的见闻记录，每条都由一次 ActivityResult 提交而来。
 * 资源余额与角色羁绊/伤亡计数归共享账本（@lxh/shared-session/game.js）所有，这里只引用角色 ID。
 */
import type { ResourceKey } from '@lxh/shared-session/game.js';
import type { CardInstance, RebirthElement } from '../game/core/types';

export type { ResourceKey };
/** 共享数据库中的有效角色 ID。 */
export type CharacterId = number;
export type Daypart = 'morning' | 'evening';
export type PlaceId = 'lodge' | 'forest-path' | 'deep-forest' | 'rebirth-gate' | 'lingzhi-circuit';
export type Assignment = 'garden' | 'practice' | 'rest';
export type Condition = 'healthy' | 'wounded' | 'fallen';

export interface CompanionCare {
  assignment: Assignment;
  condition: Condition;
  /** 处于当前状态的连续夜数（养伤、全员陨落后的恢复都按游戏日计）。 */
  nights: number;
  /** 重伤后保留的牌组与随身灵物，下一次出行带上。 */
  carry?: { deck: CardInstance[]; relics: string[] };
}

export interface PlaceState { discovered: boolean; visits: number; cleared: number }

export interface WorldState {
  version: 1;
  day: number;
  daypart: Daypart;
  companions: Record<string, CompanionCare>;
  places: Record<PlaceId, PlaceState>;
  codex: { cards: string[]; characters: CharacterId[] };
  /** 已经结算进手记的外部玩法结果（例如重生之门的账本回执），用于去重。 */
  imported: string[];
}

/** 一条见闻里的结构化变化。settled=true 表示共享账本已在别处结算，这里只记录不重复入账。 */
export type Change =
  | { kind: 'resource'; key: ResourceKey; amount: number; settled?: boolean }
  | { kind: 'bond'; character: CharacterId; amount: number }
  | { kind: 'wound'; character: CharacterId }
  | { kind: 'fall'; character: CharacterId }
  | { kind: 'recover'; character: CharacterId; from: Exclude<Condition, 'healthy'> }
  | { kind: 'seal'; character: CharacterId }
  | { kind: 'card'; card: string; via: 'reward' | 'shop' | 'event' | 'start' }
  | { kind: 'meet'; character: CharacterId }
  | { kind: 'place'; place: PlaceId; state: 'discovered' | 'cleared' }
  | { kind: 'world-event'; id: string; text: string };

export type ActivityKind = 'expedition' | 'rebirth-gate' | 'lingzhi' | 'stay' | 'night' | 'seal';
export type Outcome = 'victory' | 'defeat' | 'returned' | 'completed';

/** 任一玩法结束时交给手记的统一结果；战斗遭遇的结算（Encounter Resolution）也是它。 */
export interface ActivityResult {
  /** 稳定 ID：同一次结算重试必须相同，提交据此去重。 */
  id: string;
  activity: ActivityKind;
  title: string;
  outcome: Outcome;
  place?: PlaceId;
  companions: CharacterId[];
  changes: Change[];
  /** 消耗时段：'day' 占用今天（早→晚），'night' 过夜到次日早晨，'none' 不占时间。 */
  time: 'day' | 'night' | 'none';
  note?: string;
  encounter?: { floors: number; battlesWon: number; boss: boolean };
  /** 重伤者带回的牌组/灵物：写进世界照料状态，不写进见闻。 */
  carry?: Record<string, { deck: CardInstance[]; relics: string[] }>;
  /** 来自其他玩法账本的回执 ID（例如重生之门结算），提交后记入 world.imported 防重复。 */
  receipt?: string;
}

export interface JournalEntry extends Omit<ActivityResult, 'time' | 'carry'> {
  day: number;
  daypart: Daypart;
  at: number;
}

export interface Journal { entries: JournalEntry[]; seenThrough: string | null }

/** 出行配置：现在只有同行者与牌组，其余槽位结构已就位，供以后加入道具/草药/装备/风险/区域。 */
export interface ExpeditionLoadout {
  companion: string;
  deck: 'starter' | 'carry';
  region: PlaceId;
  risk: 'calm';
  items: string[];
  herbs: number;
  gear: string[];
}

/** 重生之门的开局配置：本命五行、难度、灵质天赋（可不选）、出身分馆。 */
export interface RebirthLoadout { element: RebirthElement; difficulty: 'trial' | 'normal' | 'rebirth'; branch?: string | null; guild?: string | null }

/** 灵质修行的开局配置：选一位修行者（规则与局内状态在 src/activities/lingzhi）。 */
export interface LingzhiLoadout { character: string }

export interface ActivitySession<S = unknown, L = ExpeditionLoadout | RebirthLoadout> {
  id: string;
  activity: ActivityKind;
  startedDay: number;
  loadout: L;
  state: S;
}

/** 共享账本里与世界相关的只读视图。 */
export interface Ledger {
  resources: Record<ResourceKey, number>;
  characters: Record<string, { discovered?: boolean; bond?: number; sealed?: boolean; deaths?: number; reviveAt?: number | null }>;
}

/** 持久化在统一存档 mode:world 中的整体快照：三段同处一条记录，只为了能原子提交。 */
export interface WorldSnapshot<S = unknown> {
  version: 1;
  world: WorldState;
  journal: Journal;
  activity: ActivitySession<S, unknown> | null;
}
