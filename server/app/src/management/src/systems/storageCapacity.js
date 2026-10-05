import {getBuilding} from '../content/buildings.js';
import {isBuilt} from './building.js';
export function storageCapacity(state){
  const cap={spirit:400,food:300};
  for(const b of state.buildings||[]){
    if(!isBuilt(b))continue;
    for(const [key,value] of Object.entries(getBuilding(b.buildingId)?.storageCap||{}))cap[key]=(cap[key]||0)+value;
  }
  return cap;
}
