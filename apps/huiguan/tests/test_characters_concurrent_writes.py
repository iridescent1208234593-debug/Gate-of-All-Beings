"""Concurrent role-sheet saves never drop each other's records (characters.json lost update).

characters.json holds every account's role sheets in one document, so each write is
read whole -> change one account -> write whole. Two requests that read before either
writes would each write back a copy without the other's change. The read is slowed
here to stand in for a large production file; the result must still contain every save.
Runs against the default JSON backend of oc_store, whose fenced transaction replaced update_data().
"""
import json
import os
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from http.cookies import SimpleCookie
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TEMP = tempfile.TemporaryDirectory(prefix="huiguan-concurrent-")
sys.path.insert(0, str(ROOT / "services" / "platform"))
from testing_storage import configure  # noqa: E402
configure(TEMP.name)
os.environ["HX_SSO_SECRET"] = "test-only-concurrent-secret"
sys.path.insert(0, str(ROOT / "apps" / "huiguan"))
import scraping_observer  # noqa: E402
import server_huiguan as huiguan  # noqa: E402
import oc_store  # noqa: E402

USERS = 4
SHEETS_PER_USER = 6


class Server(ThreadingHTTPServer):
    # Production serves Huiguan through portal_server with the same backlog; the default of 5
    # resets some of the simultaneous connections this test opens (ConnectionResetError on CI).
    request_queue_size = 1024


class Quiet(huiguan.Handler):
    def log_message(self, *_):
        pass


class Client:
    def __init__(self, base):
        self.base = base
        self.session = ""

    def call(self, path, body=None):
        data = None if body is None else json.dumps(body).encode()
        headers = {"Content-Type": "application/json"}
        if self.session:
            headers["Cookie"] = "session=" + self.session
        request = urllib.request.Request(self.base + path, data=data, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                cookie = SimpleCookie()
                for header in response.headers.get_all("Set-Cookie") or []:
                    cookie.load(header)
                if "session" in cookie:
                    self.session = cookie["session"].value
                return response.status, json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as error:
            with error:
                return error.code, json.loads(error.read() or b"{}")


def sheet(code):
    return {"code": code, "data": {"code": code, "name": "角色" + code, "species": "猫妖"}}


class ConcurrentCharacterWritesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        huiguan.init_user_db()
        cls.httpd = Server(("127.0.0.1", 0), Quiet)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{cls.httpd.server_port}"
        cls.clients = []
        for index in range(USERS):
            client = Client(base)
            name = f"writer_{index}"
            status, _ = client.call("/api/register", {"username": name, "password": "test-password-123", "nickname": name, "email": f"{name}@example.com"})
            assert status == 200, status
            cls.clients.append(client)

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

    def setUp(self):
        original = oc_store.JsonSession.__init__

        def slow_read(session, data, conn):
            original(session, data, conn)
            time.sleep(0.02)

        oc_store.JsonSession.__init__ = slow_read
        self.addCleanup(setattr, oc_store.JsonSession, "__init__", original)

    def saved_codes(self, client):
        status, body = client.call("/api/get-characters")
        self.assertEqual(status, 200)
        return sorted(c["code"] for c in body["characters"])

    def test_parallel_saves_from_many_accounts_all_survive(self):
        jobs = [(client, f"U{u}-{n}") for u, client in enumerate(self.clients) for n in range(SHEETS_PER_USER)]
        with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
            statuses = list(pool.map(lambda job: job[0].call("/api/save-character", sheet(job[1]))[0], jobs))
        self.assertEqual(statuses, [200] * len(jobs))
        for u, client in enumerate(self.clients):
            self.assertEqual(self.saved_codes(client), sorted(f"U{u}-{n}" for n in range(SHEETS_PER_USER)))

    def test_save_all_does_not_erase_another_accounts_concurrent_save(self):
        first, second = self.clients[0], self.clients[1]
        roster = [sheet(f"R-{n}")["data"] for n in range(3)]

        def replace_roster():
            return first.call("/api/save-all-characters", {"characters": roster})[0]

        def add_sheet(n):
            return second.call("/api/save-character", sheet(f"S-{n}"))[0]

        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(replace_roster)] + [pool.submit(add_sheet, n) for n in range(7)]
            self.assertEqual([f.result() for f in futures], [200] * 8)
        self.assertEqual(self.saved_codes(first), ["R-0", "R-1", "R-2"])
        self.assertTrue({f"S-{n}" for n in range(7)} <= set(self.saved_codes(second)))

    def test_every_write_goes_through_oc_store(self):
        # A read-modify-write outside oc_store's fenced transaction reintroduces the lost update.
        source = (ROOT / "apps" / "huiguan" / "server_huiguan.py").read_text(encoding="utf-8")
        callers = [line.strip() for line in source.splitlines()
                   if ("save_data(" in line or "open(DATA_FILE" in line or "atomic_json(" in line) and "def " not in line]
        self.assertEqual(callers, [], "write characters.json only through oc_store transactions")


if __name__ == "__main__":
    unittest.main()
