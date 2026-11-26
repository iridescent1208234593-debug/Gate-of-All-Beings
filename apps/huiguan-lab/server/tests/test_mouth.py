import json
from test_gateway import enter,recv_until

from pathlib import Path
VARIANTS=json.loads((Path(__file__).parents[2]/'client/assets/renmo1/variants.json').read_text(encoding='utf-8'))
DEFAULT={s['id']:s['default'] for s in VARIANTS['slots']}

def test_face_slots_validate_broadcast_and_late_join(gateway):
 g=gateway
 _,ca=g.new_code();_,cb=g.new_code()
 a,wa=enter(g,g.login(ca),'FaceA');b,wb=enter(g,g.login(cb),'FaceB')
 assert next(p for p in wb['players'] if p['pid']==wa['pid'])['face']==DEFAULT
 a.send(json.dumps({'t':'profile','nick':'FaceA','part_colors':{},'face':{'eyes':'shock','mouth':'cat_grin'}}))
 want={**DEFAULT,'eyes':'shock','mouth':'cat_grin'}
 for socket in (a,b):
  assert recv_until(socket,'profile',pred=lambda m:m['pid']==wa['pid'] and m.get('face')==want)['face']==want
 for invalid in ({'eyes':'nope'},{'tail':'long'},{'mouth':1},['open'],'open',{'brows':None}):
  a.send(json.dumps({'t':'profile','nick':'FaceA','face':invalid}))
  assert recv_until(a,'error')['code']=='bad_request'
 # a profile message without face keeps the current choice; the old "mouth" field still works
 a.send(json.dumps({'t':'profile','nick':'FaceA2'}))
 assert recv_until(a,'profile',pred=lambda m:m['pid']==wa['pid'] and m['nick']=='FaceA2')['face']==want
 a.send(json.dumps({'t':'profile','nick':'FaceA2','mouth':'open'}))
 assert recv_until(a,'profile',pred=lambda m:m['pid']==wa['pid'] and m['face']['mouth']=='open')['face']['eyes']=='shock'
 b.close()
 b,w2=enter(g,g.login(cb),'FaceB')
 assert next(p for p in w2['players'] if p['pid']==wa['pid'])['face']=={**DEFAULT,'eyes':'shock','mouth':'open'}
 a.close();b.close()
