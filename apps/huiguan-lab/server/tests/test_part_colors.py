import json
from test_gateway import enter,recv_until

def test_part_colors_validate_broadcast_and_late_join(gateway):
 g=gateway
 _,ca=g.new_code();_,cb=g.new_code()
 a,wa=enter(g,g.login(ca),'ColorA');b,wb=enter(g,g.login(cb),'ColorB')
 colors={'ArtMeshFace':'ff2200','ArtMeshLayerL2':'0044ff','ArtMeshLegwearR2':'00dd44'}
 a.send(json.dumps({'t':'profile','nick':'ColorA','part_colors':colors}))
 for socket in (a,b):
  assert recv_until(socket,'profile',pred=lambda m:m['pid']==wa['pid'] and m.get('part_colors')==colors)['part_colors']==colors
 for invalid in ({'invalid':'123456'},{'ArtMeshFace':'red'},{'ArtMeshFace':'#123456'},[],{'ArtMeshFace':None}):
  a.send(json.dumps({'t':'profile','nick':'ColorA','part_colors':invalid}))
  assert recv_until(a,'error')['code']=='bad_request'
 b.close()
 b,w2=enter(g,g.login(cb),'ColorB')
 assert next(p for p in w2['players'] if p['pid']==wa['pid'])['part_colors']==colors
 a.send(json.dumps({'t':'profile','nick':'ColorA','part_colors':{}}))
 assert recv_until(a,'profile',pred=lambda m:m['pid']==wa['pid'])['part_colors']=={}
 a.close();b.close()
