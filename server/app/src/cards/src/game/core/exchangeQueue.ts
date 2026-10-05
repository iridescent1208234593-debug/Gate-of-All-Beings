import { validateEcoExchange } from '@lxh/shared-types/exchange';
import { claimEcology } from './meta';
import type { SaveData } from './types';

export function queueEcology(save: SaveData,value:unknown): SaveData {
  const packet=validateEcoExchange(value);
  if((save.ecoDeliveries||[]).length>=100)throw new Error('请先打开「据点经营」接收待入库的收获。');
  return {...save,meta:claimEcology(save.meta,packet),ecoDeliveries:[...(save.ecoDeliveries||[]),packet]};
}
export function acknowledgeDelivery(save:SaveData,worldId:string,sequence:number): SaveData {
  return {...save,ecoDeliveries:(save.ecoDeliveries||[]).filter(p=>!(p.worldId===worldId&&p.sequence===sequence))};
}
