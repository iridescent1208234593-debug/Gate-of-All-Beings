/** Layered species: 人类 / 妖精 / 其他 → 种族（鸦科、龙族…）→ 细分（三足乌）, plus a free note. */
export type SpeciesParts = { kind: string; family: string; sub: string; note: string };
type SpeciesSource = { species_name?: string; species_kind?: string; species_family?: string; species_sub?: string; species_note?: string };

export const HUMAN = '人类';
export const YAOJING = '妖精';
export const FAMILY_SUGGESTIONS: { label: string; items: string[] }[] = [
  { label: '常见种族', items: ['猫科', '犬科', '狐', '鸦科', '鹤', '蛇', '鹿', '兔', '熊', '鱼', '蝶', '花木', '菌'] },
  { label: '神话种族', items: ['龙族', '凤族', '麒麟', '九尾狐', '白泽', '鲲鹏', '神鸟', '山灵'] },
];
export const SUB_SUGGESTIONS: Record<string, string[]> = {
  鸦科: ['三足乌', '渡鸦', '喜鹊', '寒鸦'],
  猫科: ['狸花', '黑猫', '山猫', '虎'],
  犬科: ['狼', '柴犬', '豺'],
  狐: ['赤狐', '白狐', '九尾'],
  龙族: ['应龙', '烛龙', '蛟'],
  凤族: ['青鸾', '朱雀', '鸑鷟'],
};

const OPEN = /[（(]/;
const SEPARATORS = /[，,、;；]/;

/** "鸦科（三足乌，上古鸦科神鸟后裔）" → family / sub / note. */
export function parseDetail(detail: string): Omit<SpeciesParts, 'kind'> {
  const text = detail.trim().replace(/[）)]+$/, '');
  const open = text.search(OPEN);
  if (open < 0) return { family: text, sub: '', note: '' };
  const family = text.slice(0, open).trim();
  const [sub = '', ...rest] = text.slice(open + 1).split(SEPARATORS).map(part => part.replace(/[（()）]/g, '').trim());
  return { family, sub, note: rest.filter(Boolean).join('，') };
}

export function parseSpeciesName(name: string): SpeciesParts {
  const text = name.trim();
  if (!text) return { kind: '', family: '', sub: '', note: '' };
  if (text.includes('·')) {
    const [kind = '', family = '', sub = ''] = text.split('·').map(part => part.trim());
    return { kind, family, sub, note: '' };
  }
  const open = text.search(OPEN);
  if (open < 0) return text === HUMAN || text === YAOJING ? { kind: text, family: '', sub: '', note: '' } : { kind: YAOJING, family: text, sub: '', note: '' };
  return { kind: text.slice(0, open).trim() || YAOJING, ...parseDetail(text.slice(open + 1).replace(/[）)]$/, '')) };
}

/** OC records keep species_type (人类 / 妖精) and a free species_detail. */
export function speciesFromOC(type: string, detail: string): SpeciesParts {
  const kind = type.trim() || (detail.trim() ? YAOJING : '');
  return kind === HUMAN ? { kind, family: '', sub: '', note: detail.trim() } : { kind, ...parseDetail(detail) };
}

export function speciesParts(identity: SpeciesSource): SpeciesParts {
  if (identity.species_kind) return { kind: identity.species_kind, family: identity.species_family || '', sub: identity.species_sub || '', note: identity.species_note || '' };
  return parseSpeciesName(identity.species_name || '');
}

export function composeSpecies(parts: SpeciesParts) {
  const kind = parts.kind.trim();
  if (kind === HUMAN) return HUMAN;
  return [kind, parts.family.trim(), parts.sub.trim()].filter(Boolean).join(' · ');
}

export function speciesFields(parts: SpeciesParts) {
  return {
    species_name: composeSpecies(parts),
    species_kind: parts.kind.trim().slice(0, 20),
    species_family: parts.kind.trim() === HUMAN ? '' : parts.family.trim().slice(0, 40),
    species_sub: parts.kind.trim() === HUMAN ? '' : parts.sub.trim().slice(0, 40),
    species_note: parts.note.trim().slice(0, 120),
  };
}
