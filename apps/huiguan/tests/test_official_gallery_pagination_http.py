"""Deterministic official gallery pagination with 100/1000/5000 synthetic rows."""
from contextlib import closing
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import json
import logging
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import threading
import time
from urllib.parse import urlencode


def run():
    root = Path(__file__).resolve().parents[3]
    with tempfile.TemporaryDirectory(prefix="official-gallery-test-") as tmp:
        for key in list(os.environ):
            if key.startswith(("IRIDESCENTLY_", "LAB_", "USSO_", "HX_", "TURNSTILE_")):
                os.environ.pop(key)
        os.environ.update(IRIDESCENTLY_STORAGE_ROOT=tmp, IRIDESCENTLY_ENVIRONMENT="test")
        sys.path[:0] = [str(root / "apps/huiguan"), str(root / "services/platform")]
        from storage_paths import initialize_storage
        initialize_storage()
        import server_huiguan as site
        from site_domains import site_url
        host = site_url("huiguan").split("://", 1)[1]
        with ThreadingHTTPServer(("127.0.0.1", 0), site.Handler) as server:
            threading.Thread(target=server.serve_forever, daemon=True).start()
            try:
                for size in (100, 1000, 5000):
                    database = str(Path(tmp) / f"world-{size}.db")
                    site.WV_DB = database
                    with closing(sqlite3.connect(database)) as db, db:
                        db.executescript("""
                            CREATE TABLE characters (
                                id INTEGER PRIMARY KEY, name TEXT, aliases TEXT, type TEXT,
                                thumb_path TEXT, completeness INTEGER, merged_to TEXT, category TEXT);
                            CREATE TABLE character_images (
                                id INTEGER PRIMARY KEY, character_id INTEGER, image_path TEXT, sort_order INTEGER);
                            CREATE INDEX test_character_images_owner ON character_images(character_id);
                            CREATE VIEW v_character_gallery AS SELECT * FROM characters;
                        """)
                        db.executemany("INSERT INTO characters VALUES (?,?,?,?,?,?,?,?)", (
                            (i, f"Fixture {i // 4:04d}", "seek" if i % 2 else "", "", "",
                             i % 9, 1 if i % 19 == 0 else None, "同人角色" if i % 23 == 0 else "")
                            for i in range(1, size + 1)))
                        expected = [row[0] for row in db.execute("""
                            SELECT id FROM characters WHERE aliases='seek' AND completeness BETWEEN 2 AND 6
                            AND merged_to IS NULL AND category!='同人角色' ORDER BY name,id
                        """)]
                    # Cold read includes view, search, count, and thumbnail lookup.
                    def page(number):
                        arg = urlencode({"q": "seek", "min": 2, "max": 6, "limit": 60, "page": number})
                        with closing(HTTPConnection("127.0.0.1", server.server_port, timeout=10)) as conn:
                            conn.request("GET", "/api/official/characters?" + arg, headers={"Host": host})
                            response = conn.getresponse()
                            assert response.status == 200, response.status
                            return json.loads(response.read())
                    start = time.perf_counter()
                    first = page(1)
                    elapsed = (time.perf_counter() - start) * 1000
                    assert first["total"] == len(expected)
                    pages = (first, *(page(n) for n in range(2, (len(expected) + 59) // 60 + 1)))
                    actual = [item["id"] for part in pages for item in part["characters"]]
                    assert actual == expected and len(set(actual)) == len(actual)
                    assert page(1) == first
                    print(f"Rows {size}: first filtered HTTP page {elapsed:.2f} ms; {len(actual)} exact/unique results.", flush=True)
            finally:
                server.shutdown()
                server.server_close()
                # Windows 不允许删除仍被日志处理器打开的临时文件。
                logging.shutdown()


if __name__ == "__main__":
    run()
