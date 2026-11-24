"""Opt-in LAB account handoff. Per-process grants never reach the client or disk."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import re
import secrets
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlencode, urlsplit

import httpx

from .auth import SESSION_COOKIE
from fastapi import Request
from fastapi.responses import JSONResponse

ID = re.compile(r"[A-Za-z0-9_-]{12,200}")
POLL = re.compile(r"[A-Za-z0-9_-]{43}")
MAX_PENDING = 256
LEASE = 45


def approved_issuers():
    source = Path(__file__).resolve().parents[4] / "packages" / "site-domains" / "domains.json"
    domains = json.loads(source.read_text(encoding="utf-8"))
    prefix = domains["services"]["huiguan"]
    return {f"https://{prefix}.{root}" for root in domains["roots"]}


class Denied(Exception):
    pass


class LegacyClaimConflict(Denied):
    """An identity is already linked; do not merge or switch profiles."""


@dataclass(frozen=True)
class LegacyClaim:
    # Server-side only. Never return digest/code_id in an HTTP response.
    session_digest: str
    code_id: str
    expires_at: float


@dataclass
class Pending:
    request_id: str
    state: str
    verifier: str
    until: float
    legacy: str | None
    retry_at: float = 0
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


@dataclass
class Grant:
    subject: str
    grant: str
    token_digest: str
    retry_at: float
    service_prefix: str = ""


class Broker:
    def __init__(self, auth, issuer, service_secret, *, loopback=False, migratable=()):
        u = urlsplit(issuer)
        if not u.hostname or u.username or u.password or u.path not in ("", "/") or u.query or u.fragment:
            raise ValueError("LAB account issuer must be a fixed origin")
        is_fixture = loopback and u.scheme == "http" and u.hostname == "127.0.0.1" and u.port
        if not is_fixture and issuer.rstrip("/") not in approved_issuers():
            raise ValueError("LAB account issuer requires an approved origin")
        self.issuer = issuer.rstrip("/")
        self.auth = auth
        self.migratable = frozenset(migratable)
        self.service_secret = service_secret
        self.pending = {}
        self.grants = {}
        self.auth.store.exec("""CREATE TABLE IF NOT EXISTS account_links(
            issuer TEXT NOT NULL, subject TEXT NOT NULL,
            code_id TEXT NOT NULL UNIQUE REFERENCES codes(id) ON DELETE CASCADE,
            PRIMARY KEY(issuer, subject))""")
        self.auth.store.exec("""CREATE TABLE IF NOT EXISTS account_sessions(
            digest TEXT PRIMARY KEY REFERENCES sessions(digest) ON DELETE CASCADE)""")
        # Upstream grants exist only in memory. On a restart, only account
        # sessions are invalidated; the persistent identities and old codes remain.
        self.auth.store.exec("DELETE FROM sessions WHERE digest IN (SELECT digest FROM account_sessions)")
        self.auth.protect_linked_codes = True

    async def request(self, name, **body):
        async with httpx.AsyncClient(timeout=5, follow_redirects=False, trust_env=False) as c:
            r = await c.post(f"{self.issuer}/api/lab-auth/{name}", json=body,
                             headers={"Authorization": f"Bearer {self.service_secret}"})
        if r.status_code in (400, 401, 403, 404, 409, 410):
            raise Denied
        r.raise_for_status()
        data = r.json()
        if not isinstance(data, dict):
            raise ValueError("unexpected account broker response")
        return data

    def expire_pending(self):
        now = time.monotonic()
        for k, p in list(self.pending.items()):
            if p.until <= now:
                self.pending.pop(k, None)

    async def start(self, legacy):
        self.expire_pending()
        if len(self.pending) >= MAX_PENDING:
            raise RuntimeError("busy")
        verifier, key = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        ref = await self.request("start", challenge=challenge)
        rid, state = ref["request_id"], ref["state"]
        match_code = ref.get("match_code")
        if not isinstance(match_code, str) or not re.fullmatch(r"[0-9]{6}", match_code):
            raise ValueError("invalid account matching code")
        if not isinstance(rid, str) or not ID.fullmatch(rid) or not isinstance(state, str) or not ID.fullmatch(state):
            raise ValueError("invalid account request")
        self.expire_pending()
        if len(self.pending) >= MAX_PENDING:
            raise RuntimeError("busy")
        wait = max(1, min(600, int(ref["expires_in"])))
        self.pending[self.auth.token_digest(key)] = Pending(rid, state, verifier, time.monotonic()+wait, legacy)
        return {"poll_key": key, "approval_url": f"{self.issuer}/api/lab-auth/approve?" + urlencode({"request_id": rid}),
                "expires_in": wait, "match_code": match_code}

    def _claimable_legacy_session(self, store, digest, now):
        return store.one("""SELECT c.id, s.expires_at FROM sessions AS s
            JOIN codes AS c ON c.id=s.code_id JOIN players AS p ON p.code_id=c.id
            WHERE s.digest=? AND s.expires_at>? AND c.status='active' AND c.role='player'
              AND NOT EXISTS(SELECT 1 FROM account_sessions WHERE digest=s.digest)
              AND NOT EXISTS(SELECT 1 FROM account_links WHERE code_id=c.id)""", (digest, now))

    def prepare_legacy_claim(self, token):
        """Secret-cookie proof for use only in a server-side direct-login transaction."""
        if not isinstance(token, str) or not POLL.fullmatch(token):
            return None
        digest = self.auth.token_digest(token)
        now = time.time()
        row = self._claimable_legacy_session(self.auth.store, digest, now)
        if not row or row["id"] not in self.migratable:
            return None
        # Shortest of the existing session and the direct transaction's expected TTL.
        return LegacyClaim(digest, row["id"], min(float(row["expires_at"]), now + 300))

    def finish_legacy_claim(self, subject, claim, token, *, restore_confirmed):
        """Call only with verified direct callback and upstream Hall subject.

        restore_confirmed comes from the server-validated Hall approval result;
        clients cannot send the subject, claim or confirmation directly here.
        """
        if (restore_confirmed is not True or not isinstance(claim, LegacyClaim)
                or not isinstance(token, str) or not POLL.fullmatch(token)
                or not isinstance(subject, str) or not ID.fullmatch(subject)
                or not secrets.compare_digest(self.auth.token_digest(token), claim.session_digest)):
            raise Denied
        recovery_token = secrets.token_urlsafe(32)
        new_digest = self.auth.token_digest(recovery_token)
        with self.auth.store.tx() as store:
            now = time.time()
            if claim.expires_at <= now:
                raise Denied
            if store.one("SELECT 1 FROM account_links WHERE issuer=? AND subject=?", (self.issuer, subject)):
                raise LegacyClaimConflict
            if store.one("SELECT 1 FROM account_links WHERE code_id=?", (claim.code_id,)):
                raise LegacyClaimConflict
            row = self._claimable_legacy_session(store, claim.session_digest, now)
            if not row or row["id"] != claim.code_id or row["id"] not in self.migratable:
                raise Denied
            cid = row["id"]
            store.exec("INSERT INTO account_links VALUES(?,?,?)", (self.issuer, subject, cid))
            removed = store.exec("""DELETE FROM sessions WHERE code_id=? AND NOT EXISTS(
                SELECT 1 FROM account_sessions WHERE digest=sessions.digest)""", (cid,)).rowcount
            store.exec("INSERT INTO sessions VALUES(?,?,?,?,?)", (new_digest, cid, now, now + LEASE, now))
            store.exec("INSERT INTO account_sessions VALUES(?)", (new_digest,))
            store.audit("hall-account", "account.claim_legacy_player", cid,
                        legacy_sessions_invalidated=removed)
        return recovery_token, new_digest

    def resolve_identity(self, subject, legacy):
        now = time.time()
        token = secrets.token_urlsafe(32)
        digest = self.auth.token_digest(token)
        with self.auth.store.tx() as store:
            existing = store.one("SELECT code_id FROM account_links WHERE issuer=? AND subject=?", (self.issuer, subject))
            if legacy:
                row = store.one("""SELECT c.id FROM sessions s JOIN codes c ON c.id=s.code_id
                    WHERE s.digest=? AND s.expires_at>? AND c.status='active' AND c.role='player'
                      AND NOT EXISTS(SELECT 1 FROM account_sessions WHERE digest=s.digest)""", (legacy, now))
                if not row or row["id"] not in self.migratable or (existing and existing["code_id"] != row["id"]):
                    raise Denied
                cid = row["id"]
                bound = store.one("SELECT 1 FROM account_links WHERE code_id=?", (cid,))
                if bound and not existing:
                    raise Denied
            elif existing:
                cid = existing["code_id"]
                if not store.one("SELECT 1 FROM codes WHERE id=? AND status='active' AND role='player'", (cid,)):
                    raise Denied
            else:
                cid = "a_" + secrets.token_hex(16)
                store.exec("INSERT INTO codes(id,digest,label,role,created_at) VALUES(?,?,?,?,?)",
                           (cid, secrets.token_hex(32), "Westwood Hall account", "player", now))
            if not existing:
                store.exec("INSERT INTO account_links VALUES(?,?,?)", (self.issuer, subject, cid))
            if legacy:
                store.exec("DELETE FROM sessions WHERE code_id=? AND NOT EXISTS("
                           "SELECT 1 FROM account_sessions WHERE digest=sessions.digest)", (cid,))
            store.exec("INSERT INTO sessions VALUES(?,?,?,?,?)", (digest, cid, now, now+LEASE, now))
            store.exec("INSERT INTO account_sessions VALUES(?)", (digest,))
        return token, digest

    async def poll(self, key, legacy):
        if not POLL.fullmatch(key):
            raise Denied
        kd = self.auth.token_digest(key)
        p = self.pending.get(kd)
        if not p or p.until < time.monotonic() or p.legacy != legacy:
            raise Denied
        async with p.lock:
            if self.pending.get(kd) is not p or p.until < time.monotonic():
                raise Denied
            if p.retry_at > time.monotonic():
                return None
            p.retry_at = time.monotonic()+2
            status = await self.request("poll", request_id=p.request_id, state=p.state)
            if status.get("status") == "pending":
                return None
            self.pending.pop(kd, None)
            if status.get("status") != "approved":
                raise Denied
            data = await self.request("redeem", request_id=p.request_id, state=p.state,
                                      code=status["code"], verifier=p.verifier)
            subject, grant = data["sub"], data["grant"]
            if not all(isinstance(v, str) and ID.fullmatch(v) for v in (subject, grant)):
                raise Denied
            try:
                token, digest = self.resolve_identity(subject, legacy)
            except Denied:
                try:
                    await self.request("revoke", sub=subject, grant=grant)
                except (Denied, httpx.HTTPError, ValueError):
                    pass
                raise
            self.grants[digest] = Grant(subject, grant, digest, time.monotonic()+15)
            return token

    async def close(self, token):
        if token:
            grant = self.grants.pop(self.auth.token_digest(token), None)
            if grant:
                try:
                    await self.request(grant.service_prefix + "revoke", sub=grant.subject, grant=grant.grant)
                except (Denied, httpx.HTTPError, ValueError):
                    pass

    async def refresh(self, g):
        try:
            r = await self.request(g.service_prefix + "introspect", sub=g.subject, grant=g.grant)
            if self.grants.get(g.token_digest) is not g:
                return
            if r.get("active") is not True:
                raise Denied
            now = time.time()
            limit = max(0, min(LEASE, int(r.get("expires_in", LEASE))))
            if not limit or not self.auth.store.exec(
                "UPDATE sessions SET expires_at=? WHERE digest=? AND expires_at>?",
                (now+limit, g.token_digest, now)).rowcount:
                raise Denied
            g.retry_at = time.monotonic()+min(15, max(1, limit/3))
        except Denied:
            self.grants.pop(g.token_digest, None)
            self.auth.store.exec("DELETE FROM sessions WHERE digest=?", (g.token_digest,))
        except (httpx.HTTPError, ValueError):
            # No renewal when the issuer is unavailable. Local lease expires closed.
            if not self.auth.store.one("SELECT 1 FROM sessions WHERE digest=? AND expires_at>?",
                                       (g.token_digest, time.time())):
                self.grants.pop(g.token_digest, None)
            g.retry_at = time.monotonic()+5

    async def maintain(self, hub):
        while True:
            self.expire_pending()
            checked = set(self.grants)
            due = [g for g in self.grants.values() if g.retry_at <= time.monotonic()][:32]
            await asyncio.gather(*(self.refresh(g) for g in due))
            for c in list(hub.conns.values()):
                if c.token and (self.auth.token_digest(c.token) in checked or self.auth.account_owns_code(c.code_id)) and not self.auth.session(c.token):
                    await hub.detach(c, "session_ended")
            await asyncio.sleep(2)


def install(app, lab, broker):
    no_cache = {"Cache-Control": "no-store"}
    # Separate rate budget limits unauthenticated work sent to the issuer.
    starts = asyncio.Semaphore(8)

    async def parse(request):
        raw = bytearray()
        async for chunk in request.stream():
            if len(raw) + len(chunk) > 2048:
                raise ValueError("oversize")
            raw.extend(chunk)
        return json.loads(raw)

    def legacy_digest(request):
        s = lab.auth.session(request.cookies.get(SESSION_COOKIE))
        if not s or s["role"] != "player" or s["code_id"] not in broker.migratable or lab.auth.account_owns_code(s["code_id"]):
            return None
        return s["digest"]

    @app.get("/account-link")
    async def link_page(request: Request):
        from .app import WEB_STATIC, security_headers, page_csp
        from fastapi.responses import FileResponse
        if not legacy_digest(request):
            return JSONResponse({"error": "no_session"}, 401, no_cache)
        return security_headers(FileResponse(WEB_STATIC / "login.html", headers=no_cache), page_csp())

    @app.get("/api/account/available")
    async def available():
        return JSONResponse({"enabled": True, "issuer": broker.issuer}, headers=no_cache)

    @app.post("/api/account/start")
    async def start(request: Request):
        if request.headers.get("origin") not in (None, *lab.cfg.origins()):
            return JSONResponse({"error": "bad_origin"}, 403, no_cache)
        try:
            body = await parse(request)
            mode = body.get("mode")
            if mode not in ("login", "link"):
                raise ValueError
            legacy = legacy_digest(request) if mode == "link" else None
            if mode == "link" and not legacy:
                raise Denied
            if starts.locked():
                return JSONResponse({"error": "account_busy"}, 429, no_cache)
            async with starts:
                result = await broker.start(legacy)
            return JSONResponse(result, headers=no_cache)
        except Denied:
            return JSONResponse({"error": "denied"}, 403, no_cache)
        except (TypeError, AttributeError, ValueError):
            return JSONResponse({"error": "bad_request"}, 400, no_cache)
        except (httpx.HTTPError, RuntimeError, KeyError):
            return JSONResponse({"error": "account_unavailable"}, 503, no_cache)

    @app.post("/api/account/poll")
    async def poll(request: Request):
        if request.headers.get("origin") not in (None, *lab.cfg.origins()):
            return JSONResponse({"error": "bad_origin"}, 403, no_cache)
        try:
            body = await parse(request)
            mode = body.get("mode")
            if mode not in ("login", "link"):
                raise ValueError
            key = body["poll_key"]
            if not isinstance(key, str) or len(key) != 43:
                raise Denied
            token = await broker.poll(key, legacy_digest(request) if mode == "link" else None)
        except Denied:
            return JSONResponse({"error": "denied"}, 403, no_cache)
        except (TypeError, AttributeError, ValueError, KeyError):
            return JSONResponse({"error": "bad_request"}, 400, no_cache)
        except httpx.HTTPError:
            return JSONResponse({"error": "account_unavailable"}, 503, no_cache)
        if not token:
            return JSONResponse({"status": "pending"}, headers=no_cache)
        response = JSONResponse({"status": "ok", "next": "/play/"}, headers=no_cache)
        response.set_cookie(SESSION_COOKIE, token, max_age=lab.cfg.session_days*86400, httponly=True,
                            secure=lab.secure(request.headers), samesite="strict", path="/")
        return response
