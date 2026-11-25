import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from dataclasses import replace
from email.message import Message
import sqlite3
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[3]
_TEMP = tempfile.TemporaryDirectory(prefix="huiguan-oauth-unit-")
sys.path.insert(0, str(ROOT / "services" / "platform"))
from testing_storage import configure
configure(_TEMP.name)
os.environ["IRIDESCENTLY_ENVIRONMENT"] = "test"
os.environ["USSO_LOGIN_ENABLED"] = "1"
os.environ["IRIDESCENTLY_USSO_UID_CONTRACT"] = (
    '{"field":"id","value_type":"string","pattern":"[A-Za-z0-9-]{1,48}","allow_new_accounts":true}'
)
os.environ["USSO_CLIENT_SECRET"] = "test-only-oauth-secret"
os.environ["HX_SSO_SECRET"] = "test-only-hx-sso-secret"
sys.path.insert(0, str(ROOT / "services" / "platform"))
spec = importlib.util.spec_from_file_location("huiguan_oauth_session_test", ROOT / "apps" / "huiguan" / "server_huiguan.py")
app = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = app
spec.loader.exec_module(app)
app.init_user_db()


class HuiguanOAuthSessionTest(unittest.TestCase):
    def test_session_is_database_backed_and_expires(self):
        sid = app.create_session("usso", "unit-user")
        self.assertEqual(app.read_session(sid), {"kind": "usso", "uid": "unit-user"})
        with app.DB_LOCK:
            conn = app.db()
            conn.execute("UPDATE sessions_db SET expires_at='2000-01-01T00:00:00+00:00' WHERE sid=?", (sid,))
            conn.commit()
            conn.close()
        self.assertIsNone(app.read_session(sid))

    def test_session_cookie_flags_are_secure_and_http_only(self):
        cookie = app.Handler._session_cookie(None, "test-session")
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Lax", cookie)
        self.assertIn("Secure", cookie)
        self.assertIn("Path=/", cookie)

    def test_shared_sso_cookie_uses_signed_test_identity_and_secure_flags(self):
        cookie = app.Handler._sso_cookie(None, "unit-user", "usso", "Unit User")
        self.assertIn("hx_sso=", cookie)
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Lax", cookie)
        self.assertIn("Secure", cookie)

    def test_shared_cookie_scope_and_audience_follow_each_root(self):
        roots = ("iridescently.xyz", "iridescently.cn", "iridescently.dpdns.org")
        for root in roots:
            with self.subTest(root=root):
                request = FakeRequest("huiguan." + root)
                sso = app.Handler._sso_cookie(request, "unit-user", "usso", "Unit User")
                self.assertIn("Path=/; Domain=." + root, sso)
                token = sso.split("hx_sso=", 1)[1].split(";", 1)[0]
                payload = app.hx_sso.verify_token(token, root)
                self.assertEqual((payload["uid"], payload["aud"]), ("unit-user", root))
                for other in set(roots) - {root}:
                    self.assertIsNone(app.hx_sso.verify_token(token, other))
                self.assertIn("Path=/; Domain=." + root,
                              app.Handler._session_cookie(request, "test-session"))
                self.assertIn("Domain=." + root, app.Handler._sso_clear_cookie(request))

    def test_sessions_are_bound_to_the_root_that_issued_them(self):
        sid = app.create_session("local", "unit-root-user", "iridescently.cn")
        self.assertEqual(app.read_session(sid, "iridescently.cn"), {"kind": "local", "uid": "unit-root-user"})
        self.assertIsNone(app.read_session(sid, "iridescently.xyz"))
        self.assertIsNone(app.read_session(sid, "iridescently.dpdns.org"))
        legacy = app.create_session("local", "unit-legacy-user")
        self.assertIsNotNone(app.read_session(legacy, "iridescently.xyz"))
        self.assertIsNone(app.read_session(legacy, "iridescently.cn"))

    def test_login_on_a_root_without_a_registered_callback_never_leaves_that_root(self):
        registered = FakeRequest("huiguan.iridescently.xyz")
        app.Handler._api_sso_login(registered)
        location = dict(item[1:] for item in registered.sent if item[0] == "header")["Location"]
        self.assertTrue(location.startswith(app.SSO_AUTHORIZE + "?"))
        self.assertIn("redirect_uri=https%3A%2F%2Fhuiguan.iridescently.xyz%2Fcb", location)
        for host in ("huiguan.iridescently.cn", "huiguan.iridescently.dpdns.org"):
            with self.subTest(host=host):
                pending = len(app.OAUTH_STATES)
                request = FakeRequest(host)
                app.Handler._api_sso_login(request)
                self.assertEqual(request.sent[0][:2], ("json", 503))
                self.assertFalse([item for item in request.sent if item[0] == "header"])
                self.assertEqual(len(app.OAUTH_STATES), pending)

    def test_callback_state_cannot_be_replayed_on_another_root(self):
        request = FakeRequest("huiguan.iridescently.xyz")
        app.Handler._api_sso_login(request)
        state = next(key for key, value in app.OAUTH_STATES.items() if value["callback"] == "https://huiguan.iridescently.xyz/cb")
        replay = FakeRequest("huiguan.iridescently.cn")
        app.Handler._api_callback(replay, {"state": [state], "code": ["mock-code"]})
        self.assertEqual(replay.sent[0][:2], ("json", 400))
        self.assertNotIn(state, app.OAUTH_STATES)


    def _callback(self, userinfo):
        request = FakeRequest("huiguan.iridescently.xyz")
        app.Handler._api_sso_login(request)
        location = next(entry[2] for entry in request.sent if entry[:2] == ("header", "Location"))
        state = parse_qs(urlsplit(location).query)["state"]
        request.sent.clear()
        with patch.object(app, "sso_post", return_value={"code": 200, "access_token": "mock"}), \
                patch.object(app, "sso_get_userinfo", return_value={"code": 200, "data": userinfo}):
            app.Handler._api_callback(request, {"state": state, "code": ["mock-code"]})
        return request.sent

    def _rows(self):
        with closing(app.db()) as conn:
            return (conn.execute("SELECT count(*) FROM users").fetchone()[0],
                    conn.execute("SELECT count(*) FROM sessions_db").fetchone()[0])

    def test_first_and_repeat_login_use_one_account(self):
        before = self._rows()
        uid = "New-0007"
        first = self._callback({"id": uid, "nickname": "Test new member"})
        second = self._callback({"id": uid, "sub": "provider-alternate", "nickname": "Updated nickname"})
        for response in (first, second):
            self.assertEqual(response[0], ("status", 302))
            self.assertEqual(sum(entry[:2] == ("header", "Set-Cookie") for entry in response), 2)
        self.assertEqual(self._rows(), (before[0] + 1, before[1] + 2))
        with closing(app.db()) as conn:
            row = conn.execute("SELECT user_id, nickname FROM users WHERE user_id=?", (uid,)).fetchone()
            owners = conn.execute("SELECT DISTINCT kind, uid FROM sessions_db WHERE uid=?", (uid,)).fetchall()
        self.assertEqual(tuple(row), (uid, "Updated nickname"))
        self.assertEqual([tuple(owner) for owner in owners], [("usso", uid)])

    def test_missing_or_invalid_authoritative_uid_creates_no_account_or_session(self):
        before = self._rows()
        invalid_profiles = (
            {"sub": "Different-valid-field", "social_uid": "Other-alternate"},
            *({"id": value, "sub": "Valid-alternate"} for value in
              (None, True, 1, 1.5, [], {}, "", " Leading-space", "Internal space", "a" * 256)),
            [],
        )
        for profile in invalid_profiles:
            with self.subTest(profile=profile):
                result = self._callback(profile)
                self.assertEqual(len(result), 1)
                self.assertEqual(result[0][:2], ("json", 502))
        self.assertEqual(self._rows(), before)

    def test_existing_only_matches_original_owner_and_blocks_unknown_uid(self):
        uid = "Existing-0007"
        with closing(app.db()) as conn, conn:
            conn.execute("INSERT INTO users (user_id, nickname) VALUES (?,?)", (uid, "Existing account"))
        before = self._rows()
        with patch.object(app, "USSO_UID_CONTRACT", replace(app.USSO_UID_CONTRACT, allow_new_accounts=False)):
            success = self._callback({"id": uid, "nickname": "Updated existing account"})
            refused = self._callback({"id": "Changed-0007", "sub": uid})
        self.assertEqual(success[0], ("status", 302))
        self.assertEqual(len(refused), 1)
        self.assertEqual(refused[0], (
            "json", 403, {"error": "暂时无法确认这个账号的归属，请联系会馆管理员核验。"},
        ))
        self.assertEqual(self._rows(), (before[0], before[1] + 1))
        with closing(app.db()) as conn:
            row = conn.execute("SELECT nickname FROM users WHERE user_id=?", (uid,)).fetchone()
        self.assertEqual(row["nickname"], "Updated existing account")

    def test_explicit_authority_field_ignores_other_existing_keys(self):
        for field in ("sub", "social_uid"):
            with self.subTest(field=field):
                authority_uid = "Authority-" + field.replace("_", "-")
                legacy_uid = "Legacy-" + field.replace("_", "-")
                with closing(app.db()) as conn, conn:
                    conn.executemany("INSERT INTO users (user_id, nickname) VALUES (?,?)", [
                        (authority_uid, "Authoritative fixture"), (legacy_uid, "Other existing fixture"),
                    ])
                before = self._rows()
                policy = replace(app.USSO_UID_CONTRACT, field=field, allow_new_accounts=False)
                other_fields = {name: legacy_uid for name in ("id", "sub", "social_uid") if name != field}
                with patch.object(app, "USSO_UID_CONTRACT", policy):
                    accepted = self._callback({**other_fields, field: authority_uid, "nickname": "Updated authority"})
                    missing = self._callback(other_fields)
                    changed = self._callback({**other_fields, field: "Unverified-new-key"})
                self.assertEqual(accepted[0], ("status", 302))
                self.assertEqual(len(missing), 1)
                self.assertEqual(missing[0][:2], ("json", 502))
                self.assertEqual(len(changed), 1)
                self.assertEqual(changed[0][:2], ("json", 403))
                self.assertEqual(self._rows(), (before[0], before[1] + 1))
                with closing(app.db()) as conn:
                    rows = conn.execute("SELECT user_id, nickname FROM users WHERE user_id IN (?,?)",
                                        (authority_uid, legacy_uid)).fetchall()
                    owners = conn.execute("SELECT kind, uid FROM sessions_db WHERE uid IN (?,?)",
                                          (authority_uid, legacy_uid)).fetchall()
                self.assertEqual(dict(map(tuple, rows)), {
                    authority_uid: "Updated authority", legacy_uid: "Other existing fixture",
                })
                self.assertEqual(list(map(tuple, owners)), [("usso", authority_uid)])

    def test_integer_contract_does_not_merge_a_legacy_key_with_leading_zeros(self):
        canonical_uid = "19139"
        legacy_uid = "0019139"
        with closing(app.db()) as conn, conn:
            conn.executemany("INSERT INTO users (user_id, nickname) VALUES (?,?)", [
                (canonical_uid, "Canonical fixture"), (legacy_uid, "Legacy fixture"),
            ])
        before = self._rows()
        policy = app.parse_usso_uid_contract(
            '{"field":"id","value_type":"integer","pattern":"[0-9]{1,20}"}'
        )
        self.assertIsNotNone(policy)
        with patch.object(app, "USSO_UID_CONTRACT", policy):
            accepted = self._callback({"id": int(canonical_uid), "nickname": "Updated canonical"})
            refused = self._callback({"id": legacy_uid})
        self.assertEqual(accepted[0], ("status", 302))
        self.assertEqual(len(refused), 1)
        self.assertEqual(refused[0][:2], ("json", 502))
        self.assertEqual(self._rows(), (before[0], before[1] + 1))
        with closing(app.db()) as conn:
            rows = conn.execute("SELECT user_id, nickname FROM users WHERE user_id IN (?,?)",
                                (canonical_uid, legacy_uid)).fetchall()
            owners = conn.execute("SELECT kind, uid FROM sessions_db WHERE uid IN (?,?)",
                                  (canonical_uid, legacy_uid)).fetchall()
        self.assertEqual(dict(map(tuple, rows)), {
            canonical_uid: "Updated canonical", legacy_uid: "Legacy fixture",
        })
        self.assertEqual(list(map(tuple, owners)), [("usso", canonical_uid)])

    def test_missing_contract_does_not_start_oauth(self):
        request = FakeRequest("huiguan.iridescently.xyz")
        pending = len(app.OAUTH_STATES)
        with patch.object(app, "USSO_UID_CONTRACT", None):
            app.Handler._api_sso_login(request)
        self.assertEqual(request.sent[0][:2], ("json", 503))
        self.assertEqual(len(app.OAUTH_STATES), pending)

    def test_banned_usso_uid_does_not_write_account_or_session(self):
        uid = "Banned-0007"
        with closing(app.db()) as conn, conn:
            conn.execute("INSERT INTO user_flags(kind, uid, status) VALUES ('usso', ?, 'banned')", (uid,))
        before = self._rows()
        refused = self._callback({"id": uid})
        self.assertEqual(len(refused), 1)
        self.assertEqual(refused[0][:2], ("json", 403))
        self.assertEqual(self._rows(), before)

    def test_concurrent_first_logins_keep_one_account(self):
        def login(_):
            return app.start_usso_session(
                "Concurrent-0007", "Concurrent member", "", "", "iridescently.xyz", allow_new_accounts=True,
            )

        before = self._rows()
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(login, range(4)))
        self.assertTrue(all(sid and error is None for sid, error in results))
        self.assertEqual(self._rows(), (before[0] + 1, before[1] + 4))

    def test_account_write_rolls_back_if_session_insert_fails(self):
        before = self._rows()
        with patch.object(app, "_insert_session", side_effect=sqlite3.OperationalError("fixture failure")):
            with self.assertRaises(sqlite3.OperationalError):
                app.start_usso_session(
                    "Rollback-0007", "Rollback member", "", "", "iridescently.xyz", allow_new_accounts=True,
                )
        self.assertEqual(self._rows(), before)

    def test_uid_policy_types_and_invalid_policy(self):
        parse = app.parse_usso_uid_contract
        self.assertIsNone(parse('{"field":"sub","value_type":"string","pattern":"["}'))
        self.assertIsNone(parse('{"field":"id","value_type":"string","pattern":"[0-9]+","allow_new_accounts":"false"}'))
        contract = parse('{"field":"id","value_type":"string_or_integer","pattern":"[0-9]{1,20}"}')
        self.assertFalse(contract.allow_new_accounts)
        self.assertEqual(contract.read_uid({"id": 7}), "7")
        self.assertEqual(contract.read_uid({"id": "007"}), "007")
        self.assertIsNone(contract.read_uid({"id": True}))
        self.assertIsNone(contract.read_uid({"sub": "7"}))


class FakeRequest:
    """Only the request facts the login handlers read; responses are recorded."""
    def __init__(self, host):
        self.headers = Message()
        self.headers["Host"] = host
        self._external_host = host
        self.client_address = ("127.0.0.1", 40000)
        self.sent = []

    def _oauth_callback(self):
        return app.Handler._oauth_callback(self)

    def _session_cookie(self, sid):
        return app.Handler._session_cookie(self, sid)

    def _sso_cookie(self, uid, kind, name):
        return app.Handler._sso_cookie(self, uid, kind, name)

    def _json(self, status, payload, **_):
        self.sent.append(("json", status, payload))

    def send_response(self, status):
        self.sent.append(("status", status))

    def send_header(self, name, value):
        self.sent.append(("header", name, value))

    def end_headers(self):
        self.sent.append(("end",))


if __name__ == "__main__":
    unittest.main()
