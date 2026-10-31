// Visual feedback adapted from the original drawCoinEffects / drawGameFeedback.
// Uses simulation time: pause freezes effects, and rendering never changes the run.
const colors={coin:'#e5b735',magnetCollect:'#e5b735',magnet:'#e64b66',jetpack:'#36b6db',shield:'#4bcbe4',shieldBreak:'#4bcbe4',double:'#e5af23',grace:'#a18be8'};
const labels={magnet:'吸铁石',jetpack:'飞行启动',shield:'拾取护盾',shieldBreak:'护盾抵挡',double:'双倍金币'};
const active=(game,key)=>(game.effects?.[key]||0)>0;
const ellipse=(g,x,y,rx,ry)=>{g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);};
export function drawCoinBackdrop(g,w,h,game,reduced){
  if(game.gameMode!=='coins')return;
  const t=reduced?0:game.time,x=w*.16+24,y=h*.8+game.y-32;
  g.save();
  if(active(game,'double')){
    const glow=g.createRadialGradient(x,y,5,x,y,62);glow.addColorStop(0,'#f5cc6555');glow.addColorStop(1,'#f5cc6500');g.fillStyle=glow;g.fillRect(x-62,y-62,124,124);
    g.save();g.translate(x,y);g.rotate(t*.9);g.fillStyle='#e5af2338';
    for(let i=0;i<8;i++){g.rotate(Math.PI/4);g.beginPath();g.moveTo(-4,20);g.lineTo(4,20);g.lineTo(0,60);g.closePath();g.fill();}g.restore();
  }
  if(active(game,'magnet')){
    g.strokeStyle=colors.magnet;g.lineWidth=2;
    for(let i=0;i<3;i++){const p=(t*1.3+i/3)%1;g.globalAlpha=reduced?.4:Math.sin(p*Math.PI)*.6;ellipse(g,x,y,66-p*30,60-p*28);g.stroke();}
    g.globalAlpha=1;
  }
  if(active(game,'shield')){g.fillStyle='#4bcbe42b';ellipse(g,x,y,35,44);g.fill();}
  if(active(game,'jetpack')){
    // Wind stays near the canvas edges so the landing path remains readable.
    if(!reduced){g.strokeStyle='#b8edff99';g.lineWidth=2;
      for(let i=0;i<8;i++){const sx=w-((t*450+i*137)%(w+90)),sy=i%2?22+i*7:h*.8-18-i*4;g.beginPath();g.moveTo(sx,sy);g.lineTo(sx+28+i*3,sy);g.stroke();}}
    for(const offset of [-13,13]){g.fillStyle='#ffae3b';g.beginPath();g.moveTo(x+offset-7,y+22);g.lineTo(x+offset+7,y+22);g.lineTo(x+offset,y+52+(reduced?0:Math.sin(t*30)*7));g.closePath();g.fill();g.fillStyle='#fff0a7';g.fillRect(x+offset-3,y+22,6,17);}
  }
  g.restore();
}
export function drawCoinForeground(g,w,h,game,reduced){
  if(game.gameMode!=='coins')return;
  const t=reduced?0:game.time,x=w*.16+24,floor=h*.8,y=floor+game.y-32;
  g.save();
  if(active(game,'shield')){
    for(let i=0;i<Math.min(3,game.effects.shield);i++){g.strokeStyle=i?colors.shield:'#8af5ff';g.lineWidth=i?2:3;ellipse(g,x,y,35+i*4,44+i*4);g.stroke();}
    g.strokeStyle='#fff';g.lineWidth=3;g.beginPath();g.ellipse(x,y,29,38,0,Math.PI*1.06,Math.PI*1.34);g.stroke();
  }
  if(active(game,'grace')){g.strokeStyle=colors.grace;g.lineWidth=3;g.setLineDash([7,6]);g.lineDashOffset=-t*60;ellipse(g,x,y,42,50);g.stroke();g.setLineDash([]);}
  if(active(game,'double')){g.fillStyle='#f4cb56';g.fillRect(x-17,y-58,34,23);g.fillStyle='#4d3518';g.font='bold 14px system-ui';g.textAlign='center';g.fillText('×2',x,y-41);}
  const recent=(game.feedback||[]).filter(event=>game.time-event.time<=.75);
  const lastCoin=recent.findLast(event=>event.kind==='coin'||event.kind==='magnetCollect');
  const lastItem=recent.findLast(event=>labels[event.kind]);
  for(const event of recent){
    const age=game.time-event.time;if(age<0||age>.75)continue;
    const p=age/.75,color=colors[event.kind]||colors.coin;
    g.globalAlpha=1-p;g.strokeStyle=color;g.fillStyle=color;
    if(event.kind==='magnetCollect'&&!reduced){
      const u=Math.min(1,age/.2),sx=event.x,sy=floor+event.y;
      g.lineWidth=2;g.beginPath();g.moveTo(sx,sy);g.quadraticCurveTo((sx+x)/2,Math.min(sy,y)-28,x,y);g.stroke();
      g.beginPath();g.arc(sx+(x-sx)*u,sy+(y-sy)*u-20*Math.sin(u*Math.PI),4,0,Math.PI*2);g.fill();
    }
    const ex=event.kind==='coin'?event.x:x,ey=event.kind==='coin'?floor+event.y:y;
    if(!reduced){
      for(let i=0;i<8;i++){const angle=i*Math.PI/4;const radius=8+p*(event.kind==='shieldBreak'?76:38);g.fillRect(ex+Math.cos(angle)*radius-2,ey+Math.sin(angle)*radius-2+p*p*24,4,4);}
      if(labels[event.kind]){g.lineWidth=2;g.beginPath();g.arc(ex,ey,22+p*30,0,Math.PI*2);g.stroke();}
    }
    // Group rapid magnet pickups into one count, keeping the character readable.
    const coin=event.kind==='coin'||event.kind==='magnetCollect';
    if(coin?event!==lastCoin:event!==lastItem)continue;
    const amount=coin?recent.filter(e=>(e.kind==='coin'||e.kind==='magnetCollect')&&event.time-e.time<=.2).reduce((sum,e)=>sum+e.value,0):0;
    const text=labels[event.kind]||'+'+amount;
    g.font='600 13px system-ui';g.textAlign='center';const ty=Math.max(20,ey-(coin?12:70)-(reduced?0:p*20));
    const width=g.measureText(text).width+16;g.fillStyle='#faf7ed';g.fillRect(ex-width/2,ty-16,width,23);g.fillStyle='#253c31';g.fillText(text,ex,ty);
  }
  g.restore();
}
