import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunner,stepRunner,jump,resizeRunner,OBSTACLES,DIFFICULTIES,obstacleGap} from '../src/runner.js';
import {reserveCoinRoute,applyItem,absorbCollision} from '../src/coins.js';

function playPair(width,difficulty,time,first,second,leads,delay){
  const game=createRunner(difficulty);resizeRunner(game,width);game.time=time;game.spawn=999;
  const rule=DIFFICULTIES[difficulty],speed=Math.min(rule.max,rule.base+time*rule.growth),x=width*.16+40+speed*.7;
  game.obstacles=[{type:first,index:0,x,...OBSTACLES[first]},{type:second,index:1,x:x+OBSTACLES[first].width+obstacleGap(first,second,speed),...OBSTACLES[second]}];
  let jumpedAt=0,jumpTarget=-1;
  for(let i=0;i<1500&&game.mode==='running'&&game.obstacles.length;i++){
    const target=game.obstacles.find(o=>o.x+o.width>width*.16+10);
    if(target&&target.type!=='air'){
      if(game.y===0&&target.x-(width*.16+40)<=game.speed*leads[target.index]){jump(game);jumpedAt=game.time;jumpTarget=target.index;}
      else if(game.jumps===1&&jumpTarget===target.index&&['tall','wide'].includes(target.type)&&game.time-jumpedAt>=delay)jump(game);
    }
    stepRunner(game,1/120,()=>.5);
  }
  return game.mode==='running'&&game.obstacles.length===0;
}

test('every obstacle pair is passable at phone/desktop widths, starting and maximum speeds',()=>{
  const leads=[.12,.18,.22,.26,.3,.36];
  for(const width of [358,1104])for(const difficulty of Object.keys(DIFFICULTIES))for(const time of [0,10000]){
    for(const first of Object.keys(OBSTACLES))for(const second of Object.keys(OBSTACLES)){
      const possible=leads.some(a=>leads.some(b=>[.2,.28,.36,.44].some(delay=>playPair(width,difficulty,time,first,second,[a,b],delay))));
      assert.ok(possible,JSON.stringify({width,difficulty,time,first,second}));
    }
  }
});

test('ground obstacles offer a usable timing window rather than a single perfect jump',()=>{
  for(const width of [358,1104])for(const difficulty of Object.keys(DIFFICULTIES))for(const time of [0,10000])for(const type of ['short','tall','wide']){
    let best=0,streak=0;
    for(let i=8;i<=90;i++){
      const safe=[.2,.28,.36,.44].some(delay=>playPair(width,difficulty,time,type,'air',[i/100,0],delay));
      streak=safe?streak+1:0;best=Math.max(best,streak);
    }
    assert.ok(best>=10,JSON.stringify({width,difficulty,time,type,best}));
  }
});

test('all enlarged obstacles retain coin routes with continuous clearance on small and large canvases',()=>{
  for(const height of [240,360,480])for(const [type,size] of Object.entries(OBSTACLES)){
    const game=createRunner('normal','coins');game.viewHeight=height;
    const obstacle={type,x:400,...size};game.obstacles=[obstacle];reserveCoinRoute(game,obstacle);
    assert.ok(game.collectibles.length>=5,type+' route disappeared');
    for(let i=0;i<game.collectibles.length;i++){
      const point=game.collectibles[i],previous=game.collectibles[i-1]||point;
      for(let j=0;j<=20;j++){
        const x=previous.x+(point.x-previous.x)*j/20,y=previous.y+(point.y-previous.y)*j/20;
        const hit=x+11>obstacle.x-16&&x-11<obstacle.x+size.width+16&&y+11>-size.height-size.lift-16&&y-11<-size.lift+16;
        assert.equal(hit,false,type+' coin route crosses obstacle');
        assert.ok(height*.8+y>=15,type+' route above screen');
      }
    }
  }
});

test('pickups and shield impacts emit bounded visual feedback without advancing during pause',()=>{
  const game=createRunner('normal','coins');game.spawn=game.coinSpawn=game.dropSpawn=999;
  for(const key of ['magnet','jetpack','shield','double'])applyItem(game,key);
  for(const key of ['magnet','jetpack','shield','double'])assert.ok(game.feedback.some(e=>e.kind===key));
  game.effects.jetpack=0;absorbCollision(game,{x:100,width:44});assert.ok(game.feedback.some(e=>e.kind==='shieldBreak'));
  game.collectibles=[{kind:'coin',x:140,y:game.y-30}];stepRunner(game,.01,()=>.5);
  assert.ok(game.feedback.some(e=>e.kind==='magnetCollect'&&e.value===2));
  for(let i=0;i<50;i++)applyItem(game,'double');assert.ok(game.feedback.length<=32);
  game.mode='paused';const snapshot=structuredClone(game);stepRunner(game,.1);assert.deepEqual(game,snapshot);
});
