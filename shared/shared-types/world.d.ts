import type {AbilitySystem, Element} from './models';
export const ABILITY_SYSTEMS: Readonly<Record<AbilitySystem, string>>;
export const ELEMENTS: Readonly<Record<Element, string>>;
export const WORLD_SCHEMA_VERSION: 1;
export const HERO_CHARACTER_IDS: Readonly<{xiaohei:1; wuxian:2; fengxi:3}>;
export const CHARACTER_AFFINITIES: Readonly<Record<number,{element:Element; systems:AbilitySystem[]}>>;
