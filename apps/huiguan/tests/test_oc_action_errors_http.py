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
   for label,role in (('owner','executor'),('admin','admin')):
    ident=db.execute("INSERT INTO local_users(username,nickname,pass_hash,role) VALUES(?,?,?,?)",(label+'-private-login',label.title(),'fixture',role)).lastrowid
    ids[label]=str(ident)
    s.legal_consent.record(db,'local',ident)
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
   def problem(path, body, code, field, status=400):
    actual,_,result=call(path,'owner',body)
    assert actual==status,(actual,result)
    assert result['code']==code and result.get('field')==field and result['message'],result
    return result
   save='/api/save-character'; submit='/api/fan/submit'; publish='/api/fan/publish'
   problem(save, {'data':{}}, 'invalid_oc_record','code')
   problem(save, {'code':'fixture','data':{'name':{'type':'wrong'}}}, 'invalid_oc_name','name')
   problem(save, {'code':'fixture','data':{},'html':'x'*(2*1024*1024+1)}, 'showcase_too_large','html',413)
   problem(save, {'code':'fixture','data':{'name':'Synthetic','image':'/api/uploads/preview?name=missing'}}, 'oc_image_preview_expired','image')
   problem(submit, {'name':'x'*51}, 'oc_name_too_long','name')
   problem(submit, {'name':'Synthetic','story':['invalid']}, 'invalid_fan_field','story')
   problem(submit, {'name':'Synthetic','image_data':'/api/uploads/preview?name=missing'}, 'oc_image_preview_expired','image_data')
   ok(save,'owner',{'code':'fixture','data':{'name':'Synthetic','code':'fixture'}})
   problem(publish, {'character_codes':'fixture'}, 'invalid_fan_selection','character_codes')
   mixed=problem(publish, {'character_codes':['fixture','unavailable']}, 'fan_publish_partial','character_codes')
   assert mixed['partial'] and mixed['published']==1 and mixed['pending']==1
   assert mixed['issues']==[{'character_code':'unavailable','code':'oc_not_found','message':'该角色不在当前账号的登记列表中，请刷新后重新选择。'}]
   assert problem(publish, {'character_codes':['unavailable']}, 'fan_publish_blocked','character_codes')['published']==0
   assert ok('/api/fan/review/queue','admin')[1]['characters'][0]['name']=='Synthetic'
   status,_,taken=call(submit,'admin',{'name':'Synthetic'})
   assert status==400 and taken['code']=='oc_name_taken' and taken['field']=='name'
   srv.shutdown()
  print('PASS actionable Hall save/submit/partial publish with unchanged quota and review rules')


if __name__ == "__main__":
    run()
