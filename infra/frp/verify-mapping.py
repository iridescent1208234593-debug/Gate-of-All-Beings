"""Prove that public 8.148.14.4:55404 really reaches OUR frps (B:4000), from outside B.

    python infra/frp/verify-mapping.py --secrets E:/Iridescently/secrets/ops-frp [--host 8.148.14.4 --port 55404]

A TCP connect proves nothing on C (Mihomo TUN completes every connect locally). This does a full TLS
handshake with frpc-pc's client certificate and compares the server certificate's SHA-256 fingerprint
with pki/frps.crt. PASS means: the provider mapping exists, it ends at a process holding our frps key,
and that process accepted our client certificate. Run it before and after go-live; keep the output as
evidence. It sends no FRP login and changes nothing.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import socket
import ssl
import sys
import time
from pathlib import Path

SERVER_NAME = "frps.ops.iridescently.internal"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--secrets", type=Path, required=True)
    ap.add_argument("--host", default="8.148.14.4")
    ap.add_argument("--port", type=int, default=55404)
    a = ap.parse_args()
    pki = a.secrets / "pki"
    want = hashlib.sha256(ssl.PEM_cert_to_DER_cert((pki / "frps.crt").read_text())).hexdigest()
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.load_verify_locations(pki / "ca.crt")
    ctx.load_cert_chain(pki / "frpc-pc.crt", pki / "frpc-pc.key")
    out = {"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "target": f"{a.host}:{a.port}", "expected_sha256": want}
    try:
        with socket.create_connection((a.host, a.port), timeout=10) as raw, \
                ctx.wrap_socket(raw, server_hostname=SERVER_NAME) as tls:
            got = hashlib.sha256(tls.getpeercert(binary_form=True)).hexdigest()
            out |= {"tls": tls.version(), "server_sha256": got, "result": "PASS" if got == want else "FAIL: different certificate"}
    except ssl.SSLCertVerificationError as error:
        out["result"] = f"FAIL: server certificate not signed by our CA ({error.verify_message})"
    except (ssl.SSLError, OSError) as error:
        out["result"] = f"FAIL: {type(error).__name__}: {error}"
    print(json.dumps(out, indent=2))
    sys.exit(0 if out["result"] == "PASS" else 1)


if __name__ == "__main__":
    main()
