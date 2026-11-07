"""Assemble per-node install bundles on C from rendered configs and secrets. Output never enters Git.

    python infra/frp/bundle.py --secrets E:/Iridescently/secrets/ops-frp

Creates (only when missing; existing tokens are never replaced):
  <secrets>/tokens/{hk,b,pc}.token        hub -> agent bearer tokens (one per node)
  <secrets>/tokens/operator.token          operator -> hub bearer token (kept on C)
  <secrets>/bundles/b/ , bundles/hk/       what install-linux-node.sh expects
  <secrets>/bundles/pc/                    agent-readers.json + frpc-pc.toml + pki for C
"""
from __future__ import annotations

import argparse
import json
import secrets
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO / "services" / "ops"))
sys.path.insert(0, str(HERE))
from opsnode.auth import digest  # noqa: E402
from render import restrict  # noqa: E402

PKI = {"b": ["frps", "frpc-b"], "hk": ["frpc-hk"], "pc": ["frpc-pc"]}


def token(path: Path) -> str:
    if not path.exists():
        path.write_text(secrets.token_urlsafe(32), encoding="utf-8")
        restrict(path)
    return path.read_text(encoding="utf-8").strip()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--secrets", type=Path, required=True)
    s = ap.parse_args().secrets
    values = json.loads((s / "values.json").read_text(encoding="utf-8"))
    rendered, pki = s / "rendered", s / "pki"
    if not rendered.exists() or not (pki / "ca.crt").exists():
        sys.exit("run render.py pki and render.py render first")
    (s / "tokens").mkdir(exist_ok=True); restrict(s / "tokens")
    toks = {n: token(s / "tokens" / f"{n}.token") for n in ("hk", "b", "pc", "operator")}
    for node in ("b", "hk", "pc"):
        out = s / "bundles" / node
        if out.exists():
            shutil.rmtree(out)
        (out / "pki").mkdir(parents=True)
        for who in PKI[node]:
            for ext in ("crt", "key"):
                shutil.copy2(pki / f"{who}.{ext}", out / "pki" / f"{who}.{ext}")
        shutil.copy2(pki / "ca.crt", out / "pki" / "ca.crt")          # ca.key never leaves C
        (out / "agent-readers.json").write_text(json.dumps({"readers": {"hub-b": digest(toks[node])}}), encoding="utf-8")
        if node == "pc":
            shutil.copy2(rendered / "frpc-pc.toml", out / "frpc-pc.toml")
            (out / "frpc-pc-admin-password.txt").write_text(values["FRPC_PC_ADMIN_PASSWORD"], encoding="utf-8")
            continue
        shutil.copytree(REPO / "services" / "ops" / "opsnode", out / "opsnode",
                        ignore=shutil.ignore_patterns("__pycache__"))
        shutil.copy2(HERE / "install-linux-node.sh", out / "install-linux-node.sh")
        (out / "systemd").mkdir()
        for unit in (REPO / "infra" / "systemd").glob("iridescently-ops-*.service"):
            shutil.copy2(unit, out / "systemd" / unit.name)
        shutil.copy2(REPO / "services" / "ops" / "config" / f"agent-{node}.example.json", out / "agent.json")
        if node == "b":
            for f in ("frps.toml", "frpc-b-visitor.toml"):
                shutil.copy2(rendered / f, out / f)
            (out / "frpc-admin-password.txt").write_text(values["FRPC_B_ADMIN_PASSWORD"], encoding="utf-8")
            (out / "frps-dashboard-password.txt").write_text(values["FRPS_DASHBOARD_PASSWORD"], encoding="utf-8")
            shutil.copy2(REPO / "services" / "ops" / "config" / "hub-b.example.json", out / "hub.json")
            (out / "hub-readers.json").write_text(json.dumps({"readers": {"operator": digest(toks["operator"])}}), encoding="utf-8")
            (out / "tokens").mkdir()
            for n in ("hk", "b", "pc"):
                (out / "tokens" / f"{n}.token").write_text(toks[n], encoding="utf-8")
        else:
            shutil.copy2(rendered / "frpc-hk.toml", out / "frpc-hk.toml")
            (out / "frpc-admin-password.txt").write_text(values["FRPC_HK_ADMIN_PASSWORD"], encoding="utf-8")
        for f in out.rglob("*"):
            restrict(f)
        restrict(out)
    print("bundles ready in", s / "bundles")


if __name__ == "__main__":
    main()
