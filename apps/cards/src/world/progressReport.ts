/**
 * 众生牌录 → 账户积分 / 排行榜。一次 ActivityResult 写进众生牌录后调用一次；
 * 访客由服务器忽略（不上榜），失败只在控制台提示，不影响众生牌录本身。
 */
import { reportResult } from '@lxh/shared-session/progress.js';
import type { ActivityResult } from './types';

const BOARD: Partial<Record<ActivityResult['activity'], string>> = {
  expedition: 'cards',      // 入世历练：单次最深层数
  lingzhi: 'lingzhi',       // 灵质回路
  'rebirth-gate': 'slay',   // 众生牌录内的重生之门与独立重生之门同榜
};

export function reportActivity(result: ActivityResult) {
  const board = BOARD[result.activity];
  // 带 receipt 的结算来自独立重生之门，那边已经上报过，这里不重复计分。
  if (!board || result.receipt || !result.encounter) return;
  const finished = result.outcome === 'victory' || result.outcome === 'defeat';
  void reportResult(board, { score: result.encounter.floors, finished, won: result.outcome === 'victory', ref: 'journal:' + result.id });
}
