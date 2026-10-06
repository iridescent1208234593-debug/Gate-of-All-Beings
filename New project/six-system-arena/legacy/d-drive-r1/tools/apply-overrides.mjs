#!/usr/bin/env node
/**
 * 六系数值覆盖层应用器（可重复执行，幂等）
 *
 * 用法：
 *   node tools/apply-overrides.mjs                 # 应用 data/stats-overrides.json，写出 data/character-stats.effective.json
 *   node tools/apply-overrides.mjs --check         # 只校验覆盖表并预览生效差异，不写文件
 *   node tools/apply-overrides.mjs --out <path>    # 指定输出路径
 *
 * 红线：本脚本只读 data/character-stats.json，绝不修改派生源文件；
 *      无权威对照，覆盖表为空时输出值与派生值完全一致（仅补 source 溯源字段）。
 *
 * stdout 固定输出一段 JSON 摘要（供自动化任务解析），退出码 0=成功 / 1=校验失败。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { applyOverrides, PROVENANCE_LEVELS } from '../src/world/overrides.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATS_PATH = path.join(ROOT, 'data', 'character-stats.json');
const OVERRIDES_PATH = path.join(ROOT, 'data', 'stats-overrides.json');
const DEFAULT_OUT = path.join(ROOT, 'data', 'character-stats.effective.json');

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const outIdx = argv.indexOf('--out');
const outPath = outIdx >= 0 && argv[outIdx + 1] ? path.resolve(argv[outIdx + 1]) : DEFAULT_OUT;

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function main() {
  const stats = readJson(STATS_PATH);
  const overrides = readJson(OVERRIDES_PATH);

  const result = applyOverrides(stats, overrides);
  if (!result.ok) {
    console.log(JSON.stringify({ ok: false, mode: checkOnly ? 'check' : 'apply', errors: result.errors, warnings: result.warnings }, null, 2));
    process.exitCode = 1;
    return;
  }

  if (!checkOnly) {
    writeFileSync(outPath, JSON.stringify(result.data, null, 2) + '\n', 'utf8');
  }

  // 生效差异：列出被覆盖的系别（仅看有实际分值变化的）
  const changed = result.applied
    .map((a) => ({ id: a.id, name: a.name, source: a.source, changedSystems: a.changedSystems }))
    .filter((a) => a.changedSystems.length > 0);

  console.log(JSON.stringify({
    ok: true,
    mode: checkOnly ? 'check' : 'apply',
    inputs: { stats: path.relative(ROOT, STATS_PATH), overrides: path.relative(ROOT, OVERRIDES_PATH) },
    output: checkOnly ? null : path.relative(ROOT, outPath),
    characters: result.data.characters.length,
    overrideEntries: result.data.overridesApplied.entryCount,
    overrideApplied: result.data.overridesApplied.appliedCount,
    skippedIds: result.data.overridesApplied.skippedIds,
    sourceLevels: PROVENANCE_LEVELS,
    sourceDistribution: result.data.sourceDistribution,
    changedEntries: changed,
    warnings: result.warnings,
    note: result.data.overridesApplied.appliedCount === 0
      ? '覆盖表为空：全部角色维持派生值，仅按 confidence 映射补齐 source 溯源字段（tagged→db-record，textual/baseline→inferred）。'
      : '已应用人工覆盖项，未列出的系别保留派生值。',
    disclaimer: '无权威对照：任何数值均不得表述为官方权威值，inferred 一律显示「推定基线」。',
  }, null, 2));
}

main();
