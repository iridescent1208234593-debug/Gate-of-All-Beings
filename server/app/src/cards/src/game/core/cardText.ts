import type { Card, Effect } from './types';
export function effectText(e: Effect) {
  const labels: Record<string,string> = {damage:'伤害',block:'格挡',draw:'抽牌',energy:'灵力',strength:'力量',weak:'虚弱',vulnerable:'易伤',poison:'侵蚀',summon:'木灵',domain:'守护',heal:'恢复',regen:'回灵',healthCost:'消耗生命',reduceAttack:'降低敌方攻击',drawBelowHalf:'半血以下额外抽牌'};
  return Object.entries(e).map(([k,v])=>k==='damageFromBlock'?'造成等同当前格挡的伤害':k==='damageFromDebuffs'?`每层虚弱与易伤造成 ${v} 伤害`:k==='clearTargetDebuffs'?'清除目标虚弱与易伤':`${labels[k]||k} ${v}`).join(' · ');
}
export function cardText(c: Card) {
  return `${c.condition==='belowHalf'?'生命低于一半可用。':c.condition==='attacksOnly'?'手牌全为攻击牌时可用。':''}${c.target==='all'?'作用于所有敌人。':''}${effectText(c.effect)}${c.exhaust?'。消耗。':'。'}`;
}
