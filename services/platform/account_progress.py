"""Account points, levels, daily tasks and per-game leaderboards keyed by (kind, uid).

Lives in the 会馆 users.db next to account_profiles and game_saves; it never creates a
second account system. Points are stored as integer tenths (points_x10) so 0.1 steps
add up exactly. See docs/account-progress-and-leaderboards.md for the award rules.

Level curve: reaching level n needs n more points than level n-1, i.e. level n is
reached at a cumulative n(n+1)/2 points (1, 3, 6, 10, ...). A new account is level 0.

Scores are reported by the game clients and therefore only as trustworthy as the
browser; each game has a plausibility ceiling and points are capped per day, so a
forged score can at most top one board, never farm levels.

CLI (run from the project root; IRIDESCENTLY_STORAGE_ROOT and IRIDESCENTLY_ENVIRONMENT select isolated data):
  python services/platform/account_progress.py status                 # legacy points and new totals
  python services/platform/account_progress.py reset-legacy           # dry run: what the reset would change
  python services/platform/account_progress.py reset-legacy --apply   # archive + zero every account's points
  python services/platform/account_progress.py restore-legacy --apply # rollback: put archived legacy points back
"""
import argparse
from storage_paths import data_root, huiguan_data_dir, require_ready
import json
import math
import os
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


KINDS = ("local", "usso")
DAY_TZ = timezone(timedelta(hours=8))  # 一天按北京时间 00:00 切换
RESET_MIGRATION = "points-reset-v2"

# Every board: label, how the score reads, how runs are aggregated and a plausibility ceiling.
#   agg "best": keep the highest single score; "sum": add up per-report deltas (time played).
GAMES = {
    "cards": {"name": "众生牌录 · 入世历练", "metric": "最深层数", "unit": "层", "agg": "best", "max": 60},
    "slay": {"name": "重生之门", "metric": "最高层数", "unit": "层", "agg": "best", "max": 80},
    "lingzhi": {"name": "灵质回路", "metric": "最高层数", "unit": "层", "agg": "best", "max": 60},
    "shore": {"name": "雾隐浅滩", "metric": "单次探索节点", "unit": "处", "agg": "best", "max": 200},
    "juling": {"name": "聚灵", "metric": "修行评分", "unit": "分", "agg": "best", "max": 2000},
    "management": {"name": "灵境会馆经营", "metric": "建成建筑", "unit": "座", "agg": "best", "max": 500},
    "ecology": {"name": "灵境生态", "metric": "同存物种", "unit": "种", "agg": "best", "max": 500},
    "softie": {"name": "灵体互动", "metric": "累计相处", "unit": "分钟", "agg": "sum", "max": 5, "day_max": 120},
    "aeon": {"name": "AEON", "metric": "最高演化代数", "unit": "代", "agg": "best", "max": 100000},
    "shengsheng-shoot": {"name": "省省海滩射击", "metric": "最高得分", "unit": "分", "agg": "best", "max": 1000000},
}

# Award rules, all in tenths of a point. "cap" is how many times the rule may pay per
# (account, day) — per game where "per_game" is true, otherwise per account.
RULES = {
    "play": {"x10": 5, "cap": 1, "per_game": True, "label": "今日游玩"},
    "finish": {"x10": 2, "cap": 5, "per_game": True, "label": "完成一局"},
    "win": {"x10": 3, "cap": 3, "per_game": True, "label": "胜利 / 通关"},
    "best": {"x10": 5, "cap": 1, "per_game": True, "label": "刷新个人最佳"},
    "task-finish": {"x10": 10, "cap": 1, "per_game": False, "label": "每日任务 · 完成任意一局"},
    "task-explore": {"x10": 10, "cap": 1, "per_game": False, "label": "每日任务 · 今天玩三种玩法"},
    "sheet": {"x10": 10, "cap": 2, "per_game": False, "label": "登记新角色设表"},
    "sheet-color": {"x10": 5, "cap": 1, "per_game": False, "label": "设表使用自定义配色"},
    "errand": {"x10": 10, "cap": 3, "per_game": False, "label": "完成会馆托付"},  # hall_errands.report
}
DAILY_CAP_X10 = 80          # 每个账户每天最多 8 分
MAX_REPORTS_PER_GAME_DAY = 300
EXPLORE_GAMES = 3
TASKS = ("task-finish", "task-explore")


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def today(now=None):
    return (now or datetime.now(timezone.utc)).astimezone(DAY_TZ).date().isoformat()


def _owner(kind, uid):
    uid = str(uid or "")
    if kind not in KINDS or not uid:
        raise ValueError("invalid account owner")
    return kind, uid


# ---------- level curve ----------

def level_for(points_x10):
    """Largest n with n(n+1)/2 <= points. Exact on tenths: compare 10*n(n+1)/2 <= x10."""
    x10 = max(0, int(points_x10 or 0))
    n = int((math.isqrt(8 * x10 // 10 + 1) - 1) // 2)
    while 5 * (n + 1) * (n + 2) <= x10:
        n += 1
    while n > 0 and 5 * n * (n + 1) > x10:
        n -= 1
    return n


def level_info(points_x10):
    level = level_for(points_x10)
    floor_x10, next_x10 = 5 * level * (level + 1), 5 * (level + 1) * (level + 2)
    return {"points": round(points_x10 / 10, 1), "level": level,
            "level_floor": floor_x10 // 10, "next_level_at": next_x10 // 10,
            "progress": round((points_x10 - floor_x10) / (next_x10 - floor_x10), 3)}


# ---------- schema ----------

def init_schema(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS account_points (
        kind TEXT NOT NULL,
        uid TEXT NOT NULL,
        points_x10 INTEGER NOT NULL DEFAULT 0 CHECK (points_x10 >= 0),
        display_name TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL,
        PRIMARY KEY (kind, uid)
    )""")
    # Append-only ledger: every award with its rule, day and idempotency ref.
    conn.execute("""CREATE TABLE IF NOT EXISTS account_point_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        uid TEXT NOT NULL,
        day TEXT NOT NULL,
        rule TEXT NOT NULL,
        game TEXT NOT NULL DEFAULT '',
        amount_x10 INTEGER NOT NULL CHECK (amount_x10 > 0),
        ref TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (kind, uid, rule, game, ref)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS account_point_events_day ON account_point_events (kind, uid, day)")
    conn.execute("""CREATE TABLE IF NOT EXISTS game_scores (
        kind TEXT NOT NULL,
        uid TEXT NOT NULL,
        game TEXT NOT NULL,
        best_score INTEGER NOT NULL DEFAULT 0,
        runs INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        best_at TEXT NOT NULL DEFAULT '',
        last_at TEXT NOT NULL DEFAULT '',
        display_name TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (kind, uid, game)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS game_scores_board ON game_scores (game, best_score DESC)")
    conn.execute("""CREATE TABLE IF NOT EXISTS game_score_daily (
        kind TEXT NOT NULL,
        uid TEXT NOT NULL,
        game TEXT NOT NULL,
        day TEXT NOT NULL,
        reports INTEGER NOT NULL DEFAULT 0,
        summed INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (kind, uid, game, day)
    )""")
    # One row per finished run: makes a retried "finished" report count once.
    conn.execute("""CREATE TABLE IF NOT EXISTS game_runs (
        kind TEXT NOT NULL,
        uid TEXT NOT NULL,
        game TEXT NOT NULL,
        ref TEXT NOT NULL,
        day TEXT NOT NULL,
        score INTEGER NOT NULL,
        won INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        PRIMARY KEY (kind, uid, game, ref)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS game_runs_day ON game_runs (kind, uid, day)")
    # Pre-reset values of the old local_users.points / user_flags.points, for rollback.
    conn.execute("""CREATE TABLE IF NOT EXISTS account_points_legacy (
        kind TEXT NOT NULL,
        uid TEXT NOT NULL,
        legacy_points INTEGER NOT NULL,
        archived_at TEXT NOT NULL,
        PRIMARY KEY (kind, uid)
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS account_progress_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL,
        summary_json TEXT NOT NULL
    )""")


def open_db(project_root=None):
    if project_root is None or Path(project_root).resolve() == data_root():
        require_ready()
    root = Path(project_root) if project_root is not None else data_root()
    database = huiguan_data_dir(root) / "users.db"
    database.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(database, timeout=10, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=10000")
    init_schema(conn)
    return conn


# ---------- reads ----------

def get_points_x10(conn, kind, uid):
    kind, uid = _owner(kind, uid)
    row = conn.execute("SELECT points_x10 FROM account_points WHERE kind=? AND uid=?", (kind, uid)).fetchone()
    return int(row[0]) if row else 0


def _earned_today(conn, kind, uid, day):
    row = conn.execute("SELECT COALESCE(SUM(amount_x10),0) FROM account_point_events WHERE kind=? AND uid=? AND day=?",
                       (kind, uid, day)).fetchone()
    return int(row[0])


def _rule_count(conn, kind, uid, day, rule, game=""):
    row = conn.execute("SELECT COUNT(*) FROM account_point_events WHERE kind=? AND uid=? AND day=? AND rule=? AND game=?",
                       (kind, uid, day, rule, game)).fetchone()
    return int(row[0])


def summary(conn, kind, uid, now=None):
    """What the account page and the leaderboard sidebar show for one account."""
    kind, uid = _owner(kind, uid)
    day = today(now)
    played = {r[0] for r in conn.execute(
        "SELECT game FROM game_score_daily WHERE kind=? AND uid=? AND day=? AND reports>0", (kind, uid, day))}
    finished = _runs_today(conn, kind, uid, day)
    tasks = [
        {"id": "task-finish", "label": "完成任意一局", "progress": min(1, finished), "goal": 1,
         "reward": RULES["task-finish"]["x10"] / 10, "done": _rule_count(conn, kind, uid, day, "task-finish") > 0},
        {"id": "task-explore", "label": "今天玩三种不同玩法", "progress": min(EXPLORE_GAMES, len(played)),
         "goal": EXPLORE_GAMES, "reward": RULES["task-explore"]["x10"] / 10,
         "done": _rule_count(conn, kind, uid, day, "task-explore") > 0},
    ]
    games = {}
    for row in conn.execute("SELECT game, best_score, runs, wins FROM game_scores WHERE kind=? AND uid=?", (kind, uid)):
        games[row["game"]] = {"best": row["best_score"], "runs": row["runs"], "wins": row["wins"],
                              "played_today": row["game"] in played}
    earned = _earned_today(conn, kind, uid, day)
    return {**level_info(get_points_x10(conn, kind, uid)), "day": day,
            "today": {"earned": earned / 10, "cap": DAILY_CAP_X10 / 10, "tasks": tasks}, "games": games}


def boards():
    return [{"board": "level", "name": "账户等级", "metric": "等级 / 积分", "unit": "级"}] + [
        {"board": key, "name": g["name"], "metric": g["metric"], "unit": g["unit"]} for key, g in GAMES.items()]


def leaderboard(conn, board, limit=50, me=None):
    """Top rows of one board. Rows carry the display name, never the uid."""
    limit = max(1, min(100, int(limit or 50)))
    if board == "level":
        rows = conn.execute("""SELECT kind, uid, points_x10, display_name, updated_at FROM account_points
            WHERE points_x10 > 0 ORDER BY points_x10 DESC, updated_at ASC, kind ASC, uid ASC LIMIT ?""", (limit,)).fetchall()
        out = [{"rank": i + 1, "name": r["display_name"] or "无名旅人", "score": level_for(r["points_x10"]),
                "points": r["points_x10"] / 10, "me": bool(me and (r["kind"], r["uid"]) == me)} for i, r in enumerate(rows)]
        mine = None
        if me:
            mx = get_points_x10(conn, *me)
            if mx > 0:
                # Same ordering as the rows above: points, then who reached them first, then owner as a stable tie-break.
                mu = conn.execute("SELECT updated_at FROM account_points WHERE kind=? AND uid=?", me).fetchone()[0]
                ahead = conn.execute("""SELECT COUNT(*) FROM account_points WHERE points_x10 > ? OR (points_x10 = ? AND
                    (updated_at < ? OR (updated_at = ? AND (kind, uid) < (?, ?))))""", (mx, mx, mu, mu, *me)).fetchone()[0]
                mine = {"rank": ahead + 1, "score": level_for(mx), "points": mx / 10}
        return {"board": "level", "name": "账户等级", "metric": "等级", "unit": "级", "rows": out, "mine": mine}
    if board not in GAMES:
        raise KeyError(board)
    game = GAMES[board]
    rows = conn.execute("""SELECT s.kind, s.uid, s.best_score, s.runs, s.wins, s.display_name, COALESCE(p.points_x10, 0) AS px
        FROM game_scores s LEFT JOIN account_points p ON p.kind=s.kind AND p.uid=s.uid
        WHERE s.game=? AND s.best_score > 0 ORDER BY s.best_score DESC, s.wins DESC, s.best_at ASC, s.kind ASC, s.uid ASC LIMIT ?""",
                        (board, limit)).fetchall()
    out = [{"rank": i + 1, "name": r["display_name"] or "无名旅人", "score": r["best_score"], "runs": r["runs"],
            "wins": r["wins"], "level": level_for(r["px"]), "me": bool(me and (r["kind"], r["uid"]) == me)}
           for i, r in enumerate(rows)]
    mine = None
    if me:
        row = conn.execute("SELECT best_score, wins, best_at FROM game_scores WHERE kind=? AND uid=? AND game=?",
                           (*me, board)).fetchone()
        if row and row["best_score"] > 0:
            ahead = conn.execute("""SELECT COUNT(*) FROM game_scores WHERE game=? AND (best_score > ? OR
                (best_score = ? AND (wins > ? OR (wins = ? AND (best_at < ? OR (best_at = ? AND (kind, uid) < (?, ?)))))))""",
                                 (board, row["best_score"], row["best_score"], row["wins"], row["wins"], row["best_at"], row["best_at"], *me)).fetchone()[0]
            mine = {"rank": ahead + 1, "score": row["best_score"]}
    return {"board": board, "name": game["name"], "metric": game["metric"], "unit": game["unit"], "rows": out, "mine": mine}


# ---------- writes ----------

def _award(conn, kind, uid, day, rule, game, ref, name, awarded):
    """Pay one rule if its daily cap and the account's daily cap allow it. Caller holds the transaction."""
    spec = RULES[rule]
    scope = game if spec["per_game"] else ""
    if _rule_count(conn, kind, uid, day, rule, scope) >= spec["cap"]:
        return
    amount = min(spec["x10"], DAILY_CAP_X10 - _earned_today(conn, kind, uid, day))
    if amount <= 0:
        return
    cur = conn.execute("""INSERT OR IGNORE INTO account_point_events (kind, uid, day, rule, game, amount_x10, ref, created_at)
        VALUES (?,?,?,?,?,?,?,?)""", (kind, uid, day, rule, scope, amount, str(ref)[:120], _now()))
    if cur.rowcount != 1:
        return  # the same ref was already paid (client retry)
    conn.execute("""INSERT INTO account_points (kind, uid, points_x10, display_name, updated_at) VALUES (?,?,?,?,?)
        ON CONFLICT(kind, uid) DO UPDATE SET points_x10=points_x10+excluded.points_x10,
        display_name=excluded.display_name, updated_at=excluded.updated_at""", (kind, uid, amount, name, _now()))
    awarded.append({"rule": rule, "label": spec["label"], "amount": amount / 10})


def _runs_today(conn, kind, uid, day):
    return conn.execute("SELECT COUNT(*) FROM game_runs WHERE kind=? AND uid=? AND day=?", (kind, uid, day)).fetchone()[0]


def _check_tasks(conn, kind, uid, day, name, awarded):
    if _runs_today(conn, kind, uid, day):
        _award(conn, kind, uid, day, "task-finish", "", day, name, awarded)
    played = conn.execute("SELECT COUNT(*) FROM game_score_daily WHERE kind=? AND uid=? AND day=? AND reports>0",
                          (kind, uid, day)).fetchone()[0]
    if played >= EXPLORE_GAMES:
        _award(conn, kind, uid, day, "task-explore", "", day, name, awarded)


def clean_report(body):
    """Validate a client report; returns a normalized dict or raises ValueError."""
    if not isinstance(body, dict):
        raise ValueError("请求格式错误")
    game = body.get("game")
    if game not in GAMES:
        raise ValueError("未知玩法")
    score = body.get("score", 0)
    if isinstance(score, bool) or not isinstance(score, (int, float)) or not math.isfinite(score):
        raise ValueError("分数必须是数字")
    score = int(score)
    if score < 0 or score > GAMES[game]["max"]:
        raise ValueError("分数超出该玩法的合理范围")
    ref = body.get("ref")
    if ref is not None and (not isinstance(ref, str) or not ref or len(ref) > 120):
        raise ValueError("无效的对局编号")
    finished, won = body.get("finished") is True, body.get("won") is True
    if (finished or won) and not ref:
        raise ValueError("完成一局需要对局编号")
    return {"game": game, "score": score, "finished": finished or won, "won": won, "ref": ref}


def record_report(conn, kind, uid, name, report, now=None):
    """Store a game report and pay the rules it triggers. Atomic per call."""
    kind, uid = _owner(kind, uid)
    name = str(name or "")[:60]
    game, score, cfg = report["game"], report["score"], GAMES[report["game"]]
    day, stamp = today(now), _now()
    awarded = []
    conn.execute("BEGIN IMMEDIATE")
    try:
        daily = conn.execute("SELECT reports, summed FROM game_score_daily WHERE kind=? AND uid=? AND game=? AND day=?",
                             (kind, uid, game, day)).fetchone()
        reports, summed = (daily["reports"], daily["summed"]) if daily else (0, 0)
        if reports >= MAX_REPORTS_PER_GAME_DAY:
            conn.execute("ROLLBACK")
            return {"ok": False, "error": "今天这个玩法的上报次数已达上限", "status": 429}
        if cfg["agg"] == "sum":
            score = max(0, min(score, cfg.get("day_max", score) - summed))
        conn.execute("""INSERT INTO game_score_daily (kind, uid, game, day, reports, summed) VALUES (?,?,?,?,1,?)
            ON CONFLICT(kind, uid, game, day) DO UPDATE SET reports=reports+1, summed=summed+excluded.summed""",
                     (kind, uid, game, day, score if cfg["agg"] == "sum" else 0))
        row = conn.execute("SELECT best_score FROM game_scores WHERE kind=? AND uid=? AND game=?", (kind, uid, game)).fetchone()
        previous = row["best_score"] if row else 0
        new_finish = False
        if report["finished"]:
            # A run counts once even if the client retries the same report.
            new_finish = conn.execute("""INSERT OR IGNORE INTO game_runs (kind, uid, game, ref, day, score, won, created_at)
                VALUES (?,?,?,?,?,?,?,?)""", (kind, uid, game, report["ref"], day, score, int(report["won"]), stamp)).rowcount == 1
        best = previous + score if cfg["agg"] == "sum" else max(previous, score)
        improved = best > previous and cfg["agg"] == "best" and previous > 0
        conn.execute("""INSERT INTO game_scores (kind, uid, game, best_score, runs, wins, best_at, last_at, display_name)
            VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(kind, uid, game) DO UPDATE SET
            best_score=excluded.best_score, runs=runs+excluded.runs, wins=wins+excluded.wins,
            best_at=CASE WHEN excluded.best_score > game_scores.best_score THEN excluded.best_at ELSE game_scores.best_at END,
            last_at=excluded.last_at, display_name=excluded.display_name""",
                     (kind, uid, game, best, int(new_finish), int(new_finish and report["won"]),
                      stamp if best > previous else "", stamp, name))
        _award(conn, kind, uid, day, "play", game, day, name, awarded)
        if new_finish:
            _award(conn, kind, uid, day, "finish", game, report["ref"], name, awarded)
            if report["won"]:
                _award(conn, kind, uid, day, "win", game, report["ref"], name, awarded)
        if improved:
            _award(conn, kind, uid, day, "best", game, day, name, awarded)
        _check_tasks(conn, kind, uid, day, name, awarded)
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    return {"ok": True, "ranked": True, "game": game, "best": best, "previous_best": previous,
            "new_best": best > previous, "awarded": awarded, **level_info(get_points_x10(conn, kind, uid))}


def award_sheet(conn, kind, uid, name, code, custom_color=False, now=None):
    """Points for registering a new character sheet in 会馆; edits of an existing code pay nothing."""
    kind, uid = _owner(kind, uid)
    day, awarded = today(now), []
    nested = conn.in_transaction
    conn.execute("SAVEPOINT oc_sheet_award" if nested else "BEGIN IMMEDIATE")
    try:
        _award(conn, kind, uid, day, "sheet", "", "sheet:" + str(code), name, awarded)
        if custom_color and awarded:
            _award(conn, kind, uid, day, "sheet-color", "", "sheet:" + str(code), name, awarded)
        conn.execute("RELEASE oc_sheet_award" if nested else "COMMIT")
    except Exception:
        conn.execute("ROLLBACK TO oc_sheet_award" if nested else "ROLLBACK")
        if nested: conn.execute("RELEASE oc_sheet_award")
        raise
    return awarded


# ---------- migration: reset every account to zero ----------

def _legacy_rows(conn):
    rows = []
    for table, kind_sql in (("local_users", "'local'"), ("user_flags", "kind")):
        cols = {r[1] for r in conn.execute(f"PRAGMA table_info({table})")} if conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone() else set()
        if "points" not in cols:
            continue
        where = "" if table == "local_users" else " AND kind='usso'"
        for r in conn.execute(f"SELECT {kind_sql} AS kind, uid, points FROM {table} WHERE COALESCE(points,0) != 0{where}"):
            rows.append((r["kind"], str(r["uid"]), int(r["points"] or 0)))
    return rows


def reset_plan(conn):
    legacy = _legacy_rows(conn)
    new_total = conn.execute("SELECT COUNT(*), COALESCE(SUM(points_x10),0) FROM account_points WHERE points_x10>0").fetchone()
    return {"legacy_accounts_with_points": len(legacy), "legacy_points_total": sum(p for *_, p in legacy),
            "new_accounts_with_points": new_total[0], "new_points_total": new_total[1] / 10,
            "already_applied": bool(conn.execute("SELECT 1 FROM account_progress_migrations WHERE name=?",
                                                 (RESET_MIGRATION,)).fetchone())}


def apply_reset(conn, force=False):
    """Archive the legacy points, zero them, and clear the new totals/ledger/scores-earned points.

    Leaderboard scores (game_scores) are kept: the reset is about account points only.
    """
    plan = reset_plan(conn)
    if plan["already_applied"] and not force:
        raise RuntimeError("points reset already applied; pass --force to run it again")
    stamp = _now()
    conn.execute("BEGIN IMMEDIATE")
    try:
        for kind, uid, points in _legacy_rows(conn):
            conn.execute("""INSERT INTO account_points_legacy (kind, uid, legacy_points, archived_at) VALUES (?,?,?,?)
                ON CONFLICT(kind, uid) DO UPDATE SET legacy_points=excluded.legacy_points, archived_at=excluded.archived_at""",
                         (kind, uid, points, stamp))
        for table in ("local_users", "user_flags"):
            if "points" in {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}:
                conn.execute(f"UPDATE {table} SET points=0 WHERE COALESCE(points,0) != 0")
        conn.execute("DELETE FROM account_point_events")
        conn.execute("DELETE FROM account_points")
        conn.execute("""INSERT INTO account_progress_migrations (name, applied_at, summary_json) VALUES (?,?,?)
            ON CONFLICT(name) DO UPDATE SET applied_at=excluded.applied_at, summary_json=excluded.summary_json""",
                     (RESET_MIGRATION, stamp, json.dumps(plan, ensure_ascii=False)))
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    return plan


def restore_legacy(conn):
    """Rollback for the legacy columns only (what the old code reads)."""
    conn.execute("BEGIN IMMEDIATE")
    try:
        restored = 0
        for r in conn.execute("SELECT kind, uid, legacy_points FROM account_points_legacy").fetchall():
            if r["kind"] == "local":
                restored += conn.execute("UPDATE local_users SET points=? WHERE uid=?", (r["legacy_points"], r["uid"])).rowcount
            else:
                restored += conn.execute("UPDATE user_flags SET points=? WHERE kind='usso' AND uid=?",
                                         (r["legacy_points"], r["uid"])).rowcount
        conn.execute("DELETE FROM account_progress_migrations WHERE name=?", (RESET_MIGRATION,))
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    return restored


# ---------- HTTP (mounted at /api/progress/* on every host by portal_server) ----------

def _allowed_origin(origin):
    from site_domains import allowed_origin
    return not origin or allowed_origin(origin)


def handle(handler, method, path, project_root=None):
    """Serve one /api/progress request on a BaseHTTPRequestHandler. Identity is the shared hx_sso cookie."""
    import hx_sso
    from account_profile import resolve_sso_identity
    from urllib.parse import parse_qs, urlsplit

    def send(status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        handler.send_response(status)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("Content-Length", str(len(data)))
        handler.end_headers()
        if method != "HEAD":
            handler.wfile.write(data)

    payload = hx_sso.read_cookie(handler.headers)
    ident = resolve_sso_identity(payload, project_root) if payload else None
    me = (ident["kind"], ident["uid"]) if ident else None
    route = urlsplit(path).path
    query = parse_qs(urlsplit(path).query)
    conn = open_db(project_root)
    try:
        if method in ("GET", "HEAD") and route == "/api/progress/boards":
            return send(200, {"boards": boards()})
        if method in ("GET", "HEAD") and route == "/api/progress/leaderboard":
            board = (query.get("board") or ["level"])[0]
            try:
                limit = int((query.get("limit") or ["50"])[0])
            except ValueError:
                limit = 50
            try:
                return send(200, {"logged_in": bool(me), **leaderboard(conn, board, limit, me)})
            except KeyError:
                return send(404, {"error": "没有这个排行榜"})
        if method in ("GET", "HEAD") and route == "/api/progress/me":
            if not me:
                return send(200, {"logged_in": False, "ranked": False, "daily_cap": DAILY_CAP_X10 / 10})
            return send(200, {"logged_in": True, "ranked": True, "name": ident["name"], **summary(conn, *me)})
        if method in ("GET", "HEAD") and route == "/api/progress/chains":
            import task_chains
            if not me:
                return send(200, {"logged_in": False, "chains": task_chains.catalog()})
            return send(200, {"logged_in": True, "chains": task_chains.view(conn, *me)})
        if method == "POST" and route == "/api/progress/chains/claim":
            import task_chains
            from site_domains import request_origin_allowed
            if not request_origin_allowed(handler):
                return send(403, {"error": "来源不被允许"})
            if "application/json" not in (handler.headers.get("Content-Type") or ""):
                return send(415, {"error": "需要 JSON"})
            try:
                length = int(handler.headers.get("Content-Length") or 0)
            except ValueError:
                length = -1
            if length <= 0 or length > 4096:
                return send(400, {"error": "请求体无效"})
            try:
                chain_id = task_chains.clean_claim(json.loads(handler.rfile.read(length).decode("utf-8")))
            except (ValueError, UnicodeDecodeError) as error:
                return send(400, {"error": str(error) or "请求格式错误"})
            if not me:
                return send(401, {"error": "登录会馆账号后才能领取任务链奖励"})
            try:
                return send(200, task_chains.claim(conn, *me, ident["name"], chain_id))
            except ValueError as error:
                return send(400, {"error": str(error)})
        if method == "POST" and route == "/api/progress/report":
            from site_domains import request_origin_allowed
            if not request_origin_allowed(handler):
                return send(403, {"error": "来源不被允许"})
            if "application/json" not in (handler.headers.get("Content-Type") or ""):
                return send(415, {"error": "需要 JSON"})
            try:
                length = int(handler.headers.get("Content-Length") or 0)
            except ValueError:
                length = -1
            if length <= 0 or length > 4096:
                return send(400, {"error": "请求体无效"})
            try:
                report = clean_report(json.loads(handler.rfile.read(length).decode("utf-8")))
            except (ValueError, UnicodeDecodeError) as error:
                return send(400, {"error": str(error) or "请求格式错误"})
            if not me:
                # Anonymous visitors play freely; nothing is stored and nothing is ranked.
                return send(200, {"ok": True, "ranked": False, "logged_in": False})
            result = record_report(conn, *me, ident["name"], report)
            return send(result.pop("status", 200), result)
        return send(404, {"error": "接口不存在"})
    finally:
        conn.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=("status", "reset-legacy", "restore-legacy"))
    parser.add_argument("--apply", action="store_true", help="actually write; without it the command is a dry run")
    parser.add_argument("--force", action="store_true", help="re-run a reset that was already applied")
    args = parser.parse_args(argv)
    conn = open_db()
    try:
        if args.command == "status" or not args.apply:
            print(json.dumps(reset_plan(conn), ensure_ascii=False, indent=2))
            if args.command != "status":
                print("dry run: nothing written; add --apply to %s" % args.command)
            return 0
        if args.command == "reset-legacy":
            print(json.dumps(apply_reset(conn, force=args.force), ensure_ascii=False, indent=2))
        else:
            print(json.dumps({"restored_rows": restore_legacy(conn)}, ensure_ascii=False))
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
