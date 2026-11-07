"""Read-only probes: TCP ports, HTTP health, processes, log error counts, frpc admin status, files' metadata.

There is deliberately no generic "run a command" probe: an agent config cannot make a node execute anything
beyond tasklist (Windows) and `systemctl show` / `systemctl is-active` (Linux).

Every probe returns plain data and never raises: a failure is reported as {"ok": False, "error": ...}.
"""
from __future__ import annotations

import base64
import json
import os
import re
import socket
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SECRET_RE = re.compile(r"((?:secret|password|passwd|token|key|pass|salt|cookie|authorization)[a-z0-9_\-]*"
                       r"[\"']?\s*[=:]\s*[\"']?)[^\s\"',;]+", re.I)
BEARER_RE = re.compile(r"(bearer\s+)[A-Za-z0-9._\-]+", re.I)
IPV4_RE = re.compile(r"\b(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}\b")


def redact(line: str) -> str:
    """Drop credential values and the host part of IPv4 addresses before a line leaves the node."""
    line = BEARER_RE.sub(r"\1[redacted]", line)        # before SECRET_RE, which would eat the word "Bearer"
    line = SECRET_RE.sub(r"\1[redacted]", line)
    return IPV4_RE.sub(r"\1.\2.x.x", line)


_NO_PROXY = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def http_get(url: str, timeout: float = 4.0, headers: dict | None = None, auth: tuple[str, str] | None = None,
             want_header: str | None = None):
    """GET without any system proxy (Mihomo/clash on C would otherwise intercept loopback).
    Returns (status, body), or (status, body, header value) when want_header is given."""
    req = urllib.request.Request(url, headers=dict(headers or {}))
    if auth:
        req.add_header("Authorization", "Basic " + base64.b64encode(f"{auth[0]}:{auth[1]}".encode()).decode())
    try:
        with _NO_PROXY.open(req, timeout=timeout) as resp:
            out = (resp.status, resp.read(2_000_000))
            return out + (resp.headers.get(want_header),) if want_header else out
    except urllib.error.HTTPError as error:
        out = (error.code, error.read(2000))
        return out + (None,) if want_header else out


def tcp(host: str, port: int, timeout: float = 2.0) -> dict:
    t = time.perf_counter()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return {"ok": True, "ms": round((time.perf_counter() - t) * 1000, 1)}
    except OSError as error:
        return {"ok": False, "error": type(error).__name__}


def http_check(url: str, expect: int = 200, timeout: float = 4.0) -> dict:
    t = time.perf_counter()
    try:
        status, body = http_get(url, timeout)
    except Exception as error:  # noqa: BLE001
        return {"ok": False, "error": type(error).__name__}
    out = {"ok": status == expect, "status": status, "ms": round((time.perf_counter() - t) * 1000, 1)}
    try:
        data = json.loads(body)
        if isinstance(data, dict) and "version" in data:
            out["version"] = str(data["version"])[:80]
    except ValueError:
        pass
    return out


def processes(names: list[str]) -> dict:
    """Counts of running processes whose executable name matches (case-insensitive, no extension)."""
    want = {n.lower().removesuffix(".exe") for n in names}
    found: dict[str, int] = {n: 0 for n in want}
    try:
        if os.name == "nt":
            out = subprocess.run(["tasklist", "/fo", "csv", "/nh"], capture_output=True, text=True, timeout=10,
                                 creationflags=0x08000000).stdout
            exe = [line.split('","')[0].strip('"') for line in out.splitlines() if line]
        else:
            exe = []
            for p in Path("/proc").iterdir():
                if p.name.isdigit():
                    try:
                        exe.append((p / "comm").read_text().strip())
                    except OSError:
                        pass
        for e in exe:
            k = e.lower().removesuffix(".exe")
            if k in found:
                found[k] += 1
    except Exception as error:  # noqa: BLE001
        return {"error": type(error).__name__}
    return found


def systemd_units(units: list[str]) -> dict:
    if not units or sys.platform != "linux":
        return {}
    try:
        out = subprocess.run(["systemctl", "show", *units, "-p", "Id,ActiveState,SubState,NRestarts,ActiveEnterTimestamp",
                              "--no-pager"], capture_output=True, text=True, timeout=10).stdout
    except Exception as error:  # noqa: BLE001
        return {"error": type(error).__name__}
    result, cur = {}, {}
    for line in out.splitlines() + [""]:
        if not line.strip():
            if cur.get("Id"):
                result[cur.pop("Id")] = cur
            cur = {}
            continue
        k, _, v = line.partition("=")
        cur[k] = v
    return result


def log_tail(path: str, patterns: list[str], lines: int = 0, window_bytes: int = 200_000) -> dict:
    """Count of lines matching error patterns, the last few of them, and (only if configured) a plain tail.
    Everything is redacted on the node before it is sent; the hub never writes these lines to disk."""
    p = Path(path)
    try:
        st = p.stat()
        with p.open("rb") as fh:
            fh.seek(max(0, st.st_size - window_bytes))
            text = fh.read().decode("utf-8", "replace").splitlines()[1:]
    except OSError as error:
        return {"path": p.name, "ok": False, "error": type(error).__name__}
    rx = re.compile("|".join(patterns), re.I) if patterns else None
    hits = [redact(t)[:300] for t in text if rx and rx.search(t)]
    return {"path": p.name, "ok": True, "bytes": st.st_size, "modified": st.st_mtime,
            "error_lines": len(hits), "last_errors": hits[-5:], "tail": [redact(t)[:300] for t in text[-lines:]] if lines else []}


def frpc_status(url: str, user: str, password: str) -> dict:
    """frpc's own admin API (webServer on 127.0.0.1): per-proxy phase, e.g. running / start error."""
    try:
        status, body = http_get(url.rstrip("/") + "/api/status", 3.0, auth=(user, password))
    except Exception as error:  # noqa: BLE001
        return {"ok": False, "error": type(error).__name__}
    if status != 200:
        return {"ok": False, "status": status}
    data = json.loads(body)
    proxies = [{"name": p.get("name"), "type": p.get("type"), "status": p.get("status"),
                "err": redact(p.get("err", ""))[:200]} for group in data.values() for p in (group or [])]
    return {"ok": bool(proxies) and all(p["status"] == "running" for p in proxies), "proxies": proxies}


def file_meta(path: str) -> dict:
    """Size and mtime only. Used for production databases: never opened, so no -shm/-wal side effects."""
    p = Path(path)
    try:
        st = p.stat()
    except OSError as error:
        return {"path": p.name, "ok": False, "error": type(error).__name__}
    return {"path": p.name, "ok": st.st_size > 0, "bytes": st.st_size, "modified": st.st_mtime, "stat_only": True}


def sqlite_meta(path: str, quick_check: bool = False) -> dict:
    """Size/mtime and a read-only open. quick_check is opt-in because it reads the whole file."""
    p = Path(path)
    try:
        st = p.stat()
    except OSError as error:
        return {"path": p.name, "ok": False, "error": type(error).__name__}
    out = {"path": p.name, "bytes": st.st_size, "modified": st.st_mtime}
    try:
        con = sqlite3.connect(f"{p.resolve().as_uri()}?mode=ro", uri=True, timeout=2)
        try:
            out["user_version"] = con.execute("PRAGMA user_version").fetchone()[0]
            if quick_check:
                out["quick_check"] = con.execute("PRAGMA quick_check").fetchone()[0]
        finally:
            con.close()
        out["ok"] = out.get("quick_check", "ok") == "ok"
    except sqlite3.Error as error:
        out |= {"ok": False, "error": str(error)[:120]}
    return out


def newest_entry(directory: str, glob: str = "*") -> dict:
    """Backup directories: how many entries, the newest one's name/time/size. Never opens content."""
    d = Path(directory)
    try:
        entries = sorted(d.glob(glob), key=lambda e: e.stat().st_mtime)
    except OSError as error:
        return {"ok": False, "error": type(error).__name__}
    if not entries:
        return {"ok": False, "count": 0}
    last = entries[-1]
    size = last.stat().st_size if last.is_file() else sum(f.stat().st_size for f in last.rglob("*") if f.is_file())
    out = {"ok": True, "count": len(entries), "newest": last.name, "modified": last.stat().st_mtime, "bytes": size}
    manifest = last / "manifest.json" if last.is_dir() else None
    if manifest and manifest.exists():
        try:
            m = json.loads(manifest.read_text(encoding="utf-8"))
            out["manifest_files"] = len(m.get("files", {}))
            out["manifest_created_at"] = m.get("created_at")
        except (OSError, ValueError):
            out["manifest_error"] = True
    return out
