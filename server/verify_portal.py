#!/usr/bin/env python
"""本地统一入口自检：拉起 portal_server，按 Host 校验三站关键端点后关闭。

用法：python server/verify_portal.py      （默认 PORT=8080）
"""
import http.client
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

PORT = int(os.environ.get("PORT", "8080"))
HERE = Path(__file__).resolve().parent

CHECKS = [
    ("iridescently.xyz", "/", 200),
    ("iridescently.xyz", "/connections.html", 200),
    ("iridescently.xyz", "/styles/connections.css", 200),
    ("iridescently.xyz", "/scripts/connections.js", 200),
    ("iridescently.xyz", "/api/sso-user", 200),
    ("huiguan.iridescently.xyz", "/", 200),
    ("huiguan.iridescently.xyz", "/design-system/ui/lxh-ui.css", 200),
    ("huiguan.iridescently.xyz", "/design-system/design-system.css", 200),
    ("huiguan.iridescently.xyz", "/api/official/characters?limit=1", 200),
    ("huiguan.iridescently.xyz", "/api/assets/manifest", 200),
    ("oc.iridescently.xyz", "/", 200),
    ("oc.iridescently.xyz", "/api/sso-user", 200),
    ("iridescently.xyz", "/app/shell/", 200),
    ("iridescently.xyz", "/app/portal.json", 200),
    ("iridescently.xyz", "/app/modules/management/", 200),
    ("iridescently.xyz", "/app/modules/ecology/", 200),
    ("iridescently.xyz", "/app/modules/cards/", 200),
    ("iridescently.xyz", "/app/modules/softie/", 200),
    ("spirit.iridescently.xyz", "/games/spirit-playground?room=forest", 200),
    ("spirit.iridescently.xyz", "/api/sso-user", 200),
    ("iridescently.xyz", "/app/modules/juling/", 200),
    ("iridescently.xyz", "/app/modules/slay/", 200),
    ("iridescently.xyz", "/app/modules/aeon/", 200),
    ("iridescently.xyz", "/management/index.html", 200),
    ("iridescently.xyz", "/ecology/index.html", 200),
    ("iridescently.xyz", "/shared/shared-ui/lxh-ui.css", 200),
    ("iridescently.xyz", "/shared/shared-session/session.js", 200),
    ("iridescently.xyz", "/shared/shared-session/save.js", 200),
    ("iridescently.xyz", "/shared/shared-session/bus.js", 200),
    ("iridescently.xyz", "/definitely-missing", 404),
]


def wait(port, timeout=25):
    end = time.time() + timeout
    while time.time() < end:
        try:
            socket.create_connection(("127.0.0.1", port), timeout=1).close()
            return True
        except OSError:
            time.sleep(0.3)
    return False


def req(host, path):
    c = http.client.HTTPConnection("127.0.0.1", PORT, timeout=10)
    try:
        c.request("GET", path, headers={"Host": host})
        r = c.getresponse()
        body = r.read()
        return r.status, body
    finally:
        c.close()


def main():
    proc = subprocess.Popen([sys.executable, str(HERE / "portal_server.py")],
                            env={**os.environ, "PORT": str(PORT)},
                            stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    total = len(CHECKS) + 1
    fails = 0
    try:
        if not wait(PORT):
            print("FAIL: portal_server 未在端口就绪", PORT)
            return 1
        for host, path, expect in CHECKS:
            try:
                st, _ = req(host, path)
            except Exception as e:  # noqa: BLE001
                st = "ERR:%s" % e
            ok = st == expect
            fails += 0 if ok else 1
            print("%s  %s%s -> %s (want %s)" % ("PASS" if ok else "FAIL", host, path, st, expect))
        st, body = req("iridescently.xyz", "/api/sso-user")
        try:
            data = json.loads(body)
            assert "logged_in" in data
            print("PASS  sso-user JSON 字段完整")
        except Exception:  # noqa: BLE001
            fails += 1
            print("FAIL  sso-user JSON:", body[:80])
        print("\n%d/%d passed" % (total - fails, total))
        return 1 if fails else 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    sys.exit(main())
