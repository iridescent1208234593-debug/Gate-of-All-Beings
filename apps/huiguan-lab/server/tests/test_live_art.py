"""Real HTTP/WS regression: authorized art -> room sync -> persistent admin control."""
import base64
import io
import json
from contextlib import closing

import httpx
from PIL import Image

from conftest import png_bytes
from test_gateway import enter, recv_until
from lab.auth import set_admin_password
from lab.config import Config
from lab.oc import normalize_image, OCRejected
from lab.world import Geometry


def admin(g):
    set_admin_password(g.tmp / 'secrets', 'lab-test-only-password')
    c = httpx.Client(base_url=g.admin, headers={'X-Lab-Admin': '1'}, timeout=30)
    assert c.post('/admin/api/login', json={'password': 'lab-test-only-password'}).status_code == 200
    return c


def test_live_art_sync_control_restart_and_limits(gateway):
    g = gateway
    _, acode = g.new_code('art'); _, pcode = g.new_code()
    artist, player = g.login(acode), g.login(pcode)
    artist.headers['Origin'] = player.headers['Origin'] = g.base
    assert player.post('/api/art', content=png_bytes()).status_code == 403
    with closing(admin(g)) as a:
        assert len(a.get('/admin/api/catalog').json()['assets']) >= 25
        hall_geo=a.get('/admin/api/geometry/hall').json()
        assert hall_geo['painted_ground'] and hall_geo['painted_origin']==[0,-18.0]
        initial=a.get('/admin/api/entities?space=hall').json()['entities']
        plants=[n for n in initial if n['kind']=='plant' and n['asset']!='b_mushroom']
        assert all(n['kind']=='plant' and n['behavior']=='idle' and n['speed']==0 for n in initial if n['asset']=='b_mushroom')
        plots=hall_geo['planting_plots']
        assert len(plants)==len(plots)==8
        assert {round(n['z'],3) for n in plants}=={round(p['z'],3) for p in plots}
        assert next(n for n in initial if n['asset']=='b_dragon')['height']==3.5
        assert all(n['height']==.4 for n in initial if n['asset'] in ('b_dragonfly','b_beetle','b_fly'))
        assert a.get('/admin/api/builtin/b_initial_house.png').status_code == 200
        assert a.post('/admin/api/entities/hall', json={'asset':'b_frog','x':4,'z':-8}).status_code == 400   # house
        uploaded = artist.post('/api/art', content=png_bytes(), headers={'X-Art-Category':'plant','X-Art-Name':'live-plant.png'})
        assert uploaded.status_code == 200, uploaded.text
        aid = uploaded.json()['id']
        assert uploaded.json()['status'] == 'approved'
        s1, _ = enter(g, artist, 'Artist'); s2, _ = enter(g, player, 'Viewer')
        try:
            for s in (s1, s2):
                s.send(json.dumps({'t':'space_enter','space':'initial'}))
                assert recv_until(s, 'error')['code'] == 'space_forbidden'     # merged into the hall
            r = artist.post('/api/art/place', json={'asset':aid,'space':'hall','species':'live plant','kind':'plant','behavior':'idle','x':17,'z':-2.5,'height':2})
            assert r.status_code == 200, r.text
            eid = r.json()['entity']['id']
            for s in (s1,s2):
                m = recv_until(s,'npcs',pred=lambda m:any(n.get('asset')==aid for n in m['npcs']))
                assert next(n for n in m['npcs'] if n['id']==eid)['height']==2
                s.send(json.dumps({'t':'asset_get','id':aid}))
                assert base64.b64decode(recv_until(s,'asset')['png']).startswith(b'\x89PNG')
            s2.send(json.dumps({'t':'interact','object':eid}))
            cared=recv_until(s1,'npcs',pred=lambda m:any(n['id']==eid and n['stage']==1 for n in m['npcs']))
            assert next(n for n in cared['npcs'] if n['id']==eid)['stage']==1
            edited = a.post('/admin/api/entities/hall',json={'id':eid,'x':19,'z':-2,'visible':False,'height':3})
            assert edited.status_code==200, edited.text
            recv_until(s2,'npcs',pred=lambda m:all(n['id']!=eid for n in m['npcs']))
        finally:
            s1.close(); s2.close()
        # Exact byte boundary: accept 8 MiB, reject the next byte before decoding.
        raw=png_bytes(); raw += b'\0'*(8*1024*1024-len(raw))
        assert a.post('/admin/api/art/upload',content=raw,headers={'X-Art-Category':'creature'}).status_code==200
        assert a.post('/admin/api/art/upload',content=raw+b'0').status_code==413
    g.stop(); g.start()
    with closing(admin(g)) as a:
        rows=a.get('/admin/api/entities?space=hall').json()['entities']
        saved=next(n for n in rows if n['id']==eid)
        assert saved['x']==19 and saved['height']==3 and saved['visible'] is False
        assert a.post('/admin/api/entities/hall',json={'id':eid,'delete':True}).status_code==200
        assert all(n['id']!=eid for n in a.get('/admin/api/entities?space=hall').json()['entities'])


def test_jpeg_and_source_dimensions():
    out=io.BytesIO(); Image.new('RGB',(3000,40),'red').save(out,'JPEG')
    png,w,h,alpha=normalize_image(out.getvalue(),Config().oc_max_bytes,Config().oc_max_side,512)
    assert w==512 and h>0 and not alpha and png.startswith(b'\x89PNG')


def test_painted_geometry_blocks_house_and_river():
    from lab.app import SPACES_FILE
    spec=json.loads(SPACES_FILE.read_text(encoding='utf8'))
    geo=Geometry(spec['templates']['hall'],spec['player'])
    # the old initial-scene points, now 18 m north inside the hall
    assert geo.free(17,15-18)
    assert not geo.free(4,10-18) and not geo.free(30,15-18)
    assert not geo.segment_free(22,15-18,30,15-18)
    # the hall itself is unchanged and both parts are one walkable map
    assert geo.free(15.5,17.5) and not geo.free(6,8)
    assert geo.segment_free(18.5,-3,18.5,12)
    assert not geo.free(17,-12)                           # sky/hills above the field stay out of bounds
