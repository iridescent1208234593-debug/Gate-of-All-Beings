import {useEffect,useState} from 'react';
import {setCardOverrides} from './core/content';
import {validateBalance,type CardBalance,type CardOverrides} from './core/cardBalance';
import type {EcoIndividual} from '@lxh/shared-types/models';

interface Snapshot {revision:number;updatedAt:string|null;overrides:CardOverrides;editable:boolean;token?:string;backup?:{schemaVersion:1;revision:number;updatedAt:string|null;overrides:CardOverrides;individuals:Record<string,EcoIndividual>}}
async function request(init?:RequestInit,id?:string):Promise<Snapshot>{
  const response=await fetch(`${import.meta.env.BASE_URL}api/card-balance${id?`/cards/${encodeURIComponent(id)}`:''}`,{...init,signal:init?.signal??AbortSignal.timeout(10000)});
  const data=await response.json().catch(()=>{throw new Error('数值后台未启动，请使用本地开发或预览服务。');});
  if(!response.ok)throw new Error(data.error||'无法读取数值后台。');
  if(!Number.isSafeInteger(data.revision)||!data.overrides||typeof data.overrides!=='object'||Array.isArray(data.overrides))throw new Error('后台配置格式无效。');
  const overrides:CardOverrides={};for(const [id,value] of Object.entries(data.overrides))overrides[id]=validateBalance(value);
  return {...data,overrides};
}
export function useCardBalance(){
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);
  function accept(next:Snapshot){setCardOverrides(next.overrides);setSnapshot(next);setError('');}
  async function reload(){setBusy(true);try{accept(await request());}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  useEffect(()=>{const abort=new AbortController();request({signal:AbortSignal.any([abort.signal,AbortSignal.timeout(10000)])}).then(accept).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setBusy(false);});return()=>abort.abort();},[]);
  async function save(id:string,value:CardBalance|null,individual?:EcoIndividual){
    if(!snapshot?.editable||!snapshot.token)throw new Error('请在本机打开图鉴并连接数值后台。');
    const next=await request({method:'PUT',headers:{'Content-Type':'application/json','X-Card-Admin-Token':snapshot.token},body:JSON.stringify({revision:snapshot.revision,value:value===null?null:validateBalance(value),individual})},id);
    accept(next);
  }
  return {snapshot,error,busy,reload,save};
}
export type CardBalanceService=ReturnType<typeof useCardBalance>;
