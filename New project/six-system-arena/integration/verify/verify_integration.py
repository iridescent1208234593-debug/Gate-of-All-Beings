#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_integration.py - 集成包交付自检（R3）

检查项
  1. 交付文件齐全（js / src / styles / data / docs / verify）
  2. arena 单一真源漂移检测（integration/js vs ../ui，integration/data vs ../data 的 sha256）
  3. 官方素材白名单存在性（只读探测，不复制、不改动）
  4. 内容红线扫描：AI 目录 / 同人 / 外链（runtime JS + data JSON + src）
  5. 组件契约：六键图标、window.LXHUI.ICONS、settlement 不惩罚、成就错峰
  6. 数据一致性：488 角色 / 488 卡组 / 15 成就 / 六系定义
  7. 成就 ach_system_001 的土系缺口与 element_gate 拍板结论是否落地

只读参考仓库与数据库，不写除 integration/verify/verify_report.json 之外的文件
（--refresh-hashes 会额外更新 integration/manifest.json 的 hashes 段）。

用法
  python verify_integration.py
  python verify_integration.py --refresh-hashes
  python verify_integration.py --strict          # 任一失败即退出码 1
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

HERE = os.path.dirname(os.path.abspath(__file__))          # integration/verify
INTEG = os.path.dirname(HERE)                              # integration
ARENA = os.path.dirname(INTEG)                             # six-system-arena

REQUIRED_FILES = [
    "README.md",
    "INTEGRATION-ZSZM.md",
    "manifest.json",
    "js/six-system-icons.js",
    "js/settlement.js",
    "src/index.ts",
    "src/sixsys-types.ts",
    "src/sixsys-assets.ts",
    "src/sixsys-data.ts",
    "src/SixSystemPanel.tsx",
    "src/SettlementStage.tsx",
    "src/AchievementBanner.tsx",
    "styles/sixsys-integration.css",
    "data/character_stats.json",
    "data/decks.json",
    "data/achievements.json",
    "data/six-systems.json",
    "data/stat-model.json",
    "verify/install_assets.ps1",
    "verify/sync_from_arena.ps1",
    "verify/verify_integration.py",
    "verify/smoke_integration.mjs",
    "verify/assets.source.json",
]

DRIFT_PAIRS = [
    ("js/six-system-icons.js", "../ui/six-system-icons.js"),
    ("js/settlement.js", "../ui/settlement.js"),
    ("data/character_stats.json", "../data/generated/character_stats.json"),
    ("data/decks.json", "../data/decks.json"),
    ("data/achievements.json", "../data/achievements.json"),
    ("data/six-systems.json", "../data/six-systems.json"),
    ("data/stat-model.json", "../data/stat-model.json"),
]

SIX_KEYS = ["jin", "mu", "shui", "huo", "tu", "kongjian"]

# 红线：出现即判失败（大小写不敏感）
FORBIDDEN_TOKENS = ["ai-art", "ai-avatars", "ai image", "同人图", "midjourney", "stable-diffusion"]

SCAN_DIRS = ["js", "src", "data", "styles"]
SCAN_EXT = {".js", ".ts", ".tsx", ".json", ".css", ".mjs", ".ps1"}
URL_RE = re.compile(r"https?://", re.IGNORECASE)
# 允许出现在「外链守卫正则」中的字面量（sixsys-assets.ts 的 ^https?:\/\/$ 判定）
URL_GUARD_HINTS = ("https?:\\/\\/", "https?:\\/\\/i")


def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        return fh.read()


def load_json(path: str):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


class Report:
    def __init__(self) -> None:
        self.sections: list[dict] = []
        self.failures: list[str] = []

    def add(self, name: str, ok: bool, detail: str, **extra) -> None:
        self.sections.append({"check": name, "ok": bool(ok), "detail": detail, **extra})
        if not ok:
            self.failures.append(f"{name}: {detail}")


def check_required_files(rep: Report) -> None:
    missing = [f for f in REQUIRED_FILES if not os.path.isfile(os.path.join(INTEG, f))]
    rep.add(
        "files.required",
        not missing,
        f"{len(REQUIRED_FILES) - len(missing)}/{len(REQUIRED_FILES)} 存在",
        missing=missing,
    )


def check_drift(rep: Report) -> dict:
    rows = []
    drift = []
    for rel_dst, rel_src in DRIFT_PAIRS:
        dst = os.path.normpath(os.path.join(INTEG, rel_dst))
        src = os.path.normpath(os.path.join(INTEG, rel_src))
        if not os.path.isfile(dst) or not os.path.isfile(src):
            rows.append({"file": rel_dst, "status": "missing"})
            drift.append(rel_dst)
            continue
        hd, hs = sha256_of(dst), sha256_of(src)
        same = hd == hs
        rows.append({"file": rel_dst, "status": "in-sync" if same else "drifted", "sha256": hd[:16]})
        if not same:
            drift.append(rel_dst)
    rep.add(
        "drift.arena-source",
        not drift,
        "全部与 arena 真源一致" if not drift else f"{len(drift)} 个副本漂移",
        rows=rows,
        drifted=drift,
    )
    return {"rows": rows}


def check_official_assets(rep: Report) -> dict:
    cfg = load_json(os.path.join(HERE, "assets.source.json"))
    images_root = os.path.join(cfg["assets_root"], cfg["db_folder"], cfg["images_rel"])
    rows = []
    missing = []
    for item in cfg["whitelist"]:
        p = os.path.join(images_root, item["rel"])
        ok = os.path.isfile(p)
        rows.append({"id": item["id"], "exists": ok, "bytes": os.path.getsize(p) if ok else 0})
        if not ok:
            missing.append(item["id"])
    rep.add(
        "assets.official-whitelist",
        not missing,
        f"{len(rows) - len(missing)}/{len(rows)} 官方素材在位（本轮未联网采集）",
        rows=rows,
        missing=missing,
    )
    return {"rows": rows}


def check_redlines(rep: Report) -> dict:
    hits = []
    urls = []
    for d in SCAN_DIRS:
        base = os.path.join(INTEG, d)
        if not os.path.isdir(base):
            continue
        for root, _dirs, files in os.walk(base):
            for fn in files:
                if os.path.splitext(fn)[1].lower() not in SCAN_EXT:
                    continue
                path = os.path.join(root, fn)
                rel = os.path.relpath(path, INTEG).replace("\\", "/")
                text = read_text(path)
                low = text.lower()
                for tok in FORBIDDEN_TOKENS:
                    if tok in low:
                        hits.append({"file": rel, "token": tok})
                for i, line in enumerate(text.splitlines(), 1):
                    if URL_RE.search(line) and not any(g in line for g in URL_GUARD_HINTS):
                        urls.append({"file": rel, "line": i, "text": line.strip()[:120]})
    rep.add("redline.forbidden-tokens", not hits, "未命中 AI / 同人 关键词" if not hits else f"{len(hits)} 处命中", hits=hits)
    rep.add("redline.no-external-url", not urls, "未发现外链" if not urls else f"{len(urls)} 处外链", urls=urls)
    return {"hits": hits, "urls": urls}


def check_contracts(rep: Report) -> dict:
    icons = read_text(os.path.join(INTEG, "js", "six-system-icons.js"))
    settle = read_text(os.path.join(INTEG, "js", "settlement.js"))
    data_ts = read_text(os.path.join(INTEG, "src", "sixsys-data.ts"))
    stage = read_text(os.path.join(INTEG, "src", "SettlementStage.tsx"))
    assets_ts = read_text(os.path.join(INTEG, "src", "sixsys-assets.ts"))

    details = {}

    missing_keys = [k for k in SIX_KEYS if f"'{k}'" not in icons and f'"{k}"' not in icons]
    rep.add("contract.icon-keys", not missing_keys, f"六键 {SIX_KEYS} 定义完整" if not missing_keys else "缺键", missing=missing_keys)
    details["icon_keys"] = missing_keys

    reg = "LXHUI" in icons and "ICONS" in icons and "registerIcons" in icons
    rep.add("contract.zero-injection", reg, "six-system-icons.js 通过 registerIcons 注册到 window.LXHUI.ICONS")
    details["zero_injection"] = reg

    no_penalty = "penalty" in settle and "false" in settle
    rep.add("contract.no-penalty-on-lose", no_penalty, "settlement.js 含 penalty 字段（失败不惩罚）")
    details["no_penalty"] = no_penalty

    delay = "show_after_ms" in settle
    rep.add("contract.achievement-stagger", delay, "结算引擎含 achievement.show_after_ms（与结算错峰）")
    details["achievement_stagger"] = delay

    lxh = "LXHUI" in data_ts or "LXHUI" in assets_ts
    rep.add("contract.reuse-lxh", lxh, "接入层复用 window.LXHUI（图标兜底 / 标签）")
    details["reuse_lxh"] = lxh

    uses_resolve = "SixSystemSettlement" in stage and "resolve" in stage
    rep.add("contract.settlement-driven", uses_resolve, "SettlementStage 由 resolve() 时间轴数据驱动")
    details["settlement_driven"] = uses_resolve

    no_abs = "E:\\\\Projects" not in stage and "C:\\\\" not in stage
    rep.add("contract.no-abs-path-in-ui", no_abs, "UI 层不含绝对路径（素材经 toSiteUrl 映射）")
    details["no_abs_path"] = no_abs

    return details


def check_data(rep: Report) -> dict:
    stats = load_json(os.path.join(INTEG, "data", "character_stats.json"))
    decks = load_json(os.path.join(INTEG, "data", "decks.json"))
    achs = load_json(os.path.join(INTEG, "data", "achievements.json"))
    systems = load_json(os.path.join(INTEG, "data", "six-systems.json"))

    total = stats.get("meta", {}).get("total") or len(stats.get("characters", []))
    n_deck = len(decks.get("decks", []))
    n_ach = len(achs.get("achievements", []))
    n_sys = len(systems.get("systems", {}))

    rep.add("data.character-stats", total == 488, f"角色 {total} 名", total=total)
    rep.add("data.decks", n_deck == 488, f"卡组 {n_deck} 套", decks=n_deck)
    rep.add("data.achievements", n_ach == 15, f"成就 {n_ach} 条", achievements=n_ach)
    rep.add("data.six-systems", n_sys == 6 and set(systems.get("systems", {})) == set(SIX_KEYS), f"六系定义 {n_sys} 条")

    # 六系覆盖与 ach_system_001 缺口复核（只读统计）
    from collections import Counter

    tiers = {k: 0 for k in SIX_KEYS}
    counts = Counter()
    for c in stats.get("characters", []):
        el = c.get("element")
        counts[el] += 1
        if el in tiers and str(c.get("tier", "F")) >= "C":
            tiers[el] += 1
    tu_c_plus = tiers.get("tu", 0)
    gate = achs.get("element_gate", {})
    rep.add(
        "data.ach_system_001-gap",
        tu_c_plus == 0,
        "土系主属性无 C 档以上（缺口确认）",
        tu_c_plus=tu_c_plus,
        gate=gate,
    )
    rep.add(
        "data.ach_system_001-decision",
        bool(gate),
        "achievements.json 已落地 element_gate 拍板（替代路径 / 门槛）" if gate else "缺少 element_gate 拍板段",
    )
    return {"element_counts": dict(counts), "c_plus": tiers}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh-hashes", action="store_true")
    ap.add_argument("--strict", action="store_true")
    args = ap.parse_args()

    rep = Report()
    check_required_files(rep)
    drift = check_drift(rep)
    assets = check_official_assets(rep)
    red = check_redlines(rep)
    contracts = check_contracts(rep)
    data = check_data(rep)

    ok_all = not rep.failures
    report = {
        "tool": "verify_integration.py",
        "package": "sixsys-zszm-integration",
        "arena_root": ARENA,
        "integration_root": INTEG,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "ok": ok_all,
        "failures": rep.failures,
        "checks": rep.sections,
        "details": {
            "drift": drift,
            "assets": assets,
            "redlines": red,
            "contracts": contracts,
            "data": data,
        },
    }

    out = os.path.join(HERE, "verify_report.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)

    if args.refresh_hashes:
        man_path = os.path.join(INTEG, "manifest.json")
        try:
            man = load_json(man_path)
        except Exception:
            man = {"package": "sixsys-zszm-integration", "files": []}
        hashes = {}
        for rel in REQUIRED_FILES:
            p = os.path.join(INTEG, rel)
            if os.path.isfile(p):
                hashes[rel] = {"sha256": sha256_of(p), "bytes": os.path.getsize(p)}
        man["hashes"] = hashes
        man["hashes_refreshed_at"] = report["generated_at"]
        man["package_version"] = man.get("package_version", "1.0.0")
        with open(man_path, "w", encoding="utf-8") as fh:
            json.dump(man, fh, ensure_ascii=False, indent=2)
        print(f"[sixsys] manifest hashes refreshed: {len(hashes)} files")

    print("=" * 68)
    print("sixsys-zszm-integration · 交付自检")
    print("=" * 68)
    for s in rep.sections:
        print(f"[{'PASS' if s['ok'] else 'FAIL'}] {s['check']:<34} {s['detail']}")
    print("-" * 68)
    print(f"结果：{'全部通过' if ok_all else str(len(rep.failures)) + ' 项失败'}  -> {out}")

    if args.strict and not ok_all:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
