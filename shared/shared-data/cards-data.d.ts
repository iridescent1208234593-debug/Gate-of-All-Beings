import type {Element,AbilitySystem} from '../shared-types/models';
export interface SharedCard {
  id:string;mode:'cards'|'slay';sourceId:string;name:string;characterId:number|null;cost:number;type:string;text:string;
  element:Element|null;school:AbilitySystem|null;native:Record<string,unknown>;upgrade?:Record<string,unknown>|null;
}
declare const data:{schemaVersion:1;source:string;cards:SharedCard[]};
export default data;
