"""Multi-root readiness: hosts, origins, WebSockets, cookies, SSO, OAuth and CSP stay per root."""
from email.message import Message
from io import BytesIO
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from testing_storage import configure

_TEMP = tempfile.TemporaryDirectory(prefix="site-domains-")
configure(_TEMP.name)
os.environ["HX_SSO_SECRET"] = "site-domain-test-secret"

import hx_sso  # noqa: E402
import site_domains  # noqa: E402
from base_static import BaseStaticHandler  # noqa: E402
from host_policy import enforce_request  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
ROOTS = ("iridescently.xyz", "iridescently.cn", "iridescently.dpdns.org")


class Request:
    def __init__(self, headers, peer="127.0.0.1", path="/", command="GET"):
        self.headers = Message()
        for name, value in headers:
            self.headers[name] = value
        self.client_address = (peer, 40000)
        self.path = path
        self.command = command
        self.close_connection = False
        self.response = []

    def send_response_only(self, status):
        self.response.append(("status", status))

    def send_header(self, name, value):
        self.response.append((name, value))

    def end_headers(self):
        self.response.append(("end", None))


def ingress(host, *headers, command="GET", peer="127.0.0.1"):
    request = Request([("Host", host), ("X-Forwarded-Proto", "https"), *headers], peer=peer, command=command)
    return request, enforce_request(request, "production")


def isolated_python(code, **environment):
    env = {key: value for key, value in os.environ.items() if key not in ("SITE_DOMAIN", "IRIDESCENTLY_ALLOWED_DOMAINS",
                                                                           "IRIDESCENTLY_OAUTH_CALLBACK_ROOTS")}
    env.update(environment)
    return subprocess.run([sys.executable, "-X", "utf8", "-c", "import sys; sys.path.insert(0, 'services/platform')\n" + code],
                          cwd=ROOT, env=env, capture_output=True, text=True)


class HostAllowlist(unittest.TestCase):
    def test_every_service_host_of_each_approved_root_is_accepted(self):
        services = json.loads((ROOT / "packages/site-domains/domains.json").read_text(encoding="utf-8"))["services"]
        self.assertEqual(site_domains.ALLOWED_ROOTS, ROOTS)
        for root in ROOTS:
            for prefix in services.values():
                host = f"{prefix}.{root}" if prefix else root
                with self.subTest(host=host):
                    request, accepted = ingress(host)
                    self.assertTrue(accepted, request.response)
                    self.assertEqual(request._external_host, host)
                    self.assertEqual(site_domains.domain_root(host), root)

    def test_unknown_lookalike_ip_and_malformed_hosts_are_rejected(self):
        for host in ("evil.example", "iridescently.xyz.evil.example", "huiguan.iridescently.cn.evil.example",
                     "evil-iridescently.cn", "eviliridescently.xyz", "dpdns.org", "x.huiguan.iridescently.dpdns.org",
                     "*.iridescently.cn", "iridescently.cn.", "xn--iridescently-.cn", "127.0.0.1", "[::1]",
                     "203.0.113.5", "zszm.iridescently.dpdns.org:8443", "user@zszm.iridescently.cn", ""):
            with self.subTest(host=host):
                request, accepted = ingress(host)
                self.assertFalse(accepted)
                self.assertEqual(request.response[0], ("status", 421))
        request = Request([("Host", "zszm.iridescently.cn"), ("Host", "zszm.iridescently.xyz"), ("X-Forwarded-Proto", "https")])
        self.assertFalse(enforce_request(request, "production"))
        self.assertEqual(request.response[0], ("status", 421))

    def test_forwarded_host_is_never_trusted_from_remote_peers(self):
        request = Request([("Host", "127.0.0.1"), ("X-Forwarded-Host", "zszm.iridescently.cn")], peer="203.0.113.9")
        self.assertEqual(site_domains.request_host(request), "127.0.0.1")
        self.assertFalse(enforce_request(request, "production"))
        request = Request([("Host", "127.0.0.1"), ("X-Forwarded-Host", "zszm.iridescently.cn")])
        self.assertEqual(site_domains.request_host(request), "zszm.iridescently.cn")
        request = Request([("Host", "127.0.0.1"), ("X-Forwarded-Host", "zszm.iridescently.cn.evil.example")])
        self.assertEqual(site_domains.request_host(request), "127.0.0.1")

    def test_configuration_rejects_unapproved_roots(self):
        for environment in ({"SITE_DOMAIN": "evil.example"}, {"SITE_DOMAIN": "iridescently.cn", "IRIDESCENTLY_ALLOWED_DOMAINS": "iridescently.xyz"},
                            {"IRIDESCENTLY_ALLOWED_DOMAINS": "iridescently.xyz,iridescently.xyz"},
                            {"IRIDESCENTLY_ALLOWED_DOMAINS": "iridescently.xyz,*.iridescently.cn"}):
            with self.subTest(environment=environment):
                self.assertNotEqual(isolated_python("import site_domains", **environment).returncode, 0)
        result = isolated_python("import site_domains; print(sorted(site_domains.PRODUCTION_HOSTS))",
                                 IRIDESCENTLY_ALLOWED_DOMAINS="iridescently.xyz")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("iridescently.cn", result.stdout)


class OriginBoundary(unittest.TestCase):
    def test_cross_site_navigation_and_provider_returns_are_not_blocked(self):
        for referer in ("https://www.google.com/search?q=iridescently", "https://iridescently.xyz/gallery.html",
                        "https://sso.umrc.cn/authorize.php?state=x"):
            with self.subTest(referer=referer):
                request, accepted = ingress("huiguan.iridescently.cn", ("Referer", referer))
                self.assertTrue(accepted, request.response)

    def test_state_changing_requests_need_a_same_root_origin(self):
        cases = [("https://huiguan.iridescently.cn", True), ("https://zszm.iridescently.cn", True),
                 ("https://huiguan.iridescently.xyz", False), ("https://evil.example", False),
                 ("null", False), ("http://huiguan.iridescently.cn", False), ("https://huiguan.iridescently.cn:444", False)]
        for origin, expected in cases:
            with self.subTest(origin=origin):
                request, accepted = ingress("huiguan.iridescently.cn", ("Origin", origin), command="POST")
                self.assertEqual(accepted, expected, request.response)
                if not expected:
                    self.assertEqual(request.response[0], ("status", 403))
        request, accepted = ingress("huiguan.iridescently.cn", ("Referer", "https://evil.example/form"), command="POST")
        self.assertFalse(accepted)
        request, accepted = ingress("huiguan.iridescently.cn", ("Origin", "https://huiguan.iridescently.cn"),
                                    ("Origin", "https://evil.example"), command="POST")
        self.assertFalse(accepted)

    def test_websocket_upgrade_requires_an_exact_same_root_origin(self):
        upgrade = (("Upgrade", "websocket"), ("Connection", "Upgrade"))
        for origin, expected in (("https://spirit.iridescently.dpdns.org", True), ("https://zszm.iridescently.dpdns.org", True),
                                 ("https://spirit.iridescently.xyz", False), ("https://evil.example", False), (None, False)):
            with self.subTest(origin=origin):
                headers = (*upgrade, ("Origin", origin)) if origin else upgrade
                request, accepted = ingress("zszm.iridescently.dpdns.org", *headers)
                self.assertEqual(accepted, expected, request.response)

    def test_credentialed_cors_echoes_only_same_root_origins(self):
        request = Request([("Host", "huiguan.iridescently.cn"), ("Origin", "https://zszm.iridescently.cn")])
        request._external_host = "huiguan.iridescently.cn"
        self.assertIn(("Access-Control-Allow-Origin", "https://zszm.iridescently.cn"), site_domains.cors_headers(request))
        for origin in ("https://zszm.iridescently.xyz", "https://evil.example", "*", "null"):
            request = Request([("Host", "huiguan.iridescently.cn"), ("Origin", origin)])
            request._external_host = "huiguan.iridescently.cn"
            self.assertEqual(site_domains.cors_headers(request), [], origin)


class CookiesAndSessions(unittest.TestCase):
    def test_cookie_domain_is_the_request_root_and_never_a_shared_suffix(self):
        for root in ROOTS:
            request = Request([("Host", "huiguan." + root)])
            request._external_host = "huiguan." + root
            self.assertEqual(site_domains.cookie_domain(request), "; Domain=." + root)
        self.assertEqual(site_domains.cookie_domain(Request([("Host", "127.0.0.1:8089")])), "")
        request = Request([("Host", "huiguan.iridescently.dpdns.org")])
        request._external_host = "huiguan.iridescently.dpdns.org"
        self.assertNotEqual(site_domains.cookie_domain(request), "; Domain=.dpdns.org")

    def test_sso_tokens_are_bound_to_their_root(self):
        token = hx_sso.make_token("7", "local", "Owner", root_domain="iridescently.cn")
        self.assertEqual(hx_sso.verify_token(token, "iridescently.cn")["uid"], "7")
        self.assertIsNone(hx_sso.verify_token(token, "iridescently.xyz"))
        self.assertIsNone(hx_sso.verify_token(token, "iridescently.dpdns.org"))
        with self.assertRaises(ValueError):
            hx_sso.make_token("7", "local", "Owner", root_domain="evil.example")
        headers = Message()
        headers["Host"] = "zszm.iridescently.xyz"
        headers["Cookie"] = "hx_sso=" + token
        self.assertIsNone(hx_sso.read_cookie(headers))
        headers.replace_header("Host", "zszm.iridescently.cn")
        self.assertEqual(hx_sso.read_cookie(headers)["uid"], "7")
        headers.replace_header("Host", "evil.example")
        self.assertIsNone(hx_sso.read_cookie(headers))

    def test_tokens_issued_before_audiences_remain_valid_only_on_the_original_root(self):
        import base64
        import hashlib
        import hmac
        import time
        body = base64.urlsafe_b64encode(json.dumps({"uid": "7", "kind": "local", "name": "Owner",
                                                     "exp": int(time.time()) + 60}).encode()).decode().rstrip("=")
        legacy = body + "." + hmac.new(b"site-domain-test-secret", body.encode(), hashlib.sha256).hexdigest()
        self.assertEqual(hx_sso.verify_token(legacy, "iridescently.xyz")["uid"], "7")
        self.assertIsNone(hx_sso.verify_token(legacy, "iridescently.cn"))


class OAuthCallbacks(unittest.TestCase):
    def test_callbacks_exist_only_for_provider_registered_roots(self):
        self.assertEqual(site_domains.oauth_callback("huiguan", "huiguan.iridescently.xyz"), "https://huiguan.iridescently.xyz/cb")
        for host in ("huiguan.iridescently.cn", "huiguan.iridescently.dpdns.org"):
            with self.subTest(host=host), self.assertRaises(site_domains.OAuthUnavailable):
                site_domains.oauth_callback("huiguan", host)
        self.assertTrue(site_domains.valid_callback("https://huiguan.iridescently.xyz/cb", "huiguan"))
        for value in ("https://huiguan.iridescently.cn/cb", "http://huiguan.iridescently.xyz/cb",
                      "https://evil.example/cb", "https://huiguan.iridescently.xyz/cb?next=https://evil.example"):
            self.assertFalse(site_domains.valid_callback(value, "huiguan"), value)
        with self.assertRaises(ValueError):
            site_domains.oauth_callback("oc")

    def test_registering_a_root_adds_exactly_its_own_callback(self):
        result = isolated_python(
            "import site_domains as d; print(d.oauth_callback('huiguan', 'huiguan.iridescently.cn'));"
            "print(d.valid_callback('https://huiguan.iridescently.cn/cb', 'huiguan'));"
            "print(d.valid_callback('https://huiguan.iridescently.dpdns.org/cb', 'huiguan'))",
            IRIDESCENTLY_OAUTH_CALLBACK_ROOTS='{"huiguan": ["iridescently.xyz", "iridescently.cn"]}')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.split(), ["https://huiguan.iridescently.cn/cb", "True", "False"])
        for value in ('{"huiguan": ["evil.example"]}', '{"huiguan": ["iridescently.cn", "iridescently.cn"]}', '{"oc": []}'):
            with self.subTest(value=value):
                self.assertNotEqual(isolated_python("import site_domains", IRIDESCENTLY_OAUTH_CALLBACK_ROOTS=value).returncode, 0)


class ContentSecurityPolicy(unittest.TestCase):
    def test_policy_names_only_its_own_root_without_wildcard_subdomains(self):
        for root in ROOTS:
            policy = site_domains.csp_policy(root)
            self.assertIn("https://zszm." + root, policy)
            self.assertIn("wss://spirit." + root, policy)
            self.assertNotIn("*." + root.split(".")[0], policy)
            for other in set(ROOTS) - {root}:
                self.assertNotIn(other, policy)
        with self.assertRaises(ValueError):
            site_domains.csp_policy("evil.example")

    def test_static_responses_send_the_policy_of_the_request_root(self):
        handler = BaseStaticHandler.__new__(BaseStaticHandler)
        handler.headers = Message()
        handler.headers["Host"] = "oc.iridescently.dpdns.org"
        handler._external_host = "oc.iridescently.dpdns.org"
        handler.client_address = ("127.0.0.1", 40000)
        handler.path, handler.request_version, handler.command = "/", "HTTP/1.1", "GET"
        handler.wfile, handler._headers_buffer = BytesIO(), []
        handler.end_headers()
        sent = handler.wfile.getvalue().decode("latin-1")
        policy = next(line for line in sent.split("\r\n") if line.startswith("Content-Security-Policy-Report-Only:"))
        self.assertIn("https://oc.iridescently.dpdns.org", policy)
        self.assertNotIn("iridescently.xyz", policy)


class BrowserAndNodeParity(unittest.TestCase):
    def test_generated_browser_map_matches_shared_configuration(self):
        result = subprocess.run([sys.executable, "-X", "utf8", "tools/domains/generate-domain-config.py", "--check"],
                                cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_return_urls_and_request_context_stay_within_one_root(self):
        script = r"""
const d = require('./packages/site-domains/index.js');
const socket = remoteAddress => ({ remoteAddress });
const ctx = (headers, rawHeaders, remote = '127.0.0.1') => d.requestContext({ headers, rawHeaders, socket: socket(remote) });
console.log(JSON.stringify({
  sameRoot: d.safeReturn('https://zszm.iridescently.cn/#home', 'huiguan.iridescently.cn'),
  crossRoot: d.safeReturn('https://zszm.iridescently.xyz/#home', 'huiguan.iridescently.cn'),
  unknown: d.safeReturn('https://zszm.iridescently.cn.evil.example/', 'huiguan.iridescently.cn'),
  port: d.safeReturn('https://zszm.iridescently.cn:444/', 'huiguan.iridescently.cn'),
  urlCn: d.url('zszm', '/#home', 'huiguan.iridescently.cn'),
  urlUnknown: d.url('zszm', '/#home', 'evil.example'),
  forwarded: ctx({ host: '127.0.0.1:4173', 'x-forwarded-host': 'spirit.iridescently.dpdns.org', 'x-forwarded-proto': 'https' },
                 ['Host', '127.0.0.1:4173', 'X-Forwarded-Host', 'spirit.iridescently.dpdns.org', 'X-Forwarded-Proto', 'https'])?.origin,
  remoteForwarded: ctx({ host: '127.0.0.1:4173', 'x-forwarded-host': 'spirit.iridescently.cn', 'x-forwarded-proto': 'https' },
                       ['Host', '127.0.0.1:4173', 'X-Forwarded-Host', 'spirit.iridescently.cn', 'X-Forwarded-Proto', 'https'], '203.0.113.9'),
  duplicate: ctx({ host: 'spirit.iridescently.cn' }, ['Host', 'spirit.iridescently.cn', 'Host', 'evil.example']),
}));"""
        env = {key: value for key, value in os.environ.items() if key != "IRIDESCENTLY_ENVIRONMENT"}
        result = subprocess.run(["node", "-e", script], cwd=ROOT, env={**env, "IRIDESCENTLY_ENVIRONMENT": "production"},
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        value = json.loads(result.stdout)
        self.assertEqual(value["sameRoot"], "https://zszm.iridescently.cn/#home")
        self.assertEqual((value["crossRoot"], value["unknown"], value["port"]), ("", "", ""))
        self.assertEqual(value["urlCn"], "https://zszm.iridescently.cn/#home")
        self.assertEqual(value["urlUnknown"], "https://zszm.iridescently.xyz/#home")
        self.assertEqual(value["forwarded"], "https://spirit.iridescently.dpdns.org")
        self.assertIsNone(value["remoteForwarded"])
        self.assertIsNone(value["duplicate"])

    def test_source_has_no_unreviewed_absolute_own_domain_urls(self):
        result = subprocess.run([sys.executable, "-X", "utf8", "tools/domains/check-domain-hardcodes.py"], cwd=ROOT,
                                env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
