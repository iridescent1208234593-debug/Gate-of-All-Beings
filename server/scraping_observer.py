"""Small, bounded observe-only request counters for public scraping signals."""

import ipaddress
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import re
import sys
import threading
import time
from urllib.parse import parse_qs, urlsplit
from collections import deque

_lock = threading.Lock()
_windows = {}
_logger = None
_RAY = re.compile(r"^[A-Za-z0-9-]{1,64}$")
_PRODUCTION_HOSTS = frozenset({
    "iridescently.xyz", "www.iridescently.xyz", "huiguan.iridescently.xyz",
    "oc.iridescently.xyz", "spirit.iridescently.xyz", "zszm.iridescently.xyz",
    "game.iridescently.xyz", "juling.iridescently.xyz", "lingjing.iridescently.xyz",
})


class _SafeRotatingHandler(RotatingFileHandler):
    """Observation must never cost the response path: a failed rollover is skipped quietly."""

    def doRollover(self):
        try:
            super().doRollover()
        except OSError:
            if self.stream is None:
                self.stream = self._open()
            self.maxBytes = self.stream.tell() + 5 * 1024 * 1024  # retry after another 5 MiB

    def handleError(self, record):
        pass


def _log():
    global _logger
    if _logger is None:
        root = Path(os.environ.get("IRIDESCENTLY_PROJECT_ROOT", Path(__file__).resolve().parents[1]))
        directory = Path(os.environ.get("IRIDESCENTLY_SCRAPING_LOG_DIR", root / "ops" / "网站恢复" / "logs"))
        directory.mkdir(parents=True, exist_ok=True)
        _logger = logging.getLogger("scraping_observe")
        _logger.setLevel(logging.INFO)
        _logger.propagate = False
        if not _logger.handlers:
            # One file per server process: Windows cannot rename a log another process holds open,
            # so a shared file made every request retry a failing rollover and dump a traceback.
            name = "scraping-%s.log" % (Path(sys.argv[0]).stem or "app")
            _logger.addHandler(_SafeRotatingHandler(directory / name, maxBytes=5 * 1024 * 1024,
                                                    backupCount=5, encoding="utf-8"))
    return _logger


def get_client_identity(handler):
    """Trust edge identity only on the configured production Tunnel path."""
    peer = str(handler.client_address[0])
    try:
        is_loopback = ipaddress.ip_address(peer).is_loopback
    except ValueError:
        is_loopback = False
    ray = str(handler.headers.get("CF-Ray", ""))[:64]
    ray = ray if _RAY.fullmatch(ray) else ""
    host = str(handler.headers.get("Host", "")).strip().lower().split(":", 1)[0]
    is_production_tunnel_path = (
        os.environ.get("IRIDESCENTLY_ENVIRONMENT", "").strip().lower() == "production"
        and is_loopback
        and host in _PRODUCTION_HOSTS
        and bool(ray)
    )
    if is_production_tunnel_path:
        try:
            forwarded = ipaddress.ip_address(str(handler.headers.get("CF-Connecting-IP", "")).strip())
        except ValueError:
            forwarded = None
        if forwarded is not None:
            return str(forwarded), ray, True
    return peer, ray, False


def _category(path, query):
    if path in ("/api/official/characters", "/api/fan/list"):
        return "SEARCH" if query.get("q", [""])[0].strip() else "CHARACTER_LIST"
    if path == "/api/official/character":
        return "CHARACTER_DETAIL"
    if path in ("/api/official/unclassified", "/api/gallery/list"):
        return "GALLERY_LIST"
    if path.startswith(("/api/official/img", "/api/official/unclassified-img", "/assets/uploads/", "/gallery-files/")):
        if query.get("t", [""])[0] == "1" or "/thumb" in path:
            return "MEDIA_THUMB"
        if "display" in path or "derivative" in path:
            return "MEDIA_DISPLAY"
        return "MEDIA_ORIGINAL"
    if path.startswith("/api/"):
        return "OTHER_API"
    return "PAGE"


def observe(handler):
    """Record safe public-request metadata; no blocking thresholds are configured."""
    if handler.command not in ("GET", "HEAD"):
        return
    parsed = urlsplit(handler.path)
    query = parse_qs(parsed.query, keep_blank_values=True)
    category = _category(parsed.path, query)
    if category == "OTHER_API" and not parsed.path.startswith(("/api/official/", "/api/fan/", "/api/gallery/")):
        return
    identity, ray, trusted = get_client_identity(handler)
    now = time.monotonic()
    resource = (query.get("id") or query.get("cid") or query.get("page") or [""])[0][:80]
    key = (identity, category)
    with _lock:
        events = _windows.get(key)
        if events is None:
            if len(_windows) >= 2048:
                oldest = min(_windows, key=lambda item: _windows[item][0][0])
                _windows.pop(oldest, None)
            events = deque()
            _windows[key] = events
        events.append((now, resource))
        while events and now - events[0][0] > 60:
            events.popleft()
        count_10 = sum(ts >= now - 10 for ts, _ in events)
        count_60 = len(events)
        unique_60 = len({value for _, value in events if value})
        pages_60 = len({value for _, value in events if value}) if category in ("GALLERY_LIST", "CHARACTER_LIST", "SEARCH") else 0
    status = 0
    size = "unknown"
    for header in getattr(handler, "_headers_buffer", ()):
        lower = header.lower()
        if header.startswith(b"HTTP/"):
            match = re.search(rb"\s(\d{3})\s", header)
            if match:
                status = int(match.group(1))
        elif lower.startswith(b"content-length:"):
            size = header.split(b":", 1)[1].strip().decode("ascii", "ignore") or "unknown"
    _log().info(
        "SCRAPE_OBSERVE timestamp=%s client=%s trusted_edge=%s cf_ray=%s method=%s category=%s status=%s response_bytes=%s requests_10s=%s requests_60s=%s unique_resources_60s=%s pagination_pages_60s=%s rate_limit_state=OBSERVE_ONLY would_limit=UNASSESSED_NO_THRESHOLD",
        time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), identity, int(trusted), ray or "-",
        handler.command, category, status, size, count_10, count_60, unique_60, pages_60,
    )
