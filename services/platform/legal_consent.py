"""Legal Consent: which version of 《用户须知》 and 《隐私政策》 an Account agreed to, and when.

The two documents are published together as one Legal Version (see docs/development/GLOSSARY.md).
The pages are apps/huiguan/terms.html and apps/huiguan/privacy.html; each carries
``data-legal-version`` and a test keeps it equal to ``CURRENT_VERSION``.

Owner is the Account ``(kind, uid)``. One row per version the Account accepted, so a later
revision adds a row instead of overwriting the earlier record.
"""

import time

# Bump together with the version on both pages when either text changes in substance.
CURRENT_VERSION = "2026-11-07"

# Where the agreement was given. Anything else is stored as "other".
CONTEXTS = ("register", "oc-submit", "account", "reconsent")


def init_schema(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS legal_consents (
            kind TEXT NOT NULL,
            uid TEXT NOT NULL,
            legal_version TEXT NOT NULL,
            context TEXT NOT NULL,
            accepted_at REAL NOT NULL,
            PRIMARY KEY (kind, uid, legal_version)
        )"""
    )


def is_current(version):
    return isinstance(version, str) and version == CURRENT_VERSION


def record(conn, kind, uid, version=CURRENT_VERSION, context="other", now=None):
    """Store an agreement; the first time an Account accepts a version wins (idempotent)."""
    if not is_current(version):
        raise ValueError("legal_version_mismatch")
    context = context if context in CONTEXTS else "other"
    conn.execute(
        "INSERT OR IGNORE INTO legal_consents (kind, uid, legal_version, context, accepted_at) VALUES (?,?,?,?,?)",
        (str(kind), str(uid), version, context, float(now if now is not None else time.time())),
    )


def accepted(conn, kind, uid, version=CURRENT_VERSION):
    row = conn.execute(
        "SELECT accepted_at FROM legal_consents WHERE kind=? AND uid=? AND legal_version=?",
        (str(kind), str(uid), version),
    ).fetchone()
    return row[0] if row else None


def status(conn, ident):
    """Public shape for GET /api/legal. ``ident`` is None for a visitor."""
    out = {"legal_version": CURRENT_VERSION, "terms_url": "/terms.html", "privacy_url": "/privacy.html",
           "logged_in": bool(ident)}
    if ident:
        at = accepted(conn, ident["kind"], ident["uid"])
        out["is_accepted"] = at is not None
        out["accepted_at"] = at
    return out
