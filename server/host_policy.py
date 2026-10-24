"""One hostname source for application, preview gateway, generated config and tests."""
import ipaddress
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

INVENTORY = json.loads(Path(__file__).with_name('allowed_hosts.json').read_text('utf-8'))
PRODUCTION_HOSTS = frozenset(h['hostname'] for h in INVENTORY['hosts'] if h['registered'] and h['node'] == 'hk')
PREVIEW_HOSTS = {h['hostname']: h['application_host'] for h in INVENTORY['hosts'] if h['registered'] and h['node'] == 'pc'}
# Proxy identity, scheme and URL overrides a client could inject. Gateways drop
# all of them and send upstream only values derived from the validated Host.
FORWARDING_HEADERS = frozenset({
    'forwarded', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port', 'x-forwarded-prefix',
    'x-forwarded-server', 'x-forwarded-scheme', 'x-forwarded-ssl', 'x-original-host', 'x-host',
    'x-original-url', 'x-rewrite-url', 'x-url-scheme', 'front-end-https'})


def normalize_host(value):
    # Host grammar only (name/IPv4, bracketed IPv6, port). urlsplit alone accepts
    # an empty '#'/'?' suffix, userinfo or path, so reject those characters first.
    if not value or not re.fullmatch(r'[A-Za-z0-9.:\[\]-]+', value) or value.endswith(':'):
        return None
    try:
        parsed = urlsplit('//' + value)
        host, port = parsed.hostname, parsed.port
        if not host or parsed.username is not None or parsed.path or parsed.query or parsed.fragment:
            return None
        if host.endswith('.') or port == 0:
            return None
        if ':' in host or '[' in value:
            # Brackets may only hold IPv6 (never registered). Reject IPvFuture and
            # bracketed names even where urlsplit itself does not validate them.
            ipaddress.IPv6Address(host)
        elif not re.fullmatch(r'[a-z0-9]+(?:[.-][a-z0-9]+)*', host):
            return None
        return host
    except ValueError:
        return None


def enforce_request(handler, allowed, development=False):
    values = handler.headers.get_all('Host', [])
    host = normalize_host(values[0]) if len(values) == 1 else None
    try:
        loopback = ipaddress.ip_address(handler.client_address[0]).is_loopback
    except ValueError:
        loopback = False
    if development and loopback and host in {'127.0.0.1', 'localhost', '::1'}:
        return True
    if host not in allowed:
        # JSON encoding escapes CR/LF; no request query, cookies or token is logged.
        print(json.dumps({'event': 'host_rejected', 'host': (values[0] if values else '')[:253],
                          'host_count': len(values)}, ensure_ascii=True), flush=True)
        handler.close_connection = True
        handler.send_response_only(421)
        handler.send_header('Content-Length', '0')
        handler.send_header('Connection', 'close')
        handler.end_headers()
        return False
    https = loopback and handler.headers.get_all('X-Forwarded-Proto', []) == ['https']
    if not https and not development:
        handler.close_connection = True
        handler.send_response_only(308)
        handler.send_header('Location', 'https://' + host + (handler.path if handler.path.startswith('/') else '/'))
        handler.send_header('Content-Length', '0')
        handler.send_header('Connection', 'close')
        handler.end_headers()
        return False
    return True
