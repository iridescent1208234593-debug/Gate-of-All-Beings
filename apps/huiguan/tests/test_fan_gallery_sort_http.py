"""Run as a separate process: python -B this_file.py. Synthetic loopback only."""
from contextlib import closing
from pathlib import Path
import json
import http.client
import os
import sys
import tempfile
import threading
import time


def run():
 root = Path(__file__).resolve().parents[3]
 with tempfile.TemporaryDirectory(prefix='gallery-history-http-fixture-') as d:
  for k in list(os.environ):
   if k.startswith(('IRIDESCENTLY_','LAB_','USSO_','HX_','TURNSTILE_')): os.environ.pop(k)
  os.environ.update(IRIDESCENTLY_STORAGE_ROOT=str(Path(d)/'synthetic-storage'), IRIDESCENTLY_ENVIRONMENT='test')
  sys.path[:0]=[str(root/'apps/huiguan'),str(root/'services/platform')]
  from storage_paths import initialize_storage
  initialize_storage()
  import server_huiguan as s
  from site_domains import SITE_DOMAIN, site_url
  origin = site_url('huiguan')
  with closing(s.db()) as db,db:
   ids={}
   for label,role in (('owner','executor'),('admin','admin')):
    ident=db.execute("INSERT INTO local_users(username,nickname,pass_hash,role) VALUES(?,?,?,?)",(label+'-private-login',label.title(),'fixture',role)).lastrowid
    ids[label]=str(ident)
    s.legal_consent.record(db,'local',ident)
  sessions={label:s.create_session('local',uid,SITE_DOMAIN) for label,uid in ids.items()}
  import http.server
  with http.server.ThreadingHTTPServer(('127.0.0.1',0),s.Handler) as srv:
   threading.Thread(target=srv.serve_forever,daemon=True).start()
   def call(path, actor=None, body=None):
    h={'Host':origin.split('://', 1)[1]}
    if actor: h['Cookie']='session='+sessions[actor]
    if body is not None: h.update({'Origin':origin,'Content-Type':'application/json'})
    with closing(http.client.HTTPConnection('127.0.0.1',srv.server_port,timeout=5)) as c:
     c.request('GET' if body is None else 'POST',path,json.dumps(body) if body is not None else None,h)
     r=c.getresponse(); return r.status,dict(r.headers),json.loads(r.read())
   def ok(path,*args):
    status,h,d=call(path,*args);assert status==200,(status,d);return h,d

   with closing(s.db()) as db,db:
    s.Handler._ensure_fan_reaction_tables(None,db)
    fields="user_kind,user_uid,name,type,is_public,review_status,created_at,updated_at"
    for row in [
      ("Like leader","turtle",1,"approved","2020-01-01T00:00:00Z","2020-01-01T00:00:00Z"),
      ("Net-score leader","turtle",1,"approved","2025-06-01T00:00:00+08:00","2025-06-01T00:00:00+08:00"),
      ("Hidden","turtle",0,"approved","2026-01-01","2026-01-01"),
      ("Recent edit","turtle",1,"approved","2021-01-01","2026-01-01"),
      ("Pending","turtle",1,"pending","2021-01-01","2026-01-01"),
      ("Rejected","turtle",1,"rejected","2021-01-01","2026-01-01"),
      ("No date","turtle",1,"approved","","2099-01-01")
    ]:
     db.execute(f"INSERT INTO fan_characters({fields}) VALUES(?,?,?,?,?,?,?,?)",('local',ids['owner'],*row))
    # Mark fixtures as pre-clock rows without claiming their generic edits as publication.
    db.execute("UPDATE fan_characters SET published_at=NULL")
    db.execute("UPDATE fan_characters SET reviewed_at='2025-12-31T12:00:00Z' WHERE id=2")
    db.execute("UPDATE fan_characters SET reviewed_at='2099-01-01',review_note='Old rejection' WHERE id=4")
    db.executemany("INSERT INTO fan_char_votes(user_kind,user_uid,character_id,vote) VALUES('local',?,?,?)",[
      (str(i),1,1 if i <= 4 else -1) for i in range(1,14)]+[(str(i),2,1) for i in range(1,3)]+
      [(str(i),3,1) for i in range(1,12)])
    db.executemany("INSERT INTO fan_char_favorites(user_kind,user_uid,character_id) VALUES('local',?,2)",
                   [(str(i),) for i in range(1,18)])
   def listing(query=""):
    return ok("/api/fan/list?view=text"+query)[1]
   def titles(r):
    return [x["name"] for x in r["characters"]]
   current=listing()
   assert current["sort"]=="likes" and titles(current)==["Like leader","Net-score leader","Recent edit","No date"]
   assert current["characters"][0]["like_count"]==4 and current["characters"][1]["like_count"]==2
   newest=listing("&sort=newest")
   assert titles(newest)==["Net-score leader","Recent edit","Like leader","No date"]
   assert newest["characters"][0]["published_at"]=="2025-12-31T12:00:00Z"
   assert newest["characters"][-1]["published_at"] is None
   assert titles(listing("&sort=newest&q=Recent&type=turtle"))==["Recent edit"]
   assert titles(listing("&sort=newest&limit=1&page=2"))==["Recent edit"]
   assert call("/api/fan/list?sort=invalid")[0]==400

   # Approval starts then; ordinary edits, refresh and no-op publish never promote.
   approved=ok("/api/fan/review/queue","admin")[1]["characters"][0]
   ok("/api/fan/review/decide","admin",{"id":approved["id"],"decision":"approve","review_version":approved["review_version"]})
   latest=listing("&sort=newest")["characters"][0]
   assert latest["name"]=="Pending" and latest["published_at"][:4] >= "2026",latest
   timestamp=latest["published_at"]
   with closing(s.db()) as db,db:
    db.execute("UPDATE fan_characters SET is_public=1,review_status='approved',updated_at='2099-01-01' WHERE id=?",(latest["id"],))
   ok("/api/fan/toggle","owner",{"id":latest["id"],"is_public":True})
   assert listing("&sort=newest")["characters"][0]["published_at"]==timestamp
   ok("/api/fan/toggle","owner",{"id":latest["id"],"is_public":False})
   assert "Pending" not in titles(listing("&sort=newest"))
   time.sleep(.02)
   ok("/api/fan/toggle","owner",{"id":latest["id"],"is_public":True})
   assert listing("&sort=newest")["characters"][0]["published_at"] > timestamp
   assert "Hidden" not in titles(listing()) and "Rejected" not in titles(listing())
   # An existing author's explicit republish reuses the row and all its likes.
   assert call("/api/fan/review/decide","admin",{"id":3,"decision":"approve","review_version":"irrelevant"})[0]==404
   ok("/api/fan/toggle","owner",{"id":3,"is_public":True})
   restored=listing()["characters"][0]
   assert (restored["id"],restored["like_count"])==(3,11)

   srv.shutdown()
 print("PASS real HTTP: likes independent of favorites/downvotes, valid latest legacy and transitions, filter, invalid sort, pagination")

if __name__=="__main__":
 run()
