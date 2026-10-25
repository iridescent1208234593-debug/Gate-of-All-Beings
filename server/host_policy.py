"""Strict host and proxy-header rules for the public portal ingress."""
import ipaddress
import re
from urllib.parse import urlsplit

PRODUCTION_HOSTS = frozenset({
    "iridescently.xyz", "www.iridescently.xyz", "huiguan.iridescently.xyz",
    "oc.iridescently.xyz", "spirit.iridescently.xyz", "zszm.iridescently.xyz",
    "game.iridescently.xyz", "juling.iridescently.xyz", "lingjing.iridescently.xyz",
})
DEVELOPMENT_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})
FORWARDING_HEADERS = frozenset({
    "forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-port",
    "x-forwarded-prefix", "x-forwarded-proto", "x-forwarded-scheme",
    "x-forwarded-server", "x-forwarded-ssl", "x-original-host", "x-host",
    "x-original-url", "x-rewrite-url", "x-url-scheme", "front-end-https",
    "x-real-ip", "x-client-ip", "true-client-ip", "cf-connecting-ip", "cf-visitor",
})
_HOST_AUTHORITY = re.compile(r"\A[A-Za-z0-9.\[\]:-]+\Z")
_DNS_NAME = re.compile(r"\A[a-z0-9]+(?:[.-][a-z0-9]+)*\Z")


def normalize_host(value, allow_any_port=False):
    """Return a canonical hostname, rejecting malformed authorities and unusual ports."""
    if not value or not _HOST_AUTHORITY.fullmatch(value):
        return None
    try:
        parsed = urlsplit("//" + value)
        host, port = parsed.hostname, parsed.port
        if not host or parsed.username is not None or parsed.path or parsed.query or parsed.fragment:
            return None
        if host.endswith(".") or (port is not None and port not in (80, 443) and not allow_any_port):
            return None
        host = host.lower()
        if ":" in host:
            ipaddress.IPv6Address(host)  # IP literals are parsed but never in the production allowlist.
        elif not _DNS_NAME.fullmatch(host) or len(host) > 253:
            return None
        elif any(len(label) > 63 for label in host.split(".")):
            return None
        return host
    except ValueError:
        return None


def forwarded_headers(incoming, host, secure, websocket=False):
    """Pass app headers through while rebuilding all proxy identity from validated ingress."""
    result = {key: value for key, value in incoming.items()
              if key.lower() not in FORWARDING_HEADERS and key.lower() not in {"host", "connection", "content-length"}}
    result["X-Forwarded-Host"] = host
    result["X-Forwarded-Proto"] = "https" if secure else "http"
    if websocket:
        result["Connection"] = "Upgrade"
        result["Upgrade"] = "websocket"
    return result


def enforce_request(handler, environment="production"):
    values = handler.headers.get_all("Host", [])
    try:
        loopback = ipaddress.ip_address(handler.client_address[0]).is_loopback
    except ValueError:
        loopback = False
    host = normalize_host(values[0], allow_any_port=environment == "development" and loopback) if len(values) == 1 else None
    development = environment == "development" and loopback and host in DEVELOPMENT_HOSTS
    if not development and host not in PRODUCTION_HOSTS:
        handler.close_connection = True
        handler.send_response_only(421)
        handler.send_header("Content-Length", "0")
        handler.send_header("Connection", "close")
        handler.end_headers()
        return False

    forwarded_proto = handler.headers.get_all("X-Forwarded-Proto", [])
    secure = loopback and len(forwarded_proto) == 1 and forwarded_proto[0].strip().lower() == "https"
    if environment != "development" and not secure:
        target = "https://" + host + (handler.path if handler.path.startswith("/") else "/")
        handler.close_connection = True
        handler.send_response_only(308)
        handler.send_header("Location", target)
        handler.send_header("Content-Length", "0")
        handler.send_header("Connection", "close")
        handler.end_headers()
        return False

    handler._external_host = host
    handler._trusted_external_scheme = secure
    return True
