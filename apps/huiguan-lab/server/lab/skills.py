"""Skill tree + 4-slot skill bar for the LAB (PixelFX effects, see client/data/skills.json).

Server-authoritative and purely presentational: a cast changes nothing in the world or the R4 simulation, it is
only broadcast so every player in the space sees the effect.

    skill_state            -> {"t":"skills", points, unlocked[], equipped[4], next_point_in}
    skill_unlock {id}      -> spends `cost` points; needs any unlocked skill of the previous tier in the branch
    skill_equip {slot,id}  -> id "" empties the slot; a skill sits in at most one slot
    skill_cast {id}        -> must be equipped; per-player global and per-skill cooldowns
                              broadcast {"t":"cast", pid, id, x, z, dir}

Points: `start_points` once, then one point for every `minutes_per_point` minutes connected.
Tables live in the shared LAB sqlite (created here, nothing else reads them).

Wiring (no edits to world.py): app.py calls `install(Hub, store, path)`, which adds the on_skill_* handlers that
Hub.handle dispatches by message type.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS skill_state(
  pid TEXT PRIMARY KEY, points INTEGER NOT NULL DEFAULT 0 CHECK(points>=0),
  unlocked TEXT NOT NULL DEFAULT '[]', equipped TEXT NOT NULL DEFAULT '["","","",""]',
  online_s REAL NOT NULL DEFAULT 0, earned INTEGER NOT NULL DEFAULT 0, updated_at REAL NOT NULL);
"""
GLOBAL_COOLDOWN = 0.8


class SkillBook:
    def __init__(self, store, path: Path):
        self.store = store
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        self.data = data
        self.skills: dict = data["skills"]
        self.slots = int(data.get("slots", 4))
        self.start_points = int(data.get("start_points", 10))
        self.minutes_per_point = float(data.get("minutes_per_point", 10))
        self.by_tier: dict[tuple[str, int], set[str]] = {}
        for sid, s in self.skills.items():
            self.by_tier.setdefault((s["branch"], int(s["tier"])), set()).add(sid)
        for stmt in [s for s in SCHEMA.split(";") if s.strip()]:
            store.exec(stmt)
        self.cooldowns: dict[str, dict[str, float]] = {}

    # ------------------------------------------------------------------ storage
    def row(self, pid: str) -> dict:
        r = self.store.one("SELECT * FROM skill_state WHERE pid=?", (pid,))
        if not r:
            self.store.exec("INSERT OR IGNORE INTO skill_state(pid,points,updated_at) VALUES(?,?,?)",
                            (pid, self.start_points, time.time()))
            r = self.store.one("SELECT * FROM skill_state WHERE pid=?", (pid,))
        d = dict(r)
        d["unlocked"] = [s for s in json.loads(d["unlocked"]) if s in self.skills]
        eq = json.loads(d["equipped"])
        d["equipped"] = [(eq[i] if i < len(eq) and eq[i] in d["unlocked"] else "") for i in range(self.slots)]
        return d

    def save(self, pid: str, d: dict) -> None:
        self.store.exec("UPDATE skill_state SET points=?, unlocked=?, equipped=?, online_s=?, earned=?, updated_at=? WHERE pid=?",
                        (int(d["points"]), json.dumps(d["unlocked"]), json.dumps(d["equipped"]), float(d["online_s"]),
                         int(d["earned"]), time.time(), pid))

    def view(self, pid: str) -> dict:
        d = self.row(pid)
        per = self.minutes_per_point * 60
        return {"t": "skills", "points": d["points"], "unlocked": d["unlocked"], "equipped": d["equipped"],
                "next_point_in": round(per - (d["online_s"] % per), 1) if per > 0 else None}

    # ------------------------------------------------------------------ rules
    def unlock(self, pid: str, sid: str) -> str | None:
        s = self.skills.get(sid)
        if s is None:
            return "skill_unknown"
        d = self.row(pid)
        if sid in d["unlocked"]:
            return "skill_already"
        tier = int(s["tier"])
        if tier > 1 and not (self.by_tier.get((s["branch"], tier - 1), set()) & set(d["unlocked"])):
            return "skill_needs_previous"
        if d["points"] < int(s["cost"]):
            return "skill_no_points"
        d["points"] -= int(s["cost"])
        d["unlocked"].append(sid)
        # first skills fill empty slots, so a new player can press 1 right away
        if "" in d["equipped"]:
            d["equipped"][d["equipped"].index("")] = sid
        self.save(pid, d)
        return None

    def equip(self, pid: str, slot: int, sid: str) -> str | None:
        if not (0 <= slot < self.slots):
            return "skill_bad_slot"
        d = self.row(pid)
        if sid and sid not in d["unlocked"]:
            return "skill_locked"
        if sid in d["equipped"]:
            d["equipped"][d["equipped"].index(sid)] = ""
        d["equipped"][slot] = sid
        self.save(pid, d)
        return None

    def cast_check(self, pid: str, sid: str, now: float) -> str | None:
        d = self.row(pid)
        if sid not in d["equipped"]:
            return "skill_not_equipped"
        cd = self.cooldowns.setdefault(pid, {})
        if now < cd.get("", 0.0) or now < cd.get(sid, 0.0):
            return "skill_cooldown"
        cd[""] = now + GLOBAL_COOLDOWN
        cd[sid] = now + float(self.skills[sid].get("cooldown", 1.0))
        return None

    def tick_online(self, pid: str, seconds: float) -> bool:
        """Adds connected time; returns True when that earned a point."""
        d = self.row(pid)
        d["online_s"] += seconds
        per = self.minutes_per_point * 60
        due = int(d["online_s"] // per) if per > 0 else 0
        gained = due > d["earned"]
        if gained:
            d["points"] += due - d["earned"]
            d["earned"] = due
        self.save(pid, d)
        return gained

    # ------------------------------------------------------------------ admin
    def grant(self, pid: str, points: int = 0, unlock_all: bool = False, reset: bool = False) -> dict:
        d = self.row(pid)
        if reset:
            d.update(points=self.start_points, unlocked=[], equipped=[""] * self.slots, earned=int(d["online_s"] // (self.minutes_per_point * 60)))
        d["points"] = max(0, d["points"] + int(points))
        if unlock_all:
            d["unlocked"] = list(self.skills)
        self.save(pid, d)
        return self.view(pid)


def install(hub_cls, store, path: Path):
    """Adds the skill handlers to Hub and returns the SkillBook. Called once by app.Lab."""
    book = SkillBook(store, path)

    async def on_skill_state(self, c, m, now):
        self.send(c, book.view(c.pid))

    async def on_skill_unlock(self, c, m, now):
        err = book.unlock(c.pid, str(m.get("id", ""))[:64])
        if err:
            self.send(c, {"t": "skill_error", "code": err})
        self.send(c, book.view(c.pid))

    async def on_skill_equip(self, c, m, now):
        err = book.equip(c.pid, int(m.get("slot", -1)), str(m.get("id", "") or "")[:64])
        if err:
            self.send(c, {"t": "skill_error", "code": err})
        self.send(c, book.view(c.pid))

    async def on_skill_cast(self, c, m, now):
        sid = str(m.get("id", ""))[:64]
        err = book.cast_check(c.pid, sid, now)
        if err:
            self.send(c, {"t": "skill_error", "code": err})
            return
        self.counters["skill_casts"] = self.counters.get("skill_casts", 0) + 1
        self.broadcast(c.space, {"t": "cast", "pid": c.pid, "id": sid, "x": round(c.x, 3), "z": round(c.z, 3),
                                 "dir": round(c.dir, 3)})

    for fn in (on_skill_state, on_skill_unlock, on_skill_equip, on_skill_cast):
        setattr(hub_cls, fn.__name__, fn)
    return book


async def online_loop(hub, book: SkillBook, every: float = 30.0) -> None:
    """Credits connected time to every player and pushes their state when a point is earned."""
    import asyncio
    while True:
        await asyncio.sleep(every)
        for c in list(hub.conns.values()):
            try:
                if book.tick_online(c.pid, every):
                    hub.send(c, book.view(c.pid))
            except Exception:
                pass
