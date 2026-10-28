"""One explicit domain map for ingress, authentication, assets and deployment.

The map prepares hosts; it makes no claim about DNS or external OAuth registration.
Cookies and signed SSO audiences stay within one configured registrable root.
"""
import ipaddress
import json
import os
from pathlib import Path
import re
from urllib.parse import urlsplit, urlunsplit

CONFIG = json.loads((Path(__file__).resolve().parents[2] / "packages" / "site-domains" / "domains.json").read_text(encoding="utf-8"))
ROOTS = tuple(CONFIG["roots"])
SITE_DOMAIN = os.environ.get("SITE_DOMAIN", CONFIG["defaultRoot"]).strip()
if SITE_DOMAIN not in ROOTS:
    raise ValueError("SITE_DOMAIN must be an explicitly approved root")
_configured = os.environ.get("IRIDESCENTLY_ALLOWED_DOMAINS", ",".join(ROOTS)).split(",")
if len(_configured) != len(set(_configured)) or any(root not in ROOTS for root in _configured) or SITE_DOMAIN not in _configured:
    raise ValueError("IRIDESCENTLY_ALLOWED_DOMAINS must contain unique approved roots including SITE_DOMAIN")
ALLOWED_ROOTS = tuple(_configured)
HOST_MAP = {f"{prefix}.{root}" if prefix else root: (service, root)
            for root in ALLOWED_ROOTS for service, prefix in CONFIG["services"].items()}
PRODUCTION_HOSTS = frozenset(HOST_MAP)
DEVELOPMENT_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})
# PC preview host -> the application host it mirrors (pc.R -> R, pc-<prefix>.R -> <prefix>.R).
PREVIEW_HOSTS = {preview: preview[3:] for preview in CONFIG["previewHosts"]}
if any(host not in HOST_MAP for host in PREVIEW_HOSTS.values()):
    raise ValueError("every preview host must mirror an approved application host")
_AUTHORITY = re.compile(r"\A[A-Za-z0-9.\[\]:-]+\Z")
_DNS = re.compile(r"\A[a-z0-9]+(?:[.-][a-z0-9]+)*\Z")


def normalize_host(value, allow_any_port=False):
    # Host grammar only: urlsplit alone tolerates an empty port, port 0 and bracketed names.
    if not isinstance(value, str) or not _AUTHORITY.fullmatch(value) or value.endswith(":"):
        return None
    try:
        parsed = urlsplit("//" + value)
        host, port = parsed.hostname, parsed.port
        if not host or parsed.username is not None or parsed.path or parsed.query or parsed.fragment:
            return None
        if host.endswith(".") or port == 0 or (port is not None and port not in (80, 443) and not allow_any_port):
            return None
        if ":" in host or "[" in value:
            ipaddress.IPv6Address(host)
        elif not _DNS.fullmatch(host.lower()) or len(host) > 253 or any(len(label) > 63 for label in host.split(".")):
            return None
        return host.lower()
    except ValueError:
        return None


def domain_root(host):
    return HOST_MAP.get(normalize_host(host), (None, None))[1]


def service_name(host):
    return HOST_MAP.get(normalize_host(host), (None, None))[0]


def site_url(service, path="", host=None):
    prefix = CONFIG["services"][service]
    root = domain_root(host) if host and host not in DEVELOPMENT_HOSTS else SITE_DOMAIN
    if not root:
        raise ValueError("cannot construct URLs from an unapproved host")
    return "https://" + (prefix + "." if prefix else "") + root + path


def localize_url(value, host):
    """A stored absolute link to one of our hosts, moved to the same service on the request's root."""
    if not isinstance(value, str) or not value.lower().startswith(("https://", "http://")):
        return value
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        return value
    target = HOST_MAP.get((parsed.hostname or "").lower())
    root = domain_root(host) if host else None
    if not target or not root or target[1] == root or port or parsed.username or parsed.password:
        return value
    return site_url(target[0], urlunsplit(("", "", parsed.path or "/", parsed.query, parsed.fragment)), host)


def request_host(handler):
    external = getattr(handler, "_external_host", None)
    if external in PRODUCTION_HOSTS:
        return external
    headers = getattr(handler, "headers", {})
    raw = headers.get("Host", "")
    host = normalize_host(raw, allow_any_port=True)
    if host in PRODUCTION_HOSTS:
        return host
    # Backends bind loopback; ingress replaces, rather than trusts, forwarded identity.
    peer = getattr(handler, "client_address", ("",))[0]
    try:
        loopback = ipaddress.ip_address(peer).is_loopback
    except ValueError:
        loopback = False
    if loopback and host in DEVELOPMENT_HOSTS:
        forwarded = headers.get("X-Forwarded-Host", "")
        if forwarded in PRODUCTION_HOSTS:
            return forwarded
    return host if host in DEVELOPMENT_HOSTS else None


def request_root(handler):
    host = request_host(handler)
    if host in DEVELOPMENT_HOSTS or handler is None:
        return SITE_DOMAIN
    root = domain_root(host)
    if not root:
        raise ValueError("request has no approved domain")
    return root


def cookie_domain(handler):
    return "" if request_host(handler) in DEVELOPMENT_HOSTS else "; Domain=." + request_root(handler)


def allowed_origin(origin, host=None, *, referer=False):
    if not isinstance(origin, str) or not origin:
        return False
    try:
        parsed = urlsplit(origin)
        if parsed.username is not None or parsed.password is not None or parsed.fragment:
            return False
        if not referer and (parsed.path or parsed.query):
            return False
        origin_host = normalize_host(parsed.netloc, allow_any_port=True)
        # Explicit ports, spelling, and scheme matter; do not normalize attacker input.
        if parsed.scheme == "https" and parsed.netloc == origin_host and origin_host in PRODUCTION_HOSTS:
            return not host or domain_root(origin_host) == domain_root(host)
        environment = os.environ.get("IRIDESCENTLY_ENVIRONMENT", "production").lower()
        local_origins = {f"http://{name}:{port}" for name in ("localhost", "127.0.0.1") for port in CONFIG["localPorts"]}
        return environment in ("development", "test") and origin.split("/", 3)[:3] == ["http:", "", parsed.netloc] and \
            ("http://" + parsed.netloc) in local_origins and (not host or host in DEVELOPMENT_HOSTS)
    except ValueError:
        return False


def request_origin_allowed(handler, *, missing=True):
    headers = handler.headers
    origins = headers.get_all("Origin", []) if hasattr(headers, "get_all") else [headers["Origin"]] if headers.get("Origin") else []
    if len(origins) > 1:
        return False
    value = origins[0] if origins else (headers.get_all("Referer", [""])[0] if hasattr(headers, "get_all") else headers.get("Referer", ""))
    if value and request_host(handler) in DEVELOPMENT_HOSTS and os.environ.get("IRIDESCENTLY_ENVIRONMENT") == "test":
        # Integration servers use an OS-assigned loopback port; only their exact origin is accepted.
        parsed = urlsplit(value)
        if parsed.scheme == "http" and parsed.netloc == headers.get("Host", "") and not parsed.username and not parsed.password:
            return not origins or (not parsed.path and not parsed.query and not parsed.fragment)
    return allowed_origin(value, request_host(handler), referer=not origins) if value else missing


def cors_headers(handler, *, credentials=True):
    origin = handler.headers.get("Origin", "")
    if not origin or not request_origin_allowed(handler, missing=False):
        return []
    result = [("Access-Control-Allow-Origin", origin), ("Vary", "Origin")]
    if credentials:
        result.append(("Access-Control-Allow-Credentials", "true"))
    return result


class OAuthUnavailable(ValueError):
    """The request root has no callback registered with the external provider."""


def _oauth_callback_roots():
    # Provider registrations change outside this repository; deployments list what is registered.
    override = os.environ.get("IRIDESCENTLY_OAUTH_CALLBACK_ROOTS", "").strip()
    configured = json.loads(override) if override else {key: value["callbackRoots"] for key, value in CONFIG["oauth"].items()}
    if not isinstance(configured, dict) or set(configured) - set(CONFIG["oauth"]):
        raise ValueError("IRIDESCENTLY_OAUTH_CALLBACK_ROOTS names an unknown OAuth service")
    result = {}
    for service in CONFIG["oauth"]:
        roots = configured.get(service, [])
        if not isinstance(roots, list) or len(roots) != len(set(roots)) or any(root not in ALLOWED_ROOTS for root in roots):
            raise ValueError("OAuth callback roots must be unique allowed roots")
        result[service] = tuple(roots)
    return result


OAUTH_CALLBACK_ROOTS = _oauth_callback_roots()


def oauth_callback(service, host=None):
    """Callback on the request's own root; never redirects a login to another registrable domain."""
    if service not in OAUTH_CALLBACK_ROOTS:
        raise ValueError("service has no registered callback contract")
    roots = OAUTH_CALLBACK_ROOTS[service]
    if host and host not in DEVELOPMENT_HOSTS:
        root = domain_root(host)
    else:
        root = SITE_DOMAIN if SITE_DOMAIN in roots else (roots[0] if roots else None)
    if root not in roots:
        raise OAuthUnavailable(f"{service} OAuth callback is not registered for this domain")
    prefix = CONFIG["services"][service]
    return "https://" + (prefix + "." if prefix else "") + root + CONFIG["oauth"][service]["path"]


def valid_callback(value, service):
    return value in {oauth_callback(service, root) for root in OAUTH_CALLBACK_ROOTS.get(service, ())}


def csp_policy(root=None):
    """Report-only policy naming only the hosts of the page's own root."""
    root = root or SITE_DOMAIN
    if root not in ALLOWED_ROOTS:
        raise ValueError("CSP root must be an allowed root")
    hosts = sorted(host for host, (_, host_root) in HOST_MAP.items() if host_root == root)
    origins = " ".join("https://" + host for host in hosts)
    sockets = " ".join("wss://" + host for host in hosts)
    return "; ".join((
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://static.cloudflareinsights.com " + origins + " https://*.paypal.com https://*.paypalobjects.com",
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net " + origins,
        "img-src 'self' data: blob: " + origins + " https://*.paypal.com https://*.paypalobjects.com",
        "font-src 'self' data: https://cdn.jsdelivr.net " + origins,
        "connect-src 'self' " + origins + " " + sockets + " https://static.cloudflareinsights.com https://*.paypal.com",
        "media-src 'self' data: blob: " + origins,
        "frame-src 'self' " + origins + " https://*.paypal.com",
        "worker-src 'self' blob:",
    ))
