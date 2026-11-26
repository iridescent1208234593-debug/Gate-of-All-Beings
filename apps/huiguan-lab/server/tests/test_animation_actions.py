import json
from pathlib import Path
from test_gateway import enter,recv_until

def test_all_exported_actions_broadcast(gateway):
 g=gateway
 _,ca=g.new_code();_,cb=g.new_code()
 a,wa=enter(g,g.login(ca),'Actor');b,wb=enter(g,g.login(cb),'Viewer')
 metadata=json.loads((Path(__file__).parents[2]/'client/assets/renmo1/animations.json').read_text())
 assert len(metadata)==15
 for action in metadata:
  if action=="crouch": continue
  a.send(json.dumps({'t':'emote','id':action}))
  assert recv_until(a,'emote')['id']==action
  assert recv_until(b,'emote')['id']==action
 a.send(json.dumps({'t':'emote','id':'crouch'}))
 assert recv_until(a,'error')['code']=='crouch_locked'
 # Beginning movement cancels an active expression for every observer.
 a.send(json.dumps({'t':'move','x':wa['you']['x'],'z':wa['you']['z'],'anim':'walk'}))
 recv_until(b,'emote_cancel')
 a.send(json.dumps({'t':'emote','id':'wave'}))
 assert recv_until(a,'error')['code']=='emote_while_moving'
 a.close();b.close()
