/**
 * 用户名校验规则。
 *
 * 规则（用户指定）：1~18 字，仅允许中文、英文、数字，严格校验。
 *
 * 关键点：长度按「字符」计，不按字节计。
 * UTF-8 下 1 个汉字是 3 字节，若按字节算 18 字节只能输入 6 个汉字，那就不是用户要的
 * 「1~18 字」了。因此这里用 Intl.Segmenter 按字素簇切分，1 个汉字 = 1。
 */

export const USERNAME_RULE = Object.freeze({
  MIN_LEN: 1,
  MAX_LEN: 18,
  LABEL: '1~18 字，仅限中文 / 英文 / 数字',
});

/** 允许的字符：CJK 统一表意文字 + 扩展 A + 兼容表意文字 + 半角/全角英文字母数字 */
const ALLOWED_CHAR = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFFA-Za-z0-9\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/u;

/** 字素簇切分器；老浏览器无 Intl.Segmenter 时退化为 Array.from */
const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/**
 * 按「字符」计数。
 * @param {string} text
 * @returns {number}
 */
export function countChars(text) {
  if (typeof text !== 'string' || text.length === 0) return 0;
  if (!segmenter) return Array.from(text).length;
  let n = 0;
  for (const _ of segmenter.segment(text)) n++;
  return n;
}

/**
 * 找出所有不允许的字符（去重，保留出现顺序）。
 * @param {string} text
 * @returns {string[]}
 */
export function findIllegalChars(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const bad = new Set();
  for (const ch of text) {
    if (!ALLOWED_CHAR.test(ch)) bad.add(ch);
  }
  return [...bad];
}

/**
 * 完整校验。
 * @param {string} raw 输入框原始内容
 * @returns {{ok:boolean, code:'ok'|'empty'|'tooLong'|'illegal', message:string, value:string, length:number}}
 */
export function validateUsername(raw) {
  const value = typeof raw === 'string' ? raw : '';
  const length = countChars(value);

  if (length === 0) {
    return { ok: false, code: 'empty', message: '请输入用户名', value, length };
  }

  const illegal = findIllegalChars(value);
  if (illegal.length > 0) {
    // 控制字符不可打印，避免提示文字里出现乱码方块
    const shown = illegal
      .slice(0, 3)
      .map((c) => (/[\p{Cc}\p{Cf}]/u.test(c) ? '\\u' + c.codePointAt(0).toString(16).padStart(4, '0') : c))
      .join(' ');
    const more = illegal.length > 3 ? ' 等' : '';
    return {
      ok: false,
      code: 'illegal',
      message: `只能使用中文、英文和数字，请删除：${shown}${more}`,
      value,
      length,
    };
  }

  if (length > USERNAME_RULE.MAX_LEN) {
    return {
      ok: false,
      code: 'tooLong',
      message: `最多 ${USERNAME_RULE.MAX_LEN} 字，当前已输入 ${length} 字`,
      value,
      length,
    };
  }

  return { ok: true, code: 'ok', message: '', value, length };
}

export default { USERNAME_RULE, countChars, findIllegalChars, validateUsername };
