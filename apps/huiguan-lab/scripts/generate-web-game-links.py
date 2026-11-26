"""Generate the LAB's read-only website links from the portal and domain registries."""
from __future__ import annotations

import json
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

LAB = Path(__file__).resolve().parents[1]
ROOT = LAB.parents[1]
TARGET = LAB / "client/data/web_game_routes.json"
# These three routes are owned by the zszm door hall (apps/cards/src/game/MODES.md).
CARD_ROUTES = {"cards": "/#journal", "management": "/#management", "ecology": "/#ecosystem"}


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def build_routes(domains, portal, presentation):
    # Use the live LAB root without changing legacy site defaults or OAuth callbacks.
    _, _, root = domains["labDirect"]["host"].partition(".")
    if root not in domains["roots"] or not re.fullmatch(r"[a-z0-9.-]+", root):
        raise ValueError("Invalid default site root")
    origin = f'{domains["services"]["zszm"]}.{root}'
    main_prefix = domains["services"]["main"]
    main_origin = f"{main_prefix + '.' if main_prefix else ''}{root}"
    requested = {entry["key"] for group in presentation for entry in group["entries"]}
    routes = {}
    for item in portal["links"]:
        key = item.get("key")
        path = item.get("url", "")
        if key not in requested or item.get("status") == "unpublished":
            continue
        parts = urlsplit(path)
        if (not re.fullmatch(r"[a-z0-9-]+", key) or not path.startswith("/") or path.startswith("//")
                or any(mark in path for mark in ("\\", "?", "\n", "\r")) or parts.netloc or parts.scheme):
            raise ValueError(f"Invalid published route for {key!r}")
        if key in CARD_ROUTES:
            routes[key] = {"host": origin, "path": CARD_ROUTES[key]}
        elif key == "shengsheng-shoot":
            routes[key] = {"host": main_origin, "path": path}
        else:
            routes[key] = {"host": origin, "path": f"/app/shell/m/{key}"}
    return routes


def main(args):
    payload = build_routes(read(ROOT / "packages/site-domains/domains.json"),
                           read(ROOT / "apps/shell/portal.json"), read(LAB / "client/data/web_games.json"))
    rendered = json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    if args == ["--check"]:
        if TARGET.read_text(encoding="utf-8") != rendered:
            raise SystemExit("LAB web_game_routes.json needs regeneration")
    elif not args:
        TARGET.write_text(rendered, encoding="utf-8")
    else:
        raise SystemExit("usage: generate-web-game-links.py [--check]")


if __name__ == "__main__":
    main(sys.argv[1:])
