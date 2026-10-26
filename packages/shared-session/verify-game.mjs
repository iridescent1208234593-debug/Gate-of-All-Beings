// Real-browser checks: native IndexedDB transactions, migration and durable outbox replay.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../server/app/src/management/node_modules/playwright/index.mjs';
import {build} from '../../server/app/src/cards/node_modules/esbuild/lib/main.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const compiled=await build({entryPoints:[path.join(root,'apps/cards/src/game/storage.ts')],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><body>Unified game verification</body>');return;}
    if(pathname==='/storage.js'){res.setHeader('Content-Type','text/javascript');res.end(compiled.outputFiles[0].text);return;}
    if(!pathname.startsWith('/shared/')&&!pathname.startsWith('/server/app/src/slay-the-web/public/'))throw Error('Route unavailable');
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root))throw Error('Invalid path');
    res.setHeader('Content-Type',file.endsWith('.json')?'application/json':'text/javascript');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  await page.goto(origin);
  const report=await page.evaluate(async()=>{
    const checks=[];
    function check(name,ok){if(!ok)throw Error(name);checks.push(name);}
    const game=await import('/shared/shared-session/game.js');
    const catalog=await import('/shared/shared-data/catalog.js');
    const cards=(await import('/shared/shared-data/cards-data.js')).default;
    check('439 active characters, 49 retired IDs, unique canonical roster',catalog.characters.length===439&&Object.keys(catalog.facts.redirects).length===49&&new Set(catalog.characters.map(c=>c.id)).size===439);
    check('canonical names take priority over ambiguous aliases',catalog.characterByName('罗小黑').id===1&&catalog.characterByName('无限').id===2);
    check('every retired ID resolves to an active character',Object.keys(catalog.facts.redirects).every(id=>catalog.characterById(id)));
    check('168 namespaced cards, native effects and upgrades preserved',cards.cards.length===168&&new Set(cards.cards.map(c=>c.id)).size===168&&cards.cards.some(c=>c.mode==='slay'&&c.upgrade));
    const {unifiedStorage}=await import('/shared/shared-session/kv.js');
    localStorage.setItem('old-test-key','old');
    const kv=unifiedStorage('verify');
    check('legacy KV imported',kv.getItem('old-test-key')==='old');
    kv.removeItem('old-test-key');
    check('deleted keys cannot resurrect from preserved legacy storage',kv.getItem('old-test-key')===null&&localStorage.getItem('old-test-key')==='old');
    const original=localStorage.getItem('iridescently.save.v1');
    localStorage.setItem('iridescently.save.v1','broken-json');
    let rejected=false;try{kv.setItem('unsafe','no');}catch{rejected=true;}
    check('corrupt shared namespace is preserved and blocks writes',rejected&&localStorage.getItem('iridescently.save.v1')==='broken-json');
    localStorage.setItem('iridescently.save.v1',original);
    const storage=await import('/storage.js');
    const seed=storage.freshSave();seed.meta.spirit=41;seed.meta.herbs=9;seed.meta.characters.xiaohei.deaths=1;
    await new Promise((resolve,reject)=>{const r=indexedDB.open('zszm-adventure-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('saves');r.onsuccess=()=>{const db=r.result,tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(seed,'current');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});
    const migrated=await storage.readSave();
    check('Cards legacy full save and wounds migrate once',migrated.meta.spirit===41&&migrated.meta.characters.xiaohei.deaths===1&&(await game.readGame()).characters[1].deaths===1);
    migrated.meta.spirit+=3;await storage.writeSave(migrated);
    check('Cards resource deltas commit to common wallet',(await game.readGame()).resources.spirit===44);
    const second=await storage.readSave();
    check('Cards reload does not import legacy balance twice',second.meta.spirit===44);
    localStorage.setItem('luoxiaohei-rebirth-soul-legacy',JSON.stringify({soul:100,runs:2,wins:1}));
    localStorage.setItem('lxz-lingzhi-xiuxing-v1',JSON.stringify({shards:50}));
    localStorage.setItem('lxhz-rebirth-collection',JSON.stringify({characters:['罗小黑','无限']}));
    const bridge=await import('/server/app/src/slay-the-web/public/game/shared-progress.js');
    await bridge.initializeSharedProgress();
    check('Slay imports native balances and canonical discoveries',(await game.readGame()).resources.soul===100&&(await game.readGame()).characters[2].discovered);
    const soul=await import('/server/app/src/slay-the-web/public/content/soul-legacy.js');
    const runStorage=await import('/server/app/src/slay-the-web/public/game/save-system.js');
    const state={player:{currentHealth:0,maxHealth:50,treasures:[],realmIndex:0},dungeon:{y:2,x:0,graph:[[{edges:new Set([1]),room:{type:'monster'}}]]},deck:[],drawPile:[]};
    runStorage.beginRun(state);
    check('Slay run saved with Set serialization',runStorage.saveRun(state)&&runStorage.loadRun().dungeon.graph[0][0].edges instanceof Set);
    soul.settleRun(state,false);await bridge.flushSharedProgress();
    const settled=await game.readGame();
    check('Rebirth loss brings shared spirit back to adventure',settled.resources.spirit===49);
    soul.settleRun(state,false);await bridge.flushSharedProgress();
    check('repeated settlement cannot grant resources twice',(await game.readGame()).resources.spirit===49);
    soul.awardSoul(7);await bridge.flushSharedProgress();
    check('Soul rewards reconcile to shared wallet',(await game.readGame()).resources.soul===107);
    runStorage.clearRun();await bridge.flushSharedProgress();
    check('cleared Slay run does not reappear',runStorage.loadRun()===null);
    // Simulate a crash after the IndexedDB commit but before outbox acknowledgement.
    bridge.disposeSharedProgress();
    const mode=await game.readMode('slay');
    const snap=structuredClone(mode.snapshot),raw=JSON.parse(snap.storage['luoxiaohei-rebirth-soul-legacy']);raw.soul+=4;snap.storage['luoxiaohei-rebirth-soul-legacy']=JSON.stringify(raw);
    const slayKV=unifiedStorage('slay');slayKV.setItem('luoxiaohei-rebirth-soul-legacy',snap.storage['luoxiaohei-rebirth-soul-legacy']);
    const op={type:'snapshot',id:'crash-replay',revision:mode.revision,snapshot:snap};
    await game.commitMode('slay',snap,{revision:mode.revision,resources:{soul:111,shards:50},operationId:op.id});
    localStorage.setItem('iridescently.game.pending.slay',JSON.stringify([op]));
    await bridge.initializeSharedProgress();
    check('durable outbox replay is idempotent',(await game.readGame()).resources.soul===111&&!localStorage.getItem('iridescently.game.pending.slay'));
    const returned=await storage.readSave();returned.meta.herbs-=2;await storage.writeSave(returned);
    check('cross-mode shared rewards survive resource spending',returned.meta.spirit===49&&(await game.readGame()).resources.herb===7);
    let changes=0;const stop=game.onGameChange(()=>changes++);
    await Promise.all([game.transact('ecology',{id:'harvest',resources:{food:3}}),game.transact('juling',{id:'gather',resources:{food:4}})]);
    stop();check('concurrent modes add resources atomically',(await game.readGame()).resources.food===7&&changes===2);
    await game.transact('ecology',{id:'harvest',resources:{food:3}});
    check('receipt deduplication persists across reads',(await game.readGame()).resources.food===7);
    const before=await game.readGame();let denied=false;
    try{await game.transact('cards',{id:'overspend',resources:{spirit:-99999}});}catch{denied=true;}
    check('insufficient resources roll back the whole transaction',denied&&(await game.readGame()).revision===before.revision);
    denied=false;try{await game.transact('cards',{id:'invalid-roster',resources:{spirit:9},characters:{1:{bond:null}}});}catch{denied=true;}
    check('invalid roster updates cannot partially credit resources',denied&&(await game.readGame()).resources.spirit===before.resources.spirit);
    const stale=await game.openMode('cards',returned,{spirit:49,herb:7,food:7});
    await game.openMode('cards',returned,{spirit:49,herb:7,food:7});
    denied=false;try{await game.commitMode('cards',returned,{revision:stale.record.revision,resources:{spirit:50,herb:7,food:7}});}catch{denied=true;}
    check('stale tab cannot overwrite a newer mode checkout',denied&&(await game.readGame()).resources.spirit===49);
    const exported=await game.exportGame();
    check('export includes full mode snapshots and deduplication receipts',exported.modes.cards.snapshot&&exported.modes.slay.snapshot&&Object.keys(exported.receipts).length>0);
    bridge.disposeSharedProgress();
    return checks;
  });
  await page.evaluate(async()=>{await (await import('/server/app/src/slay-the-web/public/game/shared-progress.js')).initializeSharedProgress();});
  const other=await context.newPage();await other.goto(origin);
  const blocked=await other.evaluate(async()=>{try{await (await import('/server/app/src/slay-the-web/public/game/shared-progress.js')).initializeSharedProgress();return false;}catch(error){return error.message.includes('其他窗口');}});
  assert(blocked,'second Slay window acquired a concurrent writer lock');
  await other.close();await page.evaluate(()=>import('/server/app/src/slay-the-web/public/game/shared-progress.js').then(m=>m.disposeSharedProgress()));
  report.push('a second Slay window cannot acquire the active writer lock');
  assert(report.length>=25);
  for(const check of report)console.log('PASS '+check);
  console.log(JSON.stringify({passed:report.length,failed:0}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
