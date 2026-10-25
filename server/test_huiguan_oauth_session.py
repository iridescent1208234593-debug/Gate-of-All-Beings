import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
_TEMP = tempfile.TemporaryDirectory(prefix="huiguan-oauth-unit-")
os.environ["IRIDESCENTLY_PROJECT_ROOT"] = _TEMP.name
os.environ["IRIDESCENTLY_ENVIRONMENT"] = "production"
os.environ["USSO_LOGIN_ENABLED"] = "1"
os.environ["USSO_CLIENT_SECRET"] = "test-only-oauth-secret"
os.environ["HX_SSO_SECRET"] = "test-only-hx-sso-secret"
sys.path.insert(0, str(ROOT / "server"))
spec = importlib.util.spec_from_file_location("huiguan_oauth_session_test", ROOT / "portal" / "huiguan" / "server_huiguan.py")
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


if __name__ == "__main__":
    unittest.main()
