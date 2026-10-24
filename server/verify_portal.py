#!/usr/bin/env python
"""本地统一入口自检：拉起 portal_server，按 Host 校验三站关键端点后关闭。

用法：python server/verify_portal.py      （默认 PORT=8080）

默认在临时数据根下运行：复制 users.db / characters.json / game_saves.json，
只读目录（媒体库、已发布模块、主站运行目录）以链接方式接入。门户启动会建表并导入
旧存档，所以不能直接对真实数据运行；确需检查真实数据时设
IRIDESCENTLY_VERIFY_LIVE_DATA=1。
"""
import http.client
import json
import os
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
from pathlib import Path

PORT = int(os.environ.get("PORT", "8080"))
HERE = Path(__file__).resolve().parent
DATA_ROOT = Path(os.environ.get("IRIDESCENTLY_PROJECT_ROOT", HERE.parent)).resolve()
COPIED = ("portal/huiguan/characters.json", "portal/huiguan/game_saves.json")
LINKED = ("assets", "server/app/modules", "portal/www", "portal/huiguan/assets/uploads")


def _link(target, link):
    link.parent.mkdir(parents=True, exist_ok=True)
    if os.name == "nt":
        subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(target)], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        os.symlink(target, link, target_is_directory=True)


def isolated_root():
    """Build a throwaway data root; returns (path, links) for cleanup()."""
    root = Path(tempfile.mkdtemp(prefix="verify-portal-"))
    runtime = root / "portal" / "huiguan"
    runtime.mkdir(parents=True)
    source_db = DATA_ROOT / "portal" / "huiguan" / "users.db"
    if source_db.exists():
        source = sqlite3.connect(f"file:{source_db.as_posix()}?mode=ro", uri=True)
        target = sqlite3.connect(runtime / "users.db")
        source.backup(target)
        target.close()
        source.close()
    for name in COPIED:
        if (DATA_ROOT / name).exists():
            shutil.copy2(DATA_ROOT / name, root / name)
    links = []
    for name in LINKED:
        if (DATA_ROOT / name).is_dir():
            _link(DATA_ROOT / name, root / name)
            links.append(root / name)
    env_file = DATA_ROOT / "server" / ".env.local"
    if env_file.exists():
        (root / "server").mkdir(exist_ok=True)
        shutil.copy2(env_file, root / "server" / ".env.local")
    return root, links


def cleanup(root, links):
    # Remove links first so deleting the temporary tree can never reach their targets.
    for link in links:
        if os.name == "nt":
            os.rmdir(link)
        else:
            os.unlink(link)
    shutil.rmtree(root, ignore_errors=True)

CHECKS = [
    ("iridescently.xyz", "/", 200),
    ("iridescently.xyz", "/connections.html", 200),
    ("iridescently.xyz", "/styles/connections.css", 200),
    ("iridescently.xyz", "/scripts/connections.js", 200),
    ("iridescently.xyz", "/api/sso-user", 200),
    ("iridescently.xyz", "/api/site-status", 200),
    ("zszm.iridescently.xyz", "/", 200),
    ("zszm.iridescently.xyz", "/playtest/shengsheng-shoot/", 200),
    ("zszm.iridescently.xyz", "/playtest/shengsheng-shoot/index.html", 200),
    ("zszm.iridescently.xyz", "/api/sso-user", 200),
    ("zszm.iridescently.xyz", "/api/progress/boards", 200),
    ("iridescently.xyz", "/api/progress/chains", 200),
    ("spirit.iridescently.xyz", "/api/progress/me", 200),
    ("huiguan.iridescently.xyz", "/api/progress/leaderboard?board=level", 200),
    ("iridescently.xyz", "/api/progress/leaderboard?board=slay", 200),
    ("zszm.iridescently.xyz", "/shared/shared-ui/leaderboard/index.html", 200),
    ("zszm.iridescently.xyz", "/shared/shared-session/progress.js", 200),
    ("zszm.iridescently.xyz", "/ecology/index.html", 200),
    ("zszm.iridescently.xyz", "/shared/shared-session/session.js", 200),
    ("game.iridescently.xyz", "/", 308),
    ("lingjing.iridescently.xyz", "/", 308),
    ("juling.iridescently.xyz", "/", 308),
    ("iridescently.xyz", "/links.html", 308),
    ("iridescently.xyz", "/thanks.html", 308),
    ("zszm.iridescently.xyz", "/app/shell/m/juling", 200),
    ("huiguan.iridescently.xyz", "/", 200),
    ("huiguan.iridescently.xyz", "/design-system/ui/lxh-ui.css", 200),
    ("huiguan.iridescently.xyz", "/design-system/design-system.css", 200),
    ("huiguan.iridescently.xyz", "/design-system/components.html", 200),
    ("huiguan.iridescently.xyz", "/design-system/ui/lxh-ui.js", 200),
    ("huiguan.iridescently.xyz", "/api/official/characters?limit=1", 200),
    ("huiguan.iridescently.xyz", "/works.html", 200),
    ("huiguan.iridescently.xyz", "/api/archives", 200),
    ("huiguan.iridescently.xyz", "/archive-volumes.js", 200),
    ("huiguan.iridescently.xyz", "/api/official/fanart/summary?cids=1,2", 200),
    ("huiguan.iridescently.xyz", "/api/official/fanart?cid=1&sort=popular", 200),
    ("huiguan.iridescently.xyz", "/api/fan/list?limit=1", 200),
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
    ("iridescently.xyz", "/app/modules/world-map/", 200),
    ("iridescently.xyz", "/management/index.html", 308),
    ("iridescently.xyz", "/management/index.html?embed=1", 200),
    ("iridescently.xyz", "/ecology/index.html", 200),
    ("iridescently.xyz", "/shared/shared-ui/lxh-ui.css", 200),
    ("iridescently.xyz", "/shared/shared-ui/site-nav.js", 200),
    ("iridescently.xyz", "/shared/shared-ui/brand/iridescently-mark.svg", 200),
    ("iridescently.xyz", "/shared/shared-ui/lxh/QQ_1787928861211.png", 404),
    ("iridescently.xyz", "/shared/shared-session/session.js", 200),
    ("iridescently.xyz", "/shared/shared-session/save.js", 200),
    ("iridescently.xyz", "/shared/shared-session/bus.js", 200),
    ("iridescently.xyz", "/definitely-missing", 404),
    ("iridescently.xyz", "/gallery-engine/index.html", 404),
    ("iridescently.xyz", "/app/src/cards/package.json", 404),
    ("huiguan.iridescently.xyz", "/users.DB", 404),
    ("huiguan.iridescently.xyz", "/game_saves%2ejson", 404),
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
        c.request("GET", path, headers={"Host": host, "X-Forwarded-Proto": "https"})
        r = c.getresponse()
        body = r.read()
        return r.status, body
    finally:
        c.close()


def main():
    with socket.socket() as probe:
        if probe.connect_ex(("127.0.0.1", PORT)) == 0:
            print("FAIL: requested test port is already in use", PORT)
            return 1
    env = {**os.environ, "PORT": str(PORT)}
    isolated = None
    if os.environ.get("IRIDESCENTLY_VERIFY_LIVE_DATA") != "1":
        isolated = isolated_root()
        env["IRIDESCENTLY_PROJECT_ROOT"] = str(isolated[0])
    proc = subprocess.Popen([sys.executable, str(HERE / "portal_server.py")], env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    total = len(CHECKS) + 3
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
        st, body = req("iridescently.xyz", "/api/site-status")
        try:
            data = json.loads(body)
            assert set(data["sites"]) == {"huiguan", "zszm", "oc", "psyche"}
            assert data["sites"]["psyche"] == "unpublished"
            print("PASS  site-status JSON fields and unpublished marker")
        except Exception:  # noqa: BLE001
            fails += 1
            print("FAIL  site-status JSON:", body[:100])
        _, body = req("zszm.iridescently.xyz", "/ecology/index.html")
        if body == (HERE / "app/modules/ecology/index.html").read_bytes():
            print("PASS  zszm ecology route serves ecology instead of Cards fallback")
        else:
            fails += 1
            print("FAIL  zszm ecology route served the wrong module")
        print("\n%d/%d passed" % (total - fails, total))
        return 1 if fails else 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)
        if isolated:
            cleanup(*isolated)


if __name__ == "__main__":
    sys.exit(main())
