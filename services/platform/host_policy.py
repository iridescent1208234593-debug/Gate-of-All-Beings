"""Strict host and proxy-header rules for the public portal ingress."""
import ipaddress
import json
import os
import re
from site_domains import DEVELOPMENT_HOSTS, PREVIEW_HOSTS, PRODUCTION_HOSTS, normalize_host, request_origin_allowed
# Proxy identity, scheme and URL overrides a client could inject. The edge proxy clears
# these before the portal; it keeps the edge-attested client IP the portal rate-limits on.
IDENTITY_OVERRIDE_HEADERS = frozenset({
    "forwarded", "x-forwarded-host", "x-forwarded-port", "x-forwarded-prefix",
    "x-forwarded-proto", "x-forwarded-scheme", "x-forwarded-server", "x-forwarded-ssl",
    "x-original-host", "x-host", "x-original-url", "x-rewrite-url", "x-url-scheme", "front-end-https",
})
# Relays to internal upstreams also drop client-IP claims; upstreams trust only rebuilt identity.
FORWARDING_HEADERS = IDENTITY_OVERRIDE_HEADERS | frozenset({
    "x-forwarded-for", "x-real-ip", "x-client-ip", "true-client-ip", "cf-connecting-ip", "cf-visitor",
})
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
_CF_RAY = re.compile(r"^[A-Za-z0-9-]{1,64}$")


def _header_values(headers, name):
    get_all = getattr(headers, "get_all", None)
    if get_all is not None:
        return list(get_all(name, []) or [])
    value = headers.get(name)
    return [] if value is None else [value]


def _is_loopback(address):
    try:
        return ipaddress.ip_address(str(address)).is_loopback
    except ValueError:
        return False


def edge_client_identity(handler):
    """-> (client_ip, cf_ray, trusted): the client IP to rate-limit and log on.

    CF-Connecting-IP is believed only on the production Tunnel path that enforce_request
    attested for this request (production environment, loopback peer, registered Host,
    visitor HTTPS) and only when that request also carries a well-formed CF-Ray and exactly
    one parseable CF-Connecting-IP. Every other request, including a standalone app server,
    is identified by its TCP peer. X-Real-IP, X-Forwarded-For and the like are never read:
    the edge chain passes them through or only appends to them, so a client controls them.
    """
    peer = str((getattr(handler, "client_address", None) or ("",))[0])
    headers = getattr(handler, "headers", None) or {}
    rays = _header_values(headers, "CF-Ray")
    ray = str(rays[0]).strip() if len(rays) == 1 else ""
    ray = ray if _CF_RAY.fullmatch(ray) else ""
    if getattr(handler, "_edge_identity_trusted", False) is True and _is_loopback(peer) and ray:
        claimed = _header_values(headers, "CF-Connecting-IP")
        if len(claimed) == 1:
            try:
                return str(ipaddress.ip_address(str(claimed[0]).strip())), ray, True
            except ValueError:
                pass
    return peer, ray, False


def trusted_client_ip(handler):
    """The rate-limit identity of a request; see edge_client_identity."""
    return edge_client_identity(handler)[0]


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
    # Reset first: a keep-alive connection reuses one handler for every request on it.
    handler._edge_identity_trusted = False
    values = handler.headers.get_all("Host", [])
    try:
        loopback = ipaddress.ip_address(handler.client_address[0]).is_loopback
    except ValueError:
        loopback = False
    host = normalize_host(values[0], allow_any_port=environment == "development" and loopback) if len(values) == 1 else None
    development = environment == "development" and loopback and host in DEVELOPMENT_HOSTS
    if not development and host not in PRODUCTION_HOSTS:
        # JSON escapes CR/LF; the request target, cookies and tokens are never logged.
        print(json.dumps({"event": "host_rejected", "host": (values[0] if values else "")[:253],
                          "host_count": len(values)}, ensure_ascii=True), flush=True)
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
    # Only this ingress may vouch for CF-Connecting-IP (see edge_client_identity). Both the
    # caller's mode and the process environment must say production: the portal defaults to
    # production when IRIDESCENTLY_ENVIRONMENT is unset, storage defaults to development.
    handler._edge_identity_trusted = (
        secure and environment == "production" and host in PRODUCTION_HOSTS
        and os.environ.get("IRIDESCENTLY_ENVIRONMENT", "").strip().lower() == "production")
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
