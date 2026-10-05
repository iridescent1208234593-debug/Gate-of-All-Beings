# -*- coding: utf-8 -*-
"""统一入口看门狗：8080 无响应时自动拉起 server/portal_server.py
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
SERVER_DIR = ROOT / "server"


def port_alive():
    try:
        with socket.create_connection(("127.0.0.1", PORT), timeout=2):
            return True
    except OSError:
        return False


def main():
    if port_alive():
        return 0
    subprocess.run(["node", "server/app/scripts/build-modules.mjs"], cwd=ROOT, check=True)
    log = SERVER_DIR / "portal.log"
    err = SERVER_DIR / "portal.err.log"
    with open(log, "ab") as out, open(err, "ab") as e:
        subprocess.Popen(
            [sys.executable, "portal_server.py"],
            cwd=SERVER_DIR,
            env={**os.environ, "PORT": str(PORT)},
            stdout=out,
            stderr=e,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    return 1


if __name__ == "__main__":
    sys.exit(main())
