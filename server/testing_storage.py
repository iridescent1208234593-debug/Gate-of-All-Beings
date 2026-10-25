"""Disposable storage setup shared by integration checks; never selects live data."""
import os
from pathlib import Path

from storage_paths import initialize_storage, data_root, assets_root


def configure(root):
    for name in ("DATA", "ASSETS", "CACHE", "RELEASE", "BACKUP"):
        os.environ.pop(f"IRIDESCENTLY_{name}_ROOT", None)
    os.environ.update(IRIDESCENTLY_STORAGE_ROOT=str(Path(root).resolve()),
                      IRIDESCENTLY_ENVIRONMENT="test",
                      IRIDESCENTLY_PROJECT_ROOT=str(Path(__file__).resolve().parents[1]))
    initialize_storage()
    return data_root()
