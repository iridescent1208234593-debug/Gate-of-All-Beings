"""Short scene games. Every interaction uses the Hub's current player position."""
from __future__ import annotations

import random
import secrets
from collections import Counter
from dataclasses import dataclass, field

PAVILION = "game-pavilion"
STATIONS = {
    "firefly-west": "西边萤火台",
    "firefly-north": "北边萤火台",
    "firefly-east": "东边萤火台",
}
RELAY = "firefly-relay"
NIGHT = "night-watch"


@dataclass
class Round:
    id: str
    players: dict[str, str]
    deadline: float
    phase: str = "lobby"
    reason: str = ""
    route: list[str] = field(default_factory=list)
    stations: dict[str, int] = field(default_factory=lambda: dict.fromkeys(STATIONS, 0))
    step: int = 0
    last: str = ""
    saboteur: str = ""
    eliminated: set[str] = field(default_factory=set)
    votes: dict[str, str] = field(default_factory=dict)
    meetings: set[str] = field(default_factory=set)
    resume_seconds: float = 0
    next_jam: float = 0
    event: str = ""
    revision: int = 0

    def eligible(self) -> set[str]:
        return self.players.keys() - self.eliminated


class FieldGames:
    def __init__(self):
        self.rooms: dict[tuple[str, str], Round] = {}

    @staticmethod
    def online(hub, space, pid) -> bool:
        conn = hub.conns.get(pid)
        return bool(conn and not conn.closed and conn.space == space)

    @staticmethod
    def fail(hub, conn, code):
        hub.send(conn, {"t": "minigame_error", "code": code})

    def view(self, hub, conn, game, now):
        room = self.rooms.get((conn.space, game))
        state = {"t": "minigame_state", "game": game, "space": conn.space, "table": None}
        if room:
            seated = conn.pid in room.players
            # Reveal only the recipient's secret role until the round ends.
            role = ""
            if room.phase != "lobby" and seated and game == NIGHT:
                role = "saboteur" if room.saboteur == conn.pid else "keeper"
            state["table"] = {
                "id": room.id, "revision": room.revision, "phase": room.phase, "reason": room.reason,
                "deadline": room.deadline, "remaining": max(0, round(room.deadline - now)),
                "you": conn.pid if seated else "", "host": next(iter(room.players)),
                "role": role, "event": room.event, "progress": room.step if game == RELAY else sum(room.stations.values()),
                "goal": len(room.route) if game == RELAY else len(STATIONS) * 2,
                "next": STATIONS[room.route[room.step]] if game == RELAY and room.step < len(room.route) else "",
                "stations": {STATIONS[k]: value for k, value in room.stations.items()} if game == NIGHT else {},
                "jam_in": max(0, round(room.next_jam - now)) if role == "saboteur" else 0,
                "can_meet": seated and conn.pid not in room.meetings and conn.pid in room.eligible(),
                "players": [{"pid": pid, "nick": nick, "online": self.online(hub, conn.space, pid),
                             "out": pid in room.eliminated, "voted": pid in room.votes,
                             "revealed": room.phase == "over" and pid == room.saboteur}
                            for pid, nick in room.players.items()],
            }
        return state

    def publish(self, hub, space, game, pids, now):
        for pid in pids:
            if self.online(hub, space, pid):
                conn = hub.conns[pid]
                hub.send(conn, self.view(hub, conn, game, now))

    def _finish(self, room, reason, now):
        room.phase, room.reason = "over", reason
        room.deadline = now + 180

    def _vote_result(self, room, now):
        tally = Counter(room.votes.values()).most_common(2)
        out = tally[0][0] if tally and (len(tally) == 1 or tally[0][1] > tally[1][1]) else ""
        room.votes.clear()
        room.phase, room.deadline = "running", now + room.resume_seconds
        if not out:
            room.event = "本轮无人离开夜巡。"
            return
        room.eliminated.add(out)
        room.event = f"{room.players[out]} 退出夜巡，留在场景中观战。"
        if out == room.saboteur:
            self._finish(room, "keepers", now)
        elif len(room.eligible()) <= 2:
            self._finish(room, "saboteur", now)

    def _tick_room(self, room, game, now):
        if now < room.deadline:
            return False
        if room.phase == "meeting":
            self._vote_result(room, now)
        elif room.phase == "running":
            self._finish(room, "timeout" if game == RELAY else "saboteur", now)
        else:
            return False
        room.revision += 1
        return True

    def sweep(self, hub, now):
        for (space, game), room in list(self.rooms.items()):
            if room.phase in ("lobby", "over") and now >= room.deadline:
                del self.rooms[space, game]
                self.publish(hub, space, game, room.players, now)
            elif self._tick_room(room, game, now):
                self.publish(hub, space, game, room.players, now)

    def handle(self, hub, conn, game, rules, msg, now):
        key = (conn.space, game)
        room = self.rooms.get(key)
        action = msg.get("action")
        pid = conn.pid
        if PAVILION not in hub.geometry(conn.space).objects:
            return self.fail(hub, conn, "field_space")
        if action == "state":
            hub.send(conn, self.view(hub, conn, game, now))
            return
        if action in ("create", "join") and any(
            other_key != key and other_key[0] == conn.space and pid in other.players and other.phase != "over"
            for other_key, other in self.rooms.items()
        ):
            return self.fail(hub, conn, "field_busy")
        if action == "create":
            if room:
                return self.fail(hub, conn, "exists")
            self.rooms[key] = Round(secrets.token_hex(8), {pid: conn.nick or "旅人"}, now + 300)
            self.publish(hub, *key, [pid], now)
            return
        if not room or room.id != msg.get("table"):
            return self.fail(hub, conn, "changed")
        if self._tick_room(room, game, now):
            self.publish(hub, *key, room.players, now)
        recipients = set(room.players)
        if action == "join" and room.phase == "lobby" and len(room.players) < rules["max_players"]:
            room.players[pid] = conn.nick or "旅人"
            recipients.add(pid)
        elif pid not in room.players:
            return self.fail(hub, conn, "seat")
        elif action == "leave" and room.phase in ("lobby", "over"):
            del room.players[pid]
            if not room.players or room.phase == "over":
                del self.rooms[key]
        elif action == "start" and room.phase == "lobby" and pid == next(iter(room.players)):
            room.players = {p: nick for p, nick in room.players.items() if self.online(hub, conn.space, p)}
            if len(room.players) < rules["min_players"]:
                self.publish(hub, *key, recipients, now)
                return self.fail(hub, conn, "field_players")
            room.phase, room.deadline = "running", now + rules["seconds"]
            if game == RELAY:
                first = random.sample(list(STATIONS), len(STATIONS))
                second = random.sample(list(STATIONS), len(STATIONS))
                if first[-1] == second[0]:
                    second = second[1:] + second[:1]
                room.route = first + second
                room.event = "接力开始，到第一座萤火台集合。"
            else:
                room.saboteur = secrets.choice(list(room.players))
                room.next_jam = now + 8
                room.event = "夜巡开始。看好信标，留意谁在附近。"
        elif action == "meeting" and game == NIGHT and room.phase == "running" and pid in room.eligible() and pid not in room.meetings:
            if not hub.geometry(conn.space).near(PAVILION, conn.x, conn.z):
                return self.fail(hub, conn, "field_near")
            room.meetings.add(pid)
            room.resume_seconds = room.deadline - now
            room.phase, room.deadline = "meeting", now + 40
            room.votes.clear()
            room.event = f"{room.players[pid]} 召集了会议。先讨论，再投票。"
        elif action == "vote" and room.phase == "meeting" and pid in room.eligible() and pid not in room.votes:
            target = msg.get("target")
            if not isinstance(target, str) or (target and target not in room.eligible()):
                return self.fail(hub, conn, "action")
            room.votes[pid] = target
            if room.eligible() <= room.votes.keys():
                self._vote_result(room, now)
        else:
            return self.fail(hub, conn, "action")
        room.revision += 1
        self.publish(hub, *key, recipients, now)

    def interact(self, hub, conn, station, now):
        for game in (RELAY, NIGHT):
            room = self.rooms.get((conn.space, game))
            if room and room.phase == "running" and conn.pid in room.eligible():
                self._station(hub, conn, game, room, station, now)
                return
        self.fail(hub, conn, "field_station")

    def _station(self, hub, conn, game, room, station, now):
        if self._tick_room(room, game, now):
            self.publish(hub, conn.space, game, room.players, now)
            return
        if game == RELAY:
            if room.route[room.step] != station:
                return self.fail(hub, conn, "field_route")
            if room.last == conn.pid:
                return self.fail(hub, conn, "field_pass")
            room.step += 1
            room.last = conn.pid
            room.event = f"{room.players[conn.pid]} 在{STATIONS[station]}接棒。"
            if room.step == len(room.route):
                self._finish(room, "relay", now)
        elif room.saboteur == conn.pid:
            if now < room.next_jam or room.stations[station] == 0:
                return self.fail(hub, conn, "field_jam")
            room.next_jam = now + 12
            room.stations[station] -= 1
            room.event = f"{STATIONS[station]}的信号变弱了。"
        else:
            if room.stations[station] == 2 or room.last == conn.pid:
                return self.fail(hub, conn, "field_repair")
            room.stations[station] += 1
            room.last = conn.pid
            room.event = f"{STATIONS[station]}恢复了一格信号。"
            if all(value == 2 for value in room.stations.values()):
                self._finish(room, "keepers", now)
        room.revision += 1
        self.publish(hub, conn.space, game, room.players, now)
