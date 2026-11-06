"""Host and process metrics via psutil (CPU, memory, network)."""
from __future__ import annotations

import os
import time

import psutil

_proc = psutil.Process(os.getpid())
_last = {"t": time.time(), "net": psutil.net_io_counters()}
_proc.cpu_percent(None)


def system_metrics() -> dict:
    now = time.time()
    net = psutil.net_io_counters()
    dt = max(now - _last["t"], 1e-3)
    rate = {"sent_kbps": round((net.bytes_sent - _last["net"].bytes_sent) * 8 / 1000 / dt, 1),
            "recv_kbps": round((net.bytes_recv - _last["net"].bytes_recv) * 8 / 1000 / dt, 1)}
    _last.update(t=now, net=net)
    vm = psutil.virtual_memory()
    with _proc.oneshot():
        mem = _proc.memory_info().rss
        cpu = _proc.cpu_percent(None)
        threads = _proc.num_threads()
    return {"host_cpu_percent": psutil.cpu_percent(None), "host_mem_percent": vm.percent,
            "host_mem_available_mb": round(vm.available / 2 ** 20), "gateway_cpu_percent": cpu,
            "gateway_rss_mb": round(mem / 2 ** 20, 1), "gateway_threads": threads, "net": rate,
            "disk_free_gb": round(psutil.disk_usage(os.path.dirname(os.path.abspath(__file__))).free / 2 ** 30, 1)}


def process_metrics(pid: int) -> dict | None:
    try:
        p = psutil.Process(pid)
        with p.oneshot():
            return {"pid": pid, "rss_mb": round(p.memory_info().rss / 2 ** 20, 1), "cpu_percent": p.cpu_percent(0.0),
                    "started": p.create_time(), "name": p.name()}
    except psutil.Error:
        return None
