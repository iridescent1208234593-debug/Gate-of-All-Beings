/**
 * 世界存档：统一存档里的 mode:world 一条记录（WorldState + Journal + 当前 Activity），
 * 资源与角色进度走共享账本。一次 Journal Commit = 一次 commitMode，快照、资源和角色要么一起成功，要么都不生效。
 */
import { commitMode, onGameChange, openMode, readGame, readMode } from '@lxh/shared-session/game.js';
import type { GameResult } from '@lxh/shared-session/game.js';
import { companionIds } from './activities';
import { RESOURCE_KEYS_LIST } from './resources';
import { createWorld, emptySnapshot } from './rules';
import type { Ledger, ResourceKey, WorldSnapshot } from './types';

const MODE = 'world';

export interface WorldStore {
  snapshot: WorldSnapshot;
  ledger: Ledger;
  revision: number;
  /** 本玩法在账本里的资源基线；提交时按「基线 + 增量」计算，避免把别的玩法的变动重复计入。 */
  native: Record<ResourceKey, number>;
  recent: GameResult['profile']['recent'];
}

function check(value: unknown, ledger: Ledger): WorldSnapshot {
  const s = structuredClone(value) as WorldSnapshot;
  if (!s || s.version !== 1 || !s.world || s.world.version !== 1 || !Array.isArray(s.journal?.entries) || !Number.isSafeInteger(s.world.day))
    throw new Error('手记存档格式不兼容，原数据已保留。');
  // 新加入的同行者补进照料名单，不改动已有状态。
  const base = createWorld(companionIds().map(id => ({ id })), ledger);
  for (const [id, care] of Object.entries(base.companions)) s.world.companions[id] ??= care;
  for (const [id, place] of Object.entries(base.places)) s.world.places[id as keyof typeof base.places] ??= place;
  s.world.imported ??= [];
  return s;
}

function toStore(result: GameResult<WorldSnapshot>): WorldStore {
  const ledger: Ledger = { resources: result.profile.resources, characters: result.profile.characters };
  return {
    snapshot: check(result.record.snapshot, ledger), ledger, revision: result.record.revision,
    native: Object.fromEntries(RESOURCE_KEYS_LIST.map(k => [k, result.record.nativeResources[k] ?? 0])) as Record<ResourceKey, number>,
    recent: result.profile.recent,
  };
}

/** 打开（或首次建立）世界；每次打开都会把资源基线重设为当前公共余额。 */
export async function openWorld(): Promise<WorldStore> {
  const [existing, profile] = await Promise.all([readMode<WorldSnapshot>(MODE), readGame()]);
  const ledger: Ledger = { resources: profile.resources, characters: profile.characters };
  const initial = existing?.snapshot ? check(existing.snapshot, ledger) : emptySnapshot(createWorld(companionIds().map(id => ({ id })), ledger));
  const zero = Object.fromEntries(RESOURCE_KEYS_LIST.map(k => [k, 0]));
  return toStore(await openMode<WorldSnapshot>(MODE, initial, zero));
}

export async function saveWorld(store: WorldStore, snapshot: WorldSnapshot, change: { resources?: Partial<Record<ResourceKey, number>>; roster?: Ledger['characters']; operationId?: string } = {}): Promise<WorldStore> {
  const resources = Object.fromEntries(RESOURCE_KEYS_LIST.map(k => [k, store.native[k] + (change.resources?.[k] ?? 0)]));
  const result = await commitMode<WorldSnapshot>(MODE, snapshot, { revision: store.revision, resources, characters: change.roster ?? {}, operationId: change.operationId });
  return toStore(result);
}

export function onWorldLedgerChange(handler: (mode: string) => void) { return onGameChange(e => handler(e.mode)); }
