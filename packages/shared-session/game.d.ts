export type ResourceKey = 'spirit'|'herb'|'food'|'soul'|'shards';
export type ResourceAmounts = Partial<Record<ResourceKey,number>>;
export interface RosterState { discovered?:boolean; bond?:number; sealed?:boolean; deaths?:number; reviveAt?:number|null; }
export interface GameProfile {
  schemaVersion:1; revision:number; resources:Record<ResourceKey,number>;
  characters:Record<string,RosterState>;
  modes:Record<string,{revision:number;updatedAt:number}>;
  recent:{id:string;mode:string;resources:ResourceAmounts;summary:string;at:number}[];
}
export interface ModeRecord<T=unknown> {snapshot:T;nativeResources:ResourceAmounts;revision:number;updatedAt:number;}
export interface GameResult<T=unknown> {profile:GameProfile;record:ModeRecord<T>;duplicate:boolean;}
export const GAME_DB:string;
export const RESOURCE_KEYS:readonly ResourceKey[];
export function openMode<T>(mode:string,snapshot:T,resources?:ResourceAmounts,roster?:Record<string,RosterState>):Promise<GameResult<T>>;
export function commitMode<T>(mode:string,snapshot:T,options:{revision:number;resources?:ResourceAmounts;characters?:Record<string,RosterState>;operationId?:string}):Promise<GameResult<T>>;
export function transact(mode:string,operation:{id:string;resources?:ResourceAmounts;characters?:Record<string,RosterState>;summary?:string}):Promise<GameResult>;
export function exportGame():Promise<{format:string;version:1;profile:GameProfile;modes:Record<string,ModeRecord>;receipts:Record<string,{mode:string;revision:number}>}>;
export function readGame():Promise<GameProfile>;
export function readMode<T=unknown>(mode:string):Promise<ModeRecord<T>|null>;
export function onGameChange(handler:(event:{mode:string;revision:number})=>void):()=>void;
