#!/usr/bin/env node
/**
 * 从「灵质修行」（slay-the-web）原始内容导出灵质修行 Activity 使用的数据：
 * 角色、灵术卡、试炼敌人（含守门者二阶段）、默认解锁的卡。
 * 只读源文件，输出 src/activities/lingzhi/data/lingzhi.json；相同输入产生相同字节。
 * 卡牌上出现引擎不认识的动作会直接报错，不静默丢弃。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../..');
const slay = resolve(root, 'apps/slay/public');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){return s.startsWith('/shared/')?n(${JSON.stringify(pathToFileURL(root).href)}+s,c):n(s,c);}`));
const mod = p => import(pathToFileURL(resolve(slay, p)).href);

const { lingzhiCharacters, lingzhiCards } = await mod('content/lingzhi-xiuxing.js');
const { lingzhiMonsterPool } = await mod('content/lingzhi-monsters.js');
const progress = await mod('game/lingzhi-progress.js');

const ACTIONS = new Set(['lingzhiCombo', 'lingzhiWeak', 'drawCards', 'lingzhiShieldSurge', 'lingzhiHeartTide', 'lingzhiSwarm']);
const TARGETS = new Set(['enemy', 'allEnemies', 'player']);
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));

const cards = lingzhiCards.map(c => {
  if (!TARGETS.has(c.target)) throw new Error(`${c.name}: 未知目标 ${c.target}`);
  for (const a of c.actions ?? []) if (!ACTIONS.has(a.type)) throw new Error(`${c.name}: 未知动作 ${a.type}`);
  return pick(c, ['cardId', 'name', 'type', 'energy', 'target', 'damage', 'block', 'exhaust', 'desc', 'tags', 'cost', 'actions']);
});
const byName = new Map(cards.map(c => [c.name, c.cardId]));
const characters = lingzhiCharacters.map(c => {
  const starter = c.starterCards.map(n => { const id = byName.get(n); if (!id) throw new Error(`${c.name}: 起始卡 ${n} 不存在`); return id; });
  return { id: c.id, name: c.name, cost: c.cost, desc: c.desc, starter, passive: pick(c.passive, ['name', 'desc', 'strength', 'regen', 'drawExtra']) };
});
const monsters = lingzhiMonsterPool.map(m => pick(m, ['id', 'name', 'desc', 'element', 'maxHealth', 'intents', 'difficulty', 'phase2Threshold', 'phase2Name', 'phase2Intents']));
// 默认进度里解锁的卡（原 lingzhi-progress defaultProgress，loadProgress 在没有存档时返回它）
const defaults = progress.loadProgress();
const data = { source: 'apps/slay/public/content/lingzhi-*.js', defaultCards: defaults.unlockedCards, characters, cards, monsters };

const out = resolve(here, '../src/activities/lingzhi/data/lingzhi.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
console.log(`lingzhi.json：角色 ${characters.length}、灵术卡 ${cards.length}、敌人 ${monsters.length}、默认解锁 ${defaults.unlockedCards.join(',')}`);
