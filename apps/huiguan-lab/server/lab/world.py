"""Realtime authoritative hub: presence, movement validation, chat, emotes, spaces, interactions.

Protocol: JSON text frames over one WebSocket per player (protocol version 1, see ARCHITECTURE.md).
The server owns every shared fact; clients only propose moves and actions.
"""
from __future__ import annotations
from pathlib import Path

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
from .art import catalog

log = logging.getLogger("lab.world")
PROTOCOL = 1
TICK_HZ = 10
FULL_EVERY = 20          # full snapshot every 2 s heals any lost delta
CONTROL_RE = re.compile(r"[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]")


def clean_text(text: str, limit: int) -> str:
    text = unicodedata.normalize("NFC", str(text))
    text = CONTROL_RE.sub("", text).strip()
    return text[:limit]


def point_in_polygon(x, z, polygon):
    inside = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if (a[1] > z) != (b[1] > z) and x < (b[0]-a[0]) * (z-a[1]) / (b[1]-a[1]) + a[0]:
            inside = not inside
    return inside


class Geometry:
    def __init__(self, template: dict, player: dict):
        self.t = template
        self.radius = player["radius"]
        self.max_speed = player["run_speed"]
        self.min = template["bounds"]["min"]
        self.max = template["bounds"]["max"]
        self.obstacles = [(o["position"][0], o["position"][2], o["radius"] + self.radius) for o in template["obstacles"]]
        self.objects = {o["id"]: o for o in template["objects"]}
        self.crossing = template.get("river_crossing")

    def in_river(self, x: float, z: float) -> bool:
        if self.crossing is None:
            return False
        west, north, width, length = self.crossing["channel"]
        return west <= x < west + width and north <= z < north + length

    def free(self, x: float, z: float) -> bool:
        if not (self.min[0] <= x <= self.max[0] and self.min[2] <= z <= self.max[2]):
            return False
        if self.in_river(x, z):
            lo, hi = self.crossing["deck_z"]
            if not lo <= z < hi:
                return False
        for polygon in self.t.get('blocked_polygons', []):
            if point_in_polygon(x, z, polygon):
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
    east_bank: bool = False
    ip_hint: str = ""
    connected_at: float = field(default_factory=time.time)
    last_move: float = field(default_factory=time.time)
    dirty: bool = True
    moved_since_save: bool = False
    msg_times: deque = field(default_factory=lambda: deque(maxlen=200))
    chat_times: deque = field(default_factory=lambda: deque(maxlen=20))
    oc_times: deque = field(default_factory=lambda: deque(maxlen=10))
    corrections: int = 0
    part_colors: dict = field(default_factory=dict)
    face: dict = field(default_factory=dict)
    tile_times: deque = field(default_factory=lambda: deque(maxlen=64))
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
        self.color_parts = {part["mesh"] for part in json.loads((Path(__file__).parents[2]/"client/assets/renmo1/parts.json").read_text(encoding="utf-8"))}
        # Face slots (eyes / brows / mouth ...) baked by the renmo pipeline (renmo1-live2d/pipeline); re-read on restart.
        variants = json.loads((Path(__file__).parents[2]/"client/assets/renmo1/variants.json").read_text(encoding="utf-8"))
        self.face_options = {s["id"]: {o["id"] for o in s["options"]} for s in variants["slots"]}
        self.face_defaults = {s["id"]: s["default"] for s in variants["slots"]}
        self.store, self.oc, self.r4, self.version = store, oc, r4, version
        self.conns: dict[str, Conn] = {}
        self.chat: dict[str, deque] = {}
        self.test_npcs: dict[str, dict] = {}      # admin-spawned, gateway-only, non-persistent
        self.entities = {r['id']: json.loads(r['state']) for r in store.all('SELECT id,state FROM lab_entities')}
        for n in self.entities.values():
            if n.get('asset') == 'b_mushroom':
                n.update(kind='plant', behavior='idle', speed=0)
                self.save_entity(n)
        self.paths = data.get("paths", {"kinds": {"dirt": "泥土路"}, "reach": 4.0, "max_per_space": 3000, "per_10s": 24})
        self.tiles: dict[str, dict[tuple[int, int], dict]] = {}
        for r in store.all("SELECT space_id,x,z,kind,placed_by FROM lab_tiles"):
            self.tiles.setdefault(r["space_id"], {})[(r["x"], r["z"])] = {"kind": r["kind"], "by": r["placed_by"]}
        self.art_dir = None
        self.seq = 0
        self.creature_states: dict[str, dict] = {}
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

    def r4_branch(self, sid):
        row = self.space_row(sid)
        if not row or row['template'] == 'initial':
            return None
        return 'public' if row['kind'] == 'public' else row['r4_branch']

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
                "client": c.client, "oc": oc.digest if oc else None, "part_colors":c.part_colors, "face": self.face_of(c)}

    def objects_state(self, sid: str) -> dict:
        return {r["object_id"]: json.loads(r["state"]) for r in
                self.store.all("SELECT object_id,state FROM world_objects WHERE space_id=?", (sid,))}

    def npcs(self, sid: str) -> list[dict]:
        row = self.space_row(sid)
        out = []
        if row and self.r4:
            geo = self.geo[row["template"]]
            branch = self.r4_branch(sid)
            for a in self.r4.actors(branch):
                if a["alive"]:
                    x, z = geo.pasture(a["cell"])
                    out.append({"id": a["id"], "species": a["species"], "x": x, "z": z, "source": "r4"})
        for n in self.test_npcs.values():
            if n["space"] == sid:
                out.append({"id": n["id"], "species": n["species"], "x": round(n["x"], 2), "z": round(n["z"], 2),
                            "source": "test"})
        for n in self.entities.values():
            if n['space'] != sid or not n.get('visible', True):
                continue
            view = dict(n, x=round(n['x'], 2), z=round(n['z'], 2), source='lab')
            if n.get('stages'):
                stage = n['stage']
                if n.get('grow_seconds', 0):
                    stage = min(len(n['stages'])-1, stage + int((n.get('growth_paused', time.time())-n['growth_at'])/n['grow_seconds']))
                view['asset'] = n['stages'][stage]
                view['stage'] = stage
            out.append(view)
        return out

    def save_entity(self, n):
        self.store.exec('INSERT OR REPLACE INTO lab_entities(id,space_id,state,updated_at) VALUES(?,?,?,?)',
                        (n['id'], n['space'], json.dumps(n, ensure_ascii=False), time.time()))

    def save_entities(self):
        with self.store.tx():
            for n in self.entities.values():
                self.save_entity(n)

    def edit_entity(self, sid, body, eid=None):
        if not self.space_row(sid):
            raise ValueError('空间不存在')
        old = self.entities.get(eid) if eid else None
        if eid and (not old or old['space'] != sid):
            raise ValueError('找不到这个 LAB 生物/植物')
        if not old and sum(n['space'] == sid for n in self.entities.values()) >= 500:
            raise ValueError('这个空间已放置 500 个对象')
        x, z = self.geometry(sid).spawn()
        n = dict(old or {'id': 'e_' + secrets.token_hex(6), 'space': sid, 'x': x, 'z': z,
                         'species': '小灵体', 'kind': 'creature', 'asset': 'b_spirit', 'height': 1.0,
                         'speed': 0.8, 'behavior': 'wander', 'heading': 0.0, 'visible': True,
                         'stage': 0, 'grow_seconds': 0, 'growth_at': time.time(), 'stages': []})
        for k in ('species', 'asset', 'kind', 'behavior'):
            if k in body:
                n[k] = clean_text(body[k], 80)
        if n['kind'] not in ('creature', 'plant', 'prop') or n['behavior'] not in ('idle', 'wander', 'follow'):
            raise ValueError('类型或行为无效')
        assets = {a['id']: a for a in catalog(self.store)}
        if n['asset'] not in assets:
            raise ValueError('请选择已发布的素材')
        if not old or n['asset'] != old['asset']:
            n['stages'] = assets[n['asset']].get('stages', [])
            n['growth_at'] = time.time()
        for k, lo, hi in [('x', -1000, 1000), ('z', -1000, 1000), ('height', 0.1, 12), ('speed', 0, 10), ('grow_seconds', 0, 86400)]:
            if k in body:
                v = float(body[k])
                if not math.isfinite(v) or not lo <= v <= hi:
                    raise ValueError(f'{k} 超出范围')
                n[k] = v
        if n["asset"] == "b_mushroom":
            n.update(kind="plant", behavior="idle", speed=0)
        geo = self.geometry(sid)
        if not (geo.min[0] <= n['x'] <= geo.max[0] and geo.min[2] <= n['z'] <= geo.max[2]):
            raise ValueError('位置超出地图')
        if n['kind'] == 'creature' and not geo.free(n['x'], n['z']):
            raise ValueError('生物位置被房屋或水域挡住，请换一个位置')
        if 'stage' in body:
            n['stage'] = max(0, min(2, int(body['stage'])))
            n['growth_at'] = time.time()
        if 'visible' in body:
            n['visible'] = bool(body['visible'])
        if sid in self.paused_spaces:
            paused_now = time.time()
            if old and 'growth_paused' in old and 'stage' not in body and n['asset'] == old['asset']:
                n['growth_at'] += paused_now - old['growth_paused']
            n['growth_paused'] = paused_now
        self.entities[n['id']] = n
        self.save_entity(n)
        self.broadcast(sid, {'t': 'npcs', 'npcs': self.npcs(sid), 'clock': self.clock(sid)})
        return n

    def pause_entity_growth(self, sid, paused):
        now = time.time()
        for n in self.entities.values():
            if n['space'] != sid:
                continue
            if paused:
                n.setdefault('growth_paused', now)
            elif 'growth_paused' in n:
                n['growth_at'] += now - n.pop('growth_paused')
            self.save_entity(n)

    def delete_entity(self, sid, eid):
        n = self.entities.get(eid)
        if not n or n['space'] != sid:
            raise ValueError('对象不存在')
        self.store.exec('DELETE FROM lab_entities WHERE id=?', (eid,))
        self.entities.pop(eid)
        self.creature_states.pop(eid, None)
        self.broadcast(sid, {'t': 'npcs', 'npcs': self.npcs(sid), 'clock': self.clock(sid)})

    # ------------------------------------------------------------------ ground tiles (player-placed dirt path)
    def tiles_view(self, sid: str) -> list:
        return [[x, z, t["kind"], t["by"]] for (x, z), t in sorted(self.tiles.get(sid, {}).items())]

    def tile_check(self, sid: str, x: int, z: int) -> str | None:
        geo = self.geometry(sid)
        cx, cz = x + 0.5, z + 0.5
        if not (geo.min[0] - 0.5 <= cx <= geo.max[0] + 0.5 and geo.min[2] - 0.5 <= cz <= geo.max[2] + 0.5):
            return "tile_blocked"
        if geo.in_river(cx, cz):
            return "tile_blocked"
        for polygon in geo.t.get("blocked_polygons", []):      # never pave the house or the river
            if point_in_polygon(cx, cz, polygon):
                return "tile_blocked"
        for o in geo.t["obstacles"]:
            if o["kind"] == "water" and math.dist((cx, cz), (o["position"][0], o["position"][2])) < o["radius"]:
                return "tile_blocked"
        return None

    def set_tile(self, sid: str, x: int, z: int, on: bool, by: str, kind: str = "dirt") -> bool:
        cells = self.tiles.setdefault(sid, {})
        if on:
            cells[(x, z)] = {"kind": kind, "by": by}
            self.store.exec("INSERT OR REPLACE INTO lab_tiles(space_id,x,z,kind,placed_by,placed_at) VALUES(?,?,?,?,?,?)",
                            (sid, x, z, kind, by, time.time()))
        else:
            if cells.pop((x, z), None) is None:
                return False
            self.store.exec("DELETE FROM lab_tiles WHERE space_id=? AND x=? AND z=?", (sid, x, z))
        self.broadcast(sid, {"t": "tile", "x": x, "z": z, "on": on, "kind": kind, "by": by})
        return True

    def clock(self, sid: str) -> dict:
        row = self.space_row(sid)
        if not row or not self.r4:
            return {"available": False}
        branch = self.r4_branch(sid)
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
                "garden_phase":self.garden_phase(c.pid), "inventory": self.inventory(c.pid), "tiles": self.tiles_view(c.space), "chat": list(self.chat.get(c.space, [])), "spaces": self.visible_spaces(c.pid),
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

    async def on_minigame(self, c: Conn, m: dict, now: float) -> None:
        self.minigames.handle(self, c, m, now)

    async def on_hello(self, c: Conn, m: dict, now: float) -> None:
        c.client = clean_text(m.get("client", "?"), 8) or "?"
        c.version = clean_text(m.get("version", "?"), 32) or "?"
        c.east_bank = m.get("east_bank") is True
        geo = self.geometry(c.space)
        if geo.crossing is not None and not c.east_bank:
            west, landing_z = geo.crossing["west_landing"]
            if c.x > west:
                # Old builds stop at the west bank even on reconnect.
                c.x, c.z = (west, landing_z) if geo.free(west, landing_z) else geo.spawn()
        await self.join(c)

    async def on_hello_view(self, c: Conn, m: dict, now: float) -> None:
        c.client = clean_text(m.get("client", "?"), 8) or "?"

    async def on_ping(self, c: Conn, m: dict, now: float) -> None:
        self.send(c, {"t": "pong", "id": m.get("id"), "server_time": now})

    async def on_rtt(self, c: Conn, m: dict, now: float) -> None:
        v = float(m.get("ms", 0))
        if 0 <= v < 60000:
            c.rtt_ms = v

    def face_of(self, c: Conn) -> dict:
        return {k: c.face.get(k, d) for k, d in self.face_defaults.items()}

    async def on_profile(self, c: Conn, m: dict, now: float) -> None:
        nick = clean_text(m.get("nick", ""), 16)
        if len(nick) < 1:
            self.send(c, {"t": "error", "code": "nick_required"})
            return
        colors = m.get("part_colors",c.part_colors)
        allowed = self.color_parts
        if not isinstance(colors,dict) or len(colors)>len(allowed) or any(k not in allowed or not isinstance(v,str) or not re.fullmatch(r'[0-9a-fA-F]{6}',v) for k,v in colors.items()):
            raise ValueError('part_colors')
        face = self.face_of(c)
        req = m.get("face", {})
        if "mouth" in m and isinstance(req, dict) and "mouth" not in req:
            req = {**req, "mouth": m["mouth"]}  # clients from before face slots
        if not isinstance(req, dict) or any(k not in self.face_options or not isinstance(v, str) or v not in self.face_options[k] for k, v in req.items()):
            raise ValueError('face')
        face.update(req)
        c.part_colors = dict(colors)
        c.face = face
        c.nick = nick
        self.save_player(c)
        self.broadcast(c.space, {"t": "profile", "pid": c.pid, "nick": nick, "part_colors":c.part_colors, "face": self.face_of(c)})

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
        elif geo.crossing is not None and not c.east_bank and x > geo.crossing["west_landing"][0]:
            reason = "blocked"
        elif not geo.segment_free(c.x, c.z, x, z):
            reason = "blocked"
        if reason:
            c.corrections += 1
            self.counters["rejected_moves"] += 1
            self.send(c, {"t": "correct", "x": c.x, "z": c.z, "reason": reason, "seq": m.get("seq")})
            return
        was_idle = c.anim == "idle"
        c.x, c.z = round(x, 3), round(z, 3)
        c.dir = float(m.get("dir", c.dir)) % (2 * math.pi)
        anim = m.get("anim", "walk")
        c.anim = anim if anim in ("idle", "walk", "run") else "walk"
        if dist > 0.001 and c.anim == "idle": c.anim = "walk"
        if was_idle and c.anim != "idle":
            self.broadcast(c.space, {"t":"emote_cancel","pid":c.pid})
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
        if c.anim != "idle":
            self.send(c, {"t":"error","code":"emote_while_moving"})
            return
        if eid == "crouch" and self.garden_phase(c.pid) < 3:
            self.send(c, {"t":"error","code":"crouch_locked"})
            return
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

    async def on_asset_get(self, c: Conn, m: dict, now: float) -> None:
        aid = str(m.get('id', ''))
        if not re.fullmatch(r'a_[0-9a-f]{12}', aid) or not self.art_dir:
            return
        if not any(n.get('asset') == aid for n in self.npcs(c.space)):
            return
        row = self.store.one("SELECT status FROM art_assets WHERE id=?", (aid,))
        if not row or row['status'] != 'approved':
            return
        f = self.art_dir / 'approved' / f'{aid}.preview.png'
        if not f.exists():
            original = self.art_dir / 'approved' / f'{aid}.png'
            if not original.exists():
                return
            png, _, _, _ = await asyncio.to_thread(normalize_image, original.read_bytes(), 32*1024*1024, 4096, 512)
            f.write_bytes(png)
        self.send(c, {'t': 'asset', 'id': aid, 'png': base64.b64encode(f.read_bytes()).decode()})

    async def on_interact(self, c: Conn, m: dict, now: float) -> None:
        oid = m.get("object")
        if not isinstance(oid, str):
            raise ValueError("object")
        plant = self.entities.get(oid)
        if plant and plant['space'] == c.space and plant['kind'] == 'plant' and plant['visible']:
            if math.dist((c.x, c.z), (plant['x'], plant['z'])) > 1.9:
                self.send(c, {'t':'error','code':'too_far'})
                return
            plant['stage'] = (plant['stage'] + 1) % 3
            plant['growth_at'] = now
            if c.space in self.paused_spaces:
                plant['growth_paused'] = now
            self.save_entity(plant)
            self.broadcast(c.space, {'t':'npcs','npcs':self.npcs(c.space),'clock':self.clock(c.space)})
            return
        geo = self.geometry(c.space)
        if not geo.near(oid, c.x, c.z):
            self.send(c, {"t": "error", "code": "too_far"})
            return
        obj = geo.objects[oid]
        kind = obj["kind"]
        if kind == "game_pavilion":
            self.send(c, {"t": "minigame_open"})
            return
        if kind == "game_relay":
            self.minigames.field.interact(self, c, oid, now)
            return
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

    def inventory(self, pid):
        self.store.exec("INSERT OR IGNORE INTO garden_inventory(pid) VALUES(?)", (pid,))
        r = self.store.one("SELECT seeds,soil FROM garden_inventory WHERE pid=?", (pid,))
        return dict(r)

    def garden_phase(self, pid):
        self.store.exec("INSERT OR IGNORE INTO garden_progress(pid) VALUES(?)",(pid,))
        return self.store.one("SELECT phase FROM garden_progress WHERE pid=?",(pid,))['phase']

    def send_inventory(self, c):
        self.send(c, {"t": "inventory", **self.inventory(c.pid), "garden_phase":self.garden_phase(c.pid)})

    def planted_at(self, sid, x, z):
        return next((n for n in self.entities.values() if n['space'] == sid and
                     n.get('planted_by') and math.floor(n['x']) == x and math.floor(n['z']) == z), None)

    async def on_garden(self, c, m, now):
        action = m.get('action')
        if action not in ('plant', 'shovel'):
            raise ValueError('action')
        x, z = m['x'], m['z']
        if any(isinstance(v, bool) or not isinstance(v, (int,float)) or not math.isfinite(v) or v != int(v) or abs(v)>1000 for v in (x,z)):
            raise ValueError('cell')
        x,z = int(x),int(z)
        def fail(code): self.send(c, {"t":"error", "code":code})
        if math.dist((c.x,c.z),(x+.5,z+.5)) > float(self.paths['reach']):
            return fail('tile_too_far')
        plant = self.planted_at(c.space,x,z)
        inv = self.inventory(c.pid)
        if action == 'plant':
            tile = self.tiles.get(c.space,{}).get((x,z))
            if not tile or tile['kind'] != 'dirt': return fail('need_dirt')
            if tile['by'] not in (c.pid,'lab'): return fail('tile_not_yours')
            if plant: return fail('plant_occupied')
            if inv['seeds'] < 1: return fail('no_seeds')
            if sum(n['space']==c.space for n in self.entities.values()) >= 500: return fail('plant_limit')
            plant = {'id':'e_'+secrets.token_hex(6),'space':c.space,'x':x+.5,'z':z+.5,
                     'species':'蘑菇','kind':'plant','asset':'b_mushroom','height':.8,
                     'speed':0,'behavior':'idle','heading':0,'visible':True,'stage':0,
                     'grow_seconds':0,'growth_at':now,'stages':[],'planted_by':c.pid}
            with self.store.tx():
                self.store.exec('UPDATE garden_inventory SET seeds=seeds-1 WHERE pid=?',(c.pid,))
                self.save_entity(plant)
                phase = self.garden_phase(c.pid)
                self.store.exec('UPDATE garden_progress SET phase=? WHERE pid=?',(3 if phase>=2 else 1,c.pid))
            self.entities[plant['id']] = plant
        else:
            if not plant: return fail('no_mushroom')
            if plant['planted_by'] != c.pid: return fail('plant_not_yours')
            with self.store.tx():
                self.store.exec('DELETE FROM lab_entities WHERE id=?',(plant['id'],))
                self.store.exec('UPDATE garden_inventory SET seeds=seeds+1 WHERE pid=?',(c.pid,))
                phase = self.garden_phase(c.pid)
                if phase == 1: self.store.exec('UPDATE garden_progress SET phase=2 WHERE pid=?',(c.pid,))
            self.entities.pop(plant['id'])
        self.send_inventory(c)
        self.broadcast(c.space, {'t':'npcs','npcs':self.npcs(c.space),'clock':self.clock(c.space)})

    async def on_tile(self, c: Conn, m: dict, now: float) -> None:
        """Place or lift one 1 m ground tile. The cell (x, z) covers [x, x+1) x [z, z+1) in metres."""
        def cell(v):
            # Godot may send 3 or 3.0; anything that is not a whole number is refused
            if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v != int(v):
                raise ValueError("cell")
            v = int(v)
            if not -1000 <= v <= 1000:
                raise ValueError("cell")
            return v
        x, z, on = cell(m["x"]), cell(m["z"]), m.get("on", True)
        if not isinstance(on, bool):
            raise ValueError("on")
        kind = str(m.get("kind", "dirt"))
        if kind not in self.paths["kinds"]:
            raise ValueError("kind")
        if math.dist((c.x, c.z), (x + 0.5, z + 0.5)) > float(self.paths["reach"]):
            self.send(c, {"t": "error", "code": "tile_too_far"})
            return
        c.tile_times.append(now)
        limit = int(self.paths["per_10s"])
        if len(c.tile_times) > limit and now - c.tile_times[-limit - 1] < 10:
            self.send(c, {"t": "error", "code": "tile_rate_limited"})
            return
        cells = self.tiles.get(c.space, {})
        current = cells.get((x, z))
        if on:
            if current:
                return
            blocked = self.tile_check(c.space, x, z)
            if blocked:
                self.send(c, {"t": "error", "code": blocked})
                return
            if len(cells) >= int(self.paths["max_per_space"]):
                self.send(c, {"t": "error", "code": "tile_limit"})
                return
            if self.inventory(c.pid)['soil'] < 1:
                self.send(c, {"t":"error","code":"no_soil"})
                return
            with self.store.tx():
                self.store.exec('UPDATE garden_inventory SET soil=soil-1 WHERE pid=?',(c.pid,))
                self.set_tile(c.space, x, z, True, c.pid, kind)
            self.send_inventory(c)
        else:
            if not current:
                return
            row = self.space_row(c.space)
            # your own tiles, tiles the LAB laid, or anything in a space you own
            if current["by"] not in (c.pid, "lab") and not (row and row["owner_pid"] == c.pid):
                self.send(c, {"t": "error", "code": "tile_not_yours"})
                return
            if self.planted_at(c.space,x,z):
                self.send(c, {"t":"error","code":"soil_has_mushroom"})
                return
            with self.store.tx():
                self.set_tile(c.space, x, z, False, c.pid, current["kind"])
                # Only lifting your own placed soil refunds an item; public roads cannot mint soil.
                if current['by'] == c.pid:
                    self.inventory(c.pid)
                    self.store.exec('UPDATE garden_inventory SET soil=soil+1 WHERE pid=?',(c.pid,))
            self.send_inventory(c)

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
        if self.space_row(sid)['kind'] == 'private' and c.space == "hall" and not self.geometry("hall").near("rainbow-door", c.x, c.z, 1.2):
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
                npcs = self.npcs(sid)
                now = time.monotonic()
                motion = [[a['id'], a['x'], a['z'], a.get('heading', 0),
                           self.creature_states.get(a['id'], {}).get('action', 'idle'),
                           a.get('speed', 0)] for a in npcs if a.get('kind') == 'creature' and a.get('source') == 'lab']
                if motion:
                    self.broadcast(sid, {"t": "npc_motion", "space": sid, "seq": self.seq,
                                         "time": now, "motions": motion})
                if n % 10 == 0:
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
        for n in self.entities.values():
            state = self.creature_states.setdefault(n['id'], {'action': 'idle', 'until': 0.0})
            if n.get('asset') == 'b_mushroom' or n['space'] in self.paused_spaces or n['kind'] != 'creature' or n['behavior'] == 'idle' or not n['visible']:
                state['action'] = 'idle'
                continue
            geo = self.geometry(n['space'])
            if n.get('asset') == 'b_frog' and n['behavior'] == 'wander':
                now = time.monotonic()
                members = self.members(n['space'])
                near = min(members, key=lambda c: math.hypot(n['x']-c.x, n['z']-c.z), default=None)
                if now >= state['until']:
                    if state['action'] == 'watch' and near:
                        state.update(action='retreat', until=now+1.0)
                        n['heading'] = math.atan2(n['z']-near.z, n['x']-near.x)
                    elif state['action'] == 'retreat':
                        state.update(action='rest', until=now+1.5)
                    elif near and math.hypot(n['x']-near.x, n['z']-near.z) < 2.4:
                        state.update(action='watch', until=now+0.8)
                        n['heading'] = math.atan2(near.z-n['z'], near.x-n['x'])
                    elif state['action'] in ('walk', 'idle'):
                        state.update(action='rest', until=now+random.uniform(0.8, 1.8))
                    else:
                        state.update(action='walk', until=now+random.uniform(2.0, 4.0))
                        n['heading'] = random.uniform(0, math.tau)
                if state['action'] in ('watch', 'rest'):
                    continue
            if n['behavior'] == 'follow':
                members = self.members(n['space'])
                if not members:
                    state['action'] = 'idle'
                    continue
                target = min(members, key=lambda c: math.dist((n['x'], n['z']), (c.x, c.z)))
                if math.dist((n['x'], n['z']), (target.x, target.z)) < 1.2:
                    state['action'] = 'idle'
                    continue
                n['heading'] = math.atan2(target.z-n['z'], target.x-n['x'])
            elif n.get('asset') != 'b_frog' and random.random() < .03:
                n['heading'] = random.uniform(0, math.tau)
            nx = n['x'] + math.cos(n['heading']) * n['speed'] * dt
            nz = n['z'] + math.sin(n['heading']) * n['speed'] * dt
            if geo.segment_free(n['x'], n['z'], nx, nz):
                n['x'], n['z'] = nx, nz
                if state['action'] != 'retreat':
                    state['action'] = 'walk' if n['speed'] > 0 else 'idle'
            else:
                n['heading'] += math.pi / 2
                state.update(action='rest', until=time.monotonic()+0.5)

    def spawn_test_npc(self, sid: str, species: str = "Spirit") -> dict:
        geo = self.geometry(sid)
        x, z = geo.spawn()
        nid = "t_" + secrets.token_hex(3)
        self.test_npcs[nid] = {"id": nid, "space": sid, "species": species[:16], "x": x, "z": z, "heading": 0.0}
        return self.test_npcs[nid]

    async def persist_loop(self) -> None:
        while True:
            await asyncio.sleep(5)
            self.save_entities()
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
                    branch = self.r4_branch(sid_row['id'])
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
