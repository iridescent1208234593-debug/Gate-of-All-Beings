"""Windows LAB V2 status through the interfaces LAB already has, with LAB's own least privilege.

* `state/supervisor.json` - written every second by LAB's supervisor (children, pids, restarts, failed).
* `GET /healthz`          - gateway liveness and version, no data.
* `GET /api/monitor`      - LAB's existing read-only "monitor" role: online count, spaces, tick times, R4.
  The agent logs in with a monitor-role test code (created by the owner with
  `labctl.py code-create --role monitor --out <secrets>`). The admin console (18302) is not used:
  its password is a write credential and it is pinned to a browser session.
"""
from __future__ import annotations

import json
import time
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

from . import probes


class LabProbe:
    LOGIN_BACKOFF = 600  # a rejected code is retried after 10 minutes, so the agent cannot trip LAB's lockout

    def __init__(self, cfg: dict):
        self.base = cfg.get("base", "http://127.0.0.1:18300").rstrip("/")
        self.supervisor_json = cfg.get("supervisor_json")
        self.code_file = cfg.get("monitor_code_file")
        self.backup_dir = cfg.get("backup_dir")
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}),
                                                  urllib.request.HTTPCookieProcessor(self.jar))
        self.next_login = 0.0
        self.login_error = None

    def _code(self) -> str | None:
        if not self.code_file:
            return None
        try:
            text = Path(self.code_file).read_text(encoding="utf-8").strip()
        except OSError:
            return None
        # `labctl.py code-create --out` writes "code_id<TAB>code<TAB>label" lines; a bare code is accepted too.
        if not text:
            return None
        fields = text.splitlines()[0].split("\t")
        return fields[1].strip() if len(fields) >= 2 else fields[0].strip()

    def _request(self, path: str, body: dict | None = None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data,
                                     headers={"Content-Type": "application/json"} if data else {})
        try:
            with self.opener.open(req, timeout=4) as resp:
                return resp.status, json.loads(resp.read(1_000_000) or b"{}")
        except urllib.error.HTTPError as error:
            return error.code, {}

    def _login(self) -> bool:
        code = self._code()
        if not code:
            self.login_error = "no_monitor_code"
            return False
        if time.time() < self.next_login:
            return False
        status, data = self._request("/api/login", {"code": code})
        if status == 200:
            self.login_error = None
            return True
        self.login_error = data.get("error") or f"http_{status}"
        self.next_login = time.time() + self.LOGIN_BACKOFF
        return False

    def monitor(self) -> dict:
        try:
            status, data = self._request("/api/monitor")
            if status in (401, 403) and self._login():
                status, data = self._request("/api/monitor")
        except Exception as error:  # noqa: BLE001
            return {"ok": False, "error": type(error).__name__}
        if status != 200:
            return {"ok": False, "status": status, "login_error": self.login_error}
        hub = data.get("hub", {})
        r4 = data.get("r4") or {}
        branches = r4.get("branches") or {}
        r4 = {"enabled": r4.get("enabled"), "online": r4.get("online"), "last_ok": r4.get("last_ok"),
              "error": r4.get("error"), "revision": r4.get("revision"), "branches": len(branches),
              "runner_errors": sorted({b.get("runner", {}).get("error") for b in branches.values()} - {None, ""})}
        return {"ok": True, "online": hub.get("online"), "spaces": hub.get("spaces"), "uptime_s": hub.get("uptime_s"),
                "tick_ms_p50": hub.get("tick_ms_p50"), "tick_ms_p99": hub.get("tick_ms_p99"),
                "r4": r4, "server_version": data.get("server_version"),
                "client_version": data.get("client_version")}

    def supervisor(self) -> dict:
        if not self.supervisor_json:
            return {"ok": False, "error": "not_configured"}
        try:
            data = json.loads(Path(self.supervisor_json).read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            return {"ok": False, "error": type(error).__name__}
        age = time.time() - float(data.get("updated", 0))
        children = data.get("children", {})
        return {"ok": data.get("phase") == "running" and age < 30 and not any(c.get("failed") for c in children.values())
                      and all(c.get("alive") for c in children.values()),
                "phase": data.get("phase"), "age_s": round(age, 1), "version": data.get("version"), "children": children}

    def collect(self) -> dict:
        out = {"health": probes.http_check(self.base + "/healthz"), "supervisor": self.supervisor(),
               "monitor": self.monitor()}
        if self.backup_dir:
            out["backups"] = probes.newest_entry(self.backup_dir)
        return out
