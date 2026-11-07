"""Alert rules over one node's snapshot. Pure functions, so they are unit-tested without any server."""
from __future__ import annotations

import time

DEFAULTS = {"stale_s": 90, "cpu": 90, "mem": 90, "disk_used": 90, "log_errors": 1}


def evaluate(node: str, entry: dict, rules: dict | None = None, now: float | None = None) -> list[dict]:
    r = DEFAULTS | (rules or {})
    now = now or time.time()
    out: list[dict] = []

    def add(level, code, detail=""):
        out.append({"node": node, "level": level, "code": code, "detail": str(detail)[:200]})

    snap = entry.get("snapshot")
    if not entry.get("reachable"):
        add("critical", "node_unreachable", entry.get("error", ""))
        if not snap:
            return out
    if not snap:
        return out
    age = now - float(snap.get("collected_at", 0))
    if age > r["stale_s"]:
        add("warning", "snapshot_stale", f"{age:.0f}s")
    sysm = snap.get("system", {})
    if (sysm.get("cpu_percent") or 0) >= r["cpu"]:
        add("warning", "cpu_high", sysm.get("cpu_percent"))
    if (sysm.get("memory", {}).get("percent") or 0) >= r["mem"]:
        add("warning", "memory_high", sysm["memory"]["percent"])
    for d in sysm.get("disks", []):
        if d.get("error"):
            add("warning", "disk_unreadable", d.get("path"))
        elif (d.get("used_percent") or 0) >= r["disk_used"]:
            add("warning", "disk_full", f"{d['path']} {d['used_percent']}%")
    for name, p in snap.get("ports", {}).items():
        if not p.get("ok"):
            add("critical", "port_down", name)
    for name, h in snap.get("http", {}).items():
        if not h.get("ok"):
            add("critical", "http_unhealthy", f"{name} {h.get('status', h.get('error'))}")
    for name, count in snap.get("processes", {}).items():
        if isinstance(count, int) and count == 0:
            add("critical", "process_missing", name)
    for unit, s in snap.get("systemd", {}).items():
        if isinstance(s, dict) and s.get("ActiveState") != "active":
            add("critical", "unit_inactive", f"{unit} {s.get('ActiveState')}")
    frpc = snap.get("frpc")
    if frpc is not None and not frpc.get("ok"):
        bad = [p["name"] for p in frpc.get("proxies", []) if p.get("status") != "running"]
        add("critical", "frpc_unhealthy", ",".join(bad) or frpc.get("error") or frpc.get("status"))
    for lg in snap.get("logs", []):
        if lg.get("error_lines", 0) >= r["log_errors"]:
            add("info", "log_errors", f"{lg['path']} {lg['error_lines']}")
    for db in snap.get("databases", []):
        if not db.get("ok"):
            add("critical", "database_unhealthy", f"{db.get('path')} {db.get('error', db.get('quick_check'))}")
    for name, b in snap.get("backups", {}).items():
        if not b.get("ok"):
            add("warning", "backup_missing", name)
        elif b.get("max_age_hours") and now - b["modified"] > b["max_age_hours"] * 3600:
            add("warning", "backup_old", f"{name} {(now - b['modified']) / 3600:.0f}h")
    lab = snap.get("lab")
    if lab:
        if not lab.get("health", {}).get("ok"):
            add("critical", "lab_gateway_down")
        sup = lab.get("supervisor", {})
        if not sup.get("ok"):
            failed = [k for k, v in sup.get("children", {}).items() if v.get("failed") or not v.get("alive")]
            add("critical", "lab_supervisor", ",".join(failed) or sup.get("phase") or sup.get("error"))
        if not lab.get("monitor", {}).get("ok"):
            add("info", "lab_monitor_unavailable", lab.get("monitor", {}).get("login_error", ""))
    hk = snap.get("hk_release")
    if hk and hk.get("error"):
        add("warning", "hk_release_unreadable", hk["error"])
    elif hk:
        for svc, state in (hk.get("services") or {}).items():
            if state != "active":
                add("critical", "hk_service_inactive", f"{svc} {state}")
        if hk.get("drift"):
            add("warning", "hk_release_drift", hk["drift"])
    return out
