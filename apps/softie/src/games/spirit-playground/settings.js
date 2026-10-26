import { BODY_SHAPE_POINT_COUNT, normalizeBodyShape } from './body-shape.js';

export const SPIRIT_SETTINGS_API = '/api/spirit-settings';

export const SPIRIT_WORLD_SCALE = 1 / 3;
export const SPIRIT_SKIN_RADII = Object.freeze({ softie: 1.66, custom: 1.66, cat: 1.2, bud: 1.25 });
export const spiritRadius = ({ skin, size = 1 } = {}) =>
  (SPIRIT_SKIN_RADII[skin] ?? SPIRIT_SKIN_RADII.softie) * size * SPIRIT_WORLD_SCALE;

export const DEFAULT_SPIRIT_SETTINGS = Object.freeze({
  version: 3,
  name: '小灵',
  color: '#a5e0cd',
  size: 1,
  stiffness: 0.35,
  damping: 0.45,
  opacity: 1,
  acceleration: 20,
  skin: 'softie',
  earSize: 1,
  tailLength: 1,
  eyeSize: 1,
  bodyShape: null,
  accessory: 'none',
});

export const SPIRIT_SETTINGS_LIMITS = Object.freeze({
  size: Object.freeze([0.65, 1.35]),
  stiffness: Object.freeze([0, 1]),
  damping: Object.freeze([0, 1]),
  opacity: Object.freeze([0.35, 1]),
  acceleration: Object.freeze([6, 28]),
  earSize: Object.freeze([0.7, 1.3]),
  tailLength: Object.freeze([0.5, 1.5]),
  eyeSize: Object.freeze([0.8, 1.2]),
});

const keys = Object.keys(DEFAULT_SPIRIT_SETTINGS);
const v2Keys = keys.filter(key => key !== 'bodyShape' && key !== 'accessory');
const v3LegacyKeys = keys.filter(key => key !== 'accessory');
const legacyKeys = v2Keys.slice(0, 8);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validName = value => typeof value === 'string' && value.trim().length > 0
  && Array.from(value.trim()).length <= 20 && !/[\u0000-\u001f\u007f]/.test(value);
const validColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

/** Lenient import/UI normalization. Persisted API writes use strict validation below. */
export function normalizeSpiritSettings(input) {
  const source = isRecord(input) ? input : {};
  const settings = { ...DEFAULT_SPIRIT_SETTINGS };
  if (validName(source.name)) settings.name = source.name.trim();
  if (validColor(source.color)) settings.color = source.color.toLowerCase();
  if (source.skin === 'cat' || source.skin === 'softie' || source.skin === 'bud' || source.skin === 'custom') settings.skin = source.skin;
  else if (source.version === 1) settings.skin = 'softie';
  if (source.accessory === 'test-badge') settings.accessory = source.accessory;
  for (const [key, [min, max]] of Object.entries(SPIRIT_SETTINGS_LIMITS)) {
    if (Number.isFinite(source[key])) settings[key] = Math.max(min, Math.min(max, source[key]));
  }
  if (settings.skin === 'custom' && source.bodyShape) {
    try { settings.bodyShape = normalizeBodyShape(source.bodyShape); } catch { settings.skin = 'softie'; }
  }
  if (settings.skin === 'custom' && !settings.bodyShape) settings.skin = 'softie';
  return settings;
}

/** Strict writes accept older profiles and persist a canonical v3 profile. */
export function validateSpiritSettings(input) {
  const required = input?.version === 1 ? legacyKeys : input?.version === 2 ? v2Keys
    : input?.version === 3 && !Object.hasOwn(input, 'accessory') ? v3LegacyKeys : keys;
  if (!isRecord(input) || Object.keys(input).length !== required.length
    || required.some(key => !Object.hasOwn(input, key)) || ![1, 2, 3].includes(input.version)) {
    throw new TypeError('灵体配置需要完整的版本 1、2 或版本 3 字段。');
  }
  if (!validName(input.name)) throw new TypeError('昵称须为 1–20 个字符，且不能包含控制字符。');
  if (!validColor(input.color)) throw new TypeError('颜色须为 #RRGGBB 格式。');
  if (Object.hasOwn(input, 'accessory') && !['none', 'test-badge'].includes(input.accessory)) {
    throw new TypeError('挂饰类型不受支持。');
  }
  for (const [key, [min, max]] of Object.entries(SPIRIT_SETTINGS_LIMITS)) {
    if (input.version === 1 && !legacyKeys.includes(key)) continue;
    if (!Number.isFinite(input[key]) || input[key] < min || input[key] > max) {
      throw new TypeError(`${key} 须为 ${min}–${max} 之间的数字。`);
    }
  }
  if (input.version >= 2 && !['cat', 'softie', 'bud', ...(input.version === 3 ? ['custom'] : [])].includes(input.skin)) {
    throw new TypeError('灵体形象不受支持。');
  }
  if (input.version === 3 && input.skin === 'custom') {
    if (!input.bodyShape || !Array.isArray(input.bodyShape.points) || input.bodyShape.points.length !== BODY_SHAPE_POINT_COUNT
      || input.bodyShape.points.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y)
        || Math.abs(point.x) > 1.001 || Math.abs(point.y) > 1.001)) {
      throw new TypeError(`自定义灵体需要 ${BODY_SHAPE_POINT_COUNT} 个标准化身体点。`);
    }
  } else if (input.version === 3 && input.bodyShape !== null) {
    throw new TypeError('预设灵体不能携带自定义身体轮廓。');
  }
  return { ...normalizeSpiritSettings(input), version: 3,
    bodyShape: input.version === 3 && input.skin === 'custom' ? normalizeBodyShape(input.bodyShape) : null,
    accessory: input.accessory === 'test-badge' ? input.accessory : 'none',
    skin: input.version === 1 ? 'softie' : input.skin };
}
