"""Onboarding Progress: how far an Account has come through the new-player guide, per chapter.

The guide has three chapters that teach different things and never repeat each other
(see docs/development/GLOSSARY.md, "Onboarding Progress"):

* ``world``    — main site: what 众生之门 and 西木会馆 are and how to take part.
* ``identity`` — 西木会馆: sign in, register an OC, browse the gallery, find the hall's features.
* ``life``     — LAB game: move, chat, interact, journal, spirit space, planting, mini-games.
                 Stored by the LAB server against its own player (it never sees the Account),
                 so it is not a chapter of this table.

Owner is the Account ``(kind, uid)``; one row per chapter. Visitors keep the same shape in the
browser (``localStorage``) and the page merges it in after sign-in with ``merge=True``, which can
only move a chapter forward, never back.

Accounts that already used the site before the guide existed are "veteran": the first read
records the chapter as finished so a release never forces anyone through it again. A chapter can
always be reopened from the guide menu (``reset``), which is the "重新查看" action.
"""

import json
import time

CHAPTERS = ("world", "identity")

# ``active``: being shown; ``paused``: the player closed it for now and it waits in the guide
# menu; ``completed``/``skipped``/``veteran`` are finished and are never shown on their own again.
STATUSES = ("active", "paused", "completed", "skipped", "veteran")
FINISHED = ("completed", "skipped", "veteran")

MAX_SEEN_COUNT = 64
MAX_STEP_KEY_LENGTH = 40

# Accounts that accepted the terms before this moment existed before the guide shipped.
# Unix seconds; 2026-11-25 00:00 UTC+8.
ROLLOUT_AT = 1795536000.0


def init_schema(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS onboarding_progress (
            kind TEXT NOT NULL,
            uid TEXT NOT NULL,
            chapter TEXT NOT NULL,
            status TEXT NOT NULL,
            seen_json TEXT NOT NULL DEFAULT '[]',
            started_at REAL NOT NULL,
            updated_at REAL NOT NULL,
            PRIMARY KEY (kind, uid, chapter)
        )"""
    )


def clean_seen(value):
    """Step keys are short identifiers chosen by the page; anything else is dropped."""
    if not isinstance(value, (list, tuple)):
        return []
    out = []
    for item in value:
        if not isinstance(item, str):
            continue
        key = item.strip()
        if not key or len(key) > MAX_STEP_KEY_LENGTH:
            continue
        if not all(ch.isalnum() or ch in "-_." for ch in key):
            continue
        if key not in out:
            out.append(key)
        if len(out) >= MAX_SEEN_COUNT:
            break
    return out


def _row(conn, kind, uid, chapter):
    return conn.execute(
        "SELECT status, seen_json, started_at, updated_at FROM onboarding_progress WHERE kind=? AND uid=? AND chapter=?",
        (str(kind), str(uid), chapter),
    ).fetchone()


def _shape(row):
    if not row:
        return {"status": "new", "seen": []}
    try:
        seen = clean_seen(json.loads(row[1] or "[]"))
    except ValueError:
        seen = []
    return {"status": row[0], "seen": seen, "updated_at": row[3]}


def _write(conn, kind, uid, chapter, status, seen, now):
    existing = _row(conn, kind, uid, chapter)
    started = existing[2] if existing else now
    conn.execute(
        """INSERT INTO onboarding_progress (kind, uid, chapter, status, seen_json, started_at, updated_at)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(kind, uid, chapter) DO UPDATE SET
             status=excluded.status, seen_json=excluded.seen_json, updated_at=excluded.updated_at""",
        (str(kind), str(uid), chapter, status, json.dumps(seen, ensure_ascii=False), started, now),
    )


def is_veteran(conn, kind, uid, has_oc=False):
    """True when the Account was in use before the guide shipped.

    Signals: owns at least one OC, or accepted the terms before ``ROLLOUT_AT`` (every
    registration records a Legal Consent, so this covers accounts without an OC too).
    """
    if has_oc:
        return True
    try:
        row = conn.execute(
            "SELECT MIN(accepted_at) FROM legal_consents WHERE kind=? AND uid=?", (str(kind), str(uid))
        ).fetchone()
    except Exception:  # legal_consents not initialised in this database
        return False
    return bool(row and row[0] is not None and float(row[0]) < ROLLOUT_AT)


def status(conn, ident, has_oc=False, now=None):
    """Public shape for GET /api/onboarding. ``ident`` is None for a visitor.

    The first read for a veteran Account stores every chapter as ``veteran`` so the answer
    stays the same after the Account later registers an OC or the rollout date passes.
    """
    out = {"logged_in": bool(ident), "chapters": {}}
    if not ident:
        return out
    kind, uid = ident["kind"], ident["uid"]
    rows = {chapter: _row(conn, kind, uid, chapter) for chapter in CHAPTERS}
    if not any(rows.values()) and is_veteran(conn, kind, uid, has_oc):
        stamp = float(now if now is not None else time.time())
        for chapter in CHAPTERS:
            _write(conn, kind, uid, chapter, "veteran", [], stamp)
        rows = {chapter: _row(conn, kind, uid, chapter) for chapter in CHAPTERS}
    for chapter in CHAPTERS:
        out["chapters"][chapter] = _shape(rows[chapter])
    return out


def update(conn, ident, chapter, *, status=None, seen=None, reset=False, merge=False, now=None):
    """Apply one change from the page; returns the chapter's new shape.

    * ``seen`` adds step keys (union; order kept).
    * ``status`` sets the chapter status. With ``merge`` (guest progress carried into an
      Account after sign-in) a finished chapter is never reopened and ``paused`` never
      replaces ``active``.
    * ``reset`` reopens the chapter from the beginning (the "重新查看" action).
    """
    if chapter not in CHAPTERS:
        raise ValueError("unknown_chapter")
    if status is not None and status not in STATUSES:
        raise ValueError("unknown_status")
    if status == "veteran":
        raise ValueError("unknown_status")  # only the server decides that
    kind, uid = ident["kind"], ident["uid"]
    stamp = float(now if now is not None else time.time())
    current = _shape(_row(conn, kind, uid, chapter))
    if reset:
        _write(conn, kind, uid, chapter, "active", [], stamp)
        return _shape(_row(conn, kind, uid, chapter))
    new_status = current["status"] if current["status"] != "new" else "active"
    if status is not None:
        if merge and current["status"] in FINISHED:
            pass
        elif merge and status == "paused" and current["status"] == "active":
            pass
        else:
            new_status = status
    merged = clean_seen(current["seen"] + clean_seen(seen or []))
    _write(conn, kind, uid, chapter, new_status, merged, stamp)
    return _shape(_row(conn, kind, uid, chapter))
