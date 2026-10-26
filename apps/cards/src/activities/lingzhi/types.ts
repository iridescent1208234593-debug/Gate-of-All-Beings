/**
 * 灵质修行（灵质回路试炼）的局内类型。与入世历练、重生之门的 RunState 互不依赖：
 * 规则、状态机与数值都在本模块里，众生牌录只经由 adapter 拿到 ActivityResult。
 */
export type LingzhiTarget = 'enemy' | 'allEnemies' | 'player';

export type LingzhiCardAction =
  | { type: 'lingzhiCombo'; base: number; per: number }
  | { type: 'lingzhiWeak'; amount?: number }
  | { type: 'drawCards'; amount: number }
  | { type: 'lingzhiShieldSurge'; cap?: number }
  | { type: 'lingzhiHeartTide'; base: number }
  | { type: 'lingzhiSwarm'; base?: number };

export interface LingzhiCardDef {
  cardId: string; name: string; type: string; energy: number; target: LingzhiTarget;
  damage?: number; block?: number; exhaust?: boolean; desc: string; tags?: string[]; cost: number;
  actions?: LingzhiCardAction[];
}

export interface LingzhiCharacterDef {
  id: string; name: string; cost: number; desc: string; starter: string[];
  passive: { name: string; desc: string; strength?: number; regen?: number; drawExtra?: number };
}

export interface LingzhiIntent { damage?: number; block?: number; strength?: number; weak?: number; vulnerable?: number }

export interface LingzhiMonsterDef {
  id: string; name: string; desc: string; element?: string; maxHealth: number; intents: LingzhiIntent[];
  difficulty: 'normal' | 'elite' | 'boss'; phase2Threshold?: number; phase2Name?: string; phase2Intents?: LingzhiIntent[];
}

export interface LingzhiData {
  source: string; defaultCards: string[];
  characters: LingzhiCharacterDef[]; cards: LingzhiCardDef[]; monsters: LingzhiMonsterDef[];
}

export type Powers = Partial<Record<'strength' | 'regen' | 'weak' | 'vulnerable' | 'monsterRegen', number>>;

export interface LingzhiCard { uid: string; card: string }

export interface LingzhiMonster {
  id: string; def: string; name: string; element: string; difficulty: LingzhiMonsterDef['difficulty'];
  hp: number; maxHp: number; block: number; powers: Powers;
  intents: LingzhiIntent[]; nextIntent: number; bossPhase: 1 | 2;
}

/** 原地图节点类型：起点、战斗、精英、休整、事件、灵质空间、守门者。 */
export type LingzhiNodeKind = 'start' | 'battle' | 'elite' | 'rest' | 'event' | 'space' | 'boss';
export interface LingzhiNode { id: string; floor: number; lane: number; kind: LingzhiNodeKind }

export interface LingzhiBattle {
  monsters: LingzhiMonster[]; turn: number; energy: number; block: number; powers: Powers;
  hand: LingzhiCard[]; draw: LingzhiCard[]; discard: LingzhiCard[]; exhaust: LingzhiCard[];
  combo: number; heartTide: number; played: number;
}

export type LingzhiPhase = 'map' | 'battle' | 'reward' | 'rest' | 'quiet' | 'victory' | 'defeat';

export interface LingzhiRun {
  version: 1; seed: number; rng: number; character: string;
  phase: LingzhiPhase; hp: number; maxHp: number;
  /** 当前所在层（-1 表示还在起点之前；0 是起点）与路线。 */
  floor: number; lane: number; nodes: LingzhiNode[]; visited: string[];
  deck: LingzhiCard[]; battle: LingzhiBattle | null; offers: string[];
  /** 本局战斗用过的最长回合数（原「鏖战不休」统计）。 */
  longestBattle: number; battlesWon: number;
  messages: string[]; nextId: number;
}

export type LingzhiAction =
  | { type: 'enter'; node: string }
  | { type: 'play'; uid: string; target?: string }
  | { type: 'end' }
  | { type: 'reward'; card: string | null }
  | { type: 'rest'; choice: 'heal' }
  | { type: 'rest'; choice: 'remove'; uid: string }
  | { type: 'continue' };

export type { LingzhiLoadout } from '../../world/types';
