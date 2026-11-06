"""LAB supervisor: one instance runs R4, the gateway and the LAB tunnel, with bounded restarts.

* Single instance: an OS file lock on <runtime>/state/supervisor.lock (autostart + manual start can
  never produce two tunnels or two authorities; R4 and the gateway also hold their own DB locks).
* Restart policy: each child may restart at most 5 times in 10 minutes, with backoff; then it is
  marked failed and left down with a clear log line (no restart storms).
* Stop: Stop-LAB writes <runtime>/state/stop.request; the supervisor stops gateway -> tunnel -> R4.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from collections import deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gateway import single_instance  # noqa: E402
from lab import config as config_mod  # noqa: E402
from lab.r4bridge import r4_tokens  # noqa: E402

NO_WINDOW = 0x08000000 if os.name == "nt" else 0
NEW_GROUP = 0x00000200 if os.name == "nt" else 0
HERE = Path(__file__).resolve().parent


class Child:
    def __init__(self, name, argv, cwd, env, log):
        self.name, self.argv, self.cwd, self.env, self.log = name, argv, cwd, env, log
        self.proc: subprocess.Popen | None = None
        self.starts: deque = deque(maxlen=10)
        self.failed = False
        self.next_start = 0.0
        self.last_exit = None

    def start(self):
        self.starts.append(time.time())
        out = open(self.log, "ab")
        self.proc = subprocess.Popen(self.argv, cwd=self.cwd, env=self.env, stdout=out, stderr=subprocess.STDOUT,
                                     stdin=subprocess.DEVNULL, creationflags=NO_WINDOW | NEW_GROUP)

    def alive(self):
        return self.proc is not None and self.proc.poll() is None

    def stop(self, timeout=10, graceful=0):
        if not self.alive():
            return
        if graceful:
            try:
                self.proc.wait(graceful)        # the gateway exits on its own after seeing stop.request
                return
            except subprocess.TimeoutExpired:
                pass
        self.proc.terminate()
        try:
            self.proc.wait(timeout)
        except subprocess.TimeoutExpired:
            self.proc.kill()


def main():
    cfg = config_mod.load()
    cfg.ensure_dirs()
    state = cfg.runtime / "state"
    state.mkdir(parents=True, exist_ok=True)
    lock = single_instance(state / "supervisor.lock")
    (state / "stop.request").unlink(missing_ok=True)
    slog = open(cfg.log_dir / "supervisor.log", "a", encoding="utf-8")

    def say(msg):
        slog.write(time.strftime("%Y-%m-%d %H:%M:%S ") + msg + "\n"); slog.flush()

    base_env = {k: v for k, v in os.environ.items() if not k.startswith(("WORLD_LAB_", "CLOUDFLARE", "CF_"))}
    base_env["PYTHONDONTWRITEBYTECODE"] = "1"
    children = []
    if cfg.r4_enabled:
        tokens = r4_tokens(cfg.secrets)
        r4_env = base_env | {"WORLD_LAB_" + w.upper(): t for w, t in tokens.items()} | {
            "WORLD_LAB_DB": str(cfg.r4_dir / "world.sqlite"), "WORLD_LAB_MESA_HORIZON": "1001",
            "LIVING_INTERVAL": str(cfg.r4_interval_seconds), "LIVING_TICKS_PER_ADVANCE": "1",
            "OPENBLAS_NUM_THREADS": "1", "OMP_NUM_THREADS": "1", "MKL_NUM_THREADS": "1"}
        children.append(Child("r4", [str(cfg.r4_python), "-B", "-m", "uvicorn", "service:app", "--host", "127.0.0.1",
                                     "--port", str(cfg.r4_port), "--log-level", "warning"],
                              str(cfg.r4_service_dir), r4_env, cfg.log_dir / "r4.log"))
    children.append(Child("gateway", [sys.executable, "-B", str(HERE / "gateway.py")], str(HERE), base_env,
                          cfg.log_dir / "gateway.stdout.log"))
    tunnel_cfg = cfg.secrets / "cloudflared.yml"
    if cfg.tunnel_enabled and tunnel_cfg.exists():
        children.append(Child("tunnel", [cfg.cloudflared, "tunnel", "--no-autoupdate", "--config", str(tunnel_cfg),
                                         "--loglevel", "info", "--logfile", str(cfg.log_dir / "tunnel.log"), "run"],
                              str(cfg.runtime), base_env, cfg.log_dir / "tunnel.stdout.log"))
    else:
        say("tunnel not configured or disabled; LAB is local-only")

    def write_status(phase):
        data = {"phase": phase, "supervisor_pid": os.getpid(), "updated": time.time(), "version": config_mod.VERSION,
                "pids": {c.name: c.proc.pid for c in children if c.alive()},
                "children": {c.name: {"alive": c.alive(), "failed": c.failed, "restarts": max(0, len(c.starts) - 1),
                                      "last_exit": c.last_exit} for c in children}}
        tmp = state / "supervisor.json.tmp"
        tmp.write_text(json.dumps(data), encoding="utf-8")
        os.replace(tmp, state / "supervisor.json")

    say(f"supervisor start {config_mod.VERSION} pid={os.getpid()} children={[c.name for c in children]}")
    for c in children:
        c.start(); say(f"started {c.name} pid={c.proc.pid}")
        if c.name == "r4":
            time.sleep(3)
    try:
        while not (state / "stop.request").exists():
            now = time.time()
            for c in children:
                if c.failed or c.alive():
                    continue
                if c.proc is not None and c.last_exit is None:
                    c.last_exit = c.proc.returncode
                    say(f"{c.name} exited code={c.last_exit}")
                    recent = [t for t in c.starts if now - t < 600]
                    if len(recent) >= 6:
                        c.failed = True
                        say(f"{c.name} FAILED: restarted 5 times within 10 minutes; leaving it down. See {c.log}")
                        continue
                    c.next_start = now + min(30, 2 ** len(recent))
                if now >= c.next_start:
                    c.last_exit = None
                    c.start(); say(f"restarted {c.name} pid={c.proc.pid}")
            write_status("running")
            time.sleep(1)
    finally:
        say("stopping")
        write_status("stopping")
        for name in ("gateway", "tunnel", "r4"):
            for c in children:
                if c.name == name:
                    c.stop(graceful=8 if name == "gateway" else 0); say(f"stopped {name}")
        write_status("stopped")
        (state / "stop.request").unlink(missing_ok=True)
        lock.close()


if __name__ == "__main__":
    main()
