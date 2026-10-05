import json
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

from portal.huiguan import server_huiguan as huiguan


class GameSaveScopeTest(unittest.TestCase):
    def test_softie_cloud_profile_keeps_management_save(self):
        previous_load, previous_save = huiguan.load_game_saves, huiguan.save_game_saves
        saves = {"account-1": {"state": {"management": "kept"}}}
        huiguan.load_game_saves = lambda: saves
        huiguan.save_game_saves = lambda value: saves.update(value)

        class TestHandler(huiguan.Handler):
            def _require_ident(self):
                return {"uid": "account-1", "nickname": "灵主"}

        server = ThreadingHTTPServer(("127.0.0.1", 0), TestHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}"
        try:
            preflight = urllib.request.Request(f"{base}/api/game/save?scope=softie", method="OPTIONS",
                headers={"Origin": "http://127.0.0.1:4173", "Access-Control-Request-Method": "POST"})
            with urllib.request.urlopen(preflight) as response:
                self.assertEqual(response.headers["Access-Control-Allow-Origin"], "http://127.0.0.1:4173")
            body = json.dumps({"state": {"skin": "bud", "size": 1.2}}).encode()
            request = urllib.request.Request(f"{base}/api/game/save?scope=softie", data=body,
                headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(request) as response:
                self.assertEqual(response.status, 200)

            for path, expected in (("/api/game/load?scope=softie", {"skin": "bud", "size": 1.2}),
                                   ("/api/game/load", {"management": "kept"})):
                with urllib.request.urlopen(base + path) as response:
                    self.assertEqual(json.load(response)["state"], expected)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)
            huiguan.load_game_saves, huiguan.save_game_saves = previous_load, previous_save


if __name__ == "__main__":
    unittest.main()
