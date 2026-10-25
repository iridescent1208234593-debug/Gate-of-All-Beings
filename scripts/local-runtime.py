"""Manage only local loopback services from a verified immutable release channel.

Never starts tunnels, contacts HK, changes DNS, or selects production traffic.
"""
import argparse
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))
from storage_paths import storage_layout, environment, require_ready, ROOT_VARIABLES
from site_domains import SITE_DOMAIN

NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def selected_release():
    layout = storage_layout()
    channel = json.loads((layout["releases"] / "channels" / (environment() + ".json")).read_text(encoding="utf-8"))
    release_id = channel.get("current", "")
    if (not re.fullmatch(r"\d{8}T\d{9}Z-[a-f0-9]{12}-[a-f0-9]{12}", release_id)
            or channel.get("environment") != environment() or channel.get("site") != f"store/{release_id}/site"):
        raise ValueError("invalid local release channel")
    # The publisher runs its CLI when argv[1] names it, so the module travels in the environment.
    code = "const p=await import(process.env.IRIDESCENTLY_PUBLISHER_URL);const v=p.verifyRelease(process.argv[1]);console.log(JSON.stringify({sha:v.manifestSha256,head:v.manifest.sourceHead}));"
    result = subprocess.run([shutil.which("node"), "--input-type=module", "-e", code, release_id],
                            env={**os.environ, "IRIDESCENTLY_PUBLISHER_URL": (ROOT / "scripts/publish-release.mjs").as_uri()},
                            capture_output=True, text=True, encoding="utf-8", check=True, creationflags=NO_WINDOW)
    verified = json.loads(result.stdout)
    if verified["sha"] != channel.get("manifestSha256") or verified["head"] != channel.get("sourceHead"):
        raise ValueError("release channel hash/provenance mismatch")
    site = (layout["releases"] / channel["site"]).resolve(strict=True)
    if not site.is_relative_to(layout["releases"]):
        raise ValueError("release site escapes the configured release root")
    return site, channel


def _secrets(file):
    if not file.exists():
        return {}
    result = {}
    for line in file.read_text(encoding="utf-8-sig").splitlines():
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name, value = name.strip(), value.strip()
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", name) or name.startswith("IRIDESCENTLY_"):
            continue
        if len(value) > 1 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        result[name] = value
    return result


def launch_plan():
    require_ready()
    layout = storage_layout()
    site, channel = selected_release()
    node = shutil.which("node")
    storage_parent = os.environ.get("IRIDESCENTLY_STORAGE_ROOT", str(Path.home() / ".local/share/iridescently"))
    # Children must derive exactly this layout, so explicit root overrides travel with them.
    overrides = {f"IRIDESCENTLY_{name}_ROOT": os.environ[f"IRIDESCENTLY_{name}_ROOT"]
                 for name in ROOT_VARIABLES.values() if os.environ.get(f"IRIDESCENTLY_{name}_ROOT", "").strip()}
    specs = {
        "portal": ([sys.executable, "-X", "utf8", "-u", str(site / "server/portal_server.py")], 8080, "/api/sso-user", "site"),
        "zszm-oauth": ([sys.executable, "-X", "utf8", "-u", str(site / "server/app/src/cards/server.py")], 5174, "/api/user", "cards"),
        "zszm-balance": ([node, str(site / "server/app/src/cards/server/balance-service.mjs")], 5178, "/healthz", "cards"),
        "juling": ([node, str(site / "server/app/src/juling/server.js")], 5177, "/api/state", "juling"),
        "softie": ([node, str(site / "server/app/src/softie-webgpu/server/spirit-service.mjs")], 4173, "/healthz", "spirit"),
    }
    common = {"IRIDESCENTLY_PROJECT_ROOT": str(site), "IRIDESCENTLY_STORAGE_ROOT": str(storage_parent),
              "IRIDESCENTLY_ENVIRONMENT": environment(), "PYTHONUTF8": "1", "PYTHONDONTWRITEBYTECODE": "1",
              "SITE_DOMAIN": SITE_DOMAIN, "HOST": "127.0.0.1", **overrides, **_secrets(layout["data"] / "secrets/site.env"),
              **_secrets(layout["data"] / "secrets/server.env")}
    services = {}
    for key, (command, port, health, module) in specs.items():
        services[key] = {"command": command, "port": port, "health": health,
                         "cwd": str(layout["cache"] / "runtime" / key),
                         "env": {**common, **_secrets(layout["data"] / "secrets" / (module + ".env")), "PORT": str(port)}}
    return {"site": str(site), "environment": environment(), "storageRoot": str(storage_parent),
            "sourceHead": channel["sourceHead"], "release": channel["current"], "services": services}


def _identity(pid):
    if os.name == "nt":
        result = subprocess.run(["powershell.exe", "-NoProfile", "-Command",
                                 f"(Get-Process -Id {int(pid)} -ErrorAction SilentlyContinue).StartTime.ToUniversalTime().Ticks"],
                                capture_output=True, text=True, creationflags=NO_WINDOW)
        return result.stdout.strip() if result.returncode == 0 else ""
    try:
        return Path(f"/proc/{int(pid)}/stat").read_text().rsplit(")", 1)[1].split()[19]
    except (OSError, IndexError):
        return ""


def _alive(record):
    return bool(record and record.get("identity") and _identity(record["pid"]) == record["identity"])


def _healthy(service):
    try:
        connection = http.client.HTTPConnection("127.0.0.1", service["port"], timeout=2)
        # The portal accepts only approved hosts with the ingress' HTTPS marker from loopback.
        connection.request("GET", service["health"], headers={"Host": "zszm." + SITE_DOMAIN, "X-Forwarded-Proto": "https"})
        response = connection.getresponse()
        response.read()
        connection.close()
        return response.status == 200
    except OSError:
        return False


def _state_file():
    # Process bookkeeping is disposable; it never belongs with persistent data.
    return storage_layout()["cache"] / "runtime" / "local-runtime.json"


def _state():
    file = _state_file()
    return json.loads(file.read_text(encoding="utf-8")) if file.exists() else {"services": {}}


def _save(state):
    file = _state_file()
    file.parent.mkdir(parents=True, exist_ok=True)
    temporary = file.with_suffix(".tmp")
    temporary.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    temporary.replace(file)


def status():
    plan, state = launch_plan(), _state()
    return {"release": plan["release"], "sourceHead": plan["sourceHead"], "site": plan["site"],
            "services": {key: {"running": _alive(state["services"].get(key)), "healthy": _healthy(service),
                               "port": service["port"], "pid": state["services"].get(key, {}).get("pid")}
                         for key, service in plan["services"].items()}}


def stop():
    state = _state()
    for record in state["services"].values():
        if _alive(record):
            os.kill(record["pid"], signal.SIGTERM)
    deadline = time.monotonic() + 10
    while any(_alive(record) for record in state["services"].values()) and time.monotonic() < deadline:
        time.sleep(0.1)
    if any(_alive(record) for record in state["services"].values()):
        raise RuntimeError("a managed service has not stopped")
    _save({"services": {}})
    return {"stopped": True}


def start():
    plan, state = launch_plan(), _state()
    if any(_alive(record) for record in state["services"].values()):
        if state.get("release") != plan["release"]:
            raise RuntimeError("stop the managed previous release before starting the new local release")
        if all(_alive(state["services"].get(key)) and _healthy(value) for key, value in plan["services"].items()):
            return status()
        raise RuntimeError("managed runtime is partial; stop it before restarting")
    for service in plan["services"].values():
        with socket.socket() as probe:
            if probe.connect_ex(("127.0.0.1", service["port"])) == 0:
                raise RuntimeError(f"local port {service['port']} is occupied; no existing process was stopped")
    state = {"release": plan["release"], "sourceHead": plan["sourceHead"], "services": {}}
    _save(state)
    try:
        for key, service in plan["services"].items():
            cwd = Path(service["cwd"])
            cwd.mkdir(parents=True, exist_ok=True)
            log_path = storage_layout()["cache"] / "logs/local-runtime" / (key + ".log")
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with log_path.open("ab") as log:
                process = subprocess.Popen(service["command"], cwd=cwd, env={**os.environ, **service["env"]},
                                           stdin=subprocess.DEVNULL, stdout=log, stderr=log, creationflags=NO_WINDOW)
            identity = _identity(process.pid)
            if not identity:
                raise RuntimeError(f"{key} exited at startup; inspect {log_path}")
            state["services"][key] = {"pid": process.pid, "identity": identity}
            _save(state)
            deadline = time.monotonic() + 30
            while process.poll() is None and not _healthy(service) and time.monotonic() < deadline:
                time.sleep(0.2)
            if process.poll() is not None or not _healthy(service):
                raise RuntimeError(f"{key} failed local health; inspect {log_path}")
    except BaseException:
        stop()
        raise
    return status()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("start", "stop", "status", "verify"))
    args = parser.parse_args()
    result = {"start": start, "stop": stop, "status": status,
              "verify": lambda: {k: v for k, v in launch_plan().items() if k != "services"}}[args.command]()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
