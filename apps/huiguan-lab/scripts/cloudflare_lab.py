"""LAB-only Cloudflare operations. Never touches production records, other tunnels or non-LAB names.

  python cloudflare_lab.py snapshot <dir>      read-only export of all three zones' DNS + tunnel list/ingress
  python cloudflare_lab.py setup               create tunnel `zszm-lab-v2` (if absent) + CNAME pc-lab.iridescently.cn
  python cloudflare_lab.py delete-records <plan.json> --yes   delete exactly the record IDs in an approved plan
  python cloudflare_lab.py restore-records <snapshot.json> <ids...> --yes  recreate records from a snapshot

Credentials: the Website Manager's saved token (Windows Credential Manager), read through
operations/server-control.py. The token is never printed or written anywhere.
"""
from __future__ import annotations

import base64
import importlib.util
import json
import os
import sys
import time
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
WORKSPACE = LAB.parents[1]
OPS = WORKSPACE / "operations"
SECRETS = WORKSPACE / "secrets" / "lab-v2"
TUNNEL_NAME = "zszm-lab-v2"
HOST = "pc-lab.iridescently.cn"
ZONE = "iridescently.cn"
PORT = 18300


def ops():
    sys.path.insert(0, str(OPS))
    spec = importlib.util.spec_from_file_location("server_control", OPS / "server-control.py")
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m


SC = ops()
TOKEN = SC.cloudflare_token()


def cf(method, path, data=None):
    return SC.cf(TOKEN, method, path, data)


def zones():
    return {z["name"]: z for z in cf("GET", "/zones?per_page=50")}


def snapshot(out: Path) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    zs = zones()
    data = {"taken_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "zones": {}, "tunnels": []}
    accounts = set()
    for name, z in zs.items():
        accounts.add(z["account"]["id"])
        data["zones"][name] = {"id": z["id"], "records": cf("GET", f"/zones/{z['id']}/dns_records?per_page=500")}
    for a in accounts:
        for t in cf("GET", f"/accounts/{a}/cfd_tunnel?is_deleted=false&per_page=100"):
            cfg = cf("GET", f"/accounts/{a}/cfd_tunnel/{t['id']}/configurations")
            data["tunnels"].append({"account": a, "id": t["id"], "name": t["name"], "status": t.get("status"),
                                    "connections": t.get("connections", []), "configuration": cfg})
    f = out / f"cloudflare-snapshot-{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}.json"
    f.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    return f


def setup():
    zs = zones()
    zone = zs[ZONE]
    account = zone["account"]["id"]
    SECRETS.mkdir(parents=True, exist_ok=True)
    cred_file = SECRETS / "tunnel.json"
    if cred_file.exists():
        cred = json.loads(cred_file.read_text())
    else:
        if cf("GET", f"/accounts/{account}/cfd_tunnel?name={TUNNEL_NAME}&is_deleted=false"):
            raise SystemExit(f"tunnel {TUNNEL_NAME} exists in Cloudflare but its credentials are not here; refusing to create a duplicate")
        secret = base64.b64encode(os.urandom(32)).decode()
        t = cf("POST", f"/accounts/{account}/cfd_tunnel", {"name": TUNNEL_NAME, "tunnel_secret": secret, "config_src": "local"})
        cred = {"AccountTag": account, "TunnelID": t["id"], "TunnelSecret": secret}
        cred_file.write_text(json.dumps(cred))
        sys.path.insert(0, str(LAB / "server"))
        from lab.auth import restrict_file
        restrict_file(cred_file)
        print("created tunnel", TUNNEL_NAME, t["id"])
    tid = cred["TunnelID"]
    yml = SECRETS / "cloudflared.yml"
    yml.write_text(
        f"tunnel: {tid}\ncredentials-file: {cred_file}\nno-autoupdate: true\n"
        f"ingress:\n  - hostname: {HOST}\n    service: http://127.0.0.1:{PORT}\n"
        f"    originRequest:\n      connectTimeout: 10s\n      noHappyEyeballs: true\n"
        f"  - service: http_status:404\n", encoding="utf-8")
    target = f"{tid}.cfargotunnel.com"
    existing = cf("GET", f"/zones/{zone['id']}/dns_records?name={HOST}")
    if existing:
        rec = existing[0]
        if rec["type"] == "CNAME" and rec["content"] == target:
            print("DNS already correct", rec["id"])
        else:
            raise SystemExit(f"{HOST} already exists pointing to {rec['content']}; not overwriting")
    else:
        rec = cf("POST", f"/zones/{zone['id']}/dns_records", {"type": "CNAME", "name": HOST, "content": target, "proxied": True,
                                                              "ttl": 1, "comment": "ZSZM LAB V2 (local Windows host via tunnel zszm-lab-v2)"})
        print("created DNS", HOST, "->", target, rec["id"])
    return {"tunnel_id": tid, "record_id": rec["id"]}


def delete_records(plan_file: Path):
    plan = json.loads(plan_file.read_text(encoding="utf-8-sig"))
    zs = {z["id"]: z for z in zones().values()}
    done = []
    for item in plan["delete"]:
        zid, rid, name = item["zone_id"], item["id"], item["name"]
        if not name.startswith("pc") or zid not in zs:
            raise SystemExit("plan contains a non pc-* record: " + name)
        cur = cf("GET", f"/zones/{zid}/dns_records/{rid}")
        if cur["name"] != name or cur["content"] != item["content"]:
            raise SystemExit(f"record {rid} changed since the plan was made; stopping")
        cf("DELETE", f"/zones/{zid}/dns_records/{rid}")
        done.append(item | {"deleted_at": time.time()})
        print("deleted", name, rid)
    return done


def restore_records(snapshot_file: Path, ids: list[str]):
    snap = json.loads(snapshot_file.read_text(encoding="utf-8"))
    for zname, z in snap["zones"].items():
        for r in z["records"]:
            if r["id"] in ids:
                new = cf("POST", f"/zones/{z['id']}/dns_records", {k: r[k] for k in ("type", "name", "content", "proxied", "ttl") if k in r}
                         | {"comment": (r.get("comment") or "") + " restored"})
                print("restored", r["name"], "new id", new["id"])


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "snapshot":
        print(snapshot(Path(sys.argv[2])))
    elif cmd == "setup":
        print(json.dumps(setup()))
    elif cmd == "delete-records" and "--yes" in sys.argv:
        print(json.dumps(delete_records(Path(sys.argv[2])), ensure_ascii=False))
    elif cmd == "restore-records" and "--yes" in sys.argv:
        restore_records(Path(sys.argv[2]), [a for a in sys.argv[3:] if a != "--yes"])
    else:
        raise SystemExit(__doc__)
