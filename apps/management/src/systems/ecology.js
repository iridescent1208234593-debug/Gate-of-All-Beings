import {receiveEcoExchange} from '@lxh/shared-types/exchange';
import {storageCapacity} from './storageCapacity.js';
/** Import is an ordinary reducer action, also suitable for an authoritative server. */
export function importEcology(state, value) {
  const {packet,receipts}=receiveEcoExchange(state,value);
  const cap=storageCapacity(state);
  for(const key of ['food','spirit'])if((state.resources[key]||0)+packet.resources[key]>cap[key])throw new Error('仓库空间不足，收获已保留。请消耗库存或建造灵仓后重试。');
  return {...state,ecoReceipts:receipts,resources:{...state.resources,
    food:state.resources.food+packet.resources.food,
    herb:(state.resources.herb||0)+packet.resources.herb,
    spirit:state.resources.spirit+packet.resources.spirit},
    eventLog:[...state.eventLog,`灵境送来食物 ${packet.resources.food}、草药 ${packet.resources.herb}、灵质 ${packet.resources.spirit}。`].slice(-100)};
}
