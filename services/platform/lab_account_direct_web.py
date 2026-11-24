"""Default-off no-typed-code Web issuer backed by the existing Hall account session."""
from html import escape
from urllib.parse import parse_qs, urlencode, urlsplit
import base64
import hashlib
import json
import secrets

from site_domains import CONFIG

CLIENT = "lab-web"
_CALLBACK = CONFIG["labDirect"]  # fixed registered client; never derive from request or SITE_DOMAIN
REDIRECT = "https://" + _CALLBACK["host"] + _CALLBACK["callbackPath"]
APPROVE = "/api/lab-auth/direct/approve"
TTL = 300
CODE_TTL = 45
GRANT_TTL = 3600


def init_schema(db, *, default_all):
    db.execute("""CREATE TABLE IF NOT EXISTS lab_auth_direct_requests (
        request_id TEXT PRIMARY KEY, state TEXT NOT NULL, challenge TEXT NOT NULL,
        intent TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
        request_expires INTEGER NOT NULL, code_expires INTEGER,
        sub TEXT, session_rowid INTEGER, session_mac TEXT)""")
    db.execute("""CREATE TABLE IF NOT EXISTS lab_auth_direct_grants (
        grant_hash TEXT PRIMARY KEY, sub TEXT NOT NULL, expires_at INTEGER NOT NULL,
        session_rowid INTEGER NOT NULL, session_mac TEXT NOT NULL)""")
    if not default_all:
        db.execute("""DELETE FROM lab_auth_direct_grants WHERE sub IN
                      (SELECT sub FROM lab_auth_access WHERE defaulted=1)""")
        db.execute("""UPDATE lab_auth_direct_requests SET status='revoked'
                     WHERE status='approved' AND sub IN
                     (SELECT sub FROM lab_auth_access WHERE defaulted=1)""")


def invalidate(db, kind, uid):
    sel = "SELECT sub FROM lab_auth_access WHERE kind=? AND uid=?"
    key = kind, str(uid)
    db.execute(f"DELETE FROM lab_auth_direct_grants WHERE sub IN ({sel})", key)
    db.execute(f"""UPDATE lab_auth_direct_requests SET status='revoked'
                   WHERE status='approved' AND sub IN ({sel})""", key)


def api(parent, action, body):
    from lab_account_broker import _equal, _hex, VERIFIER

    is_opaque = parent._matches
    now = int(parent.now())
    if action == "start":
        if (set(body) != {"client_id", "redirect_uri", "intent", "state", "code_challenge", "code_challenge_method"}
                or body["client_id"] != CLIENT or body["redirect_uri"] != REDIRECT
                or body["intent"] not in ("login", "restore") or body["code_challenge_method"] != "S256"
                or not all(is_opaque(body, k) for k in ("state", "code_challenge"))):
            return 400, {"error": "invalid_request"}
        rid = secrets.token_urlsafe(32)
        with parent._transaction() as db:
            db.execute("DELETE FROM lab_auth_direct_requests WHERE request_expires<=?", (now,))
            db.execute("DELETE FROM lab_auth_direct_grants WHERE expires_at<=?", (now,))
            if db.execute("SELECT count(*) FROM lab_auth_direct_requests").fetchone()[0] >= 120:
                return 429, {"error": "start_limit"}
            db.execute("""INSERT INTO lab_auth_direct_requests
                (request_id,state,challenge,intent,request_expires) VALUES(?,?,?,?,?)""",
                (rid, body["state"], body["code_challenge"], body["intent"], now + TTL))
        return 200, {"request_id": rid, "expires_in": TTL}
    if action == "redeem":
        if (set(body) != {"request_id", "client_id", "redirect_uri", "state", "code", "code_verifier"}
                or body["client_id"] != CLIENT or body["redirect_uri"] != REDIRECT
                or not all(is_opaque(body,k) for k in ("request_id","state","code"))
                or not is_opaque(body,"code_verifier",VERIFIER)):
            return 400, {"error": "invalid_request"}
        rid = body["request_id"]
        challenge = base64.urlsafe_b64encode(hashlib.sha256(body["code_verifier"].encode("ascii")).digest()
                                            ).decode("ascii").rstrip("=")
        with parent._transaction() as db:
            row = db.execute("""SELECT r.*,a.kind,a.uid,a.enabled,a.defaulted FROM lab_auth_direct_requests r
                JOIN lab_auth_access a ON a.sub=r.sub WHERE r.request_id=? AND r.status='approved'
                AND r.request_expires>? AND r.code_expires>?""", (rid, now, now)).fetchone()
            if (not row or not (row["enabled"] or row["defaulted"] and parent.direct_web_default_all)
                    or not _equal(body["state"], row["state"]) or not _equal(challenge, row["challenge"])
                    or not _equal(body["code"], parent._mac("direct-code", rid))):
                return 400, {"error": "invalid_grant"}
            expiry = parent._bound_session(db, row, row, now)
            if expiry <= now:
                return 400, {"error": "invalid_grant"}
            expires = min(expiry, now + GRANT_TTL)
            grant = secrets.token_urlsafe(32)
            db.execute("UPDATE lab_auth_direct_requests SET status='redeemed' WHERE request_id=?", (rid,))
            db.execute("INSERT INTO lab_auth_direct_grants VALUES(?,?,?,?,?)",
                       (_hex(grant), row["sub"], expires, row["session_rowid"], row["session_mac"]))
            return 200, {"sub": row["sub"], "grant": grant, "expires_in": expires - now, "intent": row["intent"]}
    if action in ("introspect", "revoke"):
        if set(body) != {"sub", "grant"} or not all(is_opaque(body,key) for key in body):
            return 400, {"error": "invalid_request"}
        key = body["sub"], _hex(body["grant"])
        with parent._transaction(write=action == "revoke") as db:
            if action == "revoke":
                db.execute("DELETE FROM lab_auth_direct_grants WHERE sub=? AND grant_hash=?", key)
                return 200, {"revoked": True}
            row = db.execute("""SELECT a.kind,a.uid,g.expires_at,g.session_rowid,g.session_mac
                FROM lab_auth_direct_grants g JOIN lab_auth_access a ON a.sub=g.sub
                WHERE g.sub=? AND g.grant_hash=? AND (a.enabled=1 OR (a.defaulted=1 AND ?))""",
                (*key,parent.direct_web_default_all)).fetchone()
            expires = min(row["expires_at"], parent._bound_session(db,row,row,now)) if row else 0
            return (200, {"active": True, "expires_in": expires - now}) if expires > now else (200, {"active": False})
    return 404, {"error": "not_found"}


def approve(parent, handler, method):
    from lab_account_broker import _equal, get_access

    if method == "POST" and parent._headers(handler, "Origin") != [parent.origin]:
        return parent._page(handler, 403, "<p>请求来源不符，请从游戏重新打开。</p>")
    sid = handler._get_session()
    ident = handler._require_ident_optional() if sid else None
    if not ident:
        return parent._page(handler, 401, '<p>先在同一浏览器<a href="/account.html" target="_blank" '
                            'rel="noopener noreferrer">登录会馆</a>，再回来刷新。</p>')
    try:
        if method == "GET":
            fields = parse_qs(urlsplit(handler.path).query, max_num_fields=1, keep_blank_values=True)
            needed = {"request_id"}
        else:
            fields = parse_qs(parent._read(handler, "application/x-www-form-urlencoded"),
                              max_num_fields=3, keep_blank_values=True)
            needed = {"request_id", "csrf", "decision"}
        if set(fields) != needed or any(len(v) != 1 for v in fields.values()):
            raise ValueError
        data = {k: v[0] for k, v in fields.items()}
        rid = data["request_id"]
        if not parent._matches(data, "request_id"):
            raise ValueError
    except (ValueError, UnicodeError):
        return parent._page(handler, 400, "<p>授权请求无效，请从游戏重新打开。</p>")
    if method == "POST" and (not parent._matches(data, "csrf")
            or not _equal(data["csrf"], parent._mac("direct-csrf", rid, sid))
            or data["decision"] not in ("approve", "deny")):
        return parent._page(handler, 403, "<p>授权请求无效。</p>")
    now = int(parent.now())
    with parent._transaction(write=method=="POST") as db:
        row = db.execute("""SELECT * FROM lab_auth_direct_requests WHERE request_id=?
                           AND status='pending' AND request_expires>?""", (rid, now)).fetchone()
        if row is None:
            return parent._page(handler, 410, "<p>授权已失效，请从游戏重新开始。</p>")
        session = db.execute("SELECT rowid AS session_rowid,* FROM sessions_db WHERE sid=?", (sid,)).fetchone()
        owner = ident["kind"], str(ident["uid"])
        if (owner[0] not in ("local","usso") or not parent._session_expiry(session,ident,now)
                or not parent._active_identity(db,ident)
                or not get_access(db,*owner,default_all=parent.direct_web_default_all)):
            return parent._page(handler, 403, "<p>当前会馆账户没有此登录权限。</p>")
        intent = row["intent"]
        if method == "GET":
            action = "授权并恢复游戏旧存档" if intent == "restore" else "授权进入游戏"
            name = escape(ident.get("nickname") or ident.get("username") or "已登录")
            return parent._page(handler, 200, f'<p>当前会馆账户：{name}</p>'
                                '<p>只有你在本设备的游戏页发起请求时才继续。</p>'
                                f'<form method="post" action="{APPROVE}">'
                                f'<input type="hidden" name="request_id" value="{rid}">'
                                f'<input type="hidden" name="csrf" value="{parent._mac("direct-csrf",rid,sid)}">'
                                f'<button name="decision" value="approve">{action}</button> '
                                '<button name="decision" value="deny">拒绝</button></form>',
                                referrer_policy="same-origin", allow_direct_callback=True)
        if data["decision"] == "deny":
            db.execute("UPDATE lab_auth_direct_requests SET status='denied' WHERE request_id=?", (rid,))
            location = REDIRECT
        else:
            db.execute("""INSERT INTO lab_auth_access(kind,uid,sub,enabled,defaulted)
                       VALUES(?,?,?,0,1) ON CONFLICT(kind,uid) DO NOTHING""",
                       (*owner,secrets.token_urlsafe(32)))
            subject = db.execute("SELECT sub FROM lab_auth_access WHERE kind=? AND uid=?",owner).fetchone()[0]
            db.execute("""UPDATE lab_auth_direct_requests SET status='approved',sub=?,code_expires=?,
                session_rowid=?,session_mac=? WHERE request_id=?""",
                (subject,min(now+CODE_TTL,row["request_expires"]),session["session_rowid"],
                 parent._mac("session",sid),rid))
            location = REDIRECT + "#" + urlencode({"state":row["state"],"code":parent._mac("direct-code",rid)})
    handler.send_response(303)
    for name,value in (("Location",location),("Cache-Control","no-store"),("Referrer-Policy","no-referrer"),
                       ("Content-Security-Policy","default-src 'none'; frame-ancestors 'none'"),
                       ("X-Content-Type-Options","nosniff"),("Content-Length","0")):
        handler.send_header(name,value)
    handler.end_headers()
    return True


def handle(parent, handler, method, path):
    action = path.removeprefix("/api/lab-auth/direct/")
    if not parent.direct_web_enabled:
        return parent._response(handler, 404, {"error":"not_found"})
    if action == "approve" and method in ("GET","POST"):
        return approve(parent,handler,method)
    if method != "POST" or action not in ("start","redeem","introspect","revoke"):
        return parent._response(handler,404,{"error":"not_found"})
    auth = parent._headers(handler, "Authorization")
    if len(auth) != 1 or not secrets.compare_digest(auth[0].encode("utf-8"),
                                                    ("Bearer "+parent.bearer).encode("ascii")):
        return parent._response(handler,401,{"error":"unauthorized"})
    try:
        body = json.loads(parent._read(handler,"application/json"))
        if not isinstance(body,dict):
            raise ValueError
    except (ValueError,UnicodeError):
        return parent._response(handler,400,{"error":"invalid_request"})
    status,payload = api(parent,action,body)
    return parent._response(handler,status,payload)
