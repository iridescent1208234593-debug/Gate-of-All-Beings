import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunner,stepRunner,jump,resizeRunner} from '../src/runner.js';
import {applyItem,spawnCoinRoute,reserveCoinRoute,absorbCollision} from '../src/coins.js';
import {saveProgress,readProgress} from '../src/platform.js';

test('coin runs start empty on normal difficulty, with no carried effects',()=>{
  const g=createRunner('hard','coins');assert.equal(g.difficulty,'normal');assert.equal(g.coins,0);assert.deepEqual(g.effects,{});
  applyItem(g,'shield');assert.equal(createRunner('normal','coins').effects.shield,undefined);
});
test('original routes avoid obstacles and remove whole blocked routes',()=>{
  const g=createRunner('normal','coins');assert.equal(spawnCoinRoute(g,'ground',500),true);assert.equal(g.collectibles.length,6);
  const o={type:'short',x:500,width:30,height:34,lift:0};g.obstacles.push(o);reserveCoinRoute(g,o);
  assert.ok(!g.collectibles.some(c=>c.routeId===1));
});
test('coins are collected once; double pickup gives two and expires while paused time stays fixed',()=>{
  const g=createRunner('normal','coins');g.spawn=999;g.coinSpawn=999;g.dropSpawn=999;
  g.collectibles=[{kind:'coin',x:140,y:-30}];applyItem(g,'double');stepRunner(g,.05,()=>.5);
  assert.equal(g.coins,2);stepRunner(g,.05,()=>.5);assert.equal(g.coins,2);
  const remaining=g.effects.double;g.mode='paused';stepRunner(g,.1);assert.equal(g.effects.double,remaining);
});
test('magnet collects behind the player and shield consumes once with grace',()=>{
  const g=createRunner('normal','coins');g.spawn=g.coinSpawn=g.dropSpawn=999;applyItem(g,'magnet');
  g.collectibles=[{kind:'coin',x:30,y:-30}];stepRunner(g,.01,()=>.5);assert.equal(g.coins,1);
  applyItem(g,'shield');const o={x:100,width:30};assert.equal(absorbCollision(g,o),true);assert.equal(g.effects.shield,0);assert.ok(g.effects.grace>0);
  g.effects.grace=0;assert.equal(absorbCollision(g,o),false);
});
test('jetpack accelerates, blocks jumping, protects collisions and ends with grace',()=>{
  const g=createRunner('normal','coins');g.spawn=g.coinSpawn=g.dropSpawn=999;applyItem(g,'jetpack');
  assert.equal(jump(g),false);stepRunner(g,.1,()=>.5);assert.ok(g.y<0);assert.ok(g.speed>390);
  g.effects.jetpack=.01;stepRunner(g,.02,()=>.5);assert.equal(g.effects.jetpack,0);assert.ok(g.effects.grace>0);
});
test('all four free items spawn; resize moves collectible coordinates with player',()=>{
  for(const [i,key] of ['magnet','jetpack','shield','double'].entries()){
    const g=createRunner('normal','coins');g.spawn=g.coinSpawn=999;g.dropSpawn=0;stepRunner(g,.01,()=>i/4+.01);
    assert.ok(g.collectibles.some(c=>c.kind===key));const x=g.collectibles[0].x;resizeRunner(g,820);assert.equal(g.collectibles[0].x,x+16);
  }
});
test('coin best keeps a pair from one run and separates normal and crossing records',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  saveProgress(storage,'a','oc-run-coins',{best:10,distance:300});saveProgress(storage,'a','oc-run-coins',{best:9,distance:999});
  assert.equal(readProgress(storage,'a','oc-run-coins').distance,300);
  saveProgress(storage,'a','oc-run-coins',{best:10,distance:400});assert.equal(readProgress(storage,'a','oc-run-coins').distance,400);
  assert.equal(readProgress(storage,'a','oc-run').best,0);assert.equal(readProgress(storage,'a','frog-crossing').best,0);
});
