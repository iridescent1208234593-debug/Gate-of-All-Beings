"""End-to-end tests for homepage gallery permissions and account-scoped limits."""
import json
import concurrent.futures
import importlib.util
import os
import sqlite3
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TEMP = tempfile.TemporaryDirectory(prefix="homepage-gallery-")
sys.path.insert(0, str(ROOT / "services" / "platform"))
from testing_storage import configure
from storage_paths import assets_root
DATA = configure(TEMP.name)
os.environ["IRIDESCENTLY_PROJECT_ROOT"] = str(ROOT)
os.environ["HX_SSO_SECRET"] = "test-only-gallery-secret"
(DATA / "huiguan").mkdir(parents=True, exist_ok=True)
(DATA / "homepage" / "config" / ".gallery-originals").mkdir(parents=True, exist_ok=True)
(DATA / "homepage").mkdir(exist_ok=True)
conn = sqlite3.connect(DATA / "huiguan" / "users.db")
conn.executescript("""
CREATE TABLE local_users (uid INTEGER PRIMARY KEY, username TEXT, role TEXT, status TEXT);
CREATE TABLE user_flags (kind TEXT, uid TEXT, status TEXT, role TEXT, PRIMARY KEY(kind, uid));
INSERT INTO local_users VALUES (7, 'owner', 'admin', 'active'), (8, 'member', 'executor', 'active');
""")
conn.commit()
conn.close()
image_name = "test/样例.jpg"
other_image_name = "test/另一张.jpg"
source = assets_root() / "source" / "罗小黑战记数据库" / "罗小黑节气贺图（gallery素材）" / image_name
source.parent.mkdir(parents=True, exist_ok=True)
source.write_bytes(b"original image bytes")
persistent_other = assets_root() / "source" / "homepage-gallery" / other_image_name
persistent_other.parent.mkdir(parents=True, exist_ok=True)
persistent_other.write_bytes(b"another image")
persistent_original = assets_root() / "source" / "homepage-gallery" / image_name
persistent_original.parent.mkdir(parents=True, exist_ok=True)
persistent_original.write_bytes(b"original image bytes")
legacy_public = DATA / "homepage" / "config" / "assets" / "homepage" / "gallery-files" / "anything.jpg"
legacy_public.parent.mkdir(parents=True, exist_ok=True)
legacy_public.write_bytes(b"legacy public path")

sys.path.insert(0, str(ROOT / "services" / "platform"))
import hx_sso  # noqa: E402
import gallery_interactions  # noqa: E402
import scraping_observer  # noqa: E402

sys.path.insert(0, str(ROOT / "apps" / "www"))
spec = importlib.util.spec_from_file_location("portal_www_gallery_test", ROOT / "apps" / "www" / "server.py")
www = importlib.util.module_from_spec(spec)
spec.loader.exec_module(www)


class QuietHandler(www.Handler):
    def log_message(self, *_):
        pass


class RunningServer:
    def __enter__(self):
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.httpd.server_port}"
        return self

    def __exit__(self, *_):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=2)

    def request(self, path, method="GET", kind="local", uid="8", payload=None):
        headers = {"Cookie": f"hx_sso={hx_sso.make_token(uid, kind, 'Tester')}"}
        data = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            headers["Origin"] = self.base
            data = json.dumps(payload, ensure_ascii=False).encode()
        request = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, response.headers, response.read()
        except urllib.error.HTTPError as error:
            result = error.code, error.headers, error.read()
            error.close()
            return result

    def post(self, path, body, uid="8"):
        status, _, raw = self.request(path, method="POST", uid=uid, payload=body)
        return status, json.loads(raw)
class GalleryPermissionsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.previous_root = os.environ.get("IRIDESCENTLY_PROJECT_ROOT")
        cls.previous_secret = os.environ.get("HX_SSO_SECRET")
        cls.previous_hx_secret = hx_sso.HX_SSO_SECRET

    @classmethod
    def tearDownClass(cls):
        logger = scraping_observer._logger
        if logger:
            for handler in list(logger.handlers):
                logger.removeHandler(handler)
                handler.close()
            scraping_observer._logger = None
        for key, value in (("IRIDESCENTLY_PROJECT_ROOT", cls.previous_root),
                           ("HX_SSO_SECRET", cls.previous_secret)):
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        hx_sso.HX_SSO_SECRET = cls.previous_hx_secret
        TEMP.cleanup()

    def setUp(self):
        os.environ["IRIDESCENTLY_PROJECT_ROOT"] = str(ROOT)
        os.environ["HX_SSO_SECRET"] = "test-only-gallery-secret"
        www.RUNTIME_DIR = str(DATA / "homepage" / "config")
        hx_sso.HX_SSO_SECRET = "test-only-gallery-secret"
        database = DATA / "homepage" / "homepage-gallery.sqlite3"
        for suffix in ("", "-wal", "-shm"):
            Path(str(database) + suffix).unlink(missing_ok=True)

    def test_original_requires_site_owner_and_is_not_public_static(self):
        with RunningServer() as server:
            path = "/api/gallery/original?image=" + urllib.parse.quote(image_name, safe="")
            status, _, body = server.request(path, uid="8")
            self.assertEqual(status, 403, body)
            status, headers, body = server.request(path, uid="7")
            self.assertEqual(status, 200)
            self.assertEqual(headers.get("Cache-Control"), "private, no-store")
            self.assertEqual(body, b"original image bytes")
            self.assertFalse(json.loads(server.request("/api/sso-user", uid="8")[2])["admin"])
            self.assertTrue(json.loads(server.request("/api/sso-user", uid="7")[2])["admin"])
            status, _, _ = server.request("/assets/homepage/gallery-files/anything.jpg", uid="8")
            self.assertEqual(status, 404)
            status, _, _ = server.request("/assets/homepage/gallery-files/anything.jpg", uid="7")
            self.assertEqual(status, 404, "legacy static URLs stay closed even for admins")
            cross_site = urllib.request.Request(
                server.base + path,
                headers={"Cookie": f"hx_sso={hx_sso.make_token('7', 'local', 'Owner')}", "Sec-Fetch-Site": "cross-site"},
            )
            try:
                urllib.request.urlopen(cross_site)
                self.fail("cross-site original loads must fail")
            except urllib.error.HTTPError as error:
                self.assertEqual(error.code, 403)
                error.close()
            request = urllib.request.Request(server.base + "/assets/homepage/gallery-files/anything.jpg", method="HEAD")
            try:
                urllib.request.urlopen(request)
                self.fail("anonymous HEAD must not expose an original")
            except urllib.error.HTTPError as error:
                self.assertEqual(error.code, 404)
                error.close()

    def test_interactions_require_login_and_duplicate_request_is_idempotent(self):
        with RunningServer() as server:
            request = urllib.request.Request(
                server.base + "/api/gallery/action", data=json.dumps({"image": image_name, "action": "like", "request_id": "same"}).encode(),
                headers={"Content-Type": "application/json", "Origin": server.base}, method="POST")
            try:
                urllib.request.urlopen(request)
                self.fail("anonymous action must fail")
            except urllib.error.HTTPError as error:
                self.assertEqual(error.code, 401)
                error.close()
            body = {"image": image_name, "action": "like", "request_id": "same"}
            self.assertEqual(server.post("/api/gallery/action", body)[0], 200)
            # 新规则：同一账号对同一张图只能点一次赞，重复请求返回 409
            self.assertEqual(server.post("/api/gallery/action", body)[0], 409)
            status, _, raw = server.request("/api/gallery/state?image=" + urllib.parse.quote(image_name, safe=""))
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(raw)["likes"], 1)

    def test_one_like_unlocks_one_comment_for_account(self):
        # 新规则：给这张图点过赞即可留言（不再要求 66 次互动）
        with RunningServer() as server:
            self.assertEqual(server.post("/api/gallery/comment", {"image": image_name, "comment": "early"})[0], 403)
            status, _ = server.post("/api/gallery/action", {
                "image": image_name, "action": "like", "request_id": "action-1"
            })
            self.assertEqual(status, 200)
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                outcomes = list(pool.map(lambda _: server.post("/api/gallery/comment", {
                    "image": image_name, "comment": "字" * 25
                })[0], range(2)))
            self.assertEqual(sorted(outcomes), [200, 409], "concurrent submissions keep one comment")
            status, _, raw = server.request("/api/gallery/state?image=" + urllib.parse.quote(image_name, safe=""))
            persisted = json.loads(raw)
            self.assertEqual(status, 200)
            self.assertEqual(persisted["interaction_count"], 1)
            self.assertEqual((persisted["likes"], persisted["loves"]), (1, 0))
            self.assertTrue(persisted["comment_used"], "refresh sees the one-time comment")
            self.assertEqual(persisted["comments"][0]["comment"], "字" * 25)
            self.assertEqual(persisted["comment_total"], 1)
            # Another image needs its own like first.
            status, body = server.post("/api/gallery/comment", {"image": other_image_name, "comment": "second"})
            self.assertEqual(status, 403)
            self.assertIn("先给这张图点个赞", body["error"])

    def test_comments_are_paged_without_public_original_access(self):
        with RunningServer() as server:
            with gallery_interactions.session(DATA) as db:
                for uid in range(5):
                    db.execute("INSERT INTO gallery_comments(kind,uid,name,image,comment) VALUES(?,?,?,?,?)",
                               ("local", str(uid + 20), f"Visitor {uid}", image_name, f"Note {uid}"))
            path = "/api/gallery/state?image=" + urllib.parse.quote(image_name, safe="")
            status, _, raw = server.request(path)
            self.assertEqual(status, 200)
            first = json.loads(raw)
            self.assertEqual(first["comment_total"], 5)
            self.assertEqual(len(first["comments"]), 3)
            status, _, raw = server.request("/api/gallery/comments?image=" + urllib.parse.quote(image_name, safe="") + "&offset=3")
            self.assertEqual(status, 200)
            self.assertEqual(len(json.loads(raw)["comments"]), 2)
            self.assertEqual(server.request("/api/gallery/comments?image=" + urllib.parse.quote(image_name, safe="") + "&offset=-1")[0], 400)

    def test_comment_length_and_same_origin_are_checked(self):
        with RunningServer() as server:
            status, body = server.post("/api/gallery/comment", {"image": image_name, "comment": "x" * 26}, uid="7")
            self.assertEqual(status, 400)
            self.assertIn("25", body["error"])
            request = urllib.request.Request(
                server.base + "/api/gallery/action", data=json.dumps({"image": image_name, "action": "like", "request_id": "csrf"}).encode(),
                headers={"Cookie": f"hx_sso={hx_sso.make_token('8', 'local', 'Tester')}", "Content-Type": "application/json", "Origin": "https://evil.example"}, method="POST")
            try:
                urllib.request.urlopen(request)
                self.fail("cross-origin action must fail")
            except urllib.error.HTTPError as error:
                self.assertEqual(error.code, 403)
                error.close()


if __name__ == "__main__":
    unittest.main()
