"""Real two-client loopback check of east-bank compatibility; never uses the live DB."""
import json
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from lab.world import Geometry
from test_gateway import ws, recv_until

def seed(g, cid, pid, x, z):
    with closing(sqlite3.connect(g.tmp / "runtime/data/lab.sqlite", isolation_level=None)) as db:
        db.execute("INSERT INTO players(code_id,pid,nickname,space,x,z,updated_at) VALUES(?,?,?,?,?,?,?)",
                   (cid,pid,pid,"hall",x,z,time.time()))

def open_player(g,c,east=None):
    s=ws(g,c)
    hello={"t":"hello","client":"2d","version":"footbridge-regression"}
    if east is not None:hello["east_bank"]=east
    s.send(json.dumps(hello))
    return s,recv_until(s,"welcome")

def move(s,x,z,seq):
    s.send(json.dumps({"t":"move","x":x,"z":z,"anim":"walk","seq":seq}))

def test_deck_rules():
    root=Path(__file__).resolve().parents[2]
    d=json.loads((root/"client/data/spaces.json").read_bytes())
    h=Geometry(d["templates"]["hall"],d["player"])
    assert h.segment_free(31.9,10,39,10) and h.segment_free(39,10,31.9,10)
    assert not h.segment_free(31.9,8,39,8) and not h.segment_free(39,12,31.9,12)
    assert h.free(32.5,9) and not h.free(32.5,11)
    assert not h.free(47,10) and not h.free(41.5,14)
    assert h.free(36.6,8) and h.free(36.6,12)
    initial=Geometry(d["templates"]["initial"],d["player"])
    lingzhi=Geometry(d["templates"]["lingzhi"],d["player"])
    assert initial.crossing is None and lingzhi.crossing is None

def test_multiplayer_bridge_and_legacy_reconnect(gateway):
    g=gateway
    a,ac=g.new_code(); b,bc=g.new_code()
    seed(g,a,"walker",31.9,10); seed(g,b,"older",40,10)
    aa,bb=g.login(ac),g.login(bc)
    with closing(aa), closing(bb):
        s1,w1=open_player(g,aa,True)
        s2,w2=open_player(g,bb)
        with closing(s1),closing(s2):
            assert [w1["you"][k] for k in ("x","z")]==[31.9,10]
            assert [w2["you"][k] for k in ("x","z")]==[32,10]
            assert next(x for x in w2["players"] if x["pid"]=="walker")["x"]==31.9
            move(s2,32.1,10,101)
            assert recv_until(s2,"correct",pred=lambda m:m["seq"]==101)["reason"]=="blocked"
            seq=0
            for i in range(1,21):
                seq+=1
                time.sleep(.075)
                move(s1,round(31.9+i*.35,3),10,seq)
            final=recv_until(s2,"s",pred=lambda m:any(r[0]=="walker" and r[1]>=38.9 for r in m["p"]))
            assert any(r[0]=="walker" and r[1]==38.9 and r[2]==10 for r in final["p"])
            for i in range(1,21):
                seq+=1
                time.sleep(.075)
                move(s1,round(38.9-i*.35,3),10,seq)
            assert any(r[0]=="walker" and r[1]==31.9 for r in recv_until(s2,"s",pred=lambda m:any(r[0]=="walker" and r[1]==31.9 for r in m["p"]))["p"])

def test_water_rejected_at_same_valid_speed(gateway):
    cid,code=gateway.new_code()
    seed(gateway,cid,"bank",32.49,8)
    with closing(gateway.login(code)) as c:
        s,w=open_player(gateway,c,True)
        with closing(s):
            assert w["you"]["x"]==32.49
            move(s,32.6,8,1)
            m=recv_until(s,"correct",pred=lambda m:m["seq"]==1)
            assert (m["x"],m["z"],m["reason"])==(32.49,8,"blocked")
