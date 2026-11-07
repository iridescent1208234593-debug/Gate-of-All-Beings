"""Unified read-only operations API on B. Polls the three agents and FRPS, keeps the last snapshot per node.

    python -m opsnode.hub --config <hub.json>

Listens on 127.0.0.1 only (default 18420); operators reach it with an SSH port forward to B, never
through a public port. Readers authenticate with bearer tokens (sha256 digests in readers_file).

Endpoints (GET only):
  /v1/health            no auth; {"ok": true}
  /v1/summary           every node: reachable, last seen, key numbers, alerts
  /v1/nodes/<name>      the full last snapshot of one node
  /v1/alerts            all current alerts
  /v1/frps              FRPS dashboard view: which frpc clients and STCP proxies are online

A node that stops answering is only marked unreachable. The hub never deletes data, never resets
anything and never acts on a node; it keeps the last good snapshot and its time on disk so a hub
restart shows the same picture.
"""
from __future__ import annotations

import argparse
import hmac
import secrets
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import VERSION, alerts, probes
from .agent import LOOPBACK, ExclusiveServer
from .auth import FailureLimiter, Readers, digest, sign


def _read(path: str | None) -> str:
    return Path(path).read_text(encoding="utf-8").strip() if path else ""


def summarize(name: str, entry: dict) -> dict:
    s = entry.get("snapshot") or {}
    sysm = s.get("system", {})
    out = {"node": name, "label": entry.get("label", name), "reachable": entry.get("reachable", False),
           "last_ok": entry.get("last_ok"), "last_try": entry.get("last_try"), "error": entry.get("error"),
           "agent_version": s.get("agent_version"), "cpu_percent": sysm.get("cpu_percent"),
           "mem_percent": sysm.get("memory", {}).get("percent"),
           "disks": [{k: d.get(k) for k in ("path", "free_gb", "used_percent")} for d in sysm.get("disks", [])],
           "net": {k: sysm.get("network", {}).get(k) for k in ("sent_kbps", "recv_kbps")},
           "uptime_s": sysm.get("uptime_s"),
           "frpc_ok": (s.get("frpc") or {}).get("ok") if s.get("frpc") is not None else None,
           "version": s.get("version")}
    if s.get("lab"):
        m = s["lab"].get("monitor", {})
        out["lab"] = {"gateway_ok": s["lab"].get("health", {}).get("ok"), "supervisor_ok": s["lab"].get("supervisor", {}).get("ok"),
                      "online": m.get("online"), "spaces": m.get("spaces"), "server_version": m.get("server_version")}
    rel = s.get("hk_release")
    if rel:
        out["hk_release"] = {k: rel.get(k) for k in ("current", "previous", "services", "drift", "environment")}
    out["alerts"] = alerts.evaluate(name, entry)
    return out


def strip_for_disk(entry: dict) -> dict:
    """The on-disk state keeps numbers and states only: no log lines (even redacted) leave memory."""
    e = json.loads(json.dumps(entry, default=str))
    for lg in (e.get("snapshot") or {}).get("logs", []):
        lg.pop("tail", None)
        lg.pop("last_errors", None)
    return e


class Hub:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.interval = max(5, int(cfg.get("interval_s", 20)))
        self.state_file = Path(cfg["state_dir"]) / "hub-state.json"
        self.nodes: dict[str, dict] = {}
        self.frps: dict = {}
        self.lock = threading.Lock()
        try:
            saved = json.loads(self.state_file.read_text(encoding="utf-8"))
            for n, e in saved.get("nodes", {}).items():
                self.nodes[n] = e | {"reachable": False, "error": "hub_restarted"}
        except (OSError, ValueError):
            pass

    def poll_node(self, node: dict) -> None:
        name = node["name"]
        entry = dict(self.nodes.get(name, {}))
        entry.update(label=node.get("label", name), last_try=time.time())
        try:
            tok = _read(node["token_file"])
            nonce = secrets.token_hex(16)
            status, body, sig = probes.http_get(node["url"].rstrip("/") + "/v1/status", node.get("timeout", 8),
                                                headers={"Authorization": "Bearer " + tok, "X-Ops-Nonce": nonce},
                                                want_header="X-Ops-Signature")
            if status != 200:
                raise RuntimeError(f"http_{status}")
            # The answer must be signed with this node's reader digest over our fresh nonce: an impostor
            # that registered the same STCP name, or a replayed answer, cannot produce it.
            if not hmac.compare_digest(sig or "", sign(digest(tok), nonce, body)):
                raise RuntimeError("bad_signature")
            snap = json.loads(body)
            if snap.get("node") != node.get("expect_node", name):   # a mis-wired visitor port must not pass as another node
                raise RuntimeError(f"node_mismatch:{snap.get('node')}")
            entry.update(reachable=True, last_ok=time.time(), snapshot=snap, error=None)
        except Exception as error:  # noqa: BLE001
            entry.update(reachable=False, error=str(error)[:120] or type(error).__name__)
        with self.lock:
            self.nodes[name] = entry

    def poll_frps(self) -> None:
        f = self.cfg.get("frps")
        if not f:
            return
        out = {"checked_at": time.time()}
        try:
            auth = (f.get("user", "admin"), _read(f.get("password_file")))
            status, body = probes.http_get(f["url"].rstrip("/") + "/api/serverinfo", 4, auth=auth)
            info = json.loads(body) if status == 200 else {}
            out["server"] = {k: info.get(k) for k in ("version", "bindPort", "clientCounts", "curConns", "proxyTypeCount")}
            status, body = probes.http_get(f["url"].rstrip("/") + "/api/proxy/stcp", 4, auth=auth)
            data = json.loads(body) if status == 200 else {}
            out["stcp"] = [{"name": p.get("name"), "status": p.get("status"), "last_start": p.get("lastStartTime"),
                            "last_close": p.get("lastCloseTime"), "conns": p.get("curConns")}
                           for p in (data.get("proxies") or [])]
            out["ok"] = bool(info)
        except Exception as error:  # noqa: BLE001
            out |= {"ok": False, "error": type(error).__name__}
        with self.lock:
            self.frps = out

    def save(self) -> None:
        with self.lock:
            data = {"saved_at": time.time(), "nodes": {n: strip_for_disk(e) for n, e in self.nodes.items()}}
        tmp = self.state_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, default=str), encoding="utf-8")
        os.replace(tmp, self.state_file)

    def run(self):
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        while True:
            threads = [threading.Thread(target=self.poll_node, args=(n,), daemon=True) for n in self.cfg["nodes"]]
            threads.append(threading.Thread(target=self.poll_frps, daemon=True))
            for t in threads:
                t.start()
            for t in threads:
                t.join(30)
            try:
                self.save()
            except OSError:
                pass
            time.sleep(self.interval)

    def view(self, what: str, arg: str = ""):
        with self.lock:
            nodes = {k: dict(v) for k, v in self.nodes.items()}
            frps = dict(self.frps)
        if what == "summary":
            s = [summarize(n, e) for n, e in nodes.items()]
            return {"hub_version": VERSION, "generated_at": time.time(), "nodes": s, "frps_ok": frps.get("ok"),
                    "alert_count": sum(len(x["alerts"]) for x in s)}
        if what == "node":
            return nodes.get(arg)
        if what == "alerts":
            return {"alerts": [a for n, e in nodes.items() for a in alerts.evaluate(n, e)]}
        if what == "frps":
            return frps
        return None


def make_handler(hub: Hub, readers: Readers, limiter: FailureLimiter):
    class Handler(BaseHTTPRequestHandler):
        server_version = "opshub"
        sys_version = ""

        def log_message(self, fmt, *args):
            pass

        def _send(self, code, body):
            data = json.dumps(body, ensure_ascii=False, default=str).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):  # noqa: N802
            if self.path == "/v1/health":
                return self._send(200, {"ok": True})
            peer = self.client_address[0]
            who = readers.who(self.headers.get("Authorization"))
            if not who:   # failures are throttled; a valid token is never locked out by someone else's failures
                if limiter.blocked(peer):
                    return self._send(429, {"error": "too_many_failures"})
                limiter.fail(peer)
                return self._send(401, {"error": "unauthorized"})
            parts = [p for p in self.path.split("?")[0].split("/") if p]
            if parts[:2] == ["v1", "summary"] and len(parts) == 2:
                body = hub.view("summary")
            elif parts[:2] == ["v1", "nodes"] and len(parts) == 3:
                body = hub.view("node", parts[2])
            elif parts == ["v1", "alerts"]:
                body = hub.view("alerts")
            elif parts == ["v1", "frps"]:
                body = hub.view("frps")
            else:
                body = None
            return self._send(200, body) if body is not None else self._send(404, {"error": "not_found"})

        def _deny(self):
            self._send(405, {"error": "read_only"})

        do_POST = do_PUT = do_DELETE = do_PATCH = _deny  # noqa: N815

    return Handler


def load_config(path: str) -> dict:
    cfg = json.loads(Path(path).read_text(encoding="utf-8"))
    host, _, port = cfg.get("listen", "127.0.0.1:18420").rpartition(":")
    if host not in LOOPBACK:
        raise SystemExit("the hub binds loopback only; reach it with `ssh -L 18420:127.0.0.1:18420 <B>`")
    cfg["_host"], cfg["_port"] = host, int(port)
    names = [n["name"] for n in cfg.get("nodes", [])]
    if len(names) != len(set(names)) or not names:
        raise SystemExit("nodes: names must be present and unique")
    return cfg


def serve(cfg: dict, start_polling: bool = True) -> ThreadingHTTPServer:
    hub = Hub(cfg)
    if start_polling:
        threading.Thread(target=hub.run, daemon=True, name="poller").start()
    httpd = ExclusiveServer((cfg["_host"], cfg["_port"]), make_handler(hub, Readers(cfg["readers_file"]), FailureLimiter()))
    httpd.hub = hub  # type: ignore[attr-defined]
    return httpd


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", required=True)
    serve(load_config(ap.parse_args().config)).serve_forever()


if __name__ == "__main__":
    main()
