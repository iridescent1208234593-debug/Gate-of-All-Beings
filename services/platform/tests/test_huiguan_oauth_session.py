import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest
from email.message import Message

ROOT = Path(__file__).resolve().parents[3]
_TEMP = tempfile.TemporaryDirectory(prefix="huiguan-oauth-unit-")
sys.path.insert(0, str(ROOT / "services" / "platform"))
from testing_storage import configure
configure(_TEMP.name)
os.environ["IRIDESCENTLY_ENVIRONMENT"] = "test"
os.environ["USSO_LOGIN_ENABLED"] = "1"
os.environ["USSO_CLIENT_SECRET"] = "test-only-oauth-secret"
os.environ["HX_SSO_SECRET"] = "test-only-hx-sso-secret"
sys.path.insert(0, str(ROOT / "services" / "platform"))
spec = importlib.util.spec_from_file_location("huiguan_oauth_session_test", ROOT / "apps" / "huiguan" / "server_huiguan.py")
app = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = app
spec.loader.exec_module(app)
app.init_user_db()


class HuiguanOAuthSessionTest(unittest.TestCase):
    def test_session_is_database_backed_and_expires(self):
        sid = app.create_session("usso", "unit-user")
        self.assertEqual(app.read_session(sid), {"kind": "usso", "uid": "unit-user"})
        with app.DB_LOCK:
            conn = app.db()
            conn.execute("UPDATE sessions_db SET expires_at='2000-01-01T00:00:00+00:00' WHERE sid=?", (sid,))
            conn.commit()
            conn.close()
        self.assertIsNone(app.read_session(sid))

    def test_session_cookie_flags_are_secure_and_http_only(self):
        cookie = app.Handler._session_cookie(None, "test-session")
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Lax", cookie)
        self.assertIn("Secure", cookie)
        self.assertIn("Path=/", cookie)

    def test_shared_sso_cookie_uses_signed_test_identity_and_secure_flags(self):
        cookie = app.Handler._sso_cookie(None, "unit-user", "usso", "Unit User")
        self.assertIn("hx_sso=", cookie)
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Lax", cookie)
        self.assertIn("Secure", cookie)

    def test_shared_cookie_scope_and_audience_follow_each_root(self):
        roots = ("iridescently.xyz", "iridescently.cn", "iridescently.dpdns.org")
        for root in roots:
            with self.subTest(root=root):
                request = FakeRequest("huiguan." + root)
                sso = app.Handler._sso_cookie(request, "unit-user", "usso", "Unit User")
                self.assertIn("Path=/; Domain=." + root, sso)
                token = sso.split("hx_sso=", 1)[1].split(";", 1)[0]
                payload = app.hx_sso.verify_token(token, root)
                self.assertEqual((payload["uid"], payload["aud"]), ("unit-user", root))
                for other in set(roots) - {root}:
                    self.assertIsNone(app.hx_sso.verify_token(token, other))
                self.assertIn("Path=/; Domain=." + root,
                              app.Handler._session_cookie(request, "test-session"))
                self.assertIn("Domain=." + root, app.Handler._sso_clear_cookie(request))

    def test_sessions_are_bound_to_the_root_that_issued_them(self):
        sid = app.create_session("local", "unit-root-user", "iridescently.cn")
        self.assertEqual(app.read_session(sid, "iridescently.cn"), {"kind": "local", "uid": "unit-root-user"})
        self.assertIsNone(app.read_session(sid, "iridescently.xyz"))
        self.assertIsNone(app.read_session(sid, "iridescently.dpdns.org"))
        legacy = app.create_session("local", "unit-legacy-user")
        self.assertIsNotNone(app.read_session(legacy, "iridescently.xyz"))
        self.assertIsNone(app.read_session(legacy, "iridescently.cn"))

    def test_login_on_a_root_without_a_registered_callback_never_leaves_that_root(self):
        registered = FakeRequest("huiguan.iridescently.xyz")
        app.Handler._api_sso_login(registered)
        location = dict(item[1:] for item in registered.sent if item[0] == "header")["Location"]
        self.assertTrue(location.startswith(app.SSO_AUTHORIZE + "?"))
        self.assertIn("redirect_uri=https%3A%2F%2Fhuiguan.iridescently.xyz%2Fcb", location)
        for host in ("huiguan.iridescently.cn", "huiguan.iridescently.dpdns.org"):
            with self.subTest(host=host):
                pending = len(app.OAUTH_STATES)
                request = FakeRequest(host)
                app.Handler._api_sso_login(request)
                self.assertEqual(request.sent[0][:2], ("json", 503))
                self.assertFalse([item for item in request.sent if item[0] == "header"])
                self.assertEqual(len(app.OAUTH_STATES), pending)

    def test_callback_state_cannot_be_replayed_on_another_root(self):
        request = FakeRequest("huiguan.iridescently.xyz")
        app.Handler._api_sso_login(request)
        state = next(key for key, value in app.OAUTH_STATES.items() if value["callback"] == "https://huiguan.iridescently.xyz/cb")
        replay = FakeRequest("huiguan.iridescently.cn")
        app.Handler._api_callback(replay, {"state": [state], "code": ["mock-code"]})
        self.assertEqual(replay.sent[0][:2], ("json", 400))
        self.assertNotIn(state, app.OAUTH_STATES)


class FakeRequest:
    """Only the request facts the login handlers read; responses are recorded."""
    def __init__(self, host):
        self.headers = Message()
        self.headers["Host"] = host
        self._external_host = host
        self.client_address = ("127.0.0.1", 40000)
        self.sent = []

    def _oauth_callback(self):
        return app.Handler._oauth_callback(self)

    def _json(self, status, payload, **_):
        self.sent.append(("json", status, payload))

    def send_response(self, status):
        self.sent.append(("status", status))

    def send_header(self, name, value):
        self.sent.append(("header", name, value))

    def end_headers(self):
        self.sent.append(("end",))


if __name__ == "__main__":
    unittest.main()
