"""Listening address for the Python HTTP entry points (portal and the standalone www/huiguan/oc).

Every service listens on loopback only: the Cloudflare Tunnel and the portal reach them on the
same host. A LAN debug bind needs both IRIDESCENTLY_ENVIRONMENT=development and an explicit
HOST; in any other environment (including an unset one) HOST is ignored, so a stray HOST=0.0.0.0
can never put a production listener on a public interface.
"""
import os
import sys

LOOPBACK = "127.0.0.1"
_LOOPBACK_NAMES = {LOOPBACK, "localhost", "::1"}


def listen_host(environ=None):
    environ = os.environ if environ is None else environ
    requested = environ.get("HOST", "").strip()
    if environ.get("IRIDESCENTLY_ENVIRONMENT", "production").strip().lower() == "development":
        return requested or LOOPBACK
    if requested and requested.lower() not in _LOOPBACK_NAMES:
        print(f"HOST={requested} ignored: only IRIDESCENTLY_ENVIRONMENT=development may listen beyond {LOOPBACK}",
              file=sys.stderr, flush=True)
    return LOOPBACK
