# -*- coding: utf-8 -*-
"""统一入口看门狗：8080 无响应时自动拉起 services/platform/portal_server.py
（原为 8089 会馆单站看门狗；生产已切换为统一入口）。
用法：由计划任务每 5 分钟调用一次，或手动 `python watchdog.py`。
只在端口无人监听时启动，避免与已有实例冲突。"""
import os
import socket
import subprocess
import sys
from pathlib import Path

PORT = 8080
ROOT = Path(__file__).resolve().parents[2]
SERVER_DIR = ROOT / ".releases/production/site/server"


def port_alive():
    try:
        with socket.create_connection(("127.0.0.1", PORT), timeout=2):
            return True
    except OSError:
        return False


def main():
    if (ROOT / '.releases/hk-production.json').exists():
        return 0
    if port_alive():
        return 0
    required = [ROOT / "apps/www/index.html", SERVER_DIR / "portal_server.py"] + [
        ROOT / "dist/modules" / name / "index.html"
        for name in ("cards", "management", "ecology", "softie", "juling", "slay", "aeon")
    ]
    if any(not item.is_file() for item in required):
        raise RuntimeError("Published artifacts are incomplete; build and explicitly publish before starting.")
    log = ROOT / "server/portal.log"
    err = ROOT / "server/portal.err.log"
    # cwd 必须在 production/site 之外，否则发布器 rename 该目录会 EPERM。
    runtime = ROOT / ".releases/runtime/portal"
    runtime.mkdir(parents=True, exist_ok=True)
    with open(log, "ab") as out, open(err, "ab") as e:
        subprocess.Popen(
            [sys.executable, str(SERVER_DIR / "portal_server.py")],
            cwd=runtime,
            env={**os.environ, "PORT": str(PORT), "IRIDESCENTLY_PROJECT_ROOT": str(ROOT)},
            stdout=out,
            stderr=e,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    return 1


if __name__ == "__main__":
    sys.exit(main())
