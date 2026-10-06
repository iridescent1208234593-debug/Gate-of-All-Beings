/**
 * 六系数值「外置可覆盖层」——溯源分级与人工校准通道
 *
 * 设计前提（用户口径，2026-10-06）：
 *  1) D 盘与 E 盘的 v4 库都不是权威数据源，两库已分叉，本项目不存在权威对照；
 *  2) 因此任何数值只能标注来源等级，不得表述为「官方权威值」；
 *  3) 派生结果（data/character-stats.json）只读不动，人工校准统一写入
 *     data/stats-overrides.json，由 tools/apply-overrides.mjs 合并产出
 *     data/character-stats.effective.json。
 *
 * 本模块不读取文件系统，纯函数，便于被 UI / 脚本 / 测试复用。
 */

import { SIX_SYSTEM_IDS } from './six-systems.js';
import { clampScore } from './rating.js';

/** 溯源等级：由强到弱 */
export const PROVENANCE_LEVELS = Object.freeze(['official', 'db-record', 'inferred']);

/** 溯源等级中文标签（UI 展示用） */
export const PROVENANCE_LABELS = Object.freeze({
  official: '官方设定',
  'db-record': '库记录支撑',
  inferred: '推定基线',
});

/** 默认等级：未校准即推定 */
export const DEFAULT_SOURCE = 'inferred';

/**
 * 派生文件里的 confidence 三级 → 溯源等级映射。
 * tagged  = 库内存在具名「X系·分支」条目 → db-record（记录支撑）
 * textual = 存在能力原文但无结构化分支 → inferred
 * baseline= 仅有存在性证据的默认基线 → inferred
 */
export const CONFIDENCE_TO_SOURCE = Object.freeze({
  tagged: 'db-record',
  textual: 'inferred',
  baseline: 'inferred',
  // 兼容：若某处已直接写入溯源等级，原样透传
  official: 'official',
  'db-record': 'db-record',
  inferred: 'inferred',
});

/** confidence → source */
export function sourceOfConfidence(confidence) {
  return CONFIDENCE_TO_SOURCE[confidence] || DEFAULT_SOURCE;
}

/** source 是否为合法等级 */
export function isProvenanceLevel(value) {
  return PROVENANCE_LEVELS.includes(value);
}

/**
 * 校验覆盖表结构。
 * @param {unknown} raw data/stats-overrides.json 解析结果
 * @param {Record<string|number, {name?:string, systems?:Record<string,number>, confidence?:string}>} [characters]
 * @returns {{ok:boolean, errors:string[], warnings:string[], entryCount:number, ids:string[]}}
 */
export function validateOverrides(raw, characters = {}) {
  const errors = [];
  const warnings = [];
  const ids = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['覆盖表根节点必须是对象'], warnings, entryCount: 0, ids };
  }
  if (raw.schemaVersion !== 1) {
    warnings.push(`覆盖表 schemaVersion=${String(raw.schemaVersion)}，当前解析器仅保证兼容 1`);
  }
  const entries = raw.overrides;
  if (entries === undefined) {
    warnings.push('覆盖表缺少 overrides 字段，按空表处理');
    return { ok: true, errors, warnings, entryCount: 0, ids };
  }
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, errors: ['overrides 必须是「角色 id → 覆盖项」的对象'], warnings, entryCount: 0, ids };
  }

  for (const [key, entry] of Object.entries(entries)) {
    const idNum = Number(key);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      errors.push(`角色键「${key}」非法：必须是正整数 id`);
      continue;
    }
    ids.push(key);
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`角色 ${key} 的覆盖项必须是对象`);
      continue;
    }
    if (entry.source !== undefined && !isProvenanceLevel(entry.source)) {
      errors.push(`角色 ${key} 的 source=「${String(entry.source)}」不在 ${PROVENANCE_LEVELS.join(' / ')} 之内`);
    }
    if (entry.source === 'official' && !String(entry.evidence || '').trim()) {
      errors.push(`角色 ${key} 标注 official 但缺少 evidence（官方出处）`);
    }
    if (entry.systems !== undefined) {
      if (!entry.systems || typeof entry.systems !== 'object' || Array.isArray(entry.systems)) {
        errors.push(`角色 ${key} 的 systems 必须是对象`);
      } else {
        for (const [sys, value] of Object.entries(entry.systems)) {
          if (!SIX_SYSTEM_IDS.includes(sys)) {
            errors.push(`角色 ${key} 的 systems 含未知系别「${sys}」，合法值：${SIX_SYSTEM_IDS.join(' / ')}`);
            continue;
          }
          const n = Number(value);
          if (!Number.isFinite(n) || n < 0 || n > 100) {
            errors.push(`角色 ${key} 的 ${sys} 分值「${String(value)}」越界，必须为 0..100 的数字`);
          }
        }
      }
    }
    if (entry.skillTags !== undefined) {
      if (!Array.isArray(entry.skillTags)) {
        errors.push(`角色 ${key} 的 skillTags 必须是数组`);
      } else {
        entry.skillTags.forEach((tag, i) => {
          if (!tag || typeof tag !== 'object' || !SIX_SYSTEM_IDS.includes(tag.system)) {
            errors.push(`角色 ${key} 的 skillTags[${i}] 缺少合法的 system 字段`);
          }
        });
      }
    }
    if (characters && Object.keys(characters).length > 0) {
      const exists = characters[key] || characters[idNum];
      if (!exists) warnings.push(`覆盖项角色 id=${key} 在当前派生表中不存在，应用时会被跳过`);
      else if (entry.source === undefined) warnings.push(`角色 ${key}（${exists.name || ''}）未声明 source，将沿用派生 confidence 映射`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, entryCount: ids.length, ids };
}

/**
 * 应用覆盖层，返回新的派生数据（不修改入参）。
 * @param {object} stats data/character-stats.json 解析结果
 * @param {object} raw data/stats-overrides.json 解析结果
 * @returns {{ok:boolean, errors:string[], warnings:string[], applied:Array<object>, skipped:Array<string>, data:object}}
 */
export function applyOverrides(stats, raw) {
  const list = Array.isArray(stats?.characters) ? stats.characters : [];
  const byId = new Map(list.map((c) => [String(c.id), c]));
  const check = validateOverrides(raw, Object.fromEntries(byId));
  if (!check.ok) {
    return { ok: false, errors: check.errors, warnings: check.warnings, applied: [], skipped: [], data: null };
  }

  const entries = raw?.overrides || {};
  const applied = [];
  const skipped = [];
  const next = structuredClone(list);

  for (const [key, entry] of Object.entries(entries)) {
    const idx = next.findIndex((c) => String(c.id) === String(key));
    if (idx < 0) {
      skipped.push(key);
      continue;
    }
    const target = next[idx];
    const changedSystems = [];
    if (entry.systems) {
      for (const [sys, value] of Object.entries(entry.systems)) {
        const clamped = clampScore(value);
        if (target.systems?.[sys] !== clamped) changedSystems.push(sys);
        target.systems = { ...(target.systems || {}), [sys]: clamped };
      }
    }
    const nextSource = entry.source || target.source || sourceOfConfidence(target.confidence);
    if (Array.isArray(entry.skillTags)) target.skillTags = structuredClone(entry.skillTags);
    if (entry.note) target.overrideNote = String(entry.note);
    if (entry.evidence) target.overrideEvidence = String(entry.evidence);
    target.source = nextSource;
    target.sourceLabel = PROVENANCE_LABELS[nextSource] || nextSource;
    if (entry.confidence) target.confidence = entry.confidence;
    target.overrideApplied = true;
    target.overrideSource = 'data/stats-overrides.json';
    applied.push({ id: target.id, name: target.name, source: nextSource, changedSystems });
  }

  // 未覆盖角色：按 confidence 映射补齐 source 字段（不改动任何分值）
  const distribution = {};
  for (const c of next) {
    if (!c.source) {
      c.source = sourceOfConfidence(c.confidence);
      c.sourceLabel = PROVENANCE_LABELS[c.source] || c.source;
      c.overrideApplied = false;
    }
    distribution[c.source] = (distribution[c.source] || 0) + 1;
  }

  const data = {
    ...stats,
    overridesApplied: {
      file: 'data/stats-overrides.json',
      entryCount: check.entryCount,
      appliedCount: applied.length,
      skippedIds: skipped,
      finalSourceLevels: PROVENANCE_LEVELS,
      noAuthoritativeReference: true,
    },
    sourceDistribution: distribution,
    characters: next,
  };

  return { ok: true, errors: [], warnings: check.warnings, applied, skipped, data };
}
