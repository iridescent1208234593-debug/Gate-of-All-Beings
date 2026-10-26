import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { DEFAULT_SPIRIT_SETTINGS } from '../src/games/spirit-playground/settings.js';
const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
const room = process.env.TEST_ROOM || `test-${Date.now().toString(36)}`;
await mkdir('artifacts', {recursive: true});
const api = `${base}/api/spirit-settings`;
const original = await (await fetch(api)).json();
let lastTestSave = DEFAULT_SPIRIT_SETTINGS;
const put = async config => {
  const response = await fetch(api, {method:'PUT', headers:{'Content-Type':'application/json'},body:JSON.stringify(config)});
  assert.equal(response.status,200); lastTestSave = await response.json(); return lastTestSave;
};
const report = {url:base,checks:[],errors:[],screenshots:[]};
const check = (name,evidence={}) => {report.checks.push({name,evidence});console.log(`PASS ${name}`);};
let browser, page;
try {
  await put(DEFAULT_SPIRIT_SETTINGS);
  browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
  const context = await browser.newContext({viewport:{width:1440,height:980},deviceScaleFactor:1,acceptDownloads:true});
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
  page = await context.newPage();
  page.on('pageerror',error=>report.errors.push(error.message));
  const ready = () => page.waitForFunction(()=>window.__SPIRIT__?.getDiagnostics().frames>10,null,{timeout:60000});
  const diag = () => page.evaluate(()=>window.__SPIRIT__.getDiagnostics());
  const waitFrames = async count => {const f=(await diag()).frames;await page.waitForFunction(start=>window.__SPIRIT__.getDiagnostics().frames>=start,f+count,{timeout:20000});};
  const point = () => page.evaluate(()=>{
    const {spirit,camera}=window.__SPIRIT__;
    spirit.root.updateWorldMatrix(true,true);camera.updateMatrixWorld();
    const p=spirit.root.position.clone().set(0.45,1.2,0.9);
    spirit.skin.root.localToWorld(p);p.project(camera);
    const r=document.querySelector('.spirit-canvas').getBoundingClientRect();
    return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
  });
  const reset = async()=>{
    await page.getByRole('button',{name:'回到场地中央',exact:true}).click();
    await page.waitForFunction(()=>{
      const d=window.__SPIRIT__.getDiagnostics(),entity=d.serverSnapshot?.entities.find(value=>value.id===d.network.selfId);
      return entity&&Math.hypot(entity.position.x,entity.position.z)<0.03;
    },null,{timeout:3000});
    await waitFrames(2);
  };
  await page.goto(`${base}/games/spirit-playground?test=1&room=${encodeURIComponent(room)}`,{waitUntil:'domcontentloaded'});await ready();
  assert.equal((await diag()).backend,'native-WebGPU');assert.equal((await diag()).skin,'softie-spirit');
  assert.equal(await page.locator('#spirit-room-code').inputValue(),room);
  const joinedRoom=`j-${Date.now().toString(36)}`;
  await page.locator('#spirit-room-code').fill(joinedRoom);await page.locator('.spirit-room-join').click();
  await page.waitForFunction(expected=>window.__SPIRIT__.getDiagnostics().network?.roomId===expected
    &&window.__SPIRIT__.getDiagnostics().network?.connected,joinedRoom,{timeout:5000});
  assert.equal(new URL(page.url()).searchParams.get('room'),joinedRoom);
  await page.getByText(`已加入房间 ${joinedRoom}，复制邀请链接即可找朋友相聚。`,{exact:true}).waitFor();
  await page.locator('.spirit-room-share').click();
  const invitation=await page.evaluate(()=>navigator.clipboard.readText());
  assert.equal(new URL(invitation).searchParams.get('room'),joinedRoom);
  await page.locator('#spirit-room-code').fill('invalid room!');await page.locator('.spirit-room-join').click();
  assert.equal((await diag()).network.roomId,joinedRoom);
  check('room code switches the authoritative session and rejects invalid room names');
  assert.equal(await page.evaluate(()=>window.__SPIRIT__.spirit.skin.slime.gel.transmission),0);
  await page.screenshot({path:'artifacts/spirit-softie-desktop.png',fullPage:true});report.screenshots.push('artifacts/spirit-softie-desktop.png');
  check('native WebGPU renders the deformable spirit with a matte outlined skin');

  await page.locator('#spirit-skin').selectOption('bud');await waitFrames(4);
  assert.equal((await diag()).skin,'bud-spirit');
  assert.equal(await page.evaluate(()=>window.__SPIRIT__.spirit.skin.leaves.name),'bud-leaves');
  assert.equal(await page.locator('#spirit-eyeSize').isDisabled(),false);
  assert.equal(await page.locator('#spirit-earSize').isDisabled(),true);
  await page.locator('#spirit-skin').selectOption('softie');await waitFrames(4);
  assert.equal((await diag()).skin,'softie-spirit');
  check('selectable bud skin swaps in and out while preserving the default softie');

  const drawing=await page.locator('.spirit-draw-canvas').boundingBox();
  await page.mouse.move(drawing.x+drawing.width*0.5,drawing.y+drawing.height*0.2);await page.mouse.down();
  for(let i=1;i<=20;i++) {
    const angle=-Math.PI/2+i*Math.PI*2/20;
    await page.mouse.move(drawing.x+drawing.width*(0.5+0.3*Math.cos(angle)),drawing.y+drawing.height*(0.5+0.32*Math.sin(angle)),{steps:2});
  }
  await page.mouse.up();await page.locator('.spirit-draw-generate').click();
  await page.waitForFunction(()=>window.__SPIRIT__.getDiagnostics().skin==='custom-drawn-spirit',null,{timeout:5000});
  const custom=await diag();assert.equal(custom.settings.bodyShape.points.length,40);
  assert.equal(custom.settings.skin,'custom');
  assert.ok(await page.evaluate(()=>window.__SPIRIT__.spirit.skin.slime.body.geometry.attributes.position.count<2000));
  await page.locator('[data-draw-mode="brush"]').click();await page.locator('.spirit-draw-clear').click();
  const brushY=drawing.y+drawing.height*0.5;
  await page.mouse.move(drawing.x+drawing.width*0.25,brushY);await page.mouse.down();
  await page.mouse.move(drawing.x+drawing.width*0.72,brushY+20,{steps:20});await page.mouse.up();
  await page.locator('.spirit-draw-generate').click();
  await page.getByText(/已生成灵体身体（40 个物理轮廓点）/).waitFor();
  assert.equal((await diag()).settings.bodyShape.points.length,40);
  await page.locator('#spirit-skin').selectOption('softie');await waitFrames(4);
  check('outline and solid drawing create bounded custom softie bodies through the existing deformation skin');

  const hit=await point();await page.mouse.move(hit.x,hit.y);await page.mouse.down();
  await page.waitForFunction(()=>window.__SPIRIT__.getDiagnostics().physics.dragging,null,{timeout:3000});await waitFrames(20);
  const held=await diag();assert.equal(held.physics.dragging,true);assert.ok(held.physics.deformation>0.015);
  await page.mouse.move(hit.x+100,hit.y-100,{steps:15});await waitFrames(15);
  const dragged=await diag();assert.ok(dragged.physics.position.x>0.3 || dragged.physics.position.y>0.2);
  await page.screenshot({path:'artifacts/spirit-softie-grab.png',fullPage:true});
  await page.mouse.up();await page.waitForFunction(()=>!window.__SPIRIT__.spirit.physics.diagnostics.dragging);
  await page.waitForFunction(()=>window.__SPIRIT__.spirit.physics.diagnostics.deformation<0.005,null,{timeout:15000});
  check('real mouse hold deforms locally, dragging lifts, and release springs back',{held:held.physics.deformation,dragged:dragged.physics.position});

  const speeds=[];
  for(const keys of [['KeyD'],['KeyD','KeyW']]) {
    await reset();for(const key of keys)await page.keyboard.down(key);await waitFrames(50);
    const d=await diag(),entity=d.serverSnapshot.entities.find(value=>value.id===d.network.selfId);
    speeds.push(Math.hypot(entity.velocity.x,entity.velocity.z));
    for(const key of keys)await page.keyboard.up(key);
  }
  assert.ok(Math.abs(speeds[0]-speeds[1])/speeds[0]<0.08, `straight and diagonal speeds differed: ${speeds.join(', ')}`);
  const moving=await diag();await waitFrames(4);const glide=await diag();
  assert.ok(glide.physics.velocity.x>0 && glide.physics.velocity.x<moving.physics.velocity.x);
  check('WASD resumes after grabbing, diagonals match, and release retains inertia',{speeds});

  await page.getByRole('textbox',{name:'灵体昵称',exact:true}).focus();
  const editing=(await diag()).physics.position;await page.keyboard.press('w');await waitFrames(12);
  const stopped=await diag();
  assert.ok(Math.hypot(stopped.physics.position.x-editing.x,stopped.physics.position.z-editing.z)<0.05);
  assert.deepEqual(stopped.input.keys,[]);assert.deepEqual(stopped.physics.drive,{x:0,z:0});
  await page.locator('.spirit-canvas').focus();await page.keyboard.down('KeyW');await waitFrames(8);
  await page.evaluate(()=>window.dispatchEvent(new FocusEvent('blur')));await page.keyboard.up('KeyW');
  await page.waitForFunction(()=>{
    const d=window.__SPIRIT__.getDiagnostics(),entity=d.serverSnapshot?.entities.find(value=>value.id===d.network.selfId);
    return d.input.keys.length===0&&entity&&Math.hypot(entity.drive.x,entity.drive.z,entity.velocity.x,entity.velocity.z)<0.01;
  },null,{timeout:3000});
  await reset();const h=await point();await page.mouse.move(h.x,h.y);await page.mouse.down();await waitFrames(3);
  await page.getByRole('textbox',{name:'灵体昵称',exact:true}).focus();
  assert.equal((await diag()).pointer.pointerId,null);
  await page.waitForFunction(()=>!window.__SPIRIT__.getDiagnostics().physics.dragging,null,{timeout:3000});await page.mouse.up();
  check('panel focus and window blur clear keyboard and pointer ownership');

  const config={...DEFAULT_SPIRIT_SETTINGS,name:'自定义小灵',color:'#b59ada',size:1.25,stiffness:0.6,damping:0.7,opacity:0.72,acceleration:25};
  await page.getByRole('textbox',{name:'灵体昵称',exact:true}).fill(config.name);
  for(const key of ['color','size','stiffness','damping','opacity','acceleration']) await page.locator(`#spirit-${key}`).evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},String(config[key]));
  await page.waitForFunction(expected=>{
    const d=window.__SPIRIT__.getDiagnostics(),entity=d.serverSnapshot?.entities.find(value=>value.id===d.network.selfId);
    return JSON.stringify(d.settings)===JSON.stringify(expected)&&d.physics.config.stiffness===expected.stiffness
      &&entity&&JSON.stringify(entity.settings)===JSON.stringify(expected);
  },config,{timeout:5000});
  const tuned=await diag();assert.deepEqual(tuned.settings,config);
  assert.equal(tuned.physics.config.stiffness,config.stiffness);assert.equal(tuned.input.acceleration,config.acceleration);
  assert.equal(await page.evaluate(()=>window.__SPIRIT__.spirit.skin.root.scale.x),config.size);
  assert.equal(await page.evaluate(()=>window.__SPIRIT__.spirit.skin.surfaceMaterial.opacity),config.opacity);
  await page.screenshot({path:'artifacts/spirit-softie-custom.png',fullPage:true});
  await page.getByRole('button',{name:'保存参数',exact:true}).click();await page.getByText('参数已保存到本机，刷新后会恢复。',{exact:true}).waitFor();
  lastTestSave=config;assert.deepEqual(await(await fetch(api)).json(),config);
  await page.reload({waitUntil:'domcontentloaded'});await ready();assert.deepEqual((await diag()).settings,config);
  check('all tuning controls preview and the backend persists them across refresh');

  for(const size of [0.65,1.35]) {
    await page.locator('#spirit-size').evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},size);
    await page.waitForFunction(expected=>{
      const d=window.__SPIRIT__.getDiagnostics(),entity=d.serverSnapshot?.entities.find(value=>value.id===d.network.selfId);
      return entity?.settings.size===expected;
    },size,{timeout:5000});
    await reset();const at=await point();await page.mouse.move(at.x,at.y);await page.mouse.down();await waitFrames(8);
    assert.equal((await diag()).physics.dragging,true);await page.mouse.move(at.x+60,at.y-50,{steps:8});await page.mouse.up();await waitFrames(8);
    assert.ok(await page.evaluate(()=>{const {spirit}=window.__SPIRIT__;const pos=spirit.pickMeshes[0].geometry.attributes.position;for(let i=0;i<pos.count;i++)if(pos.getY(i)*spirit.skin.size+spirit.physics.position.y<-.00001)return false;return true;}));
  }
  check('small and large spirits remain pickable and do not cross the floor');

  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出 JSON',exact:true}).click();
  const download=await downloadPromise;assert.equal(download.suggestedFilename(),'spirit-settings.json');
  const stream=await download.createReadStream();let text='';for await(const chunk of stream)text+=chunk.toString();
  const exported=JSON.parse(text);assert.equal(exported.size,1.35);
  await page.locator('#spirit-import').setInputFiles({name:'import.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...config,size:0.8}))});
  await page.getByText('已导入并预览，请保存参数。',{exact:true}).waitFor();assert.equal((await diag()).settings.size,0.8);
  await page.locator('#spirit-import').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"size":999}')});
  await page.waitForFunction(()=>document.querySelector('.spirit-save-status').textContent.startsWith('导入失败'));
  assert.equal((await diag()).settings.size,0.8);
  const invalid=await fetch(api,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...config,size:99})});assert.equal(invalid.status,400);
  assert.deepEqual(await(await fetch(api)).json(),config);
  check('JSON export/import works and invalid configs cannot overwrite the save');

  await page.getByRole('link',{name:'回到灵界 ↗',exact:true}).click();
  await page.waitForFunction(()=>window.__SOFTIE__?.getDiagnostics().frames>10,null,{timeout:60000});
  const paused=await diag();await page.waitForTimeout(300);const still=await diag();
  assert.equal(still.animationRunning,false);assert.equal(still.rendererFrame,paused.rendererFrame);
  assert.equal(await page.locator('a[href="/games/calm-match"]').count(),0);
  await page.locator('.swatch[data-color="#a5e0cd"]').click();
  await page.evaluate(()=>{window.__savedHomeSlime=window.__SOFTIE__.slime;window.__savedHomeColor=window.__SOFTIE__.slime.gel.attenuationColor.toArray();});
  await page.locator('a.spirit-entry').click();await page.waitForFunction(()=>window.__SPIRIT__.getDiagnostics().active);
  const home=await page.evaluate(()=>window.__SOFTIE__.getDiagnostics());await waitFrames(12);
  assert.equal(await page.evaluate(()=>window.__SOFTIE__.getDiagnostics().animationRunning),false);
  assert.equal(await page.evaluate(()=>window.__SOFTIE__.getDiagnostics().rendererFrame),home.rendererFrame);
  assert.equal((await diag()).settings.size,0.8);
  await page.getByRole('link',{name:'回到灵界 ↗',exact:true}).click();
  await page.waitForFunction(start=>window.__SOFTIE__.getDiagnostics().frames>start,home.frames);
  assert.equal(await page.evaluate(()=>window.__SOFTIE__.slime===window.__savedHomeSlime),true);
  assert.deepEqual(await page.evaluate(()=>window.__SOFTIE__.slime.gel.attenuationColor.toArray()),await page.evaluate(()=>window.__savedHomeColor));
  check('home and spirit retain state and stop inactive internal rendering');

  await page.locator('a.spirit-entry').click();
  await page.waitForFunction(()=>window.__SPIRIT__?.getDiagnostics().active);
  await page.setViewportSize({width:390,height:844});await waitFrames(8);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'artifacts/spirit-softie-mobile.png',fullPage:true});report.screenshots.push('artifacts/spirit-softie-mobile.png');
  await page.setViewportSize({width:320,height:700});await waitFrames(6);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  check('390px and 320px layouts have no horizontal overflow');
  assert.deepEqual(report.errors,[]);check('no uncaught browser errors');
} catch(error) {
  report.failure=error.message;if(page&&!page.isClosed())report.failureState=await page.evaluate(()=>window.__SPIRIT__?.getDiagnostics()).catch(()=>null);throw error;
} finally {
  await writeFile('artifacts/spirit-playground-report.json',JSON.stringify(report,null,2));
  await browser?.close();
  const current=await(await fetch(api)).json();
  // Do not overwrite a user save made while this test was running.
  if(JSON.stringify(current)===JSON.stringify(lastTestSave))await put(original);
}
