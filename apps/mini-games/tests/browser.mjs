// Uses a disposable static build + mock OC endpoints. Never opens real user data.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { buildMiniGames } from '../build.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MINI_GAMES_PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url));
const stage=await mkdtemp(path.join(tmpdir(),'gate-mini-games-browser-'));
const evidence=process.env.MINI_GAMES_EVIDENCE_DIR||path.join(stage,'screenshots');
await mkdir(evidence,{recursive:true});buildMiniGames(path.join(stage,'modules'));
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname);
    let base,relative;
    if(name.startsWith('/app/modules/mini-games/')){base=path.join(stage,'modules');relative=name.slice('/app/modules/mini-games/'.length)||'index.html';}
    else if(name.startsWith('/shared/')){base=path.join(root,'packages');relative=name.slice(8);}
    else if(name==='/app/portal.json'){base=path.join(root,'apps/shell');relative='portal.json';}
    else if(name.startsWith('/app/shell/')){base=path.join(root,'apps/shell');relative='index.html';}
    else{res.writeHead(404);res.end();return;}
    const file=path.resolve(base,relative),check=path.relative(base,file);
    if(check.startsWith('..')||path.isAbsolute(check)){res.writeHead(403);res.end();return;}
    const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="44" height="64"><rect x="8" y="8" width="28" height="48" rx="10" fill="#95554c"/><circle cx="17" cy="25" r="2" fill="white"/><circle cx="27" cy="25" r="2" fill="white"/></svg>';
const state={owner:'a',guest:false,empty:false,fail:false,broken:false};
const reports=[];let failRank=false;
const errors=[];
try{
  const context=await browser.newContext({viewport:{width:1200,height:900}});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/gate/identity')return route.fulfill({json:state.guest?{logged_in:false}:{logged_in:true,owner:{kind:'local',user_id:state.owner}}});
    if(url.pathname==='/api/gate/ocs')return route.fulfill(state.fail?{status:503,json:{error:'test failure'}}:{json:{ocs:state.empty?[]:[{id:'oc-'+state.owner,name:state.owner==='a'?'小禾':'小川',species_type:'妖精',species_detail:'草木',avatar_asset_id:'/assets/uploads/'+(state.broken?'broken':'oc')+'.png',images:[]}]}});
    if(url.pathname==='/api/uploads/preview')return route.fulfill(state.broken?{status:404,body:''}:{contentType:'image/svg+xml',body:svg});
    if(url.pathname==='/api/progress/report'){reports.push(route.request().postDataJSON());return route.fulfill(failRank?{status:503,json:{error:'offline'}}:{json:{ok:true,ranked:true,awarded:[]}});}
    if(url.pathname==='/api/progress/boards')return route.fulfill({json:{boards:[{board:'oc-run',name:'OC 快跑'},{board:'oc-run-coins',name:'OC 快跑 · 金币'},{board:'frog-crossing',name:'青蛙过河'}]}});
    if(url.pathname==='/api/progress/me')return route.fulfill({json:{logged_in:false}});
    if(url.pathname==='/api/progress/chains')return route.fulfill({json:{logged_in:false,chains:[]}});
    if(url.pathname==='/api/progress/leaderboard')return route.fulfill({json:{name:'OC 快跑 · 金币',metric:'单局金币数，同数量比较距离',unit:'枚',logged_in:true,rows:[{rank:1,name:'测试玩家',score:15,distance:900,level:0,me:true,wins:0}],mine:{rank:1,score:15,distance:900}}});
    if(url.pathname==='/api/sso-user')return route.fulfill({json:{logged_in:false}});
    if(url.origin!==origin)return route.fulfill({status:404,body:''});
    return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const ready=async()=>{await page.waitForFunction(()=>!document.getElementById('start').disabled);};
  await page.goto(origin+'/app/modules/mini-games/?game=runner');await ready();
  check(await page.locator('#map-list button').count()===3,'two playable maps and one coming-soon entry');
  check(await page.locator('input[type=file]').count()===0,'no upload controls');
  check(!/商店|钱包|养成|上传地图/.test(await page.locator('body').innerText()),'excluded systems absent');
  check(await page.locator('#oc-list').innerText()==='小禾\n妖精 · 草木','owned OC renders');
  check(await page.getByRole('button',{name:'更多地图 · 敬请期待',exact:true}).isDisabled(),'unreleased map cannot be selected');
  check(await page.getByRole('button',{name:'太空地图',exact:true}).count()===0,'space map removed');
  await page.getByRole('button',{name:'经典小恐龙',exact:true}).click();
  check(await page.getByRole('button',{name:'经典小恐龙',exact:true}).getAttribute('aria-pressed')==='true','classic desert is playable');
  await page.screenshot({path:path.join(evidence,'runner-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'默认地图',exact:true}).click();await page.waitForTimeout(200);
  // Neutral map-only covers for the hall: no mock/user OC artwork is published.
  await page.evaluate(async()=>{const {drawRunner,prepareCanvas,loadMap}=await import('./src/graphics.js');const {RUNNER_MAPS}=await import('./src/maps.js');const {createRunner}=await import('./src/runner.js');const c=document.getElementById('preview');drawRunner(prepareCanvas(c,720,320),720,320,createRunner(),RUNNER_MAPS[0],await loadMap(RUNNER_MAPS[0]),null,true);});
  if(process.env.MINI_GAMES_WRITE_COVERS==='1')await page.locator('#preview').screenshot({path:path.join(root,'apps/mini-games/assets/runner-preview.png')});
  await page.locator('#start').click();await page.waitForSelector('#play:not([hidden])');
  await page.keyboard.press('Space');await page.waitForTimeout(120);await page.keyboard.press('Space');
  await page.locator('#pause').click();check(await page.locator('#overlay-title').innerText()==='休息一下','runner pauses');
  const score=await page.locator('#score').innerText();await page.waitForTimeout(150);check(await page.locator('#score').innerText()===score,'paused score stays fixed');
  check(Number(score)>0,'runner advances and scores');
  await page.locator('#continue').click();await page.locator('#overlay').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.getElementById('overlay-title').textContent==='这一程，辛苦了'&&!document.getElementById('overlay').hidden,{},{timeout:15000});
  check(true,'runner collision reaches result screen');
  await page.locator('#continue').click();await page.locator('#overlay').waitFor({state:'hidden'});
  await page.locator('#pause').click();await page.locator('#choose-again').click();
  const best=await page.locator('#best').innerText();await page.reload();await ready();check(await page.locator('#best').innerText()===best,'best survives refresh');
  await page.locator('#start').click();await page.waitForSelector('#play:not([hidden])');
  state.owner='b';await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.getElementById('oc-list').textContent.includes('小川'));await ready();
  check(await page.locator('#play').isHidden(),'account change leaves old game');check((await page.locator('#best').innerText()).includes('0 分'),'account records isolated');
  state.fail=true;await page.locator('#refresh-ocs').click();await page.waitForFunction(()=>document.getElementById('oc-status').textContent.includes('暂时无法'));
  check(await page.locator('#start').isDisabled(),'network failure cannot start');
  state.fail=false;state.empty=true;await page.locator('#refresh-ocs').click();await page.waitForFunction(()=>document.getElementById('oc-status').textContent.includes('还没有登记'));
  await page.locator('#start:not([disabled])').waitFor();
  check((await page.locator('#image-status').innerText()).includes('默认角色'),'empty roster uses provided default character');
  await page.locator('#start').click();await page.locator('#play:not([hidden])').waitFor();
  check((await page.locator('#playing-as').innerText()).includes('默认角色'),'default character can play runner');
  await page.locator('#leave').click();
  state.empty=false;state.guest=true;await page.locator('#refresh-ocs').click();await page.waitForSelector('#login:not([hidden])');await page.locator('#start:not([disabled])').waitFor();check((await page.locator('#image-status').innerText()).includes('默认角色'),'guest can use default character');
  await page.locator('#start').click();await page.locator('#play:not([hidden])').waitFor();await page.locator('#pause').click();await page.locator('#continue').click();
  await page.locator('#overlay').waitFor({state:'hidden'});check(await page.locator('#overlay').isHidden(),'guest fallback resumes without login');await page.locator('#leave').click();
  state.guest=false;state.broken=true;await page.locator('#refresh-ocs').click();await page.waitForFunction(()=>document.getElementById('image-status').textContent.includes('无法读取'));
  check(await page.locator('#start').isDisabled(),'broken picture cannot start');
  state.broken=false;await page.locator('#refresh-ocs').click();await ready();
  await page.goto(origin+'/app/modules/mini-games/?game=crossing');await ready();
  check(await page.locator('#map-list button').count()===2,'original two crossing boards');
  await page.evaluate(async()=>{const {drawCrossing,prepareCanvas}=await import('./src/graphics.js');const {createCrossing}=await import('./src/crossing.js');const c=document.getElementById('preview');drawCrossing(prepareCanvas(c,396,484),createCrossing('crossing-river'),null,true);});
  if(process.env.MINI_GAMES_WRITE_COVERS==='1')await page.locator('#preview').screenshot({path:path.join(root,'apps/mini-games/assets/crossing-preview.png')});
  await page.locator('#start').click();await page.waitForSelector('#play:not([hidden])');
  await page.getByRole('button',{name:'向左',exact:true}).click();await page.waitForTimeout(150);await page.keyboard.press('ArrowRight');await page.waitForTimeout(150);
  await page.locator('#pause').click();check(await page.locator('#overlay').isVisible(),'crossing pauses');
  await page.screenshot({path:path.join(evidence,'crossing-desktop.png'),fullPage:true});
  await page.locator('#choose-again').click();await page.getByRole('button',{name:'林间小河',exact:true}).click();await page.locator('#start').click();await page.waitForSelector('#play:not([hidden])');
  check((await page.locator('#playing-as').innerText()).includes('林间小河'),'river map selected');
  await page.locator('#pause').click();await page.locator('#choose-again').click();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(evidence,'crossing-mobile.png'),fullPage:true});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile crossing no horizontal overflow');
  await page.locator('#start').click();await page.waitForSelector('#play:not([hidden])');
  const canvas=page.locator('#game-canvas'),box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height*.8);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2,box.y+box.height*.6,{steps:4});await page.mouse.up();
  await page.waitForTimeout(150);await page.locator('#pause').click();await page.locator('#choose-again').click();
  await page.goto(origin+'/app/modules/mini-games/?game=runner');await ready();await page.screenshot({path:path.join(evidence,'runner-mobile.png'),fullPage:true});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile runner no horizontal overflow');
  await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  await page.locator('#start').click();await page.waitForSelector('#play:not([hidden])');
  check(true,'bfcache return keeps controls usable');await page.locator('#pause').click();await page.locator('#choose-again').click();
  const beforeCoins=reports.length;
  await page.locator('#runner-mode').selectOption('coins');
  check(await page.locator('#difficulty').isDisabled(),'coin mode fixes normal difficulty');
  check((await page.locator('#leaderboard').getAttribute('href')).includes('oc-run-coins'),'coin mode opens its own leaderboard');
  check(!/钱包|商店|开局携带/.test(await page.locator('body').innerText()),'coin mode has no wallet, shop or carried loadout');
  failRank=true;await page.locator('#start').click();await page.locator('#play:not([hidden])').waitFor();
  await page.waitForTimeout(800);await page.locator('#pause').click();
  check((await page.locator('#coin-stats').innerText()).includes('金币'),'coin HUD renders');
  await page.screenshot({path:path.join(evidence,'coins-mobile.png'),fullPage:true});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile coin mode fits viewport');
  check(reports.length===beforeCoins,'pause does not submit a finished score');
  await page.locator('#continue').click();
  await page.locator('#retry-rank:not([hidden])').waitFor({timeout:15000});
  const coinReport=reports.at(-1);
  check(coinReport.game==='oc-run-coins'&&coinReport.score>0&&Number.isInteger(coinReport.distance)&&coinReport.finished,'coin result submits distance and coin score');
  failRank=false;await page.locator('#retry-rank').click();await page.waitForFunction(()=>document.getElementById('rank-status').textContent.includes('已提交'));
  check(reports.at(-1).ref===coinReport.ref,'retry reuses the stable run id');
  await page.locator('#choose-again').click();
  await page.locator('#runner-mode').selectOption('classic');check(await page.locator('#difficulty').isEnabled(),'classic difficulty restored');
  await page.goto(origin+'/shared/shared-ui/leaderboard/index.html?board=oc-run-coins');
  await page.locator('#rows .score').waitFor();
  check((await page.locator('#rows').innerText()).includes('15 枚')&&(await page.locator('#rows').innerText()).includes('距离 900'),'shared leaderboard displays coins and distance');
  check((await page.locator('#mine').innerText()).includes('距离 900'),'personal rank shows matching distance');
  await page.screenshot({path:path.join(evidence,'coins-leaderboard.png'),fullPage:true});
  await page.setViewportSize({width:1200,height:900});
  await page.goto(origin+'/app/shell/m/oc-run');const frame=page.frameLocator('iframe.view');await frame.locator('#start:not([disabled])').waitFor();
  check(await frame.locator('#game-title').innerText()==='OC 快跑','shell mounts registered runner');
  await page.locator('#iridescently-shell-navlinks a[href="/app/shell/m/frog-crossing"]').click();
  await page.frameLocator('iframe.view').locator('#game-title').filter({hasText:'青蛙过河'}).waitFor();
  check(true,'shell switches to crossing');
  state.empty=true;
  await page.goto(origin+'/app/modules/mini-games/?game=crossing');await page.locator('#start:not([disabled])').waitFor();
  check((await page.locator('#image-status').innerText()).includes('默认角色'),'crossing uses default when roster is empty');
  await page.locator('#start').click();await page.locator('#play:not([hidden])').waitFor();
  check((await page.locator('#playing-as').innerText()).includes('默认角色'),'default character can play crossing');
  await page.addInitScript(()=>Object.defineProperty(navigator,'maxTouchPoints',{get:()=>1}));
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin+'/app/shell/m/oc-run');await page.frameLocator('iframe.view').locator('#start:not([disabled])').waitFor();
  check(await page.locator('#__qc_rotate.on').count()===0,'runner shell permits portrait touch screens');
  await page.locator('#iridescently-shell-navlinks a[href="/app/shell/m/frog-crossing"]').click();
  await page.frameLocator('iframe.view').locator('#start:not([disabled])').waitFor();
  check(await page.locator('#__qc_rotate.on').count()===0,'crossing shell permits portrait touch screens');
  await page.goto(origin+'/app/shell/m/slay');await page.locator('#__qc_rotate.on').waitFor();
  check(await page.locator('#__qc_rotate').isVisible(),'other games retain portrait orientation hint');
  await page.goto(origin+'/app/shell/m/oc-run');await page.frameLocator('iframe.view').locator('#start:not([disabled])').waitFor();
  check(await page.locator('#__qc_rotate.on').count()===0,'returning to runner clears orientation hint');
  // Render deterministic effect fixtures through the production renderer on every map/device.
  state.empty=false;
  const visual=await context.newPage();await visual.goto(origin+'/app/modules/mini-games/?game=runner');
  await visual.locator('#start:not([disabled])').waitFor();await visual.locator('#start').click();await visual.locator('#play:not([hidden])').waitFor();await visual.locator('#pause').click();
  for(const width of [390,1200]){
    await visual.setViewportSize({width,height:900});
    for(const mapId of ['default','local-chrome-desert-v1']){
      const result=await visual.evaluate(async mapId=>{
        const {drawRunner,prepareCanvas,loadMap,loadImage}=await import('./src/graphics.js');
        const {RUNNER_MAPS}=await import('./src/maps.js');const {createRunner,resizeRunner,OBSTACLES}=await import('./src/runner.js');
        const {applyItem}=await import('./src/coins.js');const map=RUNNER_MAPS.find(m=>m.id===mapId),images=await loadMap(map);
        const canvas=document.getElementById('game-canvas'),w=canvas.clientWidth,h=canvas.clientHeight;
        canvas.width=1;const character=await loadImage(new URL('./assets/default-character.png',location.href).href);
        const game=createRunner('normal','coins');resizeRunner(game,w);game.viewHeight=h;game.time=1.25;game.y=-45;
        for(const key of ['magnet','jetpack','shield','double'])applyItem(game,key);game.effects.grace=1;
        game.feedback.push({kind:'magnetCollect',x:w*.65,y:-90,value:2,time:1.15},{kind:'shieldBreak',x:w*.16+24,y:-75,time:1.1});
        game.obstacles=[{type:'tall',x:w*.55,...OBSTACLES.tall},{type:'short',x:w*.8,...OBSTACLES.short}];
        game.collectibles=[{kind:'coin',x:w*.72,y:-130},{kind:'magnet',x:w*.85,y:-90}];
        document.getElementById('overlay').hidden=true;
        drawRunner(prepareCanvas(canvas,w,h),w,h,game,map,images,character,false);
        const calls=[],drawImage=g=>g.drawImage;
        const pen=canvas.getContext('2d'),original=drawImage(pen);
        pen.drawImage=function(image,...args){if(['short','tall','wide','air'].some(key=>images[key]===image)&&args.length===8)calls.push(args);return original.call(this,image,...args);};
        const sample=createRunner();sample.obstacles=Object.entries(OBSTACLES).map(([type,size],i)=>({type,x:20+i*80,...size}));
        drawRunner(pen,w,h,sample,map,images,character,true);pen.drawImage=original;
        const proportional=calls.every(a=>Math.abs(a[6]/a[7]-a[2]/a[3])<.000001);
        drawRunner(prepareCanvas(canvas,w,h),w,h,game,map,images,character,false);
        const animated=canvas.toDataURL();drawRunner(prepareCanvas(canvas,w,h),w,h,game,map,images,character,true);
        const distinct=animated!==canvas.toDataURL();drawRunner(prepareCanvas(canvas,w,h),w,h,game,map,images,character,false);
        return {distinct,proportional,overflow:document.documentElement.scrollWidth>innerWidth};
      },mapId);
      check(result.proportional,'obstacle sprites keep aspect ratio '+mapId+' at '+width);
      check(result.distinct&&!result.overflow,'effect renderer and reduced motion '+mapId+' at '+width);
      await visual.locator('#board').screenshot({path:path.join(evidence,'effects-'+mapId+'-'+width+'.png')});
    }
  }
  await visual.close();
  check(errors.length===0,`browser errors: ${errors.join('; ')}`);
  console.log(JSON.stringify({passed:checks,screenshots:evidence},null,2));
  await context.close();
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
  // The only removed tree is this process's own mkdtemp build.
  if(!path.basename(stage).startsWith('gate-mini-games-browser-'))throw new Error('Invalid temporary build root');
  if(!evidence.startsWith(stage+path.sep))await rm(stage,{recursive:true,force:true});
}
