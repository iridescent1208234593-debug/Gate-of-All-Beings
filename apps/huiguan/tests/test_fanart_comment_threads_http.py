"""Run as a separate process: python -B this_file.py. Synthetic loopback only."""
from contextlib import closing
from pathlib import Path
import json
import http.client
import os
import sys
import tempfile
import threading


def run():
 root = Path(__file__).resolve().parents[3]
 with tempfile.TemporaryDirectory(prefix='gallery-comment-thread-fixture-') as d:
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
   for label,role in (('owner','executor'),('other','executor'),('admin','admin')):
    ident=db.execute("INSERT INTO local_users(username,nickname,pass_hash,role) VALUES(?,?,?,?)",(label+'-private-login',label.title(),'fixture',role)).lastrowid
    ids[label]=str(ident)
    s.legal_consent.record(db,'local',ident)
   fan_id=db.execute("INSERT INTO official_fanart(character_id,user_kind,user_uid,user_name,image_url) VALUES (1,'local',?,'Fixture','')",
                     (ids['owner'],)).lastrowid
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
   route='/api/official/fanart'
   def add(thread, content, who):
    return call(route+'/comment',who,{'id':fan_id,'thread':thread,'content':content})
   def remove(thread, comment_id, who):
    return call(route+'/comment/delete',who,{'id':comment_id,'thread':thread})
   def comments(thread, who=None):
    return ok(f'{route}/comments?id={fan_id}&thread={thread}',who)[1]['comments']

   assert add('main','Guest fixture',None)[0]==401
   status,_,main=add('main','Main catalog comment','owner')
   assert status==200 and main['count']==1
   status,_,sub=add('sub','Secondary catalog comment','other')
   assert status==200 and sub['count']==1
   assert comments('main')[0]['content']=='Main catalog comment'
   assert comments('sub')[0]['content']=='Secondary catalog comment'
   assert not comments('main')[0]['can_delete']
   assert comments('main','owner')[0]['mine'] and comments('main','owner')[0]['can_delete']
   assert not comments('main','other')[0]['can_delete']
   assert remove('main',main['id'],'other')[0]==403
   assert remove('sub',sub['id'],'owner')[0]==403
   assert remove('main',main['id'],None)[0]==401
   assert remove('main',main['id'],'owner')[0]==200
   assert comments('main')==[] and len(comments('sub'))==1
   assert remove('sub',sub['id'],'admin')[0]==200 and comments('sub')==[]
   srv.shutdown()
  print('PASS real Hall HTTP: main/sub comment isolation and guest/other/owner/admin scopes')


if __name__ == "__main__":
    run()
