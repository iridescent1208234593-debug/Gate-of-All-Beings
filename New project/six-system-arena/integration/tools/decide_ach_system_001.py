#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
decide_ach_system_001.py — 「金木水火土」成就土系缺口 · 拍板参考工具（R3）
============================================================================
只读脚本：读取 data/generated/character_stats.json、data/achievements.json、
data/stat-model.json，复算缺口并给出三套方案的可行性对比与建议。

背景（R2 审计 §7.1 报备）：ach_system_001 要求 金/木/水/火/土 五系各 ≥1 名 C 档
以上（tier ∈ {C,B,A}）角色；实际土系主属性 7 名角色最高仅 D 档，静态不可达成。

本脚本不修改任何数据，只输出结论供决策；如确需落盘，请显式传 --out。

用法：
    python integration/tools/decide_ach_system_001.py
    python integration/tools/decide_ach_system_001.py --out temp/decide_ach_system_001.json
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

TIER_ORDER = ["F", "E", "D", "C", "B", "A"]
C_AND_ABOVE = {"C", "B", "A"}
FIVE = ["jin", "mu", "shui", "huo", "tu"]
SYSTEM_CN = {"jin": "金", "mu": "木", "shui": "水", "huo": "火", "tu": "土", "kongjian": "空间", "none": "无系"}

ROOT = pathlib.Path(__file__).resolve().parents[2]


def load(rel: str):
    with (ROOT / rel).open(encoding="utf-8") as fh:
        return json.load(fh)


def tier_index(t: str) -> int:
    return TIER_ORDER.index(t) if t in TIER_ORDER else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="ach_system_001 土系缺口拍板参考")
    ap.add_argument("--out", default="", help="可选：把结论 JSON 写入指定路径（默认只打印）")
    args = ap.parse_args()

    stats = load("data/generated/character_stats.json")
    ach = load("data/achievements.json")
    model = load("data/stat-model.json")
    chars = stats["characters"]

    thresholds = (model.get("power_tiers") or model.get("tiers") or model.get("tier_thresholds") or {})
    c_floor = None
    if isinstance(thresholds, dict):
        node = thresholds.get("C") or {}
        if isinstance(node, dict):
            c_floor = node.get("min") or node.get("min_power")
    if c_floor is None:
        c_floor = 3600  # 与 R2 审计报告一致的分档基线

    target = next((a for a in ach["achievements"] if a["id"] == "ach_system_001"), None)
    if target is None:
        print("未找到 ach_system_001，请检查 data/achievements.json", file=sys.stderr)
        return 2

    covered = {}
    for el in FIVE:
        pool = [c for c in chars if c.get("element") == el]
        covered[el] = {
            "total": len(pool),
            "c_plus": sum(1 for c in pool if c.get("tier") in C_AND_ABOVE),
            "max_tier": max((c.get("tier") for c in pool), key=tier_index, default=None),
            "max_power": max((c.get("power", 0) for c in pool), default=0),
        }

    tu_pool = sorted(
        [c for c in chars if c.get("element") == "tu"],
        key=lambda c: -c.get("power", 0),
    )
    tu_rows = [
        {
            "id": c["id"],
            "name": c["name"],
            "tier": c.get("tier"),
            "power": c.get("power"),
            "mainline": bool(c.get("mainline")),
            "gap_to_C": max(0, int(c_floor) - int(c.get("power", 0))),
            "realm": c.get("realm_name"),
        }
        for c in tu_pool
    ]

    # 方案 A：土系补 1 名 C 档（人工校准 / 数值上调）
    plan_a = {
        "plan": "A · 数据侧补齐土系 C 档",
        "how": "在 data/manual-overrides.json 为中意角色写入人工校准（或修正系属判定），使其 tier ≥ C",
        "changes": ["data/manual-overrides.json（新增 1 条）"],
        "engine_change": False,
        "achievable": bool(tu_rows) and covered["tu"]["total"] > 0,
        "cheapest_candidate": min(tu_rows, key=lambda r: r["gap_to_C"]) if tu_rows else None,
        "note": "不动成就语义与引擎；但需逐条核对世界观设定，避免为了成就强行拔高数值。",
    }

    # 方案 B：放宽档位门槛 C → D
    plan_b = {
        "plan": "B · 放宽 min_tier：C → D",
        "how": "ach_system_001.condition.min_tier 与 element_gate.min_tier 同步改为 D",
        "changes": [
            "data/achievements.json（condition.min_tier / element_gate.min_tier）",
            "ui/achievement-system.js（2 处硬编码需参数化，见下）",
        ],
        "engine_change": True,
        "engine_hardcode": [
            "const C_TIER_OR_ABOVE = ['C','B','A']（metricValue('elements_c_covered') 使用）",
            "conditionMet() 的 element_coverage 分支直接调用 tierAtLeastC()",
        ],
        "achievable": covered["tu"]["c_plus"] == 0 and any(
            c.get("tier") == "D" for c in chars if c.get("element") == "tu"
        ),
        "note": "仅改 JSON 不生效——引擎两处硬编码必须同时参数化，属 R2→R3 未完成的扩展项。",
    }

    # 方案 C：替代路径（按系收集 N 名即可，不限档位）
    plan_c = {
        "plan": "C · 增加替代路径 or_collect_per_element",
        "how": "element_gate 增补 or_collect_per_element=N：某系无 C 档角色时，收集该系 N 名亦可点亮",
        "changes": [
            "data/achievements.json（element_gate.or_collect_per_element）",
            "ui/achievement-system.js（新增替代分支）",
            "integration/src/sixsys-data.ts（achievementProgress 已按此口径实现，需与引擎对齐）",
        ],
        "engine_change": True,
        "achievable": True,
        "suggest_n": 3,
        "note": "最贴合「收集类成就」定位，且为后续新系别扩展留出缓冲；代价是判定逻辑变复杂。",
    }

    conclusion = {
        "gap_confirmed": covered["tu"]["c_plus"] == 0,
        "coverage_now": {el: covered[el]["c_plus"] for el in FIVE},
        "covered_elements": sum(1 for el in FIVE if covered[el]["c_plus"] > 0),
        "recommendation": "A（先解静态阻塞）+ C（作为引擎 1.1.0 的扩展项排期）",
        "recommendation_reason": [
            "A 只改数据、不动引擎与成就语义，可在本轮立即解除「静态不可达成」阻塞；",
            "B 语义降档会让后续所有系别成就一起贬值，不推荐；",
            "C 是长期正确解（可扩展、贴合收集定位），但需改引擎 2 处硬编码，建议与 P4 全量铺开同批落地。",
        ],
        "must_fix_in_engine": [
            "achievement-system.js: C_TIER_OR_ABOVE 常量 → 读 achievements.json 的 element_gate.min_tier",
            "achievement-system.js: conditionMet 的 element_coverage → 使用参数化档位 + or_collect_per_element",
        ],
        "decided_by_user": False,
    }

    report = {
        "tool": "decide_ach_system_001",
        "round": "R3",
        "generated_from": {
            "character_stats": "data/generated/character_stats.json",
            "achievements": "data/achievements.json",
            "stat_model": "data/stat-model.json",
        },
        "target_achievement": {
            "id": target["id"],
            "name": target["name"],
            "desc": target["desc"],
            "condition": target["condition"],
            "progress": target["progress"],
        },
        "c_floor": c_floor,
        "element_coverage": covered,
        "tu_pool": tu_rows,
        "plans": [plan_a, plan_b, plan_c],
        "conclusion": conclusion,
    }

    if args.out:
        out = pathlib.Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print("已写出：" + str(out))

    print("=" * 72)
    print("ach_system_001「金木水火土」土系缺口 · 拍板参考（只读，未改动任何数据）")
    print("=" * 72)
    print("C 档战力下限：%s" % c_floor)
    print("五系 C 档以上人数：" + "、".join(f"{SYSTEM_CN[e]}={covered[e]['c_plus']}" for e in FIVE))
    print("当前可覆盖 %d/5，缺口：%s" % (
        conclusion["covered_elements"],
        "、".join(SYSTEM_CN[e] for e in FIVE if covered[e]["c_plus"] == 0) or "无",
    ))
    print("-" * 72)
    print("土系主属性角色（%d 名，按战力降序）：" % len(tu_rows))
    for r in tu_rows:
        print("  id=%-6s %-8s tier=%-2s 战力=%-6s 距 C 档差 %-5s 主线=%s" % (
            r["id"], r["name"], r["tier"], r["power"], r["gap_to_C"], "是" if r["mainline"] else "否",
        ))
    print("-" * 72)
    for p in report["plans"]:
        print("[%s] 需改引擎：%s / 可达成：%s" % (p["plan"], "是" if p["engine_change"] else "否", p["achievable"]))
        print("      %s" % p["how"])
        if p.get("cheapest_candidate"):
            cand = p["cheapest_candidate"]
            print("      最省改动候选：%s（id=%s，当前 %s 档 %s，需 +%s 战力至 C 档）" % (
                cand["name"], cand["id"], cand["tier"], cand["power"], cand["gap_to_C"],
            ))
        if p.get("engine_hardcode"):
            for h in p["engine_hardcode"]:
                print("      ⚠ 引擎硬编码：%s" % h)
    print("-" * 72)
    print("建议：%s" % conclusion["recommendation"])
    for reason in conclusion["recommendation_reason"]:
        print("  · %s" % reason)
    print("=" * 72)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
