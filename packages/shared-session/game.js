// One local game profile, shared by every mode on this origin. IndexedDB serializes writers.
import { publish, subscribe } from './bus.js';
import { identityById } from '../shared-data/identities.js';

export const GAME_DB = 'iridescently-game-v1';
export const RESOURCE_KEYS = Object.freeze(['spirit', 'herb', 'food', 'soul', 'shards']);
const empty = () => ({schemaVersion:1, revision:0, resources:Object.fromEntries(RESOURCE_KEYS.map(k=>[k,0])), characters:{}, modes:{}, recent:[]});
const modeKey = mode => {
  if (typeof mode !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(mode)) throw new Error('无效的玩法编号。');
  return 'mode:' + mode;
};
function amounts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('资源必须是一个对象。');
  for (const [key,n] of Object.entries(value)) {
    if (!RESOURCE_KEYS.includes(key) || !Number.isSafeInteger(n)) throw new Error('无效的资源数量：' + key);
  }
  return value;
}
function validateProfile(profile){
  if(profile.schemaVersion!==1||!Number.isSafeInteger(profile.revision)||profile.revision<0||!profile.characters||typeof profile.characters!=='object'||Array.isArray(profile.characters)||!profile.modes||typeof profile.modes!=='object'||Array.isArray(profile.modes)||!Array.isArray(profile.recent))throw new Error('统一存档格式或版本不兼容。');
  for(const key of RESOURCE_KEYS)if(!Number.isSafeInteger(profile.resources?.[key])||profile.resources[key]<0)throw new Error('统一资源账本损坏，原数据已保留。');
  return profile;
}
function addResources(profile, delta) {
  for (const [key,n] of Object.entries(amounts(delta))) {
    const next = profile.resources[key] + n;
    if (!Number.isSafeInteger(next) || next < 0) throw new Error('共享资源不足或超出范围：' + key);
    profile.resources[key] = next;
  }
}
function mergeRoster(profile, roster = {}) {
  for (const [id,state] of Object.entries(roster)) {
    const character=identityById(id);
    if (!character || !state || typeof state !== 'object' || Array.isArray(state)) throw new Error('无效的角色进度。');
    for(const [key,value] of Object.entries(state)) {
      if(['discovered','sealed'].includes(key)) {if(typeof value!=='boolean')throw new Error('无效的角色状态。');}
      else if(['bond','deaths','reviveAt'].includes(key)) {if(!(key==='reviveAt'&&value===null)&&(!Number.isSafeInteger(value)||value<0))throw new Error('无效的角色状态。');}
      else throw new Error('未知的角色状态字段：'+key);
    }
    profile.characters[character.id] = {...profile.characters[character.id], ...structuredClone(state)};
  }
}
function connect() {
  return new Promise((resolve,reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('浏览器无法使用统一游戏存档。'));
    const request = indexedDB.open(GAME_DB,1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('其他窗口正在升级统一存档，请关闭后重试。'));
  });
}

async function edit(mode, operationId, change) {
  const key = modeKey(mode);
  if (operationId != null && (typeof operationId !== 'string' || !operationId || operationId.length > 200)) throw new Error('无效的操作编号。');
  const db = await connect();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('records','readwrite'), store = tx.objectStore('records');
    let profile, record, receipt, result, failure, remaining = operationId ? 3 : 2;
    const loaded = () => {
      if (--remaining) return;
      try {
        profile ||= empty();
        validateProfile(profile);
        if (receipt) { result = {profile, record, duplicate:true}; return; }
        record = change(profile,record);
        profile.revision++;
        profile.modes[mode] = {revision:record.revision, updatedAt:record.updatedAt};
        store.put(profile,'profile'); store.put(record,key);
        if (operationId) store.put({mode,revision:record.revision},'receipt:'+mode+':'+operationId);
        result = {profile,record,duplicate:false};
      } catch(error) { failure=error; tx.abort(); }
    };
    const p=store.get('profile'); p.onsuccess=()=>{profile=p.result;loaded();};
    const m=store.get(key); m.onsuccess=()=>{record=m.result;loaded();};
    if(operationId){const r=store.get('receipt:'+mode+':'+operationId);r.onsuccess=()=>{receipt=r.result;loaded();};}
    tx.oncomplete=()=>{db.close();publish('game',{mode,revision:result.profile.revision});resolve(result);};
    tx.onabort=()=>{db.close();reject(failure||tx.error||new Error('统一存档写入中断。'));};
    tx.onerror=()=>{}; // onabort reports the final transaction error.
  });
}

/** Import once, then check out the canonical mode snapshot and its shared balances. */
export function openMode(mode, snapshot, resources = {}, roster = {}) {
  amounts(resources);
  if (Object.values(resources).some(n=>n<0)) throw new Error('迁入资源不能为负数。');
  return edit(mode,null,(profile,record)=>{
    if (!record || record.snapshot===null) {
      addResources(profile,resources); mergeRoster(profile,roster);
      record={snapshot:structuredClone(snapshot), nativeResources:{...resources}, revision:0};
    }
    // A new checkout invalidates stale writers in another tab without discarding their native saves.
    record.nativeResources=Object.fromEntries(Object.keys(resources).map(k=>[k,profile.resources[k]]));
    return {...record,revision:record.revision+1,updatedAt:Date.now()};
  });
}

/** Snapshot + resource differences + roster updates commit together, or none of them do. */
export function commitMode(mode, snapshot, {revision, resources={}, characters={}, operationId} = {}) {
  amounts(resources);
  if (Object.values(resources).some(n=>n<0)) throw new Error('玩法资源不能为负数。');
  return edit(mode,operationId,(profile,record)=>{
    if (!record || record.revision !== revision) throw new Error('该玩法存档已在其他窗口更新，请重新加载后继续。');
    const keys=Object.keys(record.nativeResources);
    if (keys.length !== Object.keys(resources).length || keys.some(k=>!(k in resources))) throw new Error('玩法资源映射发生变化。');
    const delta=Object.fromEntries(keys.map(k=>[k,resources[k]-record.nativeResources[k]]));
    addResources(profile,delta); mergeRoster(profile,characters);
    return {snapshot:structuredClone(snapshot),nativeResources:{...resources},revision:revision+1,updatedAt:Date.now()};
  });
}

/** Cross-mode rewards/spending use a stable receipt ID, never a balance overwrite. */
export function transact(mode, {id, resources={}, characters={}, summary} = {}) {
  if (!id) throw new Error('结算需要唯一操作编号。');
  return edit(mode,id,(profile,record)=>{
    addResources(profile,resources); mergeRoster(profile,characters);
    profile.recent=[{id,mode,resources,summary:summary||'',at:Date.now()},...profile.recent].slice(0,100);
    return {...(record||{snapshot:null,nativeResources:{},revision:0}),revision:(record?.revision||0),updatedAt:Date.now()};
  });
}

export async function exportGame() {
  const db=await connect();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readonly'), store=tx.objectStore('records');
    const result={format:'iridescently-game',version:1,profile:null,modes:{},receipts:{}};
    const cursor=store.openCursor();
    cursor.onsuccess=()=>{const c=cursor.result;if(!c)return;if(c.key==='profile')result.profile=c.value;else if(String(c.key).startsWith('mode:'))result.modes[String(c.key).slice(5)]=c.value;else if(String(c.key).startsWith('receipt:'))result.receipts[String(c.key).slice(8)]=c.value;c.continue();};
    tx.oncomplete=()=>{db.close();result.profile||=empty();resolve(result);};
    tx.onabort=()=>{db.close();reject(tx.error);};
  });
}
async function readRecord(key){
  const db=await connect();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readonly'),request=tx.objectStore('records').get(key);
    tx.oncomplete=()=>{db.close();resolve(request.result);};tx.onabort=()=>{db.close();reject(tx.error);};
  });
}
export async function readGame() { return validateProfile((await readRecord('profile')) || empty()); }
export async function readMode(mode) { return (await readRecord(modeKey(mode))) || null; }
export function onGameChange(handler) { return subscribe('game',handler); }
