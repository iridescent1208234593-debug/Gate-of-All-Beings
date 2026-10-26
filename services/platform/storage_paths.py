"""External environment-isolated storage. Lookups never create files.

Runtime writers require a readiness marker. Source selection never selects data.
"""
import json
import os
from pathlib import Path, PureWindowsPath

_CODE_ROOT = Path(__file__).resolve().parents[2]
ENVIRONMENTS = {"development", "staging", "production", "test"}
ROOT_VARIABLES = {"data": "DATA", "assets": "ASSETS", "cache": "CACHE", "releases": "RELEASE", "backups": "BACKUP"}
MARKER = ".storage-ready.json"
# The engineering workspace (repo, worktrees, runtime, operations, ...) describes itself with
# this file at its root, using paths relative to that root (docs/workspace.md).
WORKSPACE_MANIFEST = "iridescently-workspace.json"


def environment():
    mode = os.environ.get("IRIDESCENTLY_ENVIRONMENT", "development").strip()
    if mode not in ENVIRONMENTS:
        raise ValueError("invalid IRIDESCENTLY_ENVIRONMENT")
    return mode


def _absolute(value):
    result = Path(value).expanduser()
    if not result.is_absolute():
        raise ValueError("storage roots must be absolute")
    return result.resolve()


def project_root():
    return _absolute(os.environ.get("IRIDESCENTLY_PROJECT_ROOT", str(_CODE_ROOT)))


def _within(value, parent):
    return value == parent or parent in value.parents


def workspace_root():
    """IRIDESCENTLY_WORKSPACE_ROOT, else the nearest ancestor of this checkout holding the manifest."""
    configured = os.environ.get("IRIDESCENTLY_WORKSPACE_ROOT", "").strip()
    if configured:
        return _absolute(configured)
    return next((directory for directory in _CODE_ROOT.parents if (directory / WORKSPACE_MANIFEST).is_file()), None)


def workspace_path(key):
    """A named workspace root (runtime, operations, ...); None outside a workspace or when not declared."""
    root = workspace_root()
    if root is None:
        return None
    manifest = json.loads((root / WORKSPACE_MANIFEST).read_text(encoding="utf-8"))
    value = manifest.get("roots", {}).get(key) if manifest.get("schema") == 1 else None
    if not isinstance(value, str) or not value:
        return None
    # Relative and inside the workspace, so the whole workspace can move without edits.
    return _absolute(str(root.joinpath(*_parts((value,)))))


def storage_root():
    """Parent of the environment directories. Test storage is always an explicit temporary root."""
    configured = os.environ.get("IRIDESCENTLY_STORAGE_ROOT", "").strip()
    if configured:
        return _absolute(configured)
    if environment() == "test":
        raise ValueError("test requires an explicit temporary IRIDESCENTLY_STORAGE_ROOT")
    return workspace_path("runtime") or _absolute(str(Path.home() / ".local" / "share" / "iridescently"))


def storage_layout():
    mode = environment()
    base = storage_root() / mode
    layout = {key: _absolute(os.environ.get("IRIDESCENTLY_" + variable + "_ROOT", "").strip() or str(base / key))
              for key, variable in ROOT_VARIABLES.items()}
    for key, value in layout.items():
        for source in {_CODE_ROOT, project_root()}:
            if _within(value, source) or (key != "releases" and _within(source, value)):
                raise ValueError(f"{key} root overlaps source: {value}")
        for other, target in layout.items():
            if key != other and _within(value, target):
                raise ValueError(f"{key} and {other} storage roots overlap")
    return layout


def data_root():
    return storage_layout()["data"]


def has_separate_data_root():
    return True


def assets_root():
    return storage_layout()["assets"]


def cache_root():
    return storage_layout()["cache"]


def release_root():
    return storage_layout()["releases"]


def backup_root():
    return storage_layout()["backups"]


def secrets_dir():
    return data_root() / "secrets"


def _parts(parts):
    result = []
    for part in parts:
        if not isinstance(part, (str, os.PathLike)):
            raise ValueError("invalid relative storage path")
        text = str(part)
        pieces = text.replace("\\", "/").split("/")
        if PureWindowsPath(text).drive or Path(text).is_absolute() or any(p in ("", ".", "..") or ":" in p or "\x00" in p for p in pieces):
            raise ValueError("invalid relative storage path")
        result.extend(pieces)
    return result


def _data_dir(service, root=None):
    base = _absolute(root) if root is not None else data_root()
    if any(_within(base, source) for source in {_CODE_ROOT, project_root()}):
        raise ValueError("persistent data cannot be placed in source")
    return base / service


def huiguan_data_dir(root=None):
    return _data_dir("huiguan", root)


def cards_data_dir(root=None):
    return _data_dir("cards", root)


def juling_data_dir(root=None):
    return _data_dir("juling", root)


def homepage_data_dir(root=None):
    return _data_dir("homepage", root)


def managed_asset_dir(module, kind, root=None):
    base = assets_root() if root is None or _absolute(root) == data_root() else _absolute(root) / "assets"
    return base / "managed" / Path(*_parts((module, kind)))


def source_asset_dir(category, *parts, project_root_override=None):
    base = assets_root() if project_root_override is None or _absolute(project_root_override) == project_root() else _absolute(project_root_override) / "assets"
    return base / "source" / Path(*_parts((category, *parts)))


def cache_dir(module, *parts):
    return cache_root() / Path(*_parts((module, *parts)))


def asset_registry_path():
    return data_root() / "assets" / "registry.sqlite3"


def asset_storage_roots():
    return {"source": assets_root() / "source", "managed": assets_root() / "managed", "cache": cache_root()}


def require_ready(service=None):
    layout = storage_layout()
    try:
        marker = json.loads((layout["data"] / MARKER).read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise RuntimeError("storage is not ready; initialize fixtures or complete verified migration first") from error
    if (marker.get("schema") != 1 or marker.get("state") != "ready" or marker.get("environment") != environment()
            or marker.get("roots") != {key: str(value) for key, value in layout.items()}):
        raise RuntimeError("storage readiness marker does not match this environment and roots")
    if service and not (layout["data"] / service).is_dir():
        raise RuntimeError(f"storage for {service} is missing")
    for relative in marker.get("required_files", []):
        file = (layout["data"] / relative).resolve()
        if not file.is_relative_to(layout["data"]) or not file.is_file() or not file.stat().st_size:
            raise RuntimeError(f"migrated persistent file is missing or empty: {relative}")
    return marker


def initialize_storage(*, migration_manifest=None, legacy_asset_roots=()):
    layout = storage_layout()
    manifest_path = Path(migration_manifest).resolve() if migration_manifest else None
    if manifest_path:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (manifest.get("verified") is not True or not manifest.get("files") or manifest.get("environment") != environment()
                or manifest.get("roots") != {key: str(value) for key, value in layout.items()}):
            raise ValueError("migration manifest is unverified or belongs to different storage")
    elif environment() not in {"test", "development"}:
        raise ValueError("production/staging storage requires a verified migration manifest")
    for value in layout.values():
        value.mkdir(parents=True, exist_ok=True)
    for module in ("huiguan", "cards", "juling", "homepage", "worldview", "spirit", "secrets"):
        (layout["data"] / module).mkdir(exist_ok=True)
    marker = {"schema": 1, "state": "ready", "environment": environment(),
              "roots": {key: str(value) for key, value in layout.items()},
              "manifest": str(manifest_path) if manifest_path else None,
              "legacy_asset_roots": list(legacy_asset_roots),
              "required_files": [entry["destination"] for entry in manifest["files"]
                                 if entry["root"] == "data" and entry["sqlite"]] if manifest_path else []}
    target = layout["data"] / MARKER
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(marker, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(target)
    return marker
