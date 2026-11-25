const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../../..');
const home = '<main id="home"><a id="management" href="/app/shell/m/management">Management</a><a id="softie" href="/app/shell/m/softie">Softie</a></main>';
const shared = {
  '/shared/site-domains/index.js': "window.IridescentlyDomains={service:()=> 'zszm',url:(_,p='')=>location.origin+p}",
  '/shared/shared-session/session.js': "export async function refreshSession(){return {logged_in:true,name:'Test Keeper'}}",
  '/shared/shared-session/save.js': "export const get=k=>localStorage.getItem('shell:'+k); export const set=(k,v)=>localStorage.setItem('shell:'+k,v)",
};
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server = http.createServer((req,res)=>{
  const url = new URL(req.url,'http://127.0.0.1');
  const p = url.pathname;
  function send(bytes, type, status=200) {
    res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});
    res.end(req.method === 'HEAD' ? undefined : bytes);
  }
  if (p === '/') return send(home,types['.html']);
  if (p.startsWith('/shared/shared-ui/') && /^[A-Za-z0-9_./-]+$/.test(p) && !p.split('/').includes('..')) {
    const asset=path.join(root,'packages',p.slice('/shared/'.length));
    if (fs.existsSync(asset) && fs.statSync(asset).isFile()) return send(fs.readFileSync(asset),types[path.extname(asset)]||'application/octet-stream');
  }
  if (p.startsWith('/shared/')) return send(shared[p] || '',types[path.extname(p)] || 'text/plain');
  let file;
  if (p.startsWith('/app/shell/')) file = path.join(root,'apps/shell/index.html');
  else if (p === '/app/portal.json') file = path.join(root,'apps/shell/portal.json');
  else {
    const match = p.match(/^\/app\/modules\/(management|softie)\/([A-Za-z0-9_.\/-]*)$/);
    if (match && !match[2].split('/').includes('..')) file = path.join(root,'apps',match[1],'dist',match[2] || 'index.html');
  }
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send('','text/plain',404);
  return send(fs.readFileSync(file), types[path.extname(file)] || 'application/octet-stream');
});
(async()=>{
  for(const module of ['management','softie']) assert(fs.existsSync(path.join(root,'apps',module,'dist/index.html')),'Build module first: '+module);
  const {createInitialState}=await import(require('node:url').pathToFileURL(path.join(root,'apps/management/src/core/gameState.js')));
  let browser, cloudSave=createInitialState(), saveWrites=0, progressWrites=0;
  const initialWidth=cloudSave.space.width;
  await new Promise((resolve,reject) => server.listen(0,'127.0.0.1',resolve).once('error',reject));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--enable-unsafe-swiftshader']});
    const context=await browser.newContext({serviceWorkers:'block',locale:'zh-CN'});
    await context.route('**/*',route=>{
      const request=route.request(), url=new URL(request.url());
      if(url.origin===base && url.pathname==='/api/progress/report' && request.method()==='POST'){progressWrites++;return route.fulfill({json:{ok:true}});}
      if(url.origin===base) return route.continue();
      if (request.isNavigationRequest() && url.origin === 'https://zszm.iridescently.xyz' && url.pathname === '/') {
        return route.fulfill({status:302,headers:{location:base+'/#home'}});
      }
      if(url.origin==='http://localhost:8089'){
        const headers={'access-control-allow-origin':base,'access-control-allow-credentials':'true','access-control-allow-headers':'content-type','access-control-allow-methods':'GET, POST, OPTIONS'};
        const send=(json,status=200)=>route.fulfill({headers,json,status});
        if(request.method()==='OPTIONS')return route.fulfill({headers,status:204});
        if(url.pathname==='/api/user')return send({logged_in:true,user_id:'issue95A',kind:'local',nickname:'Test Keeper'});
        if(url.pathname==='/api/game/load')return send({ok:true,state:cloudSave});
        if(url.pathname==='/api/game/save'){saveWrites++;cloudSave=request.postDataJSON().state;return send({ok:true});}
      }
      return route.abort();
    });
    const page=await context.newPage(); page.setDefaultTimeout(8000);
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const shellHome=async()=>{await Promise.all([page.waitForURL(base+'/#home',{waitUntil:'commit'}),page.locator('#iridescently-shell-return').click()]);await page.locator('#home').waitFor();};
    const readyManagement=()=>page.locator('.module-embed[aria-busy=false] #app:not([inert])').waitFor();
    const snapshot=()=>page.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('iridescently.save.v1')||'{}')['m:management:lingjing-huiguan-save-issue95A']||'null')?.state);
    await page.goto(base+'/#home');
    await page.locator('#management').click();
    await readyManagement();
    await page.locator('#account-status').getByText('Test Keeper').waitFor({state:'attached'});
    await page.locator('#btn-pause').click();
    await page.locator('#btn-expand').click();
    await page.locator('#btn-save').click();
    let saved=await snapshot();
    assert(saved?.paused && saved.space.width===initialWidth+1,'Real local Management snapshot absent after UI save');
    await shellHome();
    await page.goBack({waitUntil:'commit'});
    await readyManagement();
    assert.equal((await snapshot()).space.width,saved.space.width);
    assert.equal(await page.locator('#btn-pause').getAttribute('aria-label'),'\u7ee7\u7eed');
    await page.goForward({waitUntil:'commit'});
    await page.waitForURL(base+'/#home',{waitUntil:'commit'});
    await page.locator('#management').click();
    await readyManagement();
    assert.equal((await snapshot()).space.width,saved.space.width);
    assert.equal(await page.locator('#btn-pause').getAttribute('aria-label'),'\u7ee7\u7eed');
    console.log('PASS real Management embedded: account mock, UI pause/expand/save, cold Back/Forward/re-entry (local snapshot preserved; '+saveWrites+' mock cloud write calls)');
    await shellHome();
    await page.locator('#softie').click();
    const readySoftie=()=>page.frameLocator('iframe.view').locator('body[data-softie-page="spirit"] main.spirit-playground').waitFor({state:'attached'});
    await readySoftie();
    await shellHome();
    await page.goBack({waitUntil:'commit'});
    await readySoftie();
    await page.goForward({waitUntil:'commit'});
    await page.waitForURL(base+'/#home',{waitUntil:'commit'});
    await page.locator('#softie').click();
    await readySoftie();
    console.log('PASS real Softie iframe: Spirit route remounts after cold Back/Forward/re-entry; GPU, multiplayer and preferences not verified');
    assert.deepEqual(errors,[]);
    assert.equal(progressWrites,1,'unexpected extra progress POST during return or re-entry');
    assert.equal(saveWrites,1,'unexpected extra cloud save POST during return or re-entry');
  }finally{await browser?.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
