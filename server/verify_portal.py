#!/usr/bin/env python
"""本地统一入口自检：拉起 portal_server，按 Host 校验三站关键端点后关闭。

用法：python server/verify_portal.py      （默认 PORT=8080）

默认在空的临时数据根下运行。门户可在此创建空测试数据库；验证器不会读取或复制
生产 users.db、用户存档或本地密钥配置。只读内容目录及候选代码以链接/副本接入。
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

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PORT = int(os.environ.get("PORT", "8080"))
HERE = Path(__file__).resolve().parent
CODE_ROOT = HERE.parent


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
    links = []
    # Build a minimal, deterministic read-only worldview fixture. Tests never
    # mount the production database or uploaded user images.
    world_db = root / "assets" / "罗小黑战记数据库" / "db" / "worldview_luoxiaohei_v4.db"
    world_db.parent.mkdir(parents=True, exist_ok=True)
    world = sqlite3.connect(world_db)
    world.executescript("""
        CREATE TABLE characters (
            id INTEGER PRIMARY KEY, name TEXT, aliases TEXT DEFAULT '', category TEXT DEFAULT '',
            merged_to TEXT, completeness INTEGER DEFAULT 8, type TEXT DEFAULT '',
            thumb_path TEXT, avatar_id INTEGER
        );
        CREATE TABLE character_images (
            id INTEGER PRIMARY KEY, character_id INTEGER, image_path TEXT, image_type TEXT,
            description TEXT, sort_order INTEGER
        );
        INSERT INTO characters(id, name, category, completeness, type)
            VALUES (1, '测试角色', '官方角色', 8, '主角');
        CREATE VIEW v_character_gallery AS
            SELECT id, name, aliases, category, merged_to, completeness, type,
                   thumb_path, avatar_id FROM characters;
    """)
    world.commit()
    world.close()
    (root / "assets" / "罗小黑战记数据库" / "images").mkdir(parents=True, exist_ok=True)
    (runtime / "assets" / "uploads").mkdir(parents=True, exist_ok=True)
    # Runtime data may come from DATA_ROOT, but served code must come from this
    # candidate. The portal server resolves modules under its runtime root.
    modules = CODE_ROOT / ".releases" / "candidate" / "modules"
    if not modules.is_dir():
        raise RuntimeError("Build candidate modules first: npm run build:modules")
    _link(modules, root / "server" / "app" / "modules")
    links.append(root / "server" / "app" / "modules")
    # The homepage handler reads / and /assets/homepage from RUNTIME_DIR. Seed
    # that part of the isolated root from the candidate, excluding runtime data.
    candidate_www = CODE_ROOT / "portal" / "www"
    if candidate_www.is_dir():
        shutil.copytree(
            candidate_www,
            root / "portal" / "www",
            ignore=shutil.ignore_patterns("gallery-files", "links.json", "thanks.json"),
        )
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
    ("iridescently.xyz", "/", 302),
    ("iridescently.xyz", "/gallery.html", 404),
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
    env["PYTHONIOENCODING"] = "utf-8"
    isolated = None
    isolated = isolated_root()
    env["IRIDESCENTLY_PROJECT_ROOT"] = str(isolated[0])
    server_log = isolated[0] / "portal-server.log"
    log_stream = server_log.open("wb")
    proc = subprocess.Popen([sys.executable, str(HERE / "portal_server.py")], env=env,
                            stdout=log_stream, stderr=subprocess.STDOUT)
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
        except Exception as error:  # noqa: BLE001
            fails += 1
            print("FAIL  sso-user JSON:", body[:80], error)
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
        if body == (CODE_ROOT / ".releases" / "candidate" / "modules" / "ecology" / "index.html").read_bytes():
            print("PASS  zszm ecology response matches the candidate file byte-for-byte")
        else:
            fails += 1
            print("FAIL  zszm ecology response differs from the candidate file")
        print("\n%d/%d passed" % (total - fails, total))
        return 1 if fails else 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)
        log_stream.close()
        if fails:
            print("\nLocal portal diagnostics:")
            print(server_log.read_text(encoding="utf-8", errors="replace")[-6000:])
        if isolated:
            cleanup(*isolated)


if __name__ == "__main__":
    sys.exit(main())
