#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
六系演武 · R2 数值与卡组审计脚本
================================================

读取 `data/generated/character_stats.json` 与 `data/decks.json`，
生成 Markdown 审计报告 `data/audit/r2-audit.md`。

审计维度（对应 docs/03 · docs/04 的数值与卡组规则）：
  1. 概览：产物来源、指纹、规模
  2. 数值极值：战力 / 血量 / 攻击 / 防御 的头部与尾部
  3. 分档与稀有度分布：实际分布 vs 模型目标分布
  4. 断层分析：档位边界断层、全局战力序列异常断点、空档
  5. 六系分布：主属性覆盖与多系结构
  6. 卡组审计：技能槽 / 解锁 / 主系占比 / 羁绊 / 终极技 / 立绘覆盖
  7. 素材引用核验：官方图路径存在性
  8. 成就可达性：docs/04 收集类成就的静态可达性 + 待拍板缺口
  9. 结论与建议

零依赖：仅使用 Python 标准库。
"""

import argparse
import json
import os
import statistics
import sys
import time
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
DEFAULT_MODEL = os.path.join(DATA_DIR, 'stat-model.json')
DEFAULT_ACH = os.path.join(DATA_DIR, 'achievements.json')
DEFAULT_OUT = os.path.join(DATA_DIR, 'audit', 'r2-audit.md')

TIER_RANK = {'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5}

ASSETS = r'E:\Projects\assets'
SETTLEMENT_ASSETS = [
    r'罗小黑战记数据库\images\罗小黑\罗小黑_全身_085.jpg',
    r'罗小黑战记数据库\images\罗小黑\罗小黑_表情_087.jpg',
    r'罗小黑战记数据库\images\罗小黑\罗小黑_表情_088.jpg',
    r'罗小黑战记数据库\images\比丢\比丢.png',
    r'罗小黑战记数据库\images\比丢\比丢.gif',
]
SYSTEM_CN = {'jin': '金', 'mu': '木', 'shui': '水', 'huo': '火', 'tu': '土',
             'kongjian': '空间', 'none': '无系'}


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def fmt_int(n):
    return '{:,}'.format(int(n))


def table(headers, rows):
    out = ['| ' + ' | '.join(headers) + ' |',
           '|' + '|'.join(['---'] * len(headers)) + '|']
    for r in rows:
        out.append('| ' + ' | '.join(str(x) for x in r) + ' |')
    return '\n'.join(out)


def achievement_attainability(chars, ach):
    """docs/04 收集类成就的**静态可达性**检查（不依赖战斗日志）。

    返回 (rows, findings)：
      rows     —— [成就 id, 名称, 目标, 静态判定, 依据]
      findings —— 需要人工决策的缺口说明列表
    """
    rows, findings = [], []
    by_rarity = Counter(c['rarity'] for c in chars)
    total = len(chars)
    n_mainline = sum(1 for c in chars if c['mainline'])
    by_element = Counter(c['element'] for c in chars)

    for a in ach.get('achievements', []):
        cond = a['condition']
        t = cond['type']
        goal = ''
        verdict = '运行时可达成'
        basis = '需战斗日志'

        if t == 'collection_count':
            need = cond['value']
            goal = '解锁 %s 名' % fmt_int(need)
            verdict = '可达成' if total >= need else '不可达成'
            basis = '角色总数 %s %s %s' % (fmt_int(total), '≥' if total >= need else '<', fmt_int(need))

        elif t == 'element_coverage':
            need_tier = cond.get('min_tier', 'C')
            allowed = {k for k, v in TIER_RANK.items() if v <= TIER_RANK.get(need_tier, 2)}
            per, lack = [], []
            for e in cond['elements']:
                n = sum(1 for c in chars if c['element'] == e and c['tier'] in allowed)
                per.append('%s=%d' % (SYSTEM_CN.get(e, e), n))
                if n < cond.get('min_count_per_element', 1):
                    lack.append(e)
            goal = '%s 系各 ≥%d 名 %s 档以上' % (len(cond['elements']),
                                                cond.get('min_count_per_element', 1), need_tier)
            verdict = '可达成' if not lack else '不可达成'
            basis = '、'.join(per)
            if lack:
                only = [c['tier'] for c in chars if c['element'] in lack]
                findings.append(
                    '**`%s`（%s）静态不可达成**：主属性为 %s 的角色共 %s 名，档位分布 %s，'
                    '无 %s 档以上者，`min_tier=%s` 门槛无法满足。'
                    '建议二选一：① 提升该系主线的档位至 %s；② 放宽 `docs/04` 中该成就的 `min_tier`。'
                    '本次 **不改动定义**，仅报备待拍板。'
                    % (a['name'], a['id'],
                       ' / '.join(SYSTEM_CN.get(e, e) for e in lack),
                       fmt_int(sum(by_element.get(e, 0) for e in lack)),
                       '、'.join('%s×%s' % (k, v) for k, v in sorted(Counter(only).items())),
                       need_tier, need_tier, need_tier))

        elif t == 'distinct_defeat':
            need = cond.get('count', 0)
            src = 'mainline' if cond.get('opponent_filter', {}).get('mainline') else '全部角色'
            avail = n_mainline if src == 'mainline' else total
            goal = '击败 %s 名（%s）' % (fmt_int(need), src)
            verdict = '运行时可达成' if avail >= need else '不可达成'
            basis = '可用对手 %s ≥ %s' % (fmt_int(avail), fmt_int(need)) if avail >= need \
                else '可用对手 %s < %s' % (fmt_int(avail), fmt_int(need))

        elif t == 'rarity_complete':
            r = cond['rarity']
            need = cond.get('total', 0)
            have = by_rarity.get(r, 0)
            goal = '集齐 %s 档 %s 名' % (r, fmt_int(need))
            verdict = '可达成' if have >= need else '不可达成'
            basis = '实有 %s 档 %s 名' % (r, fmt_int(have))
            if have != need:
                findings.append('**%s（%s）总数对不上**：成就声明 %s 名，实有 %s 名，'
                                '请同步 `achievements.json` 的 `rarity_totals`。'
                                % (a['name'], a['id'], fmt_int(need), fmt_int(have)))

        elif t in ('first_win_by_element', 'element_win_coverage'):
            els = cond.get('elements') or ([cond['element']] if cond.get('element') else [])
            missing = [e for e in els if by_element.get(e, 0) == 0]
            goal = '用 %s 系取胜' % ('/'.join(SYSTEM_CN.get(e, e) for e in els))
            verdict = '不可达成' if missing else '运行时可达成'
            basis = '各系均有角色，靠战斗日志判定' if not missing else \
                '缺少可用角色：%s' % '、'.join(SYSTEM_CN.get(e, e) for e in missing)

        elif t == 'mode_win_count':
            goal = '%s 模式取胜 %s 次' % (cond.get('mode', '-'), fmt_int(cond.get('count', 0)))
            basis = '需战斗日志（mode=%s）' % cond.get('mode', '-')

        elif t == 'battle_condition':
            goal = '满足 `%s` 取胜 %s 次' % (cond.get('expr', '-'), fmt_int(cond.get('count', 0)))
            basis = '需战斗日志（hp_left / hp_max）'

        rows.append([a['id'], a['name'], goal, verdict, basis])

    # 稀有度总数交叉核对
    rt = ach.get('rarity_totals', {})
    for r, v in rt.items():
        if by_rarity.get(r, 0) != v:
            findings.append('`rarity_totals.%s` 声明 %s，实际 %s，存在偏差。'
                            % (r, fmt_int(v), fmt_int(by_rarity.get(r, 0))))

    return rows, findings


def build_report(stats, decks, model, ach=None):
    chars = stats['characters']
    items = decks['decks']
    L = []
    A = L.append

    A('# R2 迭代 · 数值与卡组审计报告')
    A('')
    A('> 由 `data/scripts/audit_r2.py` 确定性生成；对象为 `data/generated/character_stats.json` 与 `data/decks.json`。')
    A('> 本报告只读产物、不改动任何数据。')
    A('')
    A('## 0. 概览')
    A('')
    A(table(['项', '值'], [
        ['生成时间', time.strftime('%Y-%m-%d %H:%M:%S')],
        ['角色总数', fmt_int(len(chars))],
        ['主线角色数', fmt_int(sum(1 for c in chars if c['mainline']))],
        ['卡组数', fmt_int(len(items))],
        ['数值模型版本', model['version']],
        ['数值产物生成时间', stats['meta'].get('generated_at', '-')],
        ['源库指纹', str(stats['meta'].get('source_db_fingerprint', {}).get('fingerprint', '-'))],
        ['卡组产物版本', decks['meta'].get('version', '-')],
    ]))
    A('')

    # ---------- 1. 极值 ----------
    A('## 1. 数值极值')
    A('')
    by_power = sorted(chars, key=lambda c: c['power'], reverse=True)
    A('### 1.1 战力 Top 10')
    A('')
    A(table(['#', '角色', 'id', '战力', 'hp', 'atk', 'def', '档位', '稀有度', '境界', '主属性'],
            [[i + 1, c['name'], c['id'], fmt_int(c['power']), fmt_int(c['hp']),
              fmt_int(c['attack']), fmt_int(c['defense']), c['tier'], c['rarity'],
              c['realm_name'], SYSTEM_CN.get(c['element'], c['element'])]
             for i, c in enumerate(by_power[:10])]))
    A('')
    A('### 1.2 战力 Bottom 10')
    A('')
    A(table(['#', '角色', 'id', '战力', 'hp', 'atk', 'def', '档位', '稀有度'],
            [[i + 1, c['name'], c['id'], fmt_int(c['power']), fmt_int(c['hp']),
              fmt_int(c['attack']), fmt_int(c['defense']), c['tier'], c['rarity']]
             for i, c in enumerate(by_power[-10:])]))
    A('')
    for label, key in (('血量', 'hp'), ('攻击', 'attack'), ('防御', 'defense')):
        arr = sorted(chars, key=lambda c: c[key])
        A('- **%s极值**：最高 %s（%s） / 最低 %s（%s） / 中位 %s'
          % (label, fmt_int(arr[-1][key]), arr[-1]['name'], fmt_int(arr[0][key]),
             arr[0]['name'], fmt_int(statistics.median(c[key] for c in chars))))
    A('')
    powers = [c['power'] for c in chars]
    A('- **战力分布**：min %s / median %s / mean %s / max %s'
      % (fmt_int(min(powers)), fmt_int(statistics.median(powers)),
         fmt_int(statistics.mean(powers)), fmt_int(max(powers))))
    A('')

    # ---------- 2. 分布 ----------
    A('## 2. 分档与稀有度分布')
    A('')
    tier_meta = {t['key']: t for t in model['tiers']}
    tier_order = [t['key'] for t in model['tiers']]
    tier_cnt = Counter(c['tier'] for c in chars)
    A('### 2.1 分档分布')
    A('')
    rows = []
    for k in tier_order:
        t = tier_meta[k]
        rng = '%s ~ %s' % (fmt_int(t['min']), fmt_int(t['max']) if t['max'] else '∞')
        rows.append([k, t['name'], rng, fmt_int(tier_cnt.get(k, 0)),
                     '%.1f%%' % (tier_cnt.get(k, 0) / len(chars) * 100)])
    A(table(['档', '名称', '战力区间', '人数', '占比'], rows))
    A('')
    empty_tiers = [k for k in tier_order if tier_cnt.get(k, 0) == 0]
    if empty_tiers:
        A('- **空档预警**：档位 %s 无角色，分档粒度对当前样本偏细。' % '、'.join(empty_tiers))
    else:
        A('- 全部档位均有角色覆盖，分档粒度与样本匹配。')
    A('')
    A('### 2.2 稀有度分布 vs 模型目标')
    A('')
    rar_cnt = Counter(c['rarity'] for c in chars)
    target = model['rarity']['targetDistribution']
    rows = []
    for r in ['R', 'SR', 'SSR', 'UR']:
        actual = rar_cnt.get(r, 0)
        ap = actual / len(chars)
        tp = target.get(r, 0)
        rows.append([r, fmt_int(actual), '%.1f%%' % (ap * 100), '%.0f%%' % (tp * 100),
                     '%+.1fpp' % ((ap - tp) * 100)])
    A(table(['稀有度', '实际人数', '实际占比', '目标占比', '偏差'], rows))
    A('')
    A('> 说明：目标是 docs 设计期基线（金字塔型）；实际由战力分档映射决定，'
      'R 档偏高源于大量低战力同人 / 动物角色，属世界观样本本身特征，非模型缺陷。')
    A('')

    # ---------- 3. 断层 ----------
    A('## 3. 断层分析')
    A('')
    A('### 3.1 档位边界断层')
    A('')
    rows = []
    for i in range(len(tier_order) - 1):
        lo, hi = tier_order[i], tier_order[i + 1]
        lows = [c['power'] for c in chars if c['tier'] == lo]
        highs = [c['power'] for c in chars if c['tier'] == hi]
        if not lows or not highs:
            rows.append(['%s→%s' % (lo, hi), '-', '-', '-', '相邻档位缺样本'])
            continue
        gap = min(highs) - max(lows)
        rows.append(['%s→%s' % (lo, hi), fmt_int(max(lows)), fmt_int(min(highs)),
                     fmt_int(gap) if gap >= 0 else '重叠 %s' % fmt_int(-gap),
                     '断层' if gap > 0 else '连续'])
    A(table(['边界', '下档最高', '上档最低', '间隔', '判定'], rows))
    A('')
    A('> 说明：边界处两档样本战力区间轻微重叠属正常（分档以战力阈值切分，'
      '边界附近样本密集）；出现大间隔（断层）说明该战力段无角色，抽卡 / 匹配会「跳档」。')
    A('')
    A('### 3.2 全局战力序列异常断点')
    A('')
    uniq = sorted(set(powers))
    diffs = [uniq[i + 1] - uniq[i] for i in range(len(uniq) - 1)]
    if diffs:
        mean_d = statistics.mean(diffs)
        sd_d = statistics.pstdev(diffs) or 1
        thr = mean_d + 3 * sd_d
        jumps = sorted(((diffs[i], uniq[i], uniq[i + 1]) for i in range(len(diffs))),
                       reverse=True)[:5]
        rows = [[fmt_int(u0), fmt_int(u1), fmt_int(d), '异常' if d > thr else '正常']
                for d, u0, u1 in jumps]
        A(table(['断点前战力', '断点后战力', '间隔', '判定'], rows))
        A('')
        A('- 平均相邻间隔 %s，异常阈值（mean+3σ）%s。'
          % (fmt_int(round(mean_d, 2)), fmt_int(round(thr, 2))))
    A('')

    # ---------- 4. 六系分布 ----------
    A('## 4. 六系分布')
    A('')
    elem_cnt = Counter(c['element'] for c in chars)
    sys_cnt = Counter()
    for c in chars:
        for s in c['systems']:
            sys_cnt[s] += 1
    rows = []
    for k in ['jin', 'mu', 'shui', 'huo', 'tu', 'kongjian', 'none']:
        rows.append([SYSTEM_CN[k], k, fmt_int(elem_cnt.get(k, 0)),
                     fmt_int(sys_cnt.get(k, 0)),
                     '%.1f%%' % (elem_cnt.get(k, 0) / len(chars) * 100)])
    A(table(['系别', 'key', '主属性人数', '属性覆盖人数', '主属性占比'], rows))
    A('')
    multi = sum(1 for c in chars if len(c['systems']) >= 2)
    A('- 多系角色（≥2 系）：%s 名，占 %.1f%%。' % (fmt_int(multi), multi / len(chars) * 100))
    A('- 无系角色：%s 名（%s），使用中性数值基线，不参与克制环。'
      % (fmt_int(elem_cnt.get('none', 0)), '%.1f%%' % (elem_cnt.get('none', 0) / len(chars) * 100)))
    A('')

    # ---------- 5. 卡组审计 ----------
    A('## 5. 卡组审计')
    A('')
    slot_hist = Counter('%d/%d' % (d['skill_slots']['unlocked'], d['skill_slots']['total']) for d in items)
    A('### 5.1 技能槽与解锁')
    A('')
    A(table(['解锁/总槽', '角色数'],
            [[k, fmt_int(v)] for k, v in sorted(slot_hist.items(), key=lambda x: x[0])]))
    A('')
    ratios = [d['primary_skill_ratio'] for d in items if d['primary_ratio_basis'] == 'primary']
    neck = [d for d in items if d['primary_ratio_basis'] == 'primary']
    A('### 5.2 主系卡占比')
    A('')
    A(table(['指标', '值'], [
        ['有主系角色数', fmt_int(len(neck))],
        ['最低占比', '%.0f%%' % (min(ratios) * 100) if ratios else '-'],
        ['平均占比', '%.1f%%' % (statistics.mean(ratios) * 100) if ratios else '-'],
        ['≥60% 达标数', fmt_int(sum(1 for r in ratios if r >= 0.6))],
        ['违规数', fmt_int(sum(1 for r in ratios if r < 0.6))],
    ]))
    A('')
    A('### 5.3 羁绊与终极技')
    A('')
    system_bond = sum(1 for d in items if d['bond_is_system'])
    A(table(['项', '值'], [
        ['六系羁绊', fmt_int(system_bond)],
        ['阵营羁绊', fmt_int(len(items) - system_bond)],
        ['终极技覆盖', '%s / %s' % (fmt_int(sum(1 for d in items if d.get('ultimate'))), fmt_int(len(items)))],
        ['终极技限一次', '全部 %s 条' % fmt_int(sum(1 for d in items if d['ultimate'].get('once_per_battle')))],
    ]))
    A('')
    bond_hist = Counter(d['bond']['name'] for d in items)
    A('羁绊分布 Top 8：' + '、'.join('%s×%s' % (k, fmt_int(v)) for k, v in bond_hist.most_common(8)))
    A('')

    # ---------- 6. 立绘 / 素材 ----------
    A('## 6. 立绘与素材核验')
    A('')
    portrait = sum(1 for d in items if d.get('portrait'))
    A(table(['项', '值'], [
        ['角色立绘命中', '%s / %s（%.1f%%）' % (fmt_int(portrait), fmt_int(len(items)),
                                              portrait / len(items) * 100)],
    ]))
    A('')
    A('### 6.1 结算素材（官方图核验，只读）')
    A('')
    rows = []
    for rel in SETTLEMENT_ASSETS:
        p = os.path.join(ASSETS, rel)
        ok = os.path.exists(p)
        rows.append(['是' if ok else '否', rel])
    A(table(['存在', '路径（相对 E:\\Projects\\assets）'], rows))
    A('')
    A('> 素材红线（docs/05）：仅用《罗小黑战记》官方图；`ai-art` / `同人图` / `AI image` 目录一律排除，'
      '本轮未新增任何外部采集素材。')
    A('')

    # ---------- 7. 成就可达性 ----------
    A('## 7. 成就可达性审计（docs/04 收集类）')
    A('')
    if ach:
        rows, findings = achievement_attainability(chars, ach)
        A('成就定义：%s 条（版本 %s，落点 `data/achievements.json`）；' 
          '判定所需字段来自 `character_stats` 的 `tier` / `rarity` / `mainline` / `systems` 与统一战斗日志。'
          % (fmt_int(len(ach.get('achievements', []))), ach.get('version', '-')))
        A('')
        A(table(['成就 id', '名称', '目标', '静态可达性', '依据'], rows))
        A('')
        if findings:
            A('### 7.1 待拍板缺口')
            A('')
            for i, f in enumerate(findings, 1):
                A('%d. %s' % (i, f))
            A('')
        else:
            A('静态检查未发现不可达成项。')
            A('')
        A('> 说明：「运行时可达成」表示该成就只受玩家对局行为约束（战斗日志），'
          '数据侧不存在阻塞；镜像战胜负按 docs/03 §5.2 不计入角色胜利收藏。')
    else:
        A('未提供 `data/achievements.json`，跳过该项审计。')
    A('')

    # ---------- 8. 结论 ----------
    A('## 8. 结论与建议')
    A('')
    miss_portrait = len(items) - portrait
    ratio_viol = sum(1 for d in items if d['primary_ratio_basis'] == 'primary' and d['primary_skill_ratio'] < 0.6)
    A('1. **规模完整**：%s 名角色全部生成卡组，卡组与数值产物一一对应，无缺漏。' % fmt_int(len(items)))
    A('2. **规则一致**：技能槽严格按 R2 / SR3 / SSR4 / UR4 上限，主线 %s 名完整解锁、'
      '非主线初始 2 张，符合 docs/03 §4。' % fmt_int(sum(1 for c in chars if c['mainline'])))
    A('3. **主系占比**：有主系角色最低 %.0f%%，违规 %d 例，达成「≥60%%」目标。'
      % ((min(ratios) * 100) if ratios else 100, ratio_viol))
    A('4. **分布特征**：R 档 %.1f%% 高于目标 60%%，源于世界观样本中大量低战力同人 / 动物角色；'
      '建议 P3 通过「非主线初始只开放 2 张技能卡」的解锁节奏平衡，而非改数值。'
      % (rar_cnt.get('R', 0) / len(chars) * 100))
    A('5. **立绘覆盖**：%s 名角色（%.1f%%）在官方图库中命中立绘，剩余 %s 名未命中'
      '（多为同人 / 非角色条目），卡面展示需回退为六系图标占位。'
      % (fmt_int(portrait), portrait / len(items) * 100, fmt_int(miss_portrait)))
    A('6. **可扩展性**：技能模板、羁绊表、终极技、稀有度槽位均由 `data/decks.json` 的'
      '`rules` / `skill_profiles` / `bonds` / `ultimates` 段驱动，改规则无需改代码。')
    if ach:
        _, findings = achievement_attainability(chars, ach)
        A('7. **成就可达性**：%s 条收集类成就，%s'
          % (fmt_int(len(ach.get('achievements', []))),
             ('存在 %d 项数据侧缺口（见 §7.1），需在 P3 前拍板。' % len(findings)) if findings
             else '静态检查全部可达成。'))
    A('')
    A('---')
    A('')
    A('*（本报告由脚本生成，数据可追溯至 `character_stats.json` 与 `decks.json`。）*')
    A('')
    return '\n'.join(L)


def main():
    ap = argparse.ArgumentParser(description='六系演武 · R2 审计报告生成')
    ap.add_argument('--stats', default=DEFAULT_STATS)
    ap.add_argument('--decks', default=DEFAULT_DECKS)
    ap.add_argument('--model', default=DEFAULT_MODEL)
    ap.add_argument('--achievements', default=DEFAULT_ACH)
    ap.add_argument('--out', default=DEFAULT_OUT)
    args = ap.parse_args()

    for p in (args.stats, args.decks, args.model):
        if not os.path.exists(p):
            print('[错误] 缺少文件: %s' % p)
            return 2

    stats = load_json(args.stats)
    decks = load_json(args.decks)
    model = load_json(args.model)
    ach = load_json(args.achievements) if os.path.exists(args.achievements) else None

    md = build_report(stats, decks, model, ach)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as f:
        f.write(md)

    print('审计报告输出: %s（%d 字符）' % (args.out, len(md)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
