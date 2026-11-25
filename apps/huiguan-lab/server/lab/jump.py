"""《和师父一起跳！》双人房间：复用 LAB 的 Hub / space / 会话与断线重连。

只做房间、座位、角色分配、开赛时刻（波场基准时钟）与事件中继；
波场判定仍由客户端按同一 t0 独立推演，服务端只做射程与回填的行为约束。
"""
from __future__ import annotations

import secrets
import time
from dataclasses import dataclass, field

JUMP_SPACE = "hefu-jump"
LOBBY_SECONDS = 600
RUN_SECONDS = 300
OFFLINE_KEEP = 120.0
ROLES = ("xiaohei", "wuxian")


@dataclass
class Seat:
    pid: str
    nick: str
    role: str
    ready: bool = False
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    alive: bool = True
    extracted: bool = False


@dataclass
class Room:
    id: str
    space: str
    seats: dict[str, Seat] = field(default_factory=dict)
    phase: str = "lobby"          # lobby / running / over
    level: int = 0
    t0: float = 0.0               # 波场基准时刻（服务器时钟）
    deadline: float = 0.0
    reason: str = ""
    revision: int = 0
    offline_since: dict[str, float] = field(default_factory=dict)
    order: list[str] = field(default_factory=list)


class JumpArena:
    def __init__(self):
        self.rooms: dict[str, Room] = {}

    # --- helpers -------------------------------------------------------
    @staticmethod
    def online(hub, space: str, pid: str) -> bool:
        c = hub.conns.get(pid)
        return bool(c and not c.closed and c.space == space)

    @staticmethod
    def fail(hub, conn, code: str) -> None:
        hub.send(conn, {"t": "jump_error", "code": code})

    def room_of(self, conn) -> Room | None:
        return self.rooms.get(conn.space)

    def view(self, hub, conn, now: float) -> dict:
        room = self.rooms.get(conn.space)
        out = {"t": "jump_state", "space": conn.space, "server_time": round(now, 4), "room": None}
        if not room:
            return out
        me = room.seats.get(conn.pid)
        out["room"] = {
            "id": room.id, "revision": room.revision, "phase": room.phase, "level": room.level,
            "reason": room.reason, "t0": round(room.t0, 4),
            "elapsed": max(0.0, round(now - room.t0, 3)) if room.phase == "running" else 0.0,
            "remaining": max(0, round(room.deadline - now)),
            "host": room.order[0] if room.order else "",
            "you": conn.pid if me else "",
            "role": me.role if me else "",
            "ready": me.ready if me else False,
            "seats": [{"pid": s.pid, "nick": s.nick, "role": s.role, "ready": s.ready,
                       "alive": s.alive, "extracted": s.extracted,
                       "online": self.online(hub, conn.space, s.pid)} for s in room.seats.values()],
        }
        return out

    def push(self, hub, room: Room, now: float) -> None:
        for pid in room.seats:
            if self.online(hub, room.space, pid):
                c = hub.conns[pid]
                hub.send(c, self.view(hub, c, now))

    def relay(self, hub, room: Room, payload: dict, *, skip: str = "") -> None:
        for pid in room.seats:
            if pid != skip and self.online(hub, room.space, pid):
                hub.send(hub.conns[pid], payload)

    def _free_role(self, room: Room) -> str:
        used = {s.role for s in room.seats.values()}
        return next((r for r in ROLES if r not in used), "")

    # --- lifecycle -----------------------------------------------------
    def sweep(self, hub, now: float) -> None:
        for space, room in list(self.rooms.items()):
            for pid in list(room.seats):
                room.offline_since[pid] = room.offline_since.get(pid, now)
                if self.online(hub, space, pid):
                    room.offline_since.pop(pid, None)
            dead = {p for p, since in room.offline_since.items() if now - since > OFFLINE_KEEP}
            changed = False
            for pid in dead:
                seat = room.seats.pop(pid, None)
                room.order = [p for p in room.order if p != pid]
                if seat and room.phase == "running" and room.reason == "":
                    room.reason = "peer_lost"
                    room.phase = "over"
                    changed = True
            if changed:
                room.revision += 1
                self.push(hub, room, now)
            if not room.seats:
                del self.rooms[space]
            elif now > room.deadline and room.phase != "over":
                room.phase, room.reason = "over", "timeout"
                room.revision += 1
                self.push(hub, room, now)


def install(hub_cls, arena: JumpArena) -> JumpArena:
    """把 jump_* 处理器挂到 Hub 上，由 app.Lab 调用一次。"""

    async def on_jump_state(self, c, m, now):
        self.send(c, arena.view(self, c, now))

    async def on_jump_create(self, c, m, now):
        room = arena.rooms.get(c.space)
        if room:
            return arena.fail(self, c, "exists")
        if not self.can_enter(c.pid, c.space):
            return arena.fail(self, c, "space")
        role = ROLES[0]
        room = Room(secrets.token_hex(6), c.space,
                    seats={c.pid: Seat(c.pid, c.nick or "旅人", role, ready=False)},
                    deadline=now + LOBBY_SECONDS, order=[c.pid])
        arena.rooms[c.space] = room
        arena.push(self, room, now)

    async def on_jump_join(self, c, m, now):
        room = arena.rooms.get(c.space)
        if not room:
            return arena.fail(self, c, "no_room")
        if c.pid in room.seats:
            return arena.push(self, room, now)
        if len(room.seats) >= len(ROLES) or room.phase != "lobby":
            return arena.fail(self, c, "full")
        role = arena._free_role(room)
        if not role:
            return arena.fail(self, c, "full")
        room.seats[c.pid] = Seat(c.pid, c.nick or "旅人", role)
        room.order.append(c.pid)
        room.revision += 1
        arena.push(self, room, now)

    async def on_jump_ready(self, c, m, now):
        room = arena.rooms.get(c.space)
        if not room or c.pid not in room.seats:
            return arena.fail(self, c, "seat")
        room.seats[c.pid].ready = bool(m.get("ready", True))
        room.revision += 1
        arena.push(self, room, now)

    async def on_jump_start(self, c, m, now):
        room = arena.rooms.get(c.space)
        if not room or c.pid not in room.seats:
            return arena.fail(self, c, "seat")
        if room.order and room.order[0] != c.pid:
            return arena.fail(self, c, "host")
        if room.phase == "running":
            return arena.fail(self, c, "running")
        for pid in list(room.seats):
            if not arena.online(self, c.space, pid):
                room.seats.pop(pid, None)
                room.order = [p for p in room.order if p != pid]
        if not room.seats:
            return arena.fail(self, c, "empty")
        lvl = m.get("level", 0)
        room.level = lvl if type(lvl) is int and 0 <= lvl <= 15 else 0
        room.phase = "running"
        room.reason = ""
        room.t0 = now + 1.0            # 留 1s 给双方对齐后再起波
        room.deadline = now + 1.0 + RUN_SECONDS
        for seat in room.seats.values():
            seat.alive, seat.extracted = True, False
        room.revision += 1
        arena.push(self, room, now)

    async def on_jump_pose(self, c, m, now):
        room = arena.rooms.get(c.space)
        if not room or c.pid not in room.seats or room.phase != "running":
            return
        seat = room.seats[c.pid]

        def num(key):
            v = m.get(key, 0.0)
            return float(v) if type(v) in (int, float) else 0.0

        seat.x, seat.y, seat.z = num("x"), num("y"), num("z")
        arena.relay(self, room, {"t": "jump_peer", "pid": c.pid, "x": seat.x, "y": seat.y,
                                 "z": seat.z, "alive": seat.alive, "at": round(now, 4)}, skip=c.pid)

    async def on_jump_evt(self, c, m, now):
        room = arena.rooms.get(c.space)
        if not room or c.pid not in room.seats or room.phase != "running":
            return
        kind = str(m.get("kind", ""))[:16]
        if kind not in ("jump", "rescued", "extract", "down"):
            return arena.fail(self, c, "kind")
        seat = room.seats[c.pid]
        if kind == "down":
            seat.alive = False
            room.phase, room.reason = "over", "down"
            room.revision += 1
        elif kind == "extract":
            seat.extracted = True
            if all(s.extracted for s in room.seats.values()):
                room.phase, room.reason = "over", "win"
                room.revision += 1
        arena.relay(self, room, {"t": "jump_evt", "kind": kind, "pid": c.pid,
                                 "x": m.get("x", 0.0), "y": m.get("y", 0.0), "z": m.get("z", 0.0),
                                 "at": round(now, 4)}, skip=c.pid)
        if room.phase == "over":
            arena.push(self, room, now)

    async def on_jump_leave(self, c, m, now):
        room = arena.rooms.get(c.space)
        if not room or c.pid not in room.seats:
            return
        if room.phase == "running":
            room.reason = "left"
            room.phase = "over"
        room.seats.pop(c.pid, None)
        room.order = [p for p in room.order if p != c.pid]
        room.revision += 1
        if not room.seats:
            arena.rooms.pop(c.space, None)
            self.send(c, {"t": "jump_state", "space": c.space, "room": None, "server_time": round(now, 4)})
        else:
            arena.push(self, room, now)

    async def on_jump_ping(self, c, m, now):
        self.send(c, {"t": "jump_pong", "c": m.get("c"), "server_time": round(now, 4)})

    handlers = (on_jump_state, on_jump_create, on_jump_join, on_jump_ready, on_jump_start,
                on_jump_pose, on_jump_evt, on_jump_leave, on_jump_ping)
    for fn in handlers:
        setattr(hub_cls, fn.__name__, fn)
    return arena


async def maintain(hub, arena: JumpArena) -> None:
    import asyncio
    while True:
        await asyncio.sleep(2)
        try:
            arena.sweep(hub, time.time())
        except Exception:      # 房间维护不允许打断其他小游戏
            pass
