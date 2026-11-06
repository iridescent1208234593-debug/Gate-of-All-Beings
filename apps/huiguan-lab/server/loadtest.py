"""Simulated load: N bot players (real login + WebSocket protocol) against a throwaway gateway.

  python loadtest.py --stages 2 10 30 50 100 --seconds 30 --out <dir>

Runs its own gateway on a temporary runtime (never the live LAB data). Each bot logs in with its own
test code, sets a nickname and a small OC, walks continuously (12 moves/s) and chats occasionally.
Measured per stage: gateway CPU/RSS, server tick p50/p99, ping RTT p50/p95, snapshot rate per bot,
downstream bytes per bot and total.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import math
import os
import random
import statistics
import sys
import tempfile
import time
from pathlib import Path

import httpx
import psutil
from websockets.asyncio.client import connect as ws_connect

sys.path.insert(0, str(Path(__file__).resolve().parent / "tests"))
from conftest import Gateway, png_bytes  # noqa: E402


async def bot(i, gw, code, stop, stats):
    async with httpx.AsyncClient(base_url=gw.base, timeout=20) as c:
        r = await c.post("/api/login", json={"code": code}, headers={"Origin": gw.base})
        r.raise_for_status()
        cookie = "; ".join(f"{k}={v}" for k, v in c.cookies.items())
    s = {"rx": 0, "snaps": 0, "rtt": [], "corrections": 0}
    stats.append(s)
    async with ws_connect(f"ws://127.0.0.1:{gw.port}/ws", additional_headers={"Cookie": cookie, "Origin": gw.base},
                                  max_size=8 * 2 ** 20) as ws:
        await ws.send(json.dumps({"t": "hello", "client": "bot", "version": "load"}))
        welcome = None
        while welcome is None:
            m = json.loads(await ws.recv())
            if m["t"] == "welcome":
                welcome = m
        await ws.send(json.dumps({"t": "profile", "nick": f"bot{i}"}))
        await ws.send(json.dumps({"t": "oc_set", "data": base64.b64encode(png_bytes(48, 72)).decode()}))
        x, z = welcome["you"]["x"], welcome["you"]["z"]
        cx, cz, ang = x, z, random.uniform(0, math.tau)
        pings = {}

        async def reader():
            async for raw in ws:
                s["rx"] += len(raw)
                head = raw[:12]                       # cheap dispatch: the generator must not be the bottleneck
                if head.startswith('{"t":"s"'):
                    s["snaps"] += 1
                elif head.startswith('{"t":"pong"'):
                    m = json.loads(raw)
                    if m.get("id") in pings:
                        s["rtt"].append((time.perf_counter() - pings.pop(m["id"])) * 1000)
                elif head.startswith('{"t":"correc'):
                    s["corrections"] += 1

        rt = asyncio.create_task(reader())
        n = 0
        while not stop.is_set():
            n += 1
            ang += 0.08
            nx, nz = cx + math.cos(ang) * 0.8, cz + math.sin(ang) * 0.8
            await ws.send(json.dumps({"t": "move", "x": round(nx, 3), "z": round(nz, 3), "dir": ang, "anim": "walk", "seq": n}))
            if n % 12 == 0:
                pid = f"{i}-{n}"
                pings[pid] = time.perf_counter()
                await ws.send(json.dumps({"t": "ping", "id": pid}))
            if n % 240 == i % 240:
                await ws.send(json.dumps({"t": "chat", "text": f"负载测试 {i}"}))
            await asyncio.sleep(1 / 12)
        rt.cancel()


async def stage(gw, codes, seconds):
    proc = psutil.Process(gw.proc.pid)
    kids = proc.children(recursive=True)            # the venv python.exe is a launcher; measure the real interpreter
    if kids:
        proc = max(kids, key=lambda p: p.memory_info().rss)
    proc.cpu_percent(None)
    stop = asyncio.Event()
    stats = []
    tasks = [asyncio.create_task(bot(i, gw, code, stop, stats)) for i, code in enumerate(codes)]
    await asyncio.sleep(5)                      # ramp-up
    for s in stats:
        s.update(rx=0, snaps=0, rtt=[], corrections=0)
    cpu, rss = [], []
    t0 = time.time()
    while time.time() - t0 < seconds:
        await asyncio.sleep(1)
        cpu.append(proc.cpu_percent(None)); rss.append(proc.memory_info().rss / 2 ** 20)
    elapsed = time.time() - t0
    async with httpx.AsyncClient(base_url=gw.admin, headers={"X-Lab-Admin": "1"}) as a:
        await a.post("/admin/api/login", json={"password": "load-test-admin-password"})
        overview = (await a.get("/admin/api/overview")).json()
    stop.set()
    results = await asyncio.gather(*tasks, return_exceptions=True)
    errors = [repr(r) for r in results if isinstance(r, Exception)]
    rtts = sorted(x for s in stats for x in s["rtt"]) or [0]
    rx = sum(s["rx"] for s in stats)
    return {"players": len(codes), "connected": len(stats), "errors": errors[:5], "seconds": round(elapsed, 1),
            "gateway_cpu_percent_avg": round(statistics.mean(cpu), 1), "gateway_cpu_percent_max": round(max(cpu), 1),
            "gateway_rss_mb_max": round(max(rss), 1), "tick_ms_p50": overview["hub"]["tick_ms_p50"],
            "tick_ms_p99": overview["hub"]["tick_ms_p99"], "rtt_ms_p50": round(rtts[len(rtts) // 2], 1),
            "rtt_ms_p95": round(rtts[int(len(rtts) * 0.95) - 1 if len(rtts) > 1 else 0], 1),
            "snapshots_per_bot_per_s": round(statistics.mean(s["snaps"] for s in stats) / elapsed, 2),
            "down_kbps_per_bot": round(rx / len(stats) * 8 / 1000 / elapsed, 1),
            "down_mbps_total": round(rx * 8 / 1e6 / elapsed, 2),
            "corrections": sum(s["corrections"] for s in stats), "send_overflow": overview["hub"]["counters"]["send_overflow"]}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stages", nargs="+", type=int, default=[2, 10, 30, 50, 100])
    ap.add_argument("--seconds", type=int, default=30)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix="lab-load-"))
    gw = Gateway(tmp)
    gw.start()
    from lab.auth import set_admin_password
    set_admin_password(tmp / "secrets", "load-test-admin-password")
    codes = [l.split()[1] for l in gw.ctl("code-create", "--count", str(max(a.stages)), "--label", "load").splitlines()]
    report = {"host": {"cpu": psutil.cpu_count(), "mem_gb": round(psutil.virtual_memory().total / 2 ** 30, 1)}, "stages": []}
    try:
        for n in a.stages:
            r = await stage(gw, codes[:n], a.seconds)
            print(json.dumps(r, ensure_ascii=False))
            report["stages"].append(r)
            await asyncio.sleep(3)
    finally:
        gw.stop()
    (out / "loadtest.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
