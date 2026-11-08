"""Cross-game task chains derived from the existing score tables.

Chains need no new reporting and no new schema: every step reads a metric that
account_progress.record_report already maintains in game_scores (per-game best
score, finished runs, wins; "*" aggregates across games). Because progress is
derived at read time it is retroactive for existing accounts and can never
disagree with the leaderboards.

Claims are paid through the same append-only account_point_events ledger the
point rules use (rule="chain", ref="chain:<id>"), so the UNIQUE index makes a
claim idempotent even under client retries. Chain rewards intentionally bypass
the daily cap: they are one-off milestones, not farmable income.

CLI: none. Mounted under /api/progress/chains by account_progress.handle.
"""
import sqlite3

from account_progress import _now, _owner, today


# Each step reads one metric of one game ("*" = across every game):
#   best  -> game_scores.best_score       runs -> finished runs (summed for "*")
#   wins  -> game_scores.wins             games -> distinct games with runs > 0
CHAINS = {
    "first-steps": {
        "name": "初入众生", "reward_x10": 30,
        "desc": "从一局开始，走遍众生之门。",
        "steps": [
            {"id": "any-run", "game": "*", "metric": "runs", "target": 1, "label": "完成任意一局"},
            {"id": "try-three", "game": "*", "metric": "games", "target": 3, "label": "尝试三种不同玩法"},
            {"id": "any-win", "game": "*", "metric": "wins", "target": 1, "label": "赢下一局"},
        ],
    },
    "relay": {
        "name": "灵旅接力", "reward_x10": 50,
        "desc": "在三个世界各留下真实的足迹。",
        "steps": [
            {"id": "cards-runs", "game": "cards", "metric": "runs", "target": 3, "label": "众生牌录完成 3 局"},
            {"id": "ecology-best", "game": "ecology", "metric": "best", "target": 10, "label": "灵境生态同存 10 种"},
            {"id": "management-best", "game": "management", "metric": "best", "target": 5, "label": "会馆经营建成 5 座建筑"},
        ],
    },
    "peak": {
        "name": "登峰造极", "reward_x10": 50,
        "desc": "把最深的记录留在这几个玩法里。",
        "steps": [
            {"id": "cards-10", "game": "cards", "metric": "best", "target": 10, "label": "众生牌录最深 10 层"},
            {"id": "slay-10", "game": "slay", "metric": "best", "target": 10, "label": "重生之门最深 10 层"},
            {"id": "juling-500", "game": "juling", "metric": "best", "target": 500, "label": "聚灵修行评分 500"},
        ],
    },
    "explorer": {
        "name": "全境旅人", "reward_x10": 80,
        "desc": "把每个世界都至少走一遍。",
        "steps": [
            {"id": "g3", "game": "*", "metric": "games", "target": 3, "label": "玩过 3 种玩法"},
            {"id": "g6", "game": "*", "metric": "games", "target": 6, "label": "玩过 6 种玩法"},
            {"id": "g9", "game": "*", "metric": "games", "target": 9, "label": "玩过 9 种玩法"},
        ],
    },
}
CHAIN_RULE = "chain"  # account_point_events.rule for every claim


def catalog():
    """Public shape without any account data: what the login page can advertise."""
    return [{"id": cid, "name": c["name"], "desc": c["desc"], "reward": c["reward_x10"] / 10,
             "steps": [{"id": s["id"], "label": s["label"]} for s in c["steps"]]}
            for cid, c in CHAINS.items()]


def _metric(conn, kind, uid, game, metric):
    if game == "*":
        if metric == "games":
            return conn.execute("SELECT COUNT(*) FROM game_scores WHERE kind=? AND uid=? AND runs>0",
                                (kind, uid)).fetchone()[0]
        column = "runs" if metric == "runs" else "wins"  # metric is validated below
        return conn.execute("SELECT COALESCE(SUM(%s),0) FROM game_scores WHERE kind=? AND uid=?" % column,
                            (kind, uid)).fetchone()[0]
    row = conn.execute("SELECT best_score, runs, wins FROM game_scores WHERE kind=? AND uid=? AND game=?",
                       (kind, uid, game)).fetchone()
    values = {"best": row[0], "runs": row[1], "wins": row[2]} if row else {"best": 0, "runs": 0, "wins": 0}
    return values[metric]


def _claimed(conn, kind, uid, chain_id):
    return bool(conn.execute("SELECT 1 FROM account_point_events WHERE kind=? AND uid=? AND rule=? AND game=?",
                             (kind, uid, CHAIN_RULE, chain_id)).fetchone())


def view(conn, kind, uid):
    """Every chain with this account's live progress; the account page renders it directly."""
    kind, uid = _owner(kind, uid)
    out = []
    for chain_id, chain in CHAINS.items():
        steps = []
        for step in chain["steps"]:
            value = int(_metric(conn, kind, uid, step["game"], step["metric"]))
            steps.append({"id": step["id"], "label": step["label"], "game": step["game"],
                          "progress": min(value, step["target"]), "target": step["target"],
                          "done": value >= step["target"]})
        out.append({"id": chain_id, "name": chain["name"], "desc": chain["desc"],
                    "reward": chain["reward_x10"] / 10, "steps": steps,
                    "complete": all(s["done"] for s in steps), "claimed": _claimed(conn, kind, uid, chain_id)})
    return out


def claim(conn, kind, uid, name, chain_id):
    """Pay a finished chain once. Raises KeyError for unknown ids, ValueError when unfinished."""
    chain = CHAINS[chain_id]  # KeyError for unknown ids
    kind, uid = _owner(kind, uid)
    name = str(name or "")[:60]
    day = today()  # 记真实北京日期，让任务链积分进入按天统计（每日额度已排除 chain）
    conn.execute("BEGIN IMMEDIATE")
    try:
        mine = next(c for c in view(conn, kind, uid) if c["id"] == chain_id)
        unfinished = [s["id"] for s in mine["steps"] if not s["done"]]
        if unfinished:
            raise ValueError("任务链还没有完成：%s" % ", ".join(unfinished))
        cur = conn.execute("""INSERT OR IGNORE INTO account_point_events (kind, uid, day, rule, game, amount_x10, ref, created_at)
            VALUES (?,?,?,?,?,?,?,?)""", (kind, uid, day, CHAIN_RULE, chain_id, chain["reward_x10"],
                                          "chain:" + chain_id, _now()))
        if cur.rowcount == 1:
            conn.execute("""INSERT INTO account_points (kind, uid, points_x10, display_name, updated_at)
                VALUES (?,?,?,?,?) ON CONFLICT(kind, uid) DO UPDATE SET
                points_x10=points_x10+excluded.points_x10, display_name=excluded.display_name,
                updated_at=excluded.updated_at""", (kind, uid, chain["reward_x10"], name, _now()))
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    return {"ok": True, "chain": chain_id, "reward": chain["reward_x10"] / 10, "already": cur.rowcount != 1}


def clean_claim(body):
    """Validate a claim request body; returns the chain id or raises ValueError."""
    if not isinstance(body, dict):
        raise ValueError("请求格式错误")
    chain_id = body.get("chain")
    if not isinstance(chain_id, str) or chain_id not in CHAINS:
        raise ValueError("没有这个任务链")
    return chain_id
