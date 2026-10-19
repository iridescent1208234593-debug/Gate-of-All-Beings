/**
 * 灵质修行的局内规则：从原 slay-the-web/public/game/lingzhi-engine.js 移植的纯函数状态机。
 * 随机数全部来自 run.rng（可复现、可存档），不读现实时钟。
 *
 * 这一版是最小可玩闭环：七层灵质回路地图、战斗、休整、守门者（含二阶段）。
 * 遗物、出身分馆、势力、今日灵机、事件与灵质空间、残片解锁暂未接入；
 * 事件 / 灵质空间节点保留原地图位置，走到时只记一笔「稍作停留」，不结算效果。
 */
import raw from './data/lingzhi.json';
import type {
  LingzhiAction, LingzhiBattle, LingzhiCard, LingzhiCardDef, LingzhiCharacterDef, LingzhiData, LingzhiLoadout,
  LingzhiMonster, LingzhiMonsterDef, LingzhiNode, LingzhiNodeKind, LingzhiRun, Powers,
} from './types';

export const LINGZHI = raw as LingzhiData;
export const LINGZHI_CARDS: Record<string, LingzhiCardDef> = Object.fromEntries(LINGZHI.cards.map(c => [c.cardId, c]));
export const LINGZHI_CHARACTERS: Record<string, LingzhiCharacterDef> = Object.fromEntries(LINGZHI.characters.map(c => [c.id, c]));
const MONSTERS: Record<string, LingzhiMonsterDef> = Object.fromEntries(LINGZHI.monsters.map(m => [m.id, m]));
/** 最小闭环只开放默认解锁的角色（行者，0 残片）。 */
export const OPEN_CHARACTERS = LINGZHI.characters.filter(c => c.cost === 0).map(c => c.id);

const HEIGHT = 7;
const BASE_HP = 72;
const ENERGY = 3;
const HAND = 5;

function random(s: LingzhiRun) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }
function shuffle<T>(s: LingzhiRun, a: T[]) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function instance(s: LingzhiRun, card: string): LingzhiCard { return { uid: `l${s.nextId++}`, card }; }
function note(s: LingzhiRun, text: string) { s.messages = [...s.messages.slice(-11), text]; }
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const weakened = (n: number) => Math.floor(n * 0.75);
const exposed = (n: number) => Math.floor(n * 1.5);

/** 原 buildLingzhiDungeon：起点与守门层各一个节点；第 1–5 层三选一（战斗/休整/事件，45% 事件换成灵质空间），第 5 层是精英层。 */
function buildMap(s: LingzhiRun) {
  s.nodes.push({ id: '0-1', floor: 0, lane: 1, kind: 'start' });
  for (let y = 1; y < HEIGHT - 1; y++) {
    const elite = y === HEIGHT - 2;
    const kinds: LingzhiNodeKind[] = elite ? ['elite', 'rest', 'event'] : ['battle', 'rest', 'event'];
    if (!elite && random(s) < 0.45) kinds[2] = 'space';
    shuffle(s, kinds).forEach((kind, lane) => s.nodes.push({ id: `${y}-${lane}`, floor: y, lane, kind }));
  }
  s.nodes.push({ id: `${HEIGHT - 1}-1`, floor: HEIGHT - 1, lane: 1, kind: 'boss' });
}

export function createLingzhiRun(loadout: LingzhiLoadout, seed: number): LingzhiRun {
  const char = LINGZHI_CHARACTERS[loadout.character];
  if (!char || !OPEN_CHARACTERS.includes(char.id)) throw new Error('这位修行者还没有解锁。');
  const s: LingzhiRun = {
    version: 1, seed: seed >>> 0, rng: seed >>> 0, character: char.id, phase: 'map', hp: BASE_HP, maxHp: BASE_HP,
    floor: 0, lane: 1, nodes: [], visited: ['0-1'], deck: [], battle: null, offers: [], longestBattle: 0, battlesWon: 0,
    messages: ['步入灵质回路，四周的灵质缓缓流转。'], nextId: 1,
  };
  buildMap(s);
  s.deck = char.starter.map(id => instance(s, id));
  return s;
}

export function availableNodes(s: LingzhiRun): LingzhiNode[] { return s.phase === 'map' ? s.nodes.filter(n => n.floor === s.floor + 1) : []; }
export const lingzhiFloors = () => HEIGHT;

/** 原 lingzhiMonstersForFloor：第 1–2 层初段、第 3–4 层中段、第 5 层精英，整组一起出现。 */
function monstersFor(s: LingzhiRun, node: LingzhiNode): LingzhiMonsterDef[] {
  const all = LINGZHI.monsters;
  if (node.kind === 'boss') { const pool = all.filter(m => m.difficulty === 'boss'); return [pool[Math.floor(random(s) * pool.length)]]; }
  if (node.floor >= 5) return all.filter(m => m.difficulty === 'elite');
  if (node.floor >= 3) return all.filter(m => m.difficulty === 'normal' && m.maxHealth >= 18);
  return all.filter(m => m.difficulty === 'normal' && m.maxHealth < 18);
}

function spawn(def: LingzhiMonsterDef, i: number): LingzhiMonster {
  return { id: `enemy${i}`, def: def.id, name: def.name, element: def.element ?? '通用', difficulty: def.difficulty, hp: def.maxHealth, maxHp: def.maxHealth, block: 0, powers: {}, intents: def.intents, nextIntent: 0, bossPhase: 1 };
}

function drawN(b: LingzhiBattle, s: LingzhiRun, n: number) {
  if (b.draw.length < n) { b.draw = shuffle(s, b.draw.concat(b.discard)); b.discard = []; }
  b.hand = b.hand.concat(b.draw.slice(0, n));
  b.draw = b.draw.slice(n);
}

function startBattle(s: LingzhiRun, node: LingzhiNode) {
  const char = LINGZHI_CHARACTERS[s.character];
  const powers: Powers = {};
  if (char.passive.strength) powers.strength = char.passive.strength;
  if (char.passive.regen) powers.regen = char.passive.regen;
  const b: LingzhiBattle = {
    monsters: monstersFor(s, node).map(spawn), turn: 1, energy: ENERGY, block: 0, powers,
    hand: [], draw: shuffle(s, [...s.deck]), discard: [], exhaust: [], combo: 0, heartTide: 0, played: 0,
  };
  drawN(b, s, HAND + (char.passive.drawExtra ?? 0));
  s.battle = b;
  s.phase = 'battle';
  s.longestBattle = Math.max(s.longestBattle, 1);
  note(s, `遭遇${b.monsters.map(m => `「${m.name}」`).join('')}。`);
}

// —— 伤害 ——
type Unit = { hp: number; maxHp: number; block: number; powers: Powers };
function hurt(t: Unit, amount: number) {
  const dmg = t.powers.vulnerable ? exposed(amount) : amount;
  const after = t.block - dmg;
  if (after < 0) { t.block = 0; t.hp = clamp(t.hp + after, 0, t.maxHp); } else t.block = after;
}
/** 玩家视作一个单位：生命在 run 上，格挡与状态在 battle 上。 */
function hurtPlayer(s: LingzhiRun, amount: number) {
  const b = s.battle!, u: Unit = { hp: s.hp, maxHp: s.maxHp, block: b.block, powers: b.powers };
  hurt(u, amount);
  s.hp = u.hp; b.block = u.block;
}
function targets(b: LingzhiBattle, target: string): LingzhiMonster[] {
  if (target === 'allEnemies') return b.monsters;
  const m = b.monsters[Number(target.replace('enemy', ''))];
  return m ? [m] : [];
}
/** 原 resolveAliveTarget：单体目标已倒下时改打第一个还活着的敌人。 */
function aliveTarget(b: LingzhiBattle, target: string | undefined) {
  if (target === 'allEnemies') return target;
  const q = !target || target === 'enemy' ? 'enemy0' : target;
  if (targets(b, q)[0]?.hp > 0) return q;
  const i = b.monsters.findIndex(m => m.hp > 0);
  return i < 0 ? q : `enemy${i}`;
}
function calc(b: LingzhiBattle, base: number) {
  const amount = base + (b.powers.strength ?? 0);
  return b.powers.weak ? weakened(amount) : amount;
}
const firstAlive = (b: LingzhiBattle) => b.monsters.find(m => m.hp > 0);

function cardActions(s: LingzhiRun, card: LingzhiCardDef, target: string | undefined) {
  const b = s.battle!;
  for (const a of card.actions ?? []) {
    switch (a.type) {
      case 'lingzhiCombo': {
        const combo = b.combo > 0 ? b.combo - 1 : 0, extra = combo * a.per, amount = calc(b, extra);
        if (amount > 0) { targets(b, aliveTarget(b, target)).forEach(m => hurt(m, amount)); note(s, `「${card.name}」连击加成 +${extra}（已用攻击牌 ${combo}）`); }
        break;
      }
      case 'drawCards': drawN(b, s, a.amount); break;
      case 'lingzhiShieldSurge': {
        const overflow = Math.max(0, (card.block ?? 0) - (a.cap ?? 12)), enemy = firstAlive(b);
        if (overflow < 1 || !enemy) break;
        const amount = overflow + (b.powers.strength ?? 0);
        targets(b, 'enemy0').forEach(m => hurt(m, amount));
        note(s, `「${card.name}」溢出格挡转伤：对${enemy.name}造成 ${amount} 点伤害`);
        break;
      }
      case 'lingzhiWeak': {
        const q = target && target.includes('enemy') ? target : 'enemy0', stacks = a.amount || 1;
        const ts = targets(b, q);
        if (!ts.length) break;
        ts.forEach(m => { m.powers.weak = (m.powers.weak ?? 0) + stacks; });
        note(s, `「${card.name}」对敌人施加虚弱 ${stacks} 层`);
        break;
      }
      case 'lingzhiHeartTide': {
        b.heartTide += 1;
        const amount = calc(b, a.base + b.heartTide);
        targets(b, target === 'allEnemies' ? 'allEnemies' : (target ?? 'enemy0')).forEach(m => hurt(m, amount));
        note(s, `「${card.name}」心潮涌起（第 ${b.heartTide} 层）：造成 ${amount} 点伤害`);
        break;
      }
      case 'lingzhiSwarm': {
        const count = s.deck.map(c => LINGZHI_CARDS[c.card]).filter(c => c.name.includes('灵') && (c.type === 'attack' || c.damage)).length;
        if (count < 1 || !firstAlive(b)) break;
        const amount = calc(b, count);
        b.monsters.forEach(m => hurt(m, amount));
        note(s, `「${card.name}」灵群共鸣（卡组 ${count} 张灵术牌）：全体 +${count} 伤`);
        break;
      }
    }
  }
}

function playCard(s: LingzhiRun, uid: string, target: string | undefined) {
  const b = s.battle!;
  const inst = b.hand.find(c => c.uid === uid);
  if (!inst) throw new Error('这张牌不在手里。');
  const card = LINGZHI_CARDS[inst.card];
  if (b.energy < card.energy) throw new Error('灵力不足。');
  b.hand = b.hand.filter(c => c.uid !== uid);
  b.energy -= card.energy;
  b.played += 1;
  (card.exhaust ? b.exhaust : b.discard).push(inst);
  const attack = card.type === 'attack' || !!card.damage;
  if (attack) b.combo += 1;
  if (card.block) { b.block += card.block; note(s, `打出「${card.name}」：格挡 +${card.block}`); }
  if (attack) {
    const amount = calc(b, card.damage ?? 0);
    targets(b, aliveTarget(b, card.target === 'allEnemies' ? 'allEnemies' : target)).forEach(m => hurt(m, amount));
    note(s, `打出「${card.name}」造成 ${amount} 点伤害`);
  }
  cardActions(s, card, target);
}

function monsterTurn(s: LingzhiRun, m: LingzhiMonster) {
  const def = MONSTERS[m.def];
  // 守门者二阶段：生命降到阈值时觉醒一次，这一回合只蓄势，不执行原意图
  if (m.difficulty === 'boss' && m.bossPhase === 1 && m.hp > 0 && m.hp <= Math.ceil(m.maxHp * (def.phase2Threshold ?? 0.4))) {
    m.bossPhase = 2;
    m.powers.strength = (m.powers.strength ?? 0) + 3;
    m.block += 10;
    m.intents = def.phase2Intents ?? m.intents;
    m.nextIntent = 0;
    note(s, `「${m.name}」的意识猛然觉醒——「${def.phase2Name ?? m.name}」力量 +3、格挡 +10`);
    return;
  }
  m.block = 0;
  if (m.hp < 1) return;
  if (m.powers.monsterRegen) m.hp = clamp(m.hp + m.powers.monsterRegen, 0, m.maxHp);
  const intent = m.intents[m.nextIntent];
  if (!intent) return;
  m.nextIntent = m.nextIntent === m.intents.length - 1 ? 0 : m.nextIntent + 1;
  const b = s.battle!;
  if (intent.block) { m.block += intent.block; note(s, `「${m.name}」蓄力防御：格挡 +${intent.block}`); }
  if (intent.strength) { m.powers.strength = (m.powers.strength ?? 0) + intent.strength; note(s, `「${m.name}」汇聚力量：攻击 +${intent.strength}`); }
  if (intent.damage) {
    let amount = intent.damage + (m.powers.strength ?? 0);
    if (m.powers.weak) amount = weakened(amount);
    hurtPlayer(s, amount);
    note(s, `「${m.name}」对你造成 ${amount} 点伤害`);
  }
  if (intent.vulnerable) { b.powers.vulnerable = (b.powers.vulnerable ?? 0) + intent.vulnerable + 1; note(s, `「${m.name}」使你易伤 +${intent.vulnerable}`); }
  if (intent.weak) { b.powers.weak = (b.powers.weak ?? 0) + intent.weak + 1; note(s, `「${m.name}」使你虚弱 +${intent.weak}`); }
}

const decay = (p: Powers, keep: string[]) => { for (const [k, v] of Object.entries(p)) if (v && v > 0 && !keep.includes(k)) p[k as keyof Powers] = v - 1; };

function endTurn(s: LingzhiRun) {
  const b = s.battle!;
  b.discard.push(...b.hand);
  b.hand = [];
  if (b.powers.regen) s.hp = clamp(s.hp + b.powers.regen, 0, s.maxHp);
  for (const m of b.monsters) monsterTurn(s, m);
  decay(b.powers, ['strength', 'regen']);
  b.monsters.forEach(m => decay(m.powers, ['strength', 'monsterRegen']));
  b.turn += 1;
  b.energy = ENERGY;
  b.block = 0;
  b.played = 0;
  s.longestBattle = Math.max(s.longestBattle, b.turn);
  drawN(b, s, HAND);
}

/** 原 getLingzhiCardRewards：已解锁且不在牌组里的卡；不够时先回退为全部已解锁，再用整个卡池补足。 */
function rewardOffers(s: LingzhiRun, amount: number) {
  const unlocked = LINGZHI.cards.filter(c => LINGZHI.defaultCards.includes(c.cardId));
  const owned = new Set(s.deck.map(c => LINGZHI_CARDS[c.card].name));
  let pool = unlocked.filter(c => !owned.has(c.name));
  if (!pool.length) pool = unlocked;
  if (pool.length < amount) pool = [...pool, ...LINGZHI.cards.filter(c => !pool.includes(c))];
  return shuffle(s, [...pool]).slice(0, amount).map(c => c.cardId);
}

/** 出牌或结束回合之后：判定战斗胜负、通关。 */
function settle(s: LingzhiRun) {
  const b = s.battle;
  if (!b) return;
  if (s.hp < 1) { s.phase = 'defeat'; note(s, '灵质散去，这次修行到此为止。'); return; }
  if (b.monsters.some(m => m.hp > 0)) return;
  s.battlesWon += 1;
  s.battle = null;
  const node = s.nodes.find(n => n.floor === s.floor && n.lane === s.lane)!;
  if (node.kind === 'boss') { s.phase = 'victory'; note(s, '守门者倒下，灵质回路豁然贯通。'); return; }
  s.offers = rewardOffers(s, node.kind === 'elite' ? 4 : 3);
  s.phase = 'reward';
}

export function reduceLingzhi(previous: LingzhiRun, action: LingzhiAction): LingzhiRun {
  const s = structuredClone(previous);
  switch (action.type) {
    case 'enter': {
      const node = availableNodes(s).find(n => n.id === action.node);
      if (!node) throw new Error('现在去不了那里。');
      s.floor = node.floor; s.lane = node.lane; s.visited.push(node.id);
      if (node.kind === 'battle' || node.kind === 'elite' || node.kind === 'boss') startBattle(s, node);
      else if (node.kind === 'rest') s.phase = 'rest';
      else s.phase = 'quiet';
      break;
    }
    case 'play':
      if (s.phase !== 'battle') throw new Error('现在不在战斗中。');
      playCard(s, action.uid, action.target);
      settle(s);
      break;
    case 'end':
      if (s.phase !== 'battle') throw new Error('现在不在战斗中。');
      endTurn(s);
      settle(s);
      break;
    case 'reward':
      if (s.phase !== 'reward') throw new Error('现在没有可选的奖励。');
      if (action.card !== null) {
        if (!s.offers.includes(action.card)) throw new Error('这张牌不在奖励里。');
        s.deck.push(instance(s, action.card));
        note(s, `把「${LINGZHI_CARDS[action.card].name}」收入牌组。`);
      }
      s.offers = []; s.phase = 'map';
      break;
    case 'rest':
      if (s.phase !== 'rest') throw new Error('这里不能休整。');
      if (action.choice === 'heal') { const heal = Math.floor(s.maxHp * 0.3); s.hp = clamp(s.hp + heal, 0, s.maxHp); note(s, `静坐调息，回复 ${heal} 点生命。`); }
      else {
        if (!s.deck.some(c => c.uid === action.uid)) throw new Error('牌组里没有这张牌。');
        s.deck = s.deck.filter(c => c.uid !== action.uid);
        note(s, '舍去了一张灵术。');
      }
      s.phase = 'map';
      break;
    case 'continue':
      if (s.phase !== 'quiet') throw new Error('现在不能继续前行。');
      s.phase = 'map';
      break;
  }
  return s;
}

export function canPlay(s: LingzhiRun, c: LingzhiCard) { return s.phase === 'battle' && !!s.battle && s.battle.energy >= LINGZHI_CARDS[c.card].energy; }

/** 敌人下一步意图的文字（与原界面一致：攻击/格挡/力量/易伤/虚弱）。 */
export function lingzhiIntentText(m: LingzhiMonster): string[] {
  const i = m.intents[m.nextIntent];
  if (!i) return [];
  const parts: string[] = [];
  if (i.damage) { let d = i.damage + (m.powers.strength ?? 0); if (m.powers.weak) d = weakened(d); parts.push(`攻击 ${d}`); }
  if (i.block) parts.push(`格挡 ${i.block}`);
  if (i.strength) parts.push(`力量 +${i.strength}`);
  if (i.vulnerable) parts.push(`易伤 ${i.vulnerable}`);
  if (i.weak) parts.push(`虚弱 ${i.weak}`);
  return parts;
}
