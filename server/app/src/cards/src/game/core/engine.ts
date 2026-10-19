import { CARDS, HEROES, pool } from './content';
import type { Action, Battle, WoundCarry, CardInstance, Enemy, HeroId, NodeKind, RunState, TimelineAnchor } from './types';
function random(s: RunState) { s.rng = (Math.imul(s.rng,1664525)+1013904223)>>>0; return s.rng/4294967296; }
function shuffle<T>(s: RunState, a: T[]) { for(let i=a.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function instance(s: RunState, card: string): CardInstance { return {uid:`c${s.nextId++}`,card,upgraded:false}; }
function note(s: RunState, text: string) { s.messages=[...s.messages.slice(-11),text]; }
function draw(s: RunState, count: number) { const b=s.battle!; for(let i=0;i<count && b.hand.length<10;i++){ if(!b.draw.length) b.draw=shuffle(s,b.discard.splice(0)); const c=b.draw.pop(); if(c)b.hand.push(c); } }
function offers(s: RunState) { return shuffle(s,pool(s.hero,s.ecoCards).map(c=>c.id)).slice(0,3); }
export function createRun(hero: HeroId, seed: number, sealed=false, ecoCards: string[] = [], wound?: WoundCarry): RunState {
  const hp=wound?Math.max(1,Math.floor(HEROES[hero].hp/2)):HEROES[hero].hp;
  const s: RunState={ecoCards:ecoCards.filter(id=>id.startsWith("eco-")&&CARDS[id]),version:1,seed:seed>>>0,rng:seed>>>0,hero,phase:'map',hp,maxHp:hp,gold:65,floor:-1,lane:1,nodes:[],visited:[],deck:[],relics:[HEROES[hero].relic],battle:null,offers:[],removed:false,log:[],messages:['穿过众生之门，新的旅途开始了。'],nextId:1};
  for(let f=0;f<10;f++)for(let l=0;l<3;l++){
    const choices: NodeKind[]=['battle','battle','event','shop','rest','elite'];
    const kind: NodeKind = f===9?'boss':f===0?'battle':f===8?'rest':choices[Math.floor(random(s)*choices.length)];
    if(f===9 && l!==1)continue;
    s.nodes.push({id:`${f}-${l}`,floor:f,lane:l,kind});
  }
  if(wound){
    // 重伤：原牌组与遗物保留，生命上限减半。
    s.deck=structuredClone(wound.deck);s.relics=[...wound.relics];
    s.nextId=Math.max(s.nextId,...s.deck.map(c=>Number(c.uid.slice(1))+1||0));
    s.messages=['带着旧伤再次启程，生命上限减半。'];
  } else {s.deck=HEROES[hero].starter.map(c=>instance(s,c)); if(sealed)s.deck.push(instance(s,'seal'));}
  return s;
}
export function availableNodes(s: RunState) { return s.nodes.filter(n=>n.floor===s.floor+1 && (s.floor<0 || n.kind==='boss' || Math.abs(n.lane-s.lane)<=1)); }
export function effectOf(c: CardInstance) { const e={...CARDS[c.card].effect}; if(c.upgraded) { if(e.damage)e.damage+=3; if(e.block)e.block+=3; if(e.heal)e.heal+=2; if(e.summon)e.summon+=1; if(e.domain)e.domain+=1; if(e.strength)e.strength+=1; if(e.draw)e.draw+=1; if(e.energy)e.energy+=1; } return e; }
export function enemyDamage(e: Enemy) { return e.weak>0?Math.floor(e.damage*.75):e.damage; }
function hit(e: Enemy, damage: number) { damage=Math.floor(damage*((e.vulnerable??0)>0?1.5:1)); const n=Math.max(0,damage-e.block); e.block=Math.max(0,e.block-damage); e.hp=Math.max(0,e.hp-n); }
function victory(s: RunState) {
  if(!s.battle!.enemies.every(e=>e.hp<=0))return false;
  const kind=s.nodes.find(n=>n.id===s.visited.at(-1))!.kind;
  s.gold+=kind==='elite'?45:25; if(s.hero==='fengxi')s.hp=Math.min(s.maxHp,s.hp+4);
  if(kind==='elite' && !s.relics.includes('青玉护符'))s.relics.push('青玉护符');
  s.phase=kind==='boss'?'victory':'reward'; s.offers=offers(s); note(s,kind==='boss'?'试炼完成。带着这段记忆，回到会馆吧。':'战斗胜利，选择一张牌继续旅程。'); return true;
}
function beginBattle(s: RunState, kind: NodeKind) {
  const boss=kind==='boss',elite=kind==='elite';
  const hp=boss?115:elite?52+s.floor*3:23+s.floor*3;
  const make=(id:string,name:string,h:number):Enemy=>({id,name,hp:h,maxHp:h,block:0,weak:0,poison:0,intent:'attack',damage:boss?15:elite?11:6+Math.floor(s.floor/2)});
  const enemies=[make('e1',boss?'界门守卫':elite?'古树灵卫':['迷途石灵','躁动木灵','山间游灵'][Math.floor(random(s)*3)],hp)];
  if(!boss&&!elite&&s.floor>=3)enemies.push(make('e2','随行灵体',18+s.floor));
  s.battle={turn:1,energy:3,block:s.relics.includes('青玉护符')?5:0,strength:s.hero==='wuxian'?1:0,summon:0,domain:0,hand:[],draw:shuffle(s,structuredClone(s.deck)),discard:[],exhaust:[],enemies};
  s.phase='battle'; draw(s,s.hero==='xiaohei'?6:5); note(s,'你的回合。先看敌方意图，再决定攻守。');
}
export function reduceRun(previous: RunState, action: Action, timeline?: TimelineAnchor): RunState {
  const s=structuredClone(previous); const b=s.battle;
  const require=(ok: unknown,message='当前不能进行这个操作。')=>{if(!ok)throw new Error(message);};
  if(action.type==='enter') {
    require(s.phase==='map'); const node=availableNodes(s).find(n=>n.id===action.node); require(node,'请选择与当前路径相连的节点。');
    s.floor=node!.floor;s.lane=node!.lane;s.visited.push(node!.id);s.removed=false;
    for(const ev of timeline?.events.filter(e=>e.floor===s.floor+1)??[]) {
      if(ev.effect==='heal')s.hp=Math.min(s.maxHp,s.hp+ev.amount);
      if(ev.effect==='gold')s.gold+=ev.amount;
      if(ev.effect==='growth'){s.maxHp+=ev.amount;s.hp+=ev.amount;}
      note(s,`时间线 · ${ev.title}`);
    }
    if(['battle','elite','boss'].includes(node!.kind))beginBattle(s,node!.kind);
    else {s.phase=node!.kind as 'rest'|'event'|'shop';s.battle=null;if(s.phase==='shop')s.offers=offers(s);}
  } else if(action.type==='play') {
    require(s.phase==='battle'&&b); const idx=b!.hand.findIndex(c=>c.uid===action.uid); require(idx>=0,'这张牌已经不在手中。');
    const c=b!.hand[idx], card=CARDS[c.card]; require(b!.energy>=card.cost,'灵力不足。');
    require(canPlayCard(s,c), '这张牌的出牌条件尚未满足。');
    const target=b!.enemies.find(e=>e.id===action.target && e.hp>0); const e=effectOf(c);
    const offensive=!!(e.damage||e.weak||e.poison||e.vulnerable||e.damageFromBlock||e.damageFromDebuffs||e.reduceAttack);
    require(!offensive||card.target==='all'||target,'请选择仍在场的敌人。');
    const targets=card.target==='all'?b!.enemies.filter(e=>e.hp>0):target?[target]:[];
    const lowHealth=s.hp<s.maxHp/2;
    b!.energy-=card.cost; b!.hand.splice(idx,1);
    s.hp-=e.healthCost??0;
    for(const enemy of targets){
      const damage=(e.damage??0)+(e.damageFromBlock?b!.block:0)+(e.damageFromDebuffs?((enemy.weak??0)+(enemy.vulnerable??0))*e.damageFromDebuffs:0);
      if(damage)hit(enemy,damage+b!.strength);
      if(e.clearTargetDebuffs){enemy.weak=0;enemy.vulnerable=0;}
      enemy.weak+=e.weak??0;enemy.poison+=e.poison??0;
      enemy.vulnerable=(enemy.vulnerable??0)+(e.vulnerable??0);
      enemy.damage=Math.max(0,enemy.damage-(e.reduceAttack??0));
    }
    b!.block+=e.block??0;b!.energy+=e.energy??0;b!.strength+=e.strength??0;b!.summon+=e.summon??0;b!.domain+=e.domain??0;b!.regen=(b!.regen??0)+(e.regen??0);
    s.hp=Math.min(s.maxHp,s.hp+(e.heal??0));
    const drawCount=(e.draw??0)+(lowHealth?(e.drawBelowHalf??0):0);
    if(drawCount)draw(s,drawCount); (card.exhaust?b!.exhaust:b!.discard).push(c);
    note(s,`${card.name}${c.upgraded?' · 精进':''}${e.damage?` → ${card.target==='all'?'全体敌人':target!.name}`:''}`); victory(s);
  } else if(action.type==='end') {
    require(s.phase==='battle'&&b);
    const first=b!.enemies.find(e=>e.hp>0);if(first&&b!.summon)hit(first,b!.summon);
    for(const e of b!.enemies)if(e.hp>0&&e.poison){e.hp=Math.max(0,e.hp-e.poison);e.poison--;}
    if(!victory(s)) {
      for(const e of b!.enemies.filter(e=>e.hp>0)) {
        e.block=0;
        if(e.intent==='attack'){const d=enemyDamage(e);const loss=Math.max(0,d-b!.block);b!.block=Math.max(0,b!.block-d);s.hp=Math.max(0,s.hp-loss);note(s,`${e.name}攻击，你受到 ${loss} 点伤害。`);}
        else {e.block=8;note(s,`${e.name}获得 8 点格挡。`);}
        e.weak=Math.max(0,e.weak-1);e.vulnerable=Math.max(0,(e.vulnerable??0)-1);e.intent=b!.turn%3===1?'guard':'attack';
      }
      if(s.hp<=0){s.phase='defeat';note(s,'旅途暂告一段落，回馆休整后再出发。');}
      else {s.hp=Math.min(s.maxHp,s.hp+(b!.regen??0));b!.regen=Math.max(0,(b!.regen??0)-1);b!.discard.push(...b!.hand.splice(0)); b!.turn++;b!.energy=3;b!.block=b!.domain;draw(s,5);}
    }
  } else if(action.type==='reward') {
    require(s.phase==='reward');require(action.card===null||s.offers.includes(action.card));if(action.card)s.deck.push(instance(s,action.card));s.phase='map';s.battle=null;s.offers=[];
  } else if(action.type==='rest') {
    require(s.phase==='rest');if(action.choice==='heal')s.hp=Math.min(s.maxHp,s.hp+Math.ceil(s.maxHp*.3));
    else {const c=s.deck.find(c=>c.uid===action.uid&&!c.upgraded);require(c,'请选择尚未精进的卡牌。');c!.upgraded=true;}
    s.phase='map';
  } else if(action.type==='event') {
    require(s.phase==='event');if(action.choice==='help'){require(s.hp>7,'生命不足，无法帮助灵体。');s.hp-=7;s.gold+=35;s.deck.push(instance(s,'tea'));}s.phase='map';
  } else if(action.type==='buy') {
    require(s.phase==='shop'&&s.offers.includes(action.card));require(s.gold>=45,'灵石不足。');s.gold-=45;s.deck.push(instance(s,action.card));s.offers=s.offers.filter(c=>c!==action.card);
  } else if(action.type==='remove') {
    require(s.phase==='shop'&&!s.removed&&s.gold>=35&&s.deck.length>5);const index=s.deck.findIndex(c=>c.uid===action.uid);require(index>=0);s.deck.splice(index,1);s.gold-=35;s.removed=true;
  } else if(action.type==='leave') {require(s.phase==='shop');s.phase='map';}
  s.log.push({sequence:s.log.length+1,action:structuredClone(action)}); return s;
}
export function replay(hero: HeroId, seed: number, actions: Action[], timeline?: TimelineAnchor, sealed=false, ecoCards: string[] = []) { return actions.reduce((s,a)=>reduceRun(s,a,timeline),createRun(hero,seed,sealed,ecoCards)); }

export function canPlayCard(s: RunState,c: CardInstance): boolean {
  const card=CARDS[c.card]; const b=s.battle;
  if(s.phase!=='battle'||!b||!card||card.cost>b.energy)return false;
  if(s.hp <= (card.effect.healthCost??0))return false;
  if(card.condition==='belowHalf' && s.hp>=s.maxHp/2)return false;
  if(card.condition==='attacksOnly' && b.hand.some(x=>CARDS[x.card].type!=='攻击'))return false;
  return true;
}
