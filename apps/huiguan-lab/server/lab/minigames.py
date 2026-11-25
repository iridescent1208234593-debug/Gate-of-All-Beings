"""Optional board-game packs and server-authoritative tables, scoped to a LAB space."""
from __future__ import annotations

import asyncio
import hashlib
import json
import secrets
import time
from dataclasses import dataclass, field
from pathlib import Path

from .field_games import FieldGames

@dataclass
class Table:
    id: str
    board: list[int]
    players: list[str]
    touched: float
    revision: int = 0
    turn: int = 1
    winner: int = 0
    reason: str = ""
    last: int = -1
    winning_cells: list[int] = field(default_factory=list)
    rematch: set[str] = field(default_factory=set)
    offline_since: dict[str, float] = field(default_factory=dict)


def winning_line(board: list[int], cols: int, rows: int, last: int, length: int) -> list[int]:
    x, y = last % cols, last // cols
    for dx, dy in [(1, 0), (0, 1), (1, 1), (1, -1)]:
        cells = [last]
        for step in [-1, 1]:
            cx, cy = x + step * dx, y + step * dy
            while 0 <= cx < cols and 0 <= cy < rows and board[cy * cols + cx] == board[last]:
                cells.append(cy * cols + cx)
                cx, cy = cx + step * dx, cy + step * dy
        if len(cells) >= length:
            return cells
    return []


class Minigames:
    def __init__(self, directory: Path):
        self.packs = {}
        self.catalog = []
        self.tables: dict[tuple[str, str], Table] = {}
        self.field = FieldGames()
        for filename in sorted(directory.glob("*.json")):
            data = filename.read_bytes()
            rules = json.loads(data)
            game = rules["id"]
            if game != filename.stem or game in self.packs:
                raise ValueError(f"Invalid game ID: {filename}")
            version = hashlib.sha256(data).hexdigest()
            self.packs[game] = (rules, data.decode("utf-8"), version)
            self.catalog.append({key: rules[key] for key in ("id", "title", "description")}
                                | {"version": version, "bytes": len(data), "mode": rules.get("mode", "board")})
        order = ["gomoku", "tic-tac-toe", "connect-four"]
        self.catalog.sort(key=lambda pack: order.index(pack["id"]) if pack["id"] in order else len(order))

    def _online(self, hub, pid: str, space: str) -> bool:
        conn = hub.conns.get(pid)
        return bool(conn and not conn.closed and conn.space == space)

    def _view(self, hub, conn, game: str) -> dict:
        table = self.tables.get((conn.space, game))
        state = {"t": "minigame_state", "game": game, "space": conn.space, "table": None}
        if table:
            names = []
            for pid in table.players:
                live = hub.conns.get(pid)
                names.append({"nick": live.nick if live and live.nick else "旅人",
                              "online": self._online(hub, pid, conn.space)})
            state["table"] = {
                "id": table.id, "revision": table.revision, "board": table.board,
                "players": names, "side": table.players.index(conn.pid) + 1 if conn.pid in table.players else 0,
                "turn": table.turn, "winner": table.winner, "reason": table.reason,
                "last": table.last, "winning_cells": table.winning_cells, "rematch": conn.pid in table.rematch,
            }
        return state

    def _notify(self, hub, space: str, game: str, pids: list[str]) -> None:
        for pid in pids:
            if self._online(hub, pid, space):
                conn = hub.conns[pid]
                hub.send(conn, self._view(hub, conn, game))

    def _finish(self, table: Table, winner: int, reason: str) -> None:
        table.winner, table.reason = winner, reason

    def _move(self, table: Table, rules: dict, side: int, msg: dict) -> str:
        if len(table.players) != 2 or table.reason or table.turn != side:
            return "turn"
        cols, rows = rules["columns"], rules["rows"]
        x, y = msg.get("x"), msg.get("y")
        if type(x) is not int or type(y) is not int or not (0 <= x < cols and 0 <= y < rows):
            return "cell"
        if rules["gravity"]:
            y = next((r for r in range(rows - 1, -1, -1) if table.board[r * cols + x] == 0), -1)
        if y < 0 or table.board[y * cols + x]:
            return "cell"
        table.last = y * cols + x
        table.board[table.last] = side
        table.winning_cells = winning_line(table.board, cols, rows, table.last, rules["line"])
        if table.winning_cells:
            self._finish(table, side, "line")
        elif 0 not in table.board:
            self._finish(table, 0, "draw")
        else:
            table.turn = 3 - side
        return ""

    def handle(self, hub, conn, msg: dict, now: float) -> None:
        action = msg.get("action")
        game = msg.get("game")

        def error(code: str) -> None:
            hub.send(conn, {"t": "minigame_error", "code": code})

        if action == "catalog":
            hub.send(conn, {"t": "minigame_catalog", "packs": self.catalog})
            return
        if not isinstance(game, str) or game not in self.packs:
            return error("pack")
        rules, data, version = self.packs[game]
        if action == "download":
            hub.send(conn, {"t": "minigame_pack", "game": game, "version": version, "data": data})
            return
        if not hub.can_enter(conn.pid, conn.space):
            return error("space")
        if rules.get("mode") == "field":
            if action != "state" and msg.get("version") != version:
                return error("version")
            return self.field.handle(hub, conn, game, rules, msg, now)
        if action == "state":
            hub.send(conn, self._view(hub, conn, game))
            return
        if msg.get("version") != version:
            return error("version")

        key = (conn.space, game)
        table = self.tables.get(key)
        if action == "create":
            if table:
                return error("exists")
            table = Table(secrets.token_hex(8), [0] * (rules["rows"] * rules["columns"]), [conn.pid], now)
            self.tables[key] = table
            self._notify(hub, *key, table.players)
            return
        if not table or msg.get("table") != table.id or msg.get("revision") != table.revision:
            hub.send(conn, self._view(hub, conn, game))
            return error("changed")
        recipients = list(table.players)
        side = table.players.index(conn.pid) + 1 if conn.pid in table.players else 0
        if action == "join":
            if side or len(table.players) != 1:
                return error("full")
            if not self._online(hub, table.players[0], conn.space):
                return error("offline")
            table.players.append(conn.pid)
            recipients.append(conn.pid)
        elif not side:
            return error("seat")
        elif action == "move":
            if len(table.players) == 2 and not self._online(hub, table.players[2 - side], conn.space):
                return error("offline")
            result = self._move(table, rules, side, msg)
            if result:
                return error(result)
        elif action == "resign" and len(table.players) == 2 and not table.reason:
            self._finish(table, 3 - side, "resign")
        elif action == "leave" and (len(table.players) == 1 or table.reason):
            del self.tables[key]
        elif action == "rematch" and table.reason:
            if not all(self._online(hub, pid, conn.space) for pid in table.players):
                return error("offline")
            table.rematch.add(conn.pid)
            if len(table.rematch) == 2:
                table = Table(secrets.token_hex(8), [0] * len(table.board), table.players[::-1], now)
                self.tables[key] = table
        else:
            return error("action")
        table.revision += 1
        table.touched = now
        self._notify(hub, *key, recipients)

    async def maintain(self, hub) -> None:
        while True:
            await asyncio.sleep(2)
            now = time.time()
            self.field.sweep(hub, now)
            for (space, game), table in list(self.tables.items()):
                previous = set(table.offline_since)
                for pid in table.players:
                    if self._online(hub, pid, space):
                        table.offline_since.pop(pid, None)
                    else:
                        table.offline_since.setdefault(pid, now)
                expired = {pid for pid, since in table.offline_since.items() if now - since > 120}
                if (table.reason or len(table.players) == 1) and now - table.touched > 600:
                    del self.tables[space, game]
                elif len(expired) == len(table.players):
                    del self.tables[space, game]
                elif expired and not table.reason:
                    winner = next(i for i, pid in enumerate(table.players, 1) if pid not in expired)
                    self._finish(table, winner, "disconnect")
                    table.revision += 1
                    table.touched = now
                elif previous == set(table.offline_since):
                    continue
                self._notify(hub, space, game, table.players)
