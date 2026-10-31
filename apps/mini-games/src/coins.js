// Ported from the original coinRoutePresets/updateCollectibles/applyItem.
// All effects belong to this run. No inventory, wallet or purchases.
const routes = {
  ground:[[0,-30],[34,-30],[68,-30],[102,-30],[136,-30],[170,-30]],
  short:[[-68,-30],[-34,-90],[0,-112],[44,-120],[88,-112],[122,-80],[156,-30]],
  tall:[[-68,-30],[-34,-120],[0,-140],[30,-152],[64,-140],[98,-110],[146,-30]],
  wide:[[-68,-30],[-34,-90],[0,-108],[32,-132],[64,-144],[96,-144],[128,-132],[159,-108],[193,-90],[227,-30]],
  air:[[-34,-30],[0,-30],[34,-30],[68,-30],[102,-30]],
  flight:[[0,0],[34,0],[68,0],[102,0],[136,0],[170,0]],
};
export const ITEMS = Object.freeze({magnet:12,jetpack:8,shield:0,double:15});
export const hasEffect=(game,key)=>game.gameMode==='coins'&&(game.effects?.[key]||0)>0;
export const flightHeight=game=>Math.max(68,Math.min(150,(game.viewHeight||360)*.8-75));
function feedback(game,kind,x=game.viewWidth*.16+24,y=game.y-30,value=1){
  game.feedback=(game.feedback||[]).filter(event=>game.time-event.time<.75);
  game.feedback.push({kind,x,y,value,time:game.time});
  if(game.feedback.length>32)game.feedback.shift();
}
export function applyItem(game,key){
  if(game.gameMode!=='coins'||!(key in ITEMS))return;
  game.effects[key]=key==='shield'?(game.effects.shield||0)+1:Math.min(60,(game.effects[key]||0)+ITEMS[key]);
  if(key==='jetpack'){game.vy=0;game.jumps=0;}
  feedback(game,key);
}
const box=(x,y,r)=>({l:x-r,r:x+r,t:y-r,b:y+r});
const intersects=(a,b)=>a.r>b.l&&a.l<b.r&&a.b>b.t&&a.t<b.b;
const obstacleBox=o=>({l:o.x-16,r:o.x+o.width+16,t:-o.height-o.lift-16,b:-o.lift+16});
function clear(game,x,y){return !game.obstacles.some(o=>intersects(box(x,y,11),obstacleBox(o)));}
export function spawnCoinRoute(game,name,x,baseY=0){
  const points=routes[name].map(([dx,dy])=>({x:x+dx,y:baseY+dy}));
  for(let i=0;i<points.length;i++){
    const p=points[i];
    if((game.viewHeight||360)*.8+p.y<15||!clear(game,p.x,p.y)||game.collectibles.some(c=>c.kind==='coin'&&Math.hypot(c.x-p.x,c.y-p.y)<25))return false;
    if(i){const a=points[i-1];for(let s=1;s<5;s++)if(!clear(game,a.x+(p.x-a.x)*s/5,a.y+(p.y-a.y)*s/5))return false;}
  }
  const routeId=++game.coinRouteSerial;
  points.forEach((p,index)=>game.collectibles.push({...p,kind:'coin',routeId,pathIndex:index}));return true;
}
export function reserveCoinRoute(game,o){
  if(game.gameMode!=='coins')return;
  const occupied=obstacleBox(o),blocked=new Set(game.collectibles.filter(c=>c.kind==='coin'&&intersects(box(c.x,c.y,11),occupied)).map(c=>c.routeId));
  game.collectibles=game.collectibles.filter(c=>c.kind==='coin'?!blocked.has(c.routeId):!intersects(box(c.x,c.y,17),occupied));
  if(!hasEffect(game,'jetpack'))spawnCoinRoute(game,o.type,o.x);
}
export function updateCoins(game,dt,before,after,swept,random){
  game.coinSpawn-=dt;game.dropSpawn-=dt;
  for(const key of ['magnet','jetpack','double','grace']){
    const old=game.effects[key]||0;game.effects[key]=Math.max(0,old-dt);
    if(key==='jetpack'&&old>0&&!game.effects[key]){game.effects.grace=Math.max(game.effects.grace||0,1.6);game.vy=0;game.jumps=0;}
  }
  const flying=hasEffect(game,'jetpack'),height=flying?-flightHeight(game)-30:0;
  if(game.coinSpawn<=0)game.coinSpawn=spawnCoinRoute(game,flying?'flight':'ground',game.viewWidth+35,height)?(flying?.75:1.9):.35;
  if(game.dropSpawn<=0){
    if(flying||!game.obstacles.some(o=>o.x+o.width>game.viewWidth-40&&o.x<game.viewWidth+100)){
      game.collectibles.push({kind:Object.keys(ITEMS)[Math.floor(random()*4)],x:game.viewWidth+50,y:height||-30});game.dropSpawn=9+random()*5;
    }else game.dropSpawn=.5;
  }
  const px=game.viewWidth*.16+24;
  const reachable=(c,x=c.x)=>hasEffect(game,'magnet')&&c.kind==='coin'&&x-px>=-360&&x-px<=220&&Math.abs(c.y-(game.y-30))<=220;
  const collect=c=>{if(c.collected)return;if(c.kind==='coin'){
    const value=hasEffect(game,'double')?2:1;game.coins+=value;
    feedback(game,reachable(c)?'magnetCollect':'coin',c.x,c.y,value);
  }else applyItem(game,c.kind);c.collected=true;};
  for(const c of game.collectibles){
    const oldX=c.x,old=box(c.x,c.y,c.kind==='coin'?10:17);c.x-=game.speed*dt;const next=box(c.x,c.y,c.kind==='coin'?10:17);
    if(reachable(c)||reachable(c,oldX)||intersects(after,next)||swept(before,after,old,next))collect(c);
  }
  for(const c of game.collectibles)if(reachable(c))collect(c);
  game.collectibles=game.collectibles.filter(c=>!c.collected&&c.x>(c.kind==='coin'?px-360:-30));
}
export function absorbCollision(game,o){
  if(hasEffect(game,'jetpack')||hasEffect(game,'grace'))return true;
  if(hasEffect(game,'shield')){game.effects.shield--;game.effects.grace=1.3;feedback(game,'shieldBreak');o.x=-o.width-30;return true;}
  return false;
}
