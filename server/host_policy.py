"""Strict host and proxy-header rules for the public portal ingress."""
import ipaddress
from site_domains import DEVELOPMENT_HOSTS, PRODUCTION_HOSTS, normalize_host, request_origin_allowed
FORWARDING_HEADERS = frozenset({
    "forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-port",
    "x-forwarded-prefix", "x-forwarded-proto", "x-forwarded-scheme",
    "x-forwarded-server", "x-forwarded-ssl", "x-original-host", "x-host",
    "x-original-url", "x-rewrite-url", "x-url-scheme", "front-end-https",
    "x-real-ip", "x-client-ip", "true-client-ip", "cf-connecting-ip", "cf-visitor",
})
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


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
    # Navigations from search results, shared links and OAuth providers carry foreign Referers;
    # only state-changing requests and WebSocket upgrades owe a same-root Origin at ingress.
    upgrade = any(value.strip().lower() == "websocket" for value in handler.headers.get_all("Upgrade", []))
    if (upgrade or handler.command not in SAFE_METHODS) and not request_origin_allowed(handler, missing=not upgrade):
        handler.close_connection = True
        handler.send_response_only(403)
        handler.send_header("Content-Length", "0")
        handler.send_header("Connection", "close")
        handler.end_headers()
        return False
    return True
