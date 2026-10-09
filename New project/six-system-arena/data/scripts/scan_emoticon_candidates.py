# -*- coding: utf-8 -*-
"""R9 官方表情包素材专项采集：离线候选扫描器。

只读扫描 emoticons.json 白名单目录，产出 data/emoticons-candidates.json，
含 sha256 溯源凭证与 Agent 视觉初筛证据，供人工逐张终审。

铁律：
  1. 绝不写入运行时池（不改 emoticons.json 的 pool）；
  2. 所有候选 status 一律 pending（未经人工审查，禁止入池）；
  3. 只扫描白名单目录，不触碰 AI 生成目录与非白名单角色目录；
  4. 不联网、不下载、不改画任何角色形象。

用法：python data/scripts/scan_emoticon_candidates.py
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.normpath(os.path.join(HERE, os.pardir))
LEDGER = os.path.join(DATA_DIR, "emoticons.json")
OUT = os.path.join(DATA_DIR, "emoticons-candidates.json")
ROUND = "R9"
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
# Agent 视觉初筛证据（analyze_image 逐张判读，仅作人工终审参考，不构成入池结论）
EVIDENCE = {
    "比丢_1.jpg": ("candidate", "双手捂脸，无标题条、无第三方署名，可作官方表情候选"),
    "比丢_2.png": ("candidate", "侧卧安详，无标题条、无第三方署名，可作官方表情候选"),
    "罗小黑_剧照_011.jpeg": ("pending", "雨景偏冷色调，来源凭证待人工确认"),
    "罗小黑_化形形象.jpg": ("reject", "含官方标题条/第三方署名，裁切前不得入池"),
    "罗小黑_娘化形象.gif": ("reject", "含第三方署名（非官方渠道），排除"),
    "罗小黑_海报本体形象.jpg": ("reject", "海报版式（含发行方署名），排除"),
    "罗小黑_页面截图.png": ("reject", "含站点 UI 元素，非表情素材，排除"),
    "罗小黑_infobox.jpg": ("reject", "维基 infobox 版式，排除"),
    "罗小黑.jpg": ("reject", "含 羅小黑戰記 标题条，排除"),
    "罗小黑_001.jpg": ("reject", "含标题条，角色设定稿版式，排除"),
    "罗小黑_002.jpg": ("reject", "含标题条，排除"),
    "罗小黑_003.jpg": ("reject", "含标题条，排除"),
    "罗小黑_004.jpg": ("reject", "含标题条，排除"),
}


def classify(name: str) -> str:
    base = name.lower()
    if "表情" in name:
        return "emoticon"
    if "剧照" in name:
        return "still"
    if "全身" in name:
        return "full_body"
    if "海报" in name or "infobox" in base:
        return "poster"
    if "化形" in name or "娘化" in name:
        return "transform"
    if "截图" in base or "-shot" in base:
        return "screenshot"
    return "other"


def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    with open(LEDGER, "r", encoding="utf-8") as fh:
        ledger = json.load(fh)
    asset_root = ledger["asset_root"]
    allowed = ledger["asset_dirs_allowed"]

    pool_paths = set()
    for items in ledger["pool"].values():
        for it in items:
            pool_paths.add(os.path.normcase(it["path"]))

    rows = []
    for d in allowed:
        root = os.path.join(asset_root, d)
        for name in sorted(os.listdir(root)):
            full = os.path.join(root, name)
            if not os.path.isfile(full):
                continue
            if os.path.splitext(name)[1].lower() not in IMAGE_EXT:
                continue
            in_pool = os.path.normcase(full) in pool_paths
            if in_pool:
                verdict, basis = "in_pool", "已在运行时池（approved），非本轮新增"
            else:
                verdict, basis = EVIDENCE.get(name, ("pending", "Agent 未逐张判读，待人工审查"))
            rows.append({
                "file_name": name,
                "path": full,
                "source_dir": "images\\" + d,
                "category": classify(name),
                "size_bytes": os.path.getsize(full),
                "sha256": sha256_of(full),
                "verdict": verdict,
                "basis": basis,
                "status": "pending",
                "destination": "unassigned" if verdict != "candidate" else "comfort|entrance",
            })

    counts = {}
    for r in rows:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1

    payload = {
        "version": "0.1.0",
        "round": ROUND,
        "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "generator": "data/scripts/scan_emoticon_candidates.py",
        "doc": "docs/13-表情包候选清单.md",
        "ledger": "data/emoticons.json",
        "notice": "本文件为离线候选登记表，全部条目 status=pending，未经人工逐张审查前不得写入 emoticons.json 的 pool，不得用于运行时渲染。",
        "asset_root": asset_root,
        "asset_dirs_allowed": allowed,
        "scan_scope": "仅白名单目录，未联网（联网采集须端侧 App 授权导出，见 docs/13 待采集清单）",
        "counts": counts,
        "candidates": rows,
    }

    if args.dry_run:
        print(json.dumps({"counts": counts, "total": len(rows)}, ensure_ascii=False))
        return 0

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print("wrote " + args.out)
    print(json.dumps(counts, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

