import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(path.resolve(root,'../management/package.json'));
const {chromium}=require('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
// Prevent the host page's smooth auto-scroll moving iframe coordinates during automation.
const context=await browser.newContext({viewport:{width:1440,height:1080},reducedMotion:'reduce'});
const page=await context.newPage(),errors=[],results=[];
page.on('pageerror',error=>errors.push(error.message));
page.setDefaultTimeout(30000);
const output=path.join(root,'docs/verification');mkdirSync(output,{recursive:true});
const base=process.env.VERIFY_URL||'http://127.0.0.1:5182';
async function enter(){await page.getByRole('button',{name:'进入众生之门',exact:true}).click();await page.locator('.gate').waitFor({state:'detached'});}
async function readSave(){return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('zszm-adventure-v1',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('saves','readonly'),q=tx.objectStore('saves').get('current');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);tx.oncomplete=()=>db.close();};r.onerror=()=>reject(r.error);}));}
async function management(){
  await page.getByRole('navigation',{name:'游戏导航'}).getByRole('button',{name:'据点经营',exact:true}).click();
  const handle=await page.locator('iframe[title="灵境据点经营"]').elementHandle(),frame=await handle.contentFrame();
  await frame.waitForFunction(()=>window.__lingjing?.ready);await frame.evaluate(()=>window.__lingjing.ready);
  if(!(await frame.evaluate(()=>window.__lingjing.state().paused)))await frame.getByRole('button',{name:'暂停',exact:true}).click();
  return frame;
}
try{
  await page.goto(base,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'进入众生之门',exact:true}).waitFor();
  await page.waitForFunction(()=>Number(document.querySelector('.reference-webgl')?.dataset.frame)>=143);
  await page.screenshot({path:path.join(output,'opening-restored.png')});await enter();
  assert.equal(await page.getByRole('navigation',{name:'三大玩法'}).getByRole('button').count(),3);
  results.push('Restored opening and all three module entries load');
  let frame=await management();
  const initial=await frame.evaluate(()=>({resources:window.__lingjing.state().resources,count:window.__lingjing.state().buildings.length}));
  assert.equal(await frame.evaluate(()=>window.__lingjing.engine.renderer.isWebGLRenderer),true);
  await frame.locator('.build-item[data-id="campfire"]').click();
  await frame.locator('#game-canvas').scrollIntoViewIfNeeded();
  const target=await frame.evaluate(()=>{
    const e=window.__lingjing.engine,s=window.__lingjing.state();
    for(const t of s.space.tiles){if(t.resource||t.buildingId||t.x<3||t.y<3||t.x>s.space.width-4||t.y>s.space.height-4)continue;
      e.setMouse(t.x,t.y,true);if(!e.placementCheck().ok)continue;
      const point=e.target.clone().set(t.x+.5,0,t.y+.5).project(e.camera);
      if(Math.abs(point.x)<.7&&Math.abs(point.y)<.7){
        const rect=e.canvas.getBoundingClientRect();
        const x=(point.x+1)*rect.width/2,y=(1-point.y)*rect.height/2;
        if(document.elementFromPoint(rect.left+x,rect.top+y)!==e.canvas)continue;
        const pick=e.screenToGrid(rect.left+x,rect.top+y);
        if(pick.gx!==t.x||pick.gy!==t.y)throw new Error(`Projection mismatch ${JSON.stringify({tile:t,pick,rect:rect.toJSON(),width:e.width,height:e.height})}`);
        return {x,y,gx:t.x,gy:t.y};}}
    throw new Error('No visible empty construction tile');
  });
  await frame.locator('#game-canvas').click({position:{x:target.x,y:target.y}});
  const clicked=await frame.evaluate(()=>({count:window.__lingjing.state().buildings.length,mouse:window.__lingjing.engine.mouse,check:window.__lingjing.engine.placementCheck(),width:window.__lingjing.engine.width,height:window.__lingjing.engine.height}));
  assert.equal(clicked.count,initial.count+1,JSON.stringify({target,clicked}));
  await frame.getByRole('button',{name:'取消',exact:true}).click();
  await frame.getByRole('button',{name:'放大',exact:true}).click();
  assert.ok(await frame.evaluate(()=>window.__lingjing.engine.camera.zoom>1));
  await frame.getByRole('button',{name:'复位视角',exact:true}).click();
  await frame.getByRole('button',{name:'存档',exact:true}).click();
  await frame.locator('#canvas-wrap').screenshot({path:path.join(output,'management-map.png')});
  results.push('Three.js map, grid construction, camera zoom/reset and save work');
  await frame.getByRole('button',{name:'合成',exact:true}).click();
  await frame.getByRole('button',{name:'灵体拼装 · 实验室',exact:true}).click();
  await frame.locator('.workshop-preview canvas').waitFor();
  await frame.getByRole('combobox',{name:'基础形态',exact:true}).selectOption('whale');
  await frame.getByRole('button',{name:'保存草稿',exact:true}).click();
  assert.equal(await frame.evaluate(()=>JSON.parse(localStorage.getItem('lxh-spirit-workshop-v1')).preset),'whale');
  await frame.locator('.spirit-workshop').screenshot({path:path.join(output,'spirit-workshop.png')});
  await frame.getByRole('button',{name:'关闭灵体拼装',exact:true}).click();
  results.push('Experimental spirit assembly opens, changes presets and saves');
  // Leave with a new unsaved action; pagehide must preserve this pause/speed state.
  await frame.getByRole('button',{name:'1×',exact:true}).click();
  const before=await frame.evaluate(()=>window.__lingjing.state().resources);
  await page.getByRole('navigation',{name:'游戏导航'}).getByRole('button',{name:'灵境生态',exact:true}).click();
  const eco=await (await page.locator('iframe[title="灵境生态模拟"]').elementHandle()).contentFrame();
  await eco.getByRole('button',{name:'收获并送回会馆',exact:true}).waitFor();
  await eco.waitForFunction(()=>{const raw=localStorage.getItem('zszm-ecology-v2');return raw&&JSON.parse(raw).ecology.harvest.food>=1;},null,{timeout:40000});
  await eco.getByRole('button',{name:'收获并送回会馆',exact:true}).click();
  await eco.getByRole('status').filter({hasText:'已送回主入口'}).waitFor();
  const packet=await eco.evaluate(()=>JSON.parse(localStorage.getItem('zszm-ecology-v2')).ecology.lastExport);
  let save=await readSave();assert.ok(save.meta.ecoIndividuals.length>0);assert.equal(save.ecoDeliveries.length,1);
  await page.reload({waitUntil:'networkidle'});await enter();
  save=await readSave();assert.equal(save.ecoDeliveries.length,1);assert.ok(save.meta.ecoIndividuals.length>0);
  frame=await management();
  assert.equal(await frame.evaluate(()=>window.__lingjing.state().speed),1);
  await page.waitForFunction(()=>document.querySelector('.view-management .ecology-summary')?.textContent.includes('待入库 0'));
  const after=await frame.evaluate(()=>window.__lingjing.state().resources);
  for(const key of ['food','herb','spirit'])assert.ok(Math.abs(after[key]-before[key]-packet.resources[key])<.001,`${key} credited once`);
  await frame.evaluate(p=>window.postMessage({type:'zszm:deliver-ecology',packet:p},location.origin),packet);
  const same=await frame.evaluate(()=>window.__lingjing.state().resources);assert.deepEqual(same,after);
  // A repeated JSON file import reaches the reducer and is rejected.
  await frame.getByLabel('导入生态收获',{exact:true}).setInputFiles({name:'harvest.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(packet))});
  assert.match(await frame.locator('#ecology-import [role=status]').textContent(),/已经领取/);
  results.push(`Ecology harvest survives refresh, credits base once and creates ${save.meta.ecoIndividuals.length} cards`);
  await page.setViewportSize({width:390,height:844});
  await page.locator('iframe[title="灵境据点经营"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'management-mobile.png')});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await frame.getByRole('button',{name:'营造',exact:true}).click();await frame.getByRole('button',{name:'关闭营造面板',exact:true}).click();
  results.push('390px layout has no horizontal overflow and mobile panel controls work');
  assert.deepEqual(errors,[]);
  writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({base,results,errors,packet,inventoryBefore:before,inventoryAfter:after},null,2));
  console.log(JSON.stringify({results,errors},null,2));
}catch(error){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({results,errors,error:String(error)},null,2));throw error;}
finally{await context.close();await browser.close();}
