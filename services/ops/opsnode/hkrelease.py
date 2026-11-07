"""Hong Kong release status, read without the control command and without root.

`iridescently-control` is a forced-command tool: it reads its action from SSH_ORIGINAL_COMMAND and every
non-status path takes the deploy lock. Calling it from the agent (even as `status` under sudo) would
mean giving the agent a root entry point into a write-capable tool. This module instead re-reads the
same files the control's `status` reads, with the agent's own unprivileged user:

  /srv/iridescently/control/next.json         -> storageRoot, environment, units
  <storage>/<env>/releases/channels/<env>.json -> current / previous / sourceHead
  <storage>/<env>/releases/store/              -> release ids (names only)
  systemctl is-active <unit>                   -> no privileges needed

Nothing is opened for writing, no lock is taken, nothing is executed except `systemctl is-active`.
The output keeps the control's field names so the hub shows both the same way.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

RELEASE_ID = re.compile(r"\d{8}T\d{9}Z-[a-f0-9]{12}-[a-f0-9]{12}")


def status(control_config: str = "/srv/iridescently/control/next.json") -> dict:
    try:
        cfg = json.loads(Path(control_config).read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        return {"ok": False, "error": f"control config unreadable: {type(error).__name__}"}
    storage, env = Path(str(cfg.get("storageRoot", ""))), cfg.get("environment", "production")
    if not storage.is_absolute() or env not in ("production", "staging"):
        return {"ok": False, "error": "control config invalid"}
    releases = storage / env / "releases"
    try:
        chan = json.loads((releases / "channels" / f"{env}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        return {"ok": False, "error": f"channel unreadable: {type(error).__name__}"}
    current = chan.get("current") if isinstance(chan.get("current"), str) and RELEASE_ID.fullmatch(chan["current"]) else None
    try:
        store = sorted(p.name for p in (releases / "store").iterdir() if RELEASE_ID.fullmatch(p.name))
    except OSError:
        store = None
    units = {}
    for unit in cfg.get("units", []):
        try:
            units[unit] = subprocess.run(["systemctl", "is-active", unit], capture_output=True, text=True,
                                         timeout=10).stdout.strip()
        except Exception as error:  # noqa: BLE001
            units[unit] = type(error).__name__
    return {"ok": bool(current) and all(v == "active" for v in units.values()),
            "layout": "canonical", "mode": cfg.get("layout"), "environment": env, "current": current,
            "previous": chan.get("previous"), "sourceHead": chan.get("sourceHead"), "services": units,
            "drift": None if current and store is not None and current in store else ("current_not_in_store" if store is not None else None),
            "releases": len(store) if store is not None else None}
