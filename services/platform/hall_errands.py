"""会馆托付（hall errands）: accept one errand, be present at its hall long enough, report it.

Display names live in TERMS so the wording can change without touching contracts: an errand
is shown as 「托付」 and being at its place as 「到场」. Code, tables and JSON keep the neutral
English names (errand, presence).

Rules:
- An account holds at most one active errand, and an errand is held by at most one account at
  a time (both enforced by partial UNIQUE indexes, so concurrent accepts cannot both win).
- Time only counts while the client says the player is present at the errand's hall
  (`present: true` and `place` equal to the errand's place). Each presence ping credits the time
  since the previous ping, capped at PRESENCE_MAX_GAP_SECONDS, so a client cannot claim more time
  than it actually spent. Presence itself is reported by the client and is not verifiable yet.
- Reporting a finished errand pays account points through account_progress (rule "errand",
  ref "errand:<run_id>"), so daily caps apply and retries cannot pay twice.

Tables live in huiguan/users.db next to the account_points ledger.
CLI: none. Mounted under /api/errands by portal_server on every host.
"""
import json
from datetime import datetime, timezone

import account_progress
from account_progress import _now, _owner

TERMS = {"errand": "托付", "presence": "到场"}

# Placeholder content until the copy team supplies real errands (see docs/api.md).
# place must match a hall name in the Godot client's data/halls.json.
ERRANDS = {
    "ximu-herbs": {"name": "帮院里翻晒药草", "place": "西木会馆", "stay_seconds": 120,
                   "desc": "药草要趁日头翻一遍。在院里待上两分钟就好。"},
    "ximu-gate": {"name": "替门房看一会儿门", "place": "西木会馆", "stay_seconds": 300,
                  "desc": "门房出去办事，请在会馆里守五分钟。"},
}
ERRAND_RULE = "errand"
PRESENCE_MAX_GAP_SECONDS = 90
HOLD_MAX_SECONDS = 24 * 3600  # an untouched active errand is released so others can take it
MAX_BODY_BYTES = 4096


def init_schema(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS hall_errand_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        errand_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        uid TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'done', 'abandoned')),
        present_seconds INTEGER NOT NULL DEFAULT 0 CHECK (present_seconds >= 0),
        last_presence_at TEXT,
        accepted_at TEXT NOT NULL,
        finished_at TEXT
    )""")
    conn.execute("""CREATE UNIQUE INDEX IF NOT EXISTS hall_errand_runs_one_per_account
        ON hall_errand_runs (kind, uid) WHERE status = 'active'""")
    conn.execute("""CREATE UNIQUE INDEX IF NOT EXISTS hall_errand_runs_one_holder
        ON hall_errand_runs (errand_id) WHERE status = 'active'""")


def open_db(project_root=None):
    conn = account_progress.open_db(project_root)
    init_schema(conn)
    return conn


def _parse(at):
    return datetime.fromisoformat(at) if at else None


def _run_view(row):
    errand = ERRANDS.get(row["errand_id"], {})
    need = int(errand.get("stay_seconds", 0))
    return {"run_id": row["id"], "errand_id": row["errand_id"], "status": row["status"],
            "present_seconds": row["present_seconds"], "stay_seconds": need,
            "can_report": row["status"] == "active" and row["present_seconds"] >= need,
            "accepted_at": row["accepted_at"], "finished_at": row["finished_at"]}


def _expire(conn, now):
    """Release active errands nobody has pinged or reported for HOLD_MAX_SECONDS."""
    cutoff = datetime.fromtimestamp(now.timestamp() - HOLD_MAX_SECONDS, timezone.utc).isoformat(timespec="seconds")
    conn.execute("""UPDATE hall_errand_runs SET status='abandoned', finished_at=?
        WHERE status='active' AND COALESCE(last_presence_at, accepted_at) < ?""",
                 (now.isoformat(timespec="seconds"), cutoff))


def _active(conn, kind, uid):
    return conn.execute("SELECT * FROM hall_errand_runs WHERE kind=? AND uid=? AND status='active'",
                        (kind, uid)).fetchone()


def board(conn, me=None, now=None):
    """Every errand, whether someone holds it, and (when logged in) this account's active run."""
    _expire(conn, now or datetime.now(timezone.utc))
    held = {r["errand_id"]: (r["kind"], r["uid"]) for r in
            conn.execute("SELECT errand_id, kind, uid FROM hall_errand_runs WHERE status='active'")}
    errands = []
    for errand_id, e in ERRANDS.items():
        holder = held.get(errand_id)
        errands.append({"errand_id": errand_id, "name": e["name"], "desc": e["desc"], "place": e["place"],
                        "stay_seconds": e["stay_seconds"], "reward": account_progress.RULES[ERRAND_RULE]["x10"] / 10,
                        "is_held": holder is not None, "is_mine": holder is not None and holder == me})
    mine = None
    if me:
        row = _active(conn, *me)
        mine = _run_view(row) if row else None
    return {"terms": TERMS, "errands": errands, "active": mine}


def accept(conn, kind, uid, errand_id, now=None):
    """Start an errand. ValueError when the account already holds one or someone else holds it."""
    if errand_id not in ERRANDS:
        raise KeyError(errand_id)
    kind, uid = _owner(kind, uid)
    now = now or datetime.now(timezone.utc)
    at = now.isoformat(timespec="seconds")
    conn.execute("BEGIN IMMEDIATE")
    try:
        _expire(conn, now)
        if _active(conn, kind, uid):
            raise ValueError("一次只能接一项%s，先完成或放弃手上那项" % TERMS["errand"])
        if conn.execute("SELECT 1 FROM hall_errand_runs WHERE errand_id=? AND status='active'", (errand_id,)).fetchone():
            raise ValueError("这项%s已经有人接了" % TERMS["errand"])
        cur = conn.execute("""INSERT INTO hall_errand_runs (errand_id, kind, uid, status, accepted_at)
            VALUES (?,?,?,'active',?)""", (errand_id, kind, uid, at))
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    return _run_view(conn.execute("SELECT * FROM hall_errand_runs WHERE id=?", (cur.lastrowid,)).fetchone())


def presence(conn, kind, uid, place, is_present, now=None):
    """Record one presence ping for the active errand and credit the time since the last one."""
    kind, uid = _owner(kind, uid)
    now = now or datetime.now(timezone.utc)
    conn.execute("BEGIN IMMEDIATE")
    try:
        row = _active(conn, kind, uid)
        if not row:
            raise LookupError("没有进行中的" + TERMS["errand"])
        here = bool(is_present) and place == ERRANDS[row["errand_id"]]["place"]
        credit = 0
        last = _parse(row["last_presence_at"])
        if here and last is not None:
            credit = max(0, min(PRESENCE_MAX_GAP_SECONDS, int((now - last).total_seconds())))
        # Leaving the place breaks the chain: the next ping after coming back credits nothing.
        conn.execute("UPDATE hall_errand_runs SET present_seconds=present_seconds+?, last_presence_at=? WHERE id=?",
                     (credit, now.isoformat(timespec="seconds") if here else None, row["id"]))
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    view = _run_view(conn.execute("SELECT * FROM hall_errand_runs WHERE id=?", (row["id"],)).fetchone())
    return {**view, "is_present": here, "credited_seconds": credit}


def report(conn, kind, uid, name, now=None):
    """Finish the active errand once enough present time has been recorded, and pay points."""
    kind, uid = _owner(kind, uid)
    now = now or datetime.now(timezone.utc)
    conn.execute("BEGIN IMMEDIATE")
    try:
        row = _active(conn, kind, uid)
        if not row:
            raise LookupError("没有进行中的" + TERMS["errand"])
        need = ERRANDS[row["errand_id"]]["stay_seconds"]
        if row["present_seconds"] < need:
            raise ValueError("%s时间还不够：%d / %d 秒" % (TERMS["presence"], row["present_seconds"], need))
        conn.execute("UPDATE hall_errand_runs SET status='done', finished_at=? WHERE id=?",
                     (now.isoformat(timespec="seconds"), row["id"]))
        awarded = []
        account_progress._award(conn, kind, uid, account_progress.today(now), ERRAND_RULE, "",
                                "errand:%d" % row["id"], str(name or "")[:60], awarded)
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    view = _run_view(conn.execute("SELECT * FROM hall_errand_runs WHERE id=?", (row["id"],)).fetchone())
    return {**view, "awarded": awarded}


def abandon(conn, kind, uid, now=None):
    kind, uid = _owner(kind, uid)
    now = now or datetime.now(timezone.utc)
    cur = conn.execute("UPDATE hall_errand_runs SET status='abandoned', finished_at=? "
                       "WHERE kind=? AND uid=? AND status='active'", (now.isoformat(timespec="seconds"), kind, uid))
    if cur.rowcount != 1:
        raise LookupError("没有进行中的" + TERMS["errand"])
    return {"ok": True}


def clean_body(body, *fields):
    if not isinstance(body, dict):
        raise ValueError("请求格式错误")
    out = {}
    for field in fields:
        value = body.get(field)
        if field == "errand_id" and (not isinstance(value, str) or value not in ERRANDS):
            raise ValueError("没有这项" + TERMS["errand"])
        if field == "place" and not isinstance(value, str):
            raise ValueError("缺少所在地点")
        if field == "is_present" and not isinstance(value, bool):
            raise ValueError("缺少是否到场")
        out[field] = value
    return out


# ---------- HTTP (mounted at /api/errands/* on every host by portal_server) ----------

def handle(handler, method, path, project_root=None):
    """Serve one /api/errands request. Identity is the shared hx_sso cookie, as in account_progress."""
    import hx_sso
    from account_profile import resolve_sso_identity
    from site_domains import request_origin_allowed
    from urllib.parse import urlsplit

    def send(status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        handler.send_response(status)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("Content-Length", str(len(data)))
        handler.end_headers()
        if method != "HEAD":
            handler.wfile.write(data)

    payload = hx_sso.read_cookie(handler.headers)
    ident = resolve_sso_identity(payload, project_root) if payload else None
    me = (ident["kind"], ident["uid"]) if ident else None
    route = urlsplit(path).path
    conn = open_db(project_root)
    try:
        if method in ("GET", "HEAD") and route == "/api/errands":
            return send(200, {"logged_in": bool(me), **board(conn, me)})
        if method != "POST" or route not in ("/api/errands/accept", "/api/errands/presence",
                                             "/api/errands/report", "/api/errands/abandon"):
            return send(404, {"error": "接口不存在"})
        if not request_origin_allowed(handler):
            return send(403, {"error": "来源不被允许"})
        if "application/json" not in (handler.headers.get("Content-Type") or ""):
            return send(415, {"error": "需要 JSON"})
        try:
            length = int(handler.headers.get("Content-Length") or 0)
        except ValueError:
            length = -1
        if length <= 0 or length > MAX_BODY_BYTES:
            return send(400, {"error": "请求体无效"})
        try:
            body = json.loads(handler.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return send(400, {"error": "请求格式错误"})
        if not me:
            return send(401, {"error": "登录会馆账号后才能接%s" % TERMS["errand"]})
        try:
            fields = {"/api/errands/accept": ("errand_id",), "/api/errands/presence": ("place", "is_present")}
            args = clean_body(body, *fields.get(route, ()))
        except ValueError as error:
            return send(400, {"error": str(error)})
        try:
            if route == "/api/errands/accept":
                return send(200, accept(conn, *me, args["errand_id"]))
            if route == "/api/errands/presence":
                return send(200, presence(conn, *me, args["place"], args["is_present"]))
            if route == "/api/errands/report":
                return send(200, report(conn, *me, ident["name"]))
            return send(200, abandon(conn, *me))
        except LookupError as error:      # nothing active to act on
            return send(409, {"error": str(error)})
        except ValueError as error:       # accept: already holding / taken; report: not enough presence
            return send(409 if route == "/api/errands/accept" else 400, {"error": str(error)})
    finally:
        conn.close()
