"""In-memory score-only boards: never opens runtime or production storage."""
import sqlite3
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import account_progress as ap

class MiniGameScoresTest(unittest.TestCase):
    def setUp(self):
        self.conn=sqlite3.connect(":memory:",isolation_level=None)
        self.conn.row_factory=sqlite3.Row
        ap.init_schema(self.conn)
    def tearDown(self): self.conn.close()
    def report(self,uid="a",score=10,distance=100,ref="one",game="oc-run-coins"):
        body=ap.clean_report(dict(game=game,score=score,distance=distance,ref=ref,finished=True))
        return ap.record_report(self.conn,"local",uid,uid,body)
    def board(self,game="oc-run-coins",limit=50,uid="a"):
        return ap.leaderboard(self.conn,game,limit,("local",uid))
    def test_coin_tie_uses_distance_and_mine_beyond_limit(self):
        self.report("a",10,200);self.report("b",10,300);self.report("c",11,50)
        board=self.board(limit=1)
        self.assertEqual(board["rows"][0]["name"],"c")
        self.assertEqual(board["mine"],dict(rank=3,score=10,distance=200))
        self.assertEqual([r["name"] for r in self.board()["rows"]],["c","b","a"])
    def test_same_run_pair_no_splicing_and_retries_immutable(self):
        self.report(score=10,distance=200)
        self.report(score=9,distance=999,ref="two")
        self.assertEqual(self.board()["mine"]["distance"],200)
        self.report(score=10,distance=300,ref="three")
        self.assertEqual(self.board()["mine"]["distance"],300)
        self.report(score=99,distance=999,ref="three")
        self.assertEqual(self.board()["mine"]["score"],10)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM mini_game_runs").fetchone()[0],3)
    def test_boards_and_account_kinds_isolated_without_points_or_tasks(self):
        for key in ("oc-run","oc-run-coins","frog-crossing"):
            self.report(game=key)
        for table in ("account_points","account_point_events","game_scores","game_score_daily","game_runs"):
            self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM "+table).fetchone()[0],0)
        self.assertEqual(len(self.board()["rows"]),1)
        report=ap.clean_report(dict(game="oc-run-coins",score=20,distance=1,ref="usso",finished=True))
        ap.record_report(self.conn,"usso","a","other",report)
        self.assertEqual(self.board()["mine"]["rank"],2)
    def test_validation(self):
        for value in (-1,True,float('nan'),float('inf'),"100",1000000001):
            with self.assertRaises(ValueError):
                ap.clean_report(dict(game="oc-run-coins",score=2,distance=value,finished=True,ref="r"))
        with self.assertRaises(ValueError):ap.clean_report(dict(game="oc-run",score=2,finished=False))
    def test_limit_and_retry_after_limit(self):
        old=ap.MAX_REPORTS_PER_GAME_DAY
        ap.MAX_REPORTS_PER_GAME_DAY=1
        try:
            self.assertTrue(self.report()["ok"])
            self.assertTrue(self.report()["ok"])
            self.assertEqual(self.report(ref="two")["status"],429)
        finally:ap.MAX_REPORTS_PER_GAME_DAY=old

if __name__=="__main__":unittest.main()
