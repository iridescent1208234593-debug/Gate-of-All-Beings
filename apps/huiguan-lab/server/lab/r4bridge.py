"""Bridge from the LAB gateway to the LAB's own R4 Living World Service instance.

The R4 service (Mesa sheep/wolf ecology, public and private branches, world clock, fencing,
checkpoints) stays the authority for simulation state. The gateway only:
  * reads projections as `operator` and maps actors into space coordinates,
  * forks a branch when a player opens a 灵质空间 (snapshot of public -> fork),
  * toggles a branch's scheduler (pause/resume) and advances private branches on request.
The gateway never writes R4 tables directly.
"""
from __future__ import annotations

import asyncio
import json
import logging
import secrets
import time
from pathlib import Path

import httpx

from .auth import restrict_file

log = logging.getLogger("lab.r4")


def r4_tokens(secrets_dir: Path) -> dict:
    f = secrets_dir / "r4-tokens.json"
    if not f.exists():
        f.write_text(json.dumps({w: secrets.token_hex(24) for w in ("alice", "bob", "operator")}))
        restrict_file(f)
    return json.loads(f.read_text())


class R4Bridge:
    def __init__(self, port: int, secrets_dir: Path, enabled: bool = True):
        self.base = f"http://127.0.0.1:{port}"
        self.enabled = enabled
        self.token = r4_tokens(secrets_dir)["operator"] if enabled else ""
        self.client = httpx.AsyncClient(base_url=self.base, timeout=30,
                                        headers={"Authorization": "Bearer " + self.token})
        self.world: dict | None = None
        self.last_ok: float = 0
        self.last_error: str = "" if enabled else "disabled"
        self.poll_ms: float = 0
        self.lock = asyncio.Lock()

    @property
    def online(self) -> bool:
        return self.enabled and time.time() - self.last_ok < 15

    async def poll(self) -> dict | None:
        if not self.enabled:
            return None
        t0 = time.perf_counter()
        try:
            r = await self.client.get("/v1/world")
            r.raise_for_status()
            self.world = r.json()
            self.last_ok = time.time()
            self.last_error = ""
        except Exception as error:      # service down or restarting: keep last projection, report it
            self.last_error = f"{type(error).__name__}: {error}"[:200]
        self.poll_ms = (time.perf_counter() - t0) * 1000
        return self.world

    def branch(self, bid: str | None) -> dict | None:
        if not self.world or not bid:
            return None
        return self.world.get("branches", {}).get(bid)

    def actors(self, bid: str | None) -> list[dict]:
        b = self.branch(bid)
        if not b:
            return []
        out = []
        for aid, a in sorted(b.get("actors", {}).items()):
            pos = a.get("position") or [0, 0]
            out.append({"id": aid, "species": a.get("species", "?"), "alive": bool(a.get("alive")),
                        "cell": [pos[0], pos[1]] if isinstance(pos, list) and len(pos) >= 2 else [0, 0]})
        return out

    def clock(self, bid: str | None) -> dict:
        b = self.branch(bid)
        if not b:
            return {"available": False}
        tick = int(b.get("model_tick", 0))
        return {"available": True, "model_tick": tick, "day": tick // 24 + 1, "hour": tick % 24,
                "running": bool((b.get("runner") or {}).get("enabled")),
                "error": (b.get("runner") or {}).get("error"),
                "populations": b.get("populations", {}),
                "limit": (self.world or {}).get("clock_policy", {}).get("model_tick_limit")}

    async def _command(self, kind: str, branch: str, payload: dict | None = None, command_id: str | None = None) -> dict:
        async with self.lock:
            for attempt in range(6):
                world = await self.poll()
                if world is None:
                    raise RuntimeError("r4_unavailable: " + self.last_error)
                body = {"protocol": "world-lab/1", "command_id": command_id or f"lab:{kind}:{secrets.token_hex(8)}",
                        "expected_revision": world["revision"], "branch": branch, "kind": kind,
                        "payload": payload or {}}
                r = await self.client.post("/v1/commands", json=body)
                if r.status_code == 409 and r.json().get("detail") in ("revision_conflict", "world_advance_pending"):
                    await asyncio.sleep(0.5 + attempt)
                    continue
                if r.status_code >= 400:
                    raise RuntimeError(f"r4_rejected:{r.status_code}:{r.text[:120]}")
                return r.json()
            raise RuntimeError("r4_busy")

    async def fork_public(self, label: str) -> tuple[str, str]:
        snap = await self._command("snapshot", "public", {}, f"lab:snapshot:{label}")
        snapshot_id = snap["event"]["result"]["snapshot_id"]
        fork = await self._command("fork", "public", {"snapshot_id": snapshot_id}, f"lab:fork:{label}")
        branch = fork["event"]["result"]["branch_id"]
        await self.set_schedule(branch, True)
        await self.poll()
        return branch, snapshot_id

    async def set_schedule(self, branch: str, enabled: bool) -> None:
        r = await self.client.post("/v1/schedule", json={"branch": branch, "enabled": enabled})
        r.raise_for_status()
        await self.poll()

    async def advance(self, branch: str, ticks: int) -> dict:
        if branch == "public":
            raise ValueError("public clock is owned by the scheduler")
        if not 1 <= ticks <= 30:
            raise ValueError("ticks 1..30")
        return await self._command("advance_model", branch, {"ticks": ticks})

    def status(self) -> dict:
        w = self.world or {}
        return {"enabled": self.enabled, "online": self.online, "last_ok": self.last_ok, "error": self.last_error,
                "poll_ms": round(self.poll_ms, 1), "revision": w.get("revision"),
                "branches": {bid: {"owner": b.get("owner"), "model_tick": b.get("model_tick"),
                                   "populations": b.get("populations"), "runner": b.get("runner")}
                             for bid, b in w.get("branches", {}).items()},
                "clock_policy": w.get("clock_policy")}
