"""Huiguan creator directory. Membership, public consent, credits and LAB access are separate."""
from contextlib import closing, nullcontext
from datetime import date
import hashlib
import hmac
import json
import re
import secrets
import time
from urllib.parse import urlsplit

from account_profile import valid_asset_url
import legal_consent
from site_domains import request_origin_allowed

KINDS = ("resident_creator", "guest_creator")
FLAGS = ("public_profile", "public_avatar", "public_links", "public_contributions")
PUBLIC = "/api/creators/directory"
ME = "/api/creators/me"
ADMIN = "/api/admin/creators/"


def init_schema(conn):
    # Use one statement at a time: executescript would commit the caller's migration.
    for sql in (
        """CREATE TABLE IF NOT EXISTS creator_memberships (
            kind TEXT NOT NULL, uid TEXT NOT NULL, creator_kind TEXT
                CHECK(creator_kind IN ('resident_creator','guest_creator')),
            assignments TEXT NOT NULL, joined_on TEXT NOT NULL,
            current_work TEXT NOT NULL, PRIMARY KEY(kind,uid))""",
        """CREATE TABLE IF NOT EXISTS creator_profiles (
            kind TEXT NOT NULL, uid TEXT NOT NULL, profile_slug TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL, bio TEXT NOT NULL, links TEXT NOT NULL,
            public_profile INTEGER NOT NULL DEFAULT 0, public_avatar INTEGER NOT NULL DEFAULT 0,
            public_links INTEGER NOT NULL DEFAULT 0, public_contributions INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL, PRIMARY KEY(kind,uid))""",
        """CREATE TABLE IF NOT EXISTS creator_contributions (
            id INTEGER PRIMARY KEY, kind TEXT, uid TEXT,
            display_name TEXT NOT NULL, public_consent INTEGER NOT NULL DEFAULT 0,
            title TEXT NOT NULL, summary TEXT NOT NULL, url TEXT NOT NULL,
            completed_on TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0,
            CHECK((kind IS NULL) = (uid IS NULL)))""",
        """CREATE INDEX IF NOT EXISTS creator_contributions_owner
            ON creator_contributions(kind,uid,id)""",
        """CREATE TABLE IF NOT EXISTS creator_audit (
            id INTEGER PRIMARY KEY, actor_kind TEXT NOT NULL, actor_uid TEXT NOT NULL,
            target_kind TEXT, target_uid TEXT, event TEXT NOT NULL,
            detail TEXT NOT NULL, created_at INTEGER NOT NULL)""",
    ):
        conn.execute(sql)


def csrf(sid):
    return hmac.new(sid.encode(), b"huiguan:creators:v1", hashlib.sha256).hexdigest()


def audit(conn, actor, owner, event, detail):
    conn.execute("""INSERT INTO creator_audit
        (actor_kind,actor_uid,target_kind,target_uid,event,detail,created_at)
        VALUES (?,?,?,?,?,?,?)""",
        (actor["kind"], actor["uid"], *owner, event, json.dumps(detail), int(time.time())))


def withdraw_deleted_account(conn, actor, owner):
    if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='creator_profiles'").fetchone():
        return
    gate = conn.execute("""UPDATE creator_profiles SET public_profile=0,public_avatar=0,
          public_links=0,public_contributions=0,updated_at=? WHERE kind=? AND uid=?""",
          (int(time.time()), *owner)).rowcount
    role = conn.execute("""UPDATE creator_memberships SET creator_kind=NULL
                           WHERE kind=? AND uid=? AND creator_kind IS NOT NULL""", owner).rowcount
    if gate or role:
        audit(conn, actor, owner, "account_deleted", {"publication_withdrawn": bool(gate),
                                                       "membership_ended": bool(role)})


def _text(value, limit, *, required=False):
    if not isinstance(value, str):
        raise ValueError("文字格式不正确")
    value = value.strip()
    if (required and not value) or len(value) > limit or any(ord(c) < 32 and c != "\n" for c in value):
        raise ValueError("文字为空、过长或包含不支持的字符")
    return value


def _flag(value):
    if type(value) is not bool:
        raise ValueError("公开与授权设置必须是布尔值")
    return value


def _date(value):
    value = _text(value, 10)
    if value and date.fromisoformat(value).isoformat() != value:
        raise ValueError("日期格式应为 YYYY-MM-DD")
    return value


def _url(value):
    value = _text(value, 512)
    if not value:
        return value
    parsed = urlsplit(value)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username is not None
            or parsed.password is not None or "\\" in value or any(c.isspace() for c in value)
            or parsed.port not in (None, 443)):
        raise ValueError("只支持不含账号信息的 HTTPS 链接")
    return value


def _array(value, limit, fields):
    if not isinstance(value, list) or len(value) > limit:
        raise ValueError("条目格式不正确或数量过多")
    result = []
    for record in value:
        if not isinstance(record, dict):
            raise ValueError("条目格式不正确")
        item = {name: check(record.get(name, "")) for name, check in fields.items()}
        if item not in result:
            result.append(item)
    return result


def _owner(kind, uid):
    if (kind not in ("local", "usso") or not isinstance(uid, str)
            or not re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", uid)
            or (kind == "local" and not re.fullmatch(r"[1-9][0-9]{0,17}", uid))):
        raise ValueError("账户标识无效")
    return kind, uid


def account_exists(conn, owner, *, active=True):
    kind, uid = owner
    if kind == "local":
        q = "SELECT 1 FROM local_users WHERE uid=?"
        return bool(conn.execute(q + (" AND status='active'" if active else ""), (uid,)).fetchone())
    q = """SELECT 1 FROM users WHERE user_id=?"""
    if active:
        q += """ AND NOT EXISTS (SELECT 1 FROM user_flags
                 WHERE kind='usso' AND uid=users.user_id AND status='banned')"""
    return bool(conn.execute(q, (uid,)).fetchone())


def membership(conn, owner):
    row = conn.execute("""SELECT creator_kind,assignments,joined_on,current_work
                          FROM creator_memberships WHERE kind=? AND uid=?""", owner).fetchone()
    if not row or row["creator_kind"] is None:
        return None
    item = dict(row)
    item["assignments"] = json.loads(item["assignments"])
    return item


def profile(conn, owner):
    row = conn.execute("SELECT * FROM creator_profiles WHERE kind=? AND uid=?", owner).fetchone()
    return {
        "display_name": row["display_name"] if row else "",
        "bio": row["bio"] if row else "",
        "links": json.loads(row["links"]) if row else [],
        **{field: bool(row[field]) if row else False for field in FLAGS},
    }


class PublicationChanged(ValueError):
    pass


def _save_profile(conn, actor, owner, body, publication_version):
    before = profile(conn, owner)
    payload = {**before, **{key: val for key, val in body.items() if key in before}}
    flags = {name: _flag(payload[name]) for name in FLAGS}
    publishing = flags["public_profile"]
    name = _text(payload["display_name"], 60, required=publishing)
    bio = _text(payload["bio"], 400)
    links = _array(payload["links"], 8, {"label": lambda x: _text(x, 60, required=True), "url": _url})
    if any(not link["url"] for link in links):
        raise ValueError("作品链接不能为空")
    # Withdrawal must still work if the account has not accepted a new legal version.
    after = {"display_name": name, "bio": bio, "links": links, **flags}
    if after == before:
        return after
    enabling = any(after[key] and not before[key] for key in ("public_profile", "public_contributions"))
    if enabling and body.get("publication_version") != publication_version:
        raise PublicationChanged("公开内容已更新，请重新查看后确认")
    withdraw_only = all(after[key] == before[key] for key in ("display_name", "bio", "links")) and all(
        not after[key] or before[key] for key in FLAGS
    )
    if publishing and not withdraw_only and legal_consent.accepted(conn, *owner) is None:
        raise PermissionError("请先同意当前《用户须知》和《隐私政策》")
    conn.execute("""INSERT INTO creator_profiles
        (kind,uid,profile_slug,display_name,bio,links,public_profile,public_avatar,
         public_links,public_contributions,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(kind,uid) DO UPDATE SET display_name=excluded.display_name,
        bio=excluded.bio,links=excluded.links,public_profile=excluded.public_profile,
        public_avatar=excluded.public_avatar,public_links=excluded.public_links,
        public_contributions=excluded.public_contributions,updated_at=excluded.updated_at""",
        (*owner, secrets.token_urlsafe(18), name, bio, json.dumps(links), *flags.values(), int(time.time())))
    audit(conn, actor, owner, "profile", {
        "before": {key: before[key] for key in FLAGS}, "after": flags})
    return after


def _save_membership(conn, actor, owner, body):
    value = body.get("creator_kind")
    if "creator_kind" not in body or (value is not None and value not in KINDS):
        raise ValueError("共创身份无效")
    assignments = _array(body.get("assignments", []), 24, {
        "group": lambda x: _text(x, 40, required=True), "duty": lambda x: _text(x, 60, required=True)})
    day = _date(body.get("joined_on", ""))
    work = _text(body.get("current_work", ""), 400)
    before = membership(conn, owner)
    conn.execute("""INSERT INTO creator_memberships
        (kind,uid,creator_kind,assignments,joined_on,current_work) VALUES (?,?,?,?,?,?)
        ON CONFLICT(kind,uid) DO UPDATE SET creator_kind=excluded.creator_kind,
        assignments=excluded.assignments,joined_on=excluded.joined_on,current_work=excluded.current_work""",
        (*owner, value, json.dumps(assignments), day, work))
    after = membership(conn, owner)
    if before != after:
        # Removal does not change already authorized historical attribution.
        if after is not None:
            conn.execute("UPDATE creator_profiles SET public_profile=0 WHERE kind=? AND uid=?", owner)
        audit(conn, actor, owner, "membership", {"before": before, "after": after,
                                                  "requires_reconsent": after is not None})
    return after


def _save_contribution(conn, actor, owner, body):
    external = owner == (None, None)
    name = _text(body.get("display_name", ""), 60, required=external) if external else ""
    consent = _flag(body.get("public_consent", False)) if external else False
    approved = _flag(body.get("approved", False))
    item = (name, consent, _text(body.get("title", ""), 120, required=True),
            _text(body.get("summary", ""), 600), _url(body.get("url", "")),
            _date(body.get("completed_on", "")), approved)
    contribution_id = body.get("id")
    previous = None
    if contribution_id is None:
        contribution_id = conn.execute("""INSERT INTO creator_contributions
            (kind,uid,display_name,public_consent,title,summary,url,completed_on,approved)
            VALUES (?,?,?,?,?,?,?,?,?)""", (*owner, *item)).lastrowid
    else:
        if type(contribution_id) is not int or not 0 < contribution_id < 2**63:
            raise ValueError("贡献记录编号无效")
        previous = conn.execute("""SELECT display_name,public_consent,title,summary,url,completed_on,approved
                                    FROM creator_contributions WHERE id=? AND kind IS ? AND uid IS ?""",
                                    (contribution_id, *owner)).fetchone()
        if not previous:
            raise LookupError("该账户没有这条贡献记录")
        conn.execute("""UPDATE creator_contributions SET display_name=?,public_consent=?,
            title=?,summary=?,url=?,completed_on=?,approved=? WHERE id=? AND kind IS ? AND uid IS ?""",
            (*item, contribution_id, *owner))
    review = not external and approved and (previous is None or tuple(previous) != item)
    if review:
        conn.execute("UPDATE creator_profiles SET public_contributions=0 WHERE kind=? AND uid=?", owner)
    audit(conn, actor, owner, "contribution", {
        "id": contribution_id, "approved": approved, "public_consent": consent,
        "requires_reconsent": review})
    return contribution_id


def _contribution_public(row):
    return {key: row[key] for key in ("title", "summary", "url", "completed_on")}


def directory(conn, avatar_url=lambda s: s):
    members, credits = [], []
    contributions = {}
    for row in conn.execute("SELECT * FROM creator_contributions WHERE approved=1 ORDER BY completed_on DESC,id DESC"):
        if row["kind"] is None:
            if row["public_consent"]:
                credits.append(dict(_contribution_public(row), display_name=row["display_name"]))
        else:
            contributions.setdefault((row["kind"], row["uid"]), []).append(_contribution_public(row))
    for p in conn.execute("""SELECT p.*,m.creator_kind,m.assignments,m.joined_on,m.current_work,
                                    a.account_avatar_url
                             FROM creator_profiles p
                             LEFT JOIN creator_memberships m USING(kind,uid)
                             LEFT JOIN account_profiles a USING(kind,uid)
                             WHERE p.public_profile=1 AND p.display_name<>''
                             ORDER BY p.display_name,p.profile_slug"""):
        owner = p["kind"], p["uid"]
        if not account_exists(conn, owner):
            continue
        items = contributions.get(owner, []) if p["public_contributions"] else []
        if not p["public_links"]:
            items = [dict(item, url="") for item in items]
        if p["creator_kind"] is None:
            credits.extend(dict(item, display_name=p["display_name"]) for item in items)
            continue
        asset = p["account_avatar_url"]
        members.append({
            "display_name": p["display_name"], "profile_slug": p["profile_slug"],
            "creator_kind": p["creator_kind"], "assignments": json.loads(p["assignments"]),
            "joined_on": p["joined_on"], "current_work": p["current_work"], "bio": p["bio"],
            "links": json.loads(p["links"]) if p["public_links"] else [],
            "avatar_url": avatar_url(asset) if p["public_avatar"] and valid_asset_url(asset) else "",
            "contributions": items,
        })
    return {"members": members, "credits": credits}


def handle(handler, path, qs, ns, *, broker=None, avatar_url=lambda s: s):
    post = handler.command == "POST"
    if path == PUBLIC and not post:
        with closing(ns["db"]()) as conn:
            conn.execute("BEGIN")
            return handler._json(200, directory(conn, avatar_url), sanitize_images=False)
    action = path[len(ADMIN):] if path.startswith(ADMIN) else None
    if path != ME and (action not in ("account", "contribution", "lab-access") or (not post and action != "account")):
        return handler._json(404, {"error": "未找到"})
    origins = handler.headers.get_all("Origin", [])
    if origins and (len(origins) != 1 or not request_origin_allowed(handler, missing=False, same_service=True)):
        return handler._json(403, {"error": "请求来源无效"})
    actor = handler._require_admin() if action else handler._require_ident()
    if not actor:
        return
    sid = handler._get_session()
    if not sid:
        return handler._json(401, {"error": "会话已失效"})
    token = csrf(sid)
    body = {key: values[0] for key, values in qs.items() if values}
    if post:
        origins = handler.headers.get_all("Origin", [])
        supplied = handler.headers.get_all("X-Creator-CSRF", [])
        if (len(origins) != 1 or len(supplied) != 1 or not re.fullmatch(r"[a-f0-9]{64}", supplied[0])
                or not request_origin_allowed(handler, missing=False, same_service=True)
                or not hmac.compare_digest(token, supplied[0])):
            return handler._json(403, {"error": "请求来源或会话凭据无效"})
        media = handler.headers.get_all("Content-Type", [])
        if (len(media) != 1 or media[0].split(";", 1)[0].strip().lower() != "application/json"):
            return handler._json(415, {"error": "需要 JSON 数据"})
        if len(handler.headers.get_all("Content-Length", [])) != 1 or handler.headers.get_all("Transfer-Encoding", []):
            return handler._json(400, {"error": "请求长度无效"})
        body = handler._read_json(max_bytes=24 * 1024)
        if body is None:
            return
    actor_owner = actor["kind"], actor["uid"]
    try:
        if path == ME:
            owner = actor_owner
        elif ((action == "contribution") or (action == "account" and not post)) and (
                body.get("kind") in (None, "") and body.get("uid") in (None, "")):
            owner = None, None
        else:
            owner = _owner(body.get("kind"), body.get("uid"))
        with (ns["DB_LOCK"] if post else nullcontext()), closing(ns["db"]()) as conn, conn:
            current = ns["resolve_identity"](*actor_owner)
            conn.execute("BEGIN IMMEDIATE" if post else "BEGIN")
            # Use a pure lookup; read_session can itself acquire DB_LOCK on an expired row.
            session_ok = conn.execute("""SELECT 1 FROM sessions_db
                WHERE sid=? AND kind=? AND uid=? AND julianday(expires_at)>julianday('now')""",
                (sid, *actor_owner)).fetchone()
            if not current or not session_ok or (action and not current["is_admin"]):
                raise PermissionError("会话或权限已失效")
            if owner != (None, None) and not account_exists(conn, owner, active=False):
                raise LookupError("找不到该账户")
            if path == ME:
                approved_items = list(conn.execute("""SELECT id,title,summary,url,completed_on
                     FROM creator_contributions WHERE kind=? AND uid=? AND approved=1
                     ORDER BY completed_on DESC,id DESC""", owner))
                details = membership(conn, owner)
                version = hashlib.sha256(json.dumps(
                    [details, [dict(r) for r in approved_items]], sort_keys=True).encode()).hexdigest()
                result = {"csrf": token, "membership": details, "publication_version": version,
                          "profile": _save_profile(conn, actor, owner, body, version) if post else profile(conn, owner),
                          "contributions": [_contribution_public(r) for r in approved_items]}
            elif action == "account" and post:
                result = {"membership": _save_membership(conn, actor, owner, body)}
            elif action == "account":
                rows = conn.execute("""SELECT id,title,summary,url,completed_on,approved,display_name,public_consent
                                      FROM creator_contributions WHERE kind IS ? AND uid IS ? ORDER BY id DESC""", owner)
                result = {"csrf": token, "membership": membership(conn, owner),
                          "contributions": [dict(r, approved=bool(r["approved"]), public_consent=bool(r["public_consent"]))
                                            for r in rows],
                          "lab_available": broker is not None,
                          "lab_access": owner != (None, None) and broker.get_access(conn, *owner) if broker else False}
            elif action == "contribution":
                result = {"id": _save_contribution(conn, actor, owner, body)}
            else:
                if broker is None:
                    raise RuntimeError("LAB 账户认证尚未启用")
                enabled = _flag(body.get("enabled"))
                if enabled and not account_exists(conn, owner):
                    raise PermissionError("该账户不可用")
                before = broker.get_access(conn, *owner)
                broker.set_access(conn, *owner, enabled)
                if before != enabled:
                    audit(conn, actor, owner, "lab_access", {"before": before, "after": enabled})
                result = {"lab_access": enabled}
        return handler._json(200, {"ok": True, **result}, sanitize_images=False)
    except RuntimeError as e:
        return handler._json(503, {"error": str(e)})
    except PermissionError as e:
        return handler._json(403, {"error": str(e)})
    except LookupError as e:
        return handler._json(404, {"error": str(e)})
    except PublicationChanged as e:
        return handler._json(409, {"error": str(e), "code": "creator_publication_changed"})
    except ValueError as e:
        return handler._json(400, {"error": str(e)})
