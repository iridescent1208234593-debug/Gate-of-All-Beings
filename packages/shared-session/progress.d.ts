export const LEADERBOARD_URL: string;
export interface ProgressAward { rule: string; label: string; amount: number }
export interface ProgressResult {
  ok: boolean; ranked: boolean; logged_in?: boolean; game?: string; best?: number; previous_best?: number;
  new_best?: boolean; awarded?: ProgressAward[]; points?: number; level?: number; next_level_at?: number; distance?: number;
}
export function reportResult(game: string, opts?: { score?: number; won?: boolean; finished?: boolean; ref?: string; toast?: boolean; distance?: number }): Promise<ProgressResult | null>;
export function reportProgress(game: string, score: number, opts?: { minIntervalMs?: number; toast?: boolean }): Promise<ProgressResult | null>;
export function fetchMyProgress(): Promise<any>;
export function fetchLeaderboard(board?: string, limit?: number): Promise<any>;
export function fetchBoards(): Promise<{ board: string; name: string; metric: string; unit: string }[]>;
export interface ChainStep { id: string; label: string; game?: string; progress?: number; target?: number; done?: boolean }
export interface ChainView { id: string; name: string; desc: string; reward: number; steps: ChainStep[]; complete?: boolean; claimed?: boolean }
export function fetchChains(): Promise<{ logged_in: boolean; chains: ChainView[] }>;
export function claimChain(chain: string): Promise<{ ok: boolean; chain: string; reward: number; already: boolean }>;
export function leaderboardUrl(board?: string): string;
export function showProgressToast(result: ProgressResult | null): void;
