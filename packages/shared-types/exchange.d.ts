import type {EcoExchange} from './models';
import type {EcoIndividual} from './models';
export function validateEcoIndividual(value: unknown): EcoIndividual;
export function validateEcoExchange(value: unknown): EcoExchange;
export function receiveEcoExchange(state:{ecoReceipts?:Record<string,number>}, value:unknown): {packet:EcoExchange;receipts:Record<string,number>};
