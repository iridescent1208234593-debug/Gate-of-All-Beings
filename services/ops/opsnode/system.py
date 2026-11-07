"""Host metrics: CPU, memory, disks, network rates, uptime. psutil when available, otherwise /proc or Win32."""
from __future__ import annotations

import ctypes
import os
import shutil
import socket
import sys
import time

try:  # pragma: no cover - depends on host
    import psutil  # type: ignore
except Exception:  # noqa: BLE001
    psutil = None

_last: dict = {}


def _cpu_times() -> tuple[float, float] | None:
    """(idle, total) cumulative seconds, or None."""
    if sys.platform.startswith("linux"):
        try:
            with open("/proc/stat", encoding="ascii") as fh:
                parts = [float(x) for x in fh.readline().split()[1:]]
            idle = parts[3] + (parts[4] if len(parts) > 4 else 0)
            return idle, sum(parts[:8])
        except OSError:
            return None
    if os.name == "nt":
        ft = [ctypes.c_ulonglong() for _ in range(3)]
        if ctypes.windll.kernel32.GetSystemTimes(*(ctypes.byref(x) for x in ft)):
            idle, kernel, user = (x.value / 1e7 for x in ft)
            return idle, kernel + user          # kernel time includes idle time on Windows
    return None


def cpu_percent() -> float | None:
    if psutil:
        return psutil.cpu_percent(None)
    now = _cpu_times()
    prev = _last.get("cpu")
    _last["cpu"] = now
    if not now or not prev or now[1] <= prev[1]:
        return None
    return round(100.0 * (1 - (now[0] - prev[0]) / (now[1] - prev[1])), 1)


def memory() -> dict:
    if psutil:
        vm = psutil.virtual_memory()
        return {"total_mb": round(vm.total / 2**20), "available_mb": round(vm.available / 2**20), "percent": vm.percent}
    if sys.platform.startswith("linux"):
        info = {}
        with open("/proc/meminfo", encoding="ascii") as fh:
            for line in fh:
                k, v = line.split(":", 1)
                info[k] = int(v.split()[0]) * 1024
        total, avail = info.get("MemTotal", 0), info.get("MemAvailable", info.get("MemFree", 0))
    elif os.name == "nt":
        class MS(ctypes.Structure):
            _fields_ = [("len", ctypes.c_ulong), ("load", ctypes.c_ulong), ("total", ctypes.c_ulonglong),
                        ("avail", ctypes.c_ulonglong), ("tp", ctypes.c_ulonglong), ("ap", ctypes.c_ulonglong),
                        ("tv", ctypes.c_ulonglong), ("av", ctypes.c_ulonglong), ("ae", ctypes.c_ulonglong)]
        ms = MS(); ms.len = ctypes.sizeof(MS)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(ms))
        total, avail = ms.total, ms.avail
    else:
        return {}
    return {"total_mb": round(total / 2**20), "available_mb": round(avail / 2**20),
            "percent": round(100.0 * (1 - avail / total), 1) if total else None}


def disks(paths: list[str]) -> list[dict]:
    out = []
    for p in paths:
        try:
            u = shutil.disk_usage(p)
            out.append({"path": p, "total_gb": round(u.total / 2**30, 1), "free_gb": round(u.free / 2**30, 1),
                        "used_percent": round(100.0 * (u.total - u.free) / u.total, 1) if u.total else None})
        except OSError as error:
            out.append({"path": p, "error": type(error).__name__})
    return out


def _net_bytes() -> tuple[int, int] | None:
    if psutil:
        n = psutil.net_io_counters()
        return n.bytes_sent, n.bytes_recv
    if sys.platform.startswith("linux"):
        sent = recv = 0
        with open("/proc/net/dev", encoding="ascii") as fh:
            for line in fh.readlines()[2:]:
                name, data = line.split(":", 1)
                if name.strip() == "lo":
                    continue
                f = data.split()
                recv += int(f[0]); sent += int(f[8])
        return sent, recv
    return None


def network() -> dict:
    now, cur = time.time(), _net_bytes()
    prev = _last.get("net")
    _last["net"] = (now, cur)
    if not cur:
        return {"available": False}
    out = {"bytes_sent": cur[0], "bytes_recv": cur[1]}
    if prev and prev[1]:
        dt = max(now - prev[0], 1e-3)
        out |= {"sent_kbps": round((cur[0] - prev[1][0]) * 8 / 1000 / dt, 1),
                "recv_kbps": round((cur[1] - prev[1][1]) * 8 / 1000 / dt, 1)}
    return out


def uptime_s() -> float | None:
    if psutil:
        return round(time.time() - psutil.boot_time())
    if sys.platform.startswith("linux"):
        with open("/proc/uptime", encoding="ascii") as fh:
            return round(float(fh.read().split()[0]))
    if os.name == "nt":
        ctypes.windll.kernel32.GetTickCount64.restype = ctypes.c_ulonglong
        return round(ctypes.windll.kernel32.GetTickCount64() / 1000)
    return None


def load_avg():
    try:
        return [round(x, 2) for x in os.getloadavg()]
    except (AttributeError, OSError):
        return None


def snapshot(disk_paths: list[str]) -> dict:
    return {"hostname": socket.gethostname(), "platform": sys.platform, "python": sys.version.split()[0],
            "cpu_percent": cpu_percent(), "cpu_count": os.cpu_count(), "load_avg": load_avg(),
            "memory": memory(), "disks": disks(disk_paths), "network": network(), "uptime_s": uptime_s()}


def prime() -> None:
    """Take the first CPU/network sample so the first real snapshot has rates."""
    cpu_percent(); network()
