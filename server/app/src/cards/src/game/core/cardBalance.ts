import type {Card, Effect} from './types';
import {cardText} from './cardText';

export const EFFECT_FIELDS: {key:keyof Effect; label:string; max:number; help:string}[] = [
  {key:'damage',label:'伤害',max:999,help:'基础伤害，加上力量后结算；受到目标格挡和易伤影响。精进 +3。'},
  {key:'block',label:'格挡',max:999,help:'抵消敌方伤害，下个己方回合重置为领域提供的格挡。精进 +3。'},
  {key:'draw',label:'抽牌',max:10,help:'立即抽牌，手牌最多 10 张。精进 +1。'},
  {key:'energy',label:'获得灵力',max:20,help:'本回合立即增加可用灵力；下个回合重置为 3。精进 +1。'},
  {key:'strength',label:'力量',max:99,help:'本场持续增加每次伤害结算的数值。精进 +1。'},
  {key:'weak',label:'虚弱回合',max:99,help:'敌方攻击伤害降低 25%，每次敌方行动后减少 1。'},
  {key:'vulnerable',label:'易伤回合',max:99,help:'目标受到的攻击伤害增加 50%，敌方行动后减少 1。'},
  {key:'poison',label:'侵蚀层数',max:999,help:'敌方行动前扣除等于层数的生命，无视格挡，随后减少 1 层。'},
  {key:'summon',label:'木灵',max:999,help:'每次结束回合对首个存活敌人造成伤害。精进 +1。'},
  {key:'domain',label:'领域守护',max:999,help:'下个己方回合开始获得对应格挡，本场持续。精进 +1。'},
  {key:'heal',label:'恢复生命',max:999,help:'立即恢复生命，不超过生命上限。精进 +2。'},
  {key:'regen',label:'回灵',max:99,help:'存活进入下个回合时恢复相应生命，然后减少 1 层。'},
  {key:'damageFromBlock',label:'格挡转伤害',max:1,help:'1 为启用，0 为关闭。额外造成等同出牌前格挡的伤害，不消耗格挡。'},
  {key:'damageFromDebuffs',label:'每层负面追加伤害',max:99,help:'目标身上每层虚弱与易伤各追加此数值的伤害。'},
  {key:'clearTargetDebuffs',label:'清除目标负面',max:1,help:'1 为启用，0 为关闭。伤害结算后清除目标原有虚弱与易伤。'},
  {key:'healthCost',label:'生命消耗',max:999,help:'出牌时扣除生命；当前生命必须严格大于该数值。'},
  {key:'reduceAttack',label:'降低敌方攻击',max:999,help:'降低目标本场基础攻击，最低为 0。'},
  {key:'drawBelowHalf',label:'半血额外抽牌',max:10,help:'出牌前生命低于上限一半时，额外抽取的牌数。'},
];
export interface CardBalance {cost:number; effect:Effect; exhaust:boolean; target:'single'|'all'; condition:'none'|'belowHalf'|'attacksOnly'}
export type CardOverrides=Record<string,CardBalance>;
export function balanceOf(card:Card):CardBalance {return {cost:card.cost,effect:{...card.effect},exhaust:!!card.exhaust,target:card.target||'single',condition:card.condition||'none'};}
export function validateBalance(value:unknown):CardBalance {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('卡牌配置必须是对象。');
  const v=value as Record<string,unknown>;
  if(Object.keys(v).some(k=>!['cost','effect','exhaust','target','condition'].includes(k)))throw new Error('包含不支持的卡牌字段。');
  if(!Number.isInteger(v.cost)||(v.cost as number)<0||(v.cost as number)>10)throw new Error('灵力消耗必须是 0–10 的整数。');
  if(typeof v.exhaust!=='boolean'||!['single','all'].includes(v.target as string)||!['none','belowHalf','attacksOnly'].includes(v.condition as string))throw new Error('目标、消耗或出牌条件无效。');
  if(!v.effect||typeof v.effect!=='object'||Array.isArray(v.effect))throw new Error('效果配置无效。');
  const effect:Effect={};
  for(const [key,n] of Object.entries(v.effect)){
    const field=EFFECT_FIELDS.find(f=>f.key===key);
    if(!field)throw new Error(`不支持的效果：${key}`);
    if(!Number.isInteger(n)||n<0||n>field.max)throw new Error(`${field.label}必须是 0–${field.max} 的整数。`);
    if(n>0)effect[field.key]=n;
  }
  return {cost:v.cost as number,effect,exhaust:v.exhaust,target:v.target as CardBalance['target'],condition:v.condition as CardBalance['condition']};
}
export function applyBalance(card:Card,value?:CardBalance):Card {
  if(!value)return {...card,effect:{...card.effect}};
  const next:Card={...card,...value,effect:{...value.effect},condition:value.condition==='none'?undefined:value.condition};
  next.text=cardText(next);return next;
}
