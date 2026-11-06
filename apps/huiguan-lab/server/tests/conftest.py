"""Integration fixtures: a real gateway process on a temporary runtime, never the LAB's live data."""
from __future__ import annotations

import io
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest
from PIL import Image

SERVER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER))


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Gateway:
    def __init__(self, tmp: Path):
        self.tmp = tmp
        self.port, self.admin_port = free_port(), free_port()
        self.env = os.environ | {"LAB_RUNTIME": str(tmp / "runtime"), "LAB_SECRETS": str(tmp / "secrets"),
                                 "LAB_PORT": str(self.port), "LAB_ADMIN_PORT": str(self.admin_port), "LAB_R4": "0",
                                 "LAB_CONFIG": str(tmp / "none.json"), "PYTHONDONTWRITEBYTECODE": "1"}
        self.proc = None
        self.base = f"http://127.0.0.1:{self.port}"
        self.admin = f"http://127.0.0.1:{self.admin_port}"

    def start(self):
        log = open(self.tmp / f"gateway-{time.time_ns()}.log", "wb")
        self.proc = subprocess.Popen([sys.executable, "-B", str(SERVER / "gateway.py")], env=self.env,
                                     stdout=log, stderr=subprocess.STDOUT)
        deadline = time.time() + 20
        while time.time() < deadline:
            try:
                if httpx.get(self.base + "/healthz", timeout=1).status_code == 200:
                    return self
            except httpx.HTTPError:
                time.sleep(0.2)
        raise RuntimeError("gateway did not start")

    def stop(self):
        if self.proc:
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
            self.proc = None

    def ctl(self, *args) -> str:
        out = subprocess.run([sys.executable, "-B", str(SERVER / "labctl.py"), *args], env=self.env,
                             capture_output=True, text=True, check=True)
        return out.stdout

    def new_code(self, role="player", label="t") -> tuple[str, str]:
        cid, code = self.ctl("code-create", "--role", role, "--label", label).split()
        return cid, code

    def login(self, code: str) -> httpx.Client:
        c = httpx.Client(base_url=self.base, timeout=10)
        r = c.post("/api/login", json={"code": code}, headers={"Origin": self.base})
        assert r.status_code == 200, r.text
        return c

    def cookie_header(self, client: httpx.Client) -> str:
        return "; ".join(f"{k}={v}" for k, v in client.cookies.items())


@pytest.fixture()
def gateway(tmp_path):
    g = Gateway(tmp_path).start()
    yield g
    g.stop()


def png_bytes(w=64, h=96, alpha=True) -> bytes:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0) if alpha else (200, 100, 50, 255))
    for x in range(w // 4, 3 * w // 4):
        for y in range(h // 6, 5 * h // 6):
            img.putpixel((x, y), (240, 180, 90, 255))
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()
