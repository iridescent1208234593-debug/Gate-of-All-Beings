"""The fan-gallery favorites migration must preserve votes and old favorites."""

import sqlite3
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server_huiguan import Handler


class FanReactionMigrationTest(unittest.TestCase):
    def test_legacy_favorites_survive_and_allow_distinct_admin_choices(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        try:
            db.execute("CREATE TABLE fan_char_favorites (id INTEGER PRIMARY KEY AUTOINCREMENT, user_kind TEXT, user_uid TEXT, character_id INTEGER, created_at INTEGER, UNIQUE(user_kind, user_uid))")
            db.execute("INSERT INTO fan_char_favorites(user_kind,user_uid,character_id,created_at) VALUES('local','owner',7,123)")
            Handler._ensure_fan_reaction_tables(None, db)
            rows = db.execute("SELECT user_kind,user_uid,character_id,created_at FROM fan_char_favorites").fetchall()
            self.assertEqual([tuple(row) for row in rows], [("local", "owner", 7, 123)])
            db.execute("INSERT INTO fan_char_favorites(user_kind,user_uid,character_id,created_at) VALUES('local','owner',8,124)")
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("INSERT INTO fan_char_favorites(user_kind,user_uid,character_id,created_at) VALUES('local','owner',8,125)")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
