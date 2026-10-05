export type AbilitySystem = 'yuling' | 'shengling' | 'zaowu' | 'kongjian' | 'xinling' | 'suoyu';
export type Element = 'jin' | 'mu' | 'shui' | 'huo' | 'tu';
/** Facts and simulation values have separate owners. Never use a spawn ID as a character ID. */
export interface Character {
  id: number;
  name: string;
  aliases: string;
  species: string;
  affiliation: string;
  abilities: string[];
  sourceUrl: string;
}
export interface LingzhiSpace {
  id: string;
  ownerCharacterId: number | null;
  element: Element;
  concentration: number;
  capacity: number;
  materialLing: number;
  lifeLing: number;
  detritus: number;
  decomposers: number;
}
export interface EcoExchange {
  schemaVersion: 1 | 2;
  kind: 'eco-harvest';
  worldId: string;
  sequence: number;
  space?: LingzhiSpace;
  resources: {food: number; herb: number; spirit: number};
  species: {id: string; name: string; role: 'producer'|'herbivore'|'carnivore'; population: number}[];
  individuals?: EcoIndividual[];
}
/** A bounded observation of a real living entity, not a database character. */
export interface EcoIndividual {
  id: string;
  sourceId: string;
  worldId: string;
  name: string;
  role: 'producer'|'herbivore'|'carnivore';
  element: Element;
  traits: {size: number; speed: number; vitality: number};
}
export interface TimelineFact {
  id: number;
  era: string;
  event: string;
  description: string;
  relatedCharacters: string;
}
