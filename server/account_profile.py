"""Small account-owned profile store shared by Huiguan and the Gate."""
import json
import os
import re
import sqlite3
import hashlib
from io import BytesIO
from pathlib import Path


ASSET_RE = re.compile(r"^/assets/uploads/[a-f0-9]{32,64}\.(?:png|jpg|webp|gif)$")


def init_schema(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS account_profiles (
        kind TEXT NOT NULL,
        uid TEXT NOT NULL,
        account_avatar_url TEXT NOT NULL DEFAULT '',
        gate_identity_json TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (kind, uid)
    )""")


def open_db(project_root=None):
    root = Path(project_root or os.environ.get("IRIDESCENTLY_PROJECT_ROOT", Path(__file__).resolve().parents[1]))
    database = root / "portal" / "huiguan" / "users.db"
    database.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(database, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=10000")
    init_schema(conn)
    conn.commit()
    return conn


def valid_asset_url(value):
    return isinstance(value, str) and bool(ASSET_RE.fullmatch(value))


def asset_public_url(value):
    return "https://huiguan.iridescently.xyz" + value if valid_asset_url(value) else ""


def store_avatar_image(raw, mime, project_root=None):
    """Decode, center-crop, resize and strip metadata from an avatar upload."""
    allowed = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}
    detected = None
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        detected = "image/png"
    elif raw.startswith(b"\xff\xd8\xff"):
        detected = "image/jpeg"
    elif raw[:6] in (b"GIF87a", b"GIF89a"):
        detected = "image/gif"
    elif raw.startswith(b"RIFF") and raw[8:12] == b"WEBP":
        detected = "image/webp"
    if mime != detected or mime not in allowed or not raw or len(raw) > 8 * 1024 * 1024:
        raise ValueError("头像图片格式无效或超过 8 MiB")
    from PIL import Image, ImageOps
    try:
        with Image.open(BytesIO(raw)) as probe:
            if probe.width * probe.height > 40_000_000:
                raise ValueError("头像分辨率过大")
            probe.verify()
        with Image.open(BytesIO(raw)) as source:
            source.seek(0)
            image = ImageOps.exif_transpose(source).convert("RGBA" if "A" in source.getbands() else "RGB")
        side = min(image.width, image.height)
        left, top = (image.width - side) // 2, (image.height - side) // 2
        image = image.crop((left, top, left + side, top + side))
        if side > 512:
            image = image.resize((512, 512), Image.Resampling.LANCZOS)
        output = BytesIO()
        output_mime = "image/png" if image.mode == "RGBA" else "image/jpeg"
        image.save(output, format="PNG" if output_mime == "image/png" else "JPEG", optimize=True, quality=88)
    except (OSError, Image.DecompressionBombError) as error:
        raise ValueError("头像图片损坏或无法解码") from error
    root = Path(project_root or os.environ.get("IRIDESCENTLY_PROJECT_ROOT", Path(__file__).resolve().parents[1]))
    name = hashlib.sha256(output.getvalue()).hexdigest() + (".png" if output_mime == "image/png" else ".jpg")
    target = root / "portal" / "huiguan" / "assets" / "uploads" / name
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(output.getvalue())
    return "/assets/uploads/" + name


def store_source_image(raw, mime, project_root=None):
    """Validate and expose an existing OC image as a cropper source without altering it."""
    allowed = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}
    signatures = {"image/png": raw.startswith(b"\x89PNG\r\n\x1a\n"),
                  "image/jpeg": raw.startswith(b"\xff\xd8\xff"),
                  "image/gif": raw[:6] in (b"GIF87a", b"GIF89a"),
                  "image/webp": raw.startswith(b"RIFF") and raw[8:12] == b"WEBP"}
    if mime not in allowed or not signatures.get(mime) or not raw or len(raw) > 8 * 1024 * 1024:
        raise ValueError("图片格式无效或超过 8 MiB")
    from PIL import Image
    try:
        with Image.open(BytesIO(raw)) as image:
            if image.width * image.height > 40_000_000:
                raise ValueError("图片分辨率过大")
            image.verify()
    except (OSError, Image.DecompressionBombError) as error:
        raise ValueError("图片损坏或无法解码") from error
    root = Path(project_root or os.environ.get("IRIDESCENTLY_PROJECT_ROOT", Path(__file__).resolve().parents[1]))
    name = hashlib.sha256(raw).hexdigest() + allowed[mime]
    target = root / "portal" / "huiguan" / "assets" / "uploads" / name
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(raw)
    return "/assets/uploads/" + name


def get_profile(conn, kind, uid):
    row = conn.execute(
        "SELECT account_avatar_url, gate_identity_json FROM account_profiles WHERE kind=? AND uid=?",
        (kind, str(uid)),
    ).fetchone()
    if not row:
        return {"account_avatar_url": "", "gate_identity": None}
    try:
        identity = json.loads(row["gate_identity_json"]) if row["gate_identity_json"] else None
    except (TypeError, ValueError):
        identity = None
    return {"account_avatar_url": row["account_avatar_url"] or "", "gate_identity": identity}


def set_account_avatar(conn, kind, uid, asset_url, updated_at):
    conn.execute("""INSERT INTO account_profiles (kind,uid,account_avatar_url,updated_at)
        VALUES (?,?,?,?) ON CONFLICT(kind,uid) DO UPDATE SET
        account_avatar_url=excluded.account_avatar_url, updated_at=excluded.updated_at""",
        (kind, str(uid), asset_url, updated_at))


def set_gate_identity(conn, kind, uid, identity, updated_at):
    conn.execute("""INSERT INTO account_profiles (kind,uid,gate_identity_json,updated_at)
        VALUES (?,?,?,?) ON CONFLICT(kind,uid) DO UPDATE SET
        gate_identity_json=excluded.gate_identity_json, updated_at=excluded.updated_at""",
        (kind, str(uid), json.dumps(identity, ensure_ascii=False, separators=(",", ":")), updated_at))


def resolve_sso_identity(token_payload, project_root=None):
    """Resolve a signed shared-session identity and reject missing/inactive accounts."""
    if not isinstance(token_payload, dict):
        return None
    kind, uid = token_payload.get("kind"), str(token_payload.get("uid") or "")
    if kind not in ("local", "usso") or not uid:
        return None
    conn = open_db(project_root)
    try:
        if kind == "local":
            row = conn.execute("SELECT username,nickname,picture,status FROM local_users WHERE uid=?", (uid,)).fetchone()
            if not row or row["status"] != "active":
                return None
            name = row["nickname"] or row["username"]
            picture = row["picture"] or ""
        else:
            row = conn.execute("SELECT nickname,picture FROM users WHERE user_id=?", (uid,)).fetchone()
            flag = conn.execute("SELECT status FROM user_flags WHERE kind='usso' AND uid=?", (uid,)).fetchone()
            if flag and flag["status"] == "banned":
                return None
            name = (row["nickname"] if row else "") or token_payload.get("name") or "账户"
            picture = row["picture"] if row else ""
        profile = get_profile(conn, kind, uid)
        return {"kind": kind, "uid": uid, "name": name, "picture": picture,
                "account_avatar_url": profile["account_avatar_url"],
                "gate_identity": profile["gate_identity"]}
    finally:
        conn.close()
