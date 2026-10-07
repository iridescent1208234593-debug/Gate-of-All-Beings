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
  B2. 卡组获得节奏分层与稀有度分布校准（R5 · 非数值手段）
     - meta.non_numeric_rarity_calibration 已 applied / method=acquisition_pacing
     - 数值框架零漂移：卡组 hp/attack/defense/power/tier/rarity 与数值产物逐条一致
     - 稀有度 × 投放节奏映射合法（R∈P1–P2 / SR∈P2–P4 / SSR·UR∈P4）且节奏单调
     - 技能卡完善项自洽（同名去重 / tags / source_kind / 构成统计）
     - meta.pacing_distribution 与卡组实际分层一致
  C. 交叉引用：decks 覆盖 character_stats 全部 id，无缺漏
  D. data/emoticons.json 表情包台账（来源 / 红线 / 池内素材 / 审查留痕）

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

# --- R5 · 稀有度分布校准（非数值手段 · 获得节奏分层）校验参数 ---
PACE_ORDER = ('P4', 'P3', 'P2', 'P1')          # 由晚到早（P4 最稀缺）
PACE_STRICTNESS = {'P1': 0, 'P2': 1, 'P3': 2, 'P4': 3}
RARITY_PACE_ALLOWED = {                        # 稀有度 -> 允许的投放节奏档
    'R': {'P1', 'P2'},
    'SR': {'P2', 'P3', 'P4'},
    'SSR': {'P4'},
    'UR': {'P4'},
}
RARITY_LADDER = ('R', 'SR', 'SSR', 'UR')
NUMERIC_FIELDS_UNTOUCHED = ('hp', 'attack', 'defense', 'power', 'tier', 'rarity')
SKILL_SOURCE_KINDS = ('character_ability', 'primary_fallback', 'generic_fallback')
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


def check_deck_pacing(rep, decks, stats):
    """校验 B2：卡组获得节奏分层与稀有度分布校准（R5 · 非数值手段）。

    校准红线：只调节「获得节奏 / 玩家侧投放与感知」，**不得改动数值框架**。
    因此本段逐条比对卡组的 hp / attack / defense / power / tier / rarity 与数值产物是否一致，
    并校验稀有度 × 节奏映射合法性、节奏单调性与技能卡完善项自洽。
    """
    print('\n[校验 B2] 获得节奏分层与稀有度校准（非数值手段）')
    items = decks['decks']
    meta = decks.get('meta', {})
    calib = meta.get('non_numeric_rarity_calibration')
    if not calib:
        rep.err('decks.json meta 缺少 non_numeric_rarity_calibration（稀有度校准未落地）')
        return

    if calib.get('status') == 'applied' and calib.get('method') == 'acquisition_pacing':
        rep.ok('稀有度校准已落地：status=applied / method=acquisition_pacing')
    else:
        rep.err('稀有度校准状态异常：status=%s / method=%s'
                % (calib.get('status'), calib.get('method')))

    touched = set(calib.get('numeric_fields_untouched') or [])
    lack = [f for f in NUMERIC_FIELDS_UNTOUCHED if f not in touched]
    if lack:
        rep.err('校准声明未覆盖数值字段：%s' % lack)
    else:
        rep.ok('校准声明未触碰数值字段：%s' % ' / '.join(NUMERIC_FIELDS_UNTOUCHED))

    stats_map = {c['id']: c for c in stats['characters']}
    drift, bad_pace, skill_bad, unknown = [], [], [], []
    pace_cnt = Counter()
    pace_by_rarity = {}
    for d in items:
        cid = d['character_id']
        s = stats_map.get(cid)
        if s is None:
            unknown.append(cid)
            continue
        # 数值框架零漂移（校准不得改数值）
        if (d['power'] != s['power'] or d['tier'] != s['tier'] or d['rarity'] != s['rarity']
                or d['general']['stats'] != {'hp': s['hp'], 'attack': s['attack'],
                                             'defense': s['defense']}):
            drift.append(cid)
        pc = d.get('pacing') or {}
        pace = pc.get('pace')
        pace_cnt[pace] += 1
        pace_by_rarity.setdefault(d['rarity'], Counter())[pace] += 1
        if pace not in PACE_ORDER or pace not in RARITY_PACE_ALLOWED.get(d['rarity'], set()):
            bad_pace.append('%s(%s→%s)' % (cid, d['rarity'], pace))
        # 技能卡完善项自洽
        names = [sk['name'] for sk in d['skills']]
        if len(names) != len(set(names)):
            skill_bad.append('%s:同名技能未去重' % cid)
        for sk in d['skills']:
            kind = sk.get('source_kind')
            if kind not in SKILL_SOURCE_KINDS:
                skill_bad.append('%s:source_kind 非法(%s)' % (cid, kind))
            elif sk.get('generic') != (kind != 'character_ability'):
                skill_bad.append('%s:generic 与 source_kind 不一致' % cid)
            if not sk.get('tags'):
                skill_bad.append('%s:技能卡缺 tags' % cid)
        mix = {k: v for k, v in (d.get('skill_element_mix') or {}).items() if v}
        if mix != dict(Counter(sk['element'] for sk in d['skills'])):
            skill_bad.append('%s:skill_element_mix 与技能卡不一致' % cid)
        split = {k: v for k, v in (d.get('skill_source_split') or {}).items() if v}
        if split != dict(Counter(sk.get('source_kind') for sk in d['skills'])):
            skill_bad.append('%s:skill_source_split 与技能卡不一致' % cid)

    if unknown:
        rep.err('卡组引用数值产物中不存在的角色 id：%s' % unknown[:5])
    if drift:
        rep.err('数值漂移 %d 例（校准不得改数值）：%s' % (len(drift), drift[:5]))
    if not drift and not unknown:
        rep.ok('数值框架零漂移：%d 套卡组的 hp/attack/defense/power/tier/rarity 与数值产物逐条一致'
               % len(items))

    if bad_pace:
        rep.err('稀有度 × 投放节奏映射违规 %d 例：%s' % (len(bad_pace), bad_pace[:5]))
    else:
        rep.ok('稀有度 × 投放节奏映射合法（R∈P1–P2 / SR∈P2–P4 / SSR·UR∈P4）')

    if skill_bad:
        rep.err('技能卡完善项异常 %d 例：%s' % (len(skill_bad), skill_bad[:5]))
    else:
        rep.ok('技能卡：同名去重 / tags 齐全 / source_kind 合法 / 构成统计自洽')

    # 节奏单调性：低稀有度的投放窗口不得晚于高稀有度
    ladder_ok = True
    for lo, hi in zip(RARITY_LADDER, RARITY_LADDER[1:]):
        a, b = pace_by_rarity.get(lo), pace_by_rarity.get(hi)
        if not a or not b:
            continue
        if max(PACE_STRICTNESS.get(p, -1) for p in a) > min(PACE_STRICTNESS.get(p, -1) for p in b):
            ladder_ok = False
            rep.err('投放节奏倒挂：%s 最晚档晚于 %s 最早档' % (lo, hi))
    if ladder_ok:
        rep.ok('投放节奏单调：稀有度越高投放越晚（R ≤ SR ≤ SSR ≤ UR）')

    # meta 声明的分层统计须与卡组实际一致
    rec = calib.get('pacing_distribution') or {}
    actual = {k: pace_cnt.get(k, 0) for k in PACE_ORDER}
    if rec and {k: rec.get(k, 0) for k in PACE_ORDER} != actual:
        rep.err('meta.pacing_distribution 与卡组实际分层不一致：%s vs %s' % (rec, actual))
    else:
        rep.ok('meta.pacing_distribution 与卡组实际分层一致')


EMOTICONS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'emoticons.json')


def check_emoticons(rep, path):
    """校验 D：表情包台账（R5）。只读校验，不改数据。"""
    print('\n[校验 D] 表情包台账 %s' % path)
    if not os.path.exists(path):
        rep.err('缺少表情包台账: %s' % path)
        return None
    doc = load_json(path)

    for k in ('version', 'round', 'redline', 'channels', 'pool', 'review_log'):
        if k not in doc:
            rep.err('emoticons.json 缺少顶层字段: %s' % k)
    if rep.errors:
        return doc

    gate = doc['redline']
    if gate.get('official_only') is True and gate.get('block_character_redraw') is True:
        rep.ok('红线：仅官方图 + 禁止角色改画')
    else:
        rep.err('红线段未开启 official_only / block_character_redraw')

    channels = doc['channels']
    if len(channels) >= 3:
        rep.ok('官方发行渠道登记 %d 条' % len(channels))
    else:
        rep.warn('官方发行渠道登记偏少（%d 条）' % len(channels))

    root = doc.get('asset_root', '')
    pool = doc['pool']
    comfort = pool.get('comfort', [])
    entrance = pool.get('entrance', [])
    bad = 0
    for it in comfort + entrance:
        p = it.get('path', '')
        if not root or not p.startswith(root):
            rep.err('素材越界（不在官方素材库根下）: %s' % p)
            bad += 1
        elif '罗小黑战记数据库' not in p:
            rep.err('素材来源非官方素材库: %s' % p)
            bad += 1
        elif not os.path.isfile(p):
            rep.err('素材不存在: %s' % p)
            bad += 1
    if bad == 0:
        rep.ok('池内素材 %d 张全部在位且在官方素材库内' % (len(comfort) + len(entrance)))

    if len(comfort) >= 2:
        rep.ok('comfort 池 %d 张（失败 / 平局安慰可用）' % len(comfort))
    else:
        rep.err('comfort 池不足 2 张，无法支撑随机安慰')

    for row in doc['review_log']:
        if not row.get('verdict') or not row.get('basis'):
            rep.err('审查记录缺 verdict / basis: %s' % row.get('item'))

    pending = doc.get('pending', [])
    rep.ok('未决挂账 %d 项（显式登记，不静默缺失）' % len(pending))

    print('  渠道 %d / comfort %d / entrance %d / celebration %d / 审查记录 %d' % (
        len(channels), len(comfort), len(entrance),
        len(pool.get('celebration', [])), len(doc['review_log'])))
    return doc


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
    print('六系演武 R2/R5 · 成就、卡组与表情包台账校验')
    print('=' * 60)

    ach = check_achievements(rep, args.achievements, stats)
    decks = check_decks(rep, args.decks, stats, ach)
    check_deck_pacing(rep, decks, stats)
    check_emoticons(rep, EMOTICONS_PATH)

    print('\n[校验 C] 交叉引用')
    stats_total = len(stats['characters'])
    rep.ok('数值产物：%d 角色' % stats_total)

    print('\n' + '=' * 60)
    print('校验结果')
    print('=' * 60)
    return rep.dump()


if __name__ == '__main__':
    sys.exit(main())
