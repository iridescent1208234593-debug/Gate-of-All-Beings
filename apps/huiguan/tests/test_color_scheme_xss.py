"""Stored XSS through self-named color schemes: names are whitelisted on save and escaped on render."""

import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

HUIGUAN = Path(__file__).resolve().parents[1]
LAUNCH = r'''
import sys, http.server
sys.path.insert(0, sys.argv[1])
sys.path.insert(0, str(__import__("pathlib").Path(sys.argv[1]).parents[1] / "services" / "platform"))
from storage_paths import initialize_storage; initialize_storage(); import server_huiguan as s
s.init_user_db()
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), s.Handler).serve_forever()
'''

PAYLOADS = (
    "<img src=x onerror=alert(1)>",
    "<script>alert(1)</script>",
    '" onmouseover="alert(1)',
    "' onmouseover='alert(1)",
    "a&lt;b",
    "主色×辅色",
)


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class ColorSchemeXssTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = tempfile.TemporaryDirectory()
        (Path(cls.root.name) / "apps" / "huiguan").mkdir(parents=True)
        port = free_port()
        env = dict(os.environ, IRIDESCENTLY_STORAGE_ROOT=cls.root.name,
                   IRIDESCENTLY_ENVIRONMENT="test", HX_SSO_SECRET="test-only-secret")
        for key in ("DATA", "ASSETS", "CACHE", "RELEASE", "BACKUP", "PROJECT"):
            env.pop(f"IRIDESCENTLY_{key}_ROOT", None)
        cls.proc = subprocess.Popen([sys.executable, "-c", LAUNCH, str(HUIGUAN), str(port)], env=env,
                                    stdout=subprocess.DEVNULL, stderr=None)
        cls.base = f"http://127.0.0.1:{port}"
        for _ in range(100):
            try:
                urllib.request.urlopen(cls.base + "/api/color-schemes", timeout=1).close()
                break
            except OSError:
                time.sleep(0.1)

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(10)
        cls.root.cleanup()

    def save(self, primary_name, accent_name):
        body = {"primary_name": primary_name, "accent_name": accent_name, "primary": "#112233", "accent": "#445566"}
        request = urllib.request.Request(self.base + "/api/color-schemes", data=json.dumps(body).encode(),
                                         headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status
        except urllib.error.HTTPError as error:
            with error:
                return error.code

    def names(self):
        with urllib.request.urlopen(self.base + "/api/color-schemes", timeout=30) as response:
            return [s["name"] for s in json.load(response)["schemes"]]

    def test_markup_and_separator_in_names_are_rejected(self):
        for payload in PAYLOADS:
            with self.subTest(payload=payload):
                self.assertEqual(self.save(payload, "辅色"), 400)
                self.assertEqual(self.save("主色", payload), 400)
        self.assertEqual(self.save("主色\n", "辅色\t换行"), 400)
        stored = self.names()
        self.assertFalse(any(re.search(r"[<>\"'&]", name) for name in stored), stored)

    def test_ordinary_names_still_save(self):
        for primary_name, accent_name in (("暮紫", "金橙"), ("Deep Blue 2", "银白·月光"), ("黛蓝（深）", "缟白-浅")):
            with self.subTest(name=primary_name):
                self.assertEqual(self.save(primary_name, accent_name), 200)
        self.assertIn("暮紫×金橙", self.names())


class ColorSchemeRenderTest(unittest.TestCase):
    """index.html builds the color grids with innerHTML; every scheme field must go through a sanitizer."""

    def test_scheme_fields_are_escaped_in_grids(self):
        html = (HUIGUAN / "index.html").read_text(encoding="utf-8")
        for fn in ("renderFormColorGrid", "renderColorGrid"):
            start = html.index(f"function {fn}(")
            body = html[start:html.index("\nfunction ", start + 1)]
            with self.subTest(fn=fn):
                # Raw interpolation of scheme fields is the sink the XSS used.
                self.assertIsNone(re.search(r"\$\{\s*(cs|us)\.(name|primary|accent|id)\s*\}", body), body)
                self.assertIsNone(re.search(r"'⭐ ' \+ (cs|us)\.name", body), body)
                self.assertIn("escapeHtml(", body)
                self.assertIn("safeCssHex(", body)


if __name__ == "__main__":
    unittest.main()
