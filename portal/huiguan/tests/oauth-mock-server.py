"""Loopback-only OAuth test fixture. Uses a disposable database and fake credentials."""
import http.server
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
from urllib.parse import parse_qs, urlencode, urlsplit

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services" / "platform"))
os.environ["USSO_LOGIN_ENABLED"] = "1"
os.environ["USSO_CLIENT_SECRET"] = "test-only-oauth-secret"
os.environ["HX_SSO_SECRET"] = "test-only-hx-sso-secret"
DATA_ROOT = Path(tempfile.mkdtemp(prefix="huiguan-oauth-mock-", dir=os.environ.get("OAUTH_TEST_PARENT") or None))
from testing_storage import configure
from storage_paths import initialize_storage
configure(DATA_ROOT)
os.environ["IRIDESCENTLY_ENVIRONMENT"] = "development"
initialize_storage()

spec = importlib.util.spec_from_file_location("huiguan_oauth_test_app", ROOT / "portal" / "huiguan" / "server_huiguan.py")
app = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = app
spec.loader.exec_module(app)
app.init_user_db()
app.CLIENT_ID = "mock-client-id"
app.CLIENT_SECRET = "test-only-oauth-secret"
app.USSO_LOGIN_ENABLED = True


def local_cookie(method_name):
    original = getattr(app.Handler, method_name)
    def wrapper(handler, *args):
        return original(handler, *args).replace("; Domain=.iridescently.xyz", "")
    return wrapper


app.Handler._session_cookie = local_cookie("_session_cookie")
app.Handler._sso_cookie = local_cookie("_sso_cookie")
original_send_header = app.Handler.send_header
def local_domain_header(handler, name, value):
    if name.lower() == "set-cookie":
        value = value.replace("; Domain=.iridescently.xyz", "")
    return original_send_header(handler, name, value)
app.Handler.send_header = local_domain_header


class Provider(http.server.BaseHTTPRequestHandler):
    server_version = "MockOAuth/1"

    def _json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlsplit(self.path)
        query = parse_qs(parsed.query)
        if parsed.path == "/authorize.php":
            if query.get("client_id") != [app.CLIENT_ID] or query.get("redirect_uri") != [app.CALLBACK_URL] or not query.get("state"):
                return self._json(400, {"error": "invalid authorization request"})
            state = query["state"][0]
            self.server.states.append(state)
            body = ("<!doctype html><meta charset=utf-8><title>Mock identity</title>"
                    "<button id=approve onclick=\"location.href='" + self.server.base_url + "/approve?" +
                    urlencode({"state": state}) + "'\">Authorize mock identity</button>"
                    "<button id=tokenfail onclick=\"location.href='" + self.server.base_url + "/token-fail?" +
                    urlencode({"state": state}) + "'\">Simulate token failure</button>"
                    "<button id=deny onclick=\"location.href='" + self.server.base_url + "/deny?" +
                    urlencode({"state": state}) + "'\">Deny</button>").encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path in ("/approve", "/deny", "/token-fail"):
            if not query.get("state"):
                return self._json(400, {"error": "missing state"})
            redirect = app.CALLBACK_URL + "?" + urlencode({
                "code": "mock-code" if parsed.path == "/approve" else ("mock-token-fail" if parsed.path == "/token-fail" else ""),
                "state": query["state"][0],
                **({"error": "access_denied"} if parsed.path == "/deny" else {}),
            })
            self.send_response(302)
            self.send_header("Location", redirect)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if parsed.path == "/userinfo.php":
            if self.headers.get("Authorization") != "Bearer mock-access-token":
                return self._json(401, {"code": 401, "error": "invalid token"})
            return self._json(200, {"code": 200, "data": {
                "id": "mock-user-123", "nickname": "Mock User", "email": "mock@example.invalid",
                "picture": "https://example.invalid/avatar.png",
            }})
        if parsed.path == "/__test__/expire":
            sid = query.get("sid", [""])[0]
            with app.DB_LOCK:
                conn = app.db()
                cursor = conn.execute("UPDATE sessions_db SET expires_at='2000-01-01T00:00:00+00:00' WHERE sid=?", (sid,))
                conn.commit()
                conn.close()
            return self._json(200 if cursor.rowcount else 404, {"ok": cursor.rowcount == 1})
        if parsed.path == "/__test__/expire-state":
            state = query.get("state", [""])[0]
            with app.OAUTH_LOCK:
                if state in app.OAUTH_STATES:
                    app.OAUTH_STATES[state]["created"] = app.time.time() - 601
                    return self._json(200, {"ok": True})
            return self._json(404, {"ok": False})
        if parsed.path == "/__test__/restart-app":
            application.shutdown()
            threading.Thread(target=application.serve_forever, daemon=True).start()
            return self._json(200, {"ok": True})
        return self._json(404, {"error": "not found"})

    def do_POST(self):
        parsed = urlsplit(self.path)
        length = int(self.headers.get("Content-Length", "0"))
        form = parse_qs(self.rfile.read(length).decode())
        if parsed.path != "/token.php":
            return self._json(404, {"error": "not found"})
        if form.get("client_id") != [app.CLIENT_ID] or form.get("client_secret") != [app.CLIENT_SECRET] or form.get("redirect_uri") != [app.CALLBACK_URL]:
            return self._json(401, {"code": 401, "error": "invalid client"})
        if form.get("code") == ["mock-token-fail"]:
            return self._json(400, {"code": 400, "error": "mock token exchange failure"})
        if form.get("code") != ["mock-code"] or form.get("grant_type") != ["authorization_code"]:
            return self._json(400, {"code": 400, "error": "invalid authorization code"})
        return self._json(200, {"code": 200, "access_token": "mock-access-token", "refresh_token": "mock-refresh-token"})

    def log_message(self, *_):
        pass  # Never log authorization codes, cookies, or fake credentials.


class ThreadingHTTPServer(http.server.ThreadingHTTPServer):
    daemon_threads = True


provider = ThreadingHTTPServer(("127.0.0.1", 0), Provider)
provider.base_url = f"http://127.0.0.1:{provider.server_port}"
provider.states = []
app.SSO_AUTHORIZE = provider.base_url + "/authorize.php"
app.SSO_TOKEN = provider.base_url + "/token.php"
app.SSO_USERINFO = provider.base_url + "/userinfo.php"
application = ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
app.CALLBACK_URL = f"http://127.0.0.1:{application.server_port}/cb"

for server in (provider, application):
    threading.Thread(target=server.serve_forever, daemon=True).start()

print(json.dumps({
    "app": f"http://127.0.0.1:{application.server_port}",
    "provider": provider.base_url,
    "control": provider.base_url + "/__test__/expire",
    "dataRoot": str(DATA_ROOT),
}), flush=True)

try:
    threading.Event().wait()
finally:
    application.shutdown()
    provider.shutdown()
