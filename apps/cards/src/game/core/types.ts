import type {AbilitySystem, Element, EcoIndividual, EcoExchange} from '@lxh/shared-types/models';
import type { RebirthRoom } from './rebirthRooms';
export type HeroId = 'xiaohei' | 'wuxian' | 'fengxi';
/** 局内主角：入世历练是三位同行者之一；轮回（重生之门）是玩家自己的修行者。 */
export type Protagonist = HeroId | 'seeker';
export type RebirthElement = '金' | '木' | '水' | '火' | '土';
/** 轮回开局选择与局内法宝（只存 id；福缘、道心、羁绊暂不迁移）。 */
export interface RebirthState { element: RebirthElement; branch?: string | null; guild?: string | null; difficulty?: 'trial' | 'normal' | 'rebirth'; dailyKey?: string | null; treasures?: string[]; usedEvents?: string[] }
export interface RebirthStart { element: RebirthElement; branch?: string | null; guild?: string | null; difficulty?: 'trial' | 'normal' | 'rebirth'; dailyKey?: string | null }
export type Phase = 'map' | 'battle' | 'reward' | 'rest' | 'event' | 'shop' | 'victory' | 'defeat';
export type NodeKind = 'battle' | 'elite' | 'event' | 'rest' | 'shop' | 'boss' | 'space' | 'guardian';
export interface Effect { damage?: number; block?: number; draw?: number; energy?: number; strength?: number; weak?: number; poison?: number; summon?: number; domain?: number; heal?: number; vulnerable?: number; regen?: number; damageFromBlock?: number; damageFromDebuffs?: number; clearTargetDebuffs?: number; healthCost?: number; reduceAttack?: number; drawBelowHalf?: number;
  /** 以下为轮回卡迁移补齐的机制。 */
  selfDamage?: number; drawBelow?: number; drawBelowPct?: number; regenFromAllDamage?: number; clearSelfDebuffs?: number;
  loseHpFromWeak?: number; loseHpFromVulnerable?: number; reduceTargetRegen?: number; reduceTargetStrength?: number; }
export type CardCondition = 'belowHalf' | 'attacksOnly' | 'belowPct';
export interface CardUpgrade { name: string; cost: number; text: string; effect: Effect; condition?: CardCondition; conditionPct?: number; }
export interface Card { id: string; name: string; owner: HeroId | 'all'; cost: number; type: '攻击' | '技能' | '能力'; text: string; glyph: string; effect: Effect; exhaust?: boolean; target?: 'single'|'all'|'self'; condition?: CardCondition; conditionPct?: number; school?: AbilitySystem; element?: Element; source?: string; /** 显式升级定义（轮回卡）；没有时按通用精进规则。 */ upgrade?: CardUpgrade; }
export interface CardInstance { uid: string; card: string; upgraded: boolean; }
export interface Character { id: HeroId; characterId: number; element: Element; abilitySystems: AbilitySystem[]; name: string; subtitle: string; description: string; quote: string; hp: number; relic: string; relicText: string; starter: string[]; }
export interface MapNode { id: string; floor: number; lane: number; kind: NodeKind; }
/** 轮回敌人的一步意图（与原重生之门同义）。 */
export interface Intent { damage?: number; block?: number; weak?: number; vulnerable?: number; strength?: number; regen?: number; heal?: number; }
export interface Enemy { vulnerable?: number; id: string; name: string; hp: number; maxHp: number; block: number; weak: number; poison: number; intent: 'attack' | 'guard'; damage: number;
  /** 轮回敌人：按意图序列行动，力量/回灵会衰减，半血时可能进入第二形态。 */
  intents?: Intent[]; next?: number; phase2?: Intent[] | null; phase2Active?: boolean; strength?: number; regen?: number; skill?: string | null; element?: string | null; resistance?: number; potency?: number; quote?: string | null; }
export interface Battle { regen?: number; /** 敌人施加给玩家的虚弱/易伤（轮回）。 */ weak?: number; vulnerable?: number; turn: number; energy: number; block: number; strength: number; summon: number; domain: number; hand: CardInstance[]; draw: CardInstance[]; discard: CardInstance[]; exhaust: CardInstance[]; enemies: Enemy[]; }
export type Action = { type: 'enter'; node: string } | { type: 'play'; uid: string; target: string } | { type: 'end' } | { type: 'reward'; card: string | null } | { type: 'rest'; choice: 'heal' | 'upgrade' | 'remove'; uid?: string } | { type: 'buy-item'; id: string } | { type: 'choose'; side: string } | { type: 'event'; choice: 'help' | 'leave' } | { type: 'buy'; card: string } | { type: 'remove'; uid: string } | { type: 'leave' };
export interface GameAction { sequence: number; action: Action; }
export interface RunState { ecoCards?: string[]; version: 1; seed: number; rng: number; hero: Protagonist;
  /** 轮回玩法（重生之门）；缺省为入世历练。 */ mode?: 'rebirth'; rebirth?: RebirthState; /** 轮回的当前非战斗房间（商店 / 事件 / 灵质空间）。 */ room?: RebirthRoom | null; phase: Phase; hp: number; maxHp: number; gold: number; floor: number; lane: number; nodes: MapNode[]; visited: string[]; deck: CardInstance[]; relics: string[]; battle: Battle | null; offers: string[]; removed: boolean; log: GameAction[]; messages: string[]; nextId: number; }
export interface TimelineEvent { id: string; title: string; floor: number; effect: 'heal' | 'gold' | 'growth'; amount: number; }
export interface TimelineAnchor { id: string; revision: number; events: TimelineEvent[]; }
export interface CompanionBond { bond: number; sealed: boolean; assignment: 'garden' | 'practice' | 'rest'; deaths?: number; woundDeck?: CardInstance[]; woundRelics?: string[]; }
export interface WoundCarry { deck: CardInstance[]; relics: string[]; }
export interface MetaState { ecoIndividuals?: EcoIndividual[]; food?: number; ecoReceipts?: Record<string,number>; ecoCards?: string[]; version: 1; day: number; spirit: number; herbs: number; garden: number; characters: Record<HeroId, CompanionBond>; timeline: TimelineAnchor; claimedRuns: string[]; allDeadAt?: number; }
/** 入世历练的单局：主角一定是三位同行者之一。 */
export type AdventureRun = RunState & { hero: HeroId; mode?: undefined };
export interface SaveData { ecoDeliveries?: EcoExchange[]; version: 1; run: AdventureRun | null; meta: MetaState; runTimeline: TimelineAnchor; }
