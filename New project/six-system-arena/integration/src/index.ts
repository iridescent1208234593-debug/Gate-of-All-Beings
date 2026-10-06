/* ============================================================================
   index.ts — 集成包统一出口（R3）
   ----------------------------------------------------------------------------
   在 zszm 侧以 `import { SixSystemPanel, SettlementStage } from './sixsys'` 使用。
   引入本文件不产生副作用（不自动 fetch、不自动注册全局）；运行时脚本
   （six-system-icons.js / settlement.js）需在入口 HTML 以 <script> 引入。
   ============================================================================ */

export { SixSystemPanel, type SixSystemPanelProps } from './SixSystemPanel';
export { SettlementStage, type SettlementStageProps } from './SettlementStage';
export { AchievementBanner, type AchievementBannerProps } from './AchievementBanner';

export {
  loadSixSystemData,
  resetSixSystemData,
  buildBridge,
  systemValuesOf,
  achievementProgress,
  SIXSYS_DATA_BASE,
  type SixSystemDataBridge,
} from './sixsys-data';

export {
  OFFICIAL_ASSETS,
  OFFICIAL_ASSET_BASE,
  SETTLEMENT_ASSETS,
  assetUrl,
  toSiteUrl,
  probeAssets,
  fallbackIconFor,
  type OfficialAssetId,
  type OfficialAssetRef,
} from './sixsys-assets';

export {
  SIX_SYSTEM_ORDER,
  TIER_ORDER,
  type AnySystemKey,
  type BattleLogEntry,
  type DeckCardRef,
  type DeckEntry,
  type DeckDoc,
  type AchievementDoc,
  type NeutralKey,
  type RarityKey,
  type SettlementContext,
  type SettlementResult,
  type SixSysAchievement,
  type SixSystemCharacter,
  type SixSystemKey,
  type SixSystemStatsDoc,
  type TierKey,
} from './sixsys-types';
