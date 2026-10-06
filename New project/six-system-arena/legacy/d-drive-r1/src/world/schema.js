/**
 * 角色 × 六大系 数值 schema
 *
 * 本 schema 只描述「新工程的数值扩展层」，不修改 worldview_luoxiaohei_v4.db
 * 的任何表结构：DB 仍是世界观事实源，本层是以只读方式派生出来的、
 * 可回滚的「数值投影」。
 *
 * 可扩展性约定：
 *  - 顶层字段稳定，新增维度一律进 `extra`，避免污染消费方；
 *  - schemaVersion 递增时提供 migrate()；
 *  - 所有派生值必须携带 evidence（来源与命中关键词），保证可追溯、可推翻。
 */

import { SIX_SYSTEM_IDS } from './six-systems.js';
import { clampScore, computeRating, SCORE_MAX, SCORE_MIN } from './rating.js';
import { REALM_IDS, UNKNOWN_REALM } from './realms.js';
import { FIVE_ELEMENT_IDS } from './elements.js';

export const CHARACTER_SCHEMA_VERSION = 1;

export const ELEMENT_IDS = Object.freeze([...FIVE_ELEMENT_IDS, 'none']);

function emptySystems() {
  const out = {};
  for (const id of SIX_SYSTEM_IDS) out[id] = 0;
  return out;
}

/**
 * 规范化一条角色数值记录。
 * @param {object} input
 */
export function createCharacter(input = {}) {
  const systems = { ...emptySystems(), ...(input.systems || {}) };
  for (const id of SIX_SYSTEM_IDS) systems[id] = clampScore(systems[id]);

  const element = ELEMENT_IDS.includes(input.element) ? input.element : 'none';
  const realm = REALM_IDS.includes(input.realm) ? input.realm : UNKNOWN_REALM;

  const record = {
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    id: Number(input.id),
    name: String(input.name ?? ''),
    category: input.category ?? null,
    species: input.species ?? null,
    affiliation: input.affiliation ?? null,
    element,
    realm,
    systems,
    rating: input.rating ? { ...input.rating } : computeRating(systems, { realm }),
    evidence: {
      source: input.evidence?.source ?? 'worldview_luoxiaohei_v4.db',
      sourceTables: input.evidence?.sourceTables ?? ['characters', 'character_abilities'],
      abilitySnippets: input.evidence?.abilitySnippets ?? [],
      matchedKeywords: input.evidence?.matchedKeywords ?? {},
      innateZeroed: input.evidence?.innateZeroed ?? [],
      inferred: Boolean(input.evidence?.inferred),
    },
    provisional: input.provisional !== false,
    extra: input.extra ?? {},
  };
  return record;
}

/** 校验一条记录，返回 {ok, errors[]} */
export function validateCharacter(record) {
  const errors = [];
  if (!record || typeof record !== 'object') return { ok: false, errors: ['record 不是对象'] };
  if (record.schemaVersion !== CHARACTER_SCHEMA_VERSION) {
    errors.push(`schemaVersion 期望 ${CHARACTER_SCHEMA_VERSION}，实际 ${record.schemaVersion}`);
  }
  if (!Number.isInteger(record.id)) errors.push('id 必须是整数');
  if (!ELEMENT_IDS.includes(record.element)) errors.push(`element 非法：${record.element}`);
  if (!REALM_IDS.includes(record.realm) && record.realm !== UNKNOWN_REALM) {
    errors.push(`realm 非法：${record.realm}`);
  }
  for (const id of SIX_SYSTEM_IDS) {
    const v = record.systems?.[id];
    if (typeof v !== 'number' || Number.isNaN(v)) errors.push(`systems.${id} 必须是数字`);
    else if (v < SCORE_MIN || v > SCORE_MAX) errors.push(`systems.${id} 越界：${v}`);
  }
  if (!record.rating || typeof record.rating.grade !== 'string') errors.push('rating.grade 缺失');
  if (record.provisional !== false && record.provisional !== true) {
    errors.push('provisional 必须是布尔值');
  }
  return { ok: errors.length === 0, errors };
}

/** 批量校验 */
export function validateCollection(records) {
  const problems = [];
  if (!Array.isArray(records)) return { ok: false, problems: ['集合不是数组'] };
  records.forEach((r, i) => {
    const { ok, errors } = validateCharacter(r);
    if (!ok) problems.push({ index: i, name: r?.name, errors });
  });
  return { ok: problems.length === 0, problems, count: records.length };
}

/** 未来 schema 升级占位：v1 → v2 时在此实现幂等迁移 */
export function migrate(record) {
  if (!record || record.schemaVersion === CHARACTER_SCHEMA_VERSION) return record;
  throw new Error(`暂不支持的 schemaVersion：${record.schemaVersion}`);
}
