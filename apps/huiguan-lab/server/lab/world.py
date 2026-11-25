"""Realtime authoritative hub: presence, movement validation, chat, emotes, spaces, interactions.

Protocol: JSON text frames over one WebSocket per player (protocol version 1, see ARCHITECTURE.md).
The server owns every shared fact; clients only propose moves and actions.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import math
import random
import re
import secrets
import time
import unicodedata
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

from .oc import OCCache, OCRejected, normalize_image
from .store import Store

log = logging.getLogger("lab.world")
PROTOCOL = 1
TICK_HZ = 10
FULL_EVERY = 20          # full snapshot every 2 s heals any lost delta
CONTROL_RE = re.compile(r"[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]")


def clean_text(text: str, limit: int) -> str:
    text = unicodedata.normalize("NFC", str(text))
    text = CONTROL_RE.sub("", text).strip()
    return text[:limit]


class Geometry:
    def __init__(self, template: dict, player: dict):
        self.t = template
        self.radius = player["radius"]
        self.max_speed = player["run_speed"]
        self.min = template["bounds"]["min"]
        self.max = template["bounds"]["max"]
        self.obstacles = [(o["position"][0], o["position"][2], o["radius"] + self.radius) for o in template["obstacles"]]
        self.objects = {o["id"]: o for o in template["objects"]}

    def free(self, x: float, z: float) -> bool:
        if not (self.min[0] <= x <= self.max[0] and self.min[2] <= z <= self.max[2]):
            return False
        return all((x - ox) ** 2 + (z - oz) ** 2 >= r * r for ox, oz, r in self.obstacles)

    def segment_free(self, x0, z0, x1, z1) -> bool:
        steps = max(1, int(math.dist((x0, z0), (x1, z1)) / 0.15))
        return all(self.free(x0 + (x1 - x0) * i / steps, z0 + (z1 - z0) * i / steps) for i in range(1, steps + 1))

    def spawn(self) -> tuple[float, float]:
        sx, _, sz = self.t["spawn"]
        spread = self.t.get("spawn_spread", 1.0)
        for _ in range(40):
            x, z = sx + random.uniform(-spread, spread), sz + random.uniform(-spread, spread)
            if self.free(x, z):
                return round(x, 2), round(z, 2)
        return sx, sz

    def near(self, object_id: str, x: float, z: float, slack: float = 0.6) -> bool:
        o = self.objects.get(object_id)
        return bool(o) and math.dist((x, z), (o["position"][0], o["position"][2])) <= o["radius"] + slack

    def pasture(self, cell: list) -> tuple[float, float]:
        p = self.t["pasture"]
        return (round(p["origin"][0] + cell[0] * p["cell_step"][0], 2), round(p["origin"][2] + cell[1] * p["cell_step"][2], 2))


# 新人引导「开始生活」章 (Onboarding Progress, chapter "life"; see docs/development/GLOSSARY.md).
# Stored against the LAB player, so Web, Windows and Android share one record.
GUIDE_STATUSES = ("active", "paused", "completed", "skipped")
GUIDE_FINISHED = ("completed", "skipped", "veteran")
GUIDE_MAX_SEEN = 32
GUIDE_KEY = re.compile(r"^[a-z0-9][a-z0-9._-]{0,23}$")


@dataclass
class Conn:
    ws: object
    pid: str
    code_id: str
    token: str
    nick: str
    space: str
    x: float
    z: float
    dir: float = 0.0
    anim: str = "idle"
    client: str = "?"
    version: str = "?"
    ip_hint: str = ""
    connected_at: float = field(default_factory=time.time)
    last_move: float = field(default_factory=time.time)
    dirty: bool = True
    moved_since_save: bool = False
    msg_times: deque = field(default_factory=lambda: deque(maxlen=200))
    chat_times: deque = field(default_factory=lambda: deque(maxlen=20))
    oc_times: deque = field(default_factory=lambda: deque(maxlen=10))
    corrections: int = 0
    queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=400))
    sent_bytes: int = 0
    recv_bytes: int = 0
    rtt_ms: float = 0.0
    closed: bool = False


class Hub:
    def __init__(self, store: Store, spaces_file: Path, oc: OCCache, r4=None, version: str = "?"):
        data = json.loads(spaces_file.read_text(encoding="utf-8"))
        self.spec = data
        self.geo = {name: Geometry(t, data["player"]) for name, t in data["templates"].items()}
        self.emotes = set(data["emotes"])
        self.store, self.oc, self.r4, self.version = store, oc, r4, version
        self.conns: dict[str, Conn] = {}
        self.chat: dict[str, deque] = {}
        self.test_npcs: dict[str, dict] = {}      # admin-spawned, gateway-only, non-persistent
        self.seq = 0
        self.tick_ms = deque(maxlen=300)
        self.counters = {"connects": 0, "disconnects": 0, "kicks": 0, "rejected_moves": 0, "chat": 0,
                         "oc_accepted": 0, "oc_rejected": 0, "send_overflow": 0, "errors": 0, "reconnects": 0}
        self.errors: deque = deque(maxlen=200)
        self.events: deque = deque(maxlen=200)
        self.started = time.time()
        self.paused_spaces: set[str] = {r["id"] for r in store.all("SELECT id FROM spaces WHERE paused=1")}

    # ------------------------------------------------------------------ helpers
    def space_row(self, sid: str):
        return self.store.one("SELECT * FROM spaces WHERE id=?", (sid,))

    def geometry(self, sid: str) -> Geometry:
        row = self.space_row(sid)
        return self.geo[row["template"] if row else "hall"]

    def members(self, sid: str) -> list[Conn]:
        return [c for c in self.conns.values() if c.space == sid and not c.closed]

    def can_enter(self, pid: str, sid: str) -> bool:
        row = self.space_row(sid)
        if not row:
            return False
        if row["kind"] == "public":
            return True
        if row["owner_pid"] == pid:
            return True
        return bool(self.store.one("SELECT 1 FROM space_acl WHERE space_id=? AND pid=?", (sid, pid)))

    def visible_spaces(self, pid: str) -> list[dict]:
        rows = self.store.all(
            "SELECT s.* FROM spaces s WHERE s.kind='public' OR s.owner_pid=? OR s.id IN "
            "(SELECT space_id FROM space_acl WHERE pid=?) ORDER BY s.kind DESC, s.created_at", (pid, pid))
        out = []
        for r in rows:
            guests = [g["pid"] for g in self.store.all("SELECT pid FROM space_acl WHERE space_id=?", (r["id"],))] \
                if r["owner_pid"] == pid else []
            out.append({"id": r["id"], "kind": r["kind"], "title": r["title"], "owner": r["owner_pid"],
                        "mine": r["owner_pid"] == pid, "guests": guests, "online": len(self.members(r["id"])),
                        "r4_branch": bool(r["r4_branch"])})
        return out

    def player_view(self, c: Conn) -> dict:
        oc = self.oc.get(c.pid)
        return {"pid": c.pid, "nick": c.nick, "x": c.x, "z": c.z, "dir": round(c.dir, 2), "anim": c.anim,
                "client": c.client, "oc": oc.digest if oc else None}

    def objects_state(self, sid: str) -> dict:
        return {r["object_id"]: json.loads(r["state"]) for r in
                self.store.all("SELECT object_id,state FROM world_objects WHERE space_id=?", (sid,))}

    def npcs(self, sid: str) -> list[dict]:
        row = self.space_row(sid)
        out = []
        if row and self.r4:
            geo = self.geo[row["template"]]
            branch = "public" if row["kind"] == "public" else row["r4_branch"]
            for a in self.r4.actors(branch):
                if a["alive"]:
                    x, z = geo.pasture(a["cell"])
                    out.append({"id": a["id"], "species": a["species"], "x": x, "z": z, "source": "r4"})
        for n in self.test_npcs.values():
            if n["space"] == sid:
                out.append({"id": n["id"], "species": n["species"], "x": round(n["x"], 2), "z": round(n["z"], 2),
                            "source": "test"})
        return out

    def clock(self, sid: str) -> dict:
        row = self.space_row(sid)
        if not row or not self.r4:
            return {"available": False}
        branch = "public" if row["kind"] == "public" else row["r4_branch"]
        clock = self.r4.clock(branch)
        clock["paused"] = sid in self.paused_spaces
        return clock

    # ------------------------------------------------------------------ sending
    def send(self, c: Conn, msg: dict) -> None:
        if c.closed:
            return
        try:
            c.queue.put_nowait(json.dumps(msg, ensure_ascii=False, separators=(",", ":")))
        except asyncio.QueueFull:
            self.counters["send_overflow"] += 1
            c.closed = True                 # a client that cannot keep up is dropped, then reconnects

    def broadcast(self, sid: str, msg: dict, exclude: str | None = None) -> None:
        payload = json.dumps(msg, ensure_ascii=False, separators=(",", ":"))
        for c in self.members(sid):
            if c.pid != exclude:
                try:
                    c.queue.put_nowait(payload)
                except asyncio.QueueFull:
                    self.counters["send_overflow"] += 1
                    c.closed = True

    async def writer(self, c: Conn) -> None:
        try:
            while not c.closed:
                text = await c.queue.get()
                c.sent_bytes += len(text)
                await c.ws.send_text(text)
        except Exception:
            c.closed = True

    def note(self, kind: str, **detail) -> None:
        self.events.append({"at": time.time(), "kind": kind, **detail})

    # ------------------------------------------------------------------ lifecycle
    def player_record(self, code_id: str) -> dict:
        row = self.store.one("SELECT * FROM players WHERE code_id=?", (code_id,))
        if not row:
            pid = "p_" + secrets.token_hex(4)
            self.store.exec("INSERT INTO players(code_id,pid,updated_at) VALUES(?,?,?)", (code_id, pid, time.time()))
            row = self.store.one("SELECT * FROM players WHERE code_id=?", (code_id,))
        return dict(row)

    async def attach(self, ws, session: dict, token: str, ip_hint: str) -> Conn:
        rec = self.player_record(session["code_id"])
        pid = rec["pid"]
        old = self.conns.get(pid)
        if old:
            self.counters["reconnects"] += 1
            self.send(old, {"t": "kicked", "reason": "replaced"})
            await asyncio.sleep(0.05)
            await self.detach(old, "replaced")
        space = rec["space"] if self.space_row(rec["space"]) and self.can_enter(pid, rec["space"]) else "hall"
        geo = self.geometry(space)
        if rec["x"] is not None and geo.free(rec["x"], rec["z"]):
            x, z = rec["x"], rec["z"]
        else:
            x, z = geo.spawn()
        c = Conn(ws=ws, pid=pid, code_id=session["code_id"], token=token, nick=rec["nickname"], space=space,
                 x=x, z=z, dir=rec["dir"] or 0.0, ip_hint=ip_hint)
        self.conns[pid] = c
        self.counters["connects"] += 1
        self.note("connect", pid=pid, space=space)
        return c

    async def detach(self, c: Conn, reason: str = "closed") -> None:
        if self.conns.get(c.pid) is c:
            del self.conns[c.pid]
            self.save_player(c)
            self.broadcast(c.space, {"t": "leave", "pid": c.pid, "nick": c.nick, "reason": reason})
            self.counters["disconnects"] += 1
            self.note("disconnect", pid=c.pid, reason=reason)
        c.closed = True
        try:
            c.queue.put_nowait("")          # wake the writer
        except asyncio.QueueFull:
            pass
        asyncio.create_task(self._close(c.ws))

    @staticmethod
    async def _close(ws) -> None:
        # The close handshake can wait for a slow peer; never hold an admin request or the tick on it.
        try:
            await asyncio.wait_for(ws.close(code=4000), 3)
        except Exception:
            pass

    def save_player(self, c: Conn) -> None:
        self.store.exec("UPDATE players SET space=?, x=?, z=?, dir=?, nickname=?, updated_at=? WHERE pid=?",
                        (c.space, c.x, c.z, c.dir, c.nick, time.time(), c.pid))
        c.moved_since_save = False

    def welcome(self, c: Conn) -> dict:
        row = self.space_row(c.space)
        return {"t": "welcome", "protocol": PROTOCOL, "server_version": self.version, "pid": c.pid, "nick": c.nick,
                "needs_profile": not c.nick, "space": self.space_info(row), "you": self.player_view(c),
                "players": [self.player_view(m) for m in self.members(c.space) if m.pid != c.pid],
                "objects": self.objects_state(c.space), "npcs": self.npcs(c.space),
                "chat": list(self.chat.get(c.space, [])), "spaces": self.visible_spaces(c.pid),
                "clock": self.clock(c.space), "emotes": sorted(self.emotes), "tick_hz": TICK_HZ,
                "guide": self.guide_state(c)}

    # ------------------------------------------------------------------ life guide
    def guide_state(self, c: Conn) -> dict:
        row = self.store.one("SELECT status, seen FROM life_guide WHERE pid=?", (c.pid,))
        if not row:
            # A new player reaches the first welcome before choosing a nickname; a player who already
            # has one when the guide first meets them was here before the guide.
            rec = self.store.one("SELECT nickname FROM players WHERE pid=?", (c.pid,))
            veteran = bool(rec and rec["nickname"])
            self.store.exec("INSERT OR IGNORE INTO life_guide(pid,status,seen,updated_at) VALUES(?,?,?,?)",
                            (c.pid, "veteran" if veteran else "new", "[]", time.time()))
            row = self.store.one("SELECT status, seen FROM life_guide WHERE pid=?", (c.pid,))
        try:
            seen = [k for k in json.loads(row["seen"]) if isinstance(k, str)]
        except ValueError:
            seen = []
        return {"status": row["status"], "seen": seen}

    async def on_guide(self, c: Conn, m: dict, now: float) -> None:
        """Client reports a finished step, a status change or a reset ("重新查看")."""
        state = self.guide_state(c)
        status, seen = state["status"], state["seen"]
        if m.get("reset") is True:
            status, seen = "active", []
        add = m.get("seen", [])
        if not isinstance(add, list):
            raise ValueError("seen must be a list")
        for key in add[:GUIDE_MAX_SEEN]:
            if isinstance(key, str) and GUIDE_KEY.match(key) and key not in seen and len(seen) < GUIDE_MAX_SEEN:
                seen.append(key)
        if "status" in m:
            if m["status"] not in GUIDE_STATUSES:
                raise ValueError("unknown status")
            status = m["status"]
        elif status == "new" and seen:
            status = "active"
        self.store.exec("UPDATE life_guide SET status=?, seen=?, updated_at=? WHERE pid=?",
                        (status, json.dumps(seen), now, c.pid))
        self.send(c, {"t": "guide", "status": status, "seen": seen})

    def space_info(self, row) -> dict:
        return {"id": row["id"], "kind": row["kind"], "title": row["title"], "template": row["template"],
                "owner": row["owner_pid"]}

    async def join(self, c: Conn) -> None:
        self.send(c, self.welcome(c))
        self.broadcast(c.space, {"t": "join", "player": self.player_view(c)}, exclude=c.pid)

    async def kick_code(self, code_id: str, reason: str) -> int:
        n = 0
        for c in list(self.conns.values()):
            if c.code_id == code_id:
                self.send(c, {"t": "kicked", "reason": reason})
                await asyncio.sleep(0.05)
                await self.detach(c, reason)
                self.counters["kicks"] += 1
                n += 1
        return n

    # ------------------------------------------------------------------ messages
    def rate_ok(self, c: Conn, now: float) -> bool:
        c.msg_times.append(now)
        if len(c.msg_times) >= 60 and now - c.msg_times[-60] < 1.0:
            return False
        return True

    async def handle(self, c: Conn, raw: str) -> None:
        now = time.time()
        c.recv_bytes += len(raw)
        if not self.rate_ok(c, now):
            self.send(c, {"t": "error", "code": "rate_limited"})
            return
        try:
            msg = json.loads(raw)
            if not isinstance(msg, dict):
                raise ValueError
            kind = msg.get("t")
        except ValueError:
            self.send(c, {"t": "error", "code": "bad_json"})
            return
        fn = getattr(self, "on_" + str(kind), None) if isinstance(kind, str) and kind.isidentifier() else None
        if fn is None:
            self.send(c, {"t": "error", "code": "unknown_type"})
            return
        try:
            await fn(c, msg, now)
        except (KeyError, TypeError, ValueError) as error:
            self.send(c, {"t": "error", "code": "bad_request", "detail": str(error)[:80]})
        except Exception as error:     # never let one message kill the hub
            self.counters["errors"] += 1
            self.errors.append({"at": now, "pid": c.pid, "type": kind, "error": repr(error)[:300]})
            log.exception("handler failed")
            self.send(c, {"t": "error", "code": "server_error"})

    async def on_hello(self, c: Conn, m: dict, now: float) -> None:
        c.client = clean_text(m.get("client", "?"), 8) or "?"
        c.version = clean_text(m.get("version", "?"), 32) or "?"
        await self.join(c)

    async def on_hello_view(self, c: Conn, m: dict, now: float) -> None:
        c.client = clean_text(m.get("client", "?"), 8) or "?"

    async def on_ping(self, c: Conn, m: dict, now: float) -> None:
        self.send(c, {"t": "pong", "id": m.get("id"), "server_time": now})

    async def on_rtt(self, c: Conn, m: dict, now: float) -> None:
        v = float(m.get("ms", 0))
        if 0 <= v < 60000:
            c.rtt_ms = v

    async def on_profile(self, c: Conn, m: dict, now: float) -> None:
        nick = clean_text(m.get("nick", ""), 16)
        if len(nick) < 1:
            self.send(c, {"t": "error", "code": "nick_required"})
            return
        c.nick = nick
        self.save_player(c)
        self.broadcast(c.space, {"t": "profile", "pid": c.pid, "nick": nick})

    async def on_move(self, c: Conn, m: dict, now: float) -> None:
        x, z = float(m["x"]), float(m["z"])
        if not (math.isfinite(x) and math.isfinite(z)):
            raise ValueError("non-finite")
        geo = self.geometry(c.space)
        dt = min(max(now - c.last_move, 0.05), 1.0)
        allowed = geo.max_speed * dt * 1.35 + 0.25
        dist = math.dist((c.x, c.z), (x, z))
        reason = None
        if dist > allowed:
            reason = "too_fast"
        elif not geo.segment_free(c.x, c.z, x, z):
            reason = "blocked"
        if reason:
            c.corrections += 1
            self.counters["rejected_moves"] += 1
            self.send(c, {"t": "correct", "x": c.x, "z": c.z, "reason": reason, "seq": m.get("seq")})
            return
        c.x, c.z = round(x, 3), round(z, 3)
        c.dir = float(m.get("dir", c.dir)) % (2 * math.pi)
        anim = m.get("anim", "walk")
        c.anim = anim if anim in ("idle", "walk", "run") else "walk"
        c.last_move = now
        c.dirty = c.moved_since_save = True

    async def on_chat(self, c: Conn, m: dict, now: float) -> None:
        text = clean_text(m.get("text", ""), 200)
        if not text:
            return
        c.chat_times.append(now)
        if len(c.chat_times) >= 6 and now - c.chat_times[-6] < 10:
            self.send(c, {"t": "error", "code": "chat_rate_limited"})
            return
        entry = {"t": "chat", "pid": c.pid, "nick": c.nick or "旅人", "text": text, "at": round(now, 3)}
        self.chat.setdefault(c.space, deque(maxlen=30)).append(entry)
        self.counters["chat"] += 1
        self.broadcast(c.space, entry)

    async def on_emote(self, c: Conn, m: dict, now: float) -> None:
        eid = m.get("id")
        if eid in self.emotes:
            self.broadcast(c.space, {"t": "emote", "pid": c.pid, "id": eid})

    async def on_oc_set(self, c: Conn, m: dict, now: float) -> None:
        c.oc_times.append(now)
        if len(c.oc_times) >= 5 and now - c.oc_times[-5] < 60:
            self.send(c, {"t": "oc_result", "ok": False, "reason": "oc_rate_limited"})
            return
        cfg = self.oc_limits
        data = m.get("data", "")
        if not isinstance(data, str) or len(data) > cfg["max_bytes"] * 4 // 3 + 16:
            self.counters["oc_rejected"] += 1
            self.send(c, {"t": "oc_result", "ok": False, "reason": "too_large"})
            return
        try:
            raw = base64.b64decode(data, validate=True)
            png, w, h, alpha = await asyncio.to_thread(normalize_image, raw, cfg["max_bytes"], cfg["max_side"], cfg["display_side"])
        except (OCRejected, ValueError) as error:
            self.counters["oc_rejected"] += 1
            self.send(c, {"t": "oc_result", "ok": False, "reason": str(error) or "invalid"})
            return
        entry = self.oc.put(c.pid, png, w, h)
        self.counters["oc_accepted"] += 1
        self.send(c, {"t": "oc_result", "ok": True, "digest": entry.digest, "w": w, "h": h, "alpha": alpha,
                      "source": clean_text(m.get("source", "upload"), 12)})
        self.broadcast(c.space, {"t": "oc_changed", "pid": c.pid, "digest": entry.digest})

    async def on_oc_get(self, c: Conn, m: dict, now: float) -> None:
        pid = m.get("pid")
        target = self.conns.get(pid)
        if not target or target.space != c.space:
            self.send(c, {"t": "error", "code": "oc_not_visible"})
            return
        entry = self.oc.get(pid)
        if entry:
            self.send(c, entry.message())

    async def on_oc_clear(self, c: Conn, m: dict, now: float) -> None:
        self.oc.drop(c.pid)
        self.broadcast(c.space, {"t": "oc_changed", "pid": c.pid, "digest": None})

    async def on_interact(self, c: Conn, m: dict, now: float) -> None:
        oid = m.get("object")
        geo = self.geometry(c.space)
        if not geo.near(oid, c.x, c.z):
            self.send(c, {"t": "error", "code": "too_far"})
            return
        obj = geo.objects[oid]
        kind = obj["kind"]
        state = self.objects_state(c.space).get(oid, {})
        if kind == "lantern":
            state = {"stage": (int(state.get("stage", 0)) + 1) % obj.get("stages", 4),
                     "tended_by": c.nick, "count": int(state.get("count", 0)) + 1}
        elif kind == "bell":
            state = {"rings": int(state.get("rings", 0)) + 1, "last": c.nick}
        elif kind == "board":
            self.send(c, {"t": "board", "text": "欢迎来到西木会馆 LAB。这里是测试世界，与正式站点数据完全隔离。"
                                                 "走到「虹之间」可以开辟或进入灵质空间。"})
            return
        elif kind == "portal":
            if c.space == "hall":
                self.send(c, {"t": "portal", "spaces": self.visible_spaces(c.pid)})
            else:
                await self.move_to(c, "hall", "portal")
            return
        self.store.exec("INSERT INTO world_objects VALUES(?,?,?,?) ON CONFLICT(space_id,object_id) DO UPDATE SET "
                        "state=excluded.state, updated_at=excluded.updated_at",
                        (c.space, oid, json.dumps(state, ensure_ascii=False), now))
        self.broadcast(c.space, {"t": "object", "id": oid, "state": state, "by": c.pid})

    async def move_to(self, c: Conn, sid: str, reason: str) -> None:
        old = c.space
        self.broadcast(old, {"t": "leave", "pid": c.pid, "nick": c.nick, "reason": "space"}, exclude=c.pid)
        c.space = sid
        c.x, c.z = self.geometry(sid).spawn()
        c.last_move = time.time()
        self.save_player(c)
        self.note("space_change", pid=c.pid, src=old, dst=sid, reason=reason)
        await self.join(c)

    async def on_space_create(self, c: Conn, m: dict, now: float) -> None:
        if c.space != "hall" or not self.geometry("hall").near("rainbow-door", c.x, c.z, 1.2):
            self.send(c, {"t": "error", "code": "go_to_rainbow_door"})
            return
        if self.store.one("SELECT 1 FROM spaces WHERE owner_pid=?", (c.pid,)):
            self.send(c, {"t": "error", "code": "space_exists"})
            return
        sid = "sp_" + secrets.token_hex(4)
        title = clean_text(m.get("title", ""), 20) or f"{c.nick or '旅人'}的灵质空间"
        self.store.exec("INSERT INTO spaces(id,kind,title,owner_pid,template,created_at) VALUES(?,?,?,?,?,?)",
                        (sid, "private", title, c.pid, "lingzhi", now))
        self.note("space_create", pid=c.pid, space=sid)
        self.send(c, {"t": "space_created", "space": {"id": sid, "title": title}, "spaces": self.visible_spaces(c.pid)})
        if self.r4 and self.r4.enabled:
            asyncio.create_task(self._fork_for(sid))

    async def _fork_for(self, sid: str) -> None:
        try:
            branch, snapshot = await self.r4.fork_public(sid)
            self.store.exec("UPDATE spaces SET r4_branch=?, r4_snapshot=? WHERE id=?", (branch, snapshot, sid))
            self.note("space_forked", space=sid, branch=branch)
            for m in self.members(sid):
                self.send(m, {"t": "clock", "clock": self.clock(sid)})
        except Exception as error:
            self.errors.append({"at": time.time(), "space": sid, "error": "fork_failed " + repr(error)[:200]})

    async def on_space_enter(self, c: Conn, m: dict, now: float) -> None:
        sid = m.get("space")
        if sid == c.space:
            return
        if not self.can_enter(c.pid, sid):
            self.store.security("space_denied", code_id=c.code_id, pid=c.pid, space=str(sid)[:20])
            self.send(c, {"t": "error", "code": "space_forbidden"})
            return
        if sid != "hall" and c.space == "hall" and not self.geometry("hall").near("rainbow-door", c.x, c.z, 1.2):
            self.send(c, {"t": "error", "code": "go_to_rainbow_door"})
            return
        await self.move_to(c, sid, "enter")

    async def on_space_invite(self, c: Conn, m: dict, now: float) -> None:
        row = self.store.one("SELECT * FROM spaces WHERE owner_pid=?", (c.pid,))
        target = m.get("pid")
        if not row:
            self.send(c, {"t": "error", "code": "no_space"})
            return
        if not self.store.one("SELECT 1 FROM players WHERE pid=?", (target,)) or target == c.pid:
            self.send(c, {"t": "error", "code": "unknown_player"})
            return
        self.store.exec("INSERT OR IGNORE INTO space_acl VALUES(?,?,?)", (row["id"], target, now))
        self.note("space_invite", owner=c.pid, guest=target, space=row["id"])
        self.send(c, {"t": "spaces", "spaces": self.visible_spaces(c.pid)})
        guest = self.conns.get(target)
        if guest:
            self.send(guest, {"t": "invited", "space": {"id": row["id"], "title": row["title"]}, "from": c.nick})
            self.send(guest, {"t": "spaces", "spaces": self.visible_spaces(target)})

    async def on_space_revoke(self, c: Conn, m: dict, now: float) -> None:
        row = self.store.one("SELECT * FROM spaces WHERE owner_pid=?", (c.pid,))
        target = m.get("pid")
        if not row:
            self.send(c, {"t": "error", "code": "no_space"})
            return
        self.store.exec("DELETE FROM space_acl WHERE space_id=? AND pid=?", (row["id"], target))
        self.note("space_revoke", owner=c.pid, guest=target, space=row["id"])
        self.send(c, {"t": "spaces", "spaces": self.visible_spaces(c.pid)})
        guest = self.conns.get(target)
        if guest:
            self.send(guest, {"t": "spaces", "spaces": self.visible_spaces(target)})
            if guest.space == row["id"]:
                self.send(guest, {"t": "notice", "code": "access_revoked"})
                await self.move_to(guest, "hall", "revoked")

    async def on_spaces(self, c: Conn, m: dict, now: float) -> None:
        self.send(c, {"t": "spaces", "spaces": self.visible_spaces(c.pid)})

    async def on_space_time(self, c: Conn, m: dict, now: float) -> None:
        row = self.space_row(c.space)
        if not row or row["owner_pid"] != c.pid or not row["r4_branch"] or not self.r4:
            self.send(c, {"t": "error", "code": "not_space_owner"})
            return
        action = m.get("action")
        if action in ("pause", "resume"):
            if action == "pause":
                self.paused_spaces.add(c.space)
            else:
                self.paused_spaces.discard(c.space)
            self.store.exec("UPDATE spaces SET paused=? WHERE id=?", (int(action == "pause"), c.space))
            await self.r4.set_schedule(row["r4_branch"], action == "resume")
        elif action == "advance":
            await self.r4.advance(row["r4_branch"], int(m.get("ticks", 1)))
            await self.r4.poll()
        else:
            raise ValueError("action")
        self.broadcast(c.space, {"t": "clock", "clock": self.clock(c.space)})

    # ------------------------------------------------------------------ loops
    async def tick_loop(self) -> None:
        period = 1.0 / TICK_HZ
        n = 0
        last_npcs: dict[str, str] = {}
        while True:
            t0 = time.perf_counter()
            n += 1
            full = n % FULL_EVERY == 0
            self.seq += 1
            self._step_test_npcs(period)
            by_space: dict[str, list[Conn]] = {}
            for c in list(self.conns.values()):
                if c.closed:
                    asyncio.create_task(self.detach(c, "dropped"))
                    continue
                by_space.setdefault(c.space, []).append(c)
            for sid, members in by_space.items():
                changed = [c for c in members if c.dirty or full]
                if changed:
                    rows = [[c.pid, c.x, c.z, round(c.dir, 2), c.anim] for c in changed]
                    self.broadcast(sid, {"t": "s", "seq": self.seq, "time": time.monotonic(), "full": full, "p": rows})
                    for c in changed:
                        c.dirty = False
                        if time.time() - c.last_move > 0.4 and c.anim != "idle":
                            c.anim = "idle"
                            c.dirty = True
                if n % 10 == 0:
                    npcs = self.npcs(sid)
                    key = json.dumps(npcs, sort_keys=True)
                    if key != last_npcs.get(sid) or n % 50 == 0:
                        last_npcs[sid] = key
                        self.broadcast(sid, {"t": "npcs", "npcs": npcs, "clock": self.clock(sid)})
            self.tick_ms.append((time.perf_counter() - t0) * 1000)
            await asyncio.sleep(max(0.0, period - (time.perf_counter() - t0)))

    def _step_test_npcs(self, dt: float) -> None:
        for n in self.test_npcs.values():
            geo = self.geometry(n["space"])
            if random.random() < 0.03:
                n["heading"] = random.uniform(0, 2 * math.pi)
            nx, nz = n["x"] + math.cos(n["heading"]) * 0.8 * dt, n["z"] + math.sin(n["heading"]) * 0.8 * dt
            if geo.free(nx, nz):
                n["x"], n["z"] = nx, nz
            else:
                n["heading"] += math.pi / 2

    def spawn_test_npc(self, sid: str, species: str = "Spirit") -> dict:
        geo = self.geometry(sid)
        x, z = geo.spawn()
        nid = "t_" + secrets.token_hex(3)
        self.test_npcs[nid] = {"id": nid, "space": sid, "species": species[:16], "x": x, "z": z, "heading": 0.0}
        return self.test_npcs[nid]

    async def persist_loop(self) -> None:
        while True:
            await asyncio.sleep(5)
            for c in list(self.conns.values()):
                if c.moved_since_save:
                    self.save_player(c)

    async def r4_loop(self) -> None:
        """Poll R4; if a branch scheduler stopped on a transient worker error, re-enable it with a cap."""
        recoveries: dict[str, deque] = {}
        while True:
            if self.r4 and self.r4.enabled:
                world = await self.r4.poll()
                for sid_row in self.store.all("SELECT id, kind, r4_branch FROM spaces"):
                    branch = "public" if sid_row["kind"] == "public" else sid_row["r4_branch"]
                    b = self.r4.branch(branch) if world else None
                    runner = (b or {}).get("runner") or {}
                    err = runner.get("error")
                    if not b or err == "mesa_support_limit":
                        continue
                    want = sid_row["id"] not in self.paused_spaces
                    if not err and bool(runner.get("enabled")) == want:
                        continue
                    if not want:
                        if runner.get("enabled"):
                            await self.r4.set_schedule(branch, False)
                        continue
                    # Reconcile: the LAB decides whether a world runs; R4 stops a branch on worker errors.
                    q = recoveries.setdefault(branch, deque(maxlen=6))
                    now = time.time()
                    if len(q) >= 6 and now - q[0] < 3600:
                        continue                          # 6 recoveries in an hour: leave it stopped for an operator
                    if q and now - q[-1] < 60:
                        continue
                    q.append(now)
                    self.errors.append({"at": now, "space": sid_row["id"], "error": "r4_runner_recovered " + str(err)[:160]})
                    try:
                        await self.r4.set_schedule(branch, True)
                    except Exception as error:
                        self.errors.append({"at": now, "space": sid_row["id"], "error": "r4_recover_failed " + repr(error)[:160]})
            await asyncio.sleep(3)

    async def housekeeping_loop(self, auth) -> None:
        while True:
            await asyncio.sleep(60)
            auth.purge_expired()
            self.oc.cleanup(online=set(self.conns))
            for c in list(self.conns.values()):        # sessions revoked or expired close their sockets
                if not auth.session(c.token):
                    self.send(c, {"t": "kicked", "reason": "session_ended"})
                    await self.detach(c, "session_ended")

    def stats(self) -> dict:
        ticks = sorted(self.tick_ms) or [0]
        return {"online": len(self.conns), "uptime_s": round(time.time() - self.started),
                "tick_ms_p50": round(ticks[len(ticks) // 2], 3), "tick_ms_p99": round(ticks[int(len(ticks) * 0.99) - 1 if len(ticks) > 1 else 0], 3),
                "counters": dict(self.counters), "oc_cache_bytes": self.oc.total_bytes(),
                "spaces": {sid: len(self.members(sid)) for sid in {c.space for c in self.conns.values()}},
                "test_npcs": len(self.test_npcs)}
