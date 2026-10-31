// Built-in artwork and layout copied from the user-provided Let’s Go! package.
const svgURL = svg => "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
function localDesertMap(){
  const svg=(w,h,body)=>svgURL('<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" shape-rendering="crispEdges">'+body+'</svg>');
  const cactus=(x,y,s)=>'<g transform="translate('+x+' '+y+') scale('+s+')"><path fill="#535353" d="M12 0h8v4h4v20h4v-12h8v20h-4v4h-8v28H8V40H0v-4h-4V20h8v12h4V4h4z"/><path fill="#535353" d="M12 4h8v56h-8zM0 24h4v12h8v4H0zM24 28h8v-12h-4v16h-4z"/><path fill="#535353" d="M12 8h4v44h-4zM0 24h4v8H0zM28 16h4v8h-4z"/><path fill="#535353" d="M16 16h4v4h-4zM12 36h4v4h-4zM16 48h4v4h-4z"/></g>';
  const cloud=(x,y)=>'<path transform="translate('+x+' '+y+')" fill="#f8f8e9" d="M0 16h12V8h12V0h24v8h16v8h16v8H0z"/>';
  const background=svg(960,400,'<path fill="#f7f7f7" d="M0 0h960v400H0z"/><g fill="none" stroke="#b8b8b8" stroke-width="2"><path d="M88 96h16V86h14V76h28v10h16v10h24v10H88zM410 174h14v-10h12v-10h30v10h14v10h20v10h-90zM752 68h14V58h14V48h28v10h18v10h18v10h-92z"/></g>');
  const tall=svg(120,268,cactus(12,4,'3 4'));
  const short=svg(120,136,cactus(28,4,2));
  // 长障碍使用整组像素仙人掌，仍沿用统一的整块碰撞范围。
  const wide=svg(640,200,cactus(16,8,3)+cactus(142,40,2.5)+cactus(256,8,3)+cactus(384,40,2.5)+cactus(508,8,3));
  const air=svg(168,100,'<g fill="#535353"><path d="M12 28h28v8h8v28H12V52H0v-8h12zM36 44h76v8h20V40h36v8h-12v12h-16v12h-28v8H52V68H36z"/><path d="M56 52V24h12V8h12V0h8v12h8v16h8v28zM68 68h28v20h-8v12H76V88h-8z"/></g><path fill="#f7f7f7" d="M24 36h8v8h-8z"/>');
  return {id:'local-chrome-desert-v1',name:'经典小恐龙',theme:'plain',localStyle:'desert-study',background,backgroundLayout:{version:1,mode:'cover',motion:'fixed',zoom:1,x:.5,y:1},tall,short,wide,air,spriteAppearance:{tall:{version:1,fit:'contain',sx:1,sy:1,x:.5,y:1},short:{version:1,fit:'contain',sx:1,sy:1,x:.5,y:1},wide:{version:1,layoutVersion:2,fit:'contain',sx:1,sy:1,x:.5,y:1},air:{version:1,fit:'contain',sx:1,sy:1,x:.5,y:1}}};
}

export function paintLocalDesertGround(g,w,h,floor,distance){
  g.fillStyle='#f7f7f7';g.fillRect(0,floor,w,h-floor);
  g.fillStyle='#535353';g.fillRect(0,floor,w,1);
  const step=137,offset=((distance%step)+step)%step;
  for(let x=-offset;x<w;x+=step){
    g.fillStyle='#f7f7f7';g.fillRect(x+42,floor,9,1);
    g.fillStyle='#535353';g.fillRect(x+42,floor-2,9,1);g.fillRect(x+41,floor-1,1,2);g.fillRect(x+51,floor-1,1,2);
    g.fillRect(x+12,floor+7,11,1);g.fillRect(x+76,floor+12,6,1);g.fillRect(x+109,floor+5,16,1);g.fillRect(x+57,floor+21,3,1);
  }
}

function freeze(value) { if(value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export const RUNNER_MAPS = freeze([{id:"default",name:"默认地图",theme:"plain"},localDesertMap(),{id:"coming-soon",name:"更多地图",comingSoon:true}]);
