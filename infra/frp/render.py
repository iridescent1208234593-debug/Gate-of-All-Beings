"""Render and check the FRP configs for the three nodes. Secrets stay outside Git.

    python infra/frp/render.py init   --secrets <workspace>/secrets/ops-frp   # new random values, once
    python infra/frp/render.py pki    --secrets <...>                          # CA + certs (openssl), once
    python infra/frp/render.py render --secrets <...>                          # -> <secrets>/rendered/*.toml
    python infra/frp/render.py check  [--secrets <...>]                        # parse + security invariants

`check` without --secrets checks the templates with dummy values (this is what CI and tests run).
It does not replace `frps verify -c` / `frpc verify -c` with the official binary, which deploy scripts
run on each node before starting the service.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import secrets as pysecrets
import subprocess
import sys
import tomllib
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATES = HERE / "templates"
NODES = {"frps.toml": "b", "frpc-b-visitor.toml": "b", "frpc-pc.toml": "pc", "frpc-hk.toml": "hk"}
RANDOM_KEYS = ["FRP_AUTH_TOKEN", "FRPS_DASHBOARD_PASSWORD", "FRPC_PC_ADMIN_PASSWORD", "FRPC_HK_ADMIN_PASSWORD",
               "FRPC_B_ADMIN_PASSWORD", "STCP_KEY_PC_AGENT", "STCP_KEY_HK_AGENT"]
FIXED = {"FRPS_PUBLIC_HOST": "8.148.14.4", "FRPS_PUBLIC_PORT": "55404", "FRPS_BIND_PORT": "4000"}
# PKI_DIR and FRP_LOG_DIR differ per node (Windows vs Linux paths); see NODE_PATHS in values.json.
DEFAULT_NODE_PATHS = {"b": {"PKI_DIR": "/etc/iridescently-ops/frp/pki", "FRP_LOG_DIR": "/var/log/iridescently-ops"},
                      "hk": {"PKI_DIR": "/etc/iridescently-ops/frp/pki", "FRP_LOG_DIR": "/var/log/iridescently-ops"},
                      "pc": {"PKI_DIR": "E:/Iridescently/secrets/ops-frp/pki", "FRP_LOG_DIR": "E:/Iridescently/runtime/ops/logs"}}
SERVER_NAME = "frps.ops.iridescently.internal"
ALLOW_PC_SSH = False  # set by --allow-pc-ssh; see templates/optional/pc-ssh.md
PLACEHOLDER = re.compile(r"\{\{([A-Z0-9_]+)\}\}")


def restrict(path: Path) -> None:
    if os.name == "nt":
        user = os.environ.get("USERNAME", "")
        subprocess.run(["icacls", str(path), "/inheritance:r", "/grant:r", f"{user}:F", "/grant:r", "SYSTEM:F"],
                       capture_output=True, check=False)
    else:
        os.chmod(path, 0o600 if path.is_file() else 0o700)


def values_for(node: str, values: dict) -> dict:
    paths = DEFAULT_NODE_PATHS[node] | values.get("NODE_PATHS", {}).get(node, {})
    return FIXED | {k: v for k, v in values.items() if isinstance(v, str)} | paths


def render_text(template: str, vals: dict) -> str:
    missing = sorted(set(PLACEHOLDER.findall(template)) - vals.keys())
    if missing:
        raise SystemExit("missing values: " + ", ".join(missing))
    return PLACEHOLDER.sub(lambda m: vals[m.group(1)], template)


def dummy_values() -> dict:
    return {k: "x" * 32 for k in RANDOM_KEYS}


def check_one(name: str, text: str) -> list[str]:
    """Security invariants on one rendered config. Returns problems (empty = PASS)."""
    problems = []
    try:
        c = tomllib.loads(text)
    except tomllib.TOMLDecodeError as error:
        return [f"{name}: TOML parse error: {error}"]
    if PLACEHOLDER.search(text):
        problems.append(f"{name}: unresolved placeholder")
    web = c.get("webServer", {})
    if web and web.get("addr") != "127.0.0.1":
        problems.append(f"{name}: webServer must bind 127.0.0.1")
    if web and len(str(web.get("password", ""))) < 16:
        problems.append(f"{name}: webServer password too short")
    a = c.get("auth", {})
    if a.get("method") != "token" or len(str(a.get("token", ""))) < 24:
        problems.append(f"{name}: token auth with a strong token is required")
    tls = c.get("transport", {}).get("tls", {})
    if not tls.get("trustedCaFile"):
        problems.append(f"{name}: TLS peer verification (trustedCaFile) is required")
    if name == "frps.toml":
        if not tls.get("force"):
            problems.append("frps.toml: transport.tls.force must be true")
        if c.get("proxyBindAddr") != "127.0.0.1":
            problems.append("frps.toml: proxyBindAddr must be 127.0.0.1")
        if int(c.get("bindPort", 0)) != int(FIXED["FRPS_BIND_PORT"]):
            problems.append("frps.toml: bindPort differs from the expected provider mapping target")
    else:
        if tls.get("enable") is False:
            problems.append(f"{name}: TLS disabled")
        if tls.get("serverName") != SERVER_NAME:
            problems.append(f"{name}: serverName must be {SERVER_NAME}")
        if c.get("loginFailExit") is not False:
            problems.append(f"{name}: loginFailExit must be false (reconnect forever)")
    for p in c.get("proxies", []):
        if p.get("type") != "stcp":
            problems.append(f"{name}: proxy {p.get('name')} is {p.get('type')}; only stcp is allowed")
        if not p.get("allowUsers") or "*" in p.get("allowUsers", []):
            problems.append(f"{name}: proxy {p.get('name')} needs an explicit allowUsers")
        if p.get("localIP") != "127.0.0.1":
            problems.append(f"{name}: proxy {p.get('name')} must target 127.0.0.1")
        if len(str(p.get("secretKey", ""))) < 24:
            problems.append(f"{name}: proxy {p.get('name')} secretKey too short")
        if name in ("frpc-hk.toml", "frpc-pc.toml") and int(p.get("localPort", 0)) != 18410                 and not (ALLOW_PC_SSH and name == "frpc-pc.toml" and int(p.get("localPort", 0)) == 22):
            problems.append(f"{name}: proxy {p.get('name')} may only publish the read-only agent (18410)")
    for v in c.get("visitors", []):
        if v.get("bindAddr") != "127.0.0.1":
            problems.append(f"{name}: visitor {v.get('name')} must bind 127.0.0.1")
    return problems


def cross_check(rendered: dict[str, str]) -> list[str]:
    """Visitors must match proxies (user, name, key) or the STCP pair can never connect."""
    problems = []
    proxies = {}
    for name, user in (("frpc-pc.toml", "pc"), ("frpc-hk.toml", "hk")):
        for p in tomllib.loads(rendered[name]).get("proxies", []):
            proxies[(user, p["name"])] = p
    vis = tomllib.loads(rendered["frpc-b-visitor.toml"])
    for v in vis.get("visitors", []):
        p = proxies.get((v.get("serverUser"), v.get("serverName")))
        if not p:
            problems.append(f"visitor {v['name']}: no proxy {v.get('serverUser')}.{v.get('serverName')}")
        elif p["secretKey"] != v.get("secretKey"):
            problems.append(f"visitor {v['name']}: secretKey differs from the proxy")
        elif vis.get("user") not in p.get("allowUsers", []):
            problems.append(f"visitor {v['name']}: user {vis.get('user')} not in proxy allowUsers")
    ports = [v["bindPort"] for v in vis.get("visitors", [])]
    if len(ports) != len(set(ports)):
        problems.append("visitor bindPorts collide")
    return problems


def render_all(values: dict) -> dict[str, str]:
    return {name: render_text((TEMPLATES / name).read_text(encoding="utf-8"), values_for(node, values))
            for name, node in NODES.items()}


def cmd_check(values: dict) -> int:
    rendered = render_all(values)
    problems = [p for n, t in rendered.items() for p in check_one(n, t)] + cross_check(rendered)
    for n in rendered:
        print(("FAIL " if any(p.startswith(n) for p in problems) else "PASS ") + n)
    for p in problems:
        print("  - " + p)
    print("PASS cross-check visitors<->proxies" if not cross_check(rendered) else "FAIL cross-check")
    return 1 if problems else 0


def openssl(*args):
    subprocess.run(["openssl", *args], check=True, capture_output=True)


def cmd_pki(sdir: Path) -> None:
    pki = sdir / "pki"
    pki.mkdir(parents=True, exist_ok=True)
    restrict(pki)
    if not (pki / "ca.key").exists():
        openssl("req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-days", "3650",
                "-subj", "/CN=iridescently-ops-frp-ca", "-keyout", str(pki / "ca.key"), "-out", str(pki / "ca.crt"))
    for who, san in (("frps", f"DNS:{SERVER_NAME}"), ("frpc-pc", "DNS:frpc-pc.ops.iridescently.internal"),
                     ("frpc-hk", "DNS:frpc-hk.ops.iridescently.internal"), ("frpc-b", "DNS:frpc-b.ops.iridescently.internal")):
        if (pki / f"{who}.crt").exists():
            continue
        ext = pki / f"{who}.ext"
        usage = "serverAuth" if who == "frps" else "clientAuth"
        ext.write_text(f"subjectAltName={san}\nextendedKeyUsage={usage}\nkeyUsage=digitalSignature,keyEncipherment\n")
        openssl("req", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-subj", f"/CN={who}",
                "-keyout", str(pki / f"{who}.key"), "-out", str(pki / f"{who}.csr"))
        openssl("x509", "-req", "-in", str(pki / f"{who}.csr"), "-CA", str(pki / "ca.crt"), "-CAkey", str(pki / "ca.key"),
                "-CAcreateserial", "-days", "825", "-extfile", str(ext), "-out", str(pki / f"{who}.crt"))
        (pki / f"{who}.csr").unlink(); ext.unlink()
    for f in pki.iterdir():
        restrict(f)
    print(f"PKI ready in {pki}. ca.key stays on C; copy only <node>.crt/.key + ca.crt to each node.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("action", choices=["init", "pki", "render", "check"])
    ap.add_argument("--secrets", type=Path)
    ap.add_argument("--allow-pc-ssh", action="store_true", help="accept the opt-in C SSH proxy (port 22)")
    a = ap.parse_args()
    global ALLOW_PC_SSH
    ALLOW_PC_SSH = a.allow_pc_ssh
    if a.action == "check" and not a.secrets:
        sys.exit(cmd_check(dummy_values()))
    if not a.secrets:
        sys.exit("--secrets <dir> is required (e.g. E:/Iridescently/secrets/ops-frp)")
    vfile = a.secrets / "values.json"
    if a.action == "init":
        a.secrets.mkdir(parents=True, exist_ok=True); restrict(a.secrets)
        if vfile.exists():
            sys.exit(f"{vfile} exists; refusing to overwrite live secrets")
        vfile.write_text(json.dumps({k: pysecrets.token_urlsafe(32) for k in RANDOM_KEYS}, indent=2), encoding="utf-8")
        restrict(vfile)
        print("wrote", vfile)
        return
    if a.action == "pki":
        return cmd_pki(a.secrets)
    values = json.loads(vfile.read_text(encoding="utf-8"))
    if a.action == "check":
        sys.exit(cmd_check(values))
    out = a.secrets / "rendered"
    out.mkdir(exist_ok=True); restrict(out)
    if cmd_check(values):
        sys.exit("refusing to render configs that fail the checks")
    for name, text in render_all(values).items():
        (out / name).write_text(text, encoding="utf-8"); restrict(out / name)
    print("rendered to", out)


if __name__ == "__main__":
    main()
