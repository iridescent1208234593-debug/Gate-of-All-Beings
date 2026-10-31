// Loopback-only manual playground. All OC responses below are explicitly synthetic.
// No production proxy, tokens, databases or user uploads are read by this server.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app=fileURLToPath(new URL('./',import.meta.url));
const repo=path.resolve(app,'../..');
const shared=new Map([
  ['/shared/shared-session/progress.js','packages/shared-session/progress.js'],
  ['/shared/site-domains/index.mjs','packages/site-domains/index.mjs'],
  ['/shared/site-domains/index.js','packages/site-domains/index.js'],
  ['/shared/shared-session/kv.js','packages/shared-session/kv.js'],
  ['/shared/shared-session/bus.js','packages/shared-session/bus.js'],
]);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const bannerScript=`
function showDemoBanner(){
const banner=document.createElement('aside');
banner.textContent='本地试玩 · 当前为测试 OC，不连接会馆，也不读取真实账户。';
banner.style.cssText='padding:12px 20px;background:#f1e3ce;color:#67483e;font:16px/1.6 sans-serif;text-align:center;border-bottom:1px solid #cbb397';
document.body.prepend(banner);
const manage=document.getElementById('manage-ocs');manage.removeAttribute('href');manage.textContent='测试 OC 由本地试玩服务提供';
document.getElementById('return-home').href='/?game=runner';document.getElementById('return-home').textContent='试玩首页';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showDemoBanner,{once:true});else showDemoBanner();
`;
const demoOCs=[
  {id:'demo-a',name:'测试 OC · 小禾',species_type:'试玩角色',avatar_url:'/assets/mini-games-demo-a.svg',images:[]},
  {id:'demo-b',name:'测试 OC · 小川',species_type:'试玩角色',avatar_url:'/assets/mini-games-demo-b.svg',images:[]},
];
function avatar(color){return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="64"><rect x="6" y="6" width="32" height="52" rx="12" fill="${color}"/><circle cx="16" cy="25" r="2.5" fill="white"/><circle cx="28" cy="25" r="2.5" fill="white"/><path d="M17 36q5 5 10 0" fill="none" stroke="white" stroke-width="2"/></svg>`;}

export function createDemoServer(){
  return createServer(async(request,response)=>{
    const send=(status,body='',type='text/plain; charset=utf-8')=>{
      response.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      response.end(request.method==='HEAD'?undefined:body);
    };
    try{
      // Only this local server's explicit authorities are accepted.
      const port=response.socket.localPort;
      if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(request.headers.host)){send(421);return;}
      if(!['GET','HEAD'].includes(request.method)){send(405);return;}
      const url=new URL(request.url,'http://127.0.0.1');
      const name=decodeURIComponent(url.pathname);
      if(name==='/api/gate/identity'){send(200,JSON.stringify({logged_in:true,owner:{kind:'local',user_id:'mini-games-demo'}}),'application/json');return;}
      if(name==='/api/gate/ocs'){send(200,JSON.stringify({ocs:demoOCs}),'application/json');return;}
      if(name==='/__demo/banner.js'){send(200,bannerScript,'text/javascript');return;}
      if(name==='/assets/mini-games-demo-a.svg'||name==='/assets/mini-games-demo-b.svg'){
        send(200,avatar(name.includes('demo-a')?'#95554c':'#537d73'),'image/svg+xml');return;
      }
      let file;
      if(shared.has(name))file=path.join(repo,shared.get(name));
      else{
        const prefix='/app/modules/mini-games/';
        const relative=(name.startsWith(prefix)?name.slice(prefix.length):name.slice(1))||'index.html';
        const normalized=relative.replaceAll('\\','/');
        if(!['index.html','file-mode.js','style.css'].includes(normalized)&&!/^src\/[a-z-]+\.js$/.test(normalized)&&!/^assets\/[a-z-]+\.(png|webp|svg)$/.test(normalized)){send(404);return;}
        file=path.resolve(app,normalized);
        if(!file.startsWith(app)){send(403);return;}
      }
      let data=await readFile(file);
      if(path.basename(file)==='index.html')data=data.toString('utf8').replace('</body>','<script src="/__demo/banner.js"></script></body>');
      send(200,data,types[path.extname(file)]||'text/javascript; charset=utf-8');
    }catch{send(404,'Not found');}
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.MINI_GAMES_PORT||5186);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('MINI_GAMES_PORT must be between 1024 and 65535');
  const server=createDemoServer();
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已占用。请设置其他 MINI_GAMES_PORT 后再试。`:error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>{
    console.log(`本地试玩（仅测试 OC，不连接真实会馆）\nOC 快跑：http://127.0.0.1:${port}/?game=runner\n青蛙过河：http://127.0.0.1:${port}/?game=crossing\n按 Ctrl+C 停止。`);
  });
}
