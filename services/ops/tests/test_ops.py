"""Agent + hub over real loopback HTTP, with temporary files only. No FRP, no remote server, no LAB data.

Run: python -X utf8 services/ops/tests/test_ops.py   (stdlib unittest, like the other regression suites)
"""
from __future__ import annotations

import json
import socket
import sqlite3
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import contextlib
import inspect
import shutil
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from opsnode import agent, alerts, auth, hub, probes, supervise  # noqa: E402

TOKEN = "test-token-for-hub"


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def get(url, token=None, method="GET"):
    req = urllib.request.Request(url, method=method, headers={"Authorization": "Bearer " + token} if token else {})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(req, timeout=5) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


class FakeLab(BaseHTTPRequestHandler):
    """Stands in for LAB's gateway: /healthz, /api/login (monitor code), /api/monitor (cookie)."""
    def log_message(self, *a): pass

    def _j(self, code, body, cookie=None):
        data = json.dumps(body).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json")
        if cookie: self.send_header("Set-Cookie", cookie)
        self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)

    def do_GET(self):
        if self.path == "/healthz":
            return self._j(200, {"ok": True, "version": "lab-test"})
        if self.path == "/api/monitor":
            if "lab_session=s1" not in (self.headers.get("Cookie") or ""):
                return self._j(403, {"error": "forbidden"})
            return self._j(200, {"hub": {"online": 3, "spaces": {"hall": 3}, "uptime_s": 9}, "server_version": "lab-test"})
        self._j(404, {})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if self.path == "/api/login" and body.get("code") == "MONCODE":
            return self._j(200, {"ok": True}, "lab_session=s1; Path=/; HttpOnly")
        self._j(401, {"error": "invalid"})


def make_world(tmp_path):
    lab_port = free_port()
    lab_srv = ThreadingHTTPServer(("127.0.0.1", lab_port), FakeLab)
    threading.Thread(target=lab_srv.serve_forever, daemon=True).start()
    (tmp_path / "readers.json").write_text(json.dumps({"readers": {"hub": auth.digest(TOKEN)}}))
    (tmp_path / "token").write_text(TOKEN)
    (tmp_path / "moncode").write_text("cid123\tMONCODE\tlab-monitor\n")   # labctl --out format
    (tmp_path / "state").mkdir()
    (tmp_path / "state" / "supervisor.json").write_text(json.dumps({
        "phase": "running", "updated": time.time() + 3600, "version": "lab-test",
        "children": {"gateway": {"alive": True, "failed": False}, "r4": {"alive": True, "failed": False}}}))
    db = tmp_path / "lab.sqlite"; sqlite3.connect(db).execute("create table t(x)").connection.commit()
    (tmp_path / "backups" / "20261107T000000").mkdir(parents=True)
    (tmp_path / "backups" / "20261107T000000" / "manifest.json").write_text(json.dumps({"created_at": 1, "files": {"lab.sqlite": {}}}))
    (tmp_path / "gateway.log").write_text("ok\nERROR password=hunter2 from 10.1.2.3\nfine\n")
    a_port = free_port()
    cfg = {"node": "pc", "label": "Windows C", "listen": f"127.0.0.1:{a_port}", "interval_s": 5,
           "readers_file": str(tmp_path / "readers.json"), "disks": [str(tmp_path)],
           "ports": [{"name": "lab-gateway", "port": lab_port}, {"name": "closed", "port": free_port()}],
           "logs": [{"path": str(tmp_path / "gateway.log")}], "databases": [{"path": str(db), "quick_check": True}],
           "backups": [{"name": "lab", "dir": str(tmp_path / "backups"), "max_age_hours": 48}],
           "lab": {"base": f"http://127.0.0.1:{lab_port}", "supervisor_json": str(tmp_path / "state" / "supervisor.json"),
                   "monitor_code_file": str(tmp_path / "moncode")}}
    (tmp_path / "agent.json").write_text(json.dumps(cfg))
    a_srv = agent.serve(agent.load_config(str(tmp_path / "agent.json")))
    threading.Thread(target=a_srv.serve_forever, daemon=True).start()
    for _ in range(100):
        if a_srv.collector.current().get("collected_at"):
            break
        time.sleep(0.05)
    h_port = free_port()
    hcfg = {"listen": f"127.0.0.1:{h_port}", "state_dir": str(tmp_path / "hub"), "readers_file": str(tmp_path / "readers.json"),
            "nodes": [{"name": "pc", "url": f"http://127.0.0.1:{a_port}", "token_file": str(tmp_path / "token")},
                      {"name": "hk", "url": f"http://127.0.0.1:{free_port()}", "token_file": str(tmp_path / "token"), "timeout": 1},
                      {"name": "wired-wrong", "expect_node": "b", "url": f"http://127.0.0.1:{a_port}", "token_file": str(tmp_path / "token")}]}
    (tmp_path / "hub").mkdir()
    h = hub.serve(_hub_cfg(hcfg), start_polling=False)
    threading.Thread(target=h.serve_forever, daemon=True).start()
    return {"agent": f"http://127.0.0.1:{a_port}", "hub": f"http://127.0.0.1:{h_port}", "hubobj": h.hub, "tmp": tmp_path,
            "servers": (lab_srv, a_srv, h)}


@contextlib.contextmanager
def raises(exc):
    try:
        yield
    except exc:
        return
    raise AssertionError(f"{exc.__name__} not raised")


def _hub_cfg(c):
    host, _, port = c["listen"].rpartition(":")
    return c | {"_host": host, "_port": int(port)}


def case_agent_requires_token_and_is_read_only(world):
    assert get(world["agent"] + "/v1/health") == (200, {"ok": True, "node": "pc"})
    assert get(world["agent"] + "/v1/status")[0] == 401
    assert get(world["agent"] + "/v1/status", "wrong")[0] == 401
    assert get(world["agent"] + "/v1/status", TOKEN, method="POST")[0] == 405
    assert get(world["agent"] + "/v1/status/../../etc/passwd", TOKEN)[0] == 404


def case_agent_snapshot_content(world):
    code, s = get(world["agent"] + "/v1/status", TOKEN)
    assert code == 200 and s["node"] == "pc"
    assert s["ports"]["lab-gateway"]["ok"] and not s["ports"]["closed"]["ok"]
    assert s["system"]["memory"]["total_mb"] > 0 and s["system"]["disks"][0]["free_gb"] >= 0
    assert s["databases"][0]["ok"] and s["databases"][0]["quick_check"] == "ok"
    assert s["backups"]["lab"]["ok"] and s["backups"]["lab"]["manifest_files"] == 1
    log = s["logs"][0]
    assert log["error_lines"] == 1 and "hunter2" not in json.dumps(log) and "10.1.x.x" in log["last_errors"][0]
    lab = s["lab"]
    assert lab["health"]["ok"] and lab["supervisor"]["ok"]
    assert lab["monitor"]["ok"] and lab["monitor"]["online"] == 3


def case_failed_auth_is_throttled_but_never_locks_out_the_hub(world):
    for _ in range(12):
        get(world["agent"] + "/v1/status", "bad")
    assert get(world["agent"] + "/v1/status", "bad")[0] == 429
    assert get(world["agent"] + "/v1/status", TOKEN)[0] == 200     # behind STCP every peer is 127.0.0.1


def case_hub_aggregates_marks_offline_and_rejects_miswired_node(world):
    h = world["hubobj"]
    for n in h.cfg["nodes"]:
        h.poll_node(n)
    h.save()
    code, s = get(world["hub"] + "/v1/summary", TOKEN)
    assert code == 200
    by = {n["node"]: n for n in s["nodes"]}
    assert by["pc"]["reachable"] and by["pc"]["lab"]["online"] == 3
    assert not by["hk"]["reachable"] and by["hk"]["alerts"][0]["code"] == "node_unreachable"
    assert not by["wired-wrong"]["reachable"] and "node_mismatch" in by["wired-wrong"]["error"]
    codes = {a["code"] for a in by["pc"]["alerts"]}
    assert "port_down" in codes and "log_errors" in codes
    assert get(world["hub"] + "/v1/summary")[0] == 401
    assert get(world["hub"] + "/v1/nodes/pc", TOKEN)[1]["snapshot"]["node"] == "pc"
    assert get(world["hub"] + "/v1/nodes/nope", TOKEN)[0] == 404
    assert get(world["hub"] + "/v1/summary", TOKEN, method="DELETE")[0] == 405
    on_disk = (world["tmp"] / "hub" / "hub-state.json").read_text()
    assert "last_errors" not in on_disk and '"tail"' not in on_disk     # no log lines persisted
    # a hub restart keeps the last snapshot but never claims the node is still reachable
    h2 = hub.Hub(h.cfg)
    assert h2.nodes["pc"]["snapshot"]["node"] == "pc" and h2.nodes["pc"]["reachable"] is False


def case_node_going_away_keeps_last_snapshot(world):
    h = world["hubobj"]
    pc = h.cfg["nodes"][0]
    h.poll_node(pc)
    good = h.nodes["pc"]["snapshot"]["collected_at"]
    h.poll_node(pc | {"url": f"http://127.0.0.1:{free_port()}", "timeout": 1})
    e = h.nodes["pc"]
    assert e["reachable"] is False and e["snapshot"]["collected_at"] == good


def case_loopback_only(tmp_path):
    (tmp_path / "a.json").write_text(json.dumps({"node": "pc", "listen": "0.0.0.0:18410"}))
    with raises(SystemExit):
        agent.load_config(str(tmp_path / "a.json"))
    (tmp_path / "h.json").write_text(json.dumps({"listen": "0.0.0.0:18420", "nodes": [{"name": "x"}]}))
    with raises(SystemExit):
        hub.load_config(str(tmp_path / "h.json"))


def case_plaintext_tokens_rejected(tmp_path):
    (tmp_path / "r.json").write_text(json.dumps({"readers": {"hub": "plain-token"}}))
    with raises(SystemExit):
        auth.Readers(tmp_path / "r.json")
    (tmp_path / "r.json").write_text(json.dumps({"readers": {}}))
    with raises(SystemExit):
        auth.Readers(tmp_path / "r.json")


def case_alert_rules():
    now = time.time()
    snap = {"collected_at": now - 500, "system": {"cpu_percent": 95, "memory": {"percent": 50},
                                                  "disks": [{"path": "/", "used_percent": 97}]},
            "systemd": {"iridescently-runtime.service": {"ActiveState": "failed"}},
            "frpc": {"ok": False, "proxies": [{"name": "hk.agent", "status": "start error"}]},
            "backups": {"db": {"ok": True, "modified": now - 72 * 3600, "max_age_hours": 26}},
            "hk_release": {"ok": False, "services": {"iridescently-runtime": "inactive"}, "drift": None}}
    codes = {a["code"] for a in alerts.evaluate("hk", {"reachable": True, "snapshot": snap}, now=now)}
    assert {"snapshot_stale", "cpu_high", "disk_full", "unit_inactive", "frpc_unhealthy", "backup_old",
            "hk_service_inactive"} <= codes
    assert alerts.evaluate("b", {"reachable": False, "error": "timeout"})[0]["code"] == "node_unreachable"


def case_supervisor_restart_is_bounded(tmp_path):
    c = supervise.Child("x", [sys.executable, "-c", "raise SystemExit(3)"], str(tmp_path), tmp_path / "x.log")
    said = []
    now = time.time()
    for i in range(40):
        supervise.step([c], now, said.append)
        if c.proc:
            c.proc.wait(10)
        now += 31                       # jump past any backoff, but stay inside the 10-minute window
        if c.failed:
            break
    assert c.failed and len(c.starts) == supervise.MAX_STARTS
    assert any("FAILED" in s for s in said)


def case_redact():
    line = 'token=abc123 Authorization: Bearer xyz.pqr password: "p@ss" ip 192.168.1.4'
    r = probes.redact(line)
    assert "abc123" not in r and "xyz.pqr" not in r and "p@ss" not in r and "192.168.x.x" in r


def case_second_agent_cannot_take_over_the_port(world, tmp_path):
    cfg = json.loads((world["tmp"] / "agent.json").read_text())
    (tmp_path / "dup.json").write_text(json.dumps(cfg))
    with raises(OSError):
        agent.serve(agent.load_config(str(tmp_path / "dup.json")))


def case_hub_rejects_unsigned_or_wrongly_signed_answers(world, tmp_path):
    """An impostor that knows the STCP name but not this node's reader digest cannot feed the hub."""
    class Impostor(BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def do_GET(self):
            body = json.dumps({"node": "pc", "collected_at": time.time()}).encode()
            self.send_response(200)
            self.send_header("X-Ops-Signature", auth.sign(auth.digest("some-other-token"), self.headers.get("X-Ops-Nonce", ""), body))
            self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    port = free_port()
    srv = ThreadingHTTPServer(("127.0.0.1", port), Impostor)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    h = world["hubobj"]
    h.poll_node({"name": "pc", "url": f"http://127.0.0.1:{port}", "token_file": str(world["tmp"] / "token")})
    srv.shutdown()
    assert h.nodes["pc"]["reachable"] is False and h.nodes["pc"]["error"] == "bad_signature"


def case_hk_release_reads_files_only(tmp_path):
    from opsnode import hkrelease
    rid = "20261106T193857268Z-02d6e6b9b014-c9e2ac27ace4"
    rel = tmp_path / "rt" / "production" / "releases"
    (rel / "store" / rid).mkdir(parents=True); (rel / "channels").mkdir()
    (rel / "channels" / "production.json").write_text(json.dumps({"current": rid, "previous": None, "sourceHead": "02d6e6b"}))
    (tmp_path / "next.json").write_text(json.dumps({"schema": 1, "storageRoot": str(tmp_path / "rt"), "environment": "production",
                                                   "layout": "channel", "units": []}))
    before = sorted(p.relative_to(tmp_path).as_posix() for p in tmp_path.rglob("*"))
    s = hkrelease.status(str(tmp_path / "next.json"))
    assert s["current"] == rid and s["drift"] is None and s["releases"] == 1
    assert sorted(p.relative_to(tmp_path).as_posix() for p in tmp_path.rglob("*")) == before   # nothing written
    assert hkrelease.status(str(tmp_path / "missing.json"))["ok"] is False


def case_production_database_is_never_opened(tmp_path):
    db = tmp_path / "users.db"
    sqlite3.connect(db).execute("create table t(x)").connection.commit()
    m = probes.file_meta(str(db))
    assert m["ok"] and m["stat_only"] and "user_version" not in m
    assert not (tmp_path / "users.db-shm").exists() and not (tmp_path / "users.db-wal").exists()


class OpsTests(unittest.TestCase):
    """Each case_* function becomes a test; `world` and `tmp_path` are built per test and torn down."""

    def run_case(self, fn):
        tmp = Path(tempfile.mkdtemp(prefix="ops-test-"))
        world = None
        try:
            kwargs = {}
            for name in inspect.signature(fn).parameters:
                if name == "world":
                    (tmp / "w").mkdir()
                    world = kwargs["world"] = make_world(tmp / "w")
                elif name == "tmp_path":
                    (tmp / "t").mkdir()
                    kwargs["tmp_path"] = tmp / "t"
            fn(**kwargs)
        finally:
            for s in (world or {}).get("servers", ()):
                s.shutdown(); s.server_close()
            shutil.rmtree(tmp, ignore_errors=True)


for _name, _fn in list(globals().items()):
    if _name.startswith("case_") and callable(_fn):
        setattr(OpsTests, "test_" + _name[5:], (lambda f: lambda self: self.run_case(f))(_fn))
del _name, _fn   # otherwise _fn is left bound to OpsTests and unittest runs every test twice


if __name__ == "__main__":
    unittest.main(verbosity=2)
