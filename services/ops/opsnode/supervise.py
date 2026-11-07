"""Windows node supervisor: runs frpc and the agent with the same bounded-restart policy as LAB's supervisor.

    python -m opsnode.supervise --config <supervise.json>

* Single instance: an OS lock on <state_dir>/ops-supervisor.lock.
* Each child restarts at most 5 times in 10 minutes, backoff 2, 4, 8, 16, 30 s; then it is marked failed
  and left down with a log line. FRP's own reconnect (loginFailExit = false) handles network drops,
  so a restart only happens when the frpc process itself exits.
* Stop: `ops-node.ps1 stop` writes <state_dir>/stop.request.
* Status: <state_dir>/ops-supervisor.json, rewritten every second.
On Linux (A and B) systemd does this job; see infra/systemd/ops-*.service.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from collections import deque
from pathlib import Path

NO_WINDOW = 0x08000000 if os.name == "nt" else 0
NEW_GROUP = 0x00000200 if os.name == "nt" else 0
MAX_STARTS, WINDOW = 6, 600


def lock_file(path: Path):
    fh = open(path, "a+b")
    try:
        if os.name == "nt":
            import msvcrt
            fh.seek(0)
            msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        raise SystemExit("another ops supervisor already holds " + str(path))
    return fh


class Child:
    def __init__(self, name, argv, cwd, log):
        self.name, self.argv, self.cwd, self.log = name, argv, cwd, log
        self.proc = None
        self.starts: deque = deque(maxlen=10)
        self.failed = False
        self.next_start = 0.0
        self.last_exit = None

    def start(self):
        self.starts.append(time.time())
        out = open(self.log, "ab")
        self.proc = subprocess.Popen(self.argv, cwd=self.cwd, stdout=out, stderr=subprocess.STDOUT,
                                     stdin=subprocess.DEVNULL, creationflags=NO_WINDOW | NEW_GROUP)

    def alive(self):
        return self.proc is not None and self.proc.poll() is None

    def stop(self):
        if self.alive():
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except subprocess.TimeoutExpired:
                self.proc.kill()


def step(children, now, say):
    """One supervision pass; separated out for tests."""
    for c in children:
        if c.failed or c.alive():
            continue
        if c.proc is not None and c.last_exit is None:
            c.last_exit = c.proc.returncode
            say(f"{c.name} exited code={c.last_exit}")
            recent = [t for t in c.starts if now - t < WINDOW]
            if len(recent) >= MAX_STARTS:
                c.failed = True
                say(f"{c.name} FAILED: restarted {MAX_STARTS - 1} times within {WINDOW // 60} minutes; leaving it down")
                continue
            c.next_start = now + min(30, 2 ** len(recent))
        if now >= c.next_start:
            c.last_exit = None
            c.start()
            say(f"started {c.name} pid={c.proc.pid}")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", required=True)
    cfg = json.loads(Path(ap.parse_args().config).read_text(encoding="utf-8"))
    state = Path(cfg["state_dir"]); state.mkdir(parents=True, exist_ok=True)
    logs = Path(cfg["log_dir"]); logs.mkdir(parents=True, exist_ok=True)
    lock = lock_file(state / "ops-supervisor.lock")
    (state / "stop.request").unlink(missing_ok=True)
    slog = open(logs / "ops-supervisor.log", "a", encoding="utf-8")

    def say(msg):
        slog.write(time.strftime("%Y-%m-%d %H:%M:%S ") + msg + "\n"); slog.flush()

    here = Path(__file__).resolve().parent.parent
    children = []
    if cfg.get("frpc_exe") and cfg.get("frpc_config"):
        children.append(Child("frpc", [cfg["frpc_exe"], "-c", cfg["frpc_config"]], str(state), logs / "frpc.stdout.log"))
    children.append(Child("agent", [sys.executable, "-B", "-m", "opsnode.agent", "--config", cfg["agent_config"]],
                          str(here), logs / "agent.stdout.log"))
    say(f"ops supervisor start pid={os.getpid()} children={[c.name for c in children]}")
    try:
        while not (state / "stop.request").exists():
            step(children, time.time(), say)
            data = {"phase": "running", "pid": os.getpid(), "updated": time.time(),
                    "children": {c.name: {"alive": c.alive(), "failed": c.failed, "pid": c.proc.pid if c.alive() else None,
                                          "restarts": max(0, len(c.starts) - 1), "last_exit": c.last_exit} for c in children}}
            tmp = state / "ops-supervisor.json.tmp"
            tmp.write_text(json.dumps(data), encoding="utf-8")
            os.replace(tmp, state / "ops-supervisor.json")
            time.sleep(1)
    finally:
        say("stopping")
        for c in children:
            c.stop(); say(f"stopped {c.name}")
        (state / "ops-supervisor.json").write_text(json.dumps({"phase": "stopped", "updated": time.time()}), encoding="utf-8")
        (state / "stop.request").unlink(missing_ok=True)
        lock.close()


if __name__ == "__main__":
    main()
