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

    def test_same_service_origin_excludes_sibling_subdomains(self):
        # Opt-in (issue #41): the default stays same-root for every existing caller.
        cases = [("https://www.iridescently.cn", "www.iridescently.cn", True),
                 ("https://iridescently.cn", "www.iridescently.cn", True),
                 ("https://www.iridescently.cn", "iridescently.cn", True),
                 ("https://huiguan.iridescently.cn", "huiguan.iridescently.cn", True),
                 ("https://oc.iridescently.cn", "www.iridescently.cn", False),
                 ("https://huiguan.iridescently.cn", "www.iridescently.cn", False),
                 ("https://zszm.iridescently.cn", "iridescently.cn", False),
                 ("https://www.iridescently.xyz", "www.iridescently.cn", False),
                 ("https://www.iridescently.cn", None, False),
                 ("https://pc-www.iridescently.xyz", "www.iridescently.xyz", False)]
        for origin, host, expected in cases:
            with self.subTest(origin=origin, host=host):
                self.assertEqual(site_domains.allowed_origin(origin, host, same_service=True), expected)
        self.assertTrue(site_domains.allowed_origin("https://oc.iridescently.cn", "www.iridescently.cn"))


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


class ThreeRootIsolationMatrix(unittest.TestCase):
    """Symmetric coverage for all three approved roots; the classes above use one or two as examples."""

    def test_domain_map_is_exactly_each_service_on_each_approved_root(self):
        config = json.loads((ROOT / "packages/site-domains/domains.json").read_text(encoding="utf-8"))
        self.assertEqual(tuple(config["roots"]), ROOTS)
        self.assertEqual(tuple(site_domains.ROOTS), ROOTS)
        self.assertEqual(tuple(site_domains.ALLOWED_ROOTS), ROOTS)
        expected = {f"{prefix}.{root}" if prefix else root
                    for root in ROOTS for prefix in config["services"].values()}
        self.assertEqual(set(site_domains.PRODUCTION_HOSTS), expected)
        self.assertEqual(len(site_domains.HOST_MAP), len(expected))
        for root in ROOTS:
            for service, prefix in config["services"].items():
                host = f"{prefix}.{root}" if prefix else root
                self.assertEqual(site_domains.HOST_MAP[host], (service, root))
        for preview, target in site_domains.PREVIEW_HOSTS.items():
            self.assertEqual(preview[3:], target)
            self.assertIn(target, site_domains.PRODUCTION_HOSTS)
        for bare in ("iridescently", "xyz", "cn", "dpdns.org"):
            self.assertNotIn(bare, site_domains.PRODUCTION_HOSTS)

    def test_every_root_signs_reads_and_rejects_sso_cookies_by_root(self):
        for root in ROOTS:
            token = hx_sso.make_token("test-account", "local", "Test Account", root_domain=root)
            for host in (root, "huiguan." + root, "zszm." + root, "oc." + root):
                with self.subTest(root=root, host=host):
                    headers = Message()
                    headers["Host"] = host
                    headers["Cookie"] = "hx_sso=" + token
                    payload = hx_sso.read_cookie(headers)
                    self.assertIsNotNone(payload)
                    self.assertEqual((payload["uid"], payload["aud"]), ("test-account", root))
            for other in set(ROOTS) - {root}:
                with self.subTest(root=root, other=other):
                    self.assertIsNone(hx_sso.verify_token(token, other))
                    headers = Message()
                    headers["Host"] = "huiguan." + other
                    headers["Cookie"] = "hx_sso=" + token
                    self.assertIsNone(hx_sso.read_cookie(headers))

    def test_cookie_scope_and_request_root_ignore_forged_forwarding_headers(self):
        for root in ROOTS:
            for other in set(ROOTS) - {root}:
                with self.subTest(root=root, other=other):
                    request = Request([
                        ("Host", "huiguan." + root),
                        ("X-Forwarded-Proto", "https"),
                        ("X-Forwarded-Host", "huiguan." + other),
                        ("Forwarded", f"host=huiguan.{other};proto=http"),
                    ])
                    self.assertTrue(enforce_request(request, "production"), request.response)
                    self.assertEqual(request._external_host, "huiguan." + root)
                    self.assertEqual(site_domains.request_root(request), root)
                    domain = site_domains.cookie_domain(request)
                    self.assertEqual(domain, "; Domain=." + root)
                    self.assertNotIn("." + other, domain)

    def test_remote_peer_cannot_forge_https_or_forwarded_identity(self):
        for root in ROOTS:
            for other in set(ROOTS) - {root}:
                with self.subTest(root=root, other=other):
                    request = Request([
                        ("Host", "huiguan." + root),
                        ("X-Forwarded-Proto", "https"),
                        ("X-Forwarded-Host", "huiguan." + other),
                        ("Forwarded", f"host=huiguan.{other};proto=https"),
                    ], peer="203.0.113.9")
                    self.assertFalse(enforce_request(request, "production"))
                    self.assertEqual(request.response[0], ("status", 308))
                    self.assertEqual(request.response[1], ("Location", "https://huiguan." + root + "/"))
                    self.assertFalse(request._edge_identity_trusted)

    def test_registered_host_spellings_with_default_ports_and_case_are_accepted(self):
        for root in ROOTS:
            for host in (root, "huiguan." + root):
                for authority in (host, host.upper(), host + ":80", host + ":443"):
                    with self.subTest(host=authority):
                        request, accepted = ingress(authority)
                        self.assertTrue(accepted, request.response)
                        self.assertEqual(request._external_host, host)

    def test_preview_asset_and_legacy_hosts_are_not_application_entries(self):
        for host in (*site_domains.PREVIEW_HOSTS, "assets.iridescently.xyz",
                     "psy.iridescently.xyz", "psyche.iridescently.cn", "account.iridescently.xyz",
                     "feather.iridescently.dpdns.org", "backup.iridescently.xyz",
                     "origin-zszm.iridescently.xyz", "hk-zszm-check.iridescently.cn"):
            with self.subTest(host=host):
                request, accepted = ingress(host)
                self.assertFalse(accepted)
                self.assertEqual(request.response[0], ("status", 421))

    def test_duplicate_and_lookalike_hosts_across_roots_are_rejected(self):
        for root in ROOTS:
            for other in set(ROOTS) - {root}:
                with self.subTest(root=root, other=other):
                    request, accepted = ingress("huiguan." + root, ("Host", "huiguan." + other))
                    self.assertFalse(accepted)
                    self.assertEqual(request.response[0], ("status", 421))
                    for host in (f"huiguan.{root}.{other}", f"{root}.{other}", f"{other}.{root}",
                                 "huiguan." + root + ".", "huiguan." + root + ":8443",
                                 "huiguan." + root + ", evil.example", "huiguan." + root + "@evil.example"):
                        request, accepted = ingress(host)
                        self.assertFalse(accepted, host)
                        self.assertEqual(request.response[0], ("status", 421), host)

    def test_write_origin_matrix_allows_only_the_target_root(self):
        for root in ROOTS:
            target = "huiguan." + root
            for origin in (f"https://{root}", f"https://huiguan.{root}",
                           f"https://zszm.{root}", f"https://spirit.{root}"):
                with self.subTest(root=root, origin=origin):
                    request, accepted = ingress(target, ("Origin", origin), command="POST")
                    self.assertTrue(accepted, request.response)
            for other in set(ROOTS) - {root}:
                for origin in (f"https://{other}", f"https://huiguan.{other}",
                               f"https://zszm.{other}", f"https://spirit.{other}"):
                    with self.subTest(root=root, origin=origin):
                        request, accepted = ingress(target, ("Origin", origin), command="POST")
                        self.assertFalse(accepted)
                        self.assertEqual(request.response[0], ("status", 403))
                with self.subTest(root=root, referer=other):
                    request, accepted = ingress(target, ("Referer", f"https://huiguan.{other}/form"),
                                                command="POST")
                    self.assertFalse(accepted)
                    self.assertEqual(request.response[0], ("status", 403))
            for origin in ("null", f"http://huiguan.{root}", f"https://huiguan.{root}:444",
                           f"https://huiguan.{root}/path", f"https://huiguan.{root}.evil.example",
                           "https://evil.example"):
                with self.subTest(root=root, origin=origin):
                    request, accepted = ingress(target, ("Origin", origin), command="POST")
                    self.assertFalse(accepted)
                    self.assertEqual(request.response[0], ("status", 403))

    def test_credentialed_cors_matrix_echoes_only_the_target_root(self):
        for root in ROOTS:
            for origin in (f"https://{root}", f"https://zszm.{root}"):
                request = Request([("Host", "huiguan." + root), ("Origin", origin)])
                request._external_host = "huiguan." + root
                self.assertIn(("Access-Control-Allow-Origin", origin), site_domains.cors_headers(request))
            for other in set(ROOTS) - {root}:
                for origin in (f"https://{other}", f"https://zszm.{other}"):
                    request = Request([("Host", "huiguan." + root), ("Origin", origin)])
                    request._external_host = "huiguan." + root
                    self.assertEqual(site_domains.cors_headers(request), [], origin)

    def test_websocket_origin_matrix_allows_only_the_target_root(self):
        upgrade = (("Upgrade", "websocket"), ("Connection", "Upgrade"))
        for root in ROOTS:
            target = "zszm." + root
            for origin in (f"https://{root}", f"https://zszm.{root}", f"https://spirit.{root}"):
                with self.subTest(root=root, origin=origin):
                    request, accepted = ingress(target, *upgrade, ("Origin", origin))
                    self.assertTrue(accepted, request.response)
            for other in set(ROOTS) - {root}:
                for origin in (f"https://{other}", f"https://zszm.{other}", f"https://spirit.{other}"):
                    with self.subTest(root=root, origin=origin):
                        request, accepted = ingress(target, *upgrade, ("Origin", origin))
                        self.assertFalse(accepted)
                        self.assertEqual(request.response[0], ("status", 403))
                with self.subTest(root=root, duplicate=other):
                    request, accepted = ingress(target, *upgrade,
                                                ("Origin", f"https://zszm.{root}"),
                                                ("Origin", f"https://zszm.{other}"))
                    self.assertFalse(accepted)
                    self.assertEqual(request.response[0], ("status", 403))
                with self.subTest(root=root, referer=other):
                    request, accepted = ingress(target, *upgrade,
                                                ("Referer", f"https://zszm.{other}/app"))
                    self.assertFalse(accepted)
                    self.assertEqual(request.response[0], ("status", 403))
            for origin in (None, "null", f"http://zszm.{root}", f"https://zszm.{root}:444",
                           f"https://zszm.{root}/app", "https://evil.example"):
                with self.subTest(root=root, origin=origin):
                    headers = (*upgrade, ("Origin", origin)) if origin else upgrade
                    request, accepted = ingress(target, *headers)
                    self.assertFalse(accepted)
                    self.assertEqual(request.response[0], ("status", 403))
            with self.subTest(root=root, origin="valid-with-foreign-referer"):
                request, accepted = ingress(target, *upgrade, ("Origin", f"https://zszm.{root}"),
                                            ("Referer", "https://evil.example/app"))
                self.assertTrue(accepted, request.response)


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

    def test_stored_own_domain_links_follow_the_readers_root(self):
        cases = [
            ("https://huiguan.iridescently.xyz/api/official/img-id?id=1&t=1", "zszm.iridescently.cn",
             "https://huiguan.iridescently.cn/api/official/img-id?id=1&t=1"),
            ("https://iridescently.xyz/", "huiguan.iridescently.dpdns.org", "https://iridescently.dpdns.org/"),
            ("http://zszm.iridescently.xyz/#home", "oc.iridescently.cn", "https://zszm.iridescently.cn/#home"),
            ("https://zszm.iridescently.xyz/#home", "zszm.iridescently.xyz", "https://zszm.iridescently.xyz/#home"),
            ("https://example.com/x", "zszm.iridescently.cn", "https://example.com/x"),
            ("https://huiguan.iridescently.xyz:8443/x", "zszm.iridescently.cn", "https://huiguan.iridescently.xyz:8443/x"),
            ("https://huiguan.iridescently.xyz.evil.example/", "zszm.iridescently.cn", "https://huiguan.iridescently.xyz.evil.example/"),
            ("/relative/path", "zszm.iridescently.cn", "/relative/path"),
            (42, "zszm.iridescently.cn", 42),
        ]
        script = ("const d=require('./packages/site-domains/index.js');const c=JSON.parse(process.argv[1]);"
                  "console.log(JSON.stringify(c.map(([v,h])=>d.localizeUrl(v,h))));")
        node = subprocess.run(["node", "-e", script, json.dumps([[v, h] for v, h, _ in cases])],
                              cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(node.returncode, 0, node.stderr)
        for (value, host, expected), browser in zip(cases, json.loads(node.stdout)):
            with self.subTest(value=value, host=host):
                self.assertEqual(site_domains.localize_url(value, host), expected)
                self.assertEqual(browser, expected)

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

    def test_browser_map_keeps_every_approved_root_separate(self):
        script = r"""
const d=require('./packages/site-domains/index.js');
const roots=['iridescently.xyz','iridescently.cn','iridescently.dpdns.org'];
const out={};
for(const root of roots){
  const other=roots.find(value=>value!==root);
  out[root]={
    root:d.rootFor('zszm.'+root),
    sameRoot:d.safeReturn('https://huiguan.'+root+'/x','oc.'+root),
    crossRoot:d.safeReturn('https://huiguan.'+other+'/x','oc.'+root),
    url:d.url('zszm','/#home','huiguan.'+root),
  };
}
console.log(JSON.stringify(out));"""
        result = subprocess.run(["node", "-e", script], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        value = json.loads(result.stdout)
        for root in ROOTS:
            with self.subTest(root=root):
                self.assertEqual(value[root]["root"], root)
                self.assertEqual(value[root]["sameRoot"], f"https://huiguan.{root}/x")
                self.assertEqual(value[root]["crossRoot"], "")
                self.assertEqual(value[root]["url"], f"https://zszm.{root}/#home")

    def test_source_has_no_unreviewed_absolute_own_domain_urls(self):
        result = subprocess.run([sys.executable, "-X", "utf8", "tools/domains/check-domain-hardcodes.py"], cwd=ROOT,
                                env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
