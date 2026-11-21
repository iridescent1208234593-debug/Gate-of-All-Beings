"""Account profile rows stay owned by (kind, uid) across guest, A/B and logout.

Uses a temporary project root; the real 会馆 users.db is never opened.
"""
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services" / "platform"))
from account_profile import (  # noqa: E402
    get_profile,
    open_db,
    resolve_sso_identity,
    set_account_avatar,
    set_gate_identity,
    set_gate_identities,
)


def identity(name, frame):
    return {"schema_version": 1, "display_name": name, "species_name": "猫妖", "avatar_asset_id": "",
            "avatar_frame_id": frame, "avatar_mode": "default", "source_oc_id": ""}


class AccountProfileScopeTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="account-profile-scope-")
        self.addCleanup(self.temporary.cleanup)
        conn = open_db(self.temporary.name)
        conn.executescript("""
            CREATE TABLE local_users (uid INTEGER PRIMARY KEY, username TEXT, pass_hash TEXT,
                nickname TEXT, picture TEXT, status TEXT);
            CREATE TABLE users (user_id TEXT PRIMARY KEY, nickname TEXT, picture TEXT);
            CREATE TABLE user_flags (kind TEXT NOT NULL, uid TEXT NOT NULL, status TEXT DEFAULT 'active',
                PRIMARY KEY (kind, uid));
            INSERT INTO local_users VALUES (7, 'local-seven', 'x', '本地七', 'local.png', 'active');
            INSERT INTO local_users VALUES (8, 'local-eight', 'x', '本地八', 'local8.png', 'active');
            INSERT INTO users VALUES ('7', 'USSO 七', 'usso.png');
        """)
        conn.commit()
        conn.close()

    def write_profile(self, kind, uid, gate_identity, avatar, roster=None):
        conn = open_db(self.temporary.name)
        try:
            set_account_avatar(conn, kind, uid, avatar, "2026-11-18T00:00:00+00:00")
            set_gate_identity(conn, kind, uid, gate_identity, "2026-11-18T00:00:00+00:00")
            set_gate_identities(conn, kind, uid, roster or [gate_identity], "2026-11-18T00:00:00+00:00")
            conn.commit()
        finally:
            conn.close()

    def test_same_number_local_and_usso_keep_profiles_and_avatars_separate(self):
        local_avatar = "/assets/uploads/" + "a" * 64 + ".webp"
        usso_avatar = "/assets/uploads/" + "b" * 64 + ".webp"
        self.write_profile("local", 7, identity("本地七形象", "r01"), local_avatar)
        self.write_profile("usso", "7", identity("USSO 七形象", "r02"), usso_avatar)

        local = resolve_sso_identity({"kind": "local", "uid": "7"}, self.temporary.name)
        usso = resolve_sso_identity({"kind": "usso", "uid": "7"}, self.temporary.name)

        self.assertEqual(local["gate_identity"]["display_name"], "本地七形象")
        self.assertEqual(usso["gate_identity"]["display_name"], "USSO 七形象")
        self.assertEqual(local["account_avatar_url"], local_avatar)
        self.assertEqual(usso["account_avatar_url"], usso_avatar)
        self.assertNotEqual(local["account_avatar_url"], usso["account_avatar_url"])
        self.assertEqual(local["name"], "本地七")
        self.assertEqual(usso["name"], "USSO 七")

    def test_switch_a_b_a_and_refresh_always_return_the_requested_account(self):
        self.write_profile("local", 7, identity("账户 A", "r03"), "/assets/uploads/" + "c" * 64 + ".webp")
        self.write_profile("local", 8, identity("账户 B", "r04"), "/assets/uploads/" + "d" * 64 + ".webp")
        a_token = {"kind": "local", "uid": "7"}
        b_token = {"kind": "local", "uid": "8"}

        first_a = resolve_sso_identity(a_token, self.temporary.name)
        first_b = resolve_sso_identity(b_token, self.temporary.name)
        refreshed_a = resolve_sso_identity(a_token, self.temporary.name)

        self.assertEqual(first_a["gate_identity"]["display_name"], "账户 A")
        self.assertEqual(first_b["gate_identity"]["display_name"], "账户 B")
        self.assertEqual(refreshed_a["gate_identity"], first_a["gate_identity"])
        self.assertNotEqual(refreshed_a["account_avatar_url"], first_b["account_avatar_url"])

    def test_guest_and_logout_never_resolve_to_a_saved_account(self):
        self.write_profile("local", 7, identity("账户 A", "r05"), "/assets/uploads/" + "e" * 64 + ".webp")

        for token in (None, {}, {"kind": "local", "uid": ""}, {"kind": "local", "uid": "999"},
                      {"kind": "admin", "uid": "7"}):
            with self.subTest(token=token):
                self.assertIsNone(resolve_sso_identity(token, self.temporary.name))

        # Logout is the absence of a token; the account row itself must stay intact.
        self.assertEqual(resolve_sso_identity({"kind": "local", "uid": "7"}, self.temporary.name)["gate_identity"]["display_name"], "账户 A")

    def test_guest_draft_is_not_implicitly_written_to_an_account_row(self):
        guest_draft = identity("访客草稿", "r06")
        conn = open_db(self.temporary.name)
        try:
            self.assertIsNone(get_profile(conn, "local", 7)["gate_identity"])
        finally:
            conn.close()

        # Resolving a guest session and then A must not claim the guest draft for A.
        self.assertIsNone(resolve_sso_identity(None, self.temporary.name))
        account = resolve_sso_identity({"kind": "local", "uid": "7"}, self.temporary.name)
        self.assertIsNone(account["gate_identity"])
        self.assertNotEqual(account["gate_identity"], guest_draft)

        conn = open_db(self.temporary.name)
        try:
            self.assertIsNone(get_profile(conn, "local", 7)["gate_identity"])
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
