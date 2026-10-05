import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableNodes, createRun, reduceRun, replay, canPlayCard } from './engine';
import { CARDS, HEROES } from './content';
import { advanceDay, claimRun, createMeta, sealCharacter, validateTimeline, claimEcology } from './meta';
import type { HeroId, RunState } from './types';
const battle=(hero:HeroId='xiaohei')=>reduceRun(createRun(hero,1234),{type:'enter',node:'0-1'});
test('all heroes produce reproducible, connected ten-floor maps',()=>{
  for(const hero of Object.keys(HEROES) as HeroId[])for(let seed=0;seed<50;seed++){
    const s=createRun(hero,seed);assert.deepEqual(s,createRun(hero,seed));assert.equal(s.deck.length,10);
    for(const n of s.nodes.filter(n=>n.floor<9))assert.ok(availableNodes({...s,floor:n.floor,lane:n.lane}).length>0);
  }
});
test('illegal moves fail without modifying the state',()=>{const s=createRun('wuxian',42);const copy=structuredClone(s);assert.throws(()=>reduceRun(s,{type:'enter',node:'9-1'}));assert.deepEqual(s,copy);assert.throws(()=>reduceRun(s,{type:'play',uid:'c1',target:'e1'}));});
test('cards require sufficient energy and a living target',()=>{const s=battle();s.battle!.energy=0;const c=s.battle!.hand.find(c=>CARDS[c.card].cost>0)!;assert.throws(()=>reduceRun(s,{type:'play',uid:c.uid,target:'e1'}));s.battle!.energy=3;s.battle!.hand=[{uid:'hit',card:'claw',upgraded:false}];assert.throws(()=>reduceRun(s,{type:'play',uid:'hit',target:'no-enemy'}));});
test('block absorbs damage and resets; weakness lasts enemy turns',()=>{const s=battle();s.battle!.enemies[0].weak=2;s.battle!.block=3;const n=reduceRun(s,{type:'end'});assert.equal(n.hp,s.hp-1);assert.equal(n.battle!.block,0);assert.equal(n.battle!.energy,3);assert.equal(n.battle!.enemies[0].weak,1);assert.equal(s.battle!.turn,1);});
test('exhaust cards do not recycle and draw cannot draw itself',()=>{const s=battle();s.battle!.hand=[{uid:'flow',card:'flow',upgraded:false}];s.battle!.draw=[];s.battle!.discard=[];const n=reduceRun(s,{type:'play',uid:'flow',target:'e1'});assert.equal(n.battle!.hand.length,0);assert.equal(n.battle!.exhaust.length,1);assert.equal(n.battle!.energy,4);});
test('summon kill prevents enemy damage and reward can only be claimed once',()=>{const s=battle('fengxi');s.battle!.enemies[0].hp=2;s.battle!.summon=3;const n=reduceRun(s,{type:'end'});assert.equal(n.phase,'reward');assert.equal(n.hp,s.hp);const reward=reduceRun(n,{type:'reward',card:n.offers[0]});assert.equal(reward.deck.length,11);assert.throws(()=>reduceRun(reward,{type:'reward',card:n.offers[0]}));});
test('poison bypasses block, dead enemies never attack',()=>{const s=battle();s.battle!.enemies[0].hp=2;s.battle!.enemies[0].poison=3;s.battle!.enemies[0].block=99;assert.equal(reduceRun(s,{type:'end'}).phase,'reward');});
test('shop refuses overspending, double purchase and repeated removal',()=>{const s=createRun('xiaohei',1);s.phase='shop';s.offers=['rift'];s.gold=80;let n=reduceRun(s,{type:'buy',card:'rift'});assert.equal(n.gold,35);assert.throws(()=>reduceRun(n,{type:'buy',card:'rift'}));n=reduceRun(n,{type:'remove',uid:n.deck[0].uid});assert.equal(n.gold,0);assert.equal(n.deck.length,10);assert.throws(()=>reduceRun(n,{type:'remove',uid:n.deck[0].uid}));});
test('rest upgrade and healing are mutually exclusive',()=>{const s=createRun('wuxian',1);s.phase='rest';const n=reduceRun(s,{type:'rest',choice:'upgrade',uid:s.deck[0].uid});assert.ok(n.deck[0].upgraded);assert.throws(()=>reduceRun(n,{type:'rest',choice:'heal'}));});
test('timeline validates untrusted input and applies only entered floors',()=>{assert.throws(()=>validateTimeline({events:[{id:'a',title:'a',floor:99,effect:'gold',amount:1}]}));const t=validateTimeline({events:[{id:'a',title:'gift',floor:1,effect:'gold',amount:5}]});const s=createRun('xiaohei',1);const n=reduceRun(s,{type:'enter',node:'0-1'},t);assert.equal(n.gold,70);});
test('companionship and sealing feed into starting deck, settlement cannot double claim',()=>{let m=createMeta();for(let i=0;i<3;i++)m=advanceDay(m);m=sealCharacter(m,'wuxian');assert.ok(m.characters.wuxian.sealed);assert.throws(()=>sealCharacter(m,'wuxian'));assert.equal(createRun('wuxian',3,true).deck.length,11);const s=createRun('wuxian',3);s.phase='victory';const n=claimRun(m,s);assert.deepEqual(claimRun(n,s),n);});
function simulate(hero:HeroId,seed:number):RunState {
  let s=createRun(hero,seed);let steps=0;
  while(!['victory','defeat'].includes(s.phase)&&steps++<1500){
    if(s.phase==='map'){const nodes=availableNodes(s);const n=nodes.find(n=>n.kind==='rest'&&s.hp<s.maxHp*.7)??nodes.find(n=>n.kind==='event')??nodes.find(n=>n.kind==='battle')??nodes[0];s=reduceRun(s,{type:'enter',node:n.id});}
    else if(s.phase==='battle'){
      const b=s.battle!;const target=b.enemies.find(e=>e.hp>0)!;
      const choices=b.hand.filter(c=>canPlayCard(s,c)).sort((a,c)=>{
        const score=(id:string)=>{const e=CARDS[id].effect;return (e.summon??0)*3+(e.strength??0)*4+(e.energy??0)*7+(e.damage??0)+(e.block??0)*.6+(e.draw??0)*4;};return score(c.card)-score(a.card);
      });
      s=reduceRun(s,choices[0]?{type:'play',uid:choices[0].uid,target:target.id}:{type:'end'});
    }else if(s.phase==='reward')s=reduceRun(s,{type:'reward',card:s.offers[0]});
    else if(s.phase==='rest')s=reduceRun(s,{type:'rest',choice:'heal'});
    else if(s.phase==='event')s=reduceRun(s,{type:'event',choice:'leave'});
    else if(s.phase==='shop')s=reduceRun(s,{type:'leave'});
    assert.ok(s.hp>=0&&s.hp<=s.maxHp);assert.ok(s.gold>=0);if(s.battle)assert.ok(s.battle.energy>=0);
  }
  assert.ok(steps<1500,'run must terminate');return s;
}
test('90 complete automated adventures terminate, preserve invariants and replay exactly',()=>{
  for(const hero of Object.keys(HEROES) as HeroId[]){let wins=0;for(let seed=1;seed<=30;seed++){const s=simulate(hero,seed);if(s.phase==='victory')wins++;assert.deepEqual(replay(hero,seed,s.log.map(l=>l.action)),s);}console.log(`${hero}: ${wins}/30 completed by basic strategy bot`);assert.ok(wins>0,`${hero} must have a winnable seed`);}
});

test('all 70 migrated cards are typed data with executable effects',()=>{
  const cards=Object.values(CARDS).filter(c=>c.id.startsWith('legacy-'));
  assert.equal(cards.length,70);
  for(const card of cards){
    const s=battle();s.hp=20;s.battle!.energy=10;
    s.battle!.hand=[{uid:'legacy',card:card.id,upgraded:false}];
    assert.ok(canPlayCard(s,s.battle!.hand[0]),card.name);
    const n=reduceRun(s,{type:'play',uid:'legacy',target:'e1'});
    assert.ok(n.hp>=0&&n.hp<=n.maxHp,card.name);
    assert.ok(n.battle!.enemies.every(e=>Number.isFinite(e.hp)&&e.hp>=0),card.name);
  }
});
test('migrated area attacks, vulnerability and conditions resolve correctly',()=>{
  const s=battle();const area=Object.values(CARDS).find(c=>c.name==='横扫')!;
  s.battle!.enemies.push({...s.battle!.enemies[0],id:'e2'});
  s.battle!.enemies[0].vulnerable=1;
  s.battle!.hand=[{uid:'area',card:area.id,upgraded:false}];
  const n=reduceRun(s,{type:'play',uid:'area',target:'e1'});
  assert.equal(n.battle!.enemies[0].hp,s.battle!.enemies[0].hp-12);
  assert.equal(n.battle!.enemies[1].hp,s.battle!.enemies[1].hp-8);
  const conditional=Object.values(CARDS).find(c=>c.condition==='belowHalf')!;
  s.battle!.hand=[{uid:'condition',card:conditional.id,upgraded:false}];
  assert.throws(()=>reduceRun(s,{type:'play',uid:'condition',target:'e1'}));
});
test('ecology unlocks enter rewards only after receipt and cannot be claimed twice',()=>{
  const p={schemaVersion:1,kind:'eco-harvest',worldId:'eco-test',sequence:1,resources:{food:5,herb:2,spirit:3},species:[{id:'eco-producer',role:'producer',population:10}]};
  const m=claimEcology(createMeta(),p);assert.equal(m.food,5);assert.equal(m.herbs,8);
  assert.deepEqual(m.ecoCards,['eco-producer']);assert.throws(()=>claimEcology(m,p));
  assert.equal(HEROES.xiaohei.characterId,1);assert.equal(HEROES.xiaohei.element,'jin');
});
