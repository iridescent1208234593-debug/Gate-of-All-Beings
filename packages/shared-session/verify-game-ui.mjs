// Uses local build/source only; no requests reach production services.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../apps/management/node_modules/playwright/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=path.join(root,'work/cards-unification/qa');await mkdir(output,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname.includes('/api/')){
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify(pathname.includes('card-balance')?{revision:0,overrides:{},editable:false}:{logged_in:false}));return;
    }
    const routes=[['/app/modules/cards/',path.join(root,'.releases/candidate/cards')],['/app/modules/slay/',path.join(root,'apps/slay/public')],['/shared/',path.join(root,'packages')]];
    const route=routes.find(([prefix])=>pathname.startsWith(prefix));if(!route)throw Error('Unavailable route');
    const relative=pathname.slice(route[0].length)||'index.html',file=path.resolve(route[1],relative);
    if(path.relative(route[1],file).startsWith('..'))throw Error('Invalid path');
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
let diagnosticPage;const errors=[],failed=[];
try{
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});
  const attemptedUpstream=[];
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='api.slaytheweb.cards')attemptedUpstream.push(url.href);return url.origin===origin?route.continue():route.abort();});
  await context.addInitScript(()=>{
    localStorage.setItem('zszm.introSeenAt',String(Date.now()));
    sessionStorage.setItem('zszm.gateIdentity.v1',JSON.stringify({schema_version:1,id:'verification',display_name:'旅人',species_name:'妖精',avatar_asset_id:'',avatar_frame_id:'frame-default',avatar_mode:'default',source_oc_id:''}));
  });
  const page=await context.newPage();diagnosticPage=page;page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)failed.push(response.url());});page.on('requestfailed',request=>{if(request.resourceType()==='script')failed.push(request.url());});
  await page.goto(origin+'/app/modules/cards/#journey');
  await page.getByRole('heading',{name:'共同旅途',exact:true}).waitFor();
  await page.getByText(/439 位角色 · 168 张灵卡/).waitFor();
  await page.screenshot({path:path.join(output,'journey-desktop.png')});
  await page.getByRole('button',{name:'灵卡总册',exact:true}).click();
  await page.getByRole('textbox',{name:'搜索共同旅途'}).fill('金刃');
  await page.getByRole('heading',{name:'金刃',exact:true}).first().waitFor();
  assert.equal(await page.getByRole('heading',{name:'金刃',exact:true}).count(),2,'same-named cards must retain both mode identities');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出共同旅途',exact:true}).click();
  const download=await downloadPromise;const exported=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(exported.format,'iridescently-game');assert(exported.modes.cards.snapshot);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('textbox',{name:'搜索共同旅途'}).fill('');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile journey overflows horizontally');
  await page.screenshot({path:path.join(output,'journey-mobile.png')});
  await page.setViewportSize({width:1280,height:900});
  await page.goto(origin+'/app/modules/slay/');
  await page.getByRole('heading',{name:'罗小黑战记·重生之门',exact:true}).waitFor();
  await page.getByRole('button',{name:'开始',exact:true}).click();
  const hasRun=await page.evaluate(async()=>{const bridge=await import('/app/modules/slay/game/shared-progress.js');await bridge.flushSharedProgress();const game=await import('/shared/shared-session/game.js');return Boolean((await game.readMode('slay')).snapshot.storage['lxz-rebirth-run-v1']);});
  assert(hasRun,'Slay native gameplay did not checkpoint to the shared mode slot');
  await page.reload();await page.getByRole('button',{name:'继续游戏',exact:true}).waitFor();
  await page.getByRole('button',{name:'继续游戏',exact:true}).click();
  await page.goto(origin+'/app/modules/slay/collection.html');
  await page.getByRole('heading',{name:/角色图鉴/}).first().waitFor();
  assert((await page.getByRole('heading',{name:/角色图鉴/}).first().innerText()).includes('439'),'collection uses an outdated role count');
  await page.goto(origin+'/app/modules/slay/stats.html');
  await page.getByRole('heading',{name:'修行总览',exact:true}).waitFor();
  assert.deepEqual(attemptedUpstream,[],'statistics contacted the upstream game API');
  assert.deepEqual(errors,[],'page runtime errors');
  console.log(JSON.stringify({passed:8,failed:0,checks:['journey desktop','cross-mode cards','complete export','mobile layout','native Slay checkpoint','native Slay resume','canonical collection','local statistics'],screenshots:output}));
}catch(error){console.error(JSON.stringify({errors,failed:failed.slice(-10),body:await diagnosticPage?.locator('body').innerText().catch(()=>'' ),state:await diagnosticPage?.evaluate(async()=>({scripts:[...document.scripts].map(s=>s.src),locks:await navigator.locks.query(),databases:await indexedDB.databases()})).catch(()=>null)}));throw error;}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
