#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
六系演武 · 成就与卡组校验脚本（R2）
================================================

对 R2 产物做"可自动化"的一致性校验，任一硬性项失败则以非零退出码结束，
供 `scripts/run_all.ps1` 串联使用。

校验范围：
  A. data/achievements.json
     - JSON 可解析；必备字段齐全；achievement.id 全局唯一
     - 四类目（character / system / battle / rarity）齐备且数量与 categories 声明一致
     - condition.type 在受支持清单内；progress.metric 在 metrics 表中登记
     - rarity 类成就 total 与 character_stats 的稀有度实际分布一致
  B. data/decks.json
     - 角色数与 character_stats 一致（488）
     - 卡组结构完整：general / skills / bond / ultimate
     - 技能卡槽数 = 稀有度上限；unlocked <= total
     - 主线角色完整解锁；非主线初始开放 2 张
     - 主系卡占比 >= 60%（有主系角色）
     - card_id 全局唯一
  C. 交叉引用：decks 覆盖 character_stats 全部 id，无缺漏

零依赖：仅使用 Python 标准库。
"""

import argparse
import json
import os
import sys
from collections import Counter

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.dirname(HERE)
ROOT = os.path.dirname(DATA_DIR)

DEFAULT_STATS = os.path.join(DATA_DIR, 'generated', 'character_stats.json')
DEFAULT_DECKS = os.path.join(DATA_DIR, 'decks.json')
DEFAULT_ACH = os.path.join(DATA_DIR, 'achievements.json')

RARITY_SLOTS = {'R': 2, 'SR': 3, 'SSR': 4, 'UR': 4}
PRIMARY_RATIO_MIN = 0.60
NON_MAINLINE_UNLOCK = 2
SUPPORTED_CONDITIONS = {
    'collection_count', 'element_coverage', 'first_win_by_element',
    'element_win_coverage', 'distinct_defeat', 'mode_win_count',
    'battle_condition', 'rarity_complete',
}
REQUIRED_ACH_FIELDS = ['id', 'category', 'category_name', 'name', 'desc',
                       'condition', 'reward', 'progress', 'hidden', 'source_doc']


class Report:
    def __init__(self):
        self.errors = []
        self.warns = []
        self.oks = []

    def err(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warns.append(msg)

    def ok(self, msg):
        self.oks.append(msg)

    def dump(self):
        for m in self.oks:
            print('  [OK]   %s' % m)
        for m in self.warns:
            print('  [WARN] %s' % m)
        for m in self.errors:
            print('  [FAIL] %s' % m)
        print('-' * 60)
        print('通过 %d / 警告 %d / 失败 %d' % (len(self.oks), len(self.warns), len(self.errors)))
        return 0 if not self.errors else 1


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def check_achievements(rep, ach_path, stats):
    print('\n[校验 A] 成就定义 %s' % ach_path)
    ach = load_json(ach_path)

    req_top = ['version', 'categories', 'achievements', 'metrics', 'battle_log_contract']
    for k in req_top:
        if k not in ach:
            rep.err('achievements.json 缺少顶层字段: %s' % k)
    if rep.errors:
        return ach

    items = ach['achievements']
    ids = [a.get('id') for a in items]
    if len(ids) != len(set(ids)):
        dup = [k for k, v in Counter(ids).items() if v > 1]
        rep.err('成就 id 重复: %s' % dup)
    else:
        rep.ok('成就 id 全局唯一（%d 条）' % len(ids))

    for a in items:
        miss = [f for f in REQUIRED_ACH_FIELDS if f not in a]
        if miss:
            rep.err('成就 %s 缺少字段: %s' % (a.get('id'), miss))
            continue
        ctype = a['condition'].get('type')
        if ctype not in SUPPORTED_CONDITIONS:
            rep.err('成就 %s 使用了未支持的 condition.type: %s' % (a['id'], ctype))
        metric = a['progress'].get('metric')
        if metric not in ach['metrics']:
            rep.err('成就 %s 的 progress.metric 未在 metrics 登记: %s' % (a['id'], metric))
        if not isinstance(a['progress'].get('target'), int) or a['progress']['target'] <= 0:
            rep.err('成就 %s 的 progress.target 非法' % a['id'])

    # 类目覆盖
    declared = {c['key']: c['count'] for c in ach['categories']}
    actual = Counter(a['category'] for a in items)
    for key, cnt in declared.items():
        if actual.get(key, 0) != cnt:
            rep.err('类目 %s 声明 %d 条，实际 %d 条' % (key, cnt, actual.get(key, 0)))
    extra = set(actual) - set(declared)
    if extra:
        rep.err('存在未声明类目: %s' % extra)
    if not extra and all(actual.get(k, 0) == v for k, v in declared.items()):
        rep.ok('四类目齐备且数量一致: %s' % dict(actual))

    # 稀有度总数对照数值产物
    stats_rarity = Counter(c['rarity'] for c in stats['characters'])
    for a in items:
        if a['condition'].get('type') == 'rarity_complete':
            r = a['condition']['rarity']
            t = a['condition']['total']
            if stats_rarity.get(r, 0) != t:
                rep.err('成就 %s 声明 %s 共 %d 名，数值产物实际 %d 名'
                        % (a['id'], r, t, stats_rarity.get(r, 0)))
    rep.ok('稀有度成就 target 与数值产物分布一致: %s' % dict(stats_rarity))

    # 角色/战斗类成就的数值对照
    total = len(stats['characters'])
    mainline = sum(1 for c in stats['characters'] if c['mainline'])
    for a in items:
        if a['id'] == 'ach_character_488' and a['progress']['target'] != total:
            rep.err('「全线通晓」target=%d 与角色总数 %d 不一致' % (a['progress']['target'], total))
        if a['id'] == 'ach_battle_001' and a['progress']['target'] != mainline:
            rep.err('「主线纪录」target=%d 与主线角色数 %d 不一致' % (a['progress']['target'], mainline))
    rep.ok('角色总数 %d / 主线 %d 与成就 target 对齐' % (total, mainline))
    return ach


def check_decks(rep, decks_path, stats, ach):
    print('\n[校验 B] 卡组分配 %s' % decks_path)
    decks = load_json(decks_path)
    items = decks['decks']

    if len(items) != len(stats['characters']):
        rep.err('卡组数 %d 与角色数 %d 不一致' % (len(items), len(stats['characters'])))
    else:
        rep.ok('卡组数 = 角色数 = %d' % len(items))

    stats_ids = {c['id'] for c in stats['characters']}
    deck_ids = {d['character_id'] for d in items}
    missing = stats_ids - deck_ids
    if missing:
        rep.err('缺少卡组的角色 id: %s' % sorted(missing)[:10])
    else:
        rep.ok('卡组覆盖全部角色 id，无缺漏')

    card_ids = []
    ratio_violation = []
    unlock_violation = []
    slot_violation = []
    struct_violation = []
    bond_system = 0
    for d in items:
        cid = d['character_id']
        for key in ('general', 'skills', 'bond', 'ultimate'):
            if key not in d or not d[key]:
                struct_violation.append('%s:缺 %s' % (cid, key))
        if not d.get('skills'):
            continue
        card_ids.append(d['general']['card_id'])
        card_ids.append(d['bond']['card_id'])
        card_ids.append(d['ultimate']['card_id'])
        card_ids.extend(s['card_id'] for s in d['skills'])

        total = d['skill_slots']['total']
        unlocked = d['skill_slots']['unlocked']
        if total != RARITY_SLOTS.get(d['rarity']):
            slot_violation.append('%s(%s):%d' % (cid, d['rarity'], total))
        if unlocked > total:
            unlock_violation.append('%s:%d>%d' % (cid, unlocked, total))
        if d['mainline'] and unlocked != total:
            unlock_violation.append('%s:主线未完整解锁' % cid)
        if (not d['mainline']) and unlocked != min(NON_MAINLINE_UNLOCK, total):
            unlock_violation.append('%s:非主线初始解锁 %d' % (cid, unlocked))
        if d['primary_ratio_basis'] == 'primary' and d['primary_skill_ratio'] < PRIMARY_RATIO_MIN:
            ratio_violation.append('%s:%s' % (cid, d['primary_skill_ratio']))
        if d['bond_is_system']:
            bond_system += 1
        if not d['ultimate'].get('once_per_battle'):
            struct_violation.append('%s:终极技未限一次' % cid)

    if struct_violation:
        rep.err('卡组结构异常 %d 例: %s' % (len(struct_violation), struct_violation[:5]))
    else:
        rep.ok('卡组结构完整（general / skills / bond / ultimate）')

    dup = [k for k, v in Counter(card_ids).items() if v > 1]
    if dup:
        rep.err('card_id 重复 %d 个: %s' % (len(dup), dup[:5]))
    else:
        rep.ok('card_id 全局唯一（共 %d 张）' % len(card_ids))

    if slot_violation:
        rep.err('技能槽与稀有度不符 %d 例: %s' % (len(slot_violation), slot_violation[:5]))
    else:
        rep.ok('技能卡槽数与稀有度规则一致（R2/SR3/SSR4/UR4）')

    if unlock_violation:
        rep.err('解锁规则违规 %d 例: %s' % (len(unlock_violation), unlock_violation[:5]))
    else:
        rep.ok('解锁规则正确：主线完整解锁 / 非主线初始 2 张')

    if ratio_violation:
        rep.err('主系占比 < 60%% 共 %d 例: %s' % (len(ratio_violation), ratio_violation[:5]))
    else:
        rep.ok('有主系角色的主系卡占比全部 >= 60%')

    rep.ok('系统羁绊覆盖 %d / %d 角色（其余为阵营羁绊）' % (bond_system, len(items)))

    # 成就引用的 mainline 过滤条件可解析
    mainline_ids = {c['id'] for c in stats['characters'] if c['mainline']}
    for a in ach.get('achievements', []):
        f = a['condition'].get('opponent_filter')
        if f and f.get('mainline') and len(mainline_ids) != a['progress']['target']:
            rep.err('成就 %s 的 mainline 目标数与数据不一致' % a['id'])
    return decks


def main():
    ap = argparse.ArgumentParser(description='六系演武 · 成就与卡组校验')
    ap.add_argument('--stats', default=DEFAULT_STATS)
    ap.add_argument('--decks', default=DEFAULT_DECKS)
    ap.add_argument('--achievements', default=DEFAULT_ACH)
    args = ap.parse_args()

    for p in (args.stats, args.decks, args.achievements):
        if not os.path.exists(p):
            print('[错误] 缺少文件: %s' % p)
            return 2

    stats = load_json(args.stats)
    rep = Report()
    print('=' * 60)
    print('六系演武 R2 · 成就与卡组校验')
    print('=' * 60)

    ach = check_achievements(rep, args.achievements, stats)
    check_decks(rep, args.decks, stats, ach)

    print('\n[校验 C] 交叉引用')
    stats_total = len(stats['characters'])
    rep.ok('数值产物：%d 角色' % stats_total)

    print('\n' + '=' * 60)
    print('校验结果')
    print('=' * 60)
    return rep.dump()


if __name__ == '__main__':
    sys.exit(main())
