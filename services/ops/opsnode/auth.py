"""Bearer-token auth for agent and hub readers. Only SHA-256 digests of tokens are stored in config.

Token file (outside Git, e.g. <workspace>/secrets/ops/agent-readers.json, mode 600):
    {"readers": {"hub-b": "sha256:<hex>"}}
`python -m opsnode.auth new <name>` prints a fresh token once and the line to put in the file.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sys
import threading
import time
from pathlib import Path


def digest(token: str) -> str:
    return "sha256:" + hashlib.sha256(token.encode("utf-8")).hexdigest()


def sign(key: str, nonce: str, body: bytes) -> str:
    """Response signature: HMAC-SHA256 keyed with the reader digest, over nonce + body."""
    return hmac.new(key.encode("utf-8"), nonce.encode("utf-8") + b"\n" + body, hashlib.sha256).hexdigest()


class Readers:
    def __init__(self, path: str | Path):
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        self.readers = {name: str(d) for name, d in data.get("readers", {}).items()}
        if not self.readers:
            raise SystemExit(f"{path}: no readers configured; refusing to start without authentication")
        for name, d in self.readers.items():
            if not d.startswith("sha256:") or len(d) != 71:
                raise SystemExit(f"{path}: reader {name!r} must be a sha256:<64 hex> digest, never a plaintext token")

    def who(self, header: str | None) -> str | None:
        if not header or not header.startswith("Bearer "):
            return None
        d = digest(header[7:].strip())
        hit = None
        for name, want in self.readers.items():       # compare against every entry: no early exit timing
            if hmac.compare_digest(d, want):
                hit = name
        return hit


class FailureLimiter:
    """At most `limit` failed requests per peer per `window` seconds; then 429 until the window passes."""

    def __init__(self, limit: int = 10, window: float = 300):
        self.limit, self.window = limit, window
        self.fails: dict[str, list[float]] = {}
        self.lock = threading.Lock()

    def blocked(self, peer: str) -> bool:
        now = time.time()
        with self.lock:
            hits = [t for t in self.fails.get(peer, []) if now - t < self.window]
            self.fails[peer] = hits
            return len(hits) >= self.limit

    def fail(self, peer: str) -> None:
        with self.lock:
            self.fails.setdefault(peer, []).append(time.time())


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "new":
        tok = secrets.token_urlsafe(32)
        print("token (give to the reader, shown once):", tok)
        print("readers entry:", json.dumps({sys.argv[2]: digest(tok)}))
    else:
        print("usage: python -m opsnode.auth new <reader-name>")
