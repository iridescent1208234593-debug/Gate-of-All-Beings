import {unifiedStorage} from '/shared/shared-session/kv.js';
import {openMode,commitMode,readMode,transact} from '/shared/shared-session/game.js';
import {characterByName} from '/shared/shared-data/catalog.js';

const storage=unifiedStorage('slay');
const OUTBOX='iridescently.game.pending.slay';
// ponytail: full snapshots in the localStorage outbox; use per-key patches if mode saves approach the browser quota.
const LEGACY_KEYS=['lxz-rebirth-run-v1','lxz-rebirth-profile-v1','lxz-lingzhi-xiuxing-v1',
  'lxhz-rebirth-collection','lxz-rebirth-achievements-v1','lxz-rebirth-difficulty',
  'luoxiaohei-rebirth-endings','lxz-lingzhi-settlement-v1','luoxiaohei-rebirth-soul-legacy','lxh_bgm_muted'];
let revision, initialized=false, initialization, writing=null, pending=[], unsubscribe;
let releaseLock;
async function acquireWriter(){
  if(!navigator.locks)throw new Error('当前浏览器无法安全协调多窗口存档，请使用支持 Web Locks 的浏览器。');
  await new Promise((resolve,reject)=>{
    navigator.locks.request('iridescently-mode:slay',{ifAvailable:true},async lock=>{
      if(!lock){reject(new Error('重生之门已在其他窗口打开，请先关闭另一窗口。'));return;}
      await new Promise(release=>{releaseLock=release;resolve();});
    }).catch(reject);
  });
}
const parse=key=>JSON.parse(storage.getItem(key)||'{}');
function snapshot(){
  const entries={};
  for(let i=0;i<storage.length;i++){const key=storage.key(i);entries[key]=storage.getItem(key);}
  return {version:1,storage:entries};
}
function projection(data){
  const legacy=JSON.parse(data.storage['luoxiaohei-rebirth-soul-legacy']||'{}');
  const progress=JSON.parse(data.storage['lxz-lingzhi-xiuxing-v1']||'{}');
  const collection=JSON.parse(data.storage['lxhz-rebirth-collection']||'{}');
  const characters={};
  for(const name of collection.characters||[]){const c=characterByName(name);if(c)characters[c.id]={discovered:true};}
  return {resources:{soul:legacy.soul||0,shards:progress.shards||0},characters};
}
function persist(){
  if(pending.length)localStorage.setItem(OUTBOX,JSON.stringify(pending));
  else localStorage.removeItem(OUTBOX);
}
function report(error){
  console.error('统一进度保存失败，待写记录已保留',error);
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('game-save-error',{detail:error.message}));
  if(typeof document!=='undefined'){
    let banner=document.getElementById('shared-save-error');
    if(!banner){banner=document.createElement('p');banner.id='shared-save-error';banner.setAttribute('role','alert');banner.style.cssText='position:sticky;top:0;z-index:9999;background:#fff1d6;color:#4a3020;padding:12px';document.body.prepend(banner);}
    banner.textContent='存档需要处理：'+error.message+' 本地资料已保留。';
    const backup=document.createElement('button');backup.textContent='导出本地资料';
    backup.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({namespace:localStorage.getItem('iridescently.save.v1'),pending:localStorage.getItem(OUTBOX)})],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='重生之门-待同步资料.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};banner.append(backup);
  }
}
export function flushSharedProgress(){
  if(writing)return writing;
  writing=(async()=>{
    while(pending.length){
      const operation=pending[0];
      if(operation.type==='snapshot'){
        operation.revision??=revision;persist();
        const result=await commitMode('slay',operation.snapshot,{revision:operation.revision,...projection(operation.snapshot),operationId:operation.id});
        revision=result.record.revision;
      }else await transact('slay',operation.transaction);
      pending.shift();
      if(pending[0]?.type==='snapshot')pending[0].revision=revision;
      persist();
    }
  })().finally(()=>{writing=null;});
  return writing;
}
function checkpoint(){
  if(!initialized)return;
  const operation={type:'snapshot',id:crypto.randomUUID(),snapshot:snapshot()};
  // Only coalesce snapshots that have not entered a transaction; keep reward operations intact.
  const last=pending.at(-1);
  if(last?.type==='snapshot'&&(!writing||pending.length>1))pending[pending.length-1]=operation;
  else pending.push(operation);
  persist();
  flushSharedProgress().catch(report);
}
export function recordRebirthRun(id,won){
  if(!initialized)throw new Error('统一进度尚未就绪。');
  pending.push({type:'reward',transaction:{id:'rebirth-run:'+id,resources:{spirit:won?20:5,herb:won?2:0},summary:won?'重生之门 · 通关':'重生之门 · 轮回'}});
  persist();flushSharedProgress().catch(report);
}

export function initializeSharedProgress(){
  if(initialization)return initialization;
  initialization=(async()=>{
    await acquireWriter();
    const raw=localStorage.getItem(OUTBOX);
    if(raw){pending=JSON.parse(raw);await flushSharedProgress();}
    for(const key of LEGACY_KEYS)storage.getItem(key);
    const seed=snapshot(), existing=await readMode('slay');
    // Unexpected local divergence is preserved instead of silently replacing either copy.
    if(existing&&JSON.stringify(existing.snapshot.storage)!==JSON.stringify(seed.storage)){
      const before=existing.snapshot.storage, after=seed.storage;
      const keys=new Set([...Object.keys(before),...Object.keys(after)]);
      if([...keys].some(k=>before[k]!==after[k]))throw new Error('重生之门存在未同步的本地存档，请先导出保留并处理冲突。');
    }
    const base=existing?.snapshot||seed;
    const result=await openMode('slay',base,projection(base).resources,projection(base).characters);
    revision=result.record.revision;
    for(const [key,value] of Object.entries(result.record.snapshot.storage))storage.setItem(key,value);
    const legacy=parse('luoxiaohei-rebirth-soul-legacy'),progress=parse('lxz-lingzhi-xiuxing-v1');
    if(storage.getItem('luoxiaohei-rebirth-soul-legacy')||result.profile.resources.soul)storage.setItem('luoxiaohei-rebirth-soul-legacy',JSON.stringify({...legacy,soul:result.profile.resources.soul}));
    if(storage.getItem('lxz-lingzhi-xiuxing-v1')||result.profile.resources.shards)storage.setItem('lxz-lingzhi-xiuxing-v1',JSON.stringify({...progress,shards:result.profile.resources.shards}));
    initialized=true;
    const onSave=event=>{if(event.detail?.key?.startsWith('m:slay:')){try{checkpoint();}catch(error){report(error);}}};
    window.addEventListener('iridescently:save',onSave);
    const onNavigate=event=>{
      const a=event.target.closest?.('a[href]');
      if(!a||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||a.target==='_blank'||a.download)return;
      const url=new URL(a.href,location.href);
      if(url.origin!==location.origin||(url.pathname===location.pathname&&url.search===location.search))return;
      event.preventDefault();flushSharedProgress().then(()=>{location.href=url.href;}).catch(report);
    };
    window.addEventListener('click',onNavigate);
    unsubscribe=()=>{window.removeEventListener('iridescently:save',onSave);window.removeEventListener('click',onNavigate);};
    checkpoint();await flushSharedProgress();
  })().catch(error=>{unsubscribe?.();initialized=false;initialization=null;releaseLock?.();releaseLock=null;report(error);throw error;});
  return initialization;
}
export function disposeSharedProgress(){unsubscribe?.();unsubscribe=null;initialized=false;releaseLock?.();releaseLock=null;initialization=null;}
if(typeof window!=='undefined'){
  window.addEventListener('pagehide',disposeSharedProgress);
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
}
