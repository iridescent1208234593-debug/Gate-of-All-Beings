"""Loopback creator directory integration. Every account and consent record is synthetic."""
from base64 import urlsafe_b64encode
from hashlib import sha256
import http.client
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.parse import urlencode

PROJECT = Path(__file__).resolve().parents[3]
HOST = "huiguan.iridescently.cn"
ORIGIN = f"https://{HOST}"
DIRECTORY = "/api/creators/directory"
ME = "/api/creators/me"
ACCOUNT = "/api/admin/creators/account"
CONTRIBUTION = "/api/admin/creators/contribution"
LAB_ACCESS = "/api/admin/creators/lab-access"
BROKER = "/api/lab-auth/"
BROKER_BEARER = "creator-directory-broker-test-fixture-only"
LAUNCH = r"""
import http.server, json, sys
from pathlib import Path
from storage_paths import initialize_storage
initialize_storage()
import server_huiguan as app

app.init_user_db()
accounts = {}
with app.db() as db:
    for name, role, legal in (("qa_directory_admin","admin",True),
                              ("qa_directory_member","executor",True),
                              ("qa_directory_visitor","executor",True),
                              ("qa_directory_delete","executor",True),
                              ("qa_directory_reconsent","executor",False)):
        uid = db.execute(
            "INSERT INTO local_users(username,pass_hash,nickname,email,role,status) VALUES(?,?,?,?,?,'active')",
            (name, "not-a-real-password-hash", name, f"{name}@example.invalid", role)).lastrowid
        if legal:
            app.legal_consent.record(db, "local", uid, context="account")
        accounts[name] = {"uid": str(uid)}
for entry in accounts.values():
    entry["session"] = app.create_session("local", entry["uid"], "iridescently.cn")
with http.server.ThreadingHTTPServer(("127.0.0.1", 0), app.Handler) as server:
    Path(sys.argv[1]).write_text(json.dumps({"port":server.server_port,"accounts":accounts,"database":str(app.USER_DB)}), encoding="utf-8")
    server.serve_forever()
"""


class CreatorDirectoryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port, cls.accounts, cls.database = cls.launch(broker=True)

    @classmethod
    def launch(cls, *, broker):
        storage = tempfile.TemporaryDirectory(prefix="huiguan-directory-test-")
        cls.addClassCleanup(storage.cleanup)
        state = Path(storage.name) / "test-server.json"
        env = {k: v for k, v in os.environ.items()
               if not k.startswith(("IRIDESCENTLY_", "TURNSTILE_", "USSO_", "LAB_"))}
        env.update(
            IRIDESCENTLY_STORAGE_ROOT=str(Path(storage.name) / "data"),
            IRIDESCENTLY_ENVIRONMENT="test",
            IRIDESCENTLY_CREATORS_ENABLED="1",
            HX_SSO_SECRET="creator-directory-fixture-only-secret",
            PYTHONDONTWRITEBYTECODE="1",
            PYTHONPATH=os.pathsep.join((str(PROJECT / "apps/huiguan"), str(PROJECT / "services/platform"))),
        )
        if broker:
            env.update(IRIDESCENTLY_LAB_ACCOUNT_BROKER_ORIGIN=ORIGIN,
                       IRIDESCENTLY_LAB_ACCOUNT_BROKER_BEARER=BROKER_BEARER)
        proc = subprocess.Popen(
            [sys.executable, "-B", "-c", LAUNCH, str(state)], env=env,
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
        )
        def close():
            if proc.poll() is None:
                proc.terminate()
            proc.communicate(timeout=10)
        cls.addClassCleanup(close)
        for _ in range(120):
            if state.exists():
                try:
                    cfg = json.loads(state.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    pass
                else:
                    return (cfg["port"], {name.removeprefix("qa_directory_"): entry
                                          for name, entry in cfg["accounts"].items()}, cfg["database"])
            if proc.poll() is not None:
                raise RuntimeError(f"isolated fixture did not launch: {proc.stderr.read()}")
            time.sleep(.05)
        raise RuntimeError("isolated fixture startup timed out")

    def request(self, path, who=None, payload=None, csrf=None, origin=ORIGIN, *,
                form=False, service=False, host=HOST):
        headers = {"Host": host}
        if who:
            headers["Cookie"] = "session=" + self.accounts[who]["session"]
        if service:
            headers["Authorization"] = "Bearer " + BROKER_BEARER
        if payload is not None:
            headers["Content-Type"] = "application/x-www-form-urlencoded" if form else "application/json"
            if origin is not None:
                headers["Origin"] = origin
        if csrf is not None:
            headers["X-Creator-CSRF"] = csrf
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=8)
        try:
            body = None if payload is None else urlencode(payload) if form else json.dumps(payload)
            conn.request("GET" if payload is None else "POST", path, body=body, headers=headers)
            response = conn.getresponse()
            body = response.read()
            try:
                value = json.loads(body)
            except ValueError:
                value = body.decode("utf-8", "replace")
            return response.status, value
        finally:
            conn.close()

    def ok(self, path, *args, **kwargs):
        status, data = self.request(path, *args, **kwargs)
        self.assertEqual(status, 200, data)
        return data

    def publish_profile(self, payload, who="member"):
        current = self.ok(ME, who)
        return self.ok(ME, who, {**payload, "publication_version": current["publication_version"]}, current["csrf"])

    def test_identity_and_public_consent_are_separate_and_reversible(self):
        target = {"kind": "local", "uid": self.accounts["member"]["uid"]}
        lookup = ACCOUNT + "?" + urlencode(target)
        self.assertEqual(self.request(ME)[0], 401)
        self.assertEqual(self.request(lookup, "visitor")[0], 403)
        admin = self.ok(lookup, "admin")
        owner = self.ok(ME, "member")
        self.assertFalse(owner["profile"]["public_profile"])
        self.assertFalse(owner["profile"]["public_contributions"])
        self.assertIsNone(owner["membership"])
        self.assertFalse(admin["lab_access"])
        profile = {
            "display_name": "Synthetic lily designer", "bio": "Synthetic test biography.",
            "public_profile": True, "public_avatar": False, "public_links": False,
            "public_contributions": False, "links": [{"label":"Fixture", "url":"https://example.invalid/work"}],
        }
        membership = {**target, "creator_kind": "resident_creator",
                      "assignments": [{"group":"Art", "duty":"Scene sketches"}],
                      "joined_on":"2026-11-01", "current_work":"Lily concept"}
        self.assertEqual(self.request(ME, "member", profile)[0], 403)
        self.assertEqual(self.request(ME, "member", profile, owner["csrf"], origin=None)[0], 403)
        self.assertEqual(self.request(ACCOUNT, "visitor", membership, self.ok(ME, "visitor")["csrf"])[0], 403)
        self.ok(ACCOUNT, "admin", membership, admin["csrf"])
        self.assertFalse(self.ok(lookup, "admin")["lab_access"], "creator status must not automatically grant LAB")
        self.assertEqual(self.ok(DIRECTORY), {"members": [], "credits": []}, "assignment is not consent")

        self.publish_profile(profile)
        visible = self.ok(DIRECTORY)
        self.assertEqual(len(visible["members"]), 1)
        public = visible["members"][0]
        self.assertEqual(public["display_name"], profile["display_name"])
        self.assertEqual(public["creator_kind"], "resident_creator")
        self.assertFalse(public.get("avatar_url"))
        self.assertFalse(public.get("links"))
        self.assertFalse(public.get("contributions"))
        wire = json.dumps(visible)
        for private in ("qa_directory_member", "@example.invalid", '"uid"', '"password"', '"csrf"', '"lab_access"'):
            self.assertNotIn(private, wire)

        contribution = {**target, "title":"Lily concept sheet", "summary":"First sketch",
                        "url":"https://example.invalid/lily", "completed_on":"2026-11-11", "approved":True}
        approved = self.ok(CONTRIBUTION, "admin", contribution, admin["csrf"])
        self.ok(CONTRIBUTION, "admin", {**contribution, "title":"Unreviewed concept", "approved":False}, admin["csrf"])
        self.assertFalse(self.ok(DIRECTORY)["members"][0].get("contributions"))
        public_credits = {**profile, "public_contributions": True}
        self.publish_profile(public_credits)
        public = self.ok(DIRECTORY)["members"][0]
        self.assertEqual([row["title"] for row in public["contributions"]], ["Lily concept sheet"])
        self.assertFalse(public["contributions"][0].get("url"))
        public_links = {**public_credits, "public_links": True}
        self.publish_profile(public_links)
        public = self.ok(DIRECTORY)["members"][0]
        self.assertEqual(public["links"], profile["links"])
        self.assertEqual(public["contributions"][0]["url"], contribution["url"])

        pre_edit = self.ok(ME, "member")["publication_version"]
        self.ok(CONTRIBUTION, "admin", {**contribution, "id": approved["id"], "summary": "Revised sketch"}, admin["csrf"])
        self.assertFalse(self.ok(ME, "member")["profile"]["public_contributions"])
        self.assertFalse(self.ok(DIRECTORY)["members"][0]["contributions"])
        self.assertEqual(self.request(ME, "member", {**public_links, "publication_version": pre_edit}, owner["csrf"])[0], 409)
        self.publish_profile(public_links)
        self.ok(CONTRIBUTION, "admin", {**contribution, "title": "New approved sketch"}, admin["csrf"])
        self.assertFalse(self.ok(ME, "member")["profile"]["public_contributions"])
        self.assertFalse(self.ok(DIRECTORY)["members"][0]["contributions"])

        update = {**membership, "creator_kind": "guest_creator", "current_work": "River concept"}
        prior_version = self.ok(ME, "member")["publication_version"]
        self.ok(ACCOUNT, "admin", update, admin["csrf"])
        self.assertEqual(self.ok(DIRECTORY), {"members": [], "credits": []})
        private = self.ok(ME, "member")
        self.assertFalse(private["profile"]["public_profile"])
        self.assertEqual(private["membership"]["creator_kind"], "guest_creator")
        self.assertEqual(self.request(ME, "member", public_credits, owner["csrf"])[0], 409)
        stale = {**public_credits, "publication_version": prior_version}
        self.assertEqual(self.request(ME, "member", stale, owner["csrf"])[0], 409)
        self.publish_profile(public_credits)
        self.assertEqual(self.ok(DIRECTORY)["members"][0]["creator_kind"], "guest_creator")
        self.ok(ACCOUNT, "admin", {**update, "creator_kind": None}, admin["csrf"])
        historical = self.ok(DIRECTORY)
        self.assertEqual(historical["members"], [])
        self.assertEqual({row["title"] for row in historical["credits"]}, {"Lily concept sheet", "New approved sketch"})
        self.assertFalse(any(row.get("url") for row in historical["credits"]))
        self.assertIsNone(self.ok(ME, "member")["membership"])
        kept = self.ok(lookup, "admin")["contributions"]
        self.assertEqual({row["title"] for row in kept if row["approved"]}, {"Lily concept sheet", "New approved sketch"})
        self.publish_profile({**profile, "public_profile": False})
        self.assertEqual(self.ok(DIRECTORY), {"members": [], "credits": []})

        self.ok(ACCOUNT, "admin", membership, admin["csrf"])
        self.publish_profile(profile)
        public = self.ok(DIRECTORY)["members"][0]
        self.assertFalse(public.get("links"))
        self.assertFalse(public.get("contributions"))
        self.publish_profile({**profile, "public_profile": False})
        self.assertEqual(self.ok(DIRECTORY), {"members": [], "credits": []})
        self.assertEqual(self.ok(ME, "member")["membership"]["creator_kind"], "resident_creator")

        external = {"display_name": "Synthetic guest maker", "title": "Shared prop",
                    "summary": "Independent contribution", "url": "https://example.invalid/prop",
                    "completed_on": "2026-11-12", "approved": True, "public_consent": False}
        item = self.ok(CONTRIBUTION, "admin", external, admin["csrf"])
        self.assertEqual(self.ok(DIRECTORY)["credits"], [])
        self.ok(CONTRIBUTION, "admin", {**external, "id": item["id"], "public_consent": True}, admin["csrf"])
        self.assertEqual([credit["display_name"] for credit in self.ok(DIRECTORY)["credits"]],
                         [external["display_name"]])
        self.ok(CONTRIBUTION, "admin", {**external, "id": item["id"]}, admin["csrf"])
        self.assertEqual(self.ok(DIRECTORY)["credits"], [])

    def test_lab_access_and_approval_use_separate_privilege_and_current_legal_consent(self):
        def entitlement(who, enabled):
            target = {"kind": "local", "uid": self.accounts[who]["uid"]}
            lookup = ACCOUNT + "?" + urlencode(target)
            admin = self.ok(lookup, "admin")
            changed = self.ok(LAB_ACCESS, "admin", {**target, "enabled": enabled}, admin["csrf"])
            self.assertIs(changed["lab_access"], enabled)
            state = self.ok(lookup, "admin")
            self.assertIs(state["lab_access"], enabled)
            self.assertIsNone(state["membership"])

        def begin():
            verifier = secrets.token_urlsafe(32)
            challenge = urlsafe_b64encode(sha256(verifier.encode("ascii")).digest()).decode().rstrip("=")
            started = self.ok(BROKER + "start", payload={"challenge": challenge}, service=True)
            return started, verifier

        def approve(started, who):
            page = self.ok(started["approval_path"], who)
            csrf = re.search(r'name="csrf" value="([A-Za-z0-9_-]+)"', page)
            self.assertIsNotNone(csrf)
            return self.request(BROKER + "approve", who, form=True, payload={
                "request_id": started["request_id"], "csrf": csrf.group(1),
                "match_code": started["match_code"], "decision": "approve",
            })[0]

        entitlement("reconsent", True)
        pending, _ = begin()
        self.assertEqual(approve(pending, "reconsent"), 403)
        entitlement("reconsent", False)

        entitlement("visitor", True)
        started, verifier = begin()
        self.assertEqual(self.request(started["approval_path"], "visitor", host="huiguan.iridescently.xyz")[0], 503)
        self.assertEqual(approve(started, "visitor"), 200)
        state = {key: started[key] for key in ("request_id", "state")}
        polled = self.ok(BROKER + "poll", payload=state, service=True)
        self.assertEqual(polled["status"], "approved")
        grant = self.ok(BROKER + "redeem", payload={**state, "code": polled["code"], "verifier": verifier}, service=True)
        opaque = {key: grant[key] for key in ("sub", "grant")}
        self.assertTrue(self.ok(BROKER + "introspect", payload=opaque, service=True)["active"])
        entitlement("visitor", False)
        self.assertFalse(self.ok(BROKER + "introspect", payload=opaque, service=True)["active"])

    def test_directory_remains_available_with_broker_disabled(self):
        self.port, self.accounts, self.database = self.launch(broker=False)
        self.assertEqual(self.ok(DIRECTORY), {"members": [], "credits": []})
        self.assertEqual(self.ok("/api/legal", "member")["is_accepted"], True)
        target = {"kind": "local", "uid": self.accounts["member"]["uid"]}
        admin = self.ok(ACCOUNT + "?" + urlencode(target), "admin")
        self.assertFalse(admin["lab_access"])
        self.assertEqual(self.request(LAB_ACCESS, "admin", {**target, "enabled": True}, admin["csrf"])[0], 503)
        self.assertEqual(self.request(BROKER + "start", payload={"challenge": "a" * 43}, service=True)[0], 503)

    def test_deleting_synthetic_account_withdraws_public_directory_and_access(self):
        target = {"kind": "local", "uid": self.accounts["delete"]["uid"]}
        lookup = ACCOUNT + "?" + urlencode(target)
        admin = self.ok(lookup, "admin")
        self.ok(ACCOUNT, "admin", {**target, "creator_kind":"guest_creator"}, admin["csrf"])
        self.ok(LAB_ACCESS, "admin", {**target, "enabled":True}, admin["csrf"])
        item = {**target, "title":"Synthetic deletion fixture sketch", "approved":True}
        self.ok(CONTRIBUTION, "admin", item, admin["csrf"])
        display = "Temporary deletion test profile"
        self.publish_profile({"display_name":display, "public_profile":True, "public_avatar":True,
                              "public_links":True, "public_contributions":True}, "delete")
        self.assertTrue(any(row["display_name"] == display for row in self.ok(DIRECTORY)["members"]))
        self.ok("/api/admin/user/delete", "admin", target)
        self.assertNotIn(display, json.dumps(self.ok(DIRECTORY)))
        self.assertEqual(self.request(ME, "delete")[0], 401)
        db = sqlite3.connect(self.database)
        self.addCleanup(db.close)
        profile_flags = db.execute("""SELECT public_profile,public_avatar,public_links,public_contributions
                                     FROM creator_profiles WHERE kind='local' AND uid=?""", (target["uid"],)).fetchone()
        self.assertEqual(profile_flags, (0,0,0,0))
        membership = db.execute("SELECT creator_kind FROM creator_memberships WHERE kind='local' AND uid=?",
                                (target["uid"],)).fetchone()
        self.assertEqual(membership, (None,))
        enabled = db.execute("SELECT enabled FROM lab_auth_access WHERE kind='local' AND uid=?",
                             (target["uid"],)).fetchone()
        self.assertEqual(enabled, (0,))


if __name__ == "__main__":
    unittest.main()
