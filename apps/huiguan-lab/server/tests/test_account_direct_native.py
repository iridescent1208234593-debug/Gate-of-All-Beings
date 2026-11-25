"""Native LAB login coverage using the real Hall and LAB APIs in isolated storage."""
from hashlib import sha256
from urllib.parse import urlsplit,parse_qs,urlencode
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
import test_account_direct_hall_e2e as e2e
from test_account_direct_hall_e2e import hall
from lab.app import create_app
from lab.auth import SESSION_COOKIE
from lab.account_direct_web import START
from lab.account_direct_native import START as ENTRY,REDEEM,AVAILABLE,encode,Native,TRANSFER_SECONDS,ANDROID_ASSETLINKS,ANDROID_PATH
from lab import r4bridge


@pytest.fixture(autouse=True)
def loopback_r4_clients(monkeypatch):
    """Keep the independent R4 fixture off the host proxy."""
    real = r4bridge.httpx

    class LoopbackHTTP:
        def __getattr__(self, name):
            return getattr(real, name)

        def AsyncClient(self, *args, **kwargs):
            assert kwargs["base_url"].startswith("http://127.0.0.1:")
            return real.AsyncClient(*args, **(kwargs | {"trust_env": False}))

    monkeypatch.setattr(r4bridge, "httpx", LoopbackHTTP())


class NativeGateway(e2e.HallAndGateway):
    def native_prepare(self, who="member"):
        verifier=encode(b"v"*32)
        state=encode(b"s"*32)
        params={"port":53001,"state":state,"challenge":encode(sha256(verifier.encode()).digest())}
        self.assertEqual(self.client.get(AVAILABLE).json(),{"enabled":True,"methods":["windows_loopback"]})
        self.assertEqual(self.client.get(ENTRY,params=params).status_code,200)
        self.assertEqual(self.client.get(ENTRY,params=params|{"port":18300}).status_code,400)
        self.assertEqual(self.client.get(ENTRY,params=params|{"redirect":"https://example.invalid/"}).status_code,400)
        r=self.client.post(START,json={"intent":"login","native":params},headers={"Origin":self.origin})
        self.assertEqual(r.status_code,200)
        p=urlsplit(r.json()["authorization_url"])
        rid=parse_qs(p.query)["request_id"][0]
        proof=self.confirm(p.path,self.form(p.path,rid,who),who)
        finished=self.finish(proof)
        self.assertEqual(finished.status_code,200)
        self.assertNotIn(SESSION_COOKIE,finished.cookies)
        self.assertEqual(self.client.get("/api/me").status_code,401)
        callback=urlsplit(finished.json()["native_callback"])
        self.assertEqual((callback.scheme,callback.hostname,callback.port,callback.path),("http","127.0.0.1",53001,"/lab-account/callback"))
        q=parse_qs(callback.query)
        self.assertEqual(q["state"],[state])
        self.assertEqual(len(q["code"][0]),43)
        self.assertEqual(self.finish(proof).status_code,403)
        return {"code":q["code"][0],"state":state,"verifier":verifier}
    def enable(self):
        self.assertEqual(self.client.get(AVAILABLE).json(),{"enabled":False,"methods":[]})
        self.assertEqual(self.client.get(ENTRY).status_code,404)
        self.lab.cfg.account_direct_native_enabled=True
        self.client=TestClient(create_app(self.lab),base_url=self.origin)
        self.addCleanup(self.client.close)
    def test_native_login(self):
        self.enable()
        body=self.native_prepare()
        n=TestClient(create_app(self.lab),base_url=self.origin)  # independent app misses memory; actual game must use same gateway process
        self.addCleanup(n.close)
        self.assertEqual(n.post(REDEEM,json=body).status_code,403)
        self.assertEqual(self.client.post(REDEEM,json=body|{"verifier":encode(b"x"*32)}).status_code,403)
        self.assertEqual(self.client.post(REDEEM,json=body|{"state":encode(b"x"*32)}).status_code,403)
        self.assertEqual(self.client.post(REDEEM,json=body,headers={"Origin":self.origin}).status_code,403)
        accepted=self.client.post(REDEEM,json=body)
        self.assertEqual(accepted.status_code,200,accepted.text)
        self.assertIn(accepted.json()["next"],("/play/","/admission"))
        self.assertNotIn("token",accepted.json())
        header=accepted.headers["Set-Cookie"].lower()
        for marker in ("zszm_lab_session=", "secure","httponly","samesite=strict"): self.assertIn(marker,header)
        self.assertEqual(self.client.get("/api/me").json()["role"],"player")
        self.assertEqual(self.client.post(REDEEM,json=body).status_code,403)
        token=self.client.cookies.get(SESSION_COOKIE)
        self.assertEqual(self.client.post("/api/logout").status_code,200)
        self.assertIsNone(self.lab.auth.session(token))
    def test_native_expiry_before_gateway_session(self):
        self.enable()
        ticks=[100.]
        orig=Native.__init__
        def init(self,lab,broker,**kw):orig(self,lab,broker,clock=lambda:ticks[0])
        with patch.object(Native,"__init__",init):
            self.client=TestClient(create_app(self.lab),base_url=self.origin)
        self.addCleanup(self.client.close)
        body=self.native_prepare()
        ticks[0]+=TRANSFER_SECONDS
        self.assertEqual(self.client.post(REDEEM,json=body).status_code,403)
        self.assertEqual(self.client.get("/api/me").status_code,401)
    def test_native_revoked_before_transfer(self):
        self.enable()
        facade=type("Fixture",(),{})()
        facade.port,facade.accounts=self.port,self.accounts
        facade.request=hall.CreatorDirectoryTest.request.__get__(facade)
        facade.assertEqual=self.assertEqual
        ok=hall.CreatorDirectoryTest.ok.__get__(facade)
        who={"kind":"local","uid":self.accounts["visitor"]["uid"]}
        def set_access(enabled):
            current = ok(hall.ACCOUNT + "?" + urlencode(who), "admin")
            ok(hall.LAB_ACCESS, "admin", who | {"enabled": enabled}, current["csrf"])
        set_access(True)
        self.addCleanup(set_access, False)
        body = self.native_prepare("visitor")
        set_access(False)
        self.assertEqual(self.client.post(REDEEM,json=body).status_code,403)
        self.assertEqual(self.client.get("/api/me").status_code,401)

    def test_android_app_link(self):
        self.assertEqual(self.client.get(AVAILABLE).json(), {"enabled":False,"methods":[]})
        self.assertEqual(self.client.get(ANDROID_ASSETLINKS).status_code, 404)
        self.assertEqual(self.client.get(ANDROID_PATH).status_code, 404)
        self.lab.cfg.account_direct_native_enabled = True
        off = TestClient(create_app(self.lab), base_url=self.origin)
        self.addCleanup(off.close)
        state, verifier = encode(b"a"*32), encode(b"v"*32)
        payload = {"method":"android_app_link", "state":state, "challenge":encode(sha256(verifier.encode()).digest())}
        self.assertEqual(off.get(AVAILABLE).json()["methods"], ["windows_loopback"])
        self.assertEqual(off.get(ENTRY, params=payload).status_code, 400)
        self.assertEqual(off.get(ANDROID_ASSETLINKS).status_code, 404)
        self.lab.cfg.account_direct_native_android_enabled = True
        self.client = TestClient(create_app(self.lab), base_url=self.origin)
        self.addCleanup(self.client.close)
        self.assertEqual(self.client.get(AVAILABLE).json()["methods"], ["windows_loopback", "android_app_link"])
        document = self.client.get(ANDROID_ASSETLINKS)
        self.assertEqual(document.status_code, 200)
        self.assertEqual(document.headers["content-type"], "application/json")
        self.assertEqual(document.json(), [{
            "relation": ["delegate_permission/common.handle_all_urls"],
            "target": {
                "namespace": "android_app",
                "package_name": "cn.iridescently.huiguan.lab.public",
                "sha256_cert_fingerprints": [
                    "57:78:FE:88:F6:09:61:66:D3:30:87:85:2E:3C:86:98:42:19:52:FB:8D:C9:5D:D1:C9:6F:14:C0:EF:51:61:92"
                ],
            },
        }])
        self.assertEqual(self.client.get(ANDROID_ASSETLINKS + "?scope=bad").status_code, 404)
        self.assertEqual(self.client.get(ENTRY, params=payload | {"redirect":"/other"}).status_code, 400)
        self.assertEqual(self.client.get(ENTRY, params=payload | {"port":"53001"}).status_code, 400)
        self.assertEqual(self.client.get(ENTRY, params=list(payload.items())+[("state",state)]).status_code, 400)
        self.assertIn("Android LAB Login", self.client.get(ENTRY, params=payload).text)
        prepared = self.client.post(START, json={"intent":"login","native":payload}, headers={"Origin":self.origin})
        self.assertEqual(prepared.status_code, 200, prepared.text)
        link = urlsplit(prepared.json()["authorization_url"])
        proof = self.confirm(link.path, self.form(link.path, parse_qs(link.query)["request_id"][0], "member"), "member")
        finished = self.finish(proof)
        self.assertEqual(finished.status_code, 200, finished.text)
        self.assertNotIn(SESSION_COOKIE, finished.cookies)
        callback = urlsplit(finished.json()["native_callback"])
        self.assertEqual((callback.scheme,callback.netloc,callback.path,callback.query),
                         ("https","pc-lab.iridescently.cn",ANDROID_PATH,""))
        grant = parse_qs(callback.fragment)
        self.assertEqual(grant["state"], [state])
        page = self.client.get(ANDROID_PATH)
        for key in grant:
            self.assertNotIn(grant[key][0], page.text)
        self.assertEqual(page.headers["referrer-policy"], "no-referrer")
        self.assertEqual(page.headers["cache-control"], "no-store")
        body = {"code":grant["code"][0],"state":state,"verifier":verifier}
        self.assertEqual(self.client.post(REDEEM,json=body|{"verifier":encode(b"x"*32)}).status_code,403)
        accepted = self.client.post(REDEEM,json=body)
        self.assertEqual(accepted.status_code,200,accepted.text)
        self.assertIn(SESSION_COOKIE, accepted.cookies)
        self.assertEqual(self.client.post(REDEEM,json=body).status_code,403)
