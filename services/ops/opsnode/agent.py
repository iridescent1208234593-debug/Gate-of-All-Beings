"""Read-only node agent. One per node (hk = A, b = B, pc = C), bound to 127.0.0.1 only.

    python -m opsnode.agent --config <agent.json>

The hub reaches remote agents through FRP STCP (visitor ports on B's loopback); nothing is exposed on a
public interface. GET only: /v1/health (no auth, no data) and /v1/status (bearer token). Probes run on
a fixed interval in a background thread, so requests never trigger work and cannot be used to load the
node. The config lists exactly what is probed; nothing in a request can choose a path, URL or command.
"""
from __future__ import annotations

import argparse
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import VERSION, hkrelease, probes, system
from .auth import FailureLimiter, Readers, sign
from .lab import LabProbe

LOOPBACK = {"127.0.0.1", "::1", "localhost"}


class ExclusiveServer(ThreadingHTTPServer):
    """No SO_REUSEADDR: on Windows it lets a second process bind the same port and take over its traffic.
    With SO_EXCLUSIVEADDRUSE a second agent (or anything else) fails to start instead of hijacking it."""
    allow_reuse_address = False
    daemon_threads = True

    def server_bind(self):
        import socket
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def load_config(path: str) -> dict:
    cfg = json.loads(Path(path).read_text(encoding="utf-8"))
    host, _, port = cfg.get("listen", "127.0.0.1:18410").rpartition(":")
    if host not in LOOPBACK:
        raise SystemExit(f"listen {host!r}: agents bind loopback only; remote access goes through FRP STCP")
    cfg["_host"], cfg["_port"] = host, int(port)
    if cfg.get("node") not in ("hk", "b", "pc"):
        raise SystemExit("node must be one of hk, b, pc")
    base = Path(path).resolve().parent
    cfg["_base"] = base
    return cfg


def _secret(cfg: dict, key: str) -> str | None:
    f = cfg.get(key)
    if not f:
        return None
    try:
        return Path(f).read_text(encoding="utf-8").strip()
    except OSError:
        return None


def deployed_version(spec: dict) -> dict:
    out = {}
    for f in spec.get("files", []):                       # e.g. HK channel pointer, release.json, build-info.json
        p = Path(f)
        try:
            text = p.read_text(encoding="utf-8")[:4000]
            try:
                data = json.loads(text)
                text = {k: data[k] for k in ("id", "version", "sourceHead", "release", "created_at", "built_at") if k in data} or "json"
            except ValueError:
                text = text.strip().splitlines()[0][:200] if text.strip() else ""
            out[p.name] = {"value": text, "modified": p.stat().st_mtime}
        except OSError as error:
            out[p.name] = {"error": type(error).__name__}
    return out


class Collector:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.interval = max(5, int(cfg.get("interval_s", 15)))
        self.lab = LabProbe(cfg["lab"]) if cfg.get("lab") else None
        self.snapshot: dict = {"node": cfg["node"], "phase": "starting"}
        self.lock = threading.Lock()

    def collect(self) -> dict:
        c = self.cfg
        t0 = time.time()
        snap = {"node": c["node"], "label": c.get("label", c["node"]), "agent_version": VERSION, "collected_at": t0,
                "system": system.snapshot(c.get("disks", ["/"])),
                "ports": {p["name"]: probes.tcp(p.get("host", "127.0.0.1"), int(p["port"])) for p in c.get("ports", [])},
                "http": {h["name"]: probes.http_check(h["url"], int(h.get("expect", 200))) for h in c.get("http", [])},
                "processes": probes.processes(c.get("processes", [])) if c.get("processes") else {},
                "systemd": probes.systemd_units(c.get("systemd", [])),
                "logs": [probes.log_tail(l["path"], l.get("patterns", ["error", "fatal", "traceback", "exception"]),
                                         int(l.get("tail_lines", 0))) for l in c.get("logs", [])],
                "databases": [probes.file_meta(d["path"]) if d.get("stat_only") else
                              probes.sqlite_meta(d["path"], bool(d.get("quick_check"))) for d in c.get("databases", [])],
                "backups": {b["name"]: probes.newest_entry(b["dir"], b.get("glob", "*")) | {"max_age_hours": b.get("max_age_hours")}
                            for b in c.get("backups", [])},
                "version": deployed_version(c.get("version", {}))}
        if c.get("frpc"):
            f = c["frpc"]
            snap["frpc"] = probes.frpc_status(f.get("url", "http://127.0.0.1:7400"), f.get("user", "admin"),
                                              _secret(f, "password_file") or "")
        if c.get("hk_release"):
            snap["hk_release"] = hkrelease.status(c["hk_release"].get("control_config", "/srv/iridescently/control/next.json"))
        if self.lab:
            snap["lab"] = self.lab.collect()
        snap["collect_ms"] = round((time.time() - t0) * 1000)
        return snap

    def run(self):
        system.prime()
        while True:
            try:
                snap = self.collect()
            except Exception as error:  # noqa: BLE001 - a broken probe must not stop the agent
                snap = {"node": self.cfg["node"], "phase": "collect_error", "error": type(error).__name__,
                        "collected_at": time.time()}
            with self.lock:
                self.snapshot = snap
            time.sleep(self.interval)

    def current(self) -> dict:
        with self.lock:
            return dict(self.snapshot)


def make_handler(collector: Collector, readers: Readers, limiter: FailureLimiter):
    class Handler(BaseHTTPRequestHandler):
        server_version = "opsnode"
        sys_version = ""

        def log_message(self, fmt, *args):  # no request logging to stderr; the hub records reads
            pass

        def _send(self, code: int, body: dict, key: str | None = None):
            data = json.dumps(body, ensure_ascii=False, default=str).encode("utf-8")
            self.send_response(code)
            if key:   # proves to the hub that this answer comes from the holder of this node's reader digest
                self.send_header("X-Ops-Signature", sign(key, self.headers.get("X-Ops-Nonce", ""), data))
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):  # noqa: N802
            peer = self.client_address[0]
            if self.path == "/v1/health":
                return self._send(200, {"ok": True, "node": collector.cfg["node"]})
            if self.path != "/v1/status":
                return self._send(404, {"error": "not_found"})
            who = readers.who(self.headers.get("Authorization"))
            if who:   # a valid token is never locked out (behind STCP every peer is 127.0.0.1)
                return self._send(200, collector.current(), readers.readers[who])
            if limiter.blocked(peer):
                return self._send(429, {"error": "too_many_failures"})
            limiter.fail(peer)
            return self._send(401, {"error": "unauthorized"})

        def _deny(self):
            self._send(405, {"error": "read_only"})

        do_POST = do_PUT = do_DELETE = do_PATCH = _deny  # noqa: N815

    return Handler


def serve(cfg: dict) -> ThreadingHTTPServer:
    readers = Readers(cfg["readers_file"])
    collector = Collector(cfg)
    threading.Thread(target=collector.run, daemon=True, name="collector").start()
    httpd = ExclusiveServer((cfg["_host"], cfg["_port"]), make_handler(collector, readers, FailureLimiter()))
    httpd.collector = collector  # type: ignore[attr-defined]
    return httpd


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", required=True)
    args = ap.parse_args()
    httpd = serve(load_config(args.config))
    httpd.serve_forever()


if __name__ == "__main__":
    main()
