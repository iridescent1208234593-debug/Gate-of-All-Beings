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
   for label,role in (('owner','executor'),('other','executor'),('admin','admin')):
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
   title='Fixture turtle'
   _,submitted=ok('/api/fan/submit','owner',{'name':title,'story':'fixture history'})
   fid=submitted['id']; scope=f'/api/admin/fan/history?id={fid}'
   assert call(scope)[0]==401 and call(scope,'owner')[0]==403
   found=ok('/api/admin/fan/history/find','admin',{'name':title})[1]
   assert found['matches']==[{'id':fid,'name':title}]
   pending=ok('/api/fan/review/queue','admin')[1]['characters'][0]
   assert submitted['review_status']=='pending'
   assert ok('/api/fan/list?view=text')[1]['total']==0
   assert call('/api/fan/my')[0]==401
   assert ok('/api/fan/my','other')[1]['characters']==[]
   assert ok('/api/fan/my','owner')[1]['characters'][0]['id']==fid
   assert call('/api/fan/toggle','other',{'id':fid,'is_public':False})[0]==403
   assert call('/api/fan/review/queue','other')[0]==403
   assert call('/api/fan/review/decide','other',{'id':fid,'decision':'approve','review_version':pending['review_version']})[0]==403
   assert ok('/api/fan/list?view=text')[1]['total']==0
   ok('/api/fan/review/decide','admin',{'id':fid,'decision':'approve','review_version':pending['review_version']})
   listed=ok('/api/fan/list?view=text','admin')[1]['characters'][0]
   assert listed['name']==title
   assert listed['review_status']=='approved'
   ok('/api/fan/review/decide','admin',{'id':fid,'decision':'reject','note':'Please revise','review_version':listed['review_version']})
   assert ok('/api/fan/list?view=text')[1]['total']==0
   rejected=ok('/api/fan/my','owner')[1]['characters'][0]
   assert rejected['review_status']=='rejected' and rejected['review_note']=='Please revise'
   assert 'reviewed_by' not in rejected
   ok('/api/fan/toggle','owner',{'id':fid,'is_public':False})
   ok('/api/fan/toggle','owner',{'id':fid,'is_public':False})
   headers,report=ok(scope,'admin')
   assert 'no-store' in headers['Cache-Control']
   assert [x['action'] for x in report['events']]==['owner_unpublish','review_reject','review_approve','owner_submit']
   assert report['events'][1]['actor_name']=='Admin' and report['events'][1]['reason']=='Please revise'
   assert report['snapshots'][0]['content']['story']=='fixture history'
   assert 'private-login' not in str(report)
   srv.shutdown()
  print('PASS actual Hall HTTP: real owner/admin session scope, exact-title find, approve and reject, unchanged public filter, visibility and owner isolation, non-reviewer rejection, private review reason, no-op revoke, cache and attribution')


if __name__ == "__main__":
    run()
