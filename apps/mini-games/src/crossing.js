// The original 9 × 11 board, lane rules and hop timing; no economy or item effects.
export const GRID = Object.freeze({ cell: 44, cols: 9, rows: 11, width: 396, height: 484 });
export const GOALS = Object.freeze([0,2,4,6,8]);
export const CROSSING_DIFFICULTIES = Object.freeze({ easy:{speed:.72,time:90}, normal:{speed:1,time:70}, hard:{speed:1.28,time:55} });
export const CROSSING_MAPS = Object.freeze([
  Object.freeze({id:'crossing-road',name:'晴日马路',type:'road'}),
  Object.freeze({id:'crossing-river',name:'林间小河',type:'river'}),
]);
export function createLanes(type,level,difficulty) {
  const factor = CROSSING_DIFFICULTIES[difficulty].speed*Math.min(1.85,1+(level-1)*.13);
  return [1,2,3,4,6,7,8,9].map(row => {
    const width = type === 'road' ? 66 : 132, period = type === 'road' ? 210+(row%3)*24 : 215+(row%3)*11;
    return {row,width,period,speed:(row%2?-1:1)*(type==='road'?34+(row%4)*9:23+(row%3)*6)*factor,offset:(row*57)%period};
  });
}
export function positions(lane) {
  const result = [], offset = ((lane.offset%lane.period)+lane.period)%lane.period;
  for (let x=offset-lane.period;x<GRID.width;x+=lane.period) result.push(x);
  return result;
}
function resetPlayer(game) {
  game.player = {x:198,row:10,fromX:198,fromRow:10,hop:0};
  game.farthest = 10; game.time = CROSSING_DIFFICULTIES[game.difficulty].time;
}
export function createCrossing(mapId = 'crossing-road',difficulty = 'normal') {
  const map = CROSSING_MAPS.find(m=>m.id===mapId) || CROSSING_MAPS[0];
  difficulty = CROSSING_DIFFICULTIES[difficulty] ? difficulty : 'normal';
  const game = {kind:'crossing',mode:'running',mapId:map.id,type:map.type,difficulty,level:1,lives:3,score:0,goals:[],clock:0,hitTime:0,
    message:map.type==='road'?'看准车流空隙，草地上可以停一停。':'跳上浮木，留意水流方向。',lanes:createLanes(map.type,1,difficulty)};
  resetPlayer(game); return game;
}
export function moveCrossing(game,direction) {
  if (game.mode!=='running' || game.player.hop>0) return false;
  const move = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[direction];
  if (!move) return false;
  const p=game.player,x=p.x+move[0]*44,row=p.row+move[1];
  if (x<15 || x>381 || row<0 || row>10) return false;
  Object.assign(p,{fromX:p.x,fromRow:p.row,x,row,hop:.12}); return true;
}
function lose(game,message) {
  if (game.mode!=='running') return;
  game.message=message; game.lives--; game.mode=game.lives<=0?'over':'hit'; game.hitTime=.7; game.player.hop=0;
}
export function checkLanding(game) {
  const p=game.player;
  if (game.mode!=='running' || p.hop>0) return;
  if (p.row===0) {
    const goal=GOALS.indexOf(Math.floor(p.x/44));
    if (goal<0 || game.goals.includes(goal)) { lose(game,'请选择一个空着的终点。'); return; }
    game.goals.push(goal); game.score+=100+Math.ceil(game.time);
    if (game.goals.length===5) {game.mode='clear';game.message='五个终点全部到达！';}
    else {resetPlayer(game);game.message='安全到达！再去一个空着的终点。';}
    return;
  }
  const lane=game.lanes.find(l=>l.row===p.row);
  if (lane) {
    const objects=positions(lane);
    if (game.type==='road') {
      if (objects.some(x=>p.x+11>x+3 && p.x-11<x+lane.width-3)) {lose(game,'碰到车辆了，看准空隙再出发。');return;}
    } else if (p.x<12 || p.x>384 || !objects.some(x=>p.x>=x+8 && p.x<=x+lane.width-8)) {
      lose(game,'落水了，要站稳在浮木上。');return;
    }
  }
  if (p.row<game.farthest) {game.score+=(game.farthest-p.row)*10;game.farthest=p.row;}
}
export function stepCrossing(game,dt) {
  let remaining=Math.max(0,Math.min(.1,dt));
  while (remaining>1e-8) {
    const step=Math.min(1/120,remaining);remaining-=step;
    if (game.mode==='hit') {game.hitTime-=step;if(game.hitTime<=0){resetPlayer(game);game.mode='running';}continue;}
    if (game.mode!=='running') return;
    game.clock+=step;game.time=Math.max(0,game.time-step);
    if (game.time<=0) {lose(game,'时间到了，再试一次。');continue;}
    for (const lane of game.lanes) lane.offset=(lane.offset+lane.speed*step)%lane.period;
    const p=game.player;
    if (p.hop>0) p.hop=Math.max(0,p.hop-step);
    else if (game.type==='river') p.x+=(game.lanes.find(l=>l.row===p.row)?.speed||0)*step;
    checkLanding(game);
  }
}
export function nextLevel(game) {
  if (game.mode!=='clear') return;
  game.level++;game.goals=[];game.lanes=createLanes(game.type,game.level,game.difficulty);
  resetPlayer(game);game.mode='running';game.message='新的一关，留意更快的车流或水流。';
}
