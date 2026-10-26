"""Originals are owner-only: every public image route returns derived WebP, /api/original-image needs the site owner."""
import io
import json
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
from unittest import mock

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
TEMP = tempfile.TemporaryDirectory(prefix="huiguan-originals-")
sys.path.insert(0, str(ROOT / "services" / "platform"))
from testing_storage import configure
from storage_paths import assets_root
DATA = configure(TEMP.name)
os.environ["IRIDESCENTLY_PROJECT_ROOT"] = str(ROOT)
os.environ["HX_SSO_SECRET"] = "test-only-original-secret"
UPLOADS = assets_root() / "managed" / "huiguan" / "uploads"
UPLOADS.mkdir(parents=True, exist_ok=True)

WORLD = assets_root() / "source" / "罗小黑战记数据库"
(WORLD / "db").mkdir(parents=True, exist_ok=True)
(WORLD / "images").mkdir()


def big_png(path, size=(2400, 1800)):
    # Noise keeps the PNG source far larger than any WebP preview.
    Image.effect_noise(size, 90).convert("RGB").save(path, "PNG")
    return path.read_bytes()


char_original = big_png(WORLD / "images" / "char.png")
upload_name = "a" * 64 + ".png"
upload_original = big_png(UPLOADS / upload_name, (2000, 1500))
unclassified_original = big_png(WORLD / "images" / "unclassified.png", (1900, 1300))

wv = sqlite3.connect(DATA / "worldview" / "worldview_luoxiaohei_v4.db")
wv.executescript("""
CREATE TABLE characters (id INTEGER PRIMARY KEY, name TEXT, aliases TEXT, category TEXT, avatar_id INTEGER, merged_to INTEGER, type TEXT, species TEXT, deity TEXT);
CREATE TABLE character_images (id INTEGER PRIMARY KEY, character_id INTEGER, image_path TEXT, sort_order INTEGER, image_type TEXT, description TEXT);
CREATE TABLE unclassified_images (id INTEGER PRIMARY KEY, image_path TEXT, reason TEXT);
CREATE TABLE shared_assets (id INTEGER PRIMARY KEY, category TEXT, name TEXT, source TEXT, tags TEXT, file_size INTEGER, path TEXT);
CREATE TABLE character_abilities_ext (id INTEGER PRIMARY KEY, character_id INTEGER, ability TEXT, description TEXT);
CREATE TABLE character_relations_ext (id INTEGER PRIMARY KEY, character_id INTEGER, related_name TEXT, relation_type TEXT, relation_desc TEXT);
CREATE TABLE character_events (id INTEGER PRIMARY KEY, character_id INTEGER, event TEXT);
CREATE VIEW v_character_gallery AS SELECT characters.id AS id, name, aliases, type, species, category, deity,
  8 AS completeness, character_images.image_path AS thumb_path FROM characters
  LEFT JOIN character_images ON character_images.character_id=characters.id
  GROUP BY characters.id;
""")
wv.execute("INSERT INTO characters VALUES (1, 'c', '', 'x', 1, NULL, '主角', '猫', '')")
wv.execute("INSERT INTO character_images VALUES (1, 1, ?, 0, '', '')", (str(WORLD / "images" / "char.png"),))
wv.execute("INSERT INTO unclassified_images VALUES (1, ?, '')", (str(WORLD / "images" / "unclassified.png"),))
wv.execute("INSERT INTO shared_assets VALUES (1, 'c', 'n', '', '', 1, ?)", (str(WORLD / "images" / "char.png"),))
wv.commit()
wv.close()

users = sqlite3.connect(DATA / "huiguan" / "users.db")
users.executescript("""
CREATE TABLE local_users (uid INTEGER PRIMARY KEY, username TEXT, role TEXT, status TEXT);
CREATE TABLE user_flags (kind TEXT, uid TEXT, status TEXT, role TEXT, PRIMARY KEY(kind, uid));
INSERT INTO local_users VALUES (7, 'owner', 'admin', 'active'), (8, 'member', 'executor', 'active'), (9, 'hall-admin', 'admin', 'active');
""")
users.commit()
users.close()

sys.path.insert(0, str(ROOT / "services" / "platform"))
sys.path.insert(0, str(ROOT / "apps" / "huiguan"))
import hx_sso  # noqa: E402
import scraping_observer  # noqa: E402
import server_huiguan as huiguan  # noqa: E402

hx_sso.HX_SSO_SECRET = "test-only-original-secret"


class Quiet(huiguan.Handler):
    def log_message(self, *_):
        pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class OriginalImageAccessTest(unittest.TestCase):
    GUEST, MEMBER, HALL_ADMIN, OWNER = None, ("local", "8"), ("local", "9"), ("local", "7")

    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Quiet)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.httpd.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        logger = scraping_observer._logger
        if logger:
            for handler in list(logger.handlers):
                logger.removeHandler(handler)
                handler.close()
            scraping_observer._logger = None
        TEMP.cleanup()

    def get(self, path, who=None, method="GET", headers=None):
        request_headers = dict(headers or {})
        if who:
            request_headers["Cookie"] = "hx_sso=" + hx_sso.make_token(who[1], who[0], "T")
        opener = urllib.request.build_opener(NoRedirect)
        try:
            with opener.open(urllib.request.Request(self.base + path, headers=request_headers, method=method)) as response:
                return response.status, response.headers, response.read()
        except urllib.error.HTTPError as error:
            body = error.read()
            error.close()
            return error.code, error.headers, body

    def test_public_routes_never_return_source_bytes_for_any_identity(self):
        sources = {char_original, upload_original, unclassified_original}
        paths = [
            "/api/uploads/preview?name=" + urllib.parse.quote(upload_name),
            "/api/uploads/preview?name=" + urllib.parse.quote(upload_name) + "&t=1",
            "/api/official/img?cid=1&n=0",
            "/api/official/img?cid=1&n=0&t=0",
            "/api/official/img-id?id=1",
            "/api/official/unclassified-img?id=1",
            "/api/assets/avatar?cid=1",
            "/api/assets/image?id=1",
            "/api/assets/shared?id=1",
            "/api/assets/image?id=1&original=1",  # no query flag can unlock the source
            "/api/official/img-id?id=1&t=",
        ]
        for who in (self.GUEST, self.MEMBER, self.HALL_ADMIN, self.OWNER):
            for path in paths:
                status, headers, body = self.get(path, who)
                self.assertEqual(status, 200, (who, path))
                self.assertEqual(headers["Content-Type"], "image/webp", (who, path))
                self.assertNotIn(body, sources, (who, path))
                self.assertLess(len(body), len(char_original) // 2, (who, path))
                with Image.open(io.BytesIO(body)) as image:
                    self.assertLessEqual(max(image.size), huiguan.PREVIEW_MAX_EDGE)
                self.assertNotIn("private", headers.get("Cache-Control", ""))
                self.assertEqual(len(headers.get_all("Cache-Control")), 1, (path, headers.get_all("Cache-Control")))

    def test_thumbnail_stays_small(self):
        status, headers, body = self.get("/api/official/img?cid=1&n=0&t=1")
        self.assertEqual((status, headers["Content-Type"]), (200, "image/webp"))
        with Image.open(io.BytesIO(body)) as image:
            self.assertLessEqual(image.width, 360)

    def test_uncached_upload_first_request_generates_webp_and_second_hits_cache(self):
        new_name = "z" * 64 + ".png"
        source = UPLOADS / new_name
        source.write_bytes(big_png(source, (900, 700)))
        stat = source.stat()
        digest = huiguan.hashlib.md5(f"{source}|{stat.st_size}|{int(stat.st_mtime)}|thumb-360-v2".encode()).hexdigest()
        cached = Path(huiguan.PREVIEW_DIR) / (digest + ".webp")
        self.assertFalse(cached.exists())
        url = "/api/uploads/preview?name=" + urllib.parse.quote(new_name) + "&t=1"
        status, headers, first = self.get(url)
        self.assertEqual((status, headers["Content-Type"]), (200, "image/webp"))
        self.assertTrue(cached.is_file())
        self.assertTrue(first.startswith(b"RIFF") and first[8:12] == b"WEBP")
        first_mtime = cached.stat().st_mtime_ns
        with mock.patch.object(huiguan, "_encode_webp_preview", side_effect=AssertionError("cache miss")):
            status, headers, second = self.get(url)
        self.assertEqual((status, headers["Content-Type"], second), (200, "image/webp", first))
        self.assertEqual(cached.stat().st_mtime_ns, first_mtime)

    def test_json_and_html_never_expose_source_paths(self):
        status, headers, body = self.get("/api/official/character?id=1")
        self.assertEqual(status, 200)
        text = body.decode("utf-8")
        self.assertNotIn(str(WORLD / "images" / "char.png"), text)
        payload = json.loads(text)
        image_path = payload["images"][0]["image_path"]
        self.assertTrue(image_path.startswith("/api/image-preview?id="))
        self.assertNotIn(str(WORLD / "images" / "char.png"), image_path)
        for who in (self.GUEST, self.MEMBER, self.OWNER):
            preview_status, preview_headers, preview_body = self.get(image_path, who)
            self.assertEqual((preview_status, preview_headers["Content-Type"]), (200, "image/webp"), who)
            self.assertNotEqual(preview_body, char_original)
        showcase = f'<html><body><img src="/assets/uploads/{upload_name}"></body></html>'
        Path(huiguan.DATA_FILE).write_text(json.dumps({"local_7": [{"code": "showcase", "html": showcase, "data": {}}]}), encoding="utf-8")
        status, _, html = self.get("/api/get-character?code=showcase")
        self.assertEqual(status, 200)
        self.assertNotIn("/assets/uploads/", html.decode("utf-8"))
        self.assertIn("/api/uploads/preview?name=" + upload_name, html.decode("utf-8"))
        store_file = Path(huiguan.STORE_DIR) / "legacy.html"
        store_file.parent.mkdir(parents=True, exist_ok=True)
        store_file.write_text(showcase, encoding="utf-8")
        self.assertEqual(self.get("/assets/store/legacy.html")[0], 404)

    def test_original_endpoint_is_owner_only(self):
        targets = {
            "/assets/uploads/" + upload_name: upload_original,
            "/api/official/img?cid=1&n=0": char_original,
            "/api/official/img-id?id=1&t=1": char_original,
            "/api/assets/shared?id=1": char_original,
            "/api/official/unclassified-img?id=1": unclassified_original,
        }
        for src, original in targets.items():
            path = "/api/original-image?src=" + urllib.parse.quote(src, safe="")
            for who in (self.GUEST, self.MEMBER, self.HALL_ADMIN):
                for method in ("GET", "HEAD"):
                    status, headers, body = self.get(path, who, method)
                    self.assertEqual(status, 403, (who, src, method))
                    self.assertEqual(headers["Cache-Control"], "no-store")
                    self.assertNotIn(original, body)
            status, headers, body = self.get(path, self.OWNER)
            self.assertEqual(status, 200, src)
            self.assertEqual(body, original, src)
            self.assertEqual(headers.get_all("Cache-Control"), ["private, no-store"])
            self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_original_endpoint_rejects_tampering_and_cross_site(self):
        def owner_get(src):
            return self.get("/api/original-image?src=" + urllib.parse.quote(src, safe=""), self.OWNER)
        for src in ("https://example.com/a.png", "//example.com/a.png", "/assets/uploads/../../users.db", "/characters.json",
                    "/assets/uploads/" + "b" * 64 + ".png", "/api/official/img?cid=999"):
            self.assertIn(owner_get(src)[0], (400, 404), src)
        path = "/api/original-image?src=" + urllib.parse.quote("/assets/uploads/" + upload_name, safe="")
        self.assertEqual(self.get(path, self.OWNER, headers={"Sec-Fetch-Site": "cross-site"})[0], 403)
        self.assertEqual(self.get(path, self.OWNER, headers={"Origin": "https://evil.example"})[0], 403)

    def test_raw_upload_paths_are_not_static(self):
        paths = (
            "/assets/uploads/" + upload_name,
            "/assets/uploads/" + upload_name + "/",
            "/assets/uploads/%2e%2e/users.db",
            "/assets/uploads/not-a-hash.png",
            "/%61ssets/uploads/" + upload_name,
            "/assets%2fuploads%2f" + upload_name,
        )
        for who in (self.GUEST, self.MEMBER, self.OWNER):
            for path in paths:
                self.assertEqual(self.get(path, who)[0], 404, (who, path))
                self.assertEqual(self.get(path, who, method="HEAD")[0], 404, (who, path, "HEAD"))

    def test_relocated_originals_use_verified_roots_and_reject_traversal(self):
        marker_path = DATA / ".storage-ready.json"
        original_marker = marker_path.read_bytes()
        marker = json.loads(original_marker)
        marker["legacy_asset_roots"] = ["C:\\retired-project\\assets"]
        marker_path.write_text(json.dumps(marker), encoding="utf-8")
        try:
            stored = "C:\\retired-project\\assets\\罗小黑战记数据库\\images\\char.png"
            self.assertEqual(huiguan._safe_image_path(stored), str(WORLD / "images" / "char.png"))
            self.assertIsNone(huiguan._safe_image_path("C:\\retired-project\\assets\\..\\users.png"))
            self.assertIsNone(huiguan._safe_image_path("C:\\unapproved\\assets\\罗小黑战记数据库\\images\\char.png"))
            self.assertIsNone(huiguan._safe_image_path(str(DATA / "huiguan" / "users.db")))
        finally:
            marker_path.write_bytes(original_marker)

    def test_worldview_and_cache_are_external_and_missing_db_is_not_recreated(self):
        self.assertEqual(Path(huiguan.WV_DB), DATA / "worldview" / "worldview_luoxiaohei_v4.db")
        self.assertEqual(Path(huiguan.WV_IMG_DIR), assets_root() / "managed" / "worldview" / "images")
        for path in (huiguan.DATA_FILE, huiguan.USER_DB, huiguan.UPLOAD_DIR, huiguan.PREVIEW_DIR, huiguan.THUMB_DIR):
            self.assertFalse(Path(path).is_relative_to(ROOT), path)
        missing = DATA / "worldview" / "missing.db"
        with mock.patch.object(huiguan, "WV_DB", str(missing)):
            with self.assertRaises(sqlite3.OperationalError):
                huiguan.wv()
        self.assertFalse(missing.exists())

    def test_sso_user_exposes_only_the_server_owner_decision(self):
        for who, expected in ((self.GUEST, False), (self.MEMBER, False), (self.HALL_ADMIN, False), (self.OWNER, True)):
            body = json.loads(self.get("/api/sso-user", who)[2])
            self.assertIs(body.get("can_view_original"), expected, who)


if __name__ == "__main__":
    unittest.main()
