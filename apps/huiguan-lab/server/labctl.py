"""LAB administration CLI (local only).

  labctl.py code-create [--label L] [--role player|monitor|art] [--count N] [--out FILE]
  labctl.py code-list
  labctl.py code-disable|code-enable|code-revoke <code_id>
  labctl.py admin-password            (prompts twice; stored as scrypt hash in secrets/lab-v2/admin.json)
  labctl.py backup [--label L]        (online SQLite backups of the LAB DB and the R4 world DB)
  labctl.py restore <backup_dir> --yes  (gateway and R4 must be stopped)
  labctl.py status

Plaintext codes are printed once (or written to --out inside secrets/lab-v2) and never stored.
A revoked code's live connections close within 60 s through the gateway's session sweep.
"""
from __future__ import annotations

import argparse
import getpass
import json
import shutil
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lab import config as config_mod  # noqa: E402
from lab.auth import Auth, load_pepper, restrict_file, set_admin_password  # noqa: E402
from lab.store import Store  # noqa: E402


def open_lab(cfg):
    cfg.ensure_dirs()
    store = Store(cfg.db_path)
    return store, Auth(store, load_pepper(cfg.secrets), cfg.session_days)


def fmt(t):
    return datetime.fromtimestamp(t).strftime("%Y-%m-%d %H:%M") if t else "-"


def backup(cfg, label: str = "") -> Path:
    stamp = datetime.now().strftime("%Y%m%dT%H%M%S") + (("-" + label) if label else "")
    target = cfg.backup_dir / stamp
    target.mkdir(parents=True)
    Store(cfg.db_path).backup_to(target / "lab.sqlite")
    r4db = cfg.r4_dir / "world.sqlite"
    if r4db.exists():
        src = sqlite3.connect(str(r4db))
        dst = sqlite3.connect(str(target / "world.sqlite"))
        try:
            src.backup(dst)
        finally:
            src.close(); dst.close()
    for name in ("spaces.json",):
        shutil.copy2(config_mod.SOURCE_ROOT / "client" / "data" / name, target / name)
    manifest = {"created_at": time.time(), "version": config_mod.VERSION, "files": {}}
    import hashlib
    for f in target.iterdir():
        manifest["files"][f.name] = {"bytes": f.stat().st_size, "sha256": hashlib.sha256(f.read_bytes()).hexdigest()}
    (target / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    # Keep the newest 14 backups (LAB data is small; no full asset snapshots are ever made here).
    olds = sorted(p for p in cfg.backup_dir.iterdir() if p.is_dir())[:-14]
    for p in olds:
        shutil.rmtree(p)
    return target


def restore(cfg, src: Path) -> None:
    import hashlib
    manifest = json.loads((src / "manifest.json").read_text(encoding="utf-8"))
    for name, meta in manifest["files"].items():
        if hashlib.sha256((src / name).read_bytes()).hexdigest() != meta["sha256"]:
            raise SystemExit(f"checksum mismatch: {name}")
    for lock in (cfg.data_dir / "gateway.lock", cfg.r4_dir / "world.sqlite.host-lock"):
        if lock.exists():
            try:
                lock.rename(lock)       # Windows refuses rename of a locked file
            except OSError:
                raise SystemExit("stop the LAB first (Stop-LAB.cmd)")
    safety = backup(cfg, "pre-restore")
    print("safety backup:", safety)
    for name, dest in (("lab.sqlite", cfg.db_path), ("world.sqlite", cfg.r4_dir / "world.sqlite")):
        if (src / name).exists():
            for suffix in ("-wal", "-shm"):
                Path(str(dest) + suffix).unlink(missing_ok=True)
            shutil.copy2(src / name, dest)
    print("restored from", src)


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("code-create"); c.add_argument("--label", default=""); c.add_argument("--role", default="player")
    c.add_argument("--count", type=int, default=1); c.add_argument("--out")
    sub.add_parser("code-list")
    for name in ("code-disable", "code-enable", "code-revoke"):
        sub.add_parser(name).add_argument("code_id")
    sub.add_parser("admin-password")
    b = sub.add_parser("backup"); b.add_argument("--label", default="")
    r = sub.add_parser("restore"); r.add_argument("source"); r.add_argument("--yes", action="store_true")
    sub.add_parser("status")
    a = p.parse_args(argv)
    cfg = config_mod.load()

    if a.cmd == "code-create":
        store, auth = open_lab(cfg)
        rows = [auth.create_code(a.label, a.role, actor="labctl") for _ in range(a.count)]
        if a.out:
            out = Path(a.out)
            if cfg.secrets.resolve() not in out.resolve().parents:
                raise SystemExit("--out must be inside " + str(cfg.secrets))
            out.write_text("\n".join(f"{cid}\t{code}\t{a.label}" for cid, code in rows) + "\n", encoding="utf-8")
            restrict_file(out)
            print(f"{len(rows)} codes written to {out}")
        else:
            for cid, code in rows:
                print(cid, code)
    elif a.cmd == "code-list":
        store, _ = open_lab(cfg)
        for r in store.all("SELECT c.*, p.nickname FROM codes c LEFT JOIN players p ON p.code_id=c.id ORDER BY created_at"):
            print(f"{r['id']}  {r['status']:8} {r['role']:7} uses={r['use_count']:<4} last={fmt(r['last_used_at'])}  "
                  f"{r['label']}  {r['nickname'] or ''}")
    elif a.cmd in ("code-disable", "code-enable", "code-revoke"):
        _, auth = open_lab(cfg)
        status = {"code-disable": "disabled", "code-enable": "active", "code-revoke": "revoked"}[a.cmd]
        print("sessions removed:", auth.set_status(a.code_id, status, actor="labctl"))
    elif a.cmd == "admin-password":
        pw = getpass.getpass("new admin password (>=12 chars): ")
        if pw != getpass.getpass("repeat: "):
            raise SystemExit("passwords differ")
        cfg.ensure_dirs()
        set_admin_password(cfg.secrets, pw)
        print("admin password set")
    elif a.cmd == "backup":
        print(backup(cfg, a.label))
    elif a.cmd == "restore":
        if not a.yes:
            raise SystemExit("restore replaces the shared world; re-run with --yes after stopping the LAB")
        restore(cfg, Path(a.source))
    elif a.cmd == "status":
        store, _ = open_lab(cfg)
        print(json.dumps({"runtime": str(cfg.runtime), "codes": store.one("SELECT count(*) n FROM codes")["n"],
                          "players": store.one("SELECT count(*) n FROM players")["n"],
                          "spaces": store.one("SELECT count(*) n FROM spaces")["n"]}, indent=1))


if __name__ == "__main__":
    main()
