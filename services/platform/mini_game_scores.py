"""Score-only adapter for OC mini-games; no wallet, points or task writes."""
import math

GAMES = {
    "oc-run": {"name": "OC 快跑", "metric": "单局最高分", "unit": "分", "agg": "best", "max": 1000000000},
    "oc-run-coins": {"name": "OC 快跑 · 金币", "metric": "单局金币数，同数量比较距离", "unit": "枚", "agg": "best", "max": 10000000},
    "frog-crossing": {"name": "青蛙过河", "metric": "单局最高分", "unit": "分", "agg": "best", "max": 1000000000},
}

def init_schema(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS mini_game_scores (
        kind TEXT NOT NULL, uid TEXT NOT NULL, game TEXT NOT NULL,
        score INTEGER NOT NULL, distance INTEGER NOT NULL, best_at TEXT NOT NULL,
        name TEXT NOT NULL, PRIMARY KEY(kind, uid, game))""")
    conn.execute("""CREATE TABLE IF NOT EXISTS mini_game_runs (
        kind TEXT NOT NULL, uid TEXT NOT NULL, game TEXT NOT NULL, ref TEXT NOT NULL,
        day TEXT NOT NULL, PRIMARY KEY(kind, uid, game, ref))""")
    conn.execute("CREATE INDEX IF NOT EXISTS mini_game_board ON mini_game_scores(game, score DESC, distance DESC)")

def clean(body):
    distance = body.get("distance", 0)
    if isinstance(distance, bool) or not isinstance(distance, (int, float)) or not math.isfinite(distance) or distance < 0 or distance > 1000000000:
        raise ValueError("距离超出合理范围")
    if body.get("finished") is not True or not body.get("ref"):
        raise ValueError("小游戏仅提交已结束的整局成绩")
    return int(distance) if body["game"] == "oc-run-coins" else 0

def record(conn, kind, uid, name, report, day, stamp, cap):
    game, score, distance = report["game"], report["score"], report["distance"]
    conn.execute("BEGIN IMMEDIATE")
    try:
        duplicate = conn.execute("SELECT 1 FROM mini_game_runs WHERE kind=? AND uid=? AND game=? AND ref=?", (kind, uid, game, report["ref"])).fetchone()
        row = conn.execute("SELECT score,distance FROM mini_game_scores WHERE kind=? AND uid=? AND game=?", (kind, uid, game)).fetchone()
        previous = (row["score"], row["distance"]) if row else (0, 0)
        better = (score, distance) > previous
        if not duplicate:
            count = conn.execute("SELECT COUNT(*) FROM mini_game_runs WHERE kind=? AND uid=? AND game=? AND day=?", (kind, uid, game, day)).fetchone()[0]
            if count >= cap:
                conn.execute("ROLLBACK")
                return {"ok": False, "error": "今天这个玩法的上报次数已达上限", "status": 429}
            conn.execute("INSERT INTO mini_game_runs VALUES (?,?,?,?,?)", (kind, uid, game, report["ref"], day))
            if better or row is None:
                conn.execute("""INSERT INTO mini_game_scores VALUES (?,?,?,?,?,?,?)
                    ON CONFLICT(kind,uid,game) DO UPDATE SET score=excluded.score,distance=excluded.distance,best_at=excluded.best_at,name=excluded.name""", (kind, uid, game, score, distance, stamp, str(name or "")[:60]))
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    best = (score, distance) if not duplicate and better else previous
    return {"ok": True, "ranked": True, "game": game, "best": best[0], "distance": best[1], "new_best": better and not duplicate, "awarded": []}

def leaderboard(conn, board, limit, me, level_for):
    # ROW_NUMBER supplies the same exact ordering for visible rows and the player's rank.
    query = """WITH ranked AS (SELECT s.*, ROW_NUMBER() OVER (
        ORDER BY score DESC,distance DESC,best_at ASC,kind ASC,uid ASC) AS rank
        FROM mini_game_scores s WHERE game=? AND score>0) """
    rows = conn.execute(query + "SELECT r.*, COALESCE(p.points_x10,0) AS px FROM ranked r LEFT JOIN account_points p ON p.kind=r.kind AND p.uid=r.uid ORDER BY rank LIMIT ?", (board, limit)).fetchall()
    out = [{"rank": r["rank"], "name": r["name"] or "无名旅人", "score": r["score"], "distance": r["distance"], "level": level_for(r["px"]), "wins": 0, "me": bool(me and (r["kind"],r["uid"]) == me)} for r in rows]
    mine = None
    if me:
        r = conn.execute(query + "SELECT rank,score,distance FROM ranked WHERE kind=? AND uid=?", (board, *me)).fetchone()
        if r: mine = dict(r)
    return {"board": board, "name": GAMES[board]["name"], "metric": GAMES[board]["metric"], "unit": GAMES[board]["unit"], "rows": out, "mine": mine}
