export const LEADERBOARD_URL: string;
export interface ProgressAward { rule: string; label: string; amount: number }
export interface ProgressResult {
  ok: boolean; ranked: boolean; logged_in?: boolean; game?: string; best?: number; previous_best?: number;
  new_best?: boolean; awarded?: ProgressAward[]; points?: number; level?: number; next_level_at?: number;
}
export function reportResult(game: string, opts?: { score?: number; won?: boolean; finished?: boolean; ref?: string; toast?: boolean }): Promise<ProgressResult | null>;
export function reportProgress(game: string, score: number, opts?: { minIntervalMs?: number; toast?: boolean }): Promise<ProgressResult | null>;
export function fetchMyProgress(): Promise<any>;
export function fetchLeaderboard(board?: string, limit?: number): Promise<any>;
export function fetchBoards(): Promise<{ board: string; name: string; metric: string; unit: string }[]>;
export function leaderboardUrl(board?: string): string;
export function showProgressToast(result: ProgressResult | null): void;
