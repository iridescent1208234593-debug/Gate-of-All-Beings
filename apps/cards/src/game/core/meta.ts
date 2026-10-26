import { receiveEcoExchange } from '@lxh/shared-types/exchange';
import type { HeroId, MetaState, RunState, TimelineAnchor } from './types';
export function createMeta(): MetaState { return {version:1,day:1,spirit:24,herbs:6,garden:1,characters:{xiaohei:{bond:0,sealed:false,assignment:'garden'},wuxian:{bond:0,sealed:false,assignment:'practice'},fengxi:{bond:0,sealed:false,assignment:'rest'}},timeline:{id:'local',revision:1,events:[{id:'tea-break',title:'林间茶歇',floor:3,effect:'heal',amount:6},{id:'old-friend',title:'故友的赠礼',floor:6,effect:'gold',amount:15}]},claimedRuns:[]}; }
export function advanceDay(meta: MetaState): MetaState {const m=structuredClone(meta);m.day++;for(const c of Object.values(m.characters)){if(c.assignment==='garden'){m.herbs+=m.garden*2;c.bond+=1;}if(c.assignment==='practice'){c.bond+=3;}if(c.assignment==='rest')m.spirit+=4;}m.spirit+=2;return m;}
export function sealCharacter(meta: MetaState, id: HeroId): MetaState {const m=structuredClone(meta);const c=m.characters[id];if(c.bond<9||m.spirit<12||c.sealed)throw new Error('封灵需要 9 点默契和 12 灵质。');m.spirit-=12;c.sealed=true;return m;}
export const REVIVE_MS=5*60*60*1000;
export const DEFEAT_DROP=0.25;
export type HeroState='healthy'|'wounded'|'dead';
export function heroState(meta: MetaState, id: HeroId): HeroState {const d=meta.characters[id].deaths??0;return d>=2?'dead':d===1?'wounded':'healthy';}
export function allHeroesDead(meta: MetaState): boolean {return (Object.keys(meta.characters) as HeroId[]).every(id=>heroState(meta,id)==='dead');}
/** 全员阵亡满五小时后，所有同行者恢复如初；返回原对象表示无需刷新。 */
export function reviveIfDue(meta: MetaState, now=Date.now()): MetaState {
  if(!allHeroesDead(meta))return meta;
  if(meta.allDeadAt===undefined){return {...meta,allDeadAt:now};}
  if(now-meta.allDeadAt<REVIVE_MS)return meta;
  const m=structuredClone(meta);delete m.allDeadAt;
  for(const c of Object.values(m.characters)){c.deaths=0;delete c.woundDeck;delete c.woundRelics;}
  return m;
}
export function reviveRemaining(meta: MetaState, now=Date.now()): number {return meta.allDeadAt===undefined?REVIVE_MS:Math.max(0,meta.allDeadAt+REVIVE_MS-now);}
export function claimRun(meta: MetaState, run: RunState, now=Date.now()): MetaState {
  if(run.mode==='rebirth'||run.hero==='seeker')return meta;
  const key=`${run.hero}:${run.seed}`;if(!['victory','defeat'].includes(run.phase)||meta.claimedRuns.includes(key))return meta;
  const m=structuredClone(meta);m.claimedRuns.push(key);const c=m.characters[run.hero];
  if(run.phase==='victory'){m.spirit+=20;c.bond+=6;return m;}
  // 战败：掉落部分资源；首次重伤（牌组保留），再次阵亡则不能再选。
  m.spirit-=Math.floor(m.spirit*DEFEAT_DROP);m.herbs-=Math.floor(m.herbs*DEFEAT_DROP);m.food&&(m.food-=Math.floor(m.food*DEFEAT_DROP));
  c.bond+=2;c.deaths=(c.deaths??0)+1;
  c.woundDeck=structuredClone(run.deck);c.woundRelics=[...run.relics];
  if(allHeroesDead(m))m.allDeadAt=now;
  return m;
}
export function validateTimeline(value: unknown): TimelineAnchor {
  if(!value||typeof value!=='object')throw new Error('时间线必须是一个对象。');
  const t=value as TimelineAnchor;if(!Array.isArray(t.events)||t.events.length>12)throw new Error('时间线最多容纳 12 个事件。');
  const ids=new Set<string>();for(const e of t.events){if(typeof e.id!=='string'||!e.id||ids.has(e.id)||typeof e.title!=='string'||!e.title.trim()||e.title.length>40||!Number.isInteger(e.floor)||e.floor<1||e.floor>10||!['heal','gold','growth'].includes(e.effect)||!Number.isInteger(e.amount)||e.amount<1||e.amount>20)throw new Error('事件需要唯一编号、1–10 层、1–20 数值，以及有效的标题和效果。');ids.add(e.id);}
  return {id:'local',revision:Number.isInteger(t.revision)&&t.revision>=1?t.revision:1,events:structuredClone(t.events)};
}

export function claimEcology(meta: MetaState, value: unknown): MetaState {
  const {packet,receipts}=receiveEcoExchange(meta,value);
  const individuals=new Map((meta.ecoIndividuals||[]).map(i=>[i.id,i]));
  for(const i of packet.individuals||[])if(!individuals.has(i.id))individuals.set(i.id,i);
  if(individuals.size>512)throw new Error('当前存档最多收录 512 个生态个体，请先导出备份。');
  // Version 1 retains the old daily-hall behavior; version 2 sends goods exclusively to the 3D base.
  const legacy=packet.schemaVersion===1?packet.resources:{spirit:0,herb:0,food:0};
  return {...meta,ecoReceipts:receipts,spirit:meta.spirit+legacy.spirit,
    herbs:meta.herbs+legacy.herb,food:(meta.food||0)+legacy.food,ecoIndividuals:[...individuals.values()],
    ecoCards:[...new Set([...(meta.ecoCards||[]),...packet.species.map(s=>s.id),...[...individuals.keys()]])]};
}
