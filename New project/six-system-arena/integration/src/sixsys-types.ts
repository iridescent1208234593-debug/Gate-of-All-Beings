/* ============================================================================
   sixsys-types.ts — 六系演武 × zszm 集成包 · 类型契约（R3）
   ----------------------------------------------------------------------------
   仅类型声明，无运行时代码；与 arena 侧 data/generated/character_stats.json、
   data/decks.json、data/achievements.json 的字段一一对应。
   ============================================================================ */

/** 六系 key（与 window.LXHUI.ICONS 的六键一致） */
export type SixSystemKey = 'jin' | 'mu' | 'shui' | 'huo' | 'tu' | 'kongjian';
/** 中性 key：未检出御灵 / 空间归属的角色 */
export type NeutralKey = 'none';
export type AnySystemKey = SixSystemKey | NeutralKey;

/** 档位（战力分档） */
export type TierKey = 'F' | 'E' | 'D' | 'C' | 'B' | 'A';
/** 稀有度 */
export type RarityKey = 'R' | 'SR' | 'SSR' | 'UR';

export const SIX_SYSTEM_ORDER: readonly SixSystemKey[] = ['jin', 'mu', 'shui', 'huo', 'tu', 'kongjian'] as const;
export const TIER_ORDER: readonly TierKey[] = ['F', 'E', 'D', 'C', 'B', 'A'] as const;

/** 与 shared-types/world.js 的 ABILITY_SYSTEMS 同域 */
export type AbilitySystemKey = 'yuling' | 'shengling' | 'zaowu' | 'kongjian' | 'xinling' | 'suoyu';

/* ------------------------------------------------------------------ 数值产物 */

/** character_stats.json 的单个角色记录（字段以 arena 产物为准，未知字段保留） */
export interface SixSystemCharacter {
  id: number;
  name: string;
  type?: string;
  category?: string;
  mainline: boolean;
  /** 主属性（无系为 'none'） */
  element: AnySystemKey;
  element_name?: string;
  /** 命中的系（含多系） */
  systems: SixSystemKey[];
  systems_label?: string;
  element_confidence?: number;
  element_source?: unknown;
  realm_id?: number;
  realm_key?: string;
  realm_name?: string;
  hp: number;
  attack: number;
  defense: number;
  power: number;
  tier: TierKey;
  tier_name?: string;
  rarity: RarityKey;
  ability_count?: number;
  abilities?: string[];
  [k: string]: unknown;
}

export interface SixSystemStatsDoc {
  meta: {
    total: number;
    mainline_count: number;
    generated_at: string;
    scope?: string;
    model_version?: string;
    source_db?: string;
    source_db_fingerprint?: { fingerprint?: string; [k: string]: unknown };
    [k: string]: unknown;
  };
  characters: SixSystemCharacter[];
}

/* ------------------------------------------------------------------ 卡组产物 */

export interface DeckCardRef {
  card_id: string;
  name?: string;
  /** 六系 key */
  element?: SixSystemKey;
  /** 能力体系 key（AbilitySystemKey） */
  school?: AbilitySystemKey;
  cost?: number;
  type?: string;
  text?: string;
  [k: string]: unknown;
}

export interface DeckEntry {
  character_id: number;
  name?: string;
  rarity: RarityKey;
  mainline: boolean;
  general: DeckCardRef;
  skills: DeckCardRef[];
  bond: DeckCardRef;
  ultimate: DeckCardRef;
  skill_slots: { total: number; unlocked: number };
  primary_ratio_basis?: 'primary' | 'all';
  primary_skill_ratio?: number;
  bond_is_system?: boolean;
  [k: string]: unknown;
}

export interface DeckDoc {
  version?: string;
  /** 规则段：技能槽上限、锁定节奏、主系占比下限 */
  rules?: unknown;
  skill_profiles?: unknown;
  bonds?: unknown;
  ultimates?: unknown;
  decks: DeckEntry[];
  [k: string]: unknown;
}

/* ------------------------------------------------------------------ 成就产物 */

export interface SixSysAchievement {
  id: string;
  category: 'character' | 'system' | 'battle' | 'rarity' | string;
  category_name?: string;
  name: string;
  desc: string;
  condition: Record<string, unknown> & { type: string };
  reward?: Record<string, unknown>;
  progress: { metric: string; target: number; unit?: string };
  hidden?: boolean;
  source_doc?: string;
  [k: string]: unknown;
}

export interface AchievementDoc {
  version?: string;
  categories?: { key: string; count: number; [k: string]: unknown }[];
  achievements: SixSysAchievement[];
  /** metric 名 → 说明 */
  metrics?: Record<string, string>;
  /** R3 新增：ach_system_001 的档位门槛与替代路径（拍板结论） */
  element_gate?: {
    min_tier?: TierKey;
    or_collect_per_element?: number;
    legacy_min_tier?: TierKey;
    note?: string;
    [k: string]: unknown;
  };
  battle_log_contract?: unknown;
  [k: string]: unknown;
}

/* ------------------------------------------------------------------ 战斗日志 */

/** 统一战斗日志条目（成就判定唯一输入，见 docs/04 §5） */
export interface BattleLogEntry {
  battle_id: string;
  /** 玩法来源 */
  mode: 'story' | 'arena' | 'challenge' | 'mirror';
  my_character_id: number;
  /** 我方主属性（六系成就判定用） */
  my_element?: AnySystemKey;
  opponent_id: number;
  opponent_type: 'official' | 'mirror';
  result: 'win' | 'lose' | 'draw';
  turn_used?: number;
  hp_left?: number;
  /** 越阶：我方战力低于对手 */
  tier_gap?: number;
  seed?: number;
  [k: string]: unknown;
}

/* ------------------------------------------------------------------ 结算引擎 */

/** settlement.js 的时间轴节点 */
export interface SettlementTimelineItem {
  at_ms: number;
  key: string;
  desc: string;
  asset: string | null;
}

export interface SettlementResult {
  version: string;
  result: 'win' | 'lose';
  duration_ms: number;
  timeline: SettlementTimelineItem[];
  line: { text: string; category: string };
  feedback: {
    positive: boolean;
    cast?: string[];
    sticker?: string;
    winner_element?: SixSystemKey | null;
    icons_ref?: string;
  };
  assets: Record<string, string | string[] | null>;
  achievement: { show_after_ms: number | null; unlocked: string[]; play_order: string };
  retry: { enabled: boolean; label: string; action: string };
  penalty: boolean;
  no_penalty_detail?: Record<string, boolean>;
  provenance?: Record<string, unknown>;
}

/** SettlementStage 的入参上下文（透传给 SixSystemSettlement.resolve） */
export interface SettlementContext {
  result: 'win' | 'lose' | 'draw';
  mode?: 'story' | 'arena' | 'challenge' | 'mirror';
  opponent_type?: 'official' | 'mirror';
  opponent_id?: number;
  opponent_name?: string;
  first_time_defeat?: boolean;
  win_streak?: number;
  winner_element?: SixSystemKey | null;
  seed?: number;
  newly_unlocked?: string[];
  last_line?: string;
}

/* ------------------------------------------------------------------ 全局声明 */

export interface SixSystemPanelOptions {
  name?: string;
  subtitle?: string;
  tier?: string;
  systems?: SixSystemKey[];
  values?: number[];
  stats?: { hp?: number; attack?: number; defense?: number };
  labels?: string[];
  source?: string;
  wuxingTitle?: string;
}

export interface SixSystemPanelApi {
  render(opts: SixSystemPanelOptions): HTMLElement | null;
  mount(target: string | HTMLElement, opts: SixSystemPanelOptions): HTMLElement | null;
  renderFromRecord(record: unknown): HTMLElement | null;
  fallbackRadar(labels: string[], values: number[]): HTMLElement;
}

export interface SixSystemIconsApi {
  KEYS: SixSystemKey[];
  LABELS: Record<string, string>;
  META: Record<string, unknown>;
  ICONS: Record<string, string>;
  svg(key: string): string;
  create(key: string, size?: number): HTMLElement | null;
  label(key: string): string;
  color(key: string): string;
  isSixSystem(key: string): boolean;
  registerIcons(): void;
}

export interface SixSystemSettlementApi {
  VERSION: string;
  resolve(ctx: SettlementContext): SettlementResult;
  pickSticker(seed: number): string;
  lines(): { win: Record<string, string[]>; lose: string[] };
  hashSeed(input: string | number): number;
  ASSETS: Record<string, unknown>;
  WIN_TIMELINE: { at: number; key: string; desc: string; asset: string | null }[];
  LOSE_TIMELINE: { at: number; key: string; desc: string; asset: string | null }[];
}

declare global {
  interface Window {
    /** zszm 既有的共享 UI 全局（只读取用，不修改） */
    LXHUI?: { ICONS: Record<string, string> } & Record<string, unknown>;
    SixSystemIcons?: SixSystemIconsApi;
    SixSystemPanel?: SixSystemPanelApi;
    SixSystemSettlement?: SixSystemSettlementApi;
    SIXSYS_DATA?: {
      character_stats?: SixSystemStatsDoc;
      decks?: DeckDoc;
      achievements?: AchievementDoc;
    };
  }
}
