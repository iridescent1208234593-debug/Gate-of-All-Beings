"""Smoke-check the local loopback services started by tools/runtime/local-runtime.py.

Read-only HTTP probes against 127.0.0.1 for every approved root in
packages/site-domains/domains.json: page and API reachability, the anonymous
original-image refusal, the cross-root Origin refusal for state-changing requests,
the WebSocket Origin check, and the 421 for unknown hosts. Writes nothing; exits
non-zero when any expectation fails.

    python tools/checks/local-smoke.py [--report FILE]
"""
import argparse
import http.client
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
DOMAINS = json.loads((ROOT / "packages/site-domains/domains.json").read_text(encoding="utf-8"))
PORTAL = 8080


def request(host, path, method="GET", headers=None, port=PORTAL):
    method, body = method if isinstance(method, tuple) else (method, None)
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=15)
    try:
        connection.request(method, path, body=body, headers={"Host": host, "X-Forwarded-Proto": "https", **(headers or {})})
        response = connection.getresponse()
        body = response.read()
        return response.status, response.getheader("Content-Type", ""), response.getheader("Location", ""), body
    finally:
        connection.close()


def checks_for(root):
    other = next(r for r in DOMAINS["roots"] if r != root)
    upgrade = {"Connection": "Upgrade", "Upgrade": "websocket", "Sec-WebSocket-Version": "13",
               "Sec-WebSocket-Key": "c21va2UtY2hlY2stb25seQ=="}
    host = lambda name: f"{name}.{root}" if name else root
    return [
        ("apex redirects to huiguan", host(""), "/", {}, "GET", lambda s, t, l, b: s in (301, 302, 307, 308) and l.startswith(f"https://huiguan.{root}/")),
        ("www gallery page", host("www"), "/gallery.html", {}, "GET", lambda s, t, l, b: s == 200 and "text/html" in t),
        ("huiguan page", host("huiguan"), "/", {}, "GET", lambda s, t, l, b: s == 200 and "text/html" in t),
        ("huiguan anonymous user", host("huiguan"), "/api/user", {}, "GET", lambda s, t, l, b: s == 200 and b'"logged_in": false' in b),
        ("official characters", host("huiguan"), "/api/official/characters", {}, "GET", lambda s, t, l, b: s == 200 and "json" in t),
        ("assets manifest", host("huiguan"), "/api/assets/manifest", {}, "GET", lambda s, t, l, b: s == 200 and "json" in t),
        ("original image refused anonymously", host("huiguan"), "/api/original-image?id=1", {}, "GET", lambda s, t, l, b: s in (401, 403)),
        ("zszm page", host("zszm"), "/", {}, "GET", lambda s, t, l, b: s == 200 and "text/html" in t),
        ("zszm anonymous user", host("zszm"), "/api/user", {}, "GET", lambda s, t, l, b: s == 200 and b'"logged_in": false' in b),
        ("zszm sso-user", host("zszm"), "/api/sso-user", {}, "GET", lambda s, t, l, b: s == 200 and b'"logged_in": false' in b),
        ("juling state", host("juling"), "/api/state", {}, "GET", lambda s, t, l, b: s == 200 and "json" in t),
        ("oc page", host("oc"), "/", {}, "GET", lambda s, t, l, b: s == 200 and "text/html" in t),
        # The same-root POST is the control (it reaches validation and gets 400): the refusal below
        # must come from the Origin check, not from the route. The empty body creates nothing.
        ("same-root POST reaches the handler", host("huiguan"), "/api/register", {"Origin": f"https://huiguan.{root}", "Content-Type": "application/json", "Content-Length": "2"}, ("POST", b"{}"), lambda s, t, l, b: s == 400),
        ("cross-root POST refused", host("huiguan"), "/api/register", {"Origin": f"https://huiguan.{other}", "Content-Type": "application/json", "Content-Length": "2"}, ("POST", b"{}"), lambda s, t, l, b: s == 403),
        ("WebSocket from another root refused", host("spirit"), "/", {**upgrade, "Origin": f"https://spirit.{other}"}, "GET", lambda s, t, l, b: s == 403),
        ("WebSocket from a lookalike refused", host("spirit"), "/", {**upgrade, "Origin": f"https://spirit.{root}.evil.example"}, "GET", lambda s, t, l, b: s == 403),
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    results = []
    for root in DOMAINS["roots"]:
        print(f"== {root}")
        for name, host, path, headers, method, expect in checks_for(root):
            try:
                status, kind, location, body = request(host, path, method, headers)
                passed = bool(expect(status, kind, location, body))
                detail = f"{status} {kind.split(';')[0]} {len(body)}" + (f" -> {location}" if location else "")
            except OSError as error:
                passed, detail = False, f"error: {error}"
            results.append({"root": root, "check": name, "passed": passed, "detail": detail})
            print(f"  {'PASS' if passed else 'FAIL'}  {name:<38} {detail}")
    for name, host in (("unknown host refused", "example.com"), ("lookalike host refused", "huiguan.iridescently.xyz.evil.example")):
        status, *_ = request(host, "/")
        results.append({"root": None, "check": name, "passed": status == 421, "detail": str(status)})
        print(f"  {'PASS' if status == 421 else 'FAIL'}  {name:<38} {status}")
    status, *_ = request("127.0.0.1", "/healthz", port=4173)
    results.append({"root": None, "check": "spirit service health", "passed": status == 200, "detail": str(status)})
    passed = sum(r["passed"] for r in results)
    print(f"\n{passed}/{len(results)} checks passed")
    if args.report:
        args.report.write_text(json.dumps({"results": results, "passed": passed == len(results)}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
