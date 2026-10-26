import type { SaveData } from './core/types';
import { createMeta, validateTimeline } from './core/meta';
import { CARDS, HEROES, registerEcoCards } from './core/content';
import { validateEcoExchange, validateEcoIndividual } from '@lxh/shared-types/exchange';
import { unifiedStorage } from '@lxh/shared-session/kv.js';
import { openMode, commitMode, readMode } from '@lxh/shared-session/game.js';
const DB='zszm-adventure-v1';
const unified=unifiedStorage('cards');
let sharedRevision:number|undefined;
const resourcesOf=(s:SaveData)=>({spirit:s.meta.spirit,herb:s.meta.herbs,food:s.meta.food||0});
function rosterOf(s:SaveData){return Object.fromEntries(Object.entries(HEROES).map(([hero,definition])=>{
  const c=s.meta.characters[hero as keyof typeof HEROES];
  return [definition.characterId,{discovered:true,bond:c.bond,sealed:c.sealed,deaths:c.deaths||0,reviveAt:s.meta.allDeadAt===undefined?null:s.meta.allDeadAt+5*60*60*1000}];
}));}
/** 把当前进度摘要镜像到统一存档，便于其他模块/壳读取。 */
function mirrorSummary(save: SaveData){try{unified.setItem('summary',JSON.stringify({version:1,hero:save.run?.hero??null,hp:save.run?.hp??null,nodes:save.run?.nodes?.length??0,characters:Object.keys(save.meta?.characters??{}).length,updatedAt:Date.now()}));}catch{}}
function openDB():Promise<IDBDatabase> {return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('saves');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('存档被其他窗口占用'));});}
export function freshSave(): SaveData {const meta=createMeta();return {version:1,run:null,meta,runTimeline:structuredClone(meta.timeline)};}
export function checkSave(value: unknown): SaveData {
  const s=structuredClone(value) as SaveData;
  if(!s||s.version!==1||s.meta?.version!==1||!s.meta.characters||!Array.isArray(s.meta.claimedRuns))throw new Error('存档格式不兼容。');
  validateTimeline(s.meta.timeline);validateTimeline(s.runTimeline);
  if(s.meta.ecoIndividuals){
    if(!Array.isArray(s.meta.ecoIndividuals)||s.meta.ecoIndividuals.length>512)throw new Error('生态个体存档损坏。');
    s.meta.ecoIndividuals=s.meta.ecoIndividuals.map(validateEcoIndividual);
    registerEcoCards(s.meta.ecoIndividuals);
  }
  if(s.ecoDeliveries){
    if(!Array.isArray(s.ecoDeliveries)||s.ecoDeliveries.length>100)throw new Error('据点收获记录损坏。');
    s.ecoDeliveries=s.ecoDeliveries.map(validateEcoExchange);
  }
  for(const h of Object.keys(HEROES) as (keyof typeof HEROES)[]){const c=s.meta.characters[h];if(c && !("bond" in c)) (c as unknown as {bond:number;experience?:number}).bond=(c as unknown as {experience:number}).experience; if(c) delete (c as unknown as {experience?:number}).experience;if(!c||!Number.isFinite(c.bond)||!['garden','practice','rest'].includes(c.assignment))throw new Error('角色存档损坏。');}
  if(s.run && (!HEROES[s.run.hero]||!Array.isArray(s.run.deck)||s.run.deck.some(c=>!CARDS[c.card])||!Array.isArray(s.run.nodes)||!Array.isArray(s.run.log)||!Number.isFinite(s.run.hp)))throw new Error('冒险存档损坏。');
  return s;
}
async function readLegacy():Promise<SaveData> {const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('saves','readonly');const r=tx.objectStore('saves').get('current');let value:SaveData;r.onsuccess=()=>{try{value=r.result?checkSave(r.result):freshSave();}catch(e){reject(e);}};tx.oncomplete=()=>{db.close();resolve(value);};tx.onabort=()=>{db.close();reject(tx.error);};});}
export async function readSave():Promise<SaveData> {
  const current=await readMode<SaveData>('cards');
  const legacy=current?checkSave(current.snapshot):await readLegacy();
  const result=await openMode('cards',legacy,resourcesOf(legacy),rosterOf(legacy));
  sharedRevision=result.record.revision;
  const save=checkSave(result.record.snapshot);
  save.meta.spirit=result.profile.resources.spirit;save.meta.herbs=result.profile.resources.herb;save.meta.food=result.profile.resources.food;
  for(const [hero,definition] of Object.entries(HEROES)){
    const state=result.profile.characters[definition.characterId], c=save.meta.characters[hero as keyof typeof HEROES];
    if(state){c.deaths=state.deaths??c.deaths;c.bond=state.bond??c.bond;c.sealed=state.sealed??c.sealed;}
    if(!c.deaths){delete c.woundDeck;delete c.woundRelics;}
  }
  if(Object.values(save.meta.characters).every(c=>(c.deaths||0)>=2)){
    const times=Object.values(HEROES).map(h=>result.profile.characters[h.characterId]?.reviveAt).filter((t):t is number=>typeof t==='number');
    if(times.length)save.meta.allDeadAt=Math.max(...times)-5*60*60*1000;
  }else delete save.meta.allDeadAt;
  return save;
}
export async function writeSave(save: SaveData):Promise<void> {
  if(sharedRevision===undefined)throw new Error('请先读取统一存档。');
  const next=checkSave(save);
  const result=await commitMode('cards',next,{revision:sharedRevision,resources:resourcesOf(next),characters:rosterOf(next),operationId:crypto.randomUUID()});
  sharedRevision=result.record.revision;
  mirrorSummary(next);
}
export function downloadJSON(value: unknown, filename: string) {const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
