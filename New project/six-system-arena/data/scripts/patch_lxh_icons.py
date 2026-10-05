#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
六系演武 · lxh-ui.js 六键增量补丁工具
================================================

职责：为 E:\\Projects\\shared\\shared-ui\\lxh-ui.js 的 ICONS 对象**增量**追加六个键
      jin / mu / shui / huo / tu / kongjian，其余内容逐字节保持不变。

安全设计（四道防线）：
  1. 默认 dry-run，只打印差异，绝不写文件。
  2. --apply 前自动备份到 <项目>/vendor/backup/，并记录 sha256。
  3. 只在大括号配对定位到的 ICONS 闭合位置前插入，不触碰任何其它字符。
  4. 写回后自动校验（原 21 键完好 / 新 6 键存在 / 括号平衡），任一不符立即自动回滚。

用法：
  python patch_lxh_icons.py --dry-run     # 预览（默认）
  python patch_lxh_icons.py --apply       # 应用（自动备份 + 校验）
  python patch_lxh_icons.py --rollback    # 回滚到最近一次备份
"""

import argparse
import hashlib
import json
import os
import shutil
import sys
import time

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))          # six-system-arena/
BACKUP_DIR = os.path.join(ROOT, 'vendor', 'backup')
DEFAULT_TARGET = r'E:\Projects\shared\shared-ui\lxh-ui.js'
DEFAULT_BACKUP_JSON = os.path.join(BACKUP_DIR, 'lxh-ui.backup-index.json')

# 原有 21 键（用于校验补丁未破坏既有内容）
ORIGINAL_KEYS = ['help', 'exit', 'wrench', 'scroll', 'shop', 'radar', 'friend', 'star', 'map',
                 'door', 'smiley', 'person', 'search', 'back', 'locate', 'camera', 'race_human',
                 'race_bird', 'race_fish', 'race_lizard', 'race_frog']

# 新增 6 键（图形与配色对齐官方卡片 SVG，渐变色 id 带 ss- 前缀避免与既有 id 冲突）
NEW_SYSTEMS = [
    ('jin', '#c9a227', '金'),
    ('mu', '#4a8a5a', '木'),
    ('shui', '#3f7f9e', '水'),
    ('huo', '#c8452f', '火'),
    ('tu', '#9a7642', '土'),
    ('kongjian', '#7a6aa8', '域'),
]


def new_svg(key, color, glyph):
    uid = 'ssBg-' + key
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" data-system="' + key + '">'
        '<defs><radialGradient id="' + uid + '" cx="50%" cy="36%" r="72%">'
        '<stop offset="0%" stop-color="#2b2b30"/><stop offset="100%" stop-color="#0d0d10"/>'
        '</radialGradient></defs>'
        '<circle cx="64" cy="64" r="60" fill="url(#' + uid + ')" stroke="' + color + '" stroke-width="3.5"/>'
        '<circle cx="64" cy="64" r="51" fill="none" stroke="' + color + '" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>'
        '<text x="64" y="84" font-size="46" text-anchor="middle" fill="' + color + '" '
        'font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">' + glyph + '</text>'
        '<path d="M52 96 L76 96" stroke="' + color + '" stroke-width="2" stroke-linecap="round" opacity="0.7"/>'
        '</svg>'
    )


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def find_icons_block(src: str):
    """返回 (open_idx, close_idx)；close_idx 指向 ICONS 闭合的 '}'。"""
    marker = 'var ICONS = {'
    start = src.find(marker)
    if start == -1:
        raise ValueError('未找到 `var ICONS = {` 锚点，文件结构可能已变化')
    depth = 0
    i = src.index('{', start)
    while i < len(src):
        ch = src[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return start, i
        i += 1
    raise ValueError('ICONS 大括号未闭合，文件可能损坏')


def build_patch(src: str, eol: str):
    start, close = find_icons_block(src)
    lines = ['    %s: \'%s\'' % (k, new_svg(k, c, g)) for k, c, g in NEW_SYSTEMS]
    insert = ',' + eol + (',' + eol).join(lines)
    patched = src[:close] + insert + src[close:]
    return patched, start, close


def verify(patched: str):
    """校验：原 21 键完好、新 6 键存在、ICONS 块括号平衡、整体括号数一致。"""
    start, close = find_icons_block(patched)
    block = patched[start:close + 1]
    missing_old = [k for k in ORIGINAL_KEYS if (k + ':') not in block]
    missing_new = [k for k, _, _ in NEW_SYSTEMS if (k + ':') not in block]
    problems = []
    if missing_old:
        problems.append('原键丢失: %s' % missing_old)
    if missing_new:
        problems.append('新键缺失: %s' % missing_new)
    if patched.count('{') != patched.count('}'):
        problems.append('大括号不平衡: {=%d }=%d' % (patched.count('{'), patched.count('}')))
    return (not problems), problems, len(block)


def do_backup(target: str):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    raw = open(target, 'rb').read()
    stamp = time.strftime('%Y%m%d-%H%M%S')
    bak = os.path.join(BACKUP_DIR, 'lxh-ui.js.bak-%s.js' % stamp)
    with open(bak, 'wb') as f:
        f.write(raw)
    digest = sha256_bytes(raw)
    index = []
    if os.path.exists(DEFAULT_BACKUP_JSON):
        try:
            index = json.load(open(DEFAULT_BACKUP_JSON, encoding='utf-8'))
        except Exception:
            index = []
    index.append({'target': target, 'backup': bak, 'sha256': digest, 'time': stamp})
    with open(DEFAULT_BACKUP_JSON, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    return bak, digest


def rollback(target: str):
    if not os.path.exists(DEFAULT_BACKUP_JSON):
        print('[回滚] 未找到备份索引，无法回滚')
        return 1
    index = json.load(open(DEFAULT_BACKUP_JSON, encoding='utf-8'))
    cands = [r for r in index if os.path.abspath(r['target']) == os.path.abspath(target) and os.path.exists(r['backup'])]
    if not cands:
        print('[回滚] 没有适用于 %s 的备份' % target)
        return 1
    latest = cands[-1]
    shutil.copyfile(latest['backup'], target)
    cur = sha256_bytes(open(target, 'rb').read())
    ok = (cur == latest['sha256'])
    print('[回滚] 已从 %s 恢复，校验 %s' % (latest['backup'], '通过' if ok else '失败'))
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description='lxh-ui.js 六键增量补丁（默认 dry-run）')
    ap.add_argument('--target', default=DEFAULT_TARGET, help='目标文件，默认共享 UI 的 lxh-ui.js')
    ap.add_argument('--apply', action='store_true', help='实际写入（自动备份 + 校验，失败自动回滚）')
    ap.add_argument('--dry-run', action='store_true', help='仅预览（默认行为）')
    ap.add_argument('--rollback', action='store_true', help='回滚到最近一次备份')
    args = ap.parse_args()

    target = args.target
    if args.rollback:
        return rollback(target)

    if not os.path.exists(target):
        print('[错误] 目标文件不存在: %s' % target)
        return 2

    raw = open(target, 'rb').read()
    src = raw.decode('utf-8')
    eol = '\r\n' if '\r\n' in src else '\n'

    try:
        patched, start, close = build_patch(src, eol)
    except ValueError as e:
        print('[错误] %s' % e)
        return 2

    ok, problems, block_len = verify(patched)
    print('目标文件      : %s' % target)
    print('原文件大小    : %d 字节 / sha256=%s' % (len(raw), sha256_bytes(raw)[:16]))
    print('ICONS 块定位  : 字符 [%d, %d]，块内 %d 字符' % (start, close, block_len))
    print('待新增键      : %s' % ', '.join(k for k, _, _ in NEW_SYSTEMS))
    print('新增字符数    : +%d' % (len(patched) - len(src)))
    print('补丁自检      : %s' % ('通过' if ok else '失败 -> %s' % problems))

    if not ok:
        print('[中止] 自检未通过，不写入任何内容')
        return 3

    if not args.apply:
        print('\n[dry-run] 未写入文件。确认无误后执行:  python patch_lxh_icons.py --apply')
        return 0

    bak, digest = do_backup(target)
    print('\n[备份] %s (sha256=%s)' % (bak, digest[:16]))

    try:
        with open(target, 'wb') as f:
            f.write(patched.encode('utf-8'))
    except Exception as e:
        print('[错误] 写入失败: %s，目标文件未改变' % e)
        return 4

    after = open(target, 'rb').read().decode('utf-8')
    ok2, problems2, _ = verify(after)
    if not ok2:
        print('[校验失败] %s -> 自动回滚' % problems2)
        shutil.copyfile(bak, target)
        return 5

    print('[校验] 通过：原 21 键完好，新 6 键已就位，大括号平衡')
    print('[完成] 可回滚命令:  python patch_lxh_icons.py --rollback')
    return 0


if __name__ == '__main__':
    sys.exit(main())
