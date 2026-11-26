"""Werewolf (狼人杀) for the LAB: rule state machine + per-pid trimmed snapshots.

Mounted exactly the way skills.py is mounted: app.Lab calls `install(Hub, store, WEREWOLF_FILE)`, which adds the
`on_ww_*` handlers that `Hub.handle` dispatches by message type. world.py is never edited; the only extra hook is
`Hub.detach`, wrapped so a dropped socket turns its seat offline instead of silently freezing a table.

Protocol (client -> server)
    ww_state                     pull my snapshot
    ww_create                    host a table in the space I am standing in (space entry already decided by
                                 space_acl, so the table needs no ACL of its own)
    ww_join / ww_leave           take / free a seat (also how a reconnect lands back in its old seat)
    ww_ready {ready}             lobby readiness
    ww_start                     host only; deals roles and enters night 1
    ww_target {kind?, target}    night action / vote / hunter shot -- whatever my seat may do right now
    ww_skip {kind?}              pass: no night action, or abstain in the vote
    ww_say {text}                daytime speech (only the seat whose turn it is)

Phases
    idle -> lobby -> night -> (hunter) -> speak -> vote -> (hunter) -> night ... -> over

Anti-omniscience: `view()` builds one dict per pid. Anything that could leak another seat's role or a night
decision (roles, who the wolves picked, who voted whom before the count, seer results, the witch's knife) is
dropped before sending, so a client tailing its own websocket only learns what its own seat may know.

Simplifications kept on purpose in this skeleton (all switchable from client/data/werewolf.json):
  * guard beats the knife; a witch saving into a guarded target is wasted without spending the antidote
  * a poisoned hunter cannot shoot; a shot hunter spends the bullet once
  * a tied vote exiles nobody
"""
from __future__ import annotations

import asyncio
import copy
import json
import logging
import random
import time
from dataclasses import dataclass, field
from pathlib import Path

from .world import clean_text

log = logging.getLogger("lab.werewolf")

IDLE, LOBBY, NIGHT, HUNTER, SPEAK, VOTE, OVER = "idle", "lobby", "night", "hunter", "speak", "vote", "over"

ROLES = {
    "werewolf": {"name": "狼人", "camp": "wolf", "night": True,
                 "desc": "夜里与狼队共同击杀一人；白天伪装成好人"},
    "seer": {"name": "预言家", "camp": "good", "night": True,
             "desc": "夜里查验一名玩家的阵营"},
    "witch": {"name": "女巫", "camp": "good", "night": True,
              "desc": "一瓶解药救人、一瓶毒药杀人，各只能用一次"},
    "hunter": {"name": "猎人", "camp": "good", "night": False,
               "desc": "出局时可开枪带走一人（被毒杀不能开枪）"},
    "guard": {"name": "守卫", "camp": "good", "night": True,
              "desc": "夜里守护一人，不能连续两晚守同一人"},
    "villager": {"name": "村民", "camp": "good", "night": False,
                 "desc": "没有夜间技能，靠发言与投票抓狼"},
}

DEFAULT_CONFIG = {
    "min_players": 6,
    "max_players": 10,
    "roles": ["werewolf", "werewolf", "seer", "witch", "hunter", "guard", "villager", "villager"],
    "filler_role": "villager",
    "seconds": {"lobby": 900.0, "night": 45.0, "speak": 25.0, "vote": 30.0, "hunter": 20.0, "over": 120.0},
    "rules": {"witch_self_save": False, "guard_repeat": True, "log_limit": 40},
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS ww_result(
  id INTEGER PRIMARY KEY AUTOINCREMENT, space_id TEXT NOT NULL, ended_at REAL NOT NULL,
  rounds INTEGER NOT NULL, winner TEXT NOT NULL, roster TEXT NOT NULL);
"""


@dataclass
class Seat:
    pid: str
    nick: str = ""
    role: str = "villager"
    alive: bool = True
    ready: bool = False
    host: bool = False
    online: bool = True
    death: str = ""
    antidote: bool = True
    poison: bool = True
    bullet: bool = True
    guard_last: str | None = None
    checks: dict = field(default_factory=dict)


@dataclass
class Room:
    space: str
    phase: str = LOBBY
    round: int = 0
    seats: dict = field(default_factory=dict)      # pid -> Seat, insertion order is seat order
    order: list = field(default_factory=list)      # speaking / voting order
    deadline: float = 0.0
    night: dict = field(default_factory=dict)
    votes: dict = field(default_factory=dict)
    abstain: set = field(default_factory=set)
    vote_detail: dict | None = None
    speak_order: list = field(default_factory=list)
    speak_index: int = 0
    pending_shot: str | None = None
    next_phase: str = "night"
    winner: str | None = None
    log: list = field(default_factory=list)
    empty_since: float | None = None
    idle_since: float | None = None          # lobby whose seats are all offline: reap it instead of blocking the space
    started_at: float = 0.0


class WerewolfGame:
    """One table per space. Tables live in memory; finished games are appended to the shared sqlite."""

    def __init__(self, store, path: Path | None = None):
        self.store = store
        self.cfg = copy.deepcopy(DEFAULT_CONFIG)
        if path:
            p = Path(path)
            if p.is_file():
                try:
                    loaded = json.loads(p.read_text(encoding="utf-8"))
                    if isinstance(loaded, dict):
                        self.cfg.update(loaded)
                except (ValueError, OSError):
                    log.warning("werewolf config unusable, using defaults: %s", p)
        self.secs = dict(DEFAULT_CONFIG["seconds"])
        self.secs.update(self.cfg.get("seconds") or {})
        self.rules = dict(DEFAULT_CONFIG["rules"])
        self.rules.update(self.cfg.get("rules") or {})
        self.min_players = max(4, int(self.cfg.get("min_players", 6)))
        self.max_players = max(self.min_players, int(self.cfg.get("max_players", 10)))
        self.filler = self.cfg.get("filler_role", "villager")
        if self.filler not in ROLES:
            self.filler = "villager"
        self.roles = [r for r in self.cfg.get("roles") or [] if r in ROLES] or list(DEFAULT_CONFIG["roles"])
        self.log_limit = max(10, int(self.rules.get("log_limit", 40)))
        self.rooms: dict[str, Room] = {}
        self.seat_space: dict[str, str] = {}
        for stmt in [s for s in SCHEMA.split(";") if s.strip()]:
            store.exec(stmt)

    # ------------------------------------------------------------------ lookup
    def room_by_space(self, sid: str) -> Room | None:
        return self.rooms.get(sid)

    def room_by_pid(self, pid: str) -> Room | None:
        sid = self.seat_space.get(pid)
        return self.rooms.get(sid) if sid else None

    # ------------------------------------------------------------------ lifecycle
    def create(self, hub, c, now: float) -> str | None:
        room = self.rooms.get(c.space)
        if room is not None and room.phase != OVER:
            return "ww_already_open"
        if room is not None:                                  # restart a finished table
            self.seats_clear(room)
        else:
            room = Room(space=c.space, phase=LOBBY)
            self.rooms[c.space] = room
        room.phase, room.round, room.winner = LOBBY, 0, None
        room.deadline = now + float(self.secs["lobby"])
        room.log = [{"at": now, "text": "牌桌开好了，等人齐后房主开局"}]
        room.votes, room.abstain, room.vote_detail = {}, set(), None
        room.speak_order, room.speak_index, room.pending_shot = [], 0, None
        seat = Seat(pid=c.pid, nick=c.nick or "玩家", host=True, ready=True)
        room.seats[c.pid] = seat
        room.order.append(c.pid)
        self.seat_space[c.pid] = c.space
        return None

    @staticmethod
    def seats_clear(room: Room) -> None:
        room.seats.clear()
        room.order.clear()

    def join(self, hub, c, now: float) -> str | None:
        room = self.rooms.get(c.space)
        if room is None:
            return "ww_no_room"
        seat = room.seats.get(c.pid)
        if seat is not None:                                  # reconnect / re-take own seat
            seat.online = True
            seat.nick = c.nick or seat.nick
            return None
        if room.phase != LOBBY:
            return "ww_in_progress"
        if len(room.seats) >= self.max_players:
            return "ww_full"
        room.seats[c.pid] = Seat(pid=c.pid, nick=c.nick or "玩家")
        room.order.append(c.pid)
        self.seat_space[c.pid] = c.space
        return None

    def leave(self, hub, c, now: float) -> str | None:
        room = self.rooms.get(c.space)
        if room is None or c.pid not in room.seats:
            return "ww_not_seated"
        seat = room.seats[c.pid]
        if room.phase != LOBBY:
            return "ww_in_progress"                            # an in-game seat can only go offline
        del room.seats[c.pid]
        if c.pid in room.order:
            room.order.remove(c.pid)
        self.seat_space.pop(c.pid, None)
        if seat.host and room.seats:
            room.seats[next(iter(room.seats))].host = True      # hand the table to the next seat
        if not room.seats:
            self.close(room)
        return None

    def ready(self, hub, c, value: bool) -> str | None:
        room = self.rooms.get(c.space)
        if room is None or c.pid not in room.seats:
            return "ww_not_seated"
        if room.phase != LOBBY:
            return "ww_bad_phase"
        room.seats[c.pid].ready = bool(value)
        return None

    def start(self, hub, c, now: float) -> str | None:
        room = self.rooms.get(c.space)
        if room is None:
            return "ww_no_room"
        seat = room.seats.get(c.pid)
        if seat is None or not seat.host:
            return "ww_not_host"
        if room.phase != LOBBY:
            return "ww_bad_phase"
        if len(room.seats) < self.min_players:
            return "ww_need_players"
        if not all(s.ready or s.host for s in room.seats.values()):
            return "ww_not_ready"
        self.deal(room)
        room.started_at = now
        room.round = 0
        room.log = [{"at": now, "text": "开局，身份已发到各自手中"}]
        self.start_night(hub, room, now)
        return None

    def close(self, room: Room) -> None:
        for pid in list(room.seats):
            if self.seat_space.get(pid) == room.space:
                self.seat_space.pop(pid, None)
        self.rooms.pop(room.space, None)

    def on_disconnect(self, hub, c) -> None:
        room = self.room_by_pid(c.pid)
        if room is None:
            return
        seat = room.seats.get(c.pid)
        if seat is not None:
            seat.online = False

    # ------------------------------------------------------------------ dealing
    def deal(self, room: Room) -> None:
        seats = list(room.seats.values())
        deck = list(self.roles)[:len(seats)]
        while len(deck) < len(seats):
            deck.append(self.filler)
        random.shuffle(deck)
        for seat, role in zip(seats, deck):
            seat.role, seat.alive, seat.death = role, True, ""
            seat.antidote = seat.poison = seat.bullet = True
            seat.guard_last, seat.checks = None, {}

    # ------------------------------------------------------------------ phases
    def start_night(self, hub, room: Room, now: float) -> None:
        room.round += 1
        room.phase = NIGHT
        room.night = {"kill": None, "guard": None, "seer": None, "save": False, "poison": None,
                      "wolf_votes": {}, "done": set()}
        room.votes, room.abstain, room.vote_detail = {}, set(), None
        room.pending_shot, room.next_phase = None, "night"
        room.deadline = now + float(self.secs["night"])
        room.log.append({"at": now, "text": f"第 {room.round} 夜，天黑请闭眼"})

    def resolve_night(self, hub, room: Room, now: float) -> None:
        n = room.night
        kill = self.wolf_pick(room)
        guarded = n.get("guard")
        killed: list[tuple[str, str]] = []
        quiet = False
        if kill and kill == guarded:
            quiet = True
        elif kill and n.get("save"):
            quiet = True                                      # antidote spent below
        elif kill:
            killed.append((kill, "夜里被杀"))
        if n.get("poison") and n["poison"] not in [p for p, _ in killed]:
            killed.append((n["poison"], "中毒身亡"))
        for seat in room.seats.values():
            if seat.role == "guard" and n.get("guard"):
                seat.guard_last = n["guard"]
            if seat.role == "witch":
                if n.get("save") and kill and kill != guarded:
                    seat.antidote = False
                if n.get("poison"):
                    seat.poison = False
        hunter = None
        names = []
        for pid, why in killed:
            seat = room.seats.get(pid)
            if seat is None or not seat.alive:
                continue
            seat.alive, seat.death = False, why
            names.append(seat.nick)
            if seat.role == "hunter" and why != "中毒身亡" and seat.bullet:
                hunter = pid
        if names:
            room.log.append({"at": now, "text": f"天亮，{'、'.join(names)} 出局"})
        elif quiet:
            room.log.append({"at": now, "text": "天亮，昨晚是个平安夜"})
        room.night["done"] = set()
        if self.check_over(room, now):
            return
        if hunter:
            self.start_hunter(hub, room, hunter, now, "day")
        else:
            self.start_day(hub, room, now)

    def start_day(self, hub, room: Room, now: float) -> None:
        room.phase = SPEAK
        room.speak_order = [pid for pid in room.order if pid in room.seats and room.seats[pid].alive]
        room.speak_index = 0
        if not room.speak_order:
            self.start_vote(hub, room, now)
            return
        room.deadline = now + float(self.secs["speak"])
        first = room.seats[room.speak_order[0]].nick
        room.log.append({"at": now, "text": f"第 {room.round} 天，从 {first} 开始依次发言"})

    def next_speaker(self, hub, room: Room, now: float) -> None:
        room.speak_index += 1
        order = room.speak_order
        while room.speak_index < len(order) and not room.seats[order[room.speak_index]].alive:
            room.speak_index += 1
        if room.speak_index >= len(order):
            self.start_vote(hub, room, now)
            return
        room.deadline = now + float(self.secs["speak"])

    def start_vote(self, hub, room: Room, now: float) -> None:
        room.phase = VOTE
        room.votes, room.abstain, room.vote_detail = {}, set(), None
        room.deadline = now + float(self.secs["vote"])
        room.log.append({"at": now, "text": "发言结束，开始投票（超时视为弃票）"})

    def resolve_vote(self, hub, room: Room, now: float) -> None:
        counts: dict[str, int] = {}
        for target in room.votes.values():
            counts[target] = counts.get(target, 0) + 1
        room.vote_detail = {pid: room.votes.get(pid, "") for pid in room.seats if room.seats[pid].alive}
        out = None
        if counts:
            best = max(counts.values())
            top = [pid for pid, n in counts.items() if n == best]
            if len(top) == 1:
                out = top[0]
            else:
                room.log.append({"at": now, "text": "平票，本轮无人出局"})
        else:
            room.log.append({"at": now, "text": "全员弃票，本轮无人出局"})
        hunter = None
        if out:
            seat = room.seats[out]
            seat.alive, seat.death = False, "被投票放逐"
            room.log.append({"at": now, "text": f"{seat.nick} 被放逐出局"})
            if seat.role == "hunter" and seat.bullet:
                hunter = out
        room.votes, room.abstain = {}, set()
        if self.check_over(room, now):
            return
        if hunter:
            self.start_hunter(hub, room, hunter, now, "night")
        else:
            self.start_night(hub, room, now)

    def start_hunter(self, hub, room: Room, pid: str, now: float, resume: str) -> None:
        room.phase = HUNTER
        room.pending_shot = pid
        room.next_phase = resume
        room.deadline = now + float(self.secs["hunter"])
        room.log.append({"at": now, "text": f"{room.seats[pid].nick} 是猎人，可以开枪带走一人"})

    def finish_hunter(self, hub, room: Room, target: str | None, now: float) -> None:
        pid = room.pending_shot
        room.pending_shot = None
        seat = room.seats.get(pid) if pid else None
        if seat is not None and target:
            seat.bullet = False
            victim = room.seats.get(target)
            if victim is not None and victim.alive:
                victim.alive, victim.death = False, "被猎人开枪带走"
                room.log.append({"at": now, "text": f"猎人开枪，{victim.nick} 出局"})
        elif seat is not None:
            seat.bullet = False
            room.log.append({"at": now, "text": "猎人没有开枪"})
        if self.check_over(room, now):
            return
        if room.next_phase == "day":
            self.start_day(hub, room, now)
        else:
            self.start_night(hub, room, now)

    def check_over(self, room: Room, now: float) -> bool:
        wolves = [s for s in room.seats.values() if s.alive and ROLES[s.role]["camp"] == "wolf"]
        good = [s for s in room.seats.values() if s.alive and ROLES[s.role]["camp"] != "wolf"]
        winner = None
        if not wolves:
            winner = "good"
        elif len(wolves) >= len(good):
            winner = "wolf"
        if winner is None:
            return False
        room.phase, room.winner = OVER, winner
        room.deadline = now + float(self.secs["over"])
        room.pending_shot = None
        room.log.append({"at": now, "text": "好人阵营获胜" if winner == "good" else "狼人阵营获胜"})
        self.write_result(room, now)
        return True

    def write_result(self, room: Room, now: float) -> None:
        roster = [{"pid": s.pid, "nick": s.nick, "role": s.role, "alive": s.alive} for s in room.seats.values()]
        try:
            self.store.exec("INSERT INTO ww_result(space_id,ended_at,rounds,winner,roster) VALUES(?,?,?,?,?)",
                            (room.space, now, room.round, room.winner, json.dumps(roster, ensure_ascii=False)))
        except Exception:                                      # a bookkeeping failure must not break the table
            log.exception("werewolf result not stored")

    # ------------------------------------------------------------------ actions
    def allowed_kinds(self, room: Room, seat: Seat) -> list[str]:
        if not seat.alive and not (room.phase == HUNTER and room.pending_shot == seat.pid):
            return []
        if room.phase == NIGHT:
            n = room.night
            out = []
            if seat.role == "werewolf":
                out.append("kill")
            elif seat.role == "guard":
                out.append("guard")
            elif seat.role == "seer":
                out.append("check")
            elif seat.role == "witch":
                knife = self.wolf_pick(room)
                if seat.antidote and knife and knife != n.get("guard") and (self.rules["witch_self_save"] or knife != seat.pid):
                    out.append("save")
                if seat.poison:
                    out.append("poison")
            return out
        if room.phase == VOTE:
            return ["vote"]
        if room.phase == HUNTER and room.pending_shot == seat.pid:
            return ["shoot"]
        return []

    def wolf_pick(self, room: Room) -> str | None:
        """The wolves' current majority target; ties keep the pick that reached the top first."""
        votes = list((room.night or {}).get("wolf_votes", {}).values())
        if not votes:
            return None
        counts: dict[str, int] = {}
        for target in votes:
            counts[target] = counts.get(target, 0) + 1
        best = max(counts.values())
        for target in votes:
            if counts[target] == best:
                return target
        return None

    def submit(self, hub, c, kind: str, target: str, now: float) -> str | None:
        room = self.room_by_space(c.space)
        if room is None:
            return "ww_no_room"
        seat = room.seats.get(c.pid)
        if seat is None:
            return "ww_not_seated"
        if not seat.alive and not (room.phase == HUNTER and room.pending_shot == c.pid):
            return "ww_dead"
        allowed = self.allowed_kinds(room, seat)
        kind = kind or (allowed[0] if allowed else "")
        if kind not in allowed:
            return "ww_bad_action"
        target = target[:64]
        if target and target not in room.seats:
            return "ww_bad_target"
        if kind == "kill":
            if not target or room.seats[target].role == "werewolf" or not room.seats[target].alive:
                return "ww_bad_target"
            room.night["wolf_votes"][c.pid] = target
            room.night["kill"] = self.wolf_pick(room)
        elif kind == "guard":
            if not target or not room.seats[target].alive:
                return "ww_bad_target"
            if not self.rules["guard_repeat"] and room.seats[target].pid == seat.guard_last:
                return "ww_guard_repeat"
            room.night["guard"] = target
        elif kind == "check":
            if not target or target == c.pid or not room.seats[target].alive:
                return "ww_bad_target"
            room.night["seer"] = target
            seat.checks[target] = ROLES[room.seats[target].role]["camp"]
        elif kind == "save":
            room.night["save"] = True
        elif kind == "poison":
            if not target or not room.seats[target].alive or target == c.pid:
                return "ww_bad_target"
            room.night["poison"] = target
        elif kind == "vote":
            if not target or target == c.pid or not room.seats[target].alive:
                return "ww_bad_target"
            room.votes[c.pid] = target
            room.abstain.discard(c.pid)
        elif kind == "shoot":
            if not target or target == c.pid or not room.seats[target].alive:
                return "ww_bad_target"
            self.finish_hunter(hub, room, target, now)
            return None
        if room.phase == NIGHT:
            room.night["done"].add(c.pid)
        return None

    def skip(self, hub, c, kind: str, now: float) -> str | None:
        room = self.room_by_space(c.space)
        if room is None:
            return "ww_no_room"
        seat = room.seats.get(c.pid)
        if seat is None:
            return "ww_not_seated"
        if room.phase == NIGHT and seat.alive:
            room.night["done"].add(c.pid)
            return None
        if room.phase == VOTE and seat.alive:
            room.votes.pop(c.pid, None)
            room.abstain.add(c.pid)
            return None
        if room.phase == HUNTER and room.pending_shot == c.pid:
            self.finish_hunter(hub, room, None, now)
            return None
        return "ww_bad_phase"

    def say(self, hub, c, text: str, now: float) -> str | None:
        room = self.room_by_space(c.space)
        if room is None:
            return "ww_no_room"
        seat = room.seats.get(c.pid)
        if seat is None:
            return "ww_not_seated"
        if not seat.alive:
            return "ww_dead"
        if room.phase != SPEAK:
            return "ww_bad_phase"
        if not room.speak_order or room.speak_order[room.speak_index] != c.pid:
            return "ww_not_your_turn"
        text = clean_text(text, 120)
        if not text:
            return "ww_empty"
        hub.broadcast(room.space, {"t": "ww_say", "pid": c.pid, "nick": seat.nick, "text": text})
        room.log.append({"at": now, "text": f"{seat.nick}：{text}"})
        self.next_speaker(hub, room, now)
        return None

    # ------------------------------------------------------------------ clock
    def tick(self, hub, now: float) -> None:
        for room in list(self.rooms.values()):
            try:
                if self.tick_room(hub, room, now):
                    self.push(hub, room, now)
            except Exception:
                log.exception("werewolf tick failed for %s", room.space)
                self.rooms.pop(room.space, None)

    def tick_room(self, hub, room: Room, now: float) -> bool:
        """Advances the clock; returns True when the snapshot changed and clients should be pushed."""
        changed = False
        online = hub.members(room.space)
        if not online:
            if room.empty_since is None:
                room.empty_since = now
            elif now - room.empty_since > 180:
                self.close(room)
                return False
        else:
            room.empty_since = None
        for pid, seat in room.seats.items():
            conn = hub.conns.get(pid)
            here = bool(conn is not None and not conn.closed and conn.space == room.space)
            if seat.online != here:
                seat.online = here
                changed = True
        if room.phase == LOBBY and room.seats:
            # 大厅里所有座位都掉线了：这张桌子已经没人能开局，超时就回收，别让空间永远挂着死桌
            if all(not s.online for s in room.seats.values()):
                if room.idle_since is None:
                    room.idle_since = now
                elif now - room.idle_since > 45:
                    self.close(room)
                    return False
            else:
                room.idle_since = None
        if room.phase == NIGHT:
            if not (self.must_act(room) - room.night.get("done", set())) or now >= room.deadline:
                self.resolve_night(hub, room, now)
                return True
        elif room.phase == SPEAK:
            if now >= room.deadline:
                self.next_speaker(hub, room, now)
                return True
        elif room.phase == VOTE:
            if self.vote_complete(room) or now >= room.deadline:
                self.resolve_vote(hub, room, now)
                return True
        elif room.phase == HUNTER:
            if now >= room.deadline:
                self.finish_hunter(hub, room, None, now)
                return True
        elif room.phase in (OVER, LOBBY):
            if now >= room.deadline:
                if room.phase == OVER:
                    self.close(room)
                else:
                    room.deadline = now + float(self.secs["lobby"])   # keep an idle lobby alive
        return changed

    def must_act(self, room: Room) -> set:
        return {pid for pid, s in room.seats.items() if s.alive and ROLES[s.role]["night"]}

    def vote_complete(self, room: Room) -> bool:
        alive = {pid for pid, s in room.seats.items() if s.alive}
        return bool(alive) and alive <= (set(room.votes) | room.abstain)

    # ------------------------------------------------------------------ views
    def push(self, hub, room: Room, now: float | None = None) -> None:
        now = time.time() if now is None else now
        for c in hub.members(room.space):
            hub.send(c, self.view(c, room, now))

    def view(self, c, room: Room, now: float) -> dict:
        seat = room.seats.get(c.pid)
        seats = []
        for s in room.seats.values():
            revealed = (not s.alive) or room.phase == OVER
            seats.append({"pid": s.pid, "nick": s.nick, "alive": s.alive, "host": s.host, "ready": s.ready,
                          "online": s.online, "role": s.role if (revealed or s.pid == c.pid) else None,
                          "role_name": ROLES[s.role]["name"] if (revealed or s.pid == c.pid) else None})
        speaking = room.speak_order[room.speak_index] if room.phase == SPEAK and room.speak_index < len(room.speak_order) else None
        return {"t": "ww_state", "space": room.space, "phase": room.phase, "round": room.round,
                "left": max(0.0, round(room.deadline - now, 1)), "phase_seconds": self.phase_seconds(room),
                "min_players": self.min_players, "max_players": self.max_players,
                "seats": seats, "speaker": speaking, "pending_shot": room.pending_shot,
                "votes_in": sorted(room.votes) if room.phase == VOTE else [],
                "abstained": sorted(room.abstain) if room.phase == VOTE else [],
                "vote_detail": room.vote_detail if room.phase == OVER else None,
                "winner": room.winner, "log": room.log[-self.log_limit:],
                "you": self.private(room, seat) if seat is not None else None,
                "spectator": seat is None}

    def phase_seconds(self, room: Room) -> float:
        key = {NIGHT: "night", SPEAK: "speak", VOTE: "vote", HUNTER: "hunter", OVER: "over", LOBBY: "lobby"}.get(room.phase)
        return float(self.secs.get(key, 30.0))

    def private(self, room: Room, seat: Seat) -> dict:
        me = {"pid": seat.pid, "role": seat.role, "role_name": ROLES[seat.role]["name"],
              "role_desc": ROLES[seat.role]["desc"], "camp": ROLES[seat.role]["camp"],
              "alive": seat.alive, "host": seat.host, "ready": seat.ready, "online": seat.online,
              "notes": [], "actions": [], "done": False, "can_speak": False}
        if not seat.alive:
            if room.phase == HUNTER and room.pending_shot == seat.pid:
                me["notes"].append({"kind": "dead", "text": "你已出局，但枪还在你手上"})
                me["actions"].append(self.shot_action(room, seat))
            else:
                me["notes"].append({"kind": "dead", "text": f"你已出局（{seat.death or '死亡'}），可以继续旁观"})
            return me
        if room.phase == NIGHT:
            me.update(self.night_actions(room, seat))
        elif room.phase == VOTE:
            me["done"] = seat.pid in room.votes or seat.pid in room.abstain
            me["actions"].append({"kind": "vote", "label": "投票放逐一名玩家", "optional": True,
                                  "targets": self.brief(s for s in room.seats.values() if s.alive and s.pid != seat.pid),
                                  "submitted": room.votes.get(seat.pid, "")})
        elif room.phase == HUNTER and room.pending_shot == seat.pid:
            me["actions"].append(self.shot_action(room, seat))
        elif room.phase == SPEAK:
            me["can_speak"] = bool(room.speak_order) and room.speak_order[room.speak_index] == seat.pid
            me["notes"].append({"kind": "speak", "text": "轮到你发言" if me["can_speak"] else "等待他人发言"})
        elif room.phase == OVER:
            me["notes"].append({"kind": "over", "text": "本局结束" if not room.winner else
                                ("好人阵营获胜" if room.winner == "good" else "狼人阵营获胜")})
        return me

    def night_actions(self, room: Room, seat: Seat) -> dict:
        n = room.night
        out = {"notes": [], "actions": [], "done": seat.pid in n.get("done", set())}
        alive = [s for s in room.seats.values() if s.alive]
        others = [s for s in alive if s.pid != seat.pid]
        if seat.role == "werewolf":
            mates = [s for s in alive if s.role == "werewolf" and s.pid != seat.pid]
            out["notes"].append({"kind": "team", "mates": self.brief(mates),
                                 "text": "狼队：" + ("、".join(s.nick for s in mates) if mates else "只剩你一人")})
            out["actions"].append({"kind": "kill", "label": "选择今晚击杀的玩家", "optional": False,
                                   "targets": self.brief(s for s in alive if s.role != "werewolf"),
                                   "submitted": n.get("wolf_votes", {}).get(seat.pid, "")})
        elif seat.role == "guard":
            pool = [s for s in alive if self.rules["guard_repeat"] or s.pid != seat.guard_last]
            out["notes"].append({"kind": "guard", "text": "请选择今晚守护的人"})
            out["actions"].append({"kind": "guard", "label": "守护一名玩家", "optional": False,
                                   "targets": self.brief(pool), "submitted": n.get("guard") or ""})
        elif seat.role == "seer":
            out["actions"].append({"kind": "check", "label": "查验一名玩家的阵营", "optional": False,
                                   "targets": self.brief(others), "submitted": n.get("seer") or ""})
            if seat.checks:
                out["notes"].append({"kind": "checks", "text": "你的查验结果",
                                     "checks": [{"pid": pid, "nick": room.seats[pid].nick if pid in room.seats else pid,
                                                 "camp": camp, "camp_name": "狼人" if camp == "wolf" else "好人"}
                                                for pid, camp in seat.checks.items()]})
        elif seat.role == "witch":
            knife = self.wolf_pick(room)
            guarded = n.get("guard")
            if seat.antidote and knife and knife != guarded and (self.rules["witch_self_save"] or knife != seat.pid):
                victim = room.seats[knife]
                out["notes"].append({"kind": "knife", "text": f"今晚 {victim.nick} 被狼人袭击，你有解药"})
                out["actions"].append({"kind": "save", "label": f"用解药救 {victim.nick}", "optional": True,
                                       "targets": [], "submitted": bool(n.get("save"))})
            elif not seat.antidote:
                out["notes"].append({"kind": "potion", "text": "解药已用完"})
            if seat.poison:
                out["actions"].append({"kind": "poison", "label": "用毒药毒杀一名玩家", "optional": True,
                                       "targets": self.brief(s for s in others),
                                       "submitted": n.get("poison") or ""})
        else:
            out["notes"].append({"kind": "no_action", "text": "你没有夜间行动，等待天亮"})
        return out

    @staticmethod
    def shot_action(room: Room, seat: Seat) -> dict:
        return {"kind": "shoot", "label": "开枪带走一名玩家（超时视为放弃）", "optional": True,
                "targets": WerewolfGame.brief(s for s in room.seats.values() if s.alive and s.pid != seat.pid),
                "submitted": ""}

    @staticmethod
    def brief(seats) -> list:
        return [{"pid": s.pid, "nick": s.nick, "alive": s.alive} for s in seats]


# ---------------------------------------------------------------------- wiring
def install(hub_cls, store, path: Path | None = None) -> WerewolfGame:
    """Adds the werewolf handlers to Hub and returns the game. Called once by app.Lab."""
    game = WerewolfGame(store, path)

    def fail(hub, c, code: str) -> None:
        hub.send(c, {"t": "ww_error", "code": code})

    async def on_ww_state(self, c, m, now):
        room = game.room_by_pid(c.pid) or game.room_by_space(c.space)
        if room is None:
            self.send(c, {"t": "ww_state", "phase": IDLE, "space": c.space, "seats": [], "log": [],
                          "you": None, "spectator": True, "left": 0, "winner": None})
            return
        self.send(c, game.view(c, room, now))

    async def on_ww_create(self, c, m, now):
        err = game.create(self, c, now)
        room = game.room_by_space(c.space)
        if err:
            fail(self, c, err)
        if room is not None:
            game.push(self, room, now)

    async def on_ww_join(self, c, m, now):
        err = game.join(self, c, now)
        room = game.room_by_space(c.space)
        if err:
            fail(self, c, err)
        if room is not None:
            game.push(self, room, now)

    async def on_ww_leave(self, c, m, now):
        err = game.leave(self, c, now)
        if err:
            fail(self, c, err)

    async def on_ww_ready(self, c, m, now):
        err = game.ready(self, c, bool(m.get("ready", True)))
        room = game.room_by_space(c.space)
        if err:
            fail(self, c, err)
        if room is not None:
            game.push(self, room, now)

    async def on_ww_start(self, c, m, now):
        err = game.start(self, c, now)
        room = game.room_by_space(c.space)
        if err:
            fail(self, c, err)
        if room is not None:
            game.push(self, room, now)

    async def on_ww_target(self, c, m, now):
        err = game.submit(self, c, str(m.get("kind", ""))[:16], str(m.get("target", "") or ""), now)
        room = game.room_by_space(c.space)
        if err:
            fail(self, c, err)
        if room is not None:
            game.push(self, room, now)

    async def on_ww_skip(self, c, m, now):
        err = game.skip(self, c, str(m.get("kind", ""))[:16], now)
        room = game.room_by_space(c.space)
        if err:
            fail(self, c, err)
        if room is not None:
            game.push(self, room, now)

    async def on_ww_say(self, c, m, now):
        err = game.say(self, c, str(m.get("text", "")), now)
        room = game.room_by_space(c.space)
        if err:
            fail(self, c, err)
        if room is not None:
            game.push(self, room, now)

    handlers = (on_ww_state, on_ww_create, on_ww_join, on_ww_leave, on_ww_ready, on_ww_start,
                on_ww_target, on_ww_skip, on_ww_say)
    for fn in handlers:
        setattr(hub_cls, fn.__name__, fn)

    # A dropped socket must not freeze a table: the seat stays, its owner is flagged offline.
    if not getattr(hub_cls, "_ww_detach_wrapped", False):
        original = hub_cls.detach

        async def detach(self, c, reason: str = "closed"):
            await original(self, c, reason)
            try:
                game.on_disconnect(self, c)
            except Exception:
                log.exception("werewolf disconnect hook failed")
        hub_cls.detach = detach
        hub_cls._ww_detach_wrapped = True
    return game


async def tick_loop(hub, game: WerewolfGame, every: float = 1.0) -> None:
    while True:
        await asyncio.sleep(every)
        try:
            game.tick(hub, time.time())
        except Exception:
            log.exception("werewolf tick loop error")
