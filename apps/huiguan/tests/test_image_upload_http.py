"""Image upload acceptance using generated inert images and disposable loopback storage."""
from contextlib import closing
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from io import BytesIO
import json
import os
from pathlib import Path
from unittest.mock import patch
import sqlite3
import sys
import tempfile
import threading
import unittest

from PIL import Image


class UploadContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[3]
        cls.temp = tempfile.TemporaryDirectory(prefix="hall-upload-http-")
        cls.addClassCleanup(cls.temp.cleanup)
        for key in list(os.environ):
            if key.startswith(("IRIDESCENTLY_", "LAB_", "USSO_", "HX_", "TURNSTILE_")):
                os.environ.pop(key)
        os.environ.update(IRIDESCENTLY_STORAGE_ROOT=cls.temp.name, IRIDESCENTLY_ENVIRONMENT="test")
        sys.path[:0] = [str(root / "apps/huiguan"), str(root / "services/platform")]
        from storage_paths import initialize_storage
        initialize_storage()
        import server_huiguan as site
        cls.site = site
        with closing(site.db()) as conn, conn:
            uid = conn.execute("INSERT INTO local_users(username,nickname,pass_hash,role) VALUES(?,?,?,?)",
                               ("upload-fixture", "Fixture", "fixture", "executor")).lastrowid
            site.legal_consent.record(conn, "local", uid)
        cls.session = site.create_session("local", str(uid), "iridescently.cn")
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), site.Handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.addClassCleanup(cls.server.server_close)
        cls.addClassCleanup(cls.server.shutdown)

    @staticmethod
    def image(fmt, size=(8, 8), mode="RGB"):
        view = BytesIO()
        Image.new(mode, size).save(view, fmt)
        return view.getvalue()

    def upload(self, raw, mime, filename="oc-image.png", *, authenticated=True, route="/api/images/upload", metadata=None):
        boundary = "InertFixtureBoundary"
        prefix = "" if metadata is False else (f"--{boundary}\r\nContent-Disposition: form-data; name=\"metadata\"\r\n\r\n"
                                                + json.dumps(metadata or {}) + "\r\n")
        opening = (prefix + f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{filename}\"\r\n"
                   f"Content-Type: {mime}\r\n\r\n").encode()
        body = opening + raw + f"\r\n--{boundary}--\r\n".encode()
        headers = {"Host": "huiguan.iridescently.cn", "Origin": "https://huiguan.iridescently.cn",
                   "Content-Type": f"multipart/form-data; boundary={boundary}"}
        if authenticated:
            headers["Cookie"] = f"session={self.session}"
        with closing(HTTPConnection("127.0.0.1", self.server.server_port, timeout=10)) as conn:
            conn.request("POST", route, body, headers)
            response = conn.getresponse()
            return response.status, json.loads(response.read())

    def assets(self):
        return set(Path(self.site.UPLOAD_DIR).iterdir())

    def test_accepts_supported_rasters_and_stores_by_content(self):
        for fmt, mime, extension in (("PNG", "png", "png"), ("JPEG", "jpeg", "jpg"),
                                     ("WEBP", "webp", "webp"), ("GIF", "gif", "gif")):
            with self.subTest(fmt=fmt):
                raw = self.image(fmt)
                status, body = self.upload(raw, "image/" + mime, "sample." + extension)
                self.assertEqual(status, 200, body)
                self.assertTrue(body["url"].endswith("." + extension))
                stored = Path(self.site.UPLOAD_DIR) / Path(body["url"]).name
                self.assertEqual(stored.read_bytes(), raw)
                before = self.assets()
                self.assertEqual(self.upload(raw, "image/" + mime, "another-name.dat"), (200, body))
                self.assertEqual(self.assets(), before)

    def test_rejects_inert_invalid_input_without_storing(self):
        png = self.image("PNG", (9, 9))
        too_many_pixels = self.image("PNG", (8001, 5000), "1")
        before = self.assets()
        for raw, mime in ((b"not an image", "image/png"), (png, "image/jpeg"),
                          (too_many_pixels, "image/png")):
            with self.subTest(mime=mime, size=len(raw)):
                self.assertEqual(self.upload(raw, mime)[0], 400)
                self.assertEqual(self.assets(), before)
        self.assertEqual(self.upload(png, "image/png", metadata=False)[0], 400)
        self.assertEqual(self.upload(png, "image/png", authenticated=False)[0], 401)
        self.assertEqual(self.assets(), before)

    def test_general_and_official_fan_art_gif_limits_differ(self):
        raw = self.image("GIF")
        raw += bytes(6 * 1024 * 1024 - len(raw))
        before = self.assets()
        self.assertEqual(self.upload(raw, "image/gif", "animated.gif")[0], 400)
        self.assertEqual(self.assets(), before)
        world = Path(self.temp.name) / "fake-world.db"
        with closing(sqlite3.connect(world)) as conn, conn:
            conn.execute("CREATE TABLE characters (id INTEGER PRIMARY KEY, merged_to TEXT)")
            conn.execute("INSERT INTO characters(id) VALUES (1)")
        with patch.object(self.site, "WV_DB", str(world)):
            self.assertEqual(self.upload(raw, "image/gif", "animated.gif", authenticated=False,
                                         route="/api/official/fanart/upload", metadata={"character_id": 1})[0], 401)
            status, response = self.upload(raw, "image/gif", "animated.gif",
                                           route="/api/official/fanart/upload", metadata={"character_id": 1})
        self.assertEqual(status, 200, response)
        self.assertEqual(len(self.assets() - before), 1)

    def test_avatar_is_normalized(self):
        status, data = self.upload(self.image("PNG", (16, 8)), "image/png", route="/api/avatars/upload")
        self.assertEqual(status, 200, data)
        with Image.open(Path(self.site.UPLOAD_DIR) / Path(data["avatar_asset_id"]).name) as processed:
            self.assertEqual(processed.size, (8, 8))


if __name__ == "__main__":
    unittest.main()
