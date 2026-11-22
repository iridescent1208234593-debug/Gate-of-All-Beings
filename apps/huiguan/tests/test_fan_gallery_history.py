"""Synthetic history and retention checks. Never reads live storage."""
from contextlib import closing
from pathlib import Path
import sqlite3
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "services/platform"))
import fan_gallery_history as audit

ADMIN = {"kind": "local", "uid": "101", "role": "admin"}
OWNER = {"kind": "local", "uid": "102", "role": "executor"}


class GalleryHistoryTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.row_factory = sqlite3.Row
        self.db.execute("CREATE TABLE local_users(uid INTEGER PRIMARY KEY, nickname TEXT, username TEXT)")
        self.db.executemany("INSERT INTO local_users VALUES(?,?,?)",
                            [(101, "Reviewer", "private_login"), (102, "Maker", "private_owner")])
        cols = ",".join(f"{f} TEXT DEFAULT ''" for f in audit.CONTENT_FIELDS)
        self.db.execute(f"""CREATE TABLE fan_characters(id INTEGER PRIMARY KEY, user_kind, user_uid,
                          code, review_status, is_public INTEGER, {cols})""")
        self.db.execute("""INSERT INTO fan_characters(id,user_kind,user_uid,code,review_status,is_public,name,image_data)
                            VALUES(1,'local','102','one','approved',1,'Card','data:image/png;base64,SECRET')""")
        audit.init_schema(self.db)
        self.db.commit()

    def action(self, actor, action, sql, args=(), **kwargs):
        before = audit.load(self.db, 1)
        with self.db:
            self.db.execute(sql, args)
            audit.record(self.db, actor, action, before, audit.load(self.db, 1), **kwargs)

    def test_retention_and_attributed_append_only_history(self):
        self.action(ADMIN, "review_reject", "UPDATE fan_characters SET review_status='rejected'",
                    reason="Please revise; do not include demo@example.invalid", explicit=True)
        self.action(OWNER, "owner_unpublish", "UPDATE fan_characters SET is_public=0")
        self.action(OWNER, "owner_unpublish", "UPDATE fan_characters SET is_public=0")
        observed = audit.history(self.db, 1)
        self.assertEqual(len(observed["events"]), 2)
        self.assertIsNone(observed["snapshots"][0]["approved_at"])
        self.assertTrue(observed["snapshots"][0]["legacy_observed"])
        self.assertEqual(observed["snapshots"][0]["content"]["image_data"], "")
        self.assertNotIn("SECRET", str(observed))

        for i in range(1, 5):
            self.action(OWNER, "owner_edit", "UPDATE fan_characters SET story=?, review_status='pending', is_public=1",
                        (f"Version {i}",))
            self.action(ADMIN, "review_approve", "UPDATE fan_characters SET review_status='approved'", explicit=True)

        self.action(OWNER, "owner_unpublish", "UPDATE fan_characters SET is_public=0")
        self.action(OWNER, "owner_publish", "UPDATE fan_characters SET is_public=1")
        h = audit.history(self.db, 1)
        self.assertEqual([s["content"]["story"] for s in h["snapshots"]], ["Version 4", "Version 3", "Version 2"])
        self.assertEqual(len(h["events"]), 12)
        reject = h["events"][-1]
        self.assertEqual((reject["action"],reject["actor_name"], reject["actor_role"]), ("review_reject","Reviewer","admin"))
        self.assertNotIn("demo@example", reject["reason"])
        self.assertNotIn("private_login", str(h))
        self.assertNotIn("actor_uid", str(h))
        self.assertEqual(audit.find(self.db,"Card")["matches"], [{"id":1,"name":"Card"}])

    def test_rollback_keeps_card_state_and_history_in_sync(self):
        with self.assertRaises(RuntimeError), self.db:
            before = audit.load(self.db, 1)
            self.db.execute("UPDATE fan_characters SET is_public=0")
            audit.record(self.db, OWNER, "owner_unpublish", before, audit.load(self.db, 1))
            raise RuntimeError("synthetic rollback")
        self.assertEqual(audit.load(self.db, 1)["is_public"], 1)
        self.assertEqual(audit.history(self.db, 1)["events"], [])
        self.assertEqual(audit.history(self.db, 1)["snapshots"], [])

    def test_linked_removal_accurate_without_duplicate(self):
        with self.db:
            self.db.execute("BEGIN IMMEDIATE")
            audit.unpublish_link(self.db, ADMIN, "admin_link_removed", ("local", "102"), "one")
        with self.db:
            self.db.execute("BEGIN IMMEDIATE")
            audit.unpublish_link(self.db, ADMIN, "admin_link_removed", ("local", "102"), "one")
        h = audit.history(self.db, 1)
        self.assertEqual(len(h["events"]), 1)
        self.assertEqual(h["events"][0]["action"], "admin_link_removed")
        self.assertEqual((h["events"][0]["previous_public"], h["events"][0]["new_public"]), (1,0))


if __name__ == "__main__":
    unittest.main()
