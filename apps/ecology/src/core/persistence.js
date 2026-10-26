import { unifiedStorage } from '@lxh/shared-session/kv.js';
const localStorage = unifiedStorage('ecology');
import {validateEcoExchange} from '@lxh/shared-types/exchange';
const KEY='zszm-ecology-v2';
export function encodeWorld(state) {
  return JSON.stringify(state,(_,v)=>v instanceof Uint8Array?{$array:'u8',values:[...v]}:v instanceof Float32Array?{$array:'f32',values:[...v]}:v);
}
export function decodeWorld(text) {
  if(typeof text!=='string'||text.length>4000000)throw new Error('生态存档过大。');
  const s=JSON.parse(text,(_,v)=>v?.$array==='u8'?Uint8Array.from(v.values):v?.$array==='f32'?Float32Array.from(v.values):v);
  if(s?.version!==2||!/^eco-[a-zA-Z0-9-]{1,80}$/.test(s.worldId)||!Number.isInteger(s.rng)||!Number.isFinite(s.time)||s.time<0||!Number.isFinite(s.pendingDt)||s.pendingDt<0||!Number.isFinite(s.timeScale)||s.timeScale<1||s.timeScale>3)throw new Error('生态存档格式不兼容。');
  if(!s.map||s.map.cols!==24||s.map.rows!==24||s.map.tiles?.length!==576||!(s.map.tiles instanceof Uint8Array)||!(s.map.heightField instanceof Float32Array))throw new Error('生态地图损坏。');
  for(const k of ['cells','organisms','plants','foods']){
    if(!Array.isArray(s[k])||s[k].length>10000||s[k].some(x=>!x||!Array.isArray(x.pos)||x.pos.some(v=>!Number.isFinite(v))))throw new Error('生态实体损坏。');
  }
  if(!s.space||['materialLing','lifeLing','detritus','decomposers','concentration','capacity'].some(k=>!Number.isFinite(s.space[k])||s.space[k]<0)||!s.ecology||!Number.isInteger(s.ecology.sequence)||['food','herb','spirit'].some(k=>!Number.isFinite(s.ecology.harvest?.[k])||s.ecology.harvest[k]<0))throw new Error('灵质循环数据损坏。');
  if(s.ecology.pendingExports){
    if(!Array.isArray(s.ecology.pendingExports)||s.ecology.pendingExports.length>100)throw new Error('待送回收获记录损坏。');
    for(const p of s.ecology.pendingExports){validateEcoExchange(p);if(p.worldId!==s.worldId||p.sequence>s.ecology.sequence)throw new Error('收获批次来源损坏。');}
  }
  return s;
}
export function loadWorld(){const text=localStorage.getItem(KEY);return text?decodeWorld(text):null;}
export function saveWorld(state){localStorage.setItem(KEY,encodeWorld(state));}
