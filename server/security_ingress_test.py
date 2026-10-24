"""Run local ingress regressions, or fail-closed public recovery checks.

  python -X utf8 server/security_ingress_test.py
  python -X utf8 server/security_ingress_test.py --public --edge-ip 104.21.6.184 --output pre-dns.json
  python -X utf8 server/security_ingress_test.py --public --output result.json

Public checks use validated DoH answers (or one pinned Cloudflare edge before DNS
is restored) and normal TLS hostname/chain validation. They never restore DNS,
follow an unknown Location, or disable TLS verification.
"""
import argparse
import contextlib
import hashlib
import http.client
import http.server
import ipaddress
import json
import os
from pathlib import Path
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import urljoin, urlsplit
import urllib.request

HOST = "zszm.iridescently.xyz"
ROOT = Path(__file__).resolve().parents[1]
from host_policy import PRODUCTION_HOSTS, PREVIEW_HOSTS, normalize_host
APPROVED_HOSTS = PRODUCTION_HOSTS | PREVIEW_HOSTS.keys()
# The only hostnames authorized for DNS restoration on 2026-10-24.
RESTORE_HOSTS = (HOST, "iridescently.xyz", "huiguan.iridescently.xyz", "oc.iridescently.xyz")
PATHS =["/", "/app", "/app/shell/", "/api/sso-user", "/__server/select",
         "/__server/select?return=%2F%2Fevil.example",
         "/__server/select?return=%5C%5Cevil.example", "/a?b=1"]


def request(connect, scheme, path, host=HOST, headers=None, method="GET", sni=None):
    conn = http.client.HTTPConnection(connect[0], connect[1], timeout=15)
    try:
        raw = socket.create_connection(connect, timeout=15)
        cert = None
        if scheme == "https":
            raw = ssl.create_default_context().wrap_socket(raw, server_hostname=sni or host)
            cert = raw.getpeercert()  # OpenSSL already checked hostname and expiry.
        conn.sock = raw
        conn.request(method, path, headers={"Host": host, "Connection": "close", **(headers or {})})
        response = conn.getresponse()
        body = response.read(2 * 1024 * 1024)
        return response.status, dict(response.getheaders()), body, cert
    finally:
        conn.close()


def local_checks(chooser=True):
    # Importing portal creates databases only under this throwaway data root.
    with tempfile.TemporaryDirectory(prefix="ingress-security-") as temporary:
        env = dict(os.environ, IRIDESCENTLY_PROJECT_ROOT=temporary,
                   IRIDESCENTLY_ENVIRONMENT="production", PORT="0")
        if os.environ.get("IRIDESCENTLY_INGRESS_CHILD") != "1":
            env["IRIDESCENTLY_INGRESS_CHILD"] = "1"
            subprocess.run([sys.executable, "-X", "utf8", __file__] + ([] if chooser else ['--host-only']), env=env, check=True)
            return
        sys.path.insert(0, str(ROOT / "server"))
        import portal_server as portal
        from base_static import BaseStaticHandler
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), portal.Dispatcher)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        checks = 0
        try:
            connect = ("127.0.0.1", server.server_port)
            for method in ("GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "TRACE", "UNRECOGNIZED"):
                for path in PATHS:
                    status, headers, body, _ = request(connect, "http", path, method=method)
                    assert status == 308 and headers["Location"] == "https://" + HOST + path, (method, path, status)
                    assert body == b"", (method, path)
                    checks += 1
            for host in ("evil.example", "zszm.iridescently.xyz.evil.example", "", "127.0.0.1"):
                status, headers, _, _ = request(connect, "http", "/", host=host,
                                                headers={"X-Forwarded-Proto": "https"})
                assert status == 421 and "Location" not in headers, host
                checks += 1
            for value in ('evil-iridescently.xyz', 'iridescently.xyz@evil.com', 'iridescently.xyz.',
                          'iridescently.xyz:0', 'iridescently.xyz:65536', '[::1]:443', '[::1',
                          'iridescently.xyz/path', 'iridescently.xyz:bad', 'iridescently.xyz:'):
                assert normalize_host(value) not in PRODUCTION_HOSTS, value
                status, _, _, _ = request(connect, 'http', '/', host=value, headers={'X-Forwarded-Proto':'https'})
                assert status == 421, value
                checks += 1
            for host in sorted(PRODUCTION_HOSTS):
                for value in (host, host.upper(), host + ':443'):
                    status, _, _, _ = request(connect, 'http', '/__server/status', host=value,
                        headers={'X-Forwarded-Proto':'https','X-Forwarded-Host':'evil.com','Forwarded':'host=evil.com'})
                    assert status == 200, value
                    checks += 1
            for extra in ('Host: evil.example\r\n', 'X-Forwarded-Proto: https\r\n'):
                raw=socket.create_connection(connect,timeout=10)
                raw.sendall(('GET /__server/status HTTP/1.1\r\nHost: '+HOST+'\r\nX-Forwarded-Proto: https\r\n'+extra+'Connection: close\r\n\r\n').encode())
                wire=raw.recv(65536);raw.close()
                assert (b'421' if extra.startswith('Host:') else b'308') in wire.split(b'\r\n',1)[0], wire[:100]
                checks += 1
            # A loopback trusted proxy is the only source allowed to attest HTTPS.
            for host in (HOST, "iridescently.xyz", "huiguan.iridescently.xyz"):
                status, headers, _, _ = request(connect, "http", "/__server/status", host=host,
                                                headers={"X-Forwarded-Proto": "https"})
                assert status == 200, host
                assert headers["Strict-Transport-Security"] == ("max-age=2592000" if host == HOST else "max-age=86400")
                assert ("Content-Security-Policy" in headers) == (host == HOST)
                assert "Content-Security-Policy-Report-Only" in headers
                checks += 1
            status, headers, body, _ = request(connect, "http", "/missing-security-test.js",
                                              headers={"X-Forwarded-Proto": "https"})
            assert status == 404 and headers["Server"] == "Iridescently"
            assert all(word not in body for word in (b"Python", b"BaseHTTP", b"Error code explanation"))
            checks += 1
            # Keep-alive requests must return to Dispatcher before parsing a new Host.
            raw = socket.create_connection(connect, timeout=10)
            raw.sendall(("GET /__server/status HTTP/1.1\r\nHost: " + HOST +
                         "\r\nX-Forwarded-Proto: https\r\n\r\nGET / HTTP/1.1\r\n"
                         "Host: evil.example\r\nConnection: close\r\n\r\n").encode())
            wire = b""
            while chunk := raw.recv(65536):
                wire += chunk
            raw.close()
            assert b"200 OK" in wire and b"421 Misdirected Request" in wire
            checks += 1
            # Host spellings that must never reach an application handler. Trailing
            # dots are rejected here; nginx ($host) and the Cloudflare edge strip them.
            for value in ('zszm.iridescently.xyz.', '[zszm.iridescently.xyz]', '[v1.zszm.iridescently.xyz]',
                          '[::ffff:127.0.0.1]:443', 'zszm.iridescently.xyz:443:443', 'zszm%2eiridescently.xyz',
                          'zszm.iridescently.xyz%00', 'zszm.iridescently.xyz\\evil.example', 'zszm.iridescently.xyz#',
                          'zszm.iridescently.xyz?', 'xn--zszm.iridescently.xyz', '.zszm.iridescently.xyz',
                          'zszm..iridescently.xyz', 'zszm.iridescently.xyz.evil.example:443'):
                assert normalize_host(value) not in APPROVED_HOSTS, value
                status, headers, _, _ = request(connect, 'http', '/', host=value, headers={'X-Forwarded-Proto': 'https'})
                assert status == 421 and 'Location' not in headers, (value, status)
                checks += 1
            def exchange(data):
                raw = socket.create_connection(connect, timeout=10)
                raw.sendall(data)
                wire = b''
                while chunk := raw.recv(65536):
                    wire += chunk
                raw.close()
                return wire
            # Folded, NUL, empty, missing and case-variant duplicate Host header lines.
            for lines in ('Host: ' + HOST + '\r\n evil.example', 'Host: ' + HOST + '\r\nhost: evil.example',
                          'Host: ' + HOST + '\x00', 'Host:', 'Host: ' + HOST + '\r\nHOST: ' + HOST, 'X-Host: ' + HOST):
                wire = exchange(('GET /__server/status HTTP/1.1\r\n' + lines + '\r\nX-Forwarded-Proto: https\r\n'
                                 'Connection: close\r\n\r\n').encode('latin-1'))
                assert wire.startswith((b'HTTP/1.1 421 ', b'HTTP/1.1 400 ')), (lines, wire[:60])
                checks += 1
            # An absolute-form request target never chooses the redirect authority.
            for xfp in ('', 'X-Forwarded-Proto: https\r\n'):
                head = exchange(('GET http://evil.example/x HTTP/1.1\r\nHost: ' + HOST + '\r\n' + xfp +
                                 'Connection: close\r\n\r\n').encode()).split(b'\r\n\r\n', 1)[0].decode('latin-1')
                location = next((line.split(':', 1)[1].strip() for line in head.split('\r\n')[1:]
                                 if line.lower().startswith('location:')), None)
                assert location is None or location.startswith('https://' + HOST + '/'), (xfp, head[:200])
                assert xfp or location == 'https://' + HOST + '/', head[:200]
                checks += 1
            # The HTTPS upgrade keeps pathname/query but can never change authority.
            for path in ('//evil.example', '/\\evil.example', '/%2F%2Fevil.example', '/%252F%252Fevil.example',
                         '/.//evil.example', '/@evil.example', '/%5C%5Cevil.example', '/?next=https://evil.example',
                         '/__server/select?return=https%3A%2F%2Fevil.example', '/a?b=1&c=%2F%2Fevil'):
                status, headers, body, _ = request(connect, 'http', path)
                location = headers.get('Location', '')
                assert status == 308 and body == b'' and location.startswith('https://' + HOST + '/'), (path, status, location)
                # http.server may collapse a leading '//' to '/'; every other path is kept byte for byte.
                assert path.startswith('//') or location == 'https://' + HOST + path, (path, location)
                checks += 1
            # Client-supplied forwarding headers must never reach an upstream, for the
            # HTTP proxy and the raw WebSocket relay alike.
            heads = []
            upstream = socket.create_server(('127.0.0.1', 0))
            def capture():
                while True:
                    try:
                        peer, _ = upstream.accept()
                    except OSError:
                        return
                    with peer:
                        data = b''
                        while b'\r\n\r\n' not in data and (chunk := peer.recv(65536)):
                            data += chunk
                        heads.append(data.split(b'\r\n\r\n', 1)[0].decode('latin-1'))
                        peer.sendall(b'HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')
            threading.Thread(target=capture, daemon=True).start()
            injected = {'X-Forwarded-Host': 'evil.example', 'Forwarded': 'host=evil.example;proto=http',
                        'X-Original-Host': 'evil.example', 'X-Host': 'evil.example', 'X-Forwarded-Server': 'evil.example',
                        'X-Forwarded-Port': '8443', 'X-Forwarded-Prefix': '/evil', 'X-Original-URL': '/admin',
                        'X-Rewrite-URL': '/admin', 'X-Forwarded-Scheme': 'http', 'X-Forwarded-Ssl': 'off',
                        'X-Url-Scheme': 'http', 'Front-End-Https': 'off'}
            saved = dict(portal.PROXY_PORTS)
            portal.PROXY_PORTS.update({name: upstream.getsockname()[1] for name in saved})
            try:
                request(connect, 'http', '/api/ingress-forwarding-test', headers={'X-Forwarded-Proto': 'https', **injected})
                request(connect, 'http', '/app/modules/softie/api/spirit-room/ws', headers={
                    'X-Forwarded-Proto': 'https', 'Upgrade': 'websocket', 'Connection': 'Upgrade',
                    'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version': '13', **injected})
            finally:
                portal.PROXY_PORTS.update(saved); upstream.close()
            assert len(heads) == 2, heads
            for head in heads:
                received = [line.split(':', 1) for line in head.split('\r\n')[1:]]
                names = [name.strip().lower() for name, _ in received]
                values = {name.strip().lower(): value.strip() for name, value in received}
                assert values.get('x-forwarded-host') == HOST and values.get('x-forwarded-proto') == 'https', head
                assert names.count('x-forwarded-host') == 1 and names.count('x-forwarded-proto') == 1, head
                assert not set(names) & ({name.lower() for name in injected} - {'x-forwarded-host'}), head
                assert 'evil' not in head and '/admin' not in head, head
                checks += 1
        finally:
            server.shutdown(); server.server_close()
        print(f"PASS: {checks} HTTP/Host/header/forwarding/error/keep-alive checks")
        if Path('/srv/iridescently').is_dir() and sys.platform.startswith('linux'):
            # The production stage runner executes this as the service user. Read every
            # kernel listening socket without root, then speak to each non-loopback one:
            # a Tunnel-only origin may expose SSH, never anything answering HTTP or TLS.
            protected = {80, 443, 4173, 5174, 5177, 5178, 8080, 18180, 18190}
            listeners = set()
            for file in ('/proc/net/tcp', '/proc/net/tcp6'):
                for line in Path(file).read_text().splitlines()[1:]:
                    fields = line.split()
                    address, port = fields[1].split(':')
                    if fields[3] == '0A':
                        packed = bytes.fromhex(address)
                        listeners.add((ipaddress.ip_address(b''.join(packed[i:i+4][::-1] for i in range(0,len(packed),4))), int(port, 16)))
            exposed = []
            for ip, port in sorted(listeners, key=lambda item: (item[1], str(item[0]))):
                if ip.is_loopback or getattr(ip, 'ipv4_mapped', None) and ip.ipv4_mapped.is_loopback:
                    continue
                assert port not in protected, ('protected port bound beyond loopback', str(ip), port)
                reply = b''
                for target in (('127.0.0.1', '::1') if ip.is_unspecified else (str(ip),)):
                    try:
                        with socket.create_connection((target, port), timeout=2) as probe:
                            probe.settimeout(2)
                            probe.sendall(b'GET / HTTP/1.0\r\nHost: ' + HOST.encode() + b'\r\n\r\n')
                            reply = probe.recv(16)
                        break
                    except OSError:
                        continue
                kind = ('http' if reply.startswith(b'HTTP/') else 'tls' if reply[:1] in (b'\x15', b'\x16')
                        else 'ssh' if reply.startswith(b'SSH-') else 'other')
                exposed.append({'address': str(ip), 'port': port, 'protocol': kind})
                assert kind not in ('http', 'tls'), ('non-loopback listener answers HTTP/TLS', str(ip), port)
            print('ORIGIN-LISTENERS ' + json.dumps({'listening': len(listeners), 'non_loopback': exposed}))
        else:
            print('ORIGIN-LISTENERS ' + json.dumps({'skipped': 'not the HK runtime'}))
        if not chooser:
            return
        # Execute the existing chooser script; do not alter its return filtering.
        select = (ROOT / "ops/server-public/select").read_text("utf-8")
        script = select.split("<script>", 1)[1].split("</script>", 1)[0]
        js = """const vm=require('node:vm'),assert=require('node:assert/strict');
const source=JSON.parse(process.argv[1]);
for(const dest of ['//evil.example','\\\\\\\\evil.example','https://evil.example','javascript:alert(1)','/\\\\evil.example','/safe?a=1']){
 const nodes={stable:{},preview:{},'pc-state':{}};
 const ctx={location:{hostname:'zszm.iridescently.xyz',search:'?return='+encodeURIComponent(dest)},URLSearchParams,
 document:{getElementById:id=>nodes[id]},AbortSignal,fetch:()=>Promise.reject(Error())};
 vm.runInNewContext(source,ctx);
 assert.equal(nodes.stable.href,'https://zszm.iridescently.xyz'+(dest==='/safe?a=1'?dest:'/'));
}
// Raw (single/double encoded, control-character) queries: the authority must stay fixed.
for(const search of ['?return=%2F%2Fevil.example','?return=%252F%252Fevil.example','?return=%5C%5Cevil.example',
  '?return=%2F%5Cevil.example','?return=/%2F/evil.example','?return=%09//evil.example','?return=/%09/evil.example',
  '?return=/%0d%0a/evil.example','?return=https%253A%252F%252Fevil.example','?return=/@evil.example']){
 const nodes={stable:{},preview:{},'pc-state':{}};
 vm.runInNewContext(source,{location:{hostname:'zszm.iridescently.xyz',search},URLSearchParams,
  document:{getElementById:id=>nodes[id]},AbortSignal,fetch:()=>Promise.reject(Error())});
 assert.equal(new URL(nodes.stable.href).hostname,'zszm.iridescently.xyz',search);
 assert.equal(new URL(nodes.preview.href).hostname,'pc-zszm.iridescently.xyz',search);
} console.log('PASS: existing chooser keeps its authority for sixteen return payloads');"""
        subprocess.run(["node", "-e", js, json.dumps(script)], check=True)
        # Huiguan's post-login return target: exact registered HTTPS hosts only.
        page = (ROOT / "portal/huiguan/index.html").read_text("utf-8")
        start = page.index("const AUTH_NEXT_HOSTS")
        block = page[start:page.index("window.__AUTH_NEXT =", start)]
        js = r"""const vm=require('node:vm'),assert=require('node:assert/strict');
const block=JSON.parse(process.argv[1]),approved=JSON.parse(process.argv[2]);
const run=tail=>vm.runInNewContext(block+';'+tail,{URL,URLSearchParams});
assert.deepEqual(Array.from(run('[...AUTH_NEXT_HOSTS].sort()')),approved);  // copy out of the vm realm
const next=search=>run('safeAuthNext(new URLSearchParams('+JSON.stringify(search)+').get("next")||"")');
const reject=['https://evil-iridescently.xyz/','https://eviliridescently.xyz/x','https://iridescently.xyz.evil.example/',
 'https://zszm.iridescently.xyz@evil.example/','https://evil.example\\@zszm.iridescently.xyz/','https://evil.example#@zszm.iridescently.xyz/',
 'http://zszm.iridescently.xyz/','javascript:alert(1)//https://zszm.iridescently.xyz/','//evil.example','\\\\evil.example','/\\evil.example',
 'https://zszm.iridescently.xyz:8443/','https://unregistered.iridescently.xyz/','https://zszm.iridescently.xyz./',
 'data:text/html,<script>alert(1)</script>','https://user:pass@zszm.iridescently.xyz/','https:\\\\evil.example',
 'https://evil.example/https://zszm.iridescently.xyz/',''].map(value=>'?next='+encodeURIComponent(value))
 .concat(['?next=%252F%252Fevil.example','?next=https%253A%252F%252Fevil.example','?next=%2F%2Fevil.example',
  '?next=https://evil%2Diridescently.xyz/','?next=https:%2F%2Fevil.example%23.iridescently.xyz/','?next']);
for(const search of reject)assert.equal(next(search),'',search);
for(const [value,expected] of [['https://zszm.iridescently.xyz/#home','https://zszm.iridescently.xyz/#home'],
 ['https://ZSZM.iridescently.xyz/app?x=1','https://zszm.iridescently.xyz/app?x=1'],
 ['https://zszm.iridescently.xyz:443/a','https://zszm.iridescently.xyz/a'],
 ['https://pc-zszm.iridescently.xyz/app/shell/m/slay','https://pc-zszm.iridescently.xyz/app/shell/m/slay'],
 ['https://huiguan.iridescently.xyz/haibao/?x=%2F%2Fevil.example','https://huiguan.iridescently.xyz/haibao/?x=%2F%2Fevil.example']])
 assert.equal(next('?next='+encodeURIComponent(value)),expected,value);
console.log('PASS: Huiguan login next rejects '+reject.length+' payloads and keeps 5 approved targets');"""
        subprocess.run(["node", "-e", js, json.dumps(block), json.dumps(sorted(APPROVED_HOSTS))], check=True)


def public_checks(hosts, edge_ip, evidence):
    """Fill `evidence` as checks pass, so a failing run still records what it saw."""
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    def get_json(url):
        with opener.open(urllib.request.Request(url, headers={"Accept": "application/dns-json"}), timeout=15) as response:
            return json.load(response)
    ip_ranges = get_json('https://api.cloudflare.com/client/v4/ips')
    assert ip_ranges.get('success'), ip_ranges
    networks = [ipaddress.ip_network(value) for key in ('ipv4_cidrs','ipv6_cidrs') for value in ip_ranges['result'][key]]
    cloudflare = lambda ip: any(ipaddress.ip_address(ip) in network for network in networks)
    # Two runs only count as two networks when these egress addresses differ.
    with opener.open('https://www.cloudflare.com/cdn-cgi/trace', timeout=15) as response:
        trace = dict(line.split('=', 1) for line in response.read().decode().splitlines() if '=' in line)
    evidence.update({"at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                     "mode": "pre-DNS pinned edge " + edge_ip if edge_ip else "public DNS",
                     "egress": {key: trace.get(key) for key in ('ip', 'colo', 'loc', 'warp')},
                     "network_environment": "this runner only; repeat from a second network and compare egress.ip",
                     "hosts": list(hosts), "dns": [], "checks": []})
    def addresses(host):
        if edge_ip:
            return [edge_ip]
        found = set()
        for resolver in ("https://cloudflare-dns.com/dns-query", "https://dns.google/resolve"):
            for kind, number in (("A", 1), ("AAAA", 28)):
                result = get_json(resolver + "?name=" + host + "&type=" + kind)
                ips = [r["data"] for r in result.get("Answer", []) if r["type"] == number]
                assert result.get("Status") == 0 and (ips or kind == "AAAA"), ("DNS unavailable", resolver, host, result)
                assert all(cloudflare(ip) for ip in ips), ("DNS answer outside Cloudflare", host, ips)
                evidence["dns"].append({"resolver": resolver, "host": host, "type": kind, "addresses": ips})
                found.update(ip for ip in ips if kind == "A")
        return sorted(found)
    if edge_ip:
        assert cloudflare(edge_ip), ("pinned address is not a Cloudflare edge", edge_ip)
    # Negatives first: they do not depend on the redirect rule or restored DNS.
    ip = edge_ip or addresses(hosts[0])[0]
    for sni, host in ((HOST, 'evil.example'), ('evil.example', HOST), ('evil.example', 'evil.example'),
                      ('unregistered-isolation.iridescently.xyz', 'unregistered-isolation.iridescently.xyz')):
        try:
            status, headers, body, _ = request((ip,443),'https','/',host=host,sni=sni)
            assert status >= 400 and b'id="root"' not in body and b'iridescently-shell-view' not in body, (sni,host,status)
            outcome = {'status':status}
        except ssl.SSLError as error:
            outcome = {'tls_rejected':str(error)}
        evidence['checks'].append({'ip':ip,'sni':sni,'host':host,**outcome})
    # Unknown names over HTTP are rejected outright, never redirected to the main site.
    for host in ('unregistered-isolation.iridescently.xyz', 'evil.example', 'evil-iridescently.xyz'):
        status, headers, body, _ = request((ip, 80), 'http', '/', host=host)
        assert status >= 400 and 'Location' not in headers, (host, status, headers.get('Location'))
        assert b'id="root"' not in body and b'iridescently-shell-view' not in body, host
        evidence['checks'].append({'ip': ip, 'scheme': 'http', 'host': host, 'status': status})
    for host in hosts:
        for ip in addresses(host):
            # HTTP may only answer with a same-host HTTPS first hop, path and query intact.
            for path in PATHS:
                status, headers, body, _ = request((ip, 80), "http", path, host=host)
                assert status in (301, 308), (host, ip, path, status, "edge HTTP->HTTPS rule missing?")
                assert headers.get("Location") == "https://" + host + path, (host, ip, path, headers.get("Location"))
                assert len(body) < 2048, (host, path, "HTTP returned application content")
                evidence["checks"].append({"ip": ip, "host": host, "scheme": "http", "path": path, "status": status,
                                           "location": headers["Location"]})
            if edge_ip:
                continue  # the HTTPS application path needs restored DNS/Tunnel routing
            for start in PATHS:
                url = "https://" + host + start
                visited = set()
                for hop in range(6):
                    assert url not in visited, ("redirect loop", url)
                    visited.add(url)
                    parts = urlsplit(url)
                    assert parts.scheme == "https" and parts.hostname in APPROVED_HOSTS and not parts.username, url
                    if parts.hostname != host:
                        # Approved cross-host hop; that host is validated by its own entry.
                        evidence["checks"].append({"ip": ip, "host": host, "start": start, "cross_host_redirect": url})
                        break
                    path = parts.path + (("?" + parts.query) if parts.query else "")
                    status, headers, body, cert = request((ip, 443), "https", path, host=host)
                    assert status < 500 and status != 403, (host, path, status)
                    hsts = headers.get("Strict-Transport-Security", "")
                    age = next((int(part.split("=", 1)[1]) for part in hsts.replace(" ", "").split(";")
                                if part.lower().startswith("max-age=") and part.split("=", 1)[1].isdigit()), 0)
                    assert age >= (2592000 if host == HOST else 86400), (host, path, "HSTS missing/short", hsts)
                    # This phase forbids includeSubDomains/preload: not every subdomain is HTTPS-only yet.
                    assert "includesubdomains" not in hsts.lower() and "preload" not in hsts.lower(), (host, hsts)
                    assert host != HOST or headers.get("Content-Security-Policy"), (path, "enforced CSP missing")
                    evidence["checks"].append({"ip": ip, "host": host, "scheme": "https", "path": path, "status": status,
                                               "location": headers.get("Location"), "hsts": hsts, "certificate": cert})
                    location = headers.get("Location")
                    if status in (301, 302, 303, 307, 308):
                        assert location, (status, "missing Location")
                        url = urljoin(url, location)
                        continue
                    if start == "/":
                        assert status == 200 and b"<html" in body[:4096].lower(), (host, start, status)
                    if host == HOST and start in ("/", "/app", "/app/shell/"):
                        assert status == 200 and (b'id="root"' in body or b'iridescently-shell-view' in body), (start, status)
                    break
                else:
                    raise AssertionError(("too many redirects", host, start))
            if host == HOST and not edge_ip:
                # nginx serves the chooser directly; its return filter must be the reviewed one.
                _, _, body, _ = request((ip, 443), "https", "/__server/select", host=host)
                assert b"if(!dest.startsWith('/')||dest.startsWith('//')||dest.includes('\\\\'))dest='/';" in body, "chooser filter"
                evidence["checks"].append({"ip": ip, "host": host, "chooser_sha256": hashlib.sha256(body).hexdigest(),
                    "chooser_matches_repository": body == (ROOT / "ops/server-public/select").read_bytes()})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public", action="store_true")
    parser.add_argument("--edge-ip", help="with --public: pin one Cloudflare edge address and skip DNS (pre-restore gate)")
    parser.add_argument("--hosts", default=",".join(RESTORE_HOSTS), help="with --public: comma-separated hostnames")
    parser.add_argument("--host-only", action="store_true", help="production stage gate; no browser/Node fixtures required")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.public:
        result = {}
        try:
            hosts = [h.strip() for h in args.hosts.split(",") if h.strip()]
            assert hosts and set(hosts) <= PRODUCTION_HOSTS, ("unregistered --hosts", hosts)
            public_checks(hosts, args.edge_ip, result)
        except Exception as error:
            result.update(ok=False, error=str(error))
        else:
            result["ok"] = True
        if args.output:
            args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(0 if result["ok"] else 1)
    else:
        local_checks(chooser=not args.host_only)
