import facts from './worldview-data.js';
export {facts};
export const characters = facts.characters;
const byId = new Map(characters.map(c=>[c.id,c]));
const canonicalNames = new Map();
for(const c of characters){if(!canonicalNames.has(c.name))canonicalNames.set(c.name,new Set());canonicalNames.get(c.name).add(c.id);}
const names = new Map();
function addName(name,id) {
  const key=String(name||'').trim();
  if(!key)return;
  if(!names.has(key))names.set(key,new Set());
  names.get(key).add(id);
}
for(const entry of facts.characterAliases) {
  addName(entry.name,entry.id);
  for(const name of entry.aliases.split(/[、,，;；\n]/))addName(name,entry.id);
}
/** Resolve retired DB IDs; unknown IDs never become a new identity by accident. */
export function characterById(id) { return byId.get(facts.redirects[id] ?? Number(id)); }
/** Exact names/declared aliases only. Ambiguous names require explicit ID mapping. */
export function characterByName(name) {
  const key=String(name||'').trim();
  const ids=canonicalNames.get(key)||names.get(key);
  return ids?.size===1 ? byId.get(ids.values().next().value) : undefined;
}
export function characterFor(mode,localId) {
  const mapping=facts.idMappings.find(m=>m.system===mode&&m.system_local_id===localId);
  return mapping ? characterById(mapping.character_id) : undefined;
}
export function rebirthCharacter(c) {
  return {...c,characterId:c.id,aliases:c.aliases.split(/[、,，;；\n]/).map(s=>s.trim()).filter(Boolean),abilities:c.abilitiesSummary||c.abilities.join('；'),race:c.species,
    identity:c.profile?.identity||c.affiliation,personality:c.personality||c.profile?.personality||'',
    appearance:c.appearance||c.profile?.appearance||'',voice:c.voice||c.profile?.voice_actor||''};
}
