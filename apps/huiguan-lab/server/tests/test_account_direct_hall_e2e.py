"""Actual Hall Handler + actual LAB ASGI gateway; synthetic accounts on loopback."""
import asyncio
import http.client
import importlib.util
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit
import re
from secrets import token_urlsafe
import tempfile
import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from lab.admission import Admission

from lab.account_broker import Denied
from lab.account_direct_web import CALLBACK, FINISH, START
from lab.auth import SESSION_COOKIE
from lab.app import create_app
from test_account_broker import make_lab
spec = importlib.util.spec_from_file_location(
    "hall_creator_fixture", Path(__file__).resolve().parents[4] / "apps/huiguan/tests/test_creator_directory.py")
hall = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hall)


class HallAndGateway(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port, cls.accounts, cls.database = hall.CreatorDirectoryTest.launch.__func__(
            cls, broker=True, direct_web=True, direct_all=True)
        cls.closed_port, _, _ = hall.CreatorDirectoryTest.launch.__func__(
            cls, broker=True, direct_web=False, direct_all=False)

    def setenv(self,key,val):
        os.environ[key] = val

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        env = patch.dict(os.environ,{})
        env.start()
        self.addCleanup(env.stop)
        self.lab = make_lab(Path(tmp.name), self)
        self.addCleanup(self.lab.store.close)
        self.lab.cfg.account_direct_web_enabled = True
        self.lab.account.issuer = hall.ORIGIN
        self.origin = "https://" + self.lab.cfg.public_host
        self.lab.account.request = self.gateway_service
        self.client = TestClient(create_app(self.lab), base_url=self.origin)
        self.addCleanup(self.client.close)

    def request(self, method, path, payload=None, *, form=False, who=None, service=False, origin=None, port=None):
        headers = {"Host": hall.HOST}
        if who:
            headers["Cookie"] = "session=" + self.accounts[who]["session"]
        if service:
            headers["Authorization"] = "Bearer " + hall.BROKER_BEARER
        if origin:
            headers["Origin"] = origin
        if payload is not None:
            headers["Content-Type"] = "application/x-www-form-urlencoded" if form else "application/json"
        wire = None if payload is None else urlencode(payload) if form else json.dumps(payload)
        conn = http.client.HTTPConnection("127.0.0.1", port or self.port, timeout=5)
        try:
            conn.request(method,path,wire,headers)
            reply = conn.getresponse()
            body = reply.read().decode()
            return reply.status, dict(reply.getheaders()), body
        finally:
            conn.close()

    async def gateway_service(self, name, **body):
        status, _, result = self.request("POST", "/api/lab-auth/"+name, body, service=True)
        if status != 200:
            raise Denied
        return json.loads(result)

    def start(self, intent):
        r = self.client.post(START, headers={"Origin":self.origin}, json={"intent":intent})
        self.assertEqual(r.status_code,200)
        p = urlsplit(r.json()["authorization_url"])
        self.assertEqual(p.netloc,hall.HOST)
        return p.path, parse_qs(p.query)["request_id"][0]

    def form(self, path, rid, who):
        status, headers, body = self.request("GET", path + "?request_id=" + rid, who=who)
        self.assertEqual(status, 200)
        self.assertIn("no-store", headers["Cache-Control"])
        directive = next(x.strip() for x in headers["Content-Security-Policy"].split(";")
                         if x.strip().startswith("form-action "))
        callback = self.origin + CALLBACK
        if path.endswith("/direct/approve"):
            self.assertEqual(directive, "form-action 'self' " + callback)
            self.assertEqual(headers["Referrer-Policy"], "same-origin")
        else:
            self.assertEqual(directive, "form-action 'self'")
        csrf = re.search('name="csrf" value="([^"]+)"',body)[1]
        self.assertIn("当前会馆账户", body)
        return {"request_id":rid,"csrf":csrf,"decision":"approve"}

    def confirm(self, path, form, who):
        status, headers, body = self.request("POST", path, form, who=who, origin=hall.ORIGIN, form=True)
        self.assertEqual(status, 303, body)
        self.assertEqual(headers["Referrer-Policy"],"no-referrer")
        redirect = urlsplit(headers["Location"])
        self.assertEqual(redirect.path, CALLBACK)
        self.assertFalse(redirect.query)
        return {k:v[0] for k,v in parse_qs(redirect.fragment).items()}

    def finish(self, proof):
        return self.client.post(FINISH, headers={"Origin":self.origin}, json=proof)

    def test_direct_broad_normal_player_bind_restore_and_reject_revoked_lease(self):
        old_cid, code = self.lab.auth.create_code()
        old_pid = self.lab.hub.player_record(old_cid)["pid"]
        old_digest = self.lab.store.one("SELECT digest FROM codes WHERE id=?",(old_cid,))[0]
        self.lab.account.migratable = frozenset({old_cid})
        self.assertEqual(self.client.post("/api/login",json={"code":code}).status_code,200)
        path, rid = self.start("restore")
        self.assertEqual(self.request("GET",path+"?request_id="+rid)[0],401)
        fields = self.form(path,rid,"visitor")
        self.assertEqual(self.request("POST",path,fields,who="member",origin=hall.ORIGIN,form=True)[0],403)
        proof = self.confirm(path,fields,"visitor")
        self.assertEqual(self.request("POST",path,fields,who="visitor",origin=hall.ORIGIN,form=True)[0],410)
        self.assertEqual(self.client.get(CALLBACK).status_code,200)
        self.assertEqual(self.finish(proof).status_code,200)
        self.assertEqual(self.client.get("/api/me").json()["role"],"player")
        self.assertEqual(self.lab.hub.player_record(old_cid)["pid"],old_pid)
        self.assertEqual(self.lab.store.one("SELECT digest FROM codes WHERE id=?",(old_cid,))[0],old_digest)
        self.assertEqual(self.finish(proof).status_code,403)
        token=self.client.cookies.get(SESSION_COOKIE)
        grant=next(iter(self.lab.account.grants.values()))
        self.assertEqual(grant.service_prefix,"direct/")
        asyncio.run(self.lab.account.refresh(grant))
        self.assertIsNotNone(self.lab.auth.session(token))
        facade = type("HallFixtureRequest", (), {})()
        facade.port,facade.accounts = self.port,self.accounts
        facade.request = hall.CreatorDirectoryTest.request.__get__(facade)
        facade.assertEqual = self.assertEqual
        fixture = hall.CreatorDirectoryTest.ok.__get__(facade)
        who={"kind":"local","uid":self.accounts["visitor"]["uid"]}
        admin=fixture(hall.ACCOUNT+"?"+urlencode(who),"admin")
        fixture(hall.LAB_ACCESS,"admin",who|{"enabled":False},admin["csrf"])
        asyncio.run(self.lab.account.refresh(grant))
        self.assertIsNone(self.lab.auth.session(token))

    def test_composed_legacy_and_direct_join_same_cap_without_gameplay_bypass(self):
        self.lab.admission=Admission(1,5,self.lab.auth,legacy_players=True)
        rebuilt=TestClient(create_app(self.lab),base_url=self.origin)
        self.addCleanup(rebuilt.close)
        self.client=rebuilt
        older=TestClient(rebuilt.app,base_url=self.origin)
        self.addCleanup(older.close)
        old_id,old_code=self.lab.auth.create_code()
        old_pid=self.lab.hub.player_record(old_id)["pid"]
        old_digest=self.lab.store.one("SELECT digest FROM codes WHERE id=?",(old_id,))[0]
        assert older.post("/api/login",json={"code":old_code}).status_code==200
        assert older.post("/api/admission",headers={"Origin":self.origin},json={}).json()["state"]=="ready"
        assert older.get("/admission").text.find('data-mode="legacy"')>=0
        path,rid=self.start("login")
        auth=self.finish(self.confirm(path,self.form(path,rid,"member"),"member"))
        assert auth.status_code==200 and auth.json()["next"]=="/admission"
        assert self.client.get("/api/me").status_code==200  # logged in is not admitted
        assert self.client.get("/admission").text.find('data-mode="hall"')>=0
        blocked=self.client.get("/play/",follow_redirects=False)
        assert blocked.status_code==303 and blocked.headers["location"]=="/admission"
        assert self.client.get("/play/index.pck",follow_redirects=False).status_code==409
        ordinary=self.client.post("/api/admission",headers={"Origin":self.origin},json={})
        assert ordinary.json()=={"state":"queued","position":1,"retry_after":3}
        reuse=self.client.post("/api/admission",headers={"Origin":self.origin},json={"priority_code":old_code})
        assert reuse.status_code==400 and reuse.json()["error"]=="priority_unavailable"
        assert self.lab.store.one("SELECT count(*) FROM admission_priority_claims")[0]==0
        with self.client.websocket_connect(self.origin.replace("https:","wss:")+"/ws", headers={"Origin":self.origin, "Cookie":SESSION_COOKIE+"="+self.client.cookies.get(SESSION_COOKIE)}) as ws:
            status=ws.receive_json()
            assert status.get("t")=="admission" and status.get("state")=="queued"
            with self.assertRaises(WebSocketDisconnect) as closed:
                ws.receive_json()
            self.assertEqual(closed.exception.code,4429)
        assert not self.lab.hub.conns
        assert older.delete("/api/admission",headers={"Origin":self.origin}).json()["state"]=="idle"
        assert self.client.get("/api/admission").json()["state"]=="ready"
        assert self.lab.hub.player_record(old_id)["pid"]==old_pid
        assert self.lab.store.one("SELECT digest FROM codes WHERE id=?",(old_id,))[0]==old_digest
        assert older.get("/api/me").status_code==200
        assert self.lab.store.one("SELECT 1 FROM account_links WHERE code_id=?",(old_id,)) is None

    def test_staff_can_use_ordinary_queue_without_priority_or_bypass(self):
        self.lab.admission=Admission(1,5,self.lab.auth,legacy_players=True)
        staff=TestClient(create_app(self.lab),base_url=self.origin)
        self.addCleanup(staff.close)
        _,staff_code=self.lab.auth.create_code(role="art")
        _,priority_code=self.lab.auth.create_code(role="player")
        assert staff.post("/api/login",json={"code":staff_code}).status_code==200
        assert 'data-mode="staff"' in staff.get("/admission").text
        assert staff.get("/api/admission").json()["state"]=="idle"
        headers={"Origin":self.origin}
        rejected=staff.post("/api/admission",headers=headers,json={"priority_code":priority_code})
        assert rejected.status_code==400 and rejected.json()["error"]=="priority_unavailable"
        assert self.lab.store.one("SELECT count(*) FROM admission_priority_claims")[0]==0
        assert staff.post("/api/admission",headers=headers,json={}).json()["state"]=="ready"
        assert staff.delete("/api/admission",headers=headers).json()["state"]=="idle"

    def test_bad_redirect_and_missing_service_secret_and_default_off(self):
        body={"client_id":"lab-web","redirect_uri":"https://site.invalid/account/direct/callback",
              "intent":"login","state":token_urlsafe(32),"code_challenge":token_urlsafe(32),
              "code_challenge_method":"S256"}
        path="/api/lab-auth/direct/start"
        self.assertEqual(self.request("POST",path,body)[0],401)
        self.assertEqual(self.request("POST",path,body,service=True)[0],400)
        self.assertEqual(self.request("POST",path,body,service=True,port=self.closed_port)[0],404)

    def test_no_restore_login_and_explicit_denial_keep_legacy_policy_separate(self):
        path,rid=self.start("login")
        self.assertEqual(self.request("GET",path+"?request_id="+rid,who="reconsent")[0],403)
        fields=self.form(path,rid,"member")
        self.assertEqual(self.finish(self.confirm(path,fields,"member")).status_code,200)
        self.assertEqual(self.client.get("/api/me").json()["role"],"player")
        path,rid=self.start("login")
        fields=self.form(path,rid,"member")
        status,headers,_=self.request("POST",path,fields|{"decision":"deny"},who="member",origin=hall.ORIGIN,form=True)
        self.assertEqual(status,303)
        self.assertFalse(urlsplit(headers["Location"]).fragment)
        legacy=json.loads(self.request("POST",hall.BROKER+"start",{"challenge":token_urlsafe(32)},service=True)[2])
        fields=self.form(legacy["approval_path"].split("?")[0],legacy["request_id"],"member")
        self.assertEqual(self.request("POST",legacy["approval_path"].split("?")[0],
                      fields|{"match_code":legacy["match_code"]},who="member",origin=hall.ORIGIN,form=True)[0],403)

if __name__ == "__main__":
    unittest.main()
