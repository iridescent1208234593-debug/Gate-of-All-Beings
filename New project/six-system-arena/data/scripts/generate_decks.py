#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
六系演武 · 卡组分配生成脚本（R2）
================================================

读取 `data/generated/character_stats.json`（数值产物）+ `data/six-systems.json` +
`data/stat-model.json` + `docs/03-对战系统.md` 的卡组规则，为全部 488 名角色生成
可对战卡组，输出 `data/decks.json`。

卡组契约（docs/03 §4）：
  * 卡组 = 1 张主将卡 + N 张技能卡 + 1 张羁绊卡（上限 1 + 4 + 1 = 6 张）
  * 技能卡数量上限由稀有度决定：R=2 / SR=3 / SSR=4 / UR=4
  * 主线角色（mainline=true）默认完整解锁全部技能卡；非主线角色初始只开放 2 张
  * 主系卡（element == 角色主属性）在技能卡中占比 >= 60%
  * 领域终极技（终极技）独立于 6 张卡组之外，一场战斗限用一次

设计要点：
  * 确定性：同输入必然同输出；不含随机扰动。
  * 只读：仅读取项目内产物，不写任何外部仓库。
  * 零依赖：仅使用 Python 标准库。
  * 可扩展：稀有度档、技能模板、羁绊表均由 rules / bonds / skill_templates 段驱动。

输出路径默认：`data/decks.json`
"""

import argparse
import json
import os
import re
import sys
import time

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.dirname(HERE)                 # .../data
ROOT = os.path.dirname(DATA_DIR)                 # .../six-system-arena

DEFAULT_STATS = os.path.join(DATA_DIR, 'generated', 'character_stats.json')
DEFAULT_SYSTEMS = os.path.join(DATA_DIR, 'six-systems.json')
DEFAULT_MODEL = os.path.join(DATA_DIR, 'stat-model.json')
DEFAULT_OUT = os.path.join(DATA_DIR, 'decks.json')

ASSETS_IMAGES = r'E:\Projects\assets\罗小黑战记数据库\images'

SIX_KEYS = ['jin', 'mu', 'shui', 'huo', 'tu', 'kongjian']
SYSTEM_CN = {'jin': '金', 'mu': '木', 'shui': '水', 'huo': '火', 'tu': '土', 'kongjian': '空间'}

# 稀有度 → 技能卡槽上限（docs/03 §4）
RARITY_SLOTS = {'R': 2, 'SR': 3, 'SSR': 4, 'UR': 4}
NON_MAINLINE_UNLOCK = 2          # 非主线初始开放技能卡数
PRIMARY_RATIO_MIN = 0.60         # 主系卡占比下限
MAX_SKILL_SLOTS = 4              # 技能卡槽硬上限

# 技能卡姿态模板（element -> role / coeff / cost / 附加效果）
SKILL_PROFILE = {
    'jin':      {'role': '输出', 'coeff': 1.25, 'cost': 3},
    'huo':      {'role': '爆发', 'coeff': 1.30, 'cost': 4},
    'kongjian': {'role': '穿甲', 'coeff': 1.20, 'cost': 4, 'pierce': 0.20},
    'shui':     {'role': '控制', 'coeff': 1.05, 'cost': 3},
    'mu':       {'role': '恢复', 'coeff': 0.95, 'cost': 2, 'heal': 0.10},
    'tu':       {'role': '防御', 'coeff': 0.90, 'cost': 2, 'shield': 0.15},
    'none':     {'role': '通用', 'coeff': 1.00, 'cost': 2},
}

# 该系通用技（补位用）
GENERIC_SKILLS = {
    'jin':      ['御灵·金·锋锐斩', '御灵·金·锁链'],
    'mu':       ['御灵·木·缠生', '御灵·木·回春'],
    'shui':     ['御灵·水·凝冰', '御灵·水·涌流'],
    'huo':      ['御灵·火·爆燃', '御灵·火·灼烧'],
    'tu':       ['御灵·土·磐壁', '御灵·土·震地'],
    'kongjian': ['空间·瞬时转移', '空间·领域撕裂'],
    'none':     ['灵质·凝形', '灵质·冲击'],
}

# 六系羁绊（docs/03 §4）
BONDS = {
    'jin':      {'name': '御灵·金·锋锐', 'desc': '攻击 +8%', 'effect': {'attack_pct': 0.08}},
    'mu':       {'name': '御灵·木·长生', 'desc': '生命 +8%', 'effect': {'hp_pct': 0.08}},
    'shui':     {'name': '御灵·水·流转', 'desc': '防御 +8%', 'effect': {'defense_pct': 0.08}},
    'huo':      {'name': '御灵·火·炽烈', 'desc': '暴击率 +5%', 'effect': {'crit_add': 0.05}},
    'tu':       {'name': '御灵·土·磐固', 'desc': '防御 +10%', 'effect': {'defense_pct': 0.10}},
    'kongjian': {'name': '灵质·域·无垠', 'desc': '穿透 +10%', 'effect': {'pierce_add': 0.10}},
}

# 无系角色的阵营羁绊（按 category 归属，取自世界观数据库）
FACTION_BONDS = {
    '妖精':    {'name': '妖族·共守', 'desc': '生命 +6%', 'effect': {'hp_pct': 0.06}, 'faction': '妖族'},
    '人类':    {'name': '人间·同行', 'desc': '攻击 +6%', 'effect': {'attack_pct': 0.06}, 'faction': '人间'},
    '动物':    {'name': '灵兽·相伴', 'desc': '防御 +6%', 'effect': {'defense_pct': 0.06}, 'faction': '灵兽'},
    '同人角色': {'name': '异闻·拾遗', 'desc': '防御 +4%', 'effect': {'defense_pct': 0.04}, 'faction': '异闻'},
}
DEFAULT_FACTION_BOND = {'name': '众生·同归', 'desc': '生命 +4%', 'effect': {'hp_pct': 0.04}, 'faction': '众生'}

# 领域终极技（一场战斗限用一次）
ULTIMATES = {
    'jin':      {'name': '领域·金·万刃归宗', 'coeff': 2.20, 'cost': 8},
    'mu':       {'name': '领域·木·万木回春', 'coeff': 1.60, 'cost': 8, 'heal': 0.25},
    'shui':     {'name': '领域·水·寒渊封界', 'coeff': 1.90, 'cost': 8},
    'huo':      {'name': '领域·火·燎原', 'coeff': 2.40, 'cost': 9},
    'tu':       {'name': '领域·土·厚土重城', 'coeff': 1.70, 'cost': 8, 'shield': 0.30},
    'kongjian': {'name': '领域·空间·灵质外放', 'coeff': 2.30, 'cost': 8, 'pierce': 0.20},
    'none':     {'name': '领域·灵质·外放', 'coeff': 2.00, 'cost': 8},
}

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


def clean_skill_name(text):
    """把能力原文压缩成可读的卡名。"""
    t = re.sub(r'[（(][^（()）]*[)）]', '', text or '').strip()
    t = re.split(r'[：:；;，,、→]', t)[0].strip()
    t = t.strip(' -·•*')
    if not t:
        t = (text or '').strip()
    return t[:16] if t else '未命名技能'


def detect_ability_system(text, fallback):
    for key, pats in ABILITY_HINTS:
        if any(p in (text or '') for p in pats):
            return key
    return fallback


def build_skill_card(cid, slot, name, element, source, generic):
    prof = SKILL_PROFILE.get(element, SKILL_PROFILE['none'])
    return {
        'slot': slot,
        'card_id': 'S%04d-%d' % (cid, slot),
        'type': 'skill',
        'name': name,
        'element': element,
        'element_name': SYSTEM_CN.get(element, '无系'),
        'is_primary': False,          # 由主流程回填
        'role': prof['role'],
        'cost': prof['cost'],
        'coeff': prof['coeff'],
        'pierce': prof.get('pierce', 0.0),
        'heal': prof.get('heal', 0.0),
        'shield': prof.get('shield', 0.0),
        'generic': generic,
        'source_ability': source or '',
        'desc': '%s · 系数 %.2f / 耗能 %d' % (prof['role'], prof['coeff'], prof['cost']),
    }


def build_skill_list(cid, char):
    """按 docs/03 §4 生成技能卡列表（含主系占比保障）。"""
    primary = char['element']
    rarity = char['rarity']
    total = min(RARITY_SLOTS.get(rarity, 2), MAX_SKILL_SLOTS)
    abilities = [a for a in (char.get('abilities') or []) if a and a.strip()]

    skills = []
    for i, ab in enumerate(abilities[:total], start=1):
        el = detect_ability_system(ab, primary if primary in SIX_KEYS else 'none')
        skills.append(build_skill_card(cid, i, clean_skill_name(ab), el, ab, False))

    # 保障主系占比：不足时用该系通用技替换末尾的非主系卡
    if primary in SIX_KEYS:
        need = min(total, max(1, int(total * PRIMARY_RATIO_MIN + 0.999999)))  # ceil(total*0.6)
        primary_count = sum(1 for s in skills if s['element'] == primary)
        # 先补齐数量
        while len(skills) < total:
            skills.append(None)
        idx = total - 1
        while primary_count < need and idx >= 0:
            if skills[idx] is None or skills[idx]['element'] != primary:
                skills[idx] = None
                primary_count += 1
            idx -= 1
        # 再填充空位（非主系空位优先用主系通用技，保证占比只增不减）
        pool = GENERIC_SKILLS.get(primary, GENERIC_SKILLS['none'])
        gi = 0
        for i in range(total):
            if skills[i] is None:
                name = pool[gi % len(pool)]
                gi += 1
                skills[i] = build_skill_card(cid, i + 1, name, primary, None, True)
    else:
        pool = GENERIC_SKILLS['none']
        while len(skills) < total:
            skills.append(None)
        gi = 0
        for i in range(total):
            if skills[i] is None:
                skills[i] = build_skill_card(cid, i + 1, pool[gi % len(pool)], 'none', None, True)
                gi += 1

    # 编号与主系标记
    for i, s in enumerate(skills, start=1):
        s['slot'] = i
        s['card_id'] = 'S%04d-%d' % (cid, i)
        s['is_primary'] = (primary in SIX_KEYS and s['element'] == primary)

    return skills, total


def build_bond(cid, char):
    primary = char['element']
    if primary in BONDS:
        b = BONDS[primary]
        el = primary
    else:
        b = FACTION_BONDS.get(char.get('category') or '', DEFAULT_FACTION_BOND)
        el = 'none'
    return {
        'slot': 'bond',
        'card_id': 'B%04d' % cid,
        'type': 'bond',
        'name': b['name'],
        'element': el,
        'element_name': SYSTEM_CN.get(el, '无系'),
        'faction': b.get('faction'),
        'effect': b['effect'],
        'desc': b['desc'],
    }, (primary in BONDS)


def build_ultimate(cid, char):
    primary = char['element']
    el = primary if primary in SIX_KEYS else 'none'
    u = ULTIMATES.get(el, ULTIMATES['none'])
    return {
        'card_id': 'U%04d' % cid,
        'type': 'ultimate',
        'name': u['name'],
        'element': el,
        'element_name': SYSTEM_CN.get(el, '无系'),
        'cost': u['cost'],
        'coeff': u['coeff'],
        'pierce': u.get('pierce', 0.0),
        'heal': u.get('heal', 0.0),
        'shield': u.get('shield', 0.0),
        'once_per_battle': True,
        'desc': '领域终极技 · 系数 %.2f / 耗能 %d / 每场限一次' % (u['coeff'], u['cost']),
    }


def build_image_index(images_root):
    idx = {}
    if not os.path.isdir(images_root):
        return idx
    for name in os.listdir(images_root):
        p = os.path.join(images_root, name)
        if not os.path.isdir(p):
            continue
        try:
            files = [f for f in os.listdir(p)
                     if os.path.isfile(os.path.join(p, f))
                     and f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
        except OSError:
            continue
        if files:
            files.sort()
            idx[name] = os.path.join(p, files[0])
    return idx


def lookup_portrait(idx, name):
    if not name:
        return None
    if name in idx:
        return idx[name]
    base = re.sub(r'[（(].*?[)）]', '', name).strip()
    if base in idx:
        return idx[base]
    for k, v in idx.items():
        if base and (k.startswith(base) or base.startswith(k)):
            return v
    return None


# --------------------------------------------------------------------------
# 主流程
# --------------------------------------------------------------------------
def build_decks(stats_path, systems_cfg, model):
    payload = load_json(stats_path)
    chars = payload['characters']
    idx = build_image_index(ASSETS_IMAGES)

    decks = []
    for c in chars:
        cid = c['id']
        skills, total = build_skill_list(cid, c)
        bond, bond_is_system = build_bond(cid, c)
        ultimate = build_ultimate(cid, c)

        unlocked = total if c['mainline'] else min(NON_MAINLINE_UNLOCK, total)
        for i, s in enumerate(skills, start=1):
            s['unlocked'] = (i <= unlocked)

        primary_skills = sum(1 for s in skills if s['is_primary'])
        basis = 'primary' if c['element'] in SIX_KEYS else 'neutral'
        ratio = round(primary_skills / total, 4) if total else 1.0
        if basis == 'neutral':
            ratio = 1.0   # 无系角色全卡中性，按约定记为 100%

        general = {
            'slot': 'general',
            'card_id': 'G%04d' % cid,
            'type': 'general',
            'name': c['name'],
            'element': c['element'],
            'element_name': c['element_name'],
            'systems': list(c['systems']),
            'systems_label': list(c['systems_label']),
            'stats': {'hp': c['hp'], 'attack': c['attack'], 'defense': c['defense']},
            'power': c['power'],
            'tier': c['tier'],
            'tier_name': c['tier_name'],
            'realm_name': c['realm_name'],
            'desc': '主将卡 · %s / %s' % (c['element_name'], c['realm_name']),
        }

        decks.append({
            'character_id': cid,
            'name': c['name'],
            'mainline': c['mainline'],
            'element': c['element'],
            'element_name': c['element_name'],
            'systems': list(c['systems']),
            'rarity': c['rarity'],
            'tier': c['tier'],
            'power': c['power'],
            'portrait': lookup_portrait(idx, c['name']),
            'deck_size': 1 + total + 1 + 1,
            'unlocked_deck_size': 1 + unlocked + 1 + 1,
            'skill_slots': {
                'total': total,
                'unlocked': unlocked,
                'rule': 'mainline_full' if c['mainline'] else 'non_mainline_initial_%d' % NON_MAINLINE_UNLOCK,
            },
            'primary_skill_ratio': ratio,
            'primary_ratio_basis': basis,
            'bond_is_system': bond_is_system,
            'general': general,
            'skills': skills,
            'bond': bond,
            'ultimate': ultimate,
        })
    return payload['meta'], decks


def main():
    global ASSETS_IMAGES
    ap = argparse.ArgumentParser(description='六系演武 · 卡组分配生成（读取数值产物）')
    ap.add_argument('--stats', default=DEFAULT_STATS)
    ap.add_argument('--systems', default=DEFAULT_SYSTEMS)
    ap.add_argument('--model', default=DEFAULT_MODEL)
    ap.add_argument('--out', default=DEFAULT_OUT)
    ap.add_argument('--assets', default=ASSETS_IMAGES, help='官方图片素材根目录（只读）')
    args = ap.parse_args()

    ASSETS_IMAGES = args.assets

    if not os.path.exists(args.stats):
        print('[错误] 数值产物不存在，请先运行 generate_stats.py: %s' % args.stats)
        return 2

    systems_cfg = load_json(args.systems)
    model = load_json(args.model)
    stats_meta, decks = build_decks(args.stats, systems_cfg, model)

    # 统计
    by_rarity = {}
    ratio_violation = []
    unlocked_hist = {}
    for d in decks:
        by_rarity[d['rarity']] = by_rarity.get(d['rarity'], 0) + 1
        if d['primary_ratio_basis'] == 'primary' and d['primary_skill_ratio'] < PRIMARY_RATIO_MIN:
            ratio_violation.append(d['character_id'])
        k = '%d/%d' % (d['skill_slots']['unlocked'], d['skill_slots']['total'])
        unlocked_hist[k] = unlocked_hist.get(k, 0) + 1

    payload = {
        'meta': {
            'project': 'six-system-arena',
            'generator': 'data/scripts/generate_decks.py',
            'version': '1.0.0',
            'generated_at': time.strftime('%Y-%m-%d %H:%M:%S'),
            'source_stats': args.stats,
            'source_stats_generated_at': stats_meta.get('generated_at'),
            'source_stats_fingerprint': stats_meta.get('source_db_fingerprint'),
            'systems_version': systems_cfg['version'],
            'model_version': model['version'],
            'total': len(decks),
            'mainline_count': sum(1 for d in decks if d['mainline']),
            'rarity_distribution': by_rarity,
            'skill_unlock_distribution': unlocked_hist,
            'primary_ratio_min': PRIMARY_RATIO_MIN,
            'primary_ratio_violations': ratio_violation,
            'note': '本文件由脚本确定性生成；卡组规则见 docs/03-对战系统.md §4。',
        },
        'rules': {
            'deck_core': '1 主将 + N 技能 + 1 羁绊（上限 6 张，终极技独立不占卡位）',
            'rarity_skill_slots': RARITY_SLOTS,
            'mainline_full_unlock': True,
            'non_mainline_initial_unlock': NON_MAINLINE_UNLOCK,
            'primary_ratio_min': PRIMARY_RATIO_MIN,
            'ultimate': '领域终极技，场地独立卡，一场战斗限用一次（docs/03 §8 待确认项 1 采纳）',
        },
        'skill_profiles': SKILL_PROFILE,
        'generic_skills': GENERIC_SKILLS,
        'bonds': BONDS,
        'faction_bonds': FACTION_BONDS,
        'ultimates': ULTIMATES,
        'decks': decks,
    }

    out_path = args.out
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print('角色总数      : %d（主线 %d）' % (len(decks), payload['meta']['mainline_count']))
    print('稀有度分布    : %s' % json.dumps(by_rarity, ensure_ascii=False))
    print('技能解锁分布  : %s' % json.dumps(unlocked_hist, ensure_ascii=False))
    print('主系占比违规  : %d 例' % len(ratio_violation))
    print('输出          : %s' % out_path)
    print('\n主线样例：')
    for d in decks:
        if not d['mainline']:
            continue
        print('  #%-4d %-10s %-4s %-10s 技能 %d/%d 主系占比 %.0f%%  %s'
              % (d['character_id'], d['name'], d['rarity'], d['bond']['name'],
                 d['skill_slots']['unlocked'], d['skill_slots']['total'],
                 d['primary_skill_ratio'] * 100, ' / '.join(s['name'] for s in d['skills'])))
        if d['character_id'] > 20:
            break
    return 0


if __name__ == '__main__':
    sys.exit(main())
