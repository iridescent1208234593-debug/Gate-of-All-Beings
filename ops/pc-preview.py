"""Public PC preview: local code, HK-only APIs/accounts/saves/uploads. No SQLite."""
import http.client
import http.server
import gzip
import hashlib
from functools import lru_cache
import io
import json
import os
from pathlib import Path
import select
import socket
import ssl
import sys
from urllib.parse import unquote, urlsplit, urlunsplit

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
from base_static import BaseStaticHandler
from host_policy import PREVIEW_HOSTS, enforce_request, normalize_host

HOSTS=PREVIEW_HOSTS
PUBLIC=ROOT/'ops/server-public'
TEXT_EXTENSIONS={'.html','.js','.mjs','.css','.json','.svg'}
COMPRESSIBLE_EXTENSIONS=TEXT_EXTENSIONS|{'.ttf','.otf','.wasm'}


@lru_cache(maxsize=8)  # ponytail: at most eight <=8 MiB representations; use a web server if traffic outgrows it.
def text_representation(path,mtime_ns,size,inject):
    content=Path(path).read_bytes()
    if inject:
        # A body-closing tag can occur inside an inline JavaScript template.
        content=content.replace(b'<head>',b'<head><script defer src="/__server/selector.js?v=20261019.4"></script>',1)
    packed=gzip.compress(content,compresslevel=5,mtime=0) if len(content)>=512 else content
    return content,packed,hashlib.sha256(content).hexdigest()


def accepts_gzip(value):
    qualities={}
    for item in value.lower().split(','):
        parts=item.strip().split(';')
        if not parts[0]:continue
        try:quality=next((float(p.strip()[2:]) for p in parts[1:] if p.strip().startswith('q=')),1.0)
        except ValueError:quality=0
        qualities[parts[0]]=quality
    return qualities.get('gzip',qualities.get('*',0))>0

def static_target(host,path):
    if path.startswith('/__server/'):
        return PUBLIC,path.removeprefix('/__server/'),False
    if path.startswith('/shared/'):return ROOT/'shared',path.removeprefix('/shared/'),False
    if path.startswith('/app/modules/'):return ROOT/'server/app/modules',path.removeprefix('/app/modules/'),False
    if path=='/app/shell' or path.startswith('/app/shell/'):
        relative=path.removeprefix('/app/').lstrip('/')
        return ROOT/'server/app',relative if Path(relative).suffix else 'shell/index.html',False
    if path=='/app/portal.json':return ROOT/'server/app','portal.json',False
    if path.startswith('/ozmtree'):return Path('E:/External Projects/众生之门生物树可视化前端/OZtree/static'),path.removeprefix('/ozmtree/'),False
    if path.startswith('/ecology'):return ROOT/'server/app/modules/ecology',path.removeprefix('/ecology/'),True
    if path.startswith('/management'):return ROOT/'server/app/modules/management',path.removeprefix('/management/'),True
    if host=='spirit.iridescently.xyz':return ROOT/'server/app/modules/softie',path.removeprefix('/app/modules/softie/').lstrip('/'),True
    if host=='zszm.iridescently.xyz' and not path.startswith('/playtest/'):
        return ROOT/'server/app/modules/cards',path.lstrip('/'),True
    section='huiguan' if host=='huiguan.iridescently.xyz' else 'oc' if host=='oc.iridescently.xyz' else 'www'
    if section=='huiguan' and path.startswith('/design-system/ui/'):
        return ROOT/'shared/shared-ui',path.removeprefix('/design-system/ui/'),False
    return ROOT/'portal'/section,path.lstrip('/'),False

def central_path(path):
    return '/api/' in path or path.startswith(('/api/','/auth/','/assets/uploads/','/assets/store/')) or path.startswith('/assets/homepage/gallery-files/')

class Handler(BaseStaticHandler):
    protocol_version='HTTP/1.1'
    def parse_request(self):
        return super().parse_request() and enforce_request(self, HOSTS, os.environ.get('IRIDESCENTLY_ENVIRONMENT') == 'development')
    def _is_api_path(self):return central_path(urlsplit(self.path).path)

    def log_message(self,fmt,*args):
        # Keep verification/login tokens in URL queries out of the preview access log.
        print(json.dumps({'method':getattr(self,'command',''),'path':urlsplit(getattr(self,'path','')).path,
                          'status':str(args[1]) if len(args)>1 and not isinstance(args[0],int) else str(args[0]) if args else ''}),flush=True)

    def end_headers(self):
        self.send_header('X-Iridescently-Node','pc-latest')
        super().end_headers()

    def canonical(self):
        host=normalize_host(self.headers.get('Host',''))
        if host in {'127.0.0.1','localhost'}:return 'zszm.iridescently.xyz'
        if host not in HOSTS:raise ValueError('Unknown preview host')
        return HOSTS[host]

    def headers_for_hk(self,host,body=None):
        headers={k:v for k,v in self.headers.items() if k.lower() not in {'host','connection','content-length','accept-encoding','x-forwarded-host','x-forwarded-proto','forwarded','cf-connecting-ip','x-forwarded-for','cf-ray'}}
        headers['Host']=host;headers['Accept-Encoding']='identity'
        # Only rewrite the known preview origins, retaining the regular server-side CSRF checks.
        for key in ['Origin','Referer']:
            if key in headers:
                url=urlsplit(headers[key])
                if url.hostname in HOSTS:
                    headers[key]=urlunsplit(('https',HOSTS[url.hostname],url.path,url.query,url.fragment))
        if body is not None:headers['Content-Length']=str(len(body))
        return headers

    def proxy(self,host):
        if self.headers.get('Upgrade','').lower()=='websocket':return self.websocket(host)
        try:length=int(self.headers.get('Content-Length','0'))
        except ValueError:self.send_error(400);return
        if length<0 or length>32*1024*1024:self.send_error(413);return
        body=self.rfile.read(length) if length else None
        conn=http.client.HTTPSConnection(host,timeout=30)
        try:
            conn.request(self.command,self.path,body=body,headers=self.headers_for_hk(host,body))
            reply=conn.getresponse()
            self.send_response(reply.status)
            for k,v in reply.getheaders():
                if k.lower() not in {'transfer-encoding','connection','server','date','x-iridescently-node'}:self.send_header(k,v)
            self.send_header('Connection','close');self.close_connection=True
            self.end_headers()
            if self.command!='HEAD':
                while True:
                    block=reply.read(128*1024)
                    if not block:break
                    self.wfile.write(block)
        except (OSError,http.client.HTTPException):
            if not self.close_connection:self.send_error(502,'Hong Kong API unavailable; no local database fallback')
        finally:conn.close()

    def websocket(self,host):
        self.close_connection=True
        try:
            with socket.create_connection((host,443),timeout=10) as raw, ssl.create_default_context().wrap_socket(raw,server_hostname=host) as upstream:
                headers=self.headers_for_hk(host);headers['Connection']='Upgrade'
                head='GET '+self.path+' HTTP/1.1\r\n'+''.join(k+': '+v+'\r\n' for k,v in headers.items())+'\r\n'
                upstream.sendall(head.encode('latin-1'))
                with upstream.makefile('rb',buffering=0) as reader:
                    lines=[];total=0
                    while True:
                        line=reader.readline(8192);lines.append(line);total+=len(line)
                        if not line or total>32768:raise OSError('Invalid WebSocket response')
                        if line==b'\r\n':break
                self.wfile.write(b''.join(lines));self.wfile.flush()
                if b' 101 ' not in lines[0]:return
                while True:
                    if upstream.pending():ready=[upstream]
                    else:ready,_,_=select.select([self.connection,upstream],[],[],60)
                    if not ready:return
                    for source in ready:
                        chunk=source.recv(65536)
                        if not chunk:return
                        (upstream if source is self.connection else self.connection).sendall(chunk)
        except OSError:return

    def do_GET(self):
        try:host=self.canonical()
        except ValueError:self.send_error(421);return
        path=urlsplit(self.path).path
        if path=='/__server/status':
            import hashlib
            index=ROOT/'server/app/modules/cards/index.html'
            content=json.dumps({'node':'pc-latest','data':'HK','api':'HK','code':'local working tree and current built modules',
                                'cards_entry_sha256':hashlib.sha256(index.read_bytes()).hexdigest(),
                                'cards_built_at':index.stat().st_mtime}).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(content)));self.send_header('Cache-Control','no-store');self.send_header('Access-Control-Allow-Origin','*');self.end_headers()
            if self.command!='HEAD':self.wfile.write(content)
            return
        if central_path(path):return self.proxy(host)
        self.code_max_age=0
        if self.command not in {'GET','HEAD'}:self.send_error(405);return
        if host in {'game.iridescently.xyz','juling.iridescently.xyz','lingjing.iridescently.xyz'}:
            suffix='/app/shell/m/juling' if host.startswith('juling') else '/#management' if host.startswith('lingjing') else '/#home'
            self.send_response(308);self.send_header('Location','https://pc-zszm.iridescently.xyz'+suffix);self.send_header('Content-Length','0');self.end_headers();return
        self.static_host=host
        return super().do_HEAD() if self.command=='HEAD' else super().do_GET()

    do_HEAD=do_POST=do_PUT=do_PATCH=do_DELETE=do_OPTIONS=do_GET

    def translate_path(self,path):
        path=unquote(urlsplit(path).path)
        root,relative,spa=static_target(self.static_host,path)
        target=(root/relative).resolve()
        if not target.is_relative_to(root.resolve()):return str(root/'__forbidden__')
        if spa and not Path(relative).suffix and not target.is_file():target=root/'index.html'
        return str(target)

    def send_head(self):
        target=Path(self.translate_path(self.path))
        if target.is_dir():target=target/'index.html'
        limit=2*1024*1024 if target.suffix.lower() in TEXT_EXTENSIONS else 8*1024*1024
        if target.is_file() and (target.suffix.lower() in COMPRESSIBLE_EXTENSIONS or target==PUBLIC/'select') and target.stat().st_size<=limit and not self.headers.get('Range'):
            stat=target.stat();html=target.suffix.lower()=='.html' or target==PUBLIC/'select'
            content,packed,digest=text_representation(str(target),stat.st_mtime_ns,stat.st_size,html)
            compressed=accepts_gzip(self.headers.get('Accept-Encoding','')) and len(packed)<len(content)
            body=packed if compressed else content
            etag='"'+digest+('-gzip' if compressed else '')+'"'
            matches=[value.strip().removeprefix('W/') for value in self.headers.get('If-None-Match','').split(',')]
            unchanged=not html and (etag in matches or '*' in matches)
            self.send_response(304 if unchanged else 200)
            self.send_header('Content-Type','text/html; charset=utf-8' if html else self.guess_type(str(target)))
            self.send_header('Vary','Accept-Encoding');self.send_header('ETag',etag)
            self.send_header('Last-Modified',self.date_time_string(stat.st_mtime))
            if compressed:self.send_header('Content-Encoding','gzip')
            if not unchanged:self.send_header('Content-Length',str(len(body)))
            self.end_headers();return None if unchanged else io.BytesIO(body)
        return super().send_head()

if __name__=='__main__':
    class Server(http.server.ThreadingHTTPServer):
        daemon_threads=True;request_queue_size=128
        def get_request(self):
            conn,addr=super().get_request();conn.settimeout(30);return conn,addr
    Server(('127.0.0.1',18190),Handler).serve_forever()
