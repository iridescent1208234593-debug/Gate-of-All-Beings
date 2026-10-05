import type {AbilitySystem, Element, EcoIndividual, EcoExchange} from '@lxh/shared-types/models';
export type HeroId = 'xiaohei' | 'wuxian' | 'fengxi';
export type Phase = 'map' | 'battle' | 'reward' | 'rest' | 'event' | 'shop' | 'victory' | 'defeat';
export type NodeKind = 'battle' | 'elite' | 'event' | 'rest' | 'shop' | 'boss';
export interface Effect { damage?: number; block?: number; draw?: number; energy?: number; strength?: number; weak?: number; poison?: number; summon?: number; domain?: number; heal?: number; vulnerable?: number; regen?: number; damageFromBlock?: number; damageFromDebuffs?: number; clearTargetDebuffs?: number; healthCost?: number; reduceAttack?: number; drawBelowHalf?: number; }
export interface Card { id: string; name: string; owner: HeroId | 'all'; cost: number; type: '攻击' | '技能' | '能力'; text: string; glyph: string; effect: Effect; exhaust?: boolean; target?: 'single'|'all'; condition?: 'belowHalf'|'attacksOnly'; school?: AbilitySystem; element?: Element; source?: string; }
export interface CardInstance { uid: string; card: string; upgraded: boolean; }
export interface Character { id: HeroId; characterId: number; element: Element; abilitySystems: AbilitySystem[]; name: string; subtitle: string; description: string; quote: string; hp: number; relic: string; relicText: string; starter: string[]; }
export interface MapNode { id: string; floor: number; lane: number; kind: NodeKind; }
export interface Enemy { vulnerable?: number; id: string; name: string; hp: number; maxHp: number; block: number; weak: number; poison: number; intent: 'attack' | 'guard'; damage: number; }
export interface Battle { regen?: number; turn: number; energy: number; block: number; strength: number; summon: number; domain: number; hand: CardInstance[]; draw: CardInstance[]; discard: CardInstance[]; exhaust: CardInstance[]; enemies: Enemy[]; }
export type Action = { type: 'enter'; node: string } | { type: 'play'; uid: string; target: string } | { type: 'end' } | { type: 'reward'; card: string | null } | { type: 'rest'; choice: 'heal' | 'upgrade'; uid?: string } | { type: 'event'; choice: 'help' | 'leave' } | { type: 'buy'; card: string } | { type: 'remove'; uid: string } | { type: 'leave' };
export interface GameAction { sequence: number; action: Action; }
export interface RunState { ecoCards?: string[]; version: 1; seed: number; rng: number; hero: HeroId; phase: Phase; hp: number; maxHp: number; gold: number; floor: number; lane: number; nodes: MapNode[]; visited: string[]; deck: CardInstance[]; relics: string[]; battle: Battle | null; offers: string[]; removed: boolean; log: GameAction[]; messages: string[]; nextId: number; }
export interface TimelineEvent { id: string; title: string; floor: number; effect: 'heal' | 'gold' | 'growth'; amount: number; }
export interface TimelineAnchor { id: string; revision: number; events: TimelineEvent[]; }
export interface CompanionBond { bond: number; sealed: boolean; assignment: 'garden' | 'practice' | 'rest'; }
export interface MetaState { ecoIndividuals?: EcoIndividual[]; food?: number; ecoReceipts?: Record<string,number>; ecoCards?: string[]; version: 1; day: number; spirit: number; herbs: number; garden: number; characters: Record<HeroId, CompanionBond>; timeline: TimelineAnchor; claimedRuns: string[]; }
export interface SaveData { ecoDeliveries?: EcoExchange[]; version: 1; run: RunState | null; meta: MetaState; runTimeline: TimelineAnchor; }
