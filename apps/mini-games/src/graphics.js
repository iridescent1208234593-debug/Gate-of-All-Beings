import { drawCoinBackdrop, drawCoinForeground } from './effects.js';
import { paintLocalDesertGround } from './maps.js';
import { GOALS, positions } from './crossing.js';

const obstacleSources=new WeakMap();
// Ignore transparent padding before fitting artwork into the shared obstacle box.
function obstacleSource(image){
  if(obstacleSources.has(image))return obstacleSources.get(image);
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
  let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>8){
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  const source=right<left?[0,0,canvas.width,canvas.height]:[left,top,right-left+1,bottom-top+1];
  obstacleSources.set(image,source);return source;
}
export function obstacleFrame(source,width,height){
  const scale=Math.min(width/source[2],height/source[3]);
  const w=source[2]*scale,h=source[3]*scale;
  return {x:(width-w)/2,y:height-h,width:w,height:h};
}

export function loadImage(url, timeout = 12000) {
  return new Promise((resolve,reject) => {
    const image=new Image();
    const timer=setTimeout(()=>finish(new Error('图片加载超时，请重试或选择另一个 OC。')),timeout);
    function finish(error) {clearTimeout(timer);image.onload=image.onerror=null;error?reject(error):resolve(image);}
    image.onload=()=>finish();image.onerror=()=>finish(new Error('图片无法读取，请重试或选择另一个 OC。'));image.src=url;
  });
}
export async function loadMap(map) {
  const effects=Object.fromEntries(await Promise.all(['coin','double','shield','magnet','jetpack'].map(async key=>[key,await loadImage(new URL('../assets/'+key+(['magnet','jetpack'].includes(key)?'.svg':'.webp'),import.meta.url).href)])));
  return {...effects,...Object.fromEntries(await Promise.all(['background','tall','short','wide','air'].filter(k=>map[k]).map(async k=>[k,await loadImage(map[k])])))};
}
export function fitImage(g,image,x,y,w,h) {
  if (!image) return;
  const scale=Math.min(w/image.width,h/image.height),width=image.width*scale,height=image.height*scale;
  g.drawImage(image,x+(w-width)/2,y+(h-height)/2,width,height);
}
export function prepareCanvas(canvas,width,height) {
  const ratio=Math.min(3,window.devicePixelRatio||1);
  const w=Math.round(width*ratio),h=Math.round(height*ratio);
  if(canvas.width!==w || canvas.height!==h){canvas.width=w;canvas.height=h;}
  const g=canvas.getContext('2d');g.setTransform(ratio,0,0,ratio,0,0);g.imageSmoothingEnabled=true;return g;
}
export function drawRunner(g,w,h,game,map,images,character,reducedMotion=false) {
  const floor=h*.8;
  g.fillStyle='#faf3e7';g.fillRect(0,0,w,h);
  if(images.background){
    const img=images.background,scale=Math.max(w/img.width,(floor+1)/img.height);
    const iw=img.width*scale,ih=img.height*scale,layout=map.backgroundLayout||{x:.5,y:.5};
    g.save();g.beginPath();g.rect(0,0,w,floor+1);g.clip();g.drawImage(img,(w-iw)*layout.x,(floor-ih)*layout.y,iw,ih);g.restore();
  }
  g.fillStyle='#eadbc7';g.fillRect(0,floor,w,h-floor);
  if(map.localStyle==='desert-study')paintLocalDesertGround(g,w,h,floor,game.distance);
  else {g.fillStyle='#a98564';g.fillRect(0,floor,w,1);}
  for(const o of game.obstacles){
    const x=o.x,y=floor-o.height-o.lift,img=images[o.type];
    if(img){
      const source=obstacleSource(img),frame=obstacleFrame(source,o.width,o.height);
      g.drawImage(img,...source,x+frame.x,y+frame.y,frame.width,frame.height);
    }else{
      g.fillStyle='#95554c';
      if(o.type==='air'){
        g.save();g.translate(x,y);g.scale(o.width/100,o.height/100);
        g.fill(new Path2D('M15 85C-4 85-5 47 15 43C14 14 45 2 58 25C75 12 92 29 88 45C108 47 105 85 85 85Z'));g.restore();
      }else g.fillRect(x,y,o.width,o.height);
    }
  }
  drawCoinBackdrop(g,w,h,game,reducedMotion);
  for(const c of game.collectibles||[]){
    const img=images[c.kind];g.save();g.translate(c.x,floor+c.y);
    if(c.kind!=='coin'){const glow=g.createRadialGradient(0,0,4,0,0,27);glow.addColorStop(0,'#fff6cdaa');glow.addColorStop(1,'#fff6cd00');g.fillStyle=glow;g.fillRect(-27,-27,54,54);if(!reducedMotion)g.translate(0,Math.sin(game.time*4)*3);}
    if(c.kind==='coin'){
      if(!reducedMotion)g.scale(.7+.3*Math.cos(game.time*4+(c.pathIndex||0)*.55),1);
      if(img)g.drawImage(img,-11,-11,22,22);
      else{g.fillStyle='#f6c849';g.beginPath();g.arc(0,0,9,0,Math.PI*2);g.fill();}
    }else if(img){
      if(c.kind==='double')g.drawImage(img,140,196,409,282,-17,-12,34,24);
      else if(c.kind==='shield')g.drawImage(img,64,36,384,440,-15,-17,30,34);
      else g.drawImage(img,-17,-17,34,34);
    }
    g.restore();
  }
  if(!character)return;
  const x=w*.16+24,y=floor+game.y;
  g.fillStyle='#47643c22';g.beginPath();g.ellipse(x,floor+3,24,4,0,0,Math.PI*2);g.fill();
  const stretch=reducedMotion?0:game.y<0?Math.max(-.03,Math.min(.03,-game.vy/570*.03)):Math.sin(game.distance/100*Math.PI*2)*.012;
  g.save();g.translate(x,y);g.scale(1-stretch*.7,1+stretch);fitImage(g,character,-22,-64,44,64);g.restore();
  drawCoinForeground(g,w,h,game,reducedMotion);
}

// Board artwork ported from crossingDrawBoard in the supplied package.
export function drawCrossing(g,game,character,reducedMotion=false) {
  const W=396,H=484,C=44,river=game.type==='river';g.clearRect(0,0,W,H);
  for(let row=0;row<11;row++){
    const safe=[0,5,10].includes(row),y=row*C;
    g.fillStyle=safe?(row===0?'#aecda2':'#d4e7cd'):river?(row%2?'#69aeba':'#78bbc5'):'#52636d';g.fillRect(0,y,W,C);
    if(safe){g.fillStyle='#a6c298';for(let col=0;col<9;col++){const x=col*C+8;g.fillRect(x,y+31,2,5);g.fillRect(x+4,y+29,2,7);}}
    else if(river){g.fillStyle='#ecfcfa48';const drift=(game.clock*12*(row%2?1:-1))%72;for(let x=-72;x<W+72;x+=72){g.fillRect(x+drift+(row%3)*12,y+10,20,2);g.fillRect(x+drift+30,y+31,14,2);}}
    else{g.fillStyle='#98a6ad';for(let x=10;x<W;x+=44)g.fillRect(x,y+42,23,2);}
  }
  g.fillStyle='#ffffff57';g.fillRect(176,442,44,40);
  for(let i=0;i<GOALS.length;i++){
    const x=GOALS[i]*C+4,occupied=game.goals.includes(i);
    g.fillStyle=occupied?'#355f4b':'#e8efc5';g.fillRect(x,4,36,36);g.strokeStyle='#587d57';g.lineWidth=2;g.strokeRect(x+1,5,34,34);
    if(occupied&&character)fitImage(g,character,x+4,8,28,28);
    else{g.strokeStyle='#537749';g.beginPath();g.moveTo(x+10,24);g.lineTo(x+18,16);g.lineTo(x+26,24);g.stroke();}
  }
  for(const lane of game.lanes)for(const x of positions(lane)){
    const y=lane.row*C+7,w=lane.width;
    if(river){
      g.fillStyle='#674633';g.fillRect(x,y,w,30);g.fillStyle='#b78453';g.fillRect(x+3,y+3,w-6,23);g.fillStyle='#d2a274';g.fillRect(x+8,y+5,w-16,3);g.fillStyle='#8a5c3d';g.fillRect(x+12,y+14,w-24,2);g.fillRect(x+12,y+21,w-24,2);g.fillRect(x+4,y+3,4,23);g.fillRect(x+w-8,y+3,4,23);
    }else{
      g.fillStyle='#263742';g.fillRect(x+10,y-2,12,34);g.fillRect(x+w-22,y-2,12,34);
      g.fillStyle=['#e4b954','#d17868','#96b4ce','#90b89c'][lane.row%4];g.fillRect(x,y,w,30);g.fillStyle='#cee7ec';g.fillRect(x+(lane.speed>0?38:13),y+4,15,22);g.fillStyle='#466372';g.fillRect(x+26,y+4,9,22);
      g.fillStyle='#f8e8ad';g.fillRect(x+(lane.speed>0?w-4:1),y+3,3,5);g.fillRect(x+(lane.speed>0?w-4:1),y+22,3,5);
    }
  }
  const p=game.player;if(!p||!character)return;
  const t=1-p.hop/.12,animate=!reducedMotion,x=p.hop>0&&animate?p.fromX+(p.x-p.fromX)*t:p.x,row=p.hop>0&&animate?p.fromRow+(p.row-p.fromRow)*t:p.row;
  const lift=animate&&p.hop>0?Math.sin(t*Math.PI)*6:0;
  g.fillStyle='#16322b40';g.beginPath();g.ellipse(x,row*C+36,13,4,0,0,Math.PI*2);g.fill();
  g.save();if(game.mode==='hit')g.globalAlpha=.45;fitImage(g,character,x-18,row*C+4-lift,36,36);g.restore();
}
