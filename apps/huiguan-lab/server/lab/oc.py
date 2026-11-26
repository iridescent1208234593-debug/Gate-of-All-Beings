"""OC image validation and the temporary, access-controlled display cache.

The server keeps no permanent OC library. A player's original stays in their browser.
While they are online, a normalized display copy (<=512 px, metadata stripped, re-encoded)
is held in memory and mirrored to a TTL-bounded disk cache only so a gateway restart during a
session does not blank everyone. Copies are sent only to authenticated players sharing a space.
"""
from __future__ import annotations

import base64
import hashlib
import io
import time
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, UnidentifiedImageError

Image.MAX_IMAGE_PIXELS = 4096 * 4096 + 1


class OCRejected(ValueError):
    pass


def sniff(data: bytes) -> str | None:
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    return None


def normalize_image(data: bytes, max_bytes: int, max_side: int, display_side: int) -> tuple[bytes, int, int, bool]:
    """Validate an uploaded OC and return (png_bytes, width, height, has_alpha)."""
    if not data:
        raise OCRejected("empty")
    if len(data) > max_bytes:
        raise OCRejected("too_large")
    kind = sniff(data)
    if kind is None:
        raise OCRejected("not_png_jpeg_or_webp")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = (probe.format or "").lower()
            w, h = probe.size
            if fmt != kind:
                raise OCRejected("format_mismatch")
            if w < 16 or h < 16:
                raise OCRejected("too_small")
            if w > max_side or h > max_side:
                raise OCRejected("dimensions_exceeded")
            probe.verify()
        with Image.open(io.BytesIO(data)) as img:
            img.seek(0)                       # first frame only; animations are flattened
            img = img.convert("RGBA")
    except OCRejected:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError) as error:
        raise OCRejected("undecodable") from error
    alpha = img.getchannel("A")
    has_alpha = alpha.getextrema()[0] < 250
    bbox = alpha.point(lambda a: 255 if a > 8 else 0).getbbox()
    if bbox:
        img = img.crop(bbox)              # trim transparent margins so display size is consistent
    scale = min(1.0, display_side / max(img.size))
    if scale < 1.0:
        img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)    # fresh encode: no metadata, no trailing payloads
    return out.getvalue(), img.width, img.height, has_alpha


@dataclass
class OCEntry:
    pid: str
    png: bytes
    width: int
    height: int
    digest: str
    at: float

    def message(self) -> dict:
        return {"t": "oc", "pid": self.pid, "w": self.width, "h": self.height, "digest": self.digest,
                "png": base64.b64encode(self.png).decode()}


class OCCache:
    def __init__(self, directory: Path, budget_bytes: int, ttl_seconds: int):
        self.dir, self.budget, self.ttl = directory, budget_bytes, ttl_seconds
        self.entries: dict[str, OCEntry] = {}
        self.dir.mkdir(parents=True, exist_ok=True)
        self.cleanup(startup=True)

    def put(self, pid: str, png: bytes, w: int, h: int) -> OCEntry:
        entry = OCEntry(pid, png, w, h, hashlib.sha256(png).hexdigest()[:16], time.time())
        self.entries[pid] = entry
        (self.dir / f"{pid}.png").write_bytes(png)
        self._enforce_budget()
        return entry

    def get(self, pid: str) -> OCEntry | None:
        entry = self.entries.get(pid)
        if entry is None:
            f = self.dir / f"{pid}.png"
            if f.exists() and time.time() - f.stat().st_mtime < self.ttl:
                png = f.read_bytes()
                with Image.open(io.BytesIO(png)) as img:
                    w, h = img.size
                entry = OCEntry(pid, png, w, h, hashlib.sha256(png).hexdigest()[:16], f.stat().st_mtime)
                self.entries[pid] = entry
        return entry

    def drop(self, pid: str) -> None:
        self.entries.pop(pid, None)
        (self.dir / f"{pid}.png").unlink(missing_ok=True)

    def total_bytes(self) -> int:
        return sum(len(e.png) for e in self.entries.values())

    def _enforce_budget(self) -> None:
        while self.total_bytes() > self.budget and self.entries:
            oldest = min(self.entries.values(), key=lambda e: e.at)
            self.drop(oldest.pid)

    def cleanup(self, startup: bool = False, online: set[str] | None = None) -> int:
        removed = 0
        now = time.time()
        for f in self.dir.glob("*.png"):
            pid = f.stem
            if now - f.stat().st_mtime > self.ttl or (online is not None and pid not in online
                                                       and now - f.stat().st_mtime > 600):
                f.unlink(missing_ok=True)
                self.entries.pop(pid, None)
                removed += 1
        return removed
