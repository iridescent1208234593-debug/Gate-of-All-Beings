"""Loopback-only OAuth test fixture. Uses a disposable database and fake credentials."""
import argparse
from contextlib import closing
import html
import http.server
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
from urllib.parse import parse_qs, urlencode, urlsplit

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--existing-only", action="store_true", help="refuse UID values missing from the fixture database")
args = parser.parse_args()

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services" / "platform"))
os.environ["USSO_LOGIN_ENABLED"] = "1"
os.environ["IRIDESCENTLY_USSO_UID_CONTRACT"] = json.dumps({
    "field": "id", "value_type": "string", "pattern": "[a-z0-9-]{1,48}",
    "allow_new_accounts": not args.existing_only,
})
os.environ["USSO_CLIENT_SECRET"] = "test-only-oauth-secret"
os.environ["HX_SSO_SECRET"] = "test-only-hx-sso-secret"
os.environ["ACCOUNT_EMAIL_SMTP_HOST"] = ""
os.environ["TURNSTILE_SECRET"] = ""
DATA_ROOT = Path(tempfile.mkdtemp(prefix="huiguan-oauth-mock-", dir=os.environ.get("OAUTH_TEST_PARENT") or None))
from testing_storage import configure
configure(DATA_ROOT)

spec = importlib.util.spec_from_file_location("huiguan_oauth_test_app", ROOT / "apps" / "huiguan" / "server_huiguan.py")
app = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = app
spec.loader.exec_module(app)
app.init_user_db()
app.CLIENT_ID = "mock-client-id"
app.CLIENT_SECRET = "test-only-oauth-secret"
app.COOKIE_SECURE = False  # The fixture serves HTTP on loopback only.
with closing(app.db()) as conn, conn:
    conn.execute("INSERT INTO users (user_id, nickname) VALUES (?,?)", ("mock-existing-137", "既有测试用户"))
    conn.execute("INSERT INTO user_flags (kind, uid, role) VALUES ('usso', ?, 'admin')", ("mock-existing-137",))

SCENARIOS = {
    "approve": ("新用户开户", {"id": "mock-user-123", "nickname": "新测试用户"}),
    "existing": ("老用户登录", {"id": "mock-existing-137", "nickname": "既有测试用户"}),
    "field-change": ("登录身份信息缺失", {"sub": "mock-existing-137"}),
    "invalid-id": ("登录身份信息有误", {"id": None, "sub": "mock-existing-137"}),
}
if args.existing_only:
    del SCENARIOS["approve"]
    SCENARIOS["unknown"] = ("无法确认账号归属", {"id": "mock-unverified-137", "sub": "mock-existing-137"})


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

    def _page(self, title, body):
        document = (
            '<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1">'
            f'<title>{title}</title><style>'
            'body{max-width:42rem;margin:3rem auto;padding:0 1rem;font:1rem/1.7 system-ui;color:#24241e}'
            'form{margin:.7rem 0}button{padding:.5rem .8rem;font:inherit;cursor:pointer}'
            f'</style><h1>{title}</h1>{body}</html>'
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(document)))
        self.end_headers()
        self.wfile.write(document)

    def do_GET(self):
        parsed = urlsplit(self.path)
        query = parse_qs(parsed.query)
        if parsed.path == "/":
            policy = "仅允许已有测试账户" if args.existing_only else "使用已核验的模拟契约，允许新用户开户"
            hall = app.CALLBACK_URL.removesuffix("/cb")
            return self._page("西木会馆账号登录测试", (
                f'<p>{policy}。所有账号均为合成数据。</p>'
                f'<p><a href="{hall}/api/login">开始模拟登录</a></p>'
                f'<p><a href="{hall}/api/user">查看当前测试账号</a> · '
                '<a href="/__test__/counts">查看账户与会话计数</a></p>'
            ))
        if parsed.path == "/__test__/counts":
            with closing(app.db()) as conn:
                return self._json(200, {
                    "users": conn.execute("SELECT count(*) FROM users").fetchone()[0],
                    "sessions": conn.execute("SELECT count(*) FROM sessions_db").fetchone()[0],
                })
        if parsed.path == "/authorize.php":
            if query.get("client_id") != [app.CLIENT_ID] or query.get("redirect_uri") != [app.CALLBACK_URL] or not query.get("state"):
                return self._json(400, {"error": "invalid authorization request"})
            state = query["state"][0]
            self.server.states.append(state)
            choices = {scenario: label for scenario, (label, _) in SCENARIOS.items()}
            choices.update({"token-fail": "模拟登录服务异常", "deny": "取消授权"})
            controls = "".join(
                f'<form action="/{scenario}"><input type="hidden" name="state" value="{html.escape(state)}">'
                f'<button type="submit">{html.escape(label)}</button></form>'
                for scenario, label in choices.items()
            )
            return self._page("选择登录测试场景", controls + '<p><a href="/">返回测试首页</a></p>')
        scenario = parsed.path.removeprefix("/")
        if scenario in SCENARIOS or scenario in ("deny", "token-fail"):
            if not query.get("state"):
                return self._json(400, {"error": "missing state"})
            redirect = app.CALLBACK_URL + "?" + urlencode({
                "code": f"mock-{scenario}" if scenario != "deny" else "",
                "state": query["state"][0],
                **({"error": "access_denied"} if scenario == "deny" else {}),
            })
            self.send_response(302)
            self.send_header("Location", redirect)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if parsed.path == "/userinfo.php":
            authorization = self.headers.get("Authorization", "")
            scenario = authorization.removeprefix("Bearer mock-token:")
            if scenario == authorization or scenario not in SCENARIOS:
                return self._json(401, {"code": 401, "error": "invalid token"})
            return self._json(200, {"code": 200, "data": SCENARIOS[scenario][1]})
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
        code = form.get("code", [""])[0]
        scenario = code.removeprefix("mock-")
        if scenario == code or scenario not in SCENARIOS or form.get("grant_type") != ["authorization_code"]:
            return self._json(400, {"code": 400, "error": "invalid authorization code"})
        return self._json(200, {"code": 200, "access_token": f"mock-token:{scenario}"})

    def log_message(self, *_):
        pass  # Never log authorization codes, cookies, or fake credentials.


class ThreadingHTTPServer(http.server.ThreadingHTTPServer):
    daemon_threads = True


provider = ThreadingHTTPServer(("127.0.0.1", 0), Provider)
loopback_host = "localhost" if args.existing_only else "127.0.0.1"
provider.base_url = f"http://{loopback_host}:{provider.server_port}"
provider.states = []
app.SSO_AUTHORIZE = provider.base_url + "/authorize.php"
app.SSO_TOKEN = provider.base_url + "/token.php"
app.SSO_USERINFO = provider.base_url + "/userinfo.php"
application = ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
app.CALLBACK_URL = f"http://{loopback_host}:{application.server_port}/cb"

for server in (provider, application):
    threading.Thread(target=server.serve_forever, daemon=True).start()

print(json.dumps({
    "app": app.CALLBACK_URL.removesuffix("/cb"),
    "provider": provider.base_url,
    "control": provider.base_url + "/__test__/expire",
    "dataRoot": str(DATA_ROOT),
}), flush=True)

try:
    threading.Event().wait()
finally:
    application.shutdown()
    provider.shutdown()
