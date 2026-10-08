#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
六系演武 · 角色数值推导脚本
================================================

从世界观主库 worldview_luoxiaohei_v4.db **只读** 读取 characters / character_abilities /
ability_branches / cultivation_realm，按 data/stat-model.json 的规则推导每个角色的
六系归属、境界、hp / attack / defense，输出标准 JSON。

设计要点：
  * 只读：连接串固定 mode=ro，全程无任何写库语句。
  * 确定性：随机扰动由 md5(character_id) 派生，同输入必然同输出。
  * 零依赖：仅使用 Python 标准库。
  * 主线优先：--scope mainline 只跑主线角色，用于快速回归。

输出路径默认：data/generated/character_stats.json
"""

import argparse
import hashlib
import json
import os
import sqlite3
import sys
import time

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.dirname(HERE)                 # .../data
ROOT = os.path.dirname(DATA_DIR)                 # .../six-system-arena

DEFAULT_DB = r'E:\Projects\assets\罗小黑战记数据库\db\worldview_luoxiaohei_v4.db'
DEFAULT_MODEL = os.path.join(DATA_DIR, 'stat-model.json')
DEFAULT_SYSTEMS = os.path.join(DATA_DIR, 'six-systems.json')
DEFAULT_OUT = os.path.join(DATA_DIR, 'generated', 'character_stats.json')
DEFAULT_OVERRIDES = os.path.join(DATA_DIR, 'manual-overrides.json')

SIX_KEYS = ['jin', 'mu', 'shui', 'huo', 'tu', 'kongjian']
SYSTEM_CN = {'jin': '金', 'mu': '木', 'shui': '水', 'huo': '火', 'tu': '土', 'kongjian': '空间'}

# character_abilities 明细文本中的系别线索（优先级高于 abilities_summary 的泛化匹配）
ABILITY_HINTS = [
    ('jin', ['御灵系·金', '御灵系-金', '御金', '金属']),
    ('mu', ['御灵系·木', '御灵系-木', '御木', '木']),
    ('shui', ['御灵系·水', '御灵系-水', '御水', '御冰', '冰']),
    ('huo', ['御灵系·火', '御灵系-火', '御火', '火']),
    ('tu', ['御灵系·土', '御灵系-土', '御土', '土']),
    ('kongjian', ['空间系', '领域', '传送', '吞噬', '蕴藏', '转移']),
]


# --------------------------------------------------------------------------
# 工具
# --------------------------------------------------------------------------
def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def md5_int(text):
    return int(hashlib.md5(str(text).encode('utf-8')).hexdigest()[:8], 16)


def match_any(text, patterns):
    return any(p in text for p in patterns)


def split_segments(text, separators):
    """按并列分隔符把文本切成若干段（用于 FIX-1 的并列写法识别）。"""
    parts = [text or '']
    for d in separators:
        nxt = []
        for p in parts:
            nxt.extend(p.split(d))
        parts = nxt
    return parts


def segment_systems(text, model):
    """FIX-1（模型 v1.1.0）：并列写法切段后精确认系。

    例：『御灵系·金、土』→ 段『御灵系·金』(jin) + 段『土』(tu)；
    要求「剥离系名前缀后整段等于系名」，避免把描述性文本误判为系别。
    """
    cfg = model['element'].get('segmentMatch')
    if not cfg or not text:
        return []
    name_map = cfg.get('nameMap', {})
    prefixes = cfg.get('stripPrefixes', [])
    found = []
    for seg in split_segments(text, cfg.get('separators', ['、', ',', '，', ';', '；', '/'])):
        s = (seg or '').strip()
        for p in prefixes:
            if s.startswith(p):
                s = s[len(p):].strip()
                break
        s = s.strip(' \t·-—－（）()【】[]{}')
        key = name_map.get(s)
        if key and key not in found:
            found.append(key)
    return found


# --------------------------------------------------------------------------
# 六系归属推导
# --------------------------------------------------------------------------
def detect_systems(summary, ability_texts, model):
    """返回 (systems 有序去重列表, primary, confidence, sources)"""
    hits = []
    src = []
    blob = (summary or '') + ' ' + ' '.join(ability_texts)

    # 0) 特殊规则：如「六大系皆有涉猎」直接判定全六系
    for sp in model['element'].get('special', []):
        if sp.get('pattern') and sp['pattern'] in blob:
            return list(SIX_KEYS), SIX_KEYS[0], 'high', ['special: %s' % sp['pattern']]

    # 1) 能力明细表优先
    for key, pats in ABILITY_HINTS:
        for t in ability_texts:
            if match_any(t, pats):
                if key not in hits:
                    hits.append(key)
                    src.append('character_abilities: %s' % t[:40])
                break

    # 1.5) 并列写法切段精确认系（FIX-1 · 模型 v1.1.0）
    #      修复『御灵系·金、土』这类第二个系名不带前缀的漏匹配
    if model['element'].get('segmentMatch'):
        seg_keys = []
        for t in list(ability_texts) + [summary or '']:
            for k in segment_systems(t, model):
                if k not in seg_keys:
                    seg_keys.append(k)
        for key, _pats in ABILITY_HINTS:
            if key in seg_keys and key not in hits:
                hits.append(key)
                src.append('segment_match: %s' % SYSTEM_CN.get(key, key))

    # 2) abilities_summary 关键词（按模型配置顺序）
    for kw in model['element']['keywords']:
        key = kw['system']
        if key in hits:
            continue
        for p in kw['patterns']:
            if p and p in blob:
                hits.append(key)
                src.append('abilities_summary: %s' % p)
                break

    # 3) 宽松兜底：整段文本按系名做二次扫描（低置信度）
    if not hits:
        loose = [('jin', '金'), ('mu', '木'), ('shui', '水'), ('shui', '冰'),
                 ('huo', '火'), ('tu', '土'), ('kongjian', '空间')]
        for key, p in loose:
            if p in blob and key not in hits:
                hits.append(key)
                src.append('loose: %s' % p)

    hits = hits[:model['element']['maxSystems']]
    if not hits:
        return [], model['element']['fallback'], 'low', []

    if any(s.startswith('character_abilities') for s in src):
        conf = 'high'
    elif any(s.startswith('abilities_summary') for s in src):
        conf = 'medium'
    else:
        conf = 'low'
    return hits, hits[0], conf, src


# --------------------------------------------------------------------------
# 境界推导
# --------------------------------------------------------------------------
def detect_realm_base(row, model):
    realm_levels = {r['id']: r for r in model['realm']['levels']}
    for rule in model['realm']['rules']:
        m = rule['match']
        if 'default' in m:
            return realm_levels[rule['realm_id']], rule['reason']
        if 'deity_eq' in m and (row.get('deity') or '') == m['deity_eq']:
            notes = row.get('notes') or ''
            if 'notes_contains' in m and not match_any(notes, m['notes_contains']):
                continue
            return realm_levels[rule['realm_id']], rule['reason']
        if 'type_in' in m and (row.get('type') or '') in m['type_in']:
            return realm_levels[rule['realm_id']], rule['reason']
        if 'type_prefix' in m:
            t = row.get('type') or ''
            if any(t.startswith(p) for p in m['type_prefix']):
                return realm_levels[rule['realm_id']], rule['reason']
        if 'type_contains' in m:
            t = row.get('type') or ''
            if any(p in t for p in m['type_contains']):
                return realm_levels[rule['realm_id']], rule['reason']
        if 'category_in' in m and (row.get('category') or '') in m['category_in']:
            return realm_levels[rule['realm_id']], rule['reason']
    return realm_levels[1], '兜底'


def match_identity_realm(row, model):
    """FIX-2（模型 v1.1.0）：按 affiliation 中的职位线索给出候选境界规则。"""
    aff = row.get('affiliation') or ''
    for rule in model['realm'].get('identityRules', []):
        inc = rule.get('affiliation_contains', [])
        exc = rule.get('affiliation_excludes', [])
        if inc and any(x in aff for x in inc) and not any(x in aff for x in exc):
            return rule
    return None


def detect_realm(row, model):
    """基础规则 + 地位维度补正，取较高者（只升不降）。"""
    base, base_reason = detect_realm_base(row, model)
    rule = match_identity_realm(row, model)
    if rule and rule['realm_id'] > base['id']:
        lv = {r['id']: r for r in model['realm']['levels']}[rule['realm_id']]
        return lv, '身份补正（FIX-2）：%s' % rule['reason']
    return base, base_reason


# --------------------------------------------------------------------------
# 数值计算
# --------------------------------------------------------------------------
def type_bonus(row, model):
    for rule in model['statRules']['typeBonus']:
        m = rule['match']
        if 'default' in m:
            return rule
        if 'deity_eq' in m and (row.get('deity') or '') == m['deity_eq']:
            return rule
        if 'type_prefix' in m:
            t = row.get('type') or ''
            if any(t.startswith(p) for p in m['type_prefix']):
                return rule
        if 'type_contains' in m:
            t = row.get('type') or ''
            if any(p in t for p in m['type_contains']):
                return rule
    return model['statRules']['typeBonus'][-1]


def compute_stats(row, realm, systems, ability_count, model):
    sr = model['statRules']
    bias = sr['elementBias'].get(systems[0] if systems else 'none', sr['elementBias']['none'])
    tb = type_bonus(row, model)

    ab = sr['abilityBonus']
    ability_mult = 1.0 + min(ability_count * ab['perAbility'], ab['cap'])

    scb = sr['systemCountBonus']
    extra = max(0, len(systems) - 1)
    system_mult = 1.0 + min(extra * scb['perExtraSystem'], scb['cap'])

    j = sr['jitter']['range']
    seed = md5_int(row['id'])
    jitter = 1.0 + ((seed % 601) - 300) / 10000.0 * (j / 0.03)   # ±3% 确定性

    hp = round(realm['hpBase'] * bias['hp'] * tb['hp'] * ability_mult * system_mult * jitter)
    atk = round(realm['atkBase'] * bias['atk'] * tb['atk'] * ability_mult * system_mult * jitter)
    dfn = round(realm['defBase'] * bias['def'] * tb['def'] * ability_mult * system_mult * jitter)
    return hp, atk, dfn


def power_of(hp, atk, dfn, model):
    f = model['power']['formula']
    assert 'hp * 0.35' in f
    return round(hp * 0.35 + atk * 4 + dfn * 3)


def tier_of(power, model):
    for t in model['tiers']:
        hi = t['max']
        if power >= t['min'] and (hi is None or power < hi):
            return t
    return model['tiers'][-1]


# --------------------------------------------------------------------------
# 主流程
# --------------------------------------------------------------------------
def apply_override(rec, ov, model, systems_cfg):
    """人工校准覆盖：data/manual-overrides.json 中按角色 id 指定字段。"""
    if 'systems' in ov:
        rec['systems'] = [s for s in ov['systems'] if s in SIX_KEYS]
        rec['element'] = rec['systems'][0] if rec['systems'] else model['element']['fallback']
        rec['systems_label'] = [SYSTEM_CN.get(s, s) for s in rec['systems']]
        rec['element_confidence'] = 'manual'
        rec['element_source'] = ['manual-overrides.json']
    if 'element_name' in ov:
        rec['element_name'] = ov['element_name']
    if 'realm_id' in ov:
        lv = {r['id']: r for r in model['realm']['levels']}[ov['realm_id']]
        rec['realm_id'], rec['realm_key'], rec['realm_name'] = lv['id'], lv['key'], lv['name']
        rec['realm_reason'] = '人工校准'
    if 'name' in ov:
        rec['name'] = ov['name']
    for k in ('hp', 'attack', 'defense'):
        if k in ov:
            rec[k] = int(ov[k])
    rec['power'] = power_of(rec['hp'], rec['attack'], rec['defense'], model)
    tier = tier_of(rec['power'], model)
    rec['tier'], rec['tier_name'] = tier['key'], tier['name']
    rec['rarity'] = model['rarity']['map'].get(tier['key'], 'R')
    rec['overridden'] = True
    return rec


def build_records(db_path, model, systems_cfg, scope, overrides=None):
    con = sqlite3.connect('file:%s?mode=ro' % db_path.replace('\\', '/'), uri=True)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    mainline_prefixes = tuple(model['mainline']['typePrefixes'])

    rows = cur.execute(
        'SELECT id, name, type, category, deity, notes, abilities_summary, '
        'gender, species, affiliation FROM characters ORDER BY id'
    ).fetchall()

    ab_map = {}
    for r in cur.execute('SELECT character_id, ability FROM character_abilities'):
        ab_map.setdefault(r['character_id'], []).append(r['ability'] or '')

    con.close()

    out = []
    for row in rows:
        d = dict(row)
        cid = d['id']
        t = d.get('type') or ''
        is_main = any(t.startswith(p) for p in mainline_prefixes)
        if scope == 'mainline' and not is_main:
            continue

        abilities = ab_map.get(cid, [])
        systems, primary, conf, src = detect_systems(d.get('abilities_summary'), abilities, model)
        realm, realm_reason = detect_realm(d, model)
        hp, atk, dfn = compute_stats(d, realm, systems, len(abilities), model)
        power = power_of(hp, atk, dfn, model)
        tier = tier_of(power, model)

        rec = {
            'id': cid,
            'name': d.get('name'),
            'type': t,
            'category': d.get('category'),
            'mainline': is_main,
            'element': primary,
            'element_name': systems_cfg['systems'][primary]['name'] if primary in systems_cfg['systems']
                            else systems_cfg.get('neutral', {}).get('name', '无系'),
            'systems': systems,
            'systems_label': [SYSTEM_CN.get(s, s) for s in systems],
            'element_confidence': conf,
            'element_source': src[:3],
            'realm_id': realm['id'],
            'realm_key': realm['key'],
            'realm_name': realm['name'],
            'realm_reason': realm_reason,
            'hp': hp,
            'attack': atk,
            'defense': dfn,
            'power': power,
            'tier': tier['key'],
            'tier_name': tier['name'],
            'rarity': model['rarity']['map'].get(tier['key'], 'R'),
            'ability_count': len(abilities),
            'abilities': abilities,
        }
        ov = (overrides or {}).get(str(cid)) if overrides else None
        if ov:
            apply_override(rec, ov, model, systems_cfg)
        out.append(rec)
    return out


def db_fingerprint(db_path):
    st = os.stat(db_path)
    h = hashlib.sha256()
    h.update(('%d:%d' % (st.st_size, int(st.st_mtime))).encode())
    return {'size': st.st_size, 'mtime': int(st.st_mtime), 'fingerprint': h.hexdigest()[:16]}


def main():
    ap = argparse.ArgumentParser(description='六系演武 · 角色数值推导（只读数据库）')
    ap.add_argument('--db', default=DEFAULT_DB)
    ap.add_argument('--model', default=DEFAULT_MODEL)
    ap.add_argument('--systems', default=DEFAULT_SYSTEMS)
    ap.add_argument('--scope', choices=['all', 'mainline'], default='all')
    ap.add_argument('--out', default=DEFAULT_OUT)
    ap.add_argument('--overrides', default=DEFAULT_OVERRIDES, help='人工校准文件（可选）')
    args = ap.parse_args()

    model = load_json(args.model)
    systems_cfg = load_json(args.systems)

    if not os.path.exists(args.db):
        print('[错误] 数据库不存在: %s' % args.db)
        return 2

    recs = build_records(args.db, model, systems_cfg, args.scope,
                         load_json(args.overrides) if os.path.exists(args.overrides) else None)

    dist = {}
    for r in recs:
        dist[r['tier']] = dist.get(r['tier'], 0) + 1
    sys_dist = {}
    for r in recs:
        for s in r['systems']:
            sys_dist[s] = sys_dist.get(s, 0) + 1
    mainline = [r for r in recs if r['mainline']]

    payload = {
        'meta': {
            'project': 'six-system-arena',
            'generator': 'data/scripts/generate_stats.py',
            'model_version': model['version'],
            'systems_version': systems_cfg['version'],
            'scope': args.scope,
            'generated_at': time.strftime('%Y-%m-%d %H:%M:%S'),
            'source_db': args.db,
            'source_db_fingerprint': db_fingerprint(args.db),
            'total': len(recs),
            'mainline_count': len(mainline),
            'tier_distribution': dist,
            'element_distribution': sys_dist,
            'note': '本文件由脚本推导生成，不写回数据库；同输入同输出（确定性）。',
        },
        'characters': recs,
    }

    out_path = args.out
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print('范围          : %s' % args.scope)
    print('角色总数      : %d（其中主线 %d）' % (len(recs), len(mainline)))
    print('境界覆盖      : %s' % json.dumps({k: sum(1 for r in recs if r['realm_key'] == k)
                                             for k in ['qi', 'foundation', 'golden', 'nascent', 'deity', 'tribulation']},
                                            ensure_ascii=False))
    print('分档分布      : %s' % json.dumps(dist, ensure_ascii=False))
    print('六系覆盖      : %s' % json.dumps(sys_dist, ensure_ascii=False))
    print('输出          : %s' % out_path)
    print('\n主线前 8 例：')
    for r in mainline[:8]:
        print('  #%-4d %-10s %-6s %-8s hp=%-6d atk=%-5d def=%-5d power=%-6d %s %s'
              % (r['id'], r['name'], r['tier'], r['realm_name'], r['hp'], r['attack'],
                 r['defense'], r['power'], r['systems_label'], r['element_confidence']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
