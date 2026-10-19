// Role facts are exported once from the world DB; this file only chooses display groups.
import {characters as roster,rebirthCharacter,characterById} from '/shared/shared-data/catalog.js';
const core=new Set([1, 2, 3, 4, 9, 7, 17, 8, 20, 23, 29, 11, 5, 6, 18, 13, 142, 53, 80, 274, 12, 14, 15, 10, 21, 26, 27, 34, 36, 54, 44, 52, 58, 35, 24, 48, 19, 22, 25, 30, 31, 32, 39, 61, 83, 93, 102, 135, 141, 190].map(id=>characterById(id)?.id).filter(Boolean));
export const characters=roster.filter(c=>core.has(c.id)).map(rebirthCharacter);
export const extraCharacters=roster.filter(c=>!core.has(c.id)).map(rebirthCharacter);
export const allCharacters=roster.map(rebirthCharacter);
