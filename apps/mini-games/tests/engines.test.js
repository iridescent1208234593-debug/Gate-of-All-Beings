import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner, jump, stepRunner, resizeRunner, sweptOverlap } from '../src/runner.js';
import { createCrossing, moveCrossing, stepCrossing, checkLanding, nextLevel, positions } from '../src/crossing.js';
import { RUNNER_MAPS } from '../src/maps.js';

test('default and classic desert maps are playable; future maps stay disabled',()=>{
  assert.deepEqual(RUNNER_MAPS.map(m=>m.id),['default','local-chrome-desert-v1','coming-soon']);
  assert.equal(Object.isFrozen(RUNNER_MAPS[1]),true);
  assert.equal(RUNNER_MAPS[1].comingSoon,undefined);
  assert.equal(RUNNER_MAPS[2].comingSoon,true);
  assert.match(RUNNER_MAPS[1].background,/^data:image\/svg\+xml/);
});
test('runner double jump, landing and pause use the original physics',()=>{
  const game=createRunner();game.spawn=100;
  assert.equal(jump(game),true);stepRunner(game,.1);assert.ok(game.y<0);
  assert.equal(jump(game),true);assert.equal(jump(game),false);
  for(let i=0;i<15;i++)stepRunner(game,.1);
  assert.equal(game.y,0);assert.equal(game.jumps,0);
  game.mode='paused';const before=structuredClone(game);stepRunner(game,.1);assert.deepEqual(game,before);
});
test('ground obstacle ends the run; aerial obstacle can be passed on the ground',()=>{
  for(const [type,height,lift,expected] of [['short',34,0,'over'],['air',25,78,'running']]){
    const game=createRunner();game.spawn=100;
    game.obstacles=[{type,x:game.viewWidth*.16,width:30,height,lift}];
    stepRunner(game,.016);assert.equal(game.mode,expected);
  }
});
test('swept collision catches an object that crosses between frames',()=>{
  const p={l:10,r:20,t:0,b:20};
  assert.equal(sweptOverlap(p,p,{l:30,r:40,t:0,b:20},{l:-10,r:0,t:0,b:20}),true);
});
test('resize moves obstacles with the player; scoring is time-step independent',()=>{
  const game=createRunner();game.obstacles=[{x:200}];resizeRunner(game,360);
  assert.equal(game.obstacles[0].x,200+(360-720)*.16);
  const a=createRunner(),b=createRunner();a.spawn=b.spawn=100;
  for(let i=0;i<10;i++)stepRunner(a,.1);
  for(let i=0;i<120;i++)stepRunner(b,1/120);
  assert.equal(a.score,b.score);assert.ok(Math.abs(a.y-b.y)<.01);
});
test('crossing blocks repeated movement during a hop and respects board edges',()=>{
  const game=createCrossing();assert.equal(moveCrossing(game,'down'),false);
  assert.equal(moveCrossing(game,'up'),true);assert.equal(moveCrossing(game,'up'),false);
  game.player.x=22;game.player.row=10;game.player.hop=0;assert.equal(moveCrossing(game,'left'),false);
});
test('vehicle collision, three lives and timeout lead to game over',()=>{
  const game=createCrossing();game.player={x:60,row:9,hop:0};game.lanes=[{row:9,width:66,period:240,offset:40,speed:0}];
  checkLanding(game);assert.equal(game.mode,'hit');assert.equal(game.lives,2);
  for(let i=0;i<8;i++)stepCrossing(game,.1);assert.equal(game.player.row,10);
  for(let i=0;i<2;i++){game.time=.001;stepCrossing(game,.02);if(i===0)for(let j=0;j<8;j++)stepCrossing(game,.1);}
  assert.equal(game.mode,'over');assert.equal(game.lives,0);
});
test('river carries OC with a log; water and screen edges cost a life',()=>{
  const game=createCrossing('crossing-river');game.player={x:70,row:9,hop:0};
  game.lanes=[{row:9,width:132,period:230,offset:0,speed:30}];stepCrossing(game,.1);
  assert.ok(Math.abs(game.player.x-73)<.01);assert.equal(game.lives,3);
  game.player.x=190;checkLanding(game);assert.equal(game.lives,2);
  game.mode='running';game.player={x:390,row:9,hop:0};checkLanding(game);assert.equal(game.lives,1);
});
test('five distinct goals clear a level; an occupied goal cannot be reused',()=>{
  const game=createCrossing();
  for(const col of [0,2,4,6,8]){game.player={x:col*44+22,row:0,hop:0};checkLanding(game);}
  assert.equal(game.mode,'clear');assert.equal(game.goals.length,5);assert.ok(game.score>=500);
  nextLevel(game);assert.equal(game.level,2);assert.deepEqual(game.goals,[]);assert.equal(game.player.row,10);
  game.goals=[0];game.player={x:22,row:0,hop:0};checkLanding(game);assert.equal(game.lives,2);
});
test('paused crossing does not move traffic, logs, hop or timer',()=>{
  const game=createCrossing();game.mode='paused';const before=structuredClone(game);stepCrossing(game,.1);assert.deepEqual(game,before);
  assert.ok(positions({period:200,offset:-30}).every(Number.isFinite));
});
