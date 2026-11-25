"""Same-device Windows and Android LAB account transfer."""
from __future__ import annotations

import base64
import binascii
import re
import secrets
import time
from dataclasses import dataclass
from hashlib import sha256
from urllib.parse import urlencode

import httpx
from fastapi import Request
from fastapi.responses import HTMLResponse

from .account_broker import Denied, Grant, LEASE, MAX_PENDING
from .auth import SESSION_COOKIE
from .site_domains import LAB_DIRECT_HOST

START = "/account/native/start"
AVAILABLE = "/api/account/native/available"
REDEEM = "/api/account/native/redeem"
LOCAL_PATH = "/lab-account/callback"
ANDROID_PATH = "/account/native/android/callback"
ANDROID_CALLBACK = f"https://{LAB_DIRECT_HOST}{ANDROID_PATH}"
ANDROID_METHOD = "android_app_link"
ANDROID_ASSETLINKS = "/.well-known/assetlinks.json"
ANDROID_PACKAGE = "cn.iridescently.huiguan.lab.public"
ANDROID_CERT = "57:78:FE:88:F6:09:61:66:D3:30:87:85:2E:3C:86:98:42:19:52:FB:8D:C9:5D:D1:C9:6F:14:C0:EF:51:61:92"
TRANSFER_SECONDS = 45
TOKEN = re.compile(r"[A-Za-z0-9_-]{43}")
PAGE = """<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Windows LAB Login</title><p id="status">Continue to Hall to authorize this Windows client.</p>
<button id="continue" type="button">Continue to Hall</button>
<script src="/static/native-account-start.js" defer></script></html>"""
CSP = "default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
ANDROID_PAGE = PAGE.replace("Windows LAB Login", "Android LAB Login").replace("Windows client", "Android client")
ANDROID_FALLBACK = """<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Return to LAB</title><p>The game did not open. Allow the installed LAB app to open
 supported links in Android settings, then start sign-in again from the game.</p></html>"""


def encode(raw):
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def opaque(value):
    if not isinstance(value, str) or not TOKEN.fullmatch(value):
        return False
    try:
        return encode(base64.b64decode(value + "=", altchars=b"-_", validate=True)) == value
    except (ValueError, binascii.Error):
        return False


@dataclass(frozen=True)
class Target:
    port: int | None
    state: str
    challenge: str


def target(fields, *, android=False):
    if not isinstance(fields, dict):
        raise ValueError
    if set(fields) == {"port", "state", "challenge"}:
        port = fields["port"]
        if type(port) is not int or not 49152 <= port <= 65535:
            raise ValueError
    elif android and set(fields) == {"method", "state", "challenge"} and fields["method"] == ANDROID_METHOD:
        port = None
    else:
        raise ValueError
    if not opaque(fields["state"]) or not opaque(fields["challenge"]):
        raise ValueError
    return Target(port, fields["state"], fields["challenge"])


@dataclass(frozen=True)
class Transfer:
    target: Target
    subject: str
    grant: str
    upstream_until: float
    until: float


class Native:
    def __init__(self, lab, broker, *, clock=time.monotonic):
        self.lab, self.broker, self.clock = lab, broker, clock
        self.transfers = {}

    def secure(self, request):
        return self.lab.secure(request.headers) and request.url.scheme == "https"

    def android(self, request):
        return (self.secure(request) and self.lab.cfg.account_direct_native_android_enabled is True
                and self.lab.cfg.public_host == LAB_DIRECT_HOST
                and request.headers.getlist("host") == [self.lab.cfg.public_host])

    def prune(self):
        now = self.clock()
        for key, entry in list(self.transfers.items()):
            if entry.until <= now:
                del self.transfers[key]

    def issue(self, target, subject, grant, lease):
        self.prune()
        if len(self.transfers) >= MAX_PENDING:
            raise Denied
        now = self.clock()
        code = secrets.token_urlsafe(32)
        self.transfers[self.lab.auth.token_digest(code)] = Transfer(target, subject, grant,
            now + min(lease, LEASE), now + min(lease, TRANSFER_SECONDS))
        callback = f"http://127.0.0.1:{target.port}{LOCAL_PATH}" if target.port is not None else ANDROID_CALLBACK
        return callback + ("?" if target.port is not None else "#") + urlencode({"code":code, "state":target.state})

    async def exchange(self, body):
        if set(body) != {"code", "state", "verifier"} or not all(opaque(v) for v in body.values()):
            raise ValueError
        self.prune()
        key = self.lab.auth.token_digest(body["code"])
        attempt = self.transfers.get(key)
        verifier_hash = encode(sha256(body["verifier"].encode("ascii")).digest())
        if (not attempt or not secrets.compare_digest(attempt.target.state, body["state"])
            or not secrets.compare_digest(attempt.target.challenge, verifier_hash)):
            raise Denied
        # Atomically consume before any await, including the check for website revocation.
        del self.transfers[key]
        active = await self.broker.request("direct/introspect", sub=attempt.subject, grant=attempt.grant)
        remaining = min(attempt.upstream_until - self.clock(), active.get("expires_in", 0)) if (
            isinstance(active, dict) and active.get("active") is True
            and type(active.get("expires_in")) is int) else 0
        if remaining < 1 or attempt.until <= self.clock():
            raise Denied
        token, digest = self.broker.resolve_identity(attempt.subject, None)
        self.lab.store.exec("UPDATE sessions SET expires_at=min(expires_at,?) WHERE digest=?",
                            (time.time() + remaining, digest))
        self.broker.grants[digest] = Grant(attempt.subject, attempt.grant, digest,
            self.clock() + min(15, max(1, remaining / 3)), service_prefix="direct/")
        return token

    def install(self, app):
        from fastapi.responses import JSONResponse
        from .account_direct_web import HEADERS, bounded_json, response

        @app.get(ANDROID_ASSETLINKS)
        async def assetlinks(request: Request):
            if request.url.query or not self.android(request):
                return response(404, error="not_found")
            return JSONResponse([{
                "relation": ["delegate_permission/common.handle_all_urls"],
                "target": {"namespace": "android_app", "package_name": ANDROID_PACKAGE,
                           "sha256_cert_fingerprints": [ANDROID_CERT]}
            }], headers=HEADERS)

        @app.get(ANDROID_PATH)
        async def android_fallback(request: Request):
            if not self.android(request):
                return response(404, error="not_found")
            # A browser fallback never redeems or echoes a grant; only the app may exchange it.
            return HTMLResponse(ANDROID_FALLBACK, headers=HEADERS | {"Content-Security-Policy": CSP})

        @app.get(START)
        async def start(request: Request):
            if not self.secure(request):
                return response(404, error="not_found")
            params = request.query_params
            try:
                if len(params.multi_items()) != 3:
                    raise ValueError
                fields = dict(params)
                if "port" in fields:
                    if not re.fullmatch(r"[0-9]{5}", fields["port"]):
                        raise ValueError
                    fields["port"] = int(fields["port"])
                accepted = target(fields, android=self.android(request))
            except ValueError:
                return response(400, error="invalid_request")
            return HTMLResponse(ANDROID_PAGE if accepted.port is None else PAGE,
                                headers=HEADERS | {"Content-Security-Policy": CSP})

        @app.post(REDEEM)
        async def redeem(request: Request):
            if not self.secure(request) or request.headers.getlist("origin"):
                return response(403, error="not_allowed")
            try:
                body = await bounded_json(request)
                token = await self.exchange(body)
            except Denied:
                return response(403, error="authorization_denied")
            except ValueError:
                return response(400, error="invalid_request")
            except (httpx.HTTPError, TypeError, AttributeError):
                return response(503, error="account_unavailable")
            result = response(200, ok=True, next="/admission" if self.lab.admission else "/play/")
            result.set_cookie(SESSION_COOKIE, token, max_age=self.lab.cfg.session_days * 86400,
                              secure=True, httponly=True, samesite="strict", path="/")
            return result
