"""Private, forward-only gallery audit; callers own the write transaction."""
from datetime import datetime, timezone
from hashlib import sha256
import json
import re

CONTENT_FIELDS = ("name", "type", "species", "gender", "faction", "ability",
                  "appearance", "story", "image_data", "art_source")
IMAGE = re.compile(r"/assets/uploads/[A-Za-z0-9]{16,64}\.(?:png|jpe?g|webp|gif)", re.I)
CONTACT = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?<!\w)\+?[0-9][0-9 -]{7,}[0-9](?!\w)")
RETAIN = 3


def init_schema(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS fan_history_snapshots(
        id INTEGER PRIMARY KEY AUTOINCREMENT, card_id INTEGER NOT NULL,
        recorded_at TEXT NOT NULL, fingerprint TEXT NOT NULL, content TEXT NOT NULL,
        legacy_observed INTEGER NOT NULL, truncated_fields TEXT NOT NULL)""")
    conn.execute("""CREATE INDEX IF NOT EXISTS idx_fan_history_snapshots_card
                   ON fan_history_snapshots(card_id,id DESC)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS fan_history_events(
        id INTEGER PRIMARY KEY AUTOINCREMENT, card_id INTEGER NOT NULL, action TEXT NOT NULL,
        actor_kind TEXT NOT NULL, actor_uid TEXT NOT NULL, actor_role TEXT NOT NULL, actor_name TEXT NOT NULL,
        created_at TEXT NOT NULL, previous_status TEXT, new_status TEXT,
        previous_public INTEGER, new_public INTEGER, reason TEXT NOT NULL)""")
    if "prior_review" not in {row[1] for row in conn.execute("PRAGMA table_info(fan_history_events)")}:
        conn.execute("ALTER TABLE fan_history_events ADD COLUMN prior_review TEXT")
    conn.execute("""CREATE INDEX IF NOT EXISTS idx_fan_history_events_card
                   ON fan_history_events(card_id,id DESC)""")
    conn.execute("""CREATE INDEX IF NOT EXISTS idx_fan_history_events_actor
                   ON fan_history_events(actor_kind,actor_uid,id)""")


def load(conn, card_id):
    return conn.execute("SELECT * FROM fan_characters WHERE id=?", (card_id,)).fetchone()


def safe_text(text):
    """Sanitize moderation text for the private admin response."""
    return _safe(str(text or ""))


def _content(row):
    result = {field: str(row[field] or "") for field in CONTENT_FIELDS}
    result["image_data"] = result["image_data"] if IMAGE.fullmatch(result["image_data"]) else ""
    return result


def _safe(text):
    return CONTACT.sub("[隐去联系信息]", text)


def _public_approved(row):
    return row is not None and row["is_public"] == 1 and row["review_status"] == "approved"


def _state(row):
    return (row["review_status"], row["is_public"]) if row is not None else (None, None)


def _fingerprint(row):
    return sha256(json.dumps({k: str(row[k] or "") for k in CONTENT_FIELDS},
                             ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


# Existing private event metadata carries the precise snapshot relation. Never match actor
# retrospectively by timestamps or by the card's independently mutable latest review fields.
APPROVAL_EVENT_SQL = """SELECT id FROM fan_history_events
   WHERE card_id=s.card_id AND action='review_approve'
     AND CASE WHEN json_valid(prior_review) THEN json_extract(prior_review,'$.approval_snapshot_id') END = s.id
   ORDER BY id DESC LIMIT 1"""


def _snapshot(conn, row, now, *, observed=False, explicit_approval=False, fresh_revision=False, content_digest=None):
    if not _public_approved(row):
        return
    raw = _content(row)
    content = {k: v[:16384] for k, v in raw.items()}
    truncated = [k for k, v in raw.items() if len(v) > len(content[k])]
    packed = json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    fingerprint = _fingerprint(row)
    latest = conn.execute(f"""SELECT s.id, s.fingerprint, ({APPROVAL_EVENT_SQL}) AS approval_event_id
                              FROM fan_history_snapshots s WHERE card_id=? ORDER BY id DESC LIMIT 1""",
                          (row["id"],)).fetchone()
    prior_digest = None
    if explicit_approval and latest and latest["approval_event_id"] is not None:
        metadata = conn.execute("SELECT prior_review FROM fan_history_events WHERE id=?",
                                (latest["approval_event_id"],)).fetchone()
        prior_digest = json.loads(metadata[0]).get("approval_content_digest")
    if (latest and latest["fingerprint"] == fingerprint and not fresh_revision
            and (not explicit_approval or (prior_digest is not None and prior_digest == content_digest))):
        return latest["id"] if explicit_approval else None
    snapshot = conn.execute("""INSERT INTO fan_history_snapshots(card_id,recorded_at,fingerprint,content,legacy_observed,
                               truncated_fields) VALUES(?,?,?,?,?,?)""",
                            (row["id"], now, fingerprint, packed, int(observed), json.dumps(truncated)))
    conn.execute("""DELETE FROM fan_history_snapshots WHERE card_id=? AND id NOT IN
                    (SELECT id FROM fan_history_snapshots WHERE card_id=? ORDER BY id DESC LIMIT ?)""",
                 (row["id"], row["id"], RETAIN))
    return snapshot.lastrowid


def record(conn, actor, action, before, after, *, reason="", explicit=False, prior_review=None, review_version=None, content_digest=None):
    """Persist an attributable transition in the same transaction as the active row."""
    if before is None and after is None:
        return
    if not explicit and before is not None and after is not None:
        if _state(before) == _state(after) and all(before[k] == after[k] for k in CONTENT_FIELDS):
            return
    # Caller must already have a write transaction, preventing partial history+active writes.
    if not conn.in_transaction:
        raise RuntimeError("Gallery history requires an active write transaction")
    now = datetime.now(timezone.utc).isoformat()
    _snapshot(conn, before, now, observed=True)
    old_status, old_public = _state(before)
    new_status, new_public = _state(after)
    kind, uid = str(actor["kind"]), str(actor["uid"])
    identity = conn.execute("SELECT nickname FROM local_users WHERE uid=?" if kind == "local" else
                            "SELECT nickname FROM users WHERE user_id=?", (uid,)).fetchone()
    nickname = _safe(str(identity[0] or "")[:80]) if identity else ""
    approved = action == "review_approve" and _public_approved(after)
    # A pending-to-approved transition can approve an age/lore edit absent from this
    # compact projection. Retain its own evidence even when the projection is unchanged.
    snapshot_id = _snapshot(conn, after, now, explicit_approval=approved,
                            fresh_revision=approved and old_status != "approved", content_digest=content_digest)
    if approved and snapshot_id is not None:
        prior_review = {"approval_snapshot_id": snapshot_id, "review_version": review_version,
                        "approval_content_digest": content_digest}
    conn.execute("""INSERT INTO fan_history_events(card_id,action,actor_kind,actor_uid,actor_role,actor_name,created_at,
                    previous_status,new_status,previous_public,new_public,reason,prior_review)
                    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
                        (after if after is not None else before)["id"], action, kind,
                        uid, str(actor.get("role") or ""), nickname, now,
                        old_status, new_status, old_public, new_public, str(reason or "")[:200],
                        json.dumps(prior_review, ensure_ascii=False) if prior_review is not None else None))


def unpublish_link(conn, actor, action, owner, code, *, include_posters=False):
    where = "user_kind=? AND user_uid=? AND code=? AND is_public=1"
    if not include_posters:
        where += " AND COALESCE(type,'')!='配色海报'"
    args = (*owner, code)
    before = conn.execute(f"SELECT * FROM fan_characters WHERE {where}", args).fetchall()
    if not before:
        return
    conn.execute(f"UPDATE fan_characters SET is_public=0 WHERE {where}", args)
    for row in before:
        record(conn, actor, action, row, load(conn, row["id"]))


def history(conn, card_id, *, before_event=None, content_digest=None):
    snapshots = []
    current = load(conn, card_id)
    current_approval = None
    current_fingerprint = _fingerprint(current) if _public_approved(current) else None
    latest_approval_id = conn.execute("""SELECT MAX(id) FROM fan_history_events
                                        WHERE card_id=? AND action='review_approve'""", (card_id,)).fetchone()[0]
    for row in conn.execute(f"""SELECT s.*, e.id AS approval_event_id, e.created_at AS approval_time, e.actor_name, e.actor_role,
                                      e.prior_review AS approval_metadata,
                                      (SELECT MIN(a.id) FROM fan_history_events a
                                        WHERE a.actor_kind=e.actor_kind AND a.actor_uid=e.actor_uid) AS actor_label
                               FROM fan_history_snapshots s LEFT JOIN fan_history_events e
                                 ON e.id=({APPROVAL_EVENT_SQL})
                               WHERE s.card_id=? ORDER BY s.id DESC LIMIT ?""", (card_id, RETAIN)):
        content = json.loads(row["content"])
        approval = ({"actor_name": row["actor_name"], "actor_role": row["actor_role"],
                     "actor_tag": f"#{row['actor_label']}", "approved_at": row["approval_time"]}
                    if row["actor_label"] is not None else None)
        if (not snapshots and row["fingerprint"] == current_fingerprint
                and row["approval_event_id"] == latest_approval_id and content_digest is not None
                and row["approval_metadata"] is not None
                and json.loads(row["approval_metadata"]).get("approval_content_digest") == content_digest):
            current_approval = ({**approval, "snapshot_id": row["id"]} if approval else None)
        snapshots.append({"id": row["id"], "approved_at": (approval["approved_at"] if approval else
                          (None if row["legacy_observed"] else row["recorded_at"])),
                          "recorded_at": row["recorded_at"], "legacy_observed": bool(row["legacy_observed"]),
                          "truncated_fields": json.loads(row["truncated_fields"]), "approval": approval,
                          "content": {k: _safe(v) if k != "image_data" else v for k, v in content.items()}})
    events = []
    rows = conn.execute("""SELECT e.*,
                 (SELECT MIN(a.id) FROM fan_history_events a
                   WHERE a.actor_kind=e.actor_kind AND a.actor_uid=e.actor_uid) AS actor_label
               FROM fan_history_events e WHERE e.card_id=? AND (? IS NULL OR e.id<?)
               ORDER BY e.id DESC LIMIT 51""", (card_id,before_event,before_event)).fetchall()
    for r in rows[:50]:
        events.append({**{k:r[k] for k in ("action","actor_kind","actor_role","created_at","previous_status",
                                          "new_status","previous_public","new_public")},
                       "actor_name": r["actor_name"], "actor_tag": f"#{r['actor_label']}", "reason": _safe(r["reason"])})
    return {"snapshots": snapshots, "current_approval": current_approval,
            "current_review_status": current["review_status"] if current else None,
            "current_is_public": bool(current["is_public"]) if current else None, "events": events, "next_before": rows[49]["id"] if len(rows)>50 else None}


def find(conn, name):
    rows = conn.execute("""SELECT id,name FROM fan_characters WHERE name=? COLLATE BINARY
                         AND COALESCE(type,'')!='配色海报' ORDER BY id LIMIT 21""", (name,)).fetchall()
    return {"matches": [{"id": r["id"], "name": _safe(r["name"])} for r in rows[:20]], "truncated": len(rows)>20}
