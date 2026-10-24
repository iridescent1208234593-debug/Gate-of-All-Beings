"""Run local ingress regressions, or fail-closed public recovery checks.

  python -X utf8 server/security_ingress_test.py
  python -X utf8 server/security_ingress_test.py --public --output result.json

Public checks use validated DoH answers and normal TLS hostname/chain validation.
They never restore DNS, follow an unknown Location, or disable TLS verification.
"""
import argparse
import contextlib
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
APPROVED_HOSTS = {"iridescently.xyz", "www.iridescently.xyz", "huiguan.iridescently.xyz",
                  "oc.iridescently.xyz", "spirit.iridescently.xyz", HOST,
                  "pc-zszm.iridescently.xyz", "game.iridescently.xyz",
                  "juling.iridescently.xyz", "lingjing.iridescently.xyz"}
PATHS = ["/", "/app", "/app/shell/", "/api/sso-user", "/__server/select",
         "/__server/select?return=%2F%2Fevil.example",
         "/__server/select?return=%5C%5Cevil.example", "/a?b=1"]


def request(connect, scheme, path, host=HOST, headers=None, method="GET"):
    conn = http.client.HTTPConnection(connect[0], connect[1], timeout=15)
    try:
        raw = socket.create_connection(connect, timeout=15)
        cert = None
        if scheme == "https":
            raw = ssl.create_default_context().wrap_socket(raw, server_hostname=host)
            cert = raw.getpeercert()  # OpenSSL already checked hostname and expiry.
        conn.sock = raw
        conn.request(method, path, headers={"Host": host, "Connection": "close", **(headers or {})})
        response = conn.getresponse()
        body = response.read(2 * 1024 * 1024)
        return response.status, dict(response.getheaders()), body, cert
    finally:
        conn.close()


def local_checks():
    # Importing portal creates databases only under this throwaway data root.
    with tempfile.TemporaryDirectory(prefix="ingress-security-") as temporary:
        env = dict(os.environ, IRIDESCENTLY_PROJECT_ROOT=temporary,
                   IRIDESCENTLY_ENVIRONMENT="production", PORT="0")
        if os.environ.get("IRIDESCENTLY_INGRESS_CHILD") != "1":
            env["IRIDESCENTLY_INGRESS_CHILD"] = "1"
            subprocess.run([sys.executable, "-X", "utf8", __file__], env=env, check=True)
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
        finally:
            server.shutdown(); server.server_close()
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
} console.log('PASS: existing chooser rejects six return payloads');"""
        subprocess.run(["node", "-e", js, json.dumps(script)], check=True)
        print(f"PASS: {checks} HTTP/Host/header/error/keep-alive checks")


def public_checks():
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    def get_json(url):
        with opener.open(urllib.request.Request(url, headers={"Accept": "application/dns-json"}), timeout=15) as response:
            return json.load(response)
    answers = []
    networks = []
    for kind in ("v4", "v6"):
        with opener.open("https://www.cloudflare.com/ips-" + kind, timeout=15) as response:
            networks += [ipaddress.ip_network(line) for line in response.read().decode().splitlines() if line]
    for resolver in ("https://cloudflare-dns.com/dns-query", "https://dns.google/resolve"):
        result = get_json(resolver + "?name=" + HOST + "&type=A")
        ips = [r["data"] for r in result.get("Answer", []) if r["type"] == 1]
        assert result.get("Status") == 0 and ips, ("DNS unavailable", resolver, result)
        assert all(any(ipaddress.ip_address(ip) in network for network in networks) for ip in ips), ips
        answers.append({"resolver": resolver, "addresses": ips})
    ips = sorted({ip for answer in answers for ip in answer["addresses"]})
    evidence = {"at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "network_environment": "this runner only; two resolvers are NOT two networks",
                "dns": answers, "checks": []}
    for ip in ips:
        for path in PATHS:
            status, headers, body, _ = request((ip, 80), "http", path)
            assert status in (301, 308), (ip, path, status)
            assert headers.get("Location") == "https://" + HOST + path, (ip, path, headers)
            assert len(body) < 2048, (path, "HTTP returned application content")
            evidence["checks"].append({"ip": ip, "scheme": "http", "path": path, "status": status, "location": headers["Location"]})
        for start in PATHS:
            url = "https://" + HOST + start
            visited = set()
            for hop in range(6):
                assert url not in visited, ("redirect loop", url)
                visited.add(url)
                parts = urlsplit(url)
                assert parts.scheme == "https" and parts.hostname in APPROVED_HOSTS and not parts.username, url
                # Validate every redirect, but never browse another host implicitly.
                if parts.hostname != HOST:
                    raise AssertionError(("cross-host requires separate explicit validation", url))
                path = parts.path + (("?" + parts.query) if parts.query else "")
                status, headers, body, cert = request((ip, 443), "https", path)
                assert status < 500 and status != 403, (path, status)
                assert "max-age=2592000" in headers.get("Strict-Transport-Security", ""), (path, "HSTS missing")
                assert headers.get("Content-Security-Policy"), (path, "enforced CSP missing")
                evidence["checks"].append({"ip":ip,"scheme":"https","path":path,"status":status,
                                           "location":headers.get("Location"),"certificate":cert})
                location = headers.get("Location")
                if status in (301, 302, 303, 307, 308):
                    assert location, (status, "missing Location")
                    url = urljoin(url, location)
                    continue
                if start in ("/", "/app", "/app/shell/"):
                    assert status == 200 and (b'id="root"' in body or b'iridescently-shell-view' in body), (start, status)
                break
            else:
                raise AssertionError(("too many redirects", start))
    return evidence


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.public:
        try:
            result = public_checks()
        except Exception as error:
            result = {"ok": False, "error": str(error)}
        else:
            result["ok"] = True
        if args.output:
            args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(0 if result["ok"] else 1)
    else:
        local_checks()
