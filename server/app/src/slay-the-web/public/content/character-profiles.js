import {characters,characterByName,rebirthCharacter} from '/shared/shared-data/catalog.js';
export const characterProfiles=characters.filter(c=>c.profile).map(rebirthCharacter);
export const profileStats={total:characterProfiles.length,withIdentity:characterProfiles.filter(c=>c.identity).length,withPersonality:characterProfiles.filter(c=>c.personality).length,withAppearance:characterProfiles.filter(c=>c.appearance).length,withVoice:characterProfiles.filter(c=>c.voice).length};
export function profileFor(name){const character=characterByName(name);return character?.profile?rebirthCharacter(character):undefined;}
