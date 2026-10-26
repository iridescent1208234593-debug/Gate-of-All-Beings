"""A real HTTP error status with game navigation recovery, never an API fallback."""
from pathlib import Path
from urllib.parse import urlsplit


def send_recovery(handler, code):
    # Status and method first: malformed requests reach send_error before a command exists.
    if code not in {404, 502, 503, 504} or getattr(handler, 'command', None) not in {'GET', 'HEAD'}:
        return False
    # Dispatcher strips /app/modules before static serving. The request target
    # retains the public navigation path used to decide whether recovery applies.
    request = getattr(handler, 'requestline', '').split()
    if len(request) < 2:
        return False
    path = urlsplit(request[1]).path
    headers = getattr(handler, 'headers', {})
    navigation = 'text/html' in headers.get('Accept', '') or headers.get('Sec-Fetch-Dest') in {'document', 'iframe'}
    if not navigation:
        return False
    if not path.startswith(('/app/', '/playtest/')) or '/api/' in path:
        return False
    content = (Path(__file__).resolve().parents[2] / 'packages/shared-ui/server-unavailable.html').read_bytes()
    content = content.replace(b'HTTP_STATUS', str(code).encode('ascii'))
    handler.send_response(code)
    handler.send_header('Content-Type', 'text/html; charset=utf-8')
    handler.send_header('Cache-Control', 'no-store')
    handler.send_header('Content-Length', str(len(content)))
    handler.end_headers()
    if handler.command != 'HEAD':
        handler.wfile.write(content)
    return True
