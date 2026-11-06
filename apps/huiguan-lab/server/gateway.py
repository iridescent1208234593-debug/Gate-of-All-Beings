"""LAB gateway process: public app (tunnel-facing) + admin app (loopback) in one event loop."""
from __future__ import annotations

import asyncio
import json
import logging
import logging.handlers
import os
import sys
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lab import config as config_mod  # noqa: E402
from lab.admin_app import create_admin_app  # noqa: E402
from lab.app import Lab, create_app  # noqa: E402


def single_instance(lock_path: Path):
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    fh = open(lock_path, "a+b")
    fh.seek(0)
    if not fh.read(1):
        fh.write(b"0"); fh.flush()
    fh.seek(0)
    try:
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        raise SystemExit("another LAB gateway already holds " + str(lock_path))
    return fh


def supervisor_status_reader(cfg):
    f = cfg.runtime / "state" / "supervisor.json"
    def read():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}
    return read


async def main() -> None:
    cfg = config_mod.load()
    cfg.ensure_dirs()
    lock = single_instance(cfg.data_dir / "gateway.lock")
    handler = logging.handlers.RotatingFileHandler(cfg.log_dir / "gateway.log", maxBytes=5_000_000, backupCount=5,
                                                   encoding="utf-8")
    logging.basicConfig(level=logging.INFO, handlers=[handler, logging.StreamHandler()],
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    lab = Lab(cfg)
    public = create_app(lab)
    admin = create_admin_app(lab, supervisor_status_reader(cfg))
    common = dict(log_level="info", proxy_headers=False, server_header=False, ws="websockets",
                  ws_max_size=8 * 1024 * 1024, ws_ping_interval=20, ws_ping_timeout=20, timeout_keep_alive=30)
    s1 = uvicorn.Server(uvicorn.Config(public, host=cfg.bind, port=cfg.port, **common))
    s2 = uvicorn.Server(uvicorn.Config(admin, host="127.0.0.1", port=cfg.admin_port, **common))
    lab.start()
    logging.getLogger("lab").info("gateway %s on %s:%s, admin on 127.0.0.1:%s, runtime %s",
                                  config_mod.VERSION, cfg.bind, cfg.port, cfg.admin_port, cfg.runtime)
    stop_file = cfg.runtime / "state" / "stop.request"

    async def watch_stop():
        # Graceful stop on Windows, where the supervisor cannot send SIGINT: save players, then exit.
        while not stop_file.exists():
            await asyncio.sleep(0.5)
        s1.should_exit = s2.should_exit = True

    watcher = asyncio.create_task(watch_stop())
    try:
        await asyncio.gather(s1.serve(), s2.serve())
        watcher.cancel()
    finally:
        await lab.stop()
        lab.store.close()
        lock.close()


if __name__ == "__main__":
    asyncio.run(main())
