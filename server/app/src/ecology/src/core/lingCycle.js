/** @typedef {import('@lxh/shared-types/models').LingzhiSpace} LingzhiSpace */
import { validateEcoExchange, validateEcoIndividual } from '@lxh/shared-types/exchange';
/** @returns {LingzhiSpace} */
export function createSpace(map, id) {
  return {id,ownerCharacterId:null,element:'mu',concentration:1,capacity:map.cols*map.rows,
    materialLing:120,lifeLing:60,detritus:0,decomposers:8};
}
export function stepLingCycle(before, after, dt) {
  const space = {...before.space};
  const surviving = new Set([...after.cells,...after.organisms].map(x=>x.id));
  const lost = [...before.cells,...before.organisms].filter(x=>!surviving.has(x.id));
  const returned = lost.reduce((n,x)=>n + (x.moduleCount || 1) * .5,0);
  space.detritus += returned;
  const recycled = Math.min(space.detritus,space.decomposers*.08*dt);
  space.detritus -= recycled;
  // Open system: ambient material ling enters at an explicit, measured rate.
  const inflow = space.capacity*.0004*dt*space.concentration;
  space.materialLing = Math.min(space.capacity,space.materialLing + recycled*.7 + inflow);
  space.lifeLing = Math.min(space.capacity,space.lifeLing + recycled*.3);
  const growth = Math.max(0,after.plants.reduce((n,p)=>n+p.biomass,0)-before.plants.reduce((n,p)=>n+p.biomass,0));
  space.materialLing = Math.max(0,space.materialLing-growth*.01);
  const births = Math.max(0,after.cells.length+after.organisms.length-before.cells.length-before.organisms.length+lost.length);
  space.lifeLing = Math.max(0,space.lifeLing-births*.1);
  space.decomposers = Math.max(2,Math.min(24,space.decomposers+(space.detritus>1?.02:-.004)*dt));
  const ecology = {...before.ecology,harvest:{...before.ecology.harvest}};
  ecology.recycled += recycled;
  ecology.inflow += inflow;
  ecology.deaths += lost.length;
  const productivity = Math.min(1,after.plants.length/100)*space.concentration;
  ecology.harvest.food = Math.min(500,ecology.harvest.food+productivity*.12*dt);
  ecology.harvest.herb = Math.min(500,ecology.harvest.herb+productivity*.035*dt);
  ecology.harvest.spirit = Math.min(500,ecology.harvest.spirit+recycled*.25+productivity*.035*dt);
  return {...after,space,ecology};
}
export function harvest(state) {
  if((state.ecology.pendingExports||[]).length>=100)throw new Error('请先在主入口接收待送回的收获。');
  const resources=Object.fromEntries(Object.entries(state.ecology.harvest).map(([k,v])=>[k,Math.floor(v)]));
  if (!Object.values(resources).some(v=>v>0)) throw new Error('灵境正在生长，稍等片刻再收获。');
  const producers=[...state.plants,...state.organisms.filter(o=>o.diet==='phototroph')];
  const species=[{id:'eco-producer',name:'灵芽',role:'producer',population:producers.length},
    {id:'eco-herbivore',name:'林间食草灵',role:'herbivore',population:state.organisms.filter(o=>o.diet==='herbivore').length},
    {id:'eco-carnivore',name:'巡林猎灵',role:'carnivore',population:state.organisms.filter(o=>o.diet==='carnivore').length}].filter(s=>s.population>0);
  const sequence=state.ecology.sequence+1;
  const observed=new Set(state.ecology.observedIndividuals||[]);
  const individuals=[];
  const trait=n=>Math.max(1,Math.min(10,Math.round(1+(Number.isFinite(n)?n:0.5)*9)));
  for(const role of ['producer','herbivore','carnivore']){
    const candidates=role==='producer'?producers:state.organisms.filter(o=>o.diet===role);
    for(const entity of candidates){
      const sourceId=`${entity.biomass!==undefined?'plant':'organism'}-${entity.id}`;
      const id=`eco-card-${state.worldId}-${sourceId}`;
      if(observed.has(id)||individuals.filter(i=>i.role===role).length>=4||observed.size>=512)continue;
      individuals.push(validateEcoIndividual({id,worldId:state.worldId,sourceId,role,element:state.space.element,
        traits:{size:trait(entity.genome?.size??entity.biomass/entity.maxBiomass),speed:trait(entity.genome?.speed??0),vitality:trait(entity.genome?.metabolism??entity.biomass/entity.maxBiomass)}}));
      observed.add(id);
    }
  }
  const packet=validateEcoExchange({schemaVersion:2,kind:'eco-harvest',worldId:state.worldId,sequence,space:{...state.space},resources,species,individuals});
  return {...state,ecology:{...state.ecology,sequence,observedIndividuals:[...observed],
    harvest:Object.fromEntries(Object.entries(state.ecology.harvest).map(([k,v])=>[k,v-resources[k]])),lastExport:packet,
    pendingExports:[...(state.ecology.pendingExports||[]),packet]}};
}
