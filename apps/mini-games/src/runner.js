import { hasEffect, flightHeight, reserveCoinRoute, updateCoins, absorbCollision } from './coins.js';
// Let’s Go! runner physics, isolated from its former editor, wallet and platform SDK.
export const DIFFICULTIES = Object.freeze({
  easy: { base: 215, growth: 2, max: 470 },
  normal: { base: 265, growth: 3, max: 540 },
  hard: { base: 325, growth: 4, max: 610 },
});
export const OBSTACLES = Object.freeze({
  short: { width: 44, height: 48, lift: 0 }, tall: { width: 44, height: 80, lift: 0 },
  wide: { width: 159, height: 48, lift: 0 }, air: { width: 60, height: 36, lift: 78 },
});
export function obstacleGap(previous,type,speed){
  const seconds=previous==='wide'&&type==='air'?2.1:previous==='wide'||type==='wide'?1.5:previous!=='air'&&type==='air'?1.7:previous==='air'&&type!=='air'?1:.9;
  return speed*seconds+48;
}
export function createRunner(difficulty = 'normal', gameMode = 'classic', random = Math.random) {
  if(gameMode==='coins')difficulty='normal';
  return { gameMode, coins:0, collectibles:[], coinSpawn:.2, dropSpawn:4+random()*2, coinRouteSerial:0, effects:{}, kind: 'runner', mode: 'running', difficulty: DIFFICULTIES[difficulty] ? difficulty : 'normal',
    time: 0, distance: 0, score: 0, y: 0, vy: 0, jumps: 0, obstacles: [], spawn: 1.5, speed: 0, viewWidth: 720 };
}
export function jump(game) {
  if (game.mode !== 'running' || game.jumps >= 2 || hasEffect(game,'jetpack')) return false;
  game.vy = -570; game.jumps++; return true;
}
export function overlap(a, b) { return a.r > b.l && a.l < b.r && a.b > b.t && a.t < b.b; }
export function sweptOverlap(a0, a1, b0, b1) {
  let enter = 0, exit = 1;
  for (const [v0, v1] of [[a0.r-b0.l,a1.r-b1.l], [b0.r-a0.l,b1.r-a1.l], [a0.b-b0.t,a1.b-b1.t], [b0.b-a0.t,b1.b-a1.t]]) {
    const delta = v1-v0;
    if (Math.abs(delta) < 1e-9) { if (v0 <= 0) return false; }
    else if (delta > 0) enter = Math.max(enter, -v0/delta);
    else exit = Math.min(exit, -v0/delta);
    if (enter >= exit) return false;
  }
  return exit > 0 && enter < 1;
}
// Every OC has the same hitbox, regardless of image dimensions or transparency.
const inset = (x,y,w,h) => { const n = Math.min(1.5,w*.04,h*.04); return {l:x+n,r:x+w-n,t:y+n,b:y+h-n}; };
const playerBox = (game, width) => inset(width*.16+8, game.y-60, 32, 60);
const obstacleBox = o => inset(o.x, -o.height-o.lift, o.width, o.height);
export function resizeRunner(game, width) {
  const shift = (width-game.viewWidth)*.16;
  for (const o of game.obstacles) o.x += shift;
  for(const c of game.collectibles)c.x += shift;
  for(const event of game.feedback||[])event.x += shift;
  game.viewWidth = width;
}
export function stepRunner(game, dt, random = Math.random) {
  if (game.mode !== 'running') return;
  let remaining = Math.max(0, Math.min(dt, .1));
  const rule = DIFFICULTIES[game.difficulty], width = game.viewWidth;
  while (remaining > 1e-8 && game.mode === 'running') {
    const step = Math.min(remaining,1/120,hasEffect(game,'jetpack')?game.effects.jetpack:Infinity), before = playerBox(game,width);
    game.time += step; game.speed = Math.min(rule.max,rule.base+game.time*rule.growth)*(hasEffect(game,'jetpack')?1.5:1);
    game.distance += game.speed*step; game.score = Math.floor(game.distance/40);
    if(hasEffect(game,'jetpack')){game.y+=(-flightHeight(game)-game.y)*Math.min(1,step*8);game.vy=0;game.jumps=0;}
    else {game.vy += 1550*step; game.y = Math.min(0,game.y+game.vy*step);}
    if (game.y === 0) { game.vy = 0; game.jumps = 0; }
    game.spawn -= step;
    if (game.spawn <= 0) {
      if (!game.pendingType) game.pendingType = game.time < 7 ? 'short' : Object.keys(OBSTACLES)[Math.floor(random()*4)];
      const type = game.pendingType, previous = game.lastSpawn;
      const speed = Math.min(rule.max,game.speed+rule.growth*(width/game.speed+3));
      const edge = game.distance+width+35;
      if (!previous || edge-previous.end >= obstacleGap(previous.type,type,speed)) {
        const obstacle = { type, x: width+35, ...OBSTACLES[type] };
        game.obstacles.push(obstacle); reserveCoinRoute(game,obstacle); game.lastSpawn = {type,end:edge+obstacle.width};
        game.pendingType = null; game.spawn = Math.max(1.18,1.85-game.time*.004)+random()*.7;
      }
    }
    const after = playerBox(game,width);
    if(game.gameMode==='coins')updateCoins(game,step,before,after,sweptOverlap,random);
    for (const o of game.obstacles) {
      const old = obstacleBox(o); o.x -= game.speed*step; const next = obstacleBox(o);
      if (overlap(after,next) || sweptOverlap(before,after,old,next)) { if(!absorbCollision(game,o)){game.mode = 'over'; break;} }
    }
    game.obstacles = game.obstacles.filter(o => o.x+o.width > -20);
    remaining -= step;
  }
}
