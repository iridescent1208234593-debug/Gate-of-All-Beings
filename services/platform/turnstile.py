"""Cloudflare Turnstile verification for account entry points.

Enabled only when TURNSTILE_SECRET is set (the site key alone enables nothing); the secret is
read from the environment and never sent to a browser. Every verification is fail-closed: a
missing, rejected, foreign-host, wrong-action or unverifiable token denies the request.
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

from site_domains import DEVELOPMENT_HOSTS, PRODUCTION_HOSTS, domain_root, request_host

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
# Cloudflare's published test secrets answer with hostname "example.com" and no action.
TEST_SECRETS = frozenset({"1x0000000000000000000000000000000AA", "2x0000000000000000000000000000000AA",
                          "3x0000000000000000000000000000000AA"})
MAX_TOKEN = 2048


def secret():
    return os.environ.get("TURNSTILE_SECRET", "").strip()


def site_key():
    return os.environ.get("TURNSTILE_SITE_KEY", "").strip() if secret() else ""


def enabled():
    return bool(secret())


def _post(url, fields, timeout):
    data = urllib.parse.urlencode(fields).encode()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(urllib.request.Request(url, data=data), timeout=timeout) as response:
        return json.loads(response.read(65536))


def _hostname_allowed(reported, request_host_name):
    if request_host_name in DEVELOPMENT_HOSTS:
        return reported in DEVELOPMENT_HOSTS
    # A form on any approved host of the same root may call this root's account API
    # (for example zszm.<root> posting to huiguan.<root>); other roots and unknown hosts are refused.
    return reported in PRODUCTION_HOSTS and domain_root(reported) == domain_root(request_host_name)


def verify(handler, token, action, remote_ip=None, timeout=5):
    """Return (True, "") when the request may proceed, else (False, reason).

    reason is "missing", "rejected" or "unavailable"; callers map "unavailable" to 503.
    """
    key = secret()
    if not key:
        return True, ""
    if not isinstance(token, str) or not token or len(token) > MAX_TOKEN:
        return False, "missing"
    fields = {"secret": key, "response": token}
    if remote_ip:
        fields["remoteip"] = remote_ip
    url = os.environ.get("TURNSTILE_VERIFY_URL", "").strip() or VERIFY_URL
    try:
        result = _post(url, fields, timeout)
    except (OSError, ValueError, urllib.error.URLError):
        return False, "unavailable"
    if not isinstance(result, dict) or result.get("success") is not True:
        return False, "rejected"
    if key in TEST_SECRETS:
        # A test secret passes every token; it is never valid outside development and test.
        if os.environ.get("IRIDESCENTLY_ENVIRONMENT", "production") not in ("development", "test"):
            return False, "unavailable"
        return True, ""
    if result.get("action") != action or not _hostname_allowed(result.get("hostname"), request_host(handler)):
        return False, "rejected"
    return True, ""
