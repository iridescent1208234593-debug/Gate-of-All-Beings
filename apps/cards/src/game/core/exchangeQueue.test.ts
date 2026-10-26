import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateEcoExchange} from '@lxh/shared-types/exchange';
import {createInitialState,reducer} from '../../../../ecology/src/core/state.js';
import {importEcology} from '../../../../management/src/systems/ecology.js';
import {createInitialState as createBase} from '../../../../management/src/core/gameState.js';
import {queueEcology,acknowledgeDelivery} from './exchangeQueue';
import {freshSave,checkSave} from '../storage';
import {CARDS,registerEcoCards,pool} from './content';
import {createRun,reduceRun} from './engine';

function packet(seed=123){let world=createInitialState(seed);world={...world,ecology:{...world.ecology,harvest:{food:8,herb:3,spirit:4}}};return reducer(world,{type:'HARVEST'}).ecology.lastExport;}
test('real ecology individuals become distinct executable cards and goods reach the base exactly once',()=>{
  const p=packet(), fresh=freshSave();const save=queueEcology(fresh,p);
  assert.equal(save.meta.spirit,fresh.meta.spirit);
  assert.ok(save.meta.ecoIndividuals!.length>0);
  registerEcoCards(save.meta.ecoIndividuals);
  const ids=save.meta.ecoIndividuals!.map(i=>i.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(ids.every(id=>CARDS[id]&&pool('xiaohei',save.meta.ecoCards).some(c=>c.id===id)));
  assert.throws(()=>queueEcology(save,p));
  const base=createBase();const credited=importEcology(base,p);
  assert.equal(credited.resources.food,base.resources.food+8);
  assert.throws(()=>importEcology(credited,p));
  const done=acknowledgeDelivery(save,p.worldId,p.sequence);
  assert.equal(done.ecoDeliveries?.length,0);
  for(const id of ids){
    const run=createRun('xiaohei',1,false,save.meta.ecoCards);const battle=reduceRun(run,{type:'enter',node:'0-1'});
    battle.battle!.hand=[{uid:'observed',card:id,upgraded:false}];battle.battle!.energy=10;
    assert.doesNotThrow(()=>reduceRun(battle,{type:'play',uid:'observed',target:'e1'}));
  }
});
test('pending deliveries and dynamic card definitions survive JSON save/reload',()=>{
  const save=queueEcology(freshSave(),packet(456));registerEcoCards(save.meta.ecoIndividuals);
  save.run=createRun('xiaohei',5,false,save.meta.ecoCards);
  const id=save.meta.ecoIndividuals![0].id;save.run.deck.push({uid:'observed',card:id,upgraded:false});delete CARDS[id];
  const restored=checkSave(JSON.parse(JSON.stringify(save)));
  assert.ok(CARDS[id]);assert.deepEqual(restored,save);
});
test('forged traits, cross-world identities, duplicate roles and oversized packets are rejected',()=>{
  const p=packet();
  for(const change of [
    {individuals:[{...p.individuals[0],traits:{size:100,speed:1,vitality:1}}]},
    {individuals:[{...p.individuals[0],worldId:'eco-other'}]},
    {individuals:Array(13).fill(p.individuals[0])},
    {species:[p.species[0],p.species[0]]},
    {resources:{food:Infinity,herb:0,spirit:1}},
  ])assert.throws(()=>validateEcoExchange({...p,...change}));
});
test('a lost acknowledgement retries the saved packet without multiplying resources',()=>{
  const p=packet(),save=queueEcology(freshSave(),p);const base=importEcology(createBase(),save.ecoDeliveries![0]);
  const recovered=checkSave(JSON.parse(JSON.stringify(save)));
  assert.equal(base.ecoReceipts[p.worldId],p.sequence);
  assert.throws(()=>importEcology(base,recovered.ecoDeliveries![0]));
  assert.equal(acknowledgeDelivery(recovered,p.worldId,p.sequence).ecoDeliveries!.length,0);
  const next=queueEcology(recovered,{...p,sequence:p.sequence+1});
  assert.equal(next.meta.ecoIndividuals!.length,save.meta.ecoIndividuals!.length);
});
