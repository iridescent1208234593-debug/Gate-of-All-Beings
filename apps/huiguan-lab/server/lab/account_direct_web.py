"""Opt-in LAB Web direct authorization. Hall transport remains an explicit contract."""
from __future__ import annotations

import asyncio
import base64
from dataclasses import dataclass
from hashlib import sha256
import json
import secrets
import time
from urllib.parse import urlencode

import httpx
from fastapi import Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from .account_broker import Denied, Grant, LEASE, MAX_PENDING, POLL, LegacyClaim, LegacyClaimConflict
from .auth import SESSION_COOKIE

TX_COOKIE = "__Host-zszm_lab_flow"
LOGIN = "/account/direct/login"
AVAILABLE = "/api/account/direct/available"
CALLBACK = "/account/direct/callback"
START = "/api/account/direct/start"
FINISH = "/api/account/direct/finish"
ISSUER_APPROVAL = "/api/lab-auth/direct/approve"
HEADERS = {"Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
           "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY"}
CLIENT_ID = "lab-web"
TTL = 300
CALLBACK_PAGE = """<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>会馆账户登录</title>
<p id="status">正在验证西木会馆账户…</p>
<script src="/static/direct-account-callback.js" defer></script></html>"""


@dataclass(frozen=True)
class Pending:
    request_id: str
    state: str
    verifier: str
    intent: str
    legacy: LegacyClaim | None
    until: float


def opaque(value):
    return isinstance(value, str) and bool(POLL.fullmatch(value))


async def bounded_json(request):
    raw = bytearray()
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
        raise ValueError
    async for chunk in request.stream():
        if len(raw) + len(chunk) > 1024:
            raise ValueError
        raw.extend(chunk)
    body = json.loads(raw)
    if not isinstance(body, dict):
        raise ValueError
    return body


def response(status, **payload):
    return JSONResponse(payload, status_code=status, headers=HEADERS)


def install(app, lab, broker):
    origin = "https://" + lab.cfg.public_host
    redirect = origin + CALLBACK
    pending = {}
    upstream_limit = asyncio.Semaphore(8)

    def correct_host(request):
        return lab.secure(request.headers)

    def same_origin(request):
        return correct_host(request) and request.headers.getlist("origin") == [origin]

    @app.get(LOGIN)
    async def direct_login(request: Request):
        from .app import WEB_STATIC, page_csp, security_headers
        if not correct_host(request) or request.url.query:
            return response(404, error="not_found")
        return security_headers(FileResponse(WEB_STATIC / "login.html", headers=HEADERS), page_csp())

    @app.get(AVAILABLE)
    async def direct_available(request: Request):
        if not correct_host(request) or request.url.query:
            return response(404, error="not_found")
        claim = broker.prepare_legacy_claim(request.cookies.get(SESSION_COOKIE))
        return response(200, issuer=broker.issuer, can_restore=claim is not None)

    @app.post(START)
    async def direct_start(request: Request):
        if not same_origin(request):
            return response(403, error="bad_origin")
        try:
            body = await bounded_json(request)
        except ValueError:
            return response(400, error="invalid_request")
        if set(body) != {"intent"} or body["intent"] not in ("login", "restore"):
            return response(400, error="invalid_request")
        old = request.cookies.get(SESSION_COOKIE)
        legacy = broker.prepare_legacy_claim(old)
        intent = body["intent"]
        if intent == "restore" and not legacy:
            return response(409, error="restore_unavailable")
        now = time.monotonic()
        for digest, attempt in tuple(pending.items()):
            if attempt.until <= now:
                pending.pop(digest, None)
        if len(pending) >= MAX_PENDING or upstream_limit.locked():
            return response(429, error="account_busy")
        state, verifier, tx = (secrets.token_urlsafe(32) for _ in range(3))
        challenge = base64.urlsafe_b64encode(sha256(verifier.encode("ascii")).digest()).decode("ascii").rstrip("=")
        try:
            async with upstream_limit:
                out = await broker.request("direct/start", client_id=CLIENT_ID, redirect_uri=redirect,
                                           state=state, code_challenge=challenge, code_challenge_method="S256",
                                           intent=intent)
            rid, ttl = out.get("request_id"), out.get("expires_in")
            if not opaque(rid) or type(ttl) is not int or not 1 <= ttl <= TTL:
                raise ValueError
        except (Denied, httpx.HTTPError, ValueError, TypeError, AttributeError):
            return response(503, error="account_unavailable")
        if len(pending) >= MAX_PENDING:
            return response(429, error="account_busy")
        previous_tx = request.cookies.get(TX_COOKIE)
        if opaque(previous_tx):
            pending.pop(lab.auth.token_digest(previous_tx), None)
        pending[lab.auth.token_digest(tx)] = Pending(rid, state, verifier, intent, legacy, time.monotonic() + ttl)
        out = response(200, authorization_url=broker.issuer + ISSUER_APPROVAL + "?" + urlencode({"request_id": rid}))
        out.set_cookie(TX_COOKIE, tx, max_age=ttl, secure=True, httponly=True, samesite="lax", path="/")
        return out

    @app.get(CALLBACK)
    async def direct_callback(request: Request):
        if not correct_host(request) or request.url.query:
            return response(400, error="invalid_callback")
        return HTMLResponse(CALLBACK_PAGE, headers=HEADERS | {
            "Content-Security-Policy": "default-src 'none'; script-src 'self'; connect-src 'self'; "
                                      "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        })

    @app.post(FINISH)
    async def direct_finish(request: Request):
        if not same_origin(request):
            return response(403, error="bad_origin")
        try:
            body = await bounded_json(request)
        except ValueError:
            return response(400, error="invalid_request")
        if set(body) != {"code", "state"} or not all(opaque(v) for v in body.values()):
            return response(400, error="invalid_request")
        tx = request.cookies.get(TX_COOKIE)
        key = lab.auth.token_digest(tx) if opaque(tx) else ""
        attempt = pending.get(key)
        if not attempt or attempt.until <= time.monotonic() or not secrets.compare_digest(attempt.state, body["state"]):
            return response(403, error="invalid_transaction")
        old = request.cookies.get(SESSION_COOKIE)
        if attempt.intent == "restore":
            current = broker.prepare_legacy_claim(old)
            if not current or not secrets.compare_digest(current.session_digest, attempt.legacy.session_digest):
                return response(403, error="restore_unavailable")
        if upstream_limit.locked():
            return response(429, error="account_busy")
        pending.pop(key, None)
        valid_grant = None
        try:
            async with upstream_limit:
                out = await broker.request("direct/redeem", request_id=attempt.request_id, client_id=CLIENT_ID,
                                           redirect_uri=redirect, state=attempt.state,
                                           code=body["code"], code_verifier=attempt.verifier)
            subject, grant, valid_for = (out.get(k) for k in ("sub", "grant", "expires_in"))
            if not opaque(subject) or not opaque(grant) or type(valid_for) is not int or valid_for < 1:
                raise ValueError
            valid_grant = (subject, grant)
            if out.get("intent") != attempt.intent:
                raise Denied
            if attempt.intent == "restore":
                token, digest = broker.finish_legacy_claim(subject, attempt.legacy, old, restore_confirmed=True)
            else:
                token, digest = broker.resolve_identity(subject, None)
            now = time.time()
            lease = min(LEASE, valid_for)
            lab.store.exec("UPDATE sessions SET expires_at=min(expires_at,?) WHERE digest=?", (now + lease, digest))
            broker.grants[digest] = Grant(subject, grant, digest, time.monotonic() + min(15, max(1, lease / 3)),
                                           service_prefix="direct/")
            result = response(200, next="/admission" if lab.admission else "/play/")
            result.set_cookie(SESSION_COOKIE, token, max_age=lab.cfg.session_days * 86400, secure=True,
                              httponly=True, samesite="strict", path="/")
        except (Denied, ValueError, TypeError, AttributeError, httpx.HTTPError) as error:
            if valid_grant:
                try:
                    await broker.request("direct/revoke", sub=valid_grant[0], grant=valid_grant[1])
                except (Denied, ValueError, httpx.HTTPError):
                    pass
            if isinstance(error, LegacyClaimConflict):
                result = response(409, error="restore_conflict")
            elif isinstance(error, Denied):
                result = response(403, error="authorization_denied")
            else:
                result = response(503, error="account_unavailable")
        result.delete_cookie(TX_COOKIE, secure=True, httponly=True, samesite="lax", path="/")
        return result
