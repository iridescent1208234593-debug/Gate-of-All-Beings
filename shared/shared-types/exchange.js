/** @typedef {import('./models').EcoExchange} EcoExchange */
import { ELEMENTS } from './world.js';
const roles = new Set(['producer','herbivore','carnivore']);
const names = {producer:'灵芽',herbivore:'林间食草灵',carnivore:'巡林猎灵'};
export function validateEcoIndividual(value) {
  if (!value || !/^eco-[a-zA-Z0-9-]{1,80}$/.test(value.worldId) ||
      !/^(plant|organism)-[0-9]{1,12}$/.test(value.sourceId) ||
      value.id !== `eco-card-${value.worldId}-${value.sourceId}` ||
      !roles.has(value.role) || !Object.hasOwn(ELEMENTS,value.element)) throw new Error('生态个体记录无效。');
  const traits={};
  for(const key of ['size','speed','vitality']) {
    const n=value.traits?.[key];
    if(!Number.isInteger(n)||n<1||n>10)throw new Error('生态个体特征无效。');
    traits[key]=n;
  }
  return {id:value.id,sourceId:value.sourceId,worldId:value.worldId,name:`${names[value.role]} · ${value.sourceId.split('-')[1]}`,role:value.role,element:value.element,traits};
}
/** Validate an offline transfer before any game state is changed. */
export function validateEcoExchange(value) {
  if (!value || ![1,2].includes(value.schemaVersion) || value.kind !== 'eco-harvest' ||
      typeof value.worldId !== 'string' || !/^eco-[a-zA-Z0-9-]{1,80}$/.test(value.worldId) ||
      !Number.isSafeInteger(value.sequence) || value.sequence < 1) throw new Error('生态收获文件格式不正确。');
  const resources = {};
  for (const key of ['food','herb','spirit']) {
    const n = value.resources?.[key];
    if (!Number.isInteger(n) || n < 0 || n > 500) throw new Error('生态资源数量无效。');
    resources[key] = n;
  }
  if (!Object.values(resources).some(n => n > 0)) throw new Error('这份收获没有可领取的资源。');
  if (!Array.isArray(value.species) || value.species.length > 3) throw new Error('生态物种记录无效。');
  const seenRoles = new Set();
  const species = value.species.map(s => {
    if (!s || !roles.has(s.role) || typeof s.id !== 'string' || s.id !== `eco-${s.role}` ||
        seenRoles.has(s.role) || !Number.isInteger(s.population) || s.population < 1 || s.population > 10000) throw new Error('生态物种记录无效。');
    seenRoles.add(s.role);
    return {id:s.id, name:{producer:'灵芽',herbivore:'林间食草灵',carnivore:'巡林猎灵'}[s.role], role:s.role, population:s.population};
  });
  const packet={schemaVersion:value.schemaVersion,kind:'eco-harvest',worldId:value.worldId,sequence:value.sequence,resources,species};
  if(value.schemaVersion===2){
    if(!Array.isArray(value.individuals)||value.individuals.length>12)throw new Error('单批最多结缘 12 个生态个体。');
    const seen=new Set();
    packet.individuals=value.individuals.map(v=>{
      const i=validateEcoIndividual(v);
      if(i.worldId!==packet.worldId||seen.has(i.id)||!seenRoles.has(i.role))throw new Error('生态个体来源或编号无效。');
      seen.add(i.id);return i;
    });
  }
  if(value.space){
    const v=value.space;
    if(v.id!==value.worldId||!Object.hasOwn(ELEMENTS,v.element))throw new Error('灵质空间无效。');
    const space={id:v.id,ownerCharacterId:null,element:v.element};
    for(const key of ['concentration','capacity','materialLing','lifeLing','detritus','decomposers']){
      if(!Number.isFinite(v[key])||v[key]<0||v[key]>1e9)throw new Error('灵质空间数值无效。');
      space[key]=v[key];
    }
    packet.space=space;
  }
  return packet;
}
export function receiveEcoExchange(state, value) {
  const packet = validateEcoExchange(value);
  const receipts = state.ecoReceipts || {};
  if ((receipts[packet.worldId] || 0) >= packet.sequence) throw new Error('这份收获已经领取，或早于已领取的批次。');
  if (Object.keys(receipts).length >= 1000 && !(packet.worldId in receipts)) throw new Error('已记录的生态世界过多。');
  return {packet, receipts:{...receipts,[packet.worldId]:packet.sequence}};
}
