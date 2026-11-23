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
  with closing(s.db()) as db,db:
   ids={}
   for label,role in (('owner','executor'),('reviewer','executor'),('admin','admin')):
    ident=db.execute("INSERT INTO local_users(username,nickname,pass_hash,role) VALUES(?,?,?,?)",(label+'-private-login',label.title(),'fixture',role)).lastrowid
    ids[label]=str(ident)
    s.legal_consent.record(db,'local',ident)
    if label=='reviewer': db.execute('UPDATE local_users SET is_fan_reviewer=1 WHERE uid=?',(ident,))
  sessions={label:s.create_session('local',uid,'iridescently.cn') for label,uid in ids.items()}
  import http.server
  with http.server.ThreadingHTTPServer(('127.0.0.1',0),s.Handler) as srv:
   threading.Thread(target=srv.serve_forever,daemon=True).start()
   def call(path, actor=None, body=None):
    h={'Host':'huiguan.iridescently.cn'}
    if actor: h['Cookie']='session='+sessions[actor]
    if body is not None: h.update({'Origin':'https://huiguan.iridescently.cn','Content-Type':'application/json'})
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
   ok('/api/fan/review/decide','admin',{'id':fid,'decision':'approve','review_version':pending['review_version']})
   listed=ok('/api/fan/list?view=text','admin')[1]['characters'][0]
   assert listed['name']==title
   assert listed['review_status']=='approved'
   ok('/api/fan/review/decide','admin',{'id':fid,'decision':'reject','note':'Please revise','review_version':listed['review_version']})
   assert ok('/api/fan/list?view=text')[1]['total']==0
   route='/api/admin/fan/history/reopen'
   headers,report=ok(scope,'admin')
   assert 'no-store' in headers['Cache-Control']
   eligible=report['reopen']; assert eligible['rejection_reason']=='Please revise'
   body={'id':fid,'review_version':eligible['review_version'],'reason':'Verified grounds for reconsideration'}
   assert call(route,None,body)[0]==401
   assert call(route,'owner',body)[0]==403
   assert call(route,'reviewer',body)[0]==403
   assert call(route,'admin',{**body,'reason':'a'})[0]==400
   assert call(route,'admin',{**body,'review_version':'a'*64})[0]==409
   with closing(s.db()) as db,db:
    db.execute("INSERT INTO fan_char_votes(user_kind,user_uid,character_id,vote) VALUES('local',?,?,1)",(ids['owner'],fid))
    before=dict(db.execute('SELECT * FROM fan_characters WHERE id=?',(fid,)).fetchone())
   assert ok(route,'admin',body)[1]=={'ok':True,'id':fid,'review_status':'pending'}
   assert call(route,'admin',body)[0]==409
   assert ok(scope,'admin')[1]['reopen'] is None
   assert ok('/api/fan/list?view=text')[1]['total']==0
   pending=ok('/api/fan/review/queue','reviewer')[1]['characters'][0]
   assert pending['id']==fid
   with closing(s.db()) as db:
    after=dict(db.execute('SELECT * FROM fan_characters WHERE id=?',(fid,)).fetchone())
    assert {k:v for k,v in before.items() if k not in ('review_status','updated_at')}=={k:v for k,v in after.items() if k not in ('review_status','updated_at')}
   ok('/api/fan/review/decide','reviewer',{'id':fid,'decision':'approve','review_version':pending['review_version']})
   restored=ok('/api/fan/list?view=text')[1]['characters'][0]
   assert (restored['id'],restored['like_count'])==(fid,1)
   with closing(s.db()) as db:
    event=db.execute("SELECT * FROM fan_history_events WHERE action='moderation_reopen'").fetchall()
    assert len(event)==1
    assert (event[0]['previous_status'],event[0]['new_status'],event[0]['reason'])==('rejected','pending',body['reason'])
    assert json.loads(event[0]['prior_review'])=={key:before[key] for key in ('review_note','reviewed_at','reviewed_by')}
   ok('/api/fan/review/decide','admin',{'id':fid,'decision':'reject','note':'Please revise','review_version':ok('/api/fan/list?view=text','admin')[1]['characters'][0]['review_version']})
   eligible=ok(scope,'admin')[1]['reopen']
   ok('/api/fan/toggle','owner',{'id':fid,'is_public':False})
   assert ok(scope,'admin')[1]['reopen'] is None
   assert call(route,'admin',{**body,'review_version':eligible['review_version']})[0]==409
   srv.shutdown()
  print('PASS Hall HTTP: admin-only, stale/duplicate/private blocked, pending not public, same ID/vote preserved, separate approval and retained rejection evidence')


if __name__ == "__main__":
    run()
