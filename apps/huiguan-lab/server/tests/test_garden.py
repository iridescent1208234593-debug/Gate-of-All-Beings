import json,time
from test_gateway import enter,recv_until

def send(s,t,**kw): s.send(json.dumps({'t':t,**kw}))

def test_mushroom_garden_cycle_sync_inventory_restart(gateway):
 g=gateway
 _,code=g.new_code();_,code_b=g.new_code()
 a,w=enter(g,g.login(code),'种植者');b,wb=enter(g,g.login(code_b),'访客')
 assert w['inventory']=={'seeds':1,'soil':1}
 x,z=int(w['you']['x']//1)+1,int(w['you']['z']//1)
 send(a,'garden',action='plant',x=x,z=z)
 assert recv_until(a,'error')['code']=='need_dirt'
 send(a,'tile',x=x,z=z,on=True)
 assert recv_until(a,'inventory')['soil']==0
 send(a,'tile',x=x+1,z=z,on=True)
 assert recv_until(a,'error')['code']=='no_soil'
 send(a,'garden',action='plant',x=x,z=z)
 assert recv_until(a,'inventory')['seeds']==0
 n=next(n for n in recv_until(b,'npcs')['npcs'] if n.get('planted_by')==w['pid'])
 assert n['behavior']=='idle' and n['kind']=='plant' and n['speed']==0
 send(a,'garden',action='plant',x=x,z=z)
 assert recv_until(a,'error')['code']=='plant_occupied'
 send(a,'tile',x=x,z=z,on=False)
 assert recv_until(a,'error')['code']=='soil_has_mushroom'
 send(b,'garden',action='shovel',x=x,z=z)
 assert recv_until(b,'error')['code']=='plant_not_yours'
 send(a,'garden',action='shovel',x=x+10,z=z)
 assert recv_until(a,'error')['code']=='tile_too_far'
 a.close();b.close();time.sleep(.2);g.stop();g.start()
 a,w2=enter(g,g.login(code),'种植者')
 assert w2['inventory']=={'seeds':0,'soil':0}
 n2=next(p for p in w2['npcs'] if p['id']==n['id'])
 assert (n2['x'],n2['z'])==(n['x'],n['z'])
 send(a,'garden',action='shovel',x=x,z=z)
 assert recv_until(a,'inventory')['seeds']==1
 send(a,'garden',action='shovel',x=x,z=z)
 assert recv_until(a,'error')['code']=='no_mushroom'
 send(a,'tile',x=x,z=z,on=False)
 assert recv_until(a,'inventory')=={'t':'inventory','seeds':1,'soil':1,'garden_phase':2}
 send(a,'garden',action='plant',x=True,z=z)
 assert recv_until(a,'error')['code']=='bad_request'
 # Replant after harvesting unlocks crouch exactly once, and survives restart.
 send(a,'tile',x=x,z=z,on=True)
 recv_until(a,'inventory')
 send(a,'garden',action='plant',x=x,z=z)
 assert recv_until(a,'inventory')['garden_phase']==3
 send(a,'emote',id='crouch')
 assert recv_until(a,'emote')['id']=='crouch'
 a.close();time.sleep(.2);g.stop();g.start()
 a,w3=enter(g,g.login(code),'种植者')
 assert w3['garden_phase']==3
 send(a,'emote',id='crouch')
 assert recv_until(a,'emote')['id']=='crouch'
 a.close()
