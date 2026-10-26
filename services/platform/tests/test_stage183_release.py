"""Stage 1.8.3 regression checks. Run: python -X utf8 services/platform/tests/test_stage183_release.py

Temporary files only. Covers: Cards import/release boundary (R6), Cards session races (R1),
immutable-cache rule and real response headers (R4).
"""
import http.client
import http.server
import importlib.util
import inspect
import os
from pathlib import Path
import sys
import tempfile
import threading
import time

SERVER_DIR = Path(__file__).resolve().parents[1]  # services/platform
sys.path.insert(0, str(SERVER_DIR))
from base_static import BaseStaticHandler, HASHED_ASSET  # noqa: E402

CARDS = SERVER_DIR.parents[1] / "apps" / "cards" / "server.py"


def load_cards(project_root):
    from testing_storage import configure
    configure(project_root)
    os.environ["PORT"] = "0"
    spec = importlib.util.spec_from_file_location("cards_server_under_test", CARDS)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_hashed_asset_rule():
    for path in ("/assets/index-DWinRAgE.js", "/assets/style-a1b2c3d4.css", "/assets/x-Ab_cD-eF.js", "/portal/www/assets/a-1234abcd.png"):
        assert HASHED_ASSET.search(path), path
    for path in ("/assets/site-language.js", "/assets/white-tiger.svg", "/assets/oc-avatar-q.svg", "/assets/wechat-group-qr.png", "/assets/chunk-abcdefgh.js", "/index.html"):
        assert not HASHED_ASSET.search(path), path


def test_cache_headers():
    with tempfile.TemporaryDirectory() as directory:
        assets = Path(directory, "assets")
        assets.mkdir()
        for name in ("index-DWinRAgE.js", "site-language.js", "wechat-group-qr.png"):
            assets.joinpath(name).write_bytes(b"x")
        Path(directory, "index.html").write_text("<p>x</p>")

        class Handler(BaseStaticHandler):
            _static_dir = directory

            def log_message(self, *args):
                pass

        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            def cache_control(path):
                connection = http.client.HTTPConnection("127.0.0.1", server.server_port)
                connection.request("GET", path)
                response = connection.getresponse()
                response.read()
                connection.close()
                return response.status, response.getheader("Cache-Control") or ""
            status, value = cache_control("/assets/index-DWinRAgE.js")
            assert status == 200 and "immutable" in value, (status, value)
            for path in ("/assets/site-language.js", "/assets/wechat-group-qr.png", "/index.html"):
                status, value = cache_control(path)
                assert status == 200 and "immutable" not in value, (path, status, value)
            assert "no-store" in cache_control("/index.html")[1]
        finally:
            server.shutdown()
            server.server_close()


def test_cards_import_boundary():
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        (root / "apps" / "cards").mkdir(parents=True)
        (root / "services" / "platform" / "base_static.py").write_text("raise RuntimeError('source-tree base_static imported')\n")
        module = load_cards(root)
        origin = Path(sys.modules["base_static"].__file__).resolve()
        assert origin == (SERVER_DIR / "base_static.py").resolve(), origin
        assert Path(module.USER_DB).resolve().is_relative_to(root.resolve()), module.USER_DB  # data stays under PROJECT_ROOT
        sys.modules.pop("cards_server_under_test", None)


def test_cards_session_races():
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        (root / "apps" / "cards").mkdir(parents=True)
        module = load_cards(root)
        old_interval = sys.getswitchinterval()
        sys.setswitchinterval(1e-6)
        params = list(inspect.signature(module.Session.__init__).parameters)[1:]

        class Request:
            def __init__(self, sid):
                self.headers = {"Cookie": f"zszm_sid={sid}"}

        errors = []
        threads_per_round = 8

        def make(sid, ttl):
            module.sessions[sid] = module.Session(*(["x"] * (len(params) - 1) + [time.time() + ttl]))

        def race(sid, body):
            barrier = threading.Barrier(threads_per_round)

            def run():
                barrier.wait()
                try:
                    body(sid)
                except Exception as exc:  # any exception here is a race failure
                    errors.append(repr(exc))
            workers = [threading.Thread(target=run) for _ in range(threads_per_round)]
            for worker in workers:
                worker.start()
            for worker in workers:
                worker.join()
        try:
            for i in range(3000):
                make(f"expired{i}", -1)
                race(f"expired{i}", lambda sid: module._get_session(Request(sid)))
            for i in range(500):
                module.state_map[f"state{i}"] = "x"
                winners = []
                race(f"state{i}", lambda state: winners.append(module.state_map.pop(state, None)))
                assert sum(item is not None for item in winners) == 1, "OAuth state must be single-use"
        finally:
            sys.setswitchinterval(old_interval)
            sys.modules.pop("cards_server_under_test", None)
        assert not errors, (len(errors), errors[:3])


if __name__ == "__main__":
    for name, test in sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)):
        test()
        print("PASS:", name)
