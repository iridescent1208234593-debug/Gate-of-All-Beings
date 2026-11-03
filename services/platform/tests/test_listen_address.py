"""Python entry points listen on loopback unless development explicitly asks for HOST (issue #33)."""
import contextlib
import io
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest

PLATFORM = Path(__file__).resolve().parents[1]
CODE_ROOT = PLATFORM.parents[1]
sys.path.insert(0, str(PLATFORM))
from listen_address import LOOPBACK, listen_host

ENTRY_POINTS = ("apps/www/server.py", "apps/huiguan/server_huiguan.py", "apps/oc/server.py",
                "services/platform/portal_server.py")

# Runs an entry point's real __main__ block; the server binds an ephemeral port on the address
# the entry point chose, reports it and whether other local interfaces can reach it, then exits.
PROBE = r'''
import http.server, json, runpy, socket, sys
sys.path.insert(0, sys.argv[2])
from storage_paths import initialize_storage
initialize_storage()
Real = http.server.ThreadingHTTPServer
class Probe(Real):
    def __init__(self, address, handler, *args, **kwargs):
        self.requested = address[0]
        super().__init__((address[0], 0), handler, *args, **kwargs)
    def serve_forever(self, *args, **kwargs):
        port = self.server_address[1]
        reach = {}
        for ip in sys.argv[3:]:
            try:
                socket.create_connection((ip, port), timeout=1).close()
                reach[ip] = True
            except OSError:
                reach[ip] = False
        print("LISTEN " + json.dumps({"requested": self.requested, "bound": self.server_address[0], "reach": reach}), flush=True)
        self.server_close()
        raise SystemExit(0)
http.server.ThreadingHTTPServer = Probe
runpy.run_path(sys.argv[1], run_name="__main__")
'''


def interface_addresses():
    """Non-loopback IPv4 addresses of this host (the 'external NIC' a LAN peer would use)."""
    found = set()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("192.0.2.1", 9))  # no packet is sent for UDP connect
            found.add(probe.getsockname()[0])
    except OSError:
        pass
    try:
        found.update(info[4][0] for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET))
    except OSError:
        pass
    return sorted(ip for ip in found if not ip.startswith("127.") and ip != "0.0.0.0")


class ListenHostRule(unittest.TestCase):
    def test_non_development_always_uses_loopback(self):
        for environment in (None, "production", "staging", "test", "", "prod", "unknown"):
            for host in (None, "", "0.0.0.0", "::", "192.168.1.10"):
                env = {}
                if environment is not None:
                    env["IRIDESCENTLY_ENVIRONMENT"] = environment
                if host is not None:
                    env["HOST"] = host
                with self.subTest(env=env), contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(listen_host(env), LOOPBACK)

    def test_development_needs_explicit_host_for_lan(self):
        self.assertEqual(listen_host({"IRIDESCENTLY_ENVIRONMENT": "development"}), LOOPBACK)
        self.assertEqual(listen_host({"IRIDESCENTLY_ENVIRONMENT": "development", "HOST": "  "}), LOOPBACK)
        self.assertEqual(listen_host({"IRIDESCENTLY_ENVIRONMENT": " Development ", "HOST": "0.0.0.0"}), "0.0.0.0")

    def test_no_entry_point_hardcodes_a_wildcard_bind(self):
        for relative in ENTRY_POINTS:
            source = (CODE_ROOT / relative).read_text(encoding="utf-8")
            with self.subTest(relative):
                self.assertNotIn('"0.0.0.0"', source)
                self.assertNotIn("'0.0.0.0'", source)
                self.assertIn("listen_host()", source)


class EntryPointsBindLoopback(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix="listen-address-")
        cls.addClassCleanup(cls.temporary.cleanup)
        cls.interfaces = interface_addresses()

    def launch(self, relative, environment, host=None):
        storage = Path(self.temporary.name) / f"{Path(relative).stem}-{environment}-{host}"
        env = {k: v for k, v in os.environ.items() if not k.startswith("IRIDESCENTLY_") and k != "HOST"}
        env.update(IRIDESCENTLY_STORAGE_ROOT=str(storage), IRIDESCENTLY_ENVIRONMENT=environment,
                   IRIDESCENTLY_PROJECT_ROOT=str(CODE_ROOT), PYTHONUTF8="1", PYTHONDONTWRITEBYTECODE="1",
                   HX_SSO_SECRET="listen-address-test-secret")
        env.setdefault("USSO_CLIENT_SECRET", "mock-secret")
        env.setdefault("ZSZM_CLIENT_SECRET", "mock-secret")
        if host is not None:
            env["HOST"] = host
        result = subprocess.run([sys.executable, "-X", "utf8", "-c", PROBE, str(CODE_ROOT / relative), str(PLATFORM),
                                 *self.interfaces], cwd=str(CODE_ROOT), env=env, capture_output=True,
                                text=True, encoding="utf-8", errors="replace", timeout=120)
        lines = [line for line in result.stdout.splitlines() if line.startswith("LISTEN ")]
        self.assertTrue(lines, f"{relative} did not start\nstdout:\n{result.stdout[-2000:]}\nstderr:\n{result.stderr[-4000:]}")
        return json.loads(lines[-1][len("LISTEN "):])

    def test_default_and_non_development_bind_loopback_only(self):
        # "test" stands in for every non-development environment: production/staging storage cannot be
        # initialized without a verified migration manifest, and the rule above covers their names.
        for relative in ENTRY_POINTS:
            for environment, host in (("test", None), ("test", "0.0.0.0"), ("development", None)):
                with self.subTest(relative, environment=environment, host=host):
                    report = self.launch(relative, environment, host)
                    self.assertEqual(report["requested"], LOOPBACK)
                    self.assertEqual(report["bound"], LOOPBACK)
                    self.assertFalse(any(report["reach"].values()), report)

    def test_development_lan_bind_is_explicit(self):
        report = self.launch("apps/oc/server.py", "development", "0.0.0.0")
        self.assertEqual(report["bound"], "0.0.0.0")
        self.assertTrue(all(report["reach"].values()), report)


if __name__ == "__main__":
    print("non-loopback interfaces probed:", interface_addresses() or "none (reachability not exercised)")
    unittest.main(verbosity=2)
