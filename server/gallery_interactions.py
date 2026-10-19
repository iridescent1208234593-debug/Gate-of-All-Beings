"""Persistent, account-scoped interactions for the homepage gallery."""
import re
import sqlite3
from pathlib import Path
from contextlib import contextmanager


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
IMAGE_NAME = re.compile(r"^[^\\\x00]+$")


def database_path(project_root):
    return Path(project_root) / "data" / "homepage-gallery.sqlite3"


def connect(project_root):
    path = database_path(project_root)
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript("""
        CREATE TABLE IF NOT EXISTS gallery_actions (
            kind TEXT NOT NULL, uid TEXT NOT NULL, image TEXT NOT NULL,
            action TEXT NOT NULL CHECK(action IN ('like','love')),
            request_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(kind, uid, request_id)
        );
        CREATE INDEX IF NOT EXISTS gallery_actions_lookup
            ON gallery_actions(image, action);
        CREATE TABLE IF NOT EXISTS gallery_comments (
            kind TEXT NOT NULL, uid TEXT NOT NULL, name TEXT NOT NULL,
            image TEXT NOT NULL, comment TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(kind, uid), CHECK(length(comment) <= 25)
        );
        CREATE INDEX IF NOT EXISTS gallery_comments_image
            ON gallery_comments(image, created_at);
    """)
    return db


@contextmanager
def session(project_root):
    db = connect(project_root)
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def valid_image_name(value):
    if not isinstance(value, str) or not IMAGE_NAME.fullmatch(value):
        return False
    path = Path(value)
    return not path.is_absolute() and all(part not in ("", ".", "..") for part in value.split("/")) and path.suffix.lower() in IMAGE_SUFFIXES


def find_original(project_root, runtime_dir, image):
    if not valid_image_name(image):
        return None
    roots = (
        Path(project_root) / "asset-library" / "homepage-gallery",
        Path(runtime_dir) / "assets" / "homepage" / "gallery-files",
        Path(project_root) / "assets" / "罗小黑战记数据库" / "罗小黑节气贺图（gallery素材）",
    )
    for root in roots:
        target = (root / image).resolve()
        try:
            target.relative_to(root.resolve())
        except ValueError:
            continue
        if target.is_file() and target.suffix.lower() in IMAGE_SUFFIXES:
            return target
    return None


def snapshot(db, image, user):
    counts = {row["action"]: row["count"] for row in db.execute(
        "SELECT action, COUNT(*) AS count FROM gallery_actions WHERE image=? GROUP BY action", (image,)
    )}
    comments = comments_page(db, image, 0)
    state = {"likes": counts.get("like", 0), "loves": counts.get("love", 0),
             "comments": comments, "comment_total": comment_count(db, image),
             "logged_in": bool(user), "interaction_count": 0,
             "comment_used": False, "comment_image": None}
    if user:
        identity = (str(user.get("kind", "")), str(user.get("uid", "")))
        state["interaction_count"] = db.execute(
            "SELECT COUNT(*) FROM gallery_actions WHERE kind=? AND uid=? AND image=?", (*identity, image)
        ).fetchone()[0]
        comment = db.execute("SELECT image FROM gallery_comments WHERE kind=? AND uid=?", identity).fetchone()
        state["comment_used"] = comment is not None
        state["comment_image"] = comment["image"] if comment else None
    return state


def comment_count(db, image):
    return db.execute("SELECT COUNT(*) FROM gallery_comments WHERE image=?", (image,)).fetchone()[0]


def comments_page(db, image, offset, limit=3):
    return [dict(row) for row in db.execute(
        "SELECT name, comment, created_at FROM gallery_comments WHERE image=? "
        "ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?", (image, limit, offset)
    )]
