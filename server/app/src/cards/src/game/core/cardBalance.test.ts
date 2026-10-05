import test from 'node:test';
import assert from 'node:assert/strict';
import {balanceOf,validateBalance} from './cardBalance';
import {BASE_CARDS,CARDS,setCardOverrides,registerEcoCards} from './content';
import {createRun,reduceRun,effectOf} from './engine';

test('numeric overrides change actual combat, costs, upgrade values and reset cleanly',()=>{
  try{
    setCardOverrides({claw:{...balanceOf(BASE_CARDS.claw),cost:2,effect:{damage:11}}});
    let run=reduceRun(createRun('xiaohei',123),{type:'enter',node:'0-1'});
    run.battle!.hand=[{card:'claw',uid:'test',upgraded:false}];const hp=run.battle!.enemies[0].hp;
    const result=reduceRun(run,{type:'play',uid:'test',target:'e1'});
    assert.equal(result.battle!.energy,1);assert.equal(result.battle!.enemies[0].hp,hp-11);
    assert.match(CARDS.claw.text,/11/);assert.equal(effectOf({card:'claw',uid:'test',upgraded:true}).damage,14);
    setCardOverrides({});assert.equal(CARDS.claw.effect.damage,7);assert.equal(CARDS.claw.cost,1);
  }finally{setCardOverrides({});}
});
test('ecology overrides survive repeated individual registration and reset to derived traits',()=>{
  const i={id:'eco-card-eco-admin-plant-1',worldId:'eco-admin',sourceId:'plant-1',name:'灵芽',role:'producer' as const,element:'mu' as const,traits:{size:3,speed:4,vitality:6}};
  try{
    setCardOverrides({[i.id]:{cost:2,effect:{block:20},exhaust:false,target:'single',condition:'none'}});
    registerEcoCards([i]);registerEcoCards([i]);assert.equal(CARDS[i.id].effect.block,20);
    setCardOverrides({});registerEcoCards([i]);assert.equal(CARDS[i.id].effect.block,7);
  }finally{setCardOverrides({});registerEcoCards([]);}
});
test('invalid values never become card effects',()=>{
  const base=balanceOf(BASE_CARDS.claw);
  for(const value of [-1,1.5,NaN,Infinity,'3'])assert.throws(()=>validateBalance({...base,cost:value}));
  assert.throws(()=>validateBalance({...base,effect:{damageFromBlock:2}}));
  assert.throws(()=>validateBalance({...base,effect:{draw:100000}}));
  assert.throws(()=>validateBalance({...base,effect:{script:1}}));
  assert.throws(()=>validateBalance({...base,unknown:1}));
  assert.deepEqual(validateBalance({...base,effect:{damage:0}}).effect,{});
});
