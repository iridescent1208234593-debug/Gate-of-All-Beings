#!/usr/bin/env python
"""本地统一入口自检：拉起 portal_server，按 Host 校验三站关键端点后关闭。

用法：python server/verify_portal.py      （默认 PORT=8080）

默认在初始化后的临时 test 存储下运行。不会读取或复制真实数据库、上传或密钥。
模块从显式配置的外部候选目录只读接入，代码始终来自当前 checkout。
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
from storage_paths import release_root, initialize_storage, storage_layout
from site_domains import ALLOWED_ROOTS

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_PORT = 8080
HERE = Path(__file__).resolve().parent
CODE_ROOT = HERE.parent


def isolated_root():
    """Build external fixture storage and return its explicit child environment."""
    modules = Path(os.environ.get("IRIDESCENTLY_MODULES_ROOT", str(release_root() / "candidate" / "modules"))).resolve()
    if not modules.is_dir():
        raise RuntimeError("Build external candidate modules first: npm run build:modules")
    root = Path(tempfile.mkdtemp(prefix="verify-portal-"))
    environment = {key: value for key, value in os.environ.items()
                   if not (key.startswith("IRIDESCENTLY_") and key.endswith("_ROOT"))}
    environment.update(IRIDESCENTLY_ENVIRONMENT="test", IRIDESCENTLY_STORAGE_ROOT=str(root),
                       IRIDESCENTLY_PROJECT_ROOT=str(CODE_ROOT), IRIDESCENTLY_MODULES_ROOT=str(modules),
                       IRIDESCENTLY_SSO_SECRET="isolated-portal-fixture-secret")
    original = dict(os.environ)
    try:
        os.environ.clear()
        os.environ.update(environment)
        initialize_storage()
        layout = storage_layout()
    finally:
        os.environ.clear()
        os.environ.update(original)
    # Build a minimal, deterministic read-only worldview fixture. Tests never
    # mount the production database or uploaded user images.
    world_db = layout["data"] / "worldview" / "worldview_luoxiaohei_v4.db"
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
    (layout["assets"] / "managed" / "worldview" / "images").mkdir(parents=True, exist_ok=True)
    (layout["assets"] / "managed" / "huiguan" / "uploads").mkdir(parents=True, exist_ok=True)
    return root, environment, modules


def select_port():
    """Use 8080 when free; otherwise isolate the smoke test on an ephemeral port."""
    if os.environ.get("PORT"):
        return int(os.environ["PORT"])
    with socket.socket() as probe:
        probe.settimeout(0.3)
        if probe.connect_ex(("127.0.0.1", DEFAULT_PORT)) != 0:
            return DEFAULT_PORT
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


PORT = select_port()
# Every approved root runs the same contract; the list below is written once for the template root.
TEMPLATE_ROOT = "iridescently.xyz"
ROOTS = [root for root in os.environ.get("VERIFY_PORTAL_ROOTS", ",".join(ALLOWED_ROOTS)).split(",") if root]
if not ROOTS or any(root not in ALLOWED_ROOTS for root in ROOTS):
    raise SystemExit("VERIFY_PORTAL_ROOTS must list approved roots")

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
    ("iridescently.xyz", "/shared/site-domains/index.js", 200),
    ("iridescently.xyz", "/shared/site-domains.js", 404),
    ("iridescently.xyz", "/shared/.gitignore", 404),
    ("iridescently.xyz", "/definitely-missing", 404),
    ("iridescently.xyz", "/gallery-engine/index.html", 404),
    ("iridescently.xyz", "/app/src/cards/package.json", 404),
    ("huiguan.iridescently.xyz", "/users.DB", 404),
    ("huiguan.iridescently.xyz", "/game_saves%2ejson", 404),
]
# Unapproved authorities stay closed regardless of which roots are enabled.
REJECTED_HOSTS = ["evil.example", "iridescently.xyz.evil.example", "zszm.iridescently.cn.evil.example",
                  "evil-iridescently.cn", "dpdns.org", "x.zszm.iridescently.dpdns.org", "127.0.0.2",
                  "iridescently.xyz.", "*.iridescently.cn", "zszm.iridescently.xyz:8443"]
# Legacy hosts and the apex redirect inside their own root, never to another registrable domain.
REDIRECTS = [("{root}", "/", "https://huiguan.{root}/"), ("game.{root}", "/", "https://zszm.{root}/#home"),
             ("lingjing.{root}", "/", "https://zszm.{root}/#management"),
             ("juling.{root}", "/", "https://zszm.{root}/app/shell/m/juling")]

# A security overlay may intentionally preserve an older production module set.
# Require world-map when the candidate registers it, without deploying it merely
# because the operator's source checkout has moved ahead of production.
if any(link.get("key") == "world-map" for link in json.loads((HERE / "app/portal.json").read_text(encoding="utf-8"))["links"]):
    CHECKS.append(("iridescently.xyz", "/app/modules/world-map/", 200))


def root_checks():
    for root in ROOTS:
        for host, path, expect in CHECKS:
            yield host.replace(TEMPLATE_ROOT, root), path, expect


def wait(port, proc, timeout=25):
    end = time.time() + timeout
    while time.time() < end:
        if proc.poll() is not None:
            return False
        try:
            socket.create_connection(("127.0.0.1", port), timeout=1).close()
            return True
        except OSError:
            time.sleep(0.3)
    return False


def req(host, path, full=False):
    c = http.client.HTTPConnection("127.0.0.1", PORT, timeout=10)
    try:
        c.request("GET", path, headers={"Host": host, "X-Forwarded-Proto": "https"})
        r = c.getresponse()
        body = r.read()
        return (r.status, body, r.headers) if full else (r.status, body)
    finally:
        c.close()


def main():
    # The forced production stage command already runs this verifier. Keep Host
    # isolation mandatory here so a future release cannot silently omit it.
    ingress = subprocess.run([sys.executable, "-X", "utf8", str(HERE / "security_ingress_test.py"), "--host-only"],
                             capture_output=True, text=True, encoding="utf-8", errors="replace")
    print(ingress.stdout, end="")
    if ingress.returncode:
        print(ingress.stderr[-6000:])
        print("FAIL: Host isolation / origin listener gate")
        return 1
    # The stage command returns only the last line, so carry the listener audit there.
    audit = next((json.loads(line.split(" ", 1)[1]) for line in ingress.stdout.splitlines()
                  if line.startswith("ORIGIN-LISTENERS ")), {"skipped": "audit line missing"})
    listeners = ("not audited (%s)" % audit["skipped"] if "skipped" in audit else
                 "%d listening, non-loopback %s" % (audit["listening"], ",".join(
                     "%s:%d/%s" % (x["address"], x["port"], x["protocol"]) for x in audit["non_loopback"]) or "none"))
    with socket.socket() as probe:
        if probe.connect_ex(("127.0.0.1", PORT)) == 0:
            print("FAIL: requested test port is already in use", PORT)
            return 1
    isolated = isolated_root()
    env = {**isolated[1], "PORT": str(PORT), "PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1"}
    server_log = isolated[0] / "portal-server.log"
    log_stream = server_log.open("wb")
    proc = subprocess.Popen([sys.executable, str(HERE / "portal_server.py")], env=env,
                            stdout=log_stream, stderr=subprocess.STDOUT)
    total = len(CHECKS) * len(ROOTS) + len(REJECTED_HOSTS) + len(REDIRECTS) * len(ROOTS) + len(ROOTS) + 3
    fails = 0
    try:
        if not wait(PORT, proc):
            print("FAIL: portal_server 未在端口就绪", PORT)
            return 1
        for host, path, expect in root_checks():
            try:
                st, _ = req(host, path)
            except Exception as e:  # noqa: BLE001
                st = "ERR:%s" % e
            ok = st == expect
            fails += 0 if ok else 1
            print("%s  %s%s -> %s (want %s)" % ("PASS" if ok else "FAIL", host, path, st, expect))
        for host in REJECTED_HOSTS:
            try:
                st, _ = req(host, "/")
            except Exception as e:  # noqa: BLE001
                st = "ERR:%s" % e
            fails += 0 if st == 421 else 1
            print("%s  unapproved Host %r -> %s (want 421)" % ("PASS" if st == 421 else "FAIL", host, st))
        for root in ROOTS:
            for host, path, location in REDIRECTS:
                st, _, headers = req(host.format(root=root), path, full=True)
                ok = st in (302, 308) and headers.get("Location") == location.format(root=root)
                fails += 0 if ok else 1
                print("%s  %s%s -> %s %s" % ("PASS" if ok else "FAIL", host.format(root=root), path, st, headers.get("Location")))
            _, _, headers = req("zszm." + root, "/", full=True)
            policy = headers.get("Content-Security-Policy-Report-Only", "")
            foreign = [other for other in ALLOWED_ROOTS if other != root and other in policy]
            ok = ("https://zszm." + root) in policy and not foreign
            fails += 0 if ok else 1
            print("%s  CSP for %s names only its own root%s" % ("PASS" if ok else "FAIL", root, "" if ok else " %r" % foreign))
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
        if body == (isolated[2] / "ecology" / "index.html").read_bytes():
            print("PASS  zszm ecology response matches the candidate file byte-for-byte")
        else:
            fails += 1
            print("FAIL  zszm ecology response differs from the candidate file")
        print("\n%d/%d passed; origin listeners: %s" % (total - fails, total, listeners))
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
            shutil.rmtree(isolated[0], ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
