"""LAB V2 configuration: paths, ports and public origin.

Nothing here selects production data. Every path is derived from the LAB source tree,
an explicit config file or LAB_* environment variables, never from historical absolute paths.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

SOURCE_ROOT = Path(__file__).resolve().parents[2]          # labs/zszm-lab-v2
VERSION = "lab-v2.2.1"


def _workspace_root(start: Path) -> Path | None:
    for parent in [start, *start.parents]:
        if (parent / "iridescently-workspace.json").is_file():
            return parent
    return None


@dataclass
class Config:
    public_host: str = "pc-lab.iridescently.cn"
    bind: str = "127.0.0.1"
    port: int = 18300            # public game gateway (the only port the LAB tunnel reaches)
    admin_port: int = 18302      # admin console, loopback only, never routed by the tunnel
    r4_port: int = 18301         # R4 world service instance owned by the LAB
    runtime: Path = field(default_factory=lambda: SOURCE_ROOT.parent / "zszm-lab-v2-runtime")
    secrets: Path = field(default_factory=lambda: (_workspace_root(SOURCE_ROOT) or SOURCE_ROOT.parent) / "secrets" / "lab-v2")
    session_days: int = 7
    player_test_codes_enabled: bool = True
    oc_max_bytes: int = 8 * 1024 * 1024
    oc_max_side: int = 4096
    art_max_bytes: int = 8 * 1024 * 1024
    oc_display_side: int = 512
    oc_cache_budget_bytes: int = 256 * 1024 * 1024
    oc_ttl_seconds: int = 6 * 3600
    max_players: int = 120
    admission_max_waiters: int = 0  # 0 = existing admission; opt in with a measured backlog limit
    admission_legacy_players: bool = False  # explicit old-code bridge; no double-spend
    account_issuer: str = ""
    account_direct_web_enabled: bool = False
    account_direct_native_enabled: bool = False
    account_direct_native_android_enabled: bool = False
    r4_enabled: bool = True
    r4_python: Path = field(default_factory=lambda: (_workspace_root(SOURCE_ROOT) or SOURCE_ROOT.parents[1]) / "labs" / "iridescently-labs" / "research" / "experiments" / "zhongsheng-world-lab" / ".venv" / "Scripts" / "python.exe")
    r4_service_dir: Path = field(default_factory=lambda: (_workspace_root(SOURCE_ROOT) or SOURCE_ROOT.parents[1]) / "labs" / "iridescently-labs" / "research" / "experiments" / "living-world" / "r4")
    cloudflared: str = "cloudflared"
    tunnel_enabled: bool = True
    r4_interval_seconds: int = 60
    extra_origins: list[str] = field(default_factory=list)
    web_build: Path | None = None

    @property
    def data_dir(self) -> Path: return self.runtime / "data"
    @property
    def log_dir(self) -> Path: return self.runtime / "logs"
    @property
    def oc_dir(self) -> Path: return self.runtime / "oc-cache"
    @property
    def art_dir(self) -> Path: return self.runtime / "art-uploads"
    @property
    def backup_dir(self) -> Path: return self.runtime / "backups"
    @property
    def r4_dir(self) -> Path: return self.runtime / "r4"
    @property
    def web_dir(self) -> Path: return self.web_build or SOURCE_ROOT / "build" / "web"
    @property
    def db_path(self) -> Path: return self.data_dir / "lab.sqlite"

    def origins(self) -> set[str]:
        local = {f"http://127.0.0.1:{self.port}", f"http://localhost:{self.port}"}
        return {f"https://{self.public_host}", *local, *self.extra_origins}

    def hosts(self) -> set[str]:
        return {self.public_host, f"127.0.0.1:{self.port}", f"localhost:{self.port}"}

    def ensure_dirs(self) -> None:
        for d in (self.data_dir, self.log_dir, self.oc_dir, self.art_dir / "pending", self.art_dir / "approved",
                  self.backup_dir, self.r4_dir, self.secrets):
            d.mkdir(parents=True, exist_ok=True)


def load(path: str | os.PathLike | None = None) -> Config:
    cfg = Config()
    path = path or os.environ.get("LAB_CONFIG") or (SOURCE_ROOT / "lab.config.json")
    p = Path(path)
    if p.is_file():
        raw = json.loads(p.read_text(encoding="utf-8"))
        for key, value in raw.items():
            if key.startswith("_"):
                continue
            if not hasattr(cfg, key):
                raise ValueError(f"unknown config key {key}")
            if key in ("runtime", "secrets", "r4_python", "r4_service_dir", "web_build") and value is not None:
                value = (p.parent / value).resolve() if not Path(value).is_absolute() else Path(value)
            setattr(cfg, key, value)
    if type(cfg.account_direct_native_enabled) is not bool:
        raise ValueError("account_direct_native_enabled must be a boolean")
    if cfg.account_direct_native_enabled and not cfg.account_direct_web_enabled:
        raise ValueError("native account login needs direct Web consent")
    if type(cfg.account_direct_native_android_enabled) is not bool:
        raise ValueError("account_direct_native_android_enabled must be a boolean")
    if cfg.account_direct_native_android_enabled and (
        not cfg.account_direct_native_enabled or cfg.public_host != "pc-lab.iridescently.cn"
    ):
        raise ValueError("Android app links need native login and the approved LAB host")
    if type(cfg.account_direct_web_enabled) is not bool:
        raise ValueError("account_direct_web_enabled must be a boolean")
    if type(cfg.player_test_codes_enabled) is not bool:
        raise ValueError("player_test_codes_enabled must be a boolean")
    if os.environ.get("LAB_RUNTIME"):
        cfg.runtime = Path(os.environ["LAB_RUNTIME"]).resolve()
    if os.environ.get("LAB_SECRETS"):
        cfg.secrets = Path(os.environ["LAB_SECRETS"]).resolve()
    if os.environ.get("LAB_PORT"):
        cfg.port = int(os.environ["LAB_PORT"])
    if os.environ.get("LAB_ADMIN_PORT"):
        cfg.admin_port = int(os.environ["LAB_ADMIN_PORT"])
    if os.environ.get("LAB_R4") == "0":
        cfg.r4_enabled = False
    return cfg
