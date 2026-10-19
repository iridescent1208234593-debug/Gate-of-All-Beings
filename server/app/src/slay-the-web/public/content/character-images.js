// Images come from the current HK reference snapshot and retained-media manifest.
import {characters,facts,characterByName} from '/shared/shared-data/catalog.js';
export const characterImages=Object.fromEntries(characters.filter(c=>c.imageRef).map(c=>[c.name,c.imageRef.url]));
export const characterImageCount=Object.keys(characterImages).length;
for(const entry of facts.characterAliases){
  for(const name of [entry.name,...entry.aliases.split(/[、,，;；\n]/)]){
    const character=characterByName(name.trim());
    if(character?.imageRef)characterImages[name.trim()]=character.imageRef.url;
  }
}
