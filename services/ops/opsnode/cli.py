"""Terminal view of the hub (run on B, or on C through `ssh -L 18420:127.0.0.1:18420 <B>`).

    python -m opsnode.cli --hub http://127.0.0.1:18420 --token-file <file> [summary|alerts|frps|node <name>]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from . import probes


def fmt_age(t):
    return "-" if not t else f"{time.time() - t:.0f}s ago"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--hub", default="http://127.0.0.1:18420")
    ap.add_argument("--token-file", required=True)
    ap.add_argument("what", nargs="*", default=["summary"])
    a = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")       # Windows consoles default to cp1252/cp936
    tok = Path(a.token_file).read_text(encoding="utf-8").strip()
    path = {"summary": "/v1/summary", "alerts": "/v1/alerts", "frps": "/v1/frps"}.get(a.what[0])
    if a.what[0] == "node" and len(a.what) == 2:
        path = "/v1/nodes/" + a.what[1]
    if not path:
        sys.exit("unknown view")
    status, body = probes.http_get(a.hub.rstrip("/") + path, 10, headers={"Authorization": "Bearer " + tok})
    data = json.loads(body)
    if status != 200 or a.what[0] != "summary":
        print(json.dumps(data, ensure_ascii=False, indent=2)); sys.exit(0 if status == 200 else 1)
    for n in data["nodes"]:
        state = "ONLINE " if n["reachable"] else "OFFLINE"
        disks = " ".join(f"{d['path']}={d.get('used_percent')}%" for d in n.get("disks", []))
        print(f"{n['label']:<14} {state} last_ok={fmt_age(n['last_ok']):<10} cpu={n['cpu_percent']}% "
              f"mem={n['mem_percent']}% {disks} frpc={n['frpc_ok']}")
        if n.get("lab"):
            print(f"{'':<14} LAB gateway={n['lab']['gateway_ok']} supervisor={n['lab']['supervisor_ok']} online={n['lab']['online']}")
        if n.get("hk_release"):
            print(f"{'':<14} HK release={n['hk_release']['current']} services={n['hk_release']['services']}")
        for al in n["alerts"]:
            print(f"{'':<14} [{al['level']}] {al['code']} {al['detail']}")
    print(f"FRPS ok={data['frps_ok']}  alerts={data['alert_count']}")


if __name__ == "__main__":
    main()
