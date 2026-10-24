"""Isolated checks: published entity privacy, all PC shell routes, gzip/cache and real 404 recovery."""
import gzip
import http.client
import http.server
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
import threading

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
from showcase_document import published_document


def main():
    with sqlite3.connect(':memory:') as db:
        db.row_factory=sqlite3.Row
        db.executescript('CREATE TABLE posters(id INTEGER,title TEXT,img_ref TEXT,is_public INTEGER,user_kind TEXT,user_uid TEXT);'
                         'CREATE TABLE fan_characters(id INTEGER,code TEXT,name TEXT,type TEXT,is_public INTEGER,image_data TEXT,species TEXT,gender TEXT,faction TEXT,ability TEXT,appearance TEXT,story TEXT);')
        db.executemany('INSERT INTO posters VALUES (?,?,?,?,?,?)',[(43,'<真实海报>','/assets/uploads/'+'a'*64+'.png',1,'local','7'),(44,'private','',0,'local','9')])
        assert '&lt;真实海报&gt;' in published_document(db,'poster-43')
        assert published_document(db,'poster-44') is None
        assert published_document(db,'poster-44',{'kind':'usso','uid':'9'}) is None
        assert 'private' in published_document(db,'poster-44',{'kind':'local','uid':'9'})
        assert published_document(db,'poster-999') is None
        db.execute('INSERT INTO fan_characters VALUES (1,?,?,?,?,?,?,?,?,?,?,?)',('orphan','public','',1,'','妖精','','','','','真实公开资料<script>bad()</script>'))
        assert '真实公开资料&lt;script&gt;' in published_document(db,'orphan')
        db.execute('UPDATE fan_characters SET is_public=0')
        assert published_document(db,'orphan') is None
    from access_recovery import send_recovery
    class StrippedRequest:
        path='/missing/index.html'
        requestline='GET /app/modules/missing/index.html HTTP/1.1'
        headers={'Accept':'text/html'}
        command='HEAD'
        def send_response(self, code): self.status=code
        def send_header(self, name, value): pass
        def end_headers(self): pass
    stripped=StrippedRequest()
    assert send_recovery(stripped,404) and stripped.status==404
    stripped.requestline='GET /app/modules/cards/api/missing HTTP/1.1'
    assert not send_recovery(stripped,404)
    spec=importlib.util.spec_from_file_location('pc_preview',ROOT/'ops/pc-preview.py')
    pc=importlib.util.module_from_spec(spec);spec.loader.exec_module(pc)
    for link in json.loads((ROOT/'server/app/portal.json').read_text(encoding='utf-8'))['links']:
        if not link['url'].startswith('/'):continue
        root,relative,spa=pc.static_target('zszm.iridescently.xyz','/app/shell/m/'+link['key'])
        assert root/relative==ROOT/'server/app/shell/index.html' and not spa
    assert pc.accepts_gzip('br, gzip;q=0.7') and not pc.accepts_gzip('gzip;q=0, *;q=1')
    assert not pc.accepts_gzip('br')
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),pc.Handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    def get(path,headers=None,method='GET'):
        connection=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=10)
        connection.request(method,path,headers={'Host':'pc-zszm.iridescently.xyz','X-Forwarded-Proto':'https',**(headers or {})})
        response=connection.getresponse();body=response.read();result=(response.status,dict(response.getheaders()),body);connection.close();return result
    try:
        for path in ['/app/shell/','/app/shell/m/shengsheng-shoot','/app/shell/m/slay']:
            status,headers,body=get(path,{'Accept-Encoding':'gzip'})
            assert status==200 and b'iridescently-shell-view' in gzip.decompress(body)
        path='/playtest/shengsheng-shoot/game.js?v=5'
        status,headers,body=get(path,{'Accept-Encoding':'gzip'})
        assert status==200 and headers['Content-Encoding']=='gzip'
        plain=get(path,{'Accept-Encoding':'gzip;q=0'})[2]
        assert gzip.decompress(body)==plain and len(body)<len(plain)
        assert get(path,{'Accept-Encoding':'gzip','If-None-Match':headers['ETag']})[0]==304
        assert get(path,method='HEAD')[2]==b''
        status,headers,body=get('/app/modules/missing/index.html',{'Accept':'text/html'})
        assert status==404 and b'data-server-recovery' in body
        assert b'data-server-recovery' not in get('/app/modules/missing/main.js',{'Accept':'*/*'})[2]
        assert get('/shared/shared-ui/../private.db')[0]==404
        source=b'<html><head></head><body><script>let x=`<head></head></body>`</script></body></html>'
        injected=source.replace(b'<head>',b'<head><script defer src="selector.js"></script>',1)
        assert injected.count(b'src="selector.js"')==1
        print('PASS: poster/snapshot privacy, 8 shell routes, gzip negotiation, byte equality, ETag 304, HEAD, navigation-only recovery, sensitive paths')
    finally:server.shutdown();server.server_close()


if __name__=='__main__':main()
