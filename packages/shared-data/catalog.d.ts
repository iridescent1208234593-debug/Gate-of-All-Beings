import type {AbilitySystem,Element} from '../shared-types/models';
export interface CatalogueCharacter {
  id:number;name:string;aliases:string;species:string;category:string;affiliation:string;
  abilities:string[];abilitiesSummary:string;summary:string;gender:string;personality:string;appearance:string;voice:string;sourceUrl:string;
  systems:AbilitySystem[];elements:Element[];
  profile?:{identity:string;personality:string;appearance:string;voice_actor:string;source_url:string;sourceRowId:number;sourceRowIds:number[]};
  imageRef?:{kind:'character-image';id:number;url:string};
  balance:{hp:number;attack:number;defense:number;power:number;tier:string;rarity:string;realm_key:string;realm_name:string;modelVersion:string};
}
export const characters:CatalogueCharacter[];
export const facts:{schemaVersion:number;source:string;provenance:{source:string;sourceRows:number;activeCharacters:number;characterFactsSha256:string};characters:CatalogueCharacter[];locations:{id:number;name:string;type:string;description:string}[];timeline:{id:number;era:string;event:string;description:string;relatedCharacters:string}[];terms:{id:number;category:string;term:string;definition:string}[];organizations:{id:number;name:string;description:string}[]};
export function characterById(id:number|string):CatalogueCharacter|undefined;
export function characterByName(name:string):CatalogueCharacter|undefined;
export function characterFor(mode:string,localId:string):CatalogueCharacter|undefined;
export function rebirthCharacter(c:CatalogueCharacter):Omit<CatalogueCharacter,'abilities'|'aliases'> & {characterId:number;abilities:string;aliases:string[];race:string;identity:string};
