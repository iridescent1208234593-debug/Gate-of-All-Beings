"""西木会馆 - 角色卡管理 + 账号系统
- USSO OAuth 2.1 / OIDC 登录（保留，与站内账号并存）
- 站内用户名+密码 注册 / 登录（新增）
- Session 持久化到 SQLite（服务重启不掉登录态）
- 管理员面板：/admin.html + /api/admin/*（新增）
- 静态文件白名单防护：.py / .db / .log 等不再可被直接下载
使用方式: python server_huiguan.py
"""

import hashlib
import hmac
import gzip
import base64
import http.server
import ipaddress
import json
import os
import posixpath
import re
import secrets
import shutil
import socket
import sqlite3
import threading
import time
import traceback
import unicodedata
from io import BytesIO
from pathlib import Path, PureWindowsPath, PurePosixPath
from email import policy
from email.parser import BytesParser
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from http.cookies import SimpleCookie
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "services", "platform"))
import hx_sso
import oc_store
from functools import wraps
from site_domains import (SITE_DOMAIN, PRODUCTION_HOSTS, cookie_domain, request_host, request_root,
                          request_origin_allowed, cors_headers, oauth_callback, site_url, OAuthUnavailable)
from site_admin import is_site_owner
from account_security import init_schema as init_security_schema, handle_security
from account_email import init_schema as init_email_schema, handle_email
from account_recovery import init_schema as init_recovery_schema, handle_recovery
from account_profile import init_schema as init_profile_schema, get_profile, set_account_avatar, valid_asset_url, store_avatar_image as normalize_avatar_image
import game_saves
import account_progress
import turnstile
from showcase_document import published_document
from base_static import BaseStaticHandler, static_allowed as _base_static_allowed, SECURITY_HEADERS
from storage_paths import (project_root as resolve_project_root, data_root, huiguan_data_dir,
                           managed_asset_dir, source_asset_dir, cache_dir, require_ready)

# ========== 配置 ==========
PORT = 8089
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = str(resolve_project_root())
DATA_ROOT = data_root()
require_ready()
RUNTIME_DIR = str(huiguan_data_dir(DATA_ROOT))
CODE_ROOT = os.path.dirname(os.path.dirname(STATIC_DIR))

# USSO 配置（去 https://sso.umrc.cn/dev.php 创建应用后获取）
CLIENT_ID = "client_6e6b9df8063a9bc2"
CLIENT_SECRET = os.environ.get("USSO_CLIENT_SECRET", "")
USSO_LOGIN_ENABLED = os.environ.get("USSO_LOGIN_ENABLED", "0").strip().lower() in ("1", "true", "yes", "on")
SCOPE = "openid basic email profile"

# 回调地址（必须与 USSO 后台配置完全一致）
CALLBACK_URL = oauth_callback("huiguan")

# USSO 端点
SSO_AUTHORIZE = "https://sso.umrc.cn/authorize.php"
SSO_TOKEN = "https://sso.umrc.cn/token.php"
SSO_USERINFO = "https://sso.umrc.cn/userinfo.php"

# 站长 USSO ID：永远拥有管理员权限
ADMIN_USSO_IDS = {"7"}

# 编辑码：知道编辑码的用户可免申请直接成为编辑（仅服务端校验，不下发前端）；可用环境变量覆盖
EDITOR_CODE = os.environ.get("HUIGUAN_EDITOR_CODE", "20142010")
GROUP_QQ = "878029597"
# 妖王自述超过该字数自动通过，否则进入人工审核
YAOWANG_AUTO_MIN_CHARS = 50

# 会话有效期（天）
SESSION_DAYS = 30
COOKIE_SECURE = os.environ.get("IRIDESCENTLY_ENVIRONMENT", "production").strip().lower() != "development"

# 角色卡保存
DATA_FILE = os.path.join(RUNTIME_DIR, "characters.json")

# 云存档：users.db 的 game_saves 表，按 (kind, uid, scope) 隔离，见 services/platform/game_saves.py。
# 旧 game_saves.json（裸 uid）只在启动时按内容哈希导入一次，不再写入，保留作回滚来源。
GAME_SAVE_FILE = os.path.join(RUNTIME_DIR, "game_saves.json")

# 用户信息本地数据库（SQLite）
USER_DB = os.path.join(RUNTIME_DIR, "users.db")
DB_LOCK = threading.Lock()

# 罗小黑战记世界观库（只读直查）；大型素材目录由部署环境单独提供。
WV_ROOT_DIR = str(source_asset_dir("罗小黑战记数据库"))
WV_DB = str(DATA_ROOT / "worldview" / "worldview_luoxiaohei_v4.db")
WV_IMG_DIR = str(managed_asset_dir("worldview", "images"))
THUMB_DIR = str(cache_dir("huiguan", "thumbs"))
os.makedirs(WV_IMG_DIR, exist_ok=True)
os.makedirs(THUMB_DIR, exist_ok=True)
# Public "site version" of every image: re-encoded WebP, bounded size, metadata stripped.
# Source files are never sent to anyone but the site owner (see /api/original-image).
PREVIEW_DIR = str(cache_dir("huiguan", "previews"))
os.makedirs(PREVIEW_DIR, exist_ok=True)
PREVIEW_MAX_EDGE = 1600
PREVIEW_ANIMATED_EDGE = 640
_PREVIEW_LOCK = threading.Lock()
UPLOAD_NAME_RE = re.compile(r"^[A-Za-z0-9]{16,64}\.(?:png|jpe?g|webp|gif)$")
REMOTE_IMAGE_HOSTS = frozenset({"huiji-thumb.huijistatic.com", "huiji-public.huijistatic.com"})
IMAGE_SOURCE_LOCK = threading.Lock()
IMAGE_SOURCES = {}
IMAGE_SOURCE_LIMIT = 20000
IMAGE_SOURCE_MAX_AGE = 3600
IMAGE_FETCH_LIMIT = 20 * 1024 * 1024

# Official worldview names cannot be used as community account titles.
def _normalize_title_name(value):
    value = unicodedata.normalize("NFKC", str(value or "")).casefold()
    return "".join(ch for ch in value if not ch.isspace() and unicodedata.category(ch) != "Cf")


OFFICIAL_NAME_BLACKLIST = frozenset(_normalize_title_name(name) for name in " ".join((
    'MT Nonopanda 一凡 一笙 丁 七果 七臂 乙',
    '乞峰 云飞 余 佳柒 元尾 元月 兆岳 兴帝',
    '冠旭 冠萱 冬冬 凌铜 勃勃 千针 南歌 卡里',
    '叶子 叶澜 哪吒 夏雨 大志 大松 大爽 大须',
    '大黄 天介 天心 天虎 太上老君 子墨 宴瑞 小叶',
    '小吴 小明 小瑶 小白 小白老师 小皇 小绿 小金龙',
    '小鱼 小黑 山新 岩烬 师父 希声 归月 心缘',
    '撒旦 斑臂 无限 旺财 明月 星月 晓月 最强执行者',
    '月山 木炎 机长 李清凝 杨雪 杰克斯 极光 极阳',
    '极阴 柚子 比丢 毛毛 江泠 池年 沐夜 泽宇',
    '洛 洛竹 浩客 涅帕 清凝 清凝仙子 清泉 潘靖',
    '灵遥 炎帝 狗剩 猫妖 猫渣 玄止 玄离 甲',
    '画虎 白宜 白鬃 皆逆荒 皇受 破老 秃贝 秋辞',
    '移动仓库 稀碎 空空 竹叶 粉末 紫罗兰 绿萝 罗小白',
    '罗小黑 羽夕 羽毛球 老君 老府 肄目 肉山 肖符',
    '舟渡 花轮 芷清 若水 莉澄 莽眼 蓝玉 虎妞',
    '虚淮 蛋蛋 西地 西木子 谛听 辛绝 逸风 那伽',
    '郑信毅 酒仙 酒鬼 银钩 镜云 闵先生 闵翔 阎明',
    '阿柱 阿根 阿狸 阿良 阿赫 阿龙 雨夜 雨檀',
    '雨笛 青丘 青峰 风息 飞毯豹 鬼辰 鬼镰 鳄鱼',
    '鸠老 鸭鸭 鹤天 鹿野 黄溜溜 黑猫 黑阳 龙游市市长',
    '龙老 木落 艾米 老龙王 众生之门',
)).split())
OFFICIAL_NAME_ERROR = "该名号为官方世界观角色名，禁止用作名号，请另取一个"

def is_official_title_name(value):
    return _normalize_title_name(value) in OFFICIAL_NAME_BLACKLIST

def _worldview_connection():
    """The migrated worldview must exist; an empty replacement is never created."""
    return sqlite3.connect(Path(WV_DB).as_uri() + "?mode=rw", uri=True, timeout=10)


def wv():
    """只读连接世界观 SQLite 库"""
    conn = _worldview_connection()
    conn.row_factory = sqlite3.Row
    return conn


# sticker_uploads 是「旁路表」：只在有人上传表情包时才由上传逻辑建出来。
# 从未有人上传过的库上它并不存在，凡是用到它的查询/删除都会抛 no such table。
# 这里统一兜底建表（幂等）。
STICKER_UPLOADS_DDL = (
    "CREATE TABLE IF NOT EXISTS sticker_uploads ("
    "id INTEGER PRIMARY KEY AUTOINCREMENT, image_id INTEGER NOT NULL UNIQUE, "
    "kind TEXT NOT NULL, uid TEXT NOT NULL, nickname TEXT DEFAULT '', "
    "created_at TEXT DEFAULT (datetime('now','localtime')))"
)


def ensure_sticker_table(conn):
    """确保旁路表 sticker_uploads 存在；失败静默，交由调用方按原逻辑继续。"""
    try:
        conn.execute(STICKER_UPLOADS_DDL)
        conn.commit()
    except sqlite3.Error:
        pass


# 世界观库读缓存（mtime 失效）：编辑/补充被批准后 mtime 变化自动清空
_WV_CACHE = {"mtime": None, "data": {}}
_WV_CACHE_LOCK = threading.Lock()

def _wv_version():
    try:
        return os.stat(WV_DB).st_mtime
    except OSError:
        return None

def _wv_get(key):
    v = _wv_version()
    with _WV_CACHE_LOCK:
        if _WV_CACHE["mtime"] != v:
            _WV_CACHE["mtime"] = v
            _WV_CACHE["data"] = {}
        return _WV_CACHE["data"].get(key)

def _wv_set(key, val):
    with _WV_CACHE_LOCK:
        _WV_CACHE["data"][key] = val

def _is_remote_image(raw):
    """是否为 http(s) 外链图片"""
    return bool(raw) and raw.lower().startswith(("http://", "https://"))

# 允许经素材接口分发的本地根目录（白名单）；http(s) 外链不受此限
ASSET_ROOT_DIRS = (WV_ROOT_DIR, str(source_asset_dir("素材")), WV_IMG_DIR)
# 仅允许分发的图片后缀，防止借白名单读取根内非图片文件
ASSET_IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif")

def _safe_image_path(raw):
    """校验图片路径在允许的素材根目录内且为图片后缀；http(s) 外链原样返回"""
    if not raw:
        return None
    if _is_remote_image(raw):
        return raw
    # Migrated DBs retain their original bytes, including old absolute paths.
    # Only roots recorded by the verified migration may be translated.
    try:
        marker = json.loads((DATA_ROOT / ".storage-ready.json").read_text(encoding="utf-8"))
        path_type = PureWindowsPath if PureWindowsPath(raw).drive else PurePosixPath
        stored = path_type(raw)
        for legacy_root in marker.get("legacy_asset_roots", []):
            try:
                relative = stored.relative_to(path_type(legacy_root))
            except ValueError:
                continue
            if ".." not in relative.parts:
                raw = str(source_asset_dir(*relative.parts))
                break
    except (OSError, ValueError, TypeError):
        pass
    p = os.path.realpath(raw)
    if not os.path.isabs(p):
        return None
    if os.path.splitext(p)[1].lower() not in ASSET_IMAGE_EXTS:
        return None
    for root in ASSET_ROOT_DIRS:
        try:
            if os.path.commonpath([p, os.path.realpath(root)]) == os.path.realpath(root):
                return p
        except ValueError:
            continue
    return None

# 静态文件防护：禁止直接下载的敏感后缀 / 目录
BLOCKED_STATIC_SUFFIXES = (".py", ".db", ".log", ".sqlite", ".json.bak")
BLOCKED_STATIC_NAMES = {"characters.json", "game_saves.json"}
BLOCKED_STATIC_DIRS = {".git", "__pycache__"}

# 简单限流（内存）
RATE = {}
RATE_LOCK = threading.Lock()

USERNAME_RE = re.compile(r"^[\u4e00-\u9fa5A-Za-z0-9_]{2,16}$")


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


# 会馆档案体系（唯一来源）：「官方角色档案」分主册 / 副册两册；「同人角色档案」是独立的一套档案。
# 页面分册条、作品详情与投稿都从这里取分册 key 和名称。
ARCHIVES = (
    {"key": "official", "title": "官方角色档案", "volumes": (
        {"key": "official_main", "label": "主册", "title": "官方角色档案", "page": "/gallery.html",
         "desc": "《罗小黑战记》原作已有角色的官方设定与官方素材。"},
        {"key": "official_fanart", "label": "副册", "title": "官方角色同人画廊", "page": "/works.html",
         "desc": "与主册同步的官方角色，由爱好者自行上传同人图（如小黑、无限、风息的二创），并非官方出品或官方认证。"},
    )},
    {"key": "fan", "title": "同人角色档案", "volumes": (
        {"key": "fan_characters", "label": "", "title": "同人角色档案", "page": "/fan.html",
         "desc": "罗小黑战记 · 同人创作角色 · 由爱好者提交与分享"},
    )},
)


# 同人图评论按语境分两套：main = 主册角色页，sub = 副册（官方角色同人画廊）
FANART_COMMENT_TABLES = {"main": "official_fanart_comments", "sub": "official_fanart_sub_comments"}


def fanart_score_sql(alias):
    """同人图得分 = 点赞 + 喜欢 - 2 × 踩（与同人画廊同一公式）；同分时由调用方按新上传在前。"""
    return (f"((SELECT COUNT(*) FROM official_fanart_likes l WHERE l.fanart_id={alias}.id)"
            f" + (SELECT COUNT(*) FROM official_fanart_votes v WHERE v.fanart_id={alias}.id AND v.vote=1)"
            f" - 2 * (SELECT COUNT(*) FROM official_fanart_votes v WHERE v.fanart_id={alias}.id AND v.vote=-1))")


def db():
    conn = sqlite3.connect(USER_DB, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def init_user_db():
    if (os.environ.get("IRIDESCENTLY_OC_BACKEND", "json") == "sqlite"
            or oc_store.state(RUNTIME_DIR)["backend"] == "sqlite") and not Path(USER_DB).is_file():
        raise RuntimeError("active SQL OC database is missing; restore verified storage")
    os.makedirs(RUNTIME_DIR, exist_ok=True)
    with DB_LOCK:
        conn = db()
        oc_store.initialize_schema(conn)
        # journal_mode 是持久属性，这里只设置一次（启动期，有 DB_LOCK 保护）。
        # 注意：本机 Windows 的 SQLite 构建（3.53.1）WAL 并发写有缺陷（-shm 映射
        # 竞态导致 "attempt to write a readonly database"，见 services/platform/gallery_interactions.py
        # 中 _init_journal_mode 的注释）。注册/登录属于低频写、读多写少，
        # Windows 上退回回滚日志模式更稳；非 Windows 保留 WAL。
        import sys as _sys
        if _sys.platform == "win32":
            if conn.execute("PRAGMA journal_mode").fetchone()[0].lower() != "delete":
                conn.execute("PRAGMA journal_mode=DELETE")
        else:
            conn.execute("PRAGMA journal_mode=WAL")  # readers no longer block on the writer; persists in the file
        init_security_schema(conn)
        init_email_schema(conn)
        init_recovery_schema(conn)
        init_profile_schema(conn)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                nickname TEXT,
                email TEXT,
                picture TEXT,
                first_login TEXT,
                last_login TEXT
            )
        """)
        # 站内注册账号
        conn.execute("""
            CREATE TABLE IF NOT EXISTS local_users (
                uid INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                pass_hash TEXT NOT NULL,
                nickname TEXT DEFAULT '',
                email TEXT DEFAULT '',
                picture TEXT DEFAULT '',
                role TEXT DEFAULT 'user',
                status TEXT DEFAULT 'active',
                created_at TEXT,
                last_login TEXT
            )
        """)
        # 会话持久化
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions_db (
                sid TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                uid TEXT NOT NULL,
                created_at TEXT,
                expires_at TEXT
            )
        """)
        if "audience" not in {row[1] for row in conn.execute("PRAGMA table_info(sessions_db)")}:
            conn.execute("ALTER TABLE sessions_db ADD COLUMN audience TEXT NOT NULL DEFAULT 'iridescently.xyz'")
        # USSO 用户的管理标记（封禁 / 管理员）
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_flags (
                kind TEXT NOT NULL,
                uid TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                role TEXT DEFAULT 'user',
                PRIMARY KEY (kind, uid)
            )
        """)
        # 长老申请（执行者申请 → 管理员审批）
        conn.execute("""
            CREATE TABLE IF NOT EXISTS elder_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL,
                uid TEXT NOT NULL,
                name TEXT DEFAULT '',
                message TEXT DEFAULT '',
                status TEXT DEFAULT 'pending',
                created_at TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS executor_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_kind TEXT NOT NULL,
                user_uid TEXT NOT NULL,
                user_name TEXT DEFAULT '',
                message TEXT DEFAULT '',
                status TEXT DEFAULT 'pending',
                created_at TEXT DEFAULT (datetime('now','localtime')),
                reviewed_by TEXT DEFAULT '',
                reviewed_at TEXT
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_executor_requests_pending ON executor_requests(user_kind, user_uid, status)")
        # 角色模型升级：注册默认执行者，旧 'user' 迁移为 'executor'
        conn.execute("UPDATE local_users SET role='executor' WHERE role='user'")
        # 改名冷却字段（3 天一次）
        for tbl in ("local_users", "users"):
            try:
                conn.execute(f"ALTER TABLE {tbl} ADD COLUMN last_rename TEXT DEFAULT ''")
            except Exception:
                pass
        # 用户自定义主题色（默认空=宣纸乳白；签发 hx_sso 时编入 color 字段）
        for tbl in ("users", "local_users"):
            for col in ("theme_primary", "theme_accent"):
                try:
                    conn.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} TEXT DEFAULT ''")
                except Exception:
                    pass
        # 编辑权限（none / scribe / admin）：线上库早年手工加过，这里补齐新库，否则新库查编辑权限会报错
        for tbl in ("local_users", "user_flags"):
            if "edit_role" not in {r[1] for r in conn.execute(f"PRAGMA table_info({tbl})")}:
                conn.execute(f"ALTER TABLE {tbl} ADD COLUMN edit_role TEXT DEFAULT 'none'")
        for tbl in ("local_users", "user_flags"):
            columns = {row[1] for row in conn.execute(f"PRAGMA table_info({tbl})")}
            if "group_confirmed" not in columns:
                conn.execute(f"ALTER TABLE {tbl} ADD COLUMN group_confirmed INTEGER DEFAULT 0")
            if "group_nickname" not in columns:
                conn.execute(f"ALTER TABLE {tbl} ADD COLUMN group_nickname TEXT DEFAULT ''")
        # 豁免权限字段（突破年龄 / 突破技能选择），批准后置 1
        for tbl in ("local_users", "user_flags"):
            for col in ("exempt_age", "exempt_skill"):
                try:
                    conn.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} INTEGER DEFAULT 0")
                except Exception:
                    pass
        # 旧等级积分字段：已停用，现由 account_progress 的 account_points 表记账（见 services/platform/account_progress.py）；
        # 列保留供 reset-legacy 迁移归档与回滚。
        for tbl in ("local_users", "user_flags"):
            try:
                conn.execute(f"ALTER TABLE {tbl} ADD COLUMN points INTEGER DEFAULT 0")
            except Exception:
                pass
        # 豁免申请（type: age=突破年龄限制 / skill=突破技能选择限制）
        conn.execute("""
            CREATE TABLE IF NOT EXISTS exempt_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                user_kind TEXT NOT NULL,
                user_uid TEXT NOT NULL,
                user_name TEXT DEFAULT '',
                message TEXT DEFAULT '',
                status TEXT DEFAULT 'pending',
                created_at TEXT,
                reviewed_by TEXT DEFAULT '',
                reviewed_at TEXT
            )
        """)
        # 同人角色表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS fan_characters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_kind TEXT NOT NULL,
                user_uid TEXT NOT NULL,
                user_name TEXT DEFAULT '',
                name TEXT NOT NULL,
                type TEXT DEFAULT '',
                species TEXT DEFAULT '',
                gender TEXT DEFAULT '',
                faction TEXT DEFAULT '',
                ability TEXT DEFAULT '',
                appearance TEXT DEFAULT '',
                story TEXT DEFAULT '',
                image_data TEXT DEFAULT '',
                is_public INTEGER DEFAULT 1,
                code TEXT DEFAULT '',
                created_at TEXT,
                updated_at TEXT
            )
        """)
        # fan_characters 列迁移（兼容旧表）
        for col in ("code", "created_at", "updated_at"):
            try:
                conn.execute(f"ALTER TABLE fan_characters ADD COLUMN {col} TEXT DEFAULT ''")
            except Exception:
                pass
        # 用户自命名配色（色环选色保存，全局共享，同构于前端 COLOR_SCHEMES）
        conn.execute("""
            CREATE TABLE IF NOT EXISTS color_schemes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                primary_name TEXT DEFAULT '',
                accent_name TEXT DEFAULT '',
                primary_color TEXT NOT NULL,
                accent_color TEXT NOT NULL,
                created_at TEXT
            )
        """)
        # color_schemes 列迁移（兼容旧表：主色名/辅色名分开命名）
        for col in ("primary_name", "accent_name"):
            try:
                conn.execute(f"ALTER TABLE color_schemes ADD COLUMN {col} TEXT DEFAULT ''")
            except Exception:
                pass
        # color_schemes 用户归属列迁移（旧记录为空=公共配色）
        for col in ("user_kind", "user_uid", "user_name"):
            try:
                conn.execute(f"ALTER TABLE color_schemes ADD COLUMN {col} TEXT DEFAULT ''")
            except Exception:
                pass
        # 自定义配色海报（海报工坊保存，可与人设绑定、可共享到同人画廊）
        conn.execute("""
            CREATE TABLE IF NOT EXISTS posters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_kind TEXT NOT NULL,
                user_uid TEXT NOT NULL,
                user_name TEXT DEFAULT '',
                title TEXT DEFAULT '',
                char_code TEXT DEFAULT '',
                char_name TEXT DEFAULT '',
                primary_name TEXT DEFAULT '',
                accent_name TEXT DEFAULT '',
                primary_color TEXT DEFAULT '',
                accent_color TEXT DEFAULT '',
                state_json TEXT DEFAULT '',
                img_ref TEXT DEFAULT '',
                is_public INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        # 荣誉头衔：荣誉长老 / 妖王（不含编辑与成员管理权限）
        for tbl in ("local_users", "user_flags"):
            for col in ("honor_kind", "honor_alias", "honor_reason"):
                try:
                    conn.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} TEXT DEFAULT ''")
                except Exception:
                    pass
        conn.execute("""
            CREATE TABLE IF NOT EXISTS honor_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL,
                uid TEXT NOT NULL,
                name TEXT DEFAULT '',
                honor_kind TEXT NOT NULL,
                alias TEXT DEFAULT '',
                reason TEXT DEFAULT '',
                status TEXT DEFAULT 'pending',
                created_at TEXT
            )
        """)
        # 官方角色同人图廊（公开）：图 / 点赞 / 评论
        conn.execute("""
            CREATE TABLE IF NOT EXISTS official_fanart (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id INTEGER NOT NULL,
                user_kind TEXT NOT NULL,
                user_uid TEXT NOT NULL,
                user_name TEXT DEFAULT '',
                image_url TEXT NOT NULL,
                caption TEXT DEFAULT '',
                created_at TEXT
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_fanart_char ON official_fanart(character_id, id)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS official_fanart_likes (
                fanart_id INTEGER NOT NULL,
                user_kind TEXT NOT NULL,
                user_uid TEXT NOT NULL,
                created_at TEXT,
                PRIMARY KEY (fanart_id, user_kind, user_uid)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS official_fanart_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fanart_id INTEGER NOT NULL,
                user_kind TEXT NOT NULL,
                user_uid TEXT NOT NULL,
                user_name TEXT DEFAULT '',
                content TEXT NOT NULL,
                created_at TEXT
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_fanart_cmt ON official_fanart_comments(fanart_id, id)")
        # 同人图的 点赞 / 踩（喜欢沿用 official_fanart_likes）：主册角色页与副册共用同一份反应数据
        conn.execute("""
            CREATE TABLE IF NOT EXISTS official_fanart_votes (
                fanart_id INTEGER NOT NULL,
                user_kind TEXT NOT NULL,
                user_uid TEXT NOT NULL,
                vote INTEGER NOT NULL CHECK (vote IN (1, -1)),
                created_at TEXT,
                PRIMARY KEY (fanart_id, user_kind, user_uid)
            )
        """)
        # 副册（官方角色同人画廊）自己的评论线程；主册角色页评论仍是 official_fanart_comments，两边不共用
        conn.execute("""
            CREATE TABLE IF NOT EXISTS official_fanart_sub_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fanart_id INTEGER NOT NULL,
                user_kind TEXT NOT NULL,
                user_uid TEXT NOT NULL,
                user_name TEXT DEFAULT '',
                content TEXT NOT NULL,
                created_at TEXT
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_fanart_sub_cmt ON official_fanart_sub_comments(fanart_id, id)")
        game_saves.init_schema(conn)
        account_progress.init_schema(conn)
        game_saves.import_legacy(conn, GAME_SAVE_FILE)
        conn.commit()
        conn.close()


# ---------- 密码哈希（scrypt，自动降级 pbkdf2） ----------

def hash_password(password):
    salt = secrets.token_hex(16)
    try:
        h = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt),
                           n=16384, r=8, p=1, dklen=32)
        return f"scrypt${salt}${h.hex()}"
    except Exception:
        h = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"),
                                bytes.fromhex(salt), 200000, dklen=32)
        return f"pbkdf2${salt}${h.hex()}"


def verify_password(password, stored):
    try:
        method, salt, digest = stored.split("$", 2)
        salt_b = bytes.fromhex(salt)
        if method == "scrypt":
            h = hashlib.scrypt(password.encode("utf-8"), salt=salt_b,
                               n=16384, r=8, p=1, dklen=32)
        else:
            h = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_b,
                                    200000, dklen=32)
        return hmac.compare_digest(h.hex(), digest)
    except Exception:
        return False


# ---------- 用户 / 会话 ----------

def upsert_user(user_id, nickname, email, picture):
    with DB_LOCK:
        conn = db()
        conn.execute("""
            INSERT INTO users (user_id, nickname, email, picture, first_login, last_login)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                nickname=excluded.nickname,
                email=excluded.email,
                picture=excluded.picture,
                last_login=excluded.last_login
        """, (user_id, nickname, email, picture, now_iso(), now_iso()))
        conn.commit()
        conn.close()


def get_local_user_by_name(username):
    conn = db()
    row = conn.execute("SELECT * FROM local_users WHERE username=?", (username,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_local_user(uid):
    conn = db()
    row = conn.execute("SELECT * FROM local_users WHERE uid=?", (uid,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_flag(kind, uid):
    conn = db()
    row = conn.execute("SELECT * FROM user_flags WHERE kind=? AND uid=?", (kind, uid)).fetchone()
    conn.close()
    return dict(row) if row else None


def resolve_identity(kind, uid):
    """把会话里的 (kind, uid) 解析成完整身份。被封禁返回 None。"""
    if kind == "local":
        u = get_local_user(int(uid))
        if not u:
            return None
        if u.get("status") != "active":
            return None
        role = u.get("role") or "executor"
        if role == "user":
            role = "executor"
        return {
            "kind": "local", "uid": str(u["uid"]),
            "username": u["username"],
            "nickname": u.get("nickname") or u["username"],
            "email": u.get("email", ""), "picture": u.get("picture", ""),
            "role": role,
            "is_admin": role == "admin",
        }
    else:
        conn = db()
        row = conn.execute("SELECT * FROM users WHERE user_id=?", (uid,)).fetchone()
        conn.close()
        u = dict(row) if row else {"user_id": uid, "nickname": "USSO用户", "email": "", "picture": ""}
        flag = get_flag("usso", uid) or {}
        if flag.get("status") == "banned":
            return None
        is_admin = uid in ADMIN_USSO_IDS or flag.get("role") == "admin"
        role = "admin" if is_admin else (flag.get("role") or "executor")
        if role == "user":
            role = "executor"
        return {
            "kind": "usso", "uid": str(uid),
            "username": u.get("nickname", ""),
            "nickname": u.get("nickname", "USSO用户"),
            "email": u.get("email", ""), "picture": u.get("picture", ""),
            "role": role,
            "is_admin": is_admin,
        }


def create_session(kind, uid, root_domain=None):
    sid = secrets.token_urlsafe(32)
    exp = (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat()
    with DB_LOCK:
        conn = db()
        conn.execute("INSERT INTO sessions_db (sid, kind, uid, created_at, expires_at, audience) VALUES (?,?,?,?,?,?)",
                     (sid, kind, str(uid), now_iso(), exp, root_domain or SITE_DOMAIN))
        conn.commit()
        conn.close()
    return sid


def read_session(sid, root_domain=None):
    if not sid:
        return None
    conn = db()
    row = conn.execute("SELECT * FROM sessions_db WHERE sid=?", (sid,)).fetchone()
    conn.close()
    if not row or (root_domain is not None and row["audience"] != root_domain):
        return None
    try:
        exp = datetime.fromisoformat(row["expires_at"])
        if exp < datetime.now(timezone.utc):
            destroy_session(sid)
            return None
    except Exception:
        pass
    return {"kind": row["kind"], "uid": row["uid"]}


def destroy_session(sid):
    if not sid:
        return
    with DB_LOCK:
        conn = db()
        conn.execute("DELETE FROM sessions_db WHERE sid=?", (sid,))
        conn.commit()
        conn.close()


def destroy_user_sessions(kind, uid):
    with DB_LOCK:
        conn = db()
        conn.execute("DELETE FROM sessions_db WHERE kind=? AND uid=?", (kind, str(uid)))
        conn.commit()
        conn.close()


# ---------- 限流 ----------

_RATE_CLEANUP_INTERVAL = 300  # 每 5 分钟清理一次过期条目
_rate_last_cleanup = 0.0

def _rate_cleanup(now):
    """清理过期的限流记录，防止内存无限增长。"""
    global _rate_last_cleanup
    if now - _rate_last_cleanup < _RATE_CLEANUP_INTERVAL:
        return
    _rate_last_cleanup = now
    expired = [k for k, v in RATE.items() if not v or now - v[-1] > 3600]
    for k in expired:
        RATE.pop(k, None)

def _rate_hits(key, window):
    now = time.time()
    with RATE_LOCK:
        _rate_cleanup(now)
        hits = [t for t in RATE.get(key, []) if now - t < window]
        if hits:
            RATE[key] = hits
        else:
            RATE.pop(key, None)
        return hits


def rate_blocked(key, max_n, window):
    return len(_rate_hits(key, window)) >= max_n


def rate_add(key):
    now = time.time()
    with RATE_LOCK:
        RATE.setdefault(key, []).append(now)


# Failed password checks are counted three ways: one account from one IP, one IP across every
# account (credential stuffing sweeps many usernames from one address), and one account across
# every IP (distributed guessing against a single account).
LOGIN_FAILURE_LIMITS = (("login:{user}|{ip}", 8, 600), ("login-ip:{ip}", 30, 600), ("login-user:{user}", 20, 3600))


def login_throttled(username, ip):
    user = username.lower()
    return any(rate_blocked(key.format(user=user, ip=ip), max_n, window) for key, max_n, window in LOGIN_FAILURE_LIMITS)


def login_failed(username, ip):
    user = username.lower()
    for key, _, _ in LOGIN_FAILURE_LIMITS:
        rate_add(key.format(user=user, ip=ip))


# ---------- USSO ----------

def sso_post(url, data):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode("utf-8"))
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"code": 500, "error": str(e)}


def sso_get_userinfo(access_token):
    req = urllib.request.Request(SSO_USERINFO)
    req.add_header("Authorization", f"Bearer {access_token}")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"code": 500, "error": str(e)}


# ---------- 数据 ----------

def to_str(v):
    if v is None:
        return ""
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return "、".join(str(x) for x in v if x)
    return str(v).strip()


# 同人画廊卡片字段 ← 已登记人设（公开与后续编辑同步共用一套映射）
FAN_SYNC_COLUMNS = ("name", "type", "species", "gender", "faction", "ability", "appearance", "story", "image_data")


def fan_fields(cd):
    return {
        "name": (cd.get("name") or "").strip(),
        # 登记表单的字段名在后（species_type / species_detail / abilities / background）
        "type": to_str(cd.get("type") or cd.get("species_type")),
        "species": to_str(cd.get("species") or cd.get("species_detail")),
        "gender": to_str(cd.get("gender")),
        "faction": to_str(cd.get("faction_label") or cd.get("faction")),
        "ability": to_str(cd.get("ability") or cd.get("abilities")),
        "appearance": to_str(cd.get("appearance")),
        "story": to_str(cd.get("story") or cd.get("background")),
        "image_data": to_str(cd.get("image") or (cd.get("images") or [None])[0]),
    }


def sync_fan_characters(conn, ident, code, cd, previous_code=None):
    """所有者保存人设后，原位刷新其画廊记录（不改公开状态、不新建副本）；只匹配本人 (kind, uid)。"""
    if not code or not isinstance(cd, dict):
        return 0
    fields = fan_fields(cd)
    if not fields["name"]:
        return 0
    codes = [code] + ([previous_code] if previous_code and previous_code != code else [])
    qm = ",".join("?" * len(codes))
    sets = ", ".join(f"{col}=?" for col in FAN_SYNC_COLUMNS)
    cur = conn.execute(
        f"UPDATE fan_characters SET {sets}, code=?, updated_at=? "
        f"WHERE user_kind=? AND user_uid=? AND COALESCE(type,'')!='配色海报' AND code IN ({qm})",
        [fields[col] for col in FAN_SYNC_COLUMNS] + [code, now_iso(), ident["kind"], ident["uid"]] + codes)
    return cur.rowcount

def character_store():
    return oc_store.Store(Path(DATA_FILE).parent, lambda: oc_store.open_database(USER_DB),
                          os.environ.get("IRIDESCENTLY_OC_BACKEND", "json"))


def load_data():
    """Compatibility read projection for admin/showcase/export consumers; never a write API."""
    return character_store().snapshot()


def oc_api(function):
    @wraps(function)
    def guarded(self, *args, **kwargs):
        try:
            return function(self, *args, **kwargs)
        except oc_store.OCError as error:
            self._json(error.status, {"error": error.code})
        except sqlite3.Error:
            self._json(503, {"error": "oc_database_unavailable"})
    return guarded


# ---------- 外置存储（展示页 HTML / 上传图），给 characters.json 瘦身 ----------
STORE_DIR = str(managed_asset_dir("huiguan", "store", root=DATA_ROOT))
UPLOAD_DIR = str(managed_asset_dir("huiguan", "uploads", root=DATA_ROOT))
os.makedirs(STORE_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

_DATAURI_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
IMAGE_LIMIT = 8 * 1024 * 1024
UPLOAD_METADATA_LIMIT = 256 * 1024
UPLOAD_REQUEST_LIMIT = IMAGE_LIMIT + UPLOAD_METADATA_LIMIT + 64 * 1024

GIF_LIMIT = 5 * 1024 * 1024


def validate_image(raw, mime, gif_limit=GIF_LIMIT):
    """Check the declared type, file signature and bounded size before storage."""
    mime = (mime or "").lower()
    detected = None
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        detected = "image/png"
    elif raw.startswith(b"\xff\xd8\xff"):
        detected = "image/jpeg"
    elif raw[:6] in (b"GIF87a", b"GIF89a"):
        detected = "image/gif"
    elif raw.startswith(b"RIFF") and raw[8:12] == b"WEBP":
        detected = "image/webp"
    if mime != detected or mime not in _DATAURI_EXT:
        raise ValueError("图片格式或文件内容无效，仅支持 JPG / PNG / WebP / GIF")
    limit = gif_limit if mime == "image/gif" else IMAGE_LIMIT
    if not raw or len(raw) > limit:
        raise ValueError(f"动图需≤{gif_limit // (1024 * 1024)}MB" if mime == "image/gif" else "图片需≤8MB")
    from PIL import Image
    try:
        with Image.open(BytesIO(raw)) as image:
            if image.width * image.height > 40_000_000:
                raise ValueError("图片分辨率过大（≤4000万像素）")
            image.verify()
    except (OSError, Image.DecompressionBombError) as error:
        raise ValueError("图片文件损坏或分辨率过大") from error
    return raw, mime

def store_image(raw, mime):
    name = hashlib.sha256(raw).hexdigest() + _DATAURI_EXT[mime]
    path = os.path.join(UPLOAD_DIR, name)
    if not os.path.exists(path):
        with open(path, "wb") as f:
            f.write(raw)
    return "/assets/uploads/" + name

def store_avatar_image(raw, mime):
    """Normalize a confirmed avatar crop to a metadata-free square image."""
    return normalize_avatar_image(raw, mime, DATA_ROOT)

def store_avatar_data_uri(uri):
    if not isinstance(uri, str) or not uri.startswith("data:image/"):
        raise ValueError("头像格式无效")
    head, separator, encoded = uri.partition(",")
    mime = head[5:].split(";", 1)[0].lower()
    if not separator or not head.endswith(";base64"):
        raise ValueError("头像编码无效")
    raw = base64.b64decode(encoded, validate=True)
    validate_image(raw, mime)
    return store_avatar_image(raw, mime)

def store_source_data_uri(uri):
    if not isinstance(uri, str) or not uri.startswith("data:image/"):
        raise ValueError("图片格式无效")
    head, separator, encoded = uri.partition(",")
    mime = head[5:].split(";", 1)[0].lower()
    if not separator or not head.endswith(";base64"):
        raise ValueError("图片编码无效")
    raw, mime = validate_image(base64.b64decode(encoded, validate=True), mime)
    return store_image(raw, mime)

def normalize_oc_avatar(data):
    if not isinstance(data, dict):
        return
    asset = _persist_preview_reference(data.get("avatar_asset_id") or "")
    shape = data.get("avatar_display_shape")
    if asset.startswith("data:image/"):
        asset = store_avatar_data_uri(asset)
        data["avatar_asset_id"] = asset
    if asset and (not valid_asset_url(asset) or not os.path.isfile(os.path.join(UPLOAD_DIR, os.path.basename(asset)))):
        raise ValueError("OC 头像资源无效")
    if shape not in (None, "", "square", "circle"):
        raise ValueError("OC 头像显示形状无效")
    if shape:
        data["avatar_display_shape"] = shape

def store_showcase_html(html):
    """把展示页 HTML 写成独立文件，返回文件名（存进 JSON 的 html_ref）。"""
    name = hashlib.md5(html.encode("utf-8")).hexdigest() + ".html"
    path = os.path.join(STORE_DIR, name)
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
    return name

def store_data_uri(uri):
    """把 data: 图片解码写成独立文件，返回可访问的 URL；非 data: 原样返回。"""
    if not uri or not uri.startswith("data:"):
        return uri
    try:
        head, _, b64 = uri.partition(",")
        mime = head[5:].split(";")[0]
        ext = _DATAURI_EXT.get(mime, ".img")
        raw = base64.b64decode(b64)
        name = hashlib.md5(raw).hexdigest() + ext
        path = os.path.join(UPLOAD_DIR, name)
        if not os.path.exists(path):
            with open(path, "wb") as f:
                f.write(raw)
        return "/assets/uploads/" + name
    except Exception:
        return uri

def get_record_html(rec):
    """读取记录对应的展示页 HTML：优先内联 html（旧），否则读 html_ref 文件。"""
    if rec.get("html"):
        return rec["html"]
    ref = rec.get("html_ref")
    if ref:
        try:
            with open(os.path.join(STORE_DIR, ref), "r", encoding="utf-8") as f:
                return f.read()
        except OSError:
            return ""
    return ""


# Admin projection is read from the active repository, never JSON mtime.
def get_admin_characters():
    rows = character_store().admin_rows()
    for row in rows: row["url"] = "/show.html?code=" + urllib.parse.quote(row["code"])
    return rows


OAUTH_STATES = {}
OAUTH_LOCK = threading.Lock()

# 模块加载即初始化数据库表（直接运行或被 import 都生效）
init_user_db()


class _NoImage(Exception):
    def __init__(self, status):
        super().__init__(status)
        self.status = status


def _first(qs, key):
    return qs.get(key, [None])[0]


def _lookup_image(endpoint, qs):
    """Resolve one public image endpoint + query to its stored file (or remote URL).

    The single place that maps those requests to source files, shared by the public
    (derived-only) handlers and the owner-only /api/original-image. Raises _NoImage(status).
    """
    path = None
    if endpoint == "/api/image-preview":
        path = _resolve_image_token(_first(qs, "id"))
        if path is None:
            raise _NoImage(404)
        return path
    if endpoint == "/api/uploads/preview":
        name = _first(qs, "name") or ""
        if not UPLOAD_NAME_RE.fullmatch(name) or "/" in name or "\\" in name:
            raise _NoImage(404)
        path = os.path.join(UPLOAD_DIR, name)
        if not os.path.isfile(path):
            raise _NoImage(404)
        return path
    if endpoint == "/api/official/img":
        cid = _first(qs, "cid")
        if not cid:
            raise _NoImage(400)
        try:
            n = int(_first(qs, "n") or 0)
        except ValueError:
            raise _NoImage(400)
        conn = wv()
        rows = conn.execute("SELECT image_path FROM character_images WHERE character_id=? ORDER BY COALESCE(sort_order,id), id", (cid,)).fetchall()
        conn.close()
        paths = []
        for r in rows:
            p = _safe_image_path(r["image_path"])
            if p and (_is_remote_image(p) or os.path.isfile(p)):
                paths.append(p)
        if not paths:
            raise _NoImage(404)
        return paths[max(0, min(n, len(paths) - 1))]
    if endpoint in ("/api/official/img-id", "/api/assets/image", "/api/official/unclassified-img"):
        iid = _first(qs, "id")
        if not iid:
            raise _NoImage(400)
        table = "unclassified_images" if endpoint == "/api/official/unclassified-img" else "character_images"
        w = _worldview_connection()
        row = w.execute(f"SELECT image_path FROM {table} WHERE id=?", (iid,)).fetchone()
        w.close()
        if not row:
            raise _NoImage(404)
        path = _safe_image_path(row[0])
    elif endpoint == "/api/assets/shared":
        iid = _first(qs, "id")
        if not iid:
            raise _NoImage(400)
        conn = wv()
        try:
            row = conn.execute("SELECT path FROM shared_assets WHERE id=?", (iid,)).fetchone()
        finally:
            conn.close()
        if not row:
            raise _NoImage(404)
        path = _safe_image_path(row["path"])
    elif endpoint == "/api/assets/avatar":
        cid, name = _first(qs, "cid"), _first(qs, "name")
        conn = wv()
        try:
            if not cid and name:
                name = name.strip()
                row = conn.execute("SELECT id FROM characters WHERE name=? AND merged_to IS NULL", (name,)).fetchone()
                if not row:
                    row = conn.execute("SELECT id FROM characters WHERE (','||COALESCE(aliases,'')||',') LIKE ? AND merged_to IS NULL",
                                       ("%" + name + "%",)).fetchone()
                if not row:
                    raise _NoImage(404)
                cid = str(row["id"])
            if not cid:
                raise _NoImage(400)
            crow = conn.execute("SELECT avatar_id FROM characters WHERE id=?", (cid,)).fetchone()
            if crow and crow["avatar_id"]:
                ir = conn.execute("SELECT image_path FROM character_images WHERE id=?", (crow["avatar_id"],)).fetchone()
                if ir:
                    p = _safe_image_path(ir["image_path"])
                    if p and (_is_remote_image(p) or os.path.isfile(p)):
                        return p
            for r in conn.execute("SELECT image_path FROM character_images WHERE character_id=? ORDER BY COALESCE(sort_order,id), id", (cid,)):
                p = _safe_image_path(r["image_path"])
                if p and (_is_remote_image(p) or os.path.isfile(p)):
                    return p
        finally:
            conn.close()
        raise _NoImage(404)
    else:
        raise _NoImage(404)
    if not path or (not _is_remote_image(path) and not os.path.isfile(path)):
        raise _NoImage(404)
    return path


IMAGE_ENDPOINTS = frozenset({
    "/api/official/img", "/api/official/img-id", "/api/official/unclassified-img",
    "/api/assets/avatar", "/api/assets/image", "/api/assets/shared", "/api/uploads/preview", "/api/image-preview",
})
IMAGE_CONTENT_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}


def _register_image_source(source):
    token = secrets.token_urlsafe(24)
    now = time.time()
    with IMAGE_SOURCE_LOCK:
        expired = [key for key, (created, _) in IMAGE_SOURCES.items() if now - created > IMAGE_SOURCE_MAX_AGE]
        for key in expired:
            IMAGE_SOURCES.pop(key, None)
        while len(IMAGE_SOURCES) >= IMAGE_SOURCE_LIMIT:
            IMAGE_SOURCES.pop(next(iter(IMAGE_SOURCES)))
        IMAGE_SOURCES[token] = (now, source)
    return "/api/image-preview?id=" + urllib.parse.quote(token)


def _resolve_image_token(token):
    if not token or not re.fullmatch(r"[A-Za-z0-9_-]{24,64}", token):
        return None
    with IMAGE_SOURCE_LOCK:
        entry = IMAGE_SOURCES.get(token)
        if not entry:
            return None
        if time.time() - entry[0] > IMAGE_SOURCE_MAX_AGE:
            IMAGE_SOURCES.pop(token, None)
            return None
        return entry[1]


def _safe_image_reference(value):
    """Replace a source path/URL/data URI in JSON with an opaque, WebP-only same-origin URL."""
    if not isinstance(value, str):
        return value
    if value.startswith("/api/image-preview?"):
        return value
    source = None
    if value.startswith("data:image/"):
        try:
            head, separator, encoded = value.partition(",")
            mime = head[5:].split(";", 1)[0].lower()
            if not separator or not head.endswith(";base64") or mime not in _DATAURI_EXT:
                return ""
            source = base64.b64decode(encoded, validate=True)
            if not source or len(source) > IMAGE_FETCH_LIMIT:
                return ""
        except (ValueError, TypeError):
            return ""
    elif value.startswith("/assets/uploads/"):
        name = urllib.parse.unquote(value[len("/assets/uploads/"):].split("?", 1)[0])
        if not UPLOAD_NAME_RE.fullmatch(name) or "/" in name or "\\" in name:
            return ""
        if not os.path.isfile(os.path.join(UPLOAD_DIR, name)):
            return ""
        return "/api/uploads/preview?name=" + urllib.parse.quote(name)
    elif _is_remote_image(value):
        parsed = urllib.parse.urlsplit(value)
        if parsed.scheme != "https" or (parsed.hostname or "").lower() not in REMOTE_IMAGE_HOSTS:
            return ""
        source = value
    elif os.path.isabs(value) and os.path.splitext(value)[1].lower() in ASSET_IMAGE_EXTS:
        source = _safe_image_path(value)
        if not source or not os.path.isfile(source):
            return ""
    if source is None:
        return value
    return _register_image_source(source)


def _sanitize_image_urls_in_text(value):
    if not isinstance(value, str):
        return value
    decoded = value
    for _ in range(4):
        next_value = urllib.parse.unquote(decoded)
        if next_value == decoded:
            break
        decoded = next_value
    if "/assets/uploads/" in decoded.lower():
        value = decoded
    data_uri = re.compile(r"data:image/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+", re.I)
    upload_path = re.compile(r"/assets/uploads/([A-Za-z0-9]{16,64}\.(?:png|jpe?g|webp|gif))", re.I)
    remote_url = re.compile(r"https?://[^\s\"'<>),]+", re.I)
    windows_path = re.compile(r"(?<![A-Za-z0-9])([A-Za-z]:\\[^\"'<>\r\n]+?\.(?:png|jpe?g|webp|gif))", re.I)
    value = data_uri.sub(lambda match: _safe_image_reference(match.group(0)), value)
    value = upload_path.sub(lambda match: _safe_image_reference("/assets/uploads/" + match.group(1)), value)
    value = windows_path.sub(lambda match: _safe_image_reference(match.group(1)), value)
    def replace_remote(match):
        candidate = match.group(0).rstrip(".;:!")
        suffix = match.group(0)[len(candidate):]
        parsed = urllib.parse.urlsplit(candidate)
        if os.path.splitext(parsed.path)[1].lower() in ASSET_IMAGE_EXTS:
            return _safe_image_reference(candidate) + suffix
        return match.group(0)
    return remote_url.sub(replace_remote, value)


def _sanitize_json_image_sources(value):
    if isinstance(value, dict):
        return {key: _sanitize_json_image_sources(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_sanitize_json_image_sources(item) for item in value]
    if isinstance(value, str):
        if os.path.isabs(value) and os.path.splitext(value)[1].lower() in ASSET_IMAGE_EXTS:
            return _safe_image_reference(value)
        return _sanitize_image_urls_in_text(value)
    return value


def _persist_preview_reference(value):
    """Resolve an opaque preview URL submitted by an editor back to a durable source path."""
    if not isinstance(value, str):
        return value
    if value.startswith("/api/uploads/preview?"):
        name = _first(urllib.parse.parse_qs(urllib.parse.urlsplit(value).query), "name") or ""
        if UPLOAD_NAME_RE.fullmatch(name) and os.path.isfile(os.path.join(UPLOAD_DIR, name)):
            return "/assets/uploads/" + name
        raise ValueError("图片预览已过期，请重新选择图片")
    if not value.startswith("/api/image-preview?"):
        return value
    parsed = urllib.parse.urlsplit(value)
    source = _resolve_image_token(_first(urllib.parse.parse_qs(parsed.query), "id"))
    if source is None:
        raise ValueError("图片预览已过期，请重新选择图片")
    if isinstance(source, str) and not _is_remote_image(source):
        try:
            if os.path.commonpath((os.path.abspath(source), os.path.abspath(UPLOAD_DIR))) == os.path.abspath(UPLOAD_DIR):
                return "/assets/uploads/" + os.path.basename(source)
        except ValueError:
            pass
        with open(source, "rb") as stream:
            raw = stream.read(IMAGE_FETCH_LIMIT + 1)
    elif _is_remote_image(source):
        raw = _remote_image_bytes(source) or b""
    else:
        raw = source
    if not raw or len(raw) > IMAGE_FETCH_LIMIT:
        raise ValueError("图片来源暂不可用")
    try:
        from PIL import Image
        with Image.open(BytesIO(raw)) as im:
            mime = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp", "GIF": "image/gif"}.get(im.format)
        if not mime:
            raise ValueError("图片格式无效")
        raw, mime = validate_image(raw, mime)
    except (OSError, ValueError) as error:
        raise ValueError("图片格式无效") from error
    return store_image(raw, mime)


def _remote_image_bytes(url):
    """Fetch only known public image hosts; reject private IPs, redirects to other hosts and oversized bodies."""
    current = url
    for _ in range(4):
        parts = urllib.parse.urlsplit(current)
        host = (parts.hostname or "").lower()
        if parts.scheme != "https" or host not in REMOTE_IMAGE_HOSTS or parts.username or parts.password:
            return None
        try:
            addresses = {ipaddress.ip_address(item[4][0]) for item in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)}
            if not addresses or any(not address.is_global for address in addresses):
                return None
            request = urllib.request.Request(current, headers={"Accept": "image/*", "User-Agent": "Iridescently-Preview/1.0"})
            opener = urllib.request.build_opener(_NoImageRedirect())
            with opener.open(request, timeout=8) as response:
                content_type = (response.headers.get("Content-Type") or "").split(";", 1)[0].lower()
                length = int(response.headers.get("Content-Length") or 0)
                if not content_type.startswith("image/") or length > IMAGE_FETCH_LIMIT:
                    return None
                payload = response.read(IMAGE_FETCH_LIMIT + 1)
                return payload if 0 < len(payload) <= IMAGE_FETCH_LIMIT else None
        except urllib.error.HTTPError as error:
            if error.code not in (301, 302, 303, 307, 308):
                return None
            location = error.headers.get("Location")
            if not location:
                return None
            current = urllib.parse.urljoin(current, location)
        except (OSError, ValueError, urllib.error.URLError):
            return None
    return None


class _NoImageRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _encode_webp_preview(target, source, thumb):
    try:
        from PIL import Image, ImageOps, ImageSequence
        tmp = target + ".tmp"
        with Image.open(source) as im:
            animated = getattr(im, "n_frames", 1) > 1
            edge = 360 if thumb else (PREVIEW_ANIMATED_EDGE if animated else PREVIEW_MAX_EDGE)
            if animated:
                frames, durations = [], []
                for frame in ImageSequence.Iterator(im):
                    f = frame.convert("RGBA")
                    f.thumbnail((edge, edge), Image.LANCZOS)
                    frames.append(f)
                    durations.append(frame.info.get("duration", 100))
                frames[0].save(tmp, "WEBP", save_all=True, append_images=frames[1:], duration=durations,
                               loop=im.info.get("loop", 0), quality=72 if thumb else 76, method=4)
            else:
                im = ImageOps.exif_transpose(im)
                has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
                im = im.convert("RGBA" if has_alpha else "RGB")
                im.thumbnail((edge, edge), Image.LANCZOS)
                im.save(tmp, "WEBP", quality=76 if thumb else 82, method=4)
        os.replace(tmp, target)
    except Exception:
        return None, None
    with open(target, "rb") as f:
        return f.read(), "image/webp"


def _preview_bytes(source, thumb=False):
    """Return a cached, metadata-free WebP preview for local, remote, or in-memory image sources."""
    profile = "thumb-360-v2" if thumb else "v1"
    if isinstance(source, bytes):
        seed = "bytes|" + hashlib.sha256(source).hexdigest() + "|" + profile
        image_source = BytesIO(source)
    elif _is_remote_image(source):
        seed = "remote|" + source + "|" + profile
        key = hashlib.md5(seed.encode("utf-8")).hexdigest()
        target = os.path.join(PREVIEW_DIR, key + ".webp")
        if os.path.isfile(target):
            with open(target, "rb") as f:
                return f.read(), "image/webp"
        payload = _remote_image_bytes(source)
        if not payload:
            return None, None
        image_source = BytesIO(payload)
    else:
        try:
            stat = os.stat(source)
        except (OSError, TypeError):
            return None, None
        # Keep the v1 key for full previews so existing valid cache files remain reusable.
        seed = f"{source}|{stat.st_size}|{int(stat.st_mtime)}|{profile}"
        if not thumb:
            seed = f"{source}|{stat.st_size}|{int(stat.st_mtime)}|v1"
        image_source = source
    key = hashlib.md5(seed.encode("utf-8")).hexdigest()
    target = os.path.join(PREVIEW_DIR, key + ".webp")
    if not os.path.exists(target):
        with _PREVIEW_LOCK:
            if not os.path.exists(target):
                result = _encode_webp_preview(target, image_source, thumb)
                if result[0] is None:
                    return None, None
                return result
    with open(target, "rb") as f:
        return f.read(), "image/webp"


class Handler(BaseStaticHandler):
    protocol_version = "HTTP/1.1"
    _static_dir = STATIC_DIR

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def translate_path(self, path):
        decoded = urllib.parse.urlparse(path).path
        for _ in range(16):
            unquoted = urllib.parse.unquote(decoded)
            if unquoted == decoded:
                break
            decoded = unquoted
        else:
            return os.path.join(STATIC_DIR, "__missing__")
        decoded = decoded.replace("\\", "/")
        normalized = "/" + posixpath.normpath(decoded).lstrip("/")
        for prefix, root in (("/design-system/ui/", os.path.join(CODE_ROOT, "packages", "shared-ui")),):
            if normalized.startswith(prefix):
                relative = normalized[len(prefix):]
                target = os.path.abspath(os.path.join(root, relative))
                if os.path.commonpath((os.path.abspath(root), target)) == os.path.abspath(root):
                    return target
                return os.path.join(STATIC_DIR, "__missing__")
        if normalized.lower().startswith("/assets/uploads/"):
            # Upload sources are never static; public images must use WebP preview routes.
            return os.path.join(STATIC_DIR, "__missing__")
        if normalized.lower().startswith("/assets/store/"):
            # Showcase HTML is served only through sanitized JSON, never as a raw static file.
            return os.path.join(STATIC_DIR, "__missing__")
        return super().translate_path(path)

    # send_header / end_headers 由 BaseStaticHandler 统一处理安全头+缓存

    def _is_api_path(self):
        p = self.path.split("?")[0]
        return p.startswith("/api/") or p in ("/", "/cb")

    # ---------- 路由 ----------
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if path == "/api/original-image":
            return self._api_original_image(qs)
        if path == "/api/image-preview":
            return self._api_image_preview(qs)
        if path == "/api/uploads/preview":
            return self._api_upload_preview(qs)

        if path.startswith("/api/huiguan/"):
            path = "/api/" + path[len("/api/huiguan/"):]

        if path == "/api/login":
            return self._api_sso_login()
        if path in ("/", "/cb", "/api/callback") and (qs.get("code") or qs.get("error") or qs.get("state")):
            return self._api_callback(qs)
        if path == "/api/user":
            return self._api_user()
        if path == "/api/oc":
            return self._api_owned_character(qs)
        if path == "/api/turnstile":
            return self._json(200, {"siteKey": turnstile.site_key() or None})
        if path == "/api/user/ocs":
            return self._api_user_ocs()
        if path == "/api/account/email":
            return handle_email(self, "status", globals())
        if path == "/api/sso-user":
            return self._api_sso_user()
        if path == "/api/logout":
            return self._api_logout()
        if path == "/api/get-characters":
            return self._api_get_characters()
        if path == "/api/get-character":
            return self._api_get_character(qs)
        if path == "/api/sso/role-theme":
            return self._api_sso_role_theme(qs)
        if path == "/api/admin/users":
            return self._api_admin_users()
        if path == "/api/admin/characters":
            return self._api_admin_characters()
        if path == "/api/my-broken-characters":
            return self._api_my_broken_characters()
        if path == "/api/admin/elder-requests":
            return self._api_admin_elder_requests()
        if path == "/api/official/characters":
            return self._api_official_characters(qs)
        if path == "/api/official/character":
            return self._api_official_character(qs)
        if path == "/api/official/img":
            return self._api_official_img(qs)
        if path == "/api/official/unclassified":
            return self._api_official_unclassified()
        if path == "/api/official/unclassified-img":
            return self._api_official_unclassified_img(qs)
        if path == "/api/official/img-id":
            return self._api_official_img_id(qs)
        if path == "/api/official/graph":
            return self._api_official_graph()
        if path == "/api/official/reactions":
            return self._api_official_reactions()
        if path == "/api/official/stickers":
            return self._api_official_stickers()
        if path == "/api/official/fanart":
            return self._api_fanart_list(qs)
        if path == "/api/official/fanart/comments":
            return self._api_fanart_comments(qs)
        if path == "/api/archives":
            return self._json(200, {"archives": ARCHIVES})
        if path == "/api/official/fanart/summary":
            return self._api_fanart_summary(qs)
        if path == "/api/admin/honor-requests":
            return self._api_admin_honor_requests()
        # ---- 素材库公开接口（供 game 等子域小游戏复用，免登录只读） ----
        if path == "/api/assets/manifest":
            return self._api_assets_manifest()
        if path == "/api/assets/avatar":
            return self._api_assets_avatar(qs)
        if path == "/api/assets/image":
            return self._api_assets_image(qs)
        if path == "/api/assets/shared":
            return self._api_assets_shared(qs)
        if path == "/api/admin/supplements":
            return self._api_admin_supplements()
        if path == "/api/admin/scribe-requests":
            return self._api_admin_scribe_requests()
        if path == "/api/admin/exempt-requests":
            return self._api_admin_exempt_requests()
        if path == "/api/member/users":
            return self._api_member_users()
        if path == "/api/fan/list":
            return self._api_fan_list(qs)
        if path == "/api/fan/my":
            return self._api_fan_my()
        if path == "/api/fan/check-suggest":
            return self._api_fan_check_suggest()
        if path == "/api/fan/reactions":
            return self._api_fan_reactions()
        if path == "/api/color-schemes":
            return self._api_color_schemes()
        if path == "/api/color-schemes/mine":
            return self._api_color_schemes_mine()
        if path == "/api/game/load":
            return self._api_game_load()
        if path == "/api/posters/my":
            return self._api_posters_my()
        if path == "/api/poster/get":
            return self._api_poster_get(qs)
        if path == "/api/admin/posters":
            return self._api_admin_posters()

        if not self._static_allowed(path):
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith("/api/huiguan/"):
            path = "/api/" + path[len("/api/huiguan/"):]

        if path.startswith("/api/security/"):
            return handle_security(self, path.rsplit("/", 1)[-1], globals())
        if path.startswith("/api/account/email/"):
            return handle_email(self, path.rsplit("/", 1)[-1], globals())
        if path == "/api/account/avatar":
            return self._api_account_avatar()
        if path == "/api/avatars/upload":
            return self._api_avatar_asset_upload()
        if path.startswith("/api/account/recovery/"):
            return handle_recovery(self, path.rsplit("/", 1)[-1], globals())

        if path == "/api/login":
            return self._api_local_login()
        if path == "/api/auth":
            return self._api_auth()
        if path == "/api/register":
            return self._api_register()
        if path == "/api/delete-character":
            return self._api_delete_character()
        if path == "/api/save-character":
            return self._api_save_character()
        if path == "/api/save-all-characters":
            return self._api_save_all()
        if path == "/api/admin/user/update":
            return self._api_admin_update()
        if path == "/api/admin/user/delete":
            return self._api_admin_delete()
        if path == "/api/elder/apply":
            return self._api_elder_apply()
        if path == "/api/rename":
            return self._api_rename()
        if path == "/api/user/theme":
            return self._api_user_theme()
        if path == "/api/admin/elder/decide":
            return self._api_admin_elder_decide()
        if path == "/api/official/supplement":
            return self._api_submit_supplement()
        if path == "/api/official/edit":
            return self._api_scribe_edit()
        if path == "/api/official/merge":
            return self._api_official_merge()
        if path == "/api/official/avatar/set":
            return self._api_official_avatar_set()
        if path == "/api/official/scribe-apply":
            return self._api_scribe_apply()
        if path == "/api/group/confirm":
            return self._api_group_confirm()
        if path == "/api/admin/supplements":
            return self._api_admin_supplements()
        if path == "/api/admin/supplement/decide":
            return self._api_admin_supplement_decide()
        if path == "/api/admin/scribe-requests":
            return self._api_admin_scribe_requests()
        if path == "/api/admin/scribe/decide":
            return self._api_admin_scribe_decide()
        if path == "/api/exempt/apply":
            return self._api_exempt_apply()
        if path == "/api/admin/exempt/decide":
            return self._api_admin_exempt_decide()
        if path == "/api/admin/delete-character":
            return self._api_admin_delete_character()
        if path == "/api/member/user/update":
            return self._api_member_user_update()
        if path == "/api/official/sticker/upload":
            return self._api_official_sticker_upload()
        if path == "/api/official/image/add":
            return self._api_official_image_add()
        if path == "/api/official/image/delete":
            return self._api_official_image_delete()
        if path == "/api/official/image/reorder":
            return self._api_official_image_reorder()
        if path == "/api/official/image/type":
            return self._api_official_image_type()
        if path == "/api/official/react":
            return self._api_official_react()
        if path == "/api/editor/code":
            return self._api_editor_code()
        if path == "/api/honor/claim":
            return self._api_honor_claim()
        if path == "/api/admin/honor/decide":
            return self._api_admin_honor_decide()
        if path == "/api/official/fanart/upload":
            return self._api_fanart_upload()
        if path == "/api/official/fanart/delete":
            return self._api_fanart_delete()
        if path == "/api/official/fanart/like":
            return self._api_fanart_like()
        if path == "/api/official/fanart/react":
            return self._api_fanart_react()
        if path == "/api/official/fanart/comment":
            return self._api_fanart_comment()
        if path == "/api/official/fanart/comment/delete":
            return self._api_fanart_comment_delete()
        if path == "/api/fan/submit":
            return self._api_fan_submit()
        if path == "/api/fan/toggle":
            return self._api_fan_toggle()
        if path == "/api/fan/publish":
            return self._api_fan_publish()
        if path == "/api/fan/react":
            return self._api_fan_react()
        if path == "/api/color-schemes/delete":
            return self._api_color_schemes_delete()
        if path == "/api/game/save":
            return self._api_game_save()
        if path == "/api/color-schemes":
            return self._api_color_schemes_save()
        if path == "/api/images/upload":
            return self._api_images_upload()
        if path == "/api/posters/save":
            return self._api_posters_save()
        if path == "/api/posters/delete":
            return self._api_posters_delete()
        if path == "/api/posters/publish":
            return self._api_posters_publish()
        if path == "/api/admin/poster/delete":
            return self._api_admin_poster_delete()
        self.send_response(404)
        self.send_header("Content-Length", "0")
        self.end_headers()

    # ---------- 自命名配色（色环选色保存） ----------
    def _api_color_schemes(self):
        try:
            conn = db()
            rows = conn.execute(
                "SELECT id, name, primary_name, accent_name, primary_color, accent_color, user_kind, user_uid, created_at FROM color_schemes ORDER BY id ASC"
            ).fetchall()
            conn.close()
        except Exception:
            self._json(500, {"error": "读取配色失败"}); return
        ident = self._require_ident_optional()
        is_admin = bool(ident and ident.get("is_admin"))
        schemes = [{
            "id": r["id"],
            "name": (r["primary_name"] and r["accent_name"] and f"{r['primary_name']}×{r['accent_name']}") or r["name"],
            "primary_name": r["primary_name"] or "",
            "accent_name": r["accent_name"] or "",
            "primary": r["primary_color"], "accent": r["accent_color"],
            "mine": bool(ident and r["user_kind"] == ident["kind"] and str(r["user_uid"]) == str(ident["uid"])),
            "can_delete": bool(ident and (r["user_kind"] == ident["kind"] and str(r["user_uid"]) == str(ident["uid"]) or is_admin))
        } for r in rows]
        self._json(200, {"schemes": schemes})

    def _api_color_schemes_save(self):
        try:
            body = json.loads((self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}").decode("utf-8"))
        except Exception:
            self._json(400, {"error": "JSON 解析失败"}); return
        primary_name = (body.get("primary_name") or "").strip()
        accent_name = (body.get("accent_name") or "").strip()
        primary = (body.get("primary") or "").strip().lower()
        accent = (body.get("accent") or "").strip().lower()
        if not primary_name or len(primary_name) > 30 or not accent_name or len(accent_name) > 30:
            self._json(400, {"error": "主色名与辅色名均需为 1-30 个字符"}); return
        if not re.match(r"^#[0-9a-f]{6}$", primary) or not re.match(r"^#[0-9a-f]{6}$", accent):
            self._json(400, {"error": "颜色格式需为 #RRGGBB"}); return
        ident = self._require_ident_optional()
        try:
            conn = db()
            name = f"{primary_name}×{accent_name}"
            conn.execute(
                "INSERT INTO color_schemes (name, primary_name, accent_name, primary_color, accent_color, created_at, user_kind, user_uid, user_name) VALUES (?,?,?,?,?,?,?,?,?)",
                (name, primary_name, accent_name, primary, accent, now_iso(),
                 ident["kind"] if ident else "", str(ident["uid"]) if ident else "",
                 (ident.get("nickname") or ident.get("username") or "") if ident else "")
            )
            conn.commit()
            rid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            conn.close()
        except Exception:
            self._json(500, {"error": "保存配色失败"}); return
        self._json(200, {"ok": True, "id": rid, "name": name, "primary_name": primary_name, "accent_name": accent_name, "primary": primary, "accent": accent})

    def _api_color_schemes_delete(self):
        """删除用户自保存配色：仅允许删除自己的配色（管理员可删任意）"""
        ident = self._require_ident()
        if not ident:
            return
        try:
            body = json.loads((self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}").decode("utf-8"))
        except Exception:
            self._json(400, {"error": "JSON 解析失败"}); return
        sid = body.get("id")
        if sid is None:
            self._json(400, {"error": "缺少 id"}); return
        try:
            conn = db()
            row = conn.execute("SELECT id, user_kind, user_uid FROM color_schemes WHERE id=?", (int(sid),)).fetchone()
            if not row:
                conn.close()
                self._json(404, {"error": "配色不存在"}); return
            owner_kind = row["user_kind"] or ""
            owner_uid = str(row["user_uid"] or "")
            is_owner = (owner_kind == ident["kind"] and owner_uid == str(ident["uid"]))
            is_admin = bool(ident.get("is_admin"))
            if not is_owner and not is_admin:
                conn.close()
                self._json(403, {"error": "只能删除自己保存的配色"}); return
            conn.execute("DELETE FROM color_schemes WHERE id=?", (int(sid),))
            conn.commit()
            conn.close()
        except Exception:
            self._json(500, {"error": "删除配色失败"}); return
        self._json(200, {"ok": True, "id": int(sid)})

    def _api_color_schemes_mine(self):
        """当前用户保存过的配色（供 haibao/member 展示归属）"""
        ident = self._require_ident()
        if not ident:
            return
        try:
            conn = db()
            rows = conn.execute(
                "SELECT id, name, primary_name, accent_name, primary_color, accent_color, created_at FROM color_schemes WHERE user_kind=? AND user_uid=? ORDER BY id DESC",
                (ident["kind"], str(ident["uid"]))
            ).fetchall()
            conn.close()
        except Exception:
            self._json(500, {"error": "读取配色失败"}); return
        schemes = [{
            "id": r["id"], "name": r["name"],
            "primary_name": r["primary_name"] or "", "accent_name": r["accent_name"] or "",
            "primary": r["primary_color"], "accent": r["accent_color"],
            "created_at": r["created_at"]
        } for r in rows]
        self._json(200, {"schemes": schemes})

    # ---------- 灵境会馆云存档（需登录，按 uid 隔离） ----------
    def _api_game_save(self):
        ident = self._require_ident()
        if not ident:
            return
        scope = game_saves.normalize_scope(urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("scope", [None])[0])
        if scope is None:
            self._json(400, {"error": "存档范围无效"}); return
        body = self._read_json()
        if body is None:
            return
        state = body.get("state")
        if not state:
            self._json(400, {"error": "缺少存档内容"}); return
        with DB_LOCK:
            conn = db()
            try:
                saved_at = game_saves.put_save(conn, ident["kind"], ident["uid"], scope, state,
                                               ident.get("nickname") or ident.get("username") or "", now_iso())
                conn.commit()
            except ValueError:
                self._json(413, {"error": "存档过大"}); return
            finally:
                conn.close()
        self._json(200, {"ok": True, "savedAt": saved_at})

    def _api_game_load(self):
        ident = self._require_ident()
        if not ident:
            return
        scope = game_saves.normalize_scope(urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("scope", [None])[0])
        if scope is None:
            self._json(400, {"error": "存档范围无效"}); return
        conn = db()
        try:
            saved = game_saves.get_save(conn, ident["kind"], ident["uid"], scope)
        finally:
            conn.close()
        if not saved:
            self._json(404, {"error": "暂无云存档"})
            return
        self._json(200, {"ok": True, "savedAt": saved["savedAt"], "state": saved["state"]})

    # ---------- USSO 登录 ----------
    def _api_sso_login(self):
        if not USSO_LOGIN_ENABLED:
            self._json(410, {"error": "USSO 登录暂时停用，请使用会馆站内账号"})
            return
        if not CLIENT_ID or not CLIENT_SECRET:
            self._json(400, {"error": "服务器未配置 CLIENT_ID/CLIENT_SECRET"})
            return
        state = secrets.token_hex(16)
        try:
            callback = self._oauth_callback()
        except OAuthUnavailable:
            # Sessions are per registrable root; never bounce this login through another root.
            self._json(503, {"error": "当前域名尚未开通统一登录，请使用会馆站内账号登录"})
            return
        with OAUTH_LOCK:
            for k in [k for k, v in OAUTH_STATES.items() if time.time() - v["created"] > 600]:
                OAUTH_STATES.pop(k, None)
            OAUTH_STATES[state] = {"created": time.time(), "callback": callback}
        params = {
            "response_type": "code", "client_id": CLIENT_ID,
            "redirect_uri": OAUTH_STATES[state]["callback"], "scope": SCOPE, "state": state,
        }
        url = f"{SSO_AUTHORIZE}?{urllib.parse.urlencode(params)}"
        self.send_response(302)
        self.send_header("Location", url)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _api_callback(self, qs):
        if not USSO_LOGIN_ENABLED:
            self._json(410, {"error": "USSO 登录暂时停用，请使用会馆站内账号"})
            return
        code = qs.get("code", [None])[0]
        state = qs.get("state", [None])[0]
        error = qs.get("error", [None])[0]
        if not state:
            self._json(400, {"error": "缺少 code 或 state"})
            return

        with OAUTH_LOCK:
            pending = OAUTH_STATES.pop(state, None)
        try:
            callback = self._oauth_callback()
        except OAuthUnavailable:
            callback = None
        if not pending or time.time() - pending["created"] > 600 or pending["callback"] != callback:
            self._json(400, {"error": "state 校验失败"})
            return
        if error:
            self._json(400, {"error": f"用户拒绝了授权: {error}"})
            return
        if not code:
            self._json(400, {"error": "缺少 code 或 state"})
            return

        token_result = sso_post(SSO_TOKEN, {
            "grant_type": "authorization_code", "code": code,
            "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
            "redirect_uri": pending["callback"],
        })
        if token_result.get("code") != 200:
            self._json(500, token_result)
            return

        access_token = token_result.get("access_token", "")
        userinfo_result = sso_get_userinfo(access_token)
        if userinfo_result.get("code") != 200:
            self._json(500, userinfo_result)
            return

        user = userinfo_result.get("data", {})
        user_id = str(user.get("id", user.get("sub", user.get("social_uid", ""))))

        if not user_id:
            self._json(500, {"error": "USSO 未返回用户 ID"})
            return

        flag = get_flag("usso", user_id)
        if flag and flag.get("status") == "banned":
            self._json(403, {"error": "该账号已被封禁"})
            return

        nickname = user.get("nickname", user.get("name", "未知用户"))
        email = user.get("email", "")
        picture = user.get("picture", user.get("avatar", ""))
        upsert_user(user_id, nickname, email, picture)

        session_id = create_session("usso", user_id, request_root(self))
        self.send_response(302)
        self.send_header("Location", "/")
        self.send_header("Set-Cookie", self._session_cookie(session_id))
        self.send_header("Set-Cookie", self._sso_cookie(user_id, "usso", nickname))
        self.send_header("Content-Length", "0")
        self.end_headers()

    # ---------- 站内注册 / 登录 ----------
    def _api_register(self):
        body = self._read_json()
        if body is None:
            return
        ip = self._client_ip()
        if rate_blocked(f"reg:{ip}", 5, 3600):
            self._json(429, {"error": "注册过于频繁，请稍后再试"})
            return
        if not self._turnstile_passed(body, "register"):
            return
        rate_add(f"reg:{ip}")

        username = (body.get("username") or "").strip()
        password = body.get("password") or ""
        nickname = (body.get("nickname") or "").strip()[:24]

        if is_official_title_name(nickname or username):
            self._json(400, {"error": OFFICIAL_NAME_ERROR})
            return
        if not USERNAME_RE.match(username):
            self._json(400, {"error": "用户名需为 2-16 位中英文、数字或下划线"})
            return
        if len(password) < 12 or len(password) > 128:
            self._json(400, {"error": "密码长度需在 12-128 位之间"})
            return
        if get_local_user_by_name(username):
            self._json(409, {"error": "该用户名已被注册"})
            return

        # 首个注册账号自动成为管理员（正常情况下站长 USSO 已是管理员）
        conn = db()
        n_local = conn.execute("SELECT COUNT(*) c FROM local_users").fetchone()["c"]
        conn.close()
        has_admin = bool(ADMIN_USSO_IDS) or n_local > 0
        role = "executor" if has_admin else "admin"

        pass_hash = hash_password(password)  # scrypt is slow: never hold DB_LOCK while hashing
        with DB_LOCK:
            conn = db()
            try:
                cur = conn.execute(
                    "INSERT INTO local_users (username, pass_hash, nickname, role, status, created_at, last_login) VALUES (?,?,?,?,?,?,?)",
                    (username, pass_hash, nickname, role, "active", now_iso(), now_iso()))
                uid = cur.lastrowid
            except sqlite3.IntegrityError:
                conn.close()
                self._json(409, {"error": "该用户名已被注册"})
                return
            conn.commit()
            conn.close()

        session_id = create_session("local", uid, request_root(self))
        ident = resolve_identity("local", uid)
        self._json(200, {"ok": True, "user": ident}, cookie=[self._session_cookie(session_id), self._sso_cookie(uid, "local", ident.get("name") or "")])

    def _api_local_login(self):
        body = self._read_json()
        if body is None:
            return
        username = (body.get("username") or "").strip()
        password = body.get("password") or ""
        ip = self._client_ip()
        if login_throttled(username, ip):
            self._json(429, {"error": "尝试次数过多，请 10 分钟后再试"})
            return
        if not self._turnstile_passed(body, "login"):
            return

        u = get_local_user_by_name(username)
        if not u or not verify_password(password, u["pass_hash"]):
            login_failed(username, ip)
            self._json(401, {"error": "用户名或密码错误"})
            return
        if u.get("status") != "active":
            self._json(403, {"error": "该账号已被封禁"})
            return

        with DB_LOCK:
            conn = db()
            conn.execute("UPDATE local_users SET last_login=? WHERE uid=?", (now_iso(), u["uid"]))
            conn.commit()
            conn.close()

        session_id = create_session("local", u["uid"], request_root(self))
        ident = resolve_identity("local", u["uid"])
        self._json(200, {"ok": True, "user": ident}, cookie=[self._session_cookie(session_id), self._sso_cookie(u["uid"], "local", ident.get("name") or username)])

    # ---------- /api/auth（统一入口：存在即登录，不存在即注册） ----------
    def _api_auth(self):
        body = self._read_json()
        if body is None:
            return
        username = (body.get("username") or "").strip()
        password = body.get("password") or ""
        ip = self._client_ip()
        if login_throttled(username, ip):
            self._json(429, {"error": "尝试次数过多，请 10 分钟后再试"})
            return
        if not self._turnstile_passed(body, "auth"):
            return

        u = get_local_user_by_name(username) if username else None
        if u:
            # —— 登录 ——
            if not verify_password(password, u["pass_hash"]):
                login_failed(username, ip)
                self._json(401, {"error": "密码错误"})
                return
            if u.get("status") != "active":
                self._json(403, {"error": "该账号已被封禁"})
                return
            with DB_LOCK:
                conn = db()
                conn.execute("UPDATE local_users SET last_login=? WHERE uid=?", (now_iso(), u["uid"]))
                conn.commit()
                conn.close()
            session_id = create_session("local", u["uid"], request_root(self))
            ident = resolve_identity("local", u["uid"])
            self._json(200, {"ok": True, "registered": False, "user": ident},
                       cookie=[self._session_cookie(session_id), self._sso_cookie(u["uid"], "local", ident.get("name") or username)])
            return

        # —— 注册（用户名不存在） ——
        # 新账号默认以用户名作为名号；已有账号登录不会经过此检查。
        if is_official_title_name(username):
            self._json(400, {"error": OFFICIAL_NAME_ERROR})
            return
        if rate_blocked(f"reg:{ip}", 5, 3600):
            self._json(429, {"error": "注册过于频繁，请稍后再试"})
            return
        if not USERNAME_RE.match(username):
            self._json(400, {"error": "用户名需为 2-16 位中英文、数字或下划线"})
            return
        if len(password) < 12 or len(password) > 128:
            self._json(400, {"error": "密码长度需在 12-128 位之间"})
            return
        rate_add(f"reg:{ip}")

        conn = db()
        n_local = conn.execute("SELECT COUNT(*) c FROM local_users").fetchone()["c"]
        conn.close()
        has_admin = bool(ADMIN_USSO_IDS) or n_local > 0
        role = "executor" if has_admin else "admin"

        with DB_LOCK:
            conn = db()
            try:
                cur = conn.execute(
                    "INSERT INTO local_users (username, pass_hash, nickname, role, status, created_at, last_login) VALUES (?,?,?,?,?,?,?)",
                    (username, hash_password(password), "", role, "active", now_iso(), now_iso()))
                uid = cur.lastrowid
            except sqlite3.IntegrityError:
                conn.close()
                self._json(409, {"error": "该用户名已被注册"})
                return
            conn.commit()
            conn.close()

        session_id = create_session("local", uid, request_root(self))
        ident = resolve_identity("local", uid)
        self._json(200, {"ok": True, "registered": True, "user": ident},
                   cookie=[self._session_cookie(session_id), self._sso_cookie(uid, "local", ident.get("name") or username)])

    # ---------- /api/sso-user（共享导航显示账户） ----------
    def _api_sso_user(self):
        can_view_original = self._original_allowed()
        ident = self._require_ident_optional()
        if not ident:
            self._json(200, {"logged_in": False, "can_view_original": can_view_original}); return
        conn = db()
        account_avatar = get_profile(conn, ident["kind"], ident["uid"])["account_avatar_url"]
        conn.close()
        self._json(200, {"logged_in": True, "kind": ident["kind"], "user_id": ident["uid"],
                         "name": ident.get("nickname") or ident.get("username") or "",
                         "role": ident.get("role"), "is_admin": ident.get("is_admin"),
                         "can_view_original": can_view_original,
                         "account_avatar_url": account_avatar, "picture": ident.get("picture") or ""})

    def _api_account_avatar(self):
        ident = self._require_ident()
        if not ident:
            return
        content_type = self.headers.get("Content-Type", "").lower()
        if content_type.startswith("multipart/form-data"):
            body = self._read_image_form()
            if body is None:
                return
            image = body.pop("_image_file", None)
            if not image:
                self._json(400, {"error": "缺少头像图片"}); return
            try:
                asset_url = store_avatar_image(*image)
            except ValueError as error:
                self._json(400, {"error": str(error)}); return
        else:
            body = self._read_json()
            if body is None:
                return
            if body.get("remove") is not True:
                self._json(400, {"error": "头像操作无效"}); return
            asset_url = ""
        with DB_LOCK:
            conn = db()
            set_account_avatar(conn, ident["kind"], ident["uid"], asset_url, now_iso())
            conn.commit()
            conn.close()
        self._json(200, {"ok": True, "account_avatar_url": asset_url})

    def _api_avatar_asset_upload(self):
        if not self._require_ident():
            return
        body = self._read_image_form()
        if body is None:
            return
        image = body.pop("_image_file", None)
        if not image:
            self._json(400, {"error": "缺少头像图片"}); return
        try:
            asset_url = store_avatar_image(*image)
        except ValueError as error:
            self._json(400, {"error": str(error)}); return
        # Upload clients need the durable path to persist it in a character record.
        # Other API responses still expose opaque, permission-checked preview URLs.
        self._json(200, {"ok": True, "avatar_asset_id": asset_url}, sanitize_images=False)

    # ---------- /api/user ----------
    def _api_user(self):
        sess = read_session(self._get_session())
        if not sess:
            self._json(200, {"logged_in": False})
            return
        ident = resolve_identity(sess["kind"], sess["uid"])
        if not ident:
            destroy_session(self._get_session())
            self._json(200, {"logged_in": False})
            return
        conn = db()
        pend = conn.execute(
            "SELECT 1 FROM elder_requests WHERE kind=? AND uid=? AND status='pending' LIMIT 1",
            (ident["kind"], ident["uid"])).fetchone()
        spend = conn.execute(
            "SELECT 1 FROM executor_requests WHERE user_kind=? AND user_uid=? AND status='pending' LIMIT 1",
            (ident["kind"], ident["uid"])).fetchone()
        epend = {t: bool(conn.execute(
            "SELECT 1 FROM exempt_requests WHERE type=? AND user_kind=? AND user_uid=? AND status='pending' LIMIT 1",
            (t, ident["kind"], ident["uid"])).fetchone()) for t in ("age", "skill")}
        grow = conn.execute(
            "SELECT group_confirmed, group_nickname FROM local_users WHERE uid=?", (ident["uid"],)).fetchone() if ident["kind"] == "local" \
            else conn.execute("SELECT group_confirmed, group_nickname FROM user_flags WHERE kind='usso' AND uid=?", (ident["uid"],)).fetchone()
        theme = conn.execute(
            "SELECT theme_primary, theme_accent FROM local_users WHERE uid=?", (ident["uid"],)).fetchone() if ident["kind"] == "local" \
            else conn.execute("SELECT theme_primary, theme_accent FROM users WHERE user_id=?", (ident["uid"],)).fetchone()
        account_avatar = get_profile(conn, ident["kind"], ident["uid"])["account_avatar_url"]
        conn.close()
        ex = self._get_exempts(ident)
        honor = self._get_honor(ident)
        self._json(200, {
            "logged_in": True,
            **honor,
            "kind": ident["kind"],
            "user_id": ident["uid"],
            "username": ident.get("username", ""),
            "nickname": ident["nickname"],
            "email": ident["email"],
            "picture": ident["picture"],
            "account_avatar_url": account_avatar,
            "role": ident["role"],
            "is_admin": ident["is_admin"],
            "edit_role": self._get_edit_role(ident),
            "elder_pending": bool(pend),
            "scribe_pending": bool(spend),
            "group_confirmed": bool(grow and grow["group_confirmed"]),
            "group_nickname": (grow["group_nickname"] if grow else "") or "",
            "exempt_age": ex["exempt_age"],
            "exempt_skill": ex["exempt_skill"],
            "exempt_age_pending": epend["age"],
            "exempt_skill_pending": epend["skill"],
            **self._level_fields(ident),
            "theme_primary": (theme["theme_primary"] if theme else "") or "",
            "theme_accent": (theme["theme_accent"] if theme else "") or "",
        }, cookie=self._sso_cookie(ident["uid"], ident["kind"], ident.get("nickname") or ident.get("username") or ""))

    # ---------- /api/user/theme ----------
    def _api_user_theme(self):
        ident = self._require_ident()
        if not ident:
            return
        body = self._read_json() or {}
        primary = (body.get("primary") or "").strip().lower()
        accent = (body.get("accent") or "").strip().lower()
        if not re.fullmatch(r"#[0-9a-f]{6}", primary) or not re.fullmatch(r"#[0-9a-f]{6}", accent):
            self._json(400, {"error": "颜色格式错误，需为 #RRGGBB 形式"})
            return
        kind, uid = ident["kind"], ident["uid"]
        with DB_LOCK:
            conn = db()
            if kind == "local":
                conn.execute("UPDATE local_users SET theme_primary=?, theme_accent=? WHERE uid=?", (primary, accent, uid))
            else:
                conn.execute("UPDATE users SET theme_primary=?, theme_accent=? WHERE user_id=?", (primary, accent, uid))
            conn.commit()
            conn.close()
        # 刷新 hx_sso cookie，新配色立即生效
        self._json(200, {"ok": True, "primary": primary, "accent": accent},
                   cookie=self._sso_cookie(uid, kind, ident.get("nickname") or ident.get("username") or ""))

    # ---------- /api/logout ----------
    def _api_logout(self):
        destroy_session(self._get_session())
        self.send_response(302)
        for k, v in self._cors_headers():
            self.send_header(k, v)
        self.send_header("Location", "/")
        self.send_header("Set-Cookie", self._session_clear_cookie())
        self.send_header("Set-Cookie", self._sso_clear_cookie())
        self.send_header("Content-Length", "0")
        self.end_headers()

    # ---------- 角色卡 ----------
    def _require_ident(self):
        sess = read_session(self._get_session())
        if not sess:
            self._json(401, {"error": "未登录"})
            return None
        ident = resolve_identity(sess["kind"], sess["uid"])
        if not ident:
            destroy_session(self._get_session())
            self._json(403, {"error": "账号不可用"})
            return None
        return ident

    def _require_ident_optional(self):
        sess = read_session(self._get_session())
        if not sess:
            return None
        return resolve_identity(sess["kind"], sess["uid"])

    @staticmethod
    def _data_key(ident):
        return f"local:{ident['uid']}" if ident["kind"] == "local" else ident["uid"]

    @oc_api
    def _api_get_characters(self):
        ident = self._require_ident()
        if not ident:
            return
        self._json(200, {"characters": character_store().list(ident), "storage_backend": character_store().backend})

    @oc_api
    def _api_user_ocs(self):
        ident = self._require_ident()
        if not ident:
            return
        characters = character_store().list(ident)
        result = []
        for record in characters[:100]:
            data = record.get("data") if isinstance(record, dict) else None
            if not isinstance(data, dict):
                continue
            images = data.get("images") if isinstance(data.get("images"), list) else [data.get("image", "")]
            candidates = []
            for source in images[:20]:
                if isinstance(source, str) and source.startswith("data:image/"):
                    try:
                        source = store_source_data_uri(source)
                    except ValueError:
                        continue
                if isinstance(source, str) and (source.startswith("/assets/uploads/") or source.startswith("https://")):
                    candidates.append(source)
            result.append({
                "id": str(data.get("code") or record.get("code") or ""),
                "name": str(data.get("name") or "")[:80],
                "species_type": str(data.get("species_type") or "")[:40],
                "species_detail": str(data.get("species_detail") or "")[:100],
                "avatar_asset_id": str(data.get("avatar_asset_id") or ""),
                "version": record.get("_oc_version"),
                "images": candidates,
            })
        self._json(200, {"ocs": result})

    @oc_api
    def _api_get_character(self, qs):
        code = qs.get("code", [None])[0]
        if not code:
            self._json(400, {"error": "缺少 code 参数"})
            return
        # Codes are unique per owner only; like the legacy scan, the first public record wins.
        data = {"public": character_store().public_records(code)}
        for uid, chars in data.items():
            for c in chars:
                if c.get("code") == code:
                    html = get_record_html(c)
                    if html:
                        data = c.get("data") or {}
                        primary, accent = data.get("colorPrimary"), data.get("colorAccent")
                        index = data.get("colorIndex")
                        has_hex = all(isinstance(value, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", value) for value in (primary, accent))
                        has_index = isinstance(index, int) and not isinstance(index, bool) and 0 <= index < 19
                        if has_hex or has_index:
                            # HEX is authoritative; the shared preset map covers index-only snapshots.
                            theme = json.dumps({"colorPrimary": primary if has_hex else None, "colorAccent": accent if has_hex else None, "colorIndex": index if has_index else None})
                            injection = ('<script src="/character-colors.js?v=20261013"></script>'
                                         '<script>HuiguanColors.installShowcase(' + theme + ');</script>')
                            html = html.replace("</head>", injection + "</head>", 1)
                        self._send_html(html)
                        return
        conn = db()
        try:
            published = published_document(conn, code, self._require_ident_optional())
        finally:
            conn.close()
        if published:
            self._send_html(published)
            return
        body = "角色不存在".encode("utf-8")
        self.send_response(404)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, html):
        html = _sanitize_image_urls_in_text(html)
        body = html.encode("utf-8")
        accept = (self.headers.get("Accept-Encoding") or "")
        use_gzip = "gzip" in accept and len(body) > 1024
        if use_gzip:
            body = gzip.compress(body, 6)
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Security-Policy", "sandbox allow-popups allow-forms")
        if use_gzip:
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    @oc_api
    def _api_sso_role_theme(self, qs):
        """跨站 SSO 角色配色：供 psy 题库站用 hx_sso token 换取该用户
        「第一次填的角色」（createdAt 最早）的配色数据。
        token 由 hx_sso.make_token 签发（huiguan 登录态或 psy 后端转发）。
        """
        token = (qs.get("token") or [None])[0]
        if not token:
            self._json(400, {"error": "缺少 token 参数"})
            return
        payload = hx_sso.verify_token(token, request_root(self))
        if not payload:
            self._json(401, {"error": "token 无效或已过期"})
            return
        uid = str(payload.get("uid") or "")
        if not uid:
            self._json(401, {"error": "token 缺少 uid"})
            return
        ident = {"kind": payload.get("kind") or "local", "uid": uid}
        chars = character_store().list(ident)
        if not chars:
            self._json(200, {"ok": True, "role": None})
            return

        def _parse_created(s):
            # "2026/8/6 19:15:43" → 可比较元组；失败返回 None
            try:
                parts = str(s).strip().split(" ")
                dparts = parts[0].split("/")
                y, m, d = int(dparts[0]), int(dparts[1]), int(dparts[2])
                hm = parts[1].split(":") if len(parts) > 1 else ["0", "0", "0"]
                hh = int(hm[0])
                mm = int(hm[1]) if len(hm) > 1 else 0
                ss = int(hm[2]) if len(hm) > 2 else 0
                return (y, m, d, hh, mm, ss)
            except Exception:
                return None

        best = None
        best_t = None
        for c in chars:
            cdata = c.get("data") if isinstance(c, dict) else None
            if not isinstance(cdata, dict):
                continue
            t = _parse_created(cdata.get("createdAt") or "")
            # 无 createdAt 的角色按最老处理（数组末尾优先）
            key_t = t if t is not None else (9999, 12, 31, 23, 59, 59)
            if best_t is None or key_t < best_t:
                best_t = key_t
                best = cdata
        if best is None:
            last = chars[-1]
            best = last.get("data") if isinstance(last, dict) else None
        if not isinstance(best, dict):
            self._json(200, {"ok": True, "role": None})
            return
        self._json(200, {"ok": True, "role": {
            "code": best.get("code", ""),
            "name": best.get("name", ""),
            "colorIndex": best.get("colorIndex"),
            "colorPrimary": best.get("colorPrimary") or "",
            "colorAccent": best.get("colorAccent") or "",
        }})

    @oc_api
    def _api_save_character(self):
        ident = self._require_ident()
        if not ident:
            return
        # New clients upload image files first; the bounded allowance supports cached legacy imports.
        body = self._read_json(max_bytes=64 * 1024 * 1024)
        if body is None:
            return

        code = body.get("code", "")
        html = body.get("html", "")
        data_field = body.get("data", {})

        try:
            normalize_oc_avatar(data_field)
        except ValueError as error:
            self._json(400, {"error": str(error)}); return

        # 外置大字段：展示页 HTML -> 文件；base64 图片 -> 独立文件 URL
        html_ref = store_showcase_html(html) if html else None
        if isinstance(data_field, dict):
            try:
                if isinstance(data_field.get("image"), str):
                    data_field["image"] = _persist_preview_reference(data_field["image"])
                if isinstance(data_field.get("images"), list):
                    data_field["images"] = [_persist_preview_reference(x) if isinstance(x, str) else x for x in data_field["images"]]
            except ValueError as error:
                self._json(400, {"error": str(error)}); return
            if data_field.get("image", "").startswith("data:"):
                data_field["image"] = store_data_uri(data_field["image"])
            if isinstance(data_field.get("images"), list):
                data_field["images"] = [store_data_uri(x) for x in data_field["images"]]

        previous_code = body.get("previous_code") or ""
        rec = {"code": code, "data": data_field}
        if html_ref: rec["html_ref"] = html_ref
        awarded = []
        with character_store().transaction(write=True) as session:
            saved, created = session.save(ident, rec, body.get("version"), previous_code)
            sync_fan_characters(session.conn, ident, code, data_field, previous_code)
            if created:
                custom = bool(data_field.get("colorPrimary")) and data_field.get("colorIndex") in (None, "", -1)
                awarded = account_progress.award_sheet(session.conn, ident["kind"], ident["uid"],
                                                       ident.get("nickname") or ident.get("username") or "", code, custom)
        self._json(200, {"ok": True, "url": f"/show.html?code={urllib.parse.quote(code)}",
                         "character": saved, "version": saved.get("_oc_version"),
                         "earned": round(sum(a["amount"] for a in awarded), 1), "awarded": awarded,
                         **self._level_fields(ident)})

    @oc_api
    def _api_save_all(self):
        ident = self._require_ident()
        if not ident:
            return
        # 图片以 base64 传输，封面 / 多图 / 展示页可能重复包含图片。
        body = self._read_json(max_bytes=64 * 1024 * 1024)
        if body is None:
            return

        chars = body.get("characters", [])
        if not isinstance(chars, list) or any(not isinstance(c, dict) for c in chars):
            self._json(400, {"error": "invalid_oc_records"}); return
        new_chars = []
        for c in chars:
            try:
                normalize_oc_avatar(c)
                if isinstance(c.get("image"), str): c["image"] = _persist_preview_reference(c["image"])
                if isinstance(c.get("images"), list):
                    c["images"] = [_persist_preview_reference(x) if isinstance(x, str) else x for x in c["images"]]
            except ValueError as error:
                self._json(400, {"error": str(error)}); return
            if c.get("image", "").startswith("data:"): c["image"] = store_data_uri(c["image"])
            if isinstance(c.get("images"), list): c["images"] = [store_data_uri(x) for x in c["images"]]
            new_chars.append({"code": c.get("code", ""), "data": c})
        with character_store().transaction(write=True) as session:
            old = session.list(ident)
            old_map = {c["code"]: c for c in old}
            for rec in new_chars:
                entry = old_map.get(rec["code"], {})
                if entry.get("html_ref"): rec["html_ref"] = entry["html_ref"]
                elif entry.get("html"): rec["html_ref"] = store_showcase_html(entry["html"])
            saved = session.replace(ident, new_chars, body.get("versions"))
            incoming = {c["code"] for c in saved}
            for rec in old:
                if rec["code"] not in incoming:
                    session.conn.execute("UPDATE fan_characters SET is_public=0 WHERE user_kind=? AND user_uid=? AND code=? AND COALESCE(type,'')!='配色海报'", (ident["kind"], str(ident["uid"]), rec["code"]))
            for rec in saved: sync_fan_characters(session.conn, ident, rec["code"], rec["data"])
        self._json(200, {"ok": True, "characters": saved})

    @oc_api
    def _api_owned_character(self, qs):
        ident = self._require_ident()
        if not ident: return
        record = character_store().get(ident, (qs.get("code") or [None])[0], (qs.get("id") or [None])[0])
        if record is None: self._json(404, {"error": "oc_not_found"}); return
        self._json(200, {"character": record})

    @oc_api
    def _api_delete_character(self):
        ident = self._require_ident()
        if not ident: return
        body = self._read_json()
        if body is None: return
        with character_store().transaction(write=True) as session:
            removed = session.delete(ident, body.get("code"), body.get("version"))
            session.conn.execute("UPDATE fan_characters SET is_public=0 WHERE user_kind=? AND user_uid=? AND code=? AND COALESCE(type,'')!='配色海报'", (ident["kind"], str(ident["uid"]), body.get("code")))
        self._json(200, {"ok": True, "removed": removed})

    # ---------- 管理员 ----------
    def _require_admin(self):
        ident = self._require_ident()
        if not ident:
            return None
        if not ident["is_admin"]:
            self._json(403, {"error": "需要管理员权限"})
            return None
        return ident

    def _api_admin_users(self):
        admin = self._require_admin()
        if not admin:
            return
        conn = db()
        locals_ = [dict(r) for r in conn.execute(
            "SELECT uid, username, nickname, email, role, status, created_at, last_login FROM local_users ORDER BY uid")]
        usso = [dict(r) for r in conn.execute(
            "SELECT user_id, nickname, email, picture, first_login, last_login FROM users ORDER BY first_login")]
        flags = {(r["kind"], r["uid"]): dict(r) for r in conn.execute("SELECT * FROM user_flags")}
        conn.close()

        out = []
        for u in locals_:
            out.append({
                "kind": "local", "uid": str(u["uid"]),
                "name": u["username"], "nickname": u.get("nickname") or "",
                "email": u.get("email", ""),
                "role": u.get("role", "user"), "status": u.get("status", "active"),
                "created_at": u.get("created_at", ""), "last_login": u.get("last_login", ""),
            })
        for u in usso:
            f = flags.get(("usso", u["user_id"]), {})
            is_admin = u["user_id"] in ADMIN_USSO_IDS or f.get("role") == "admin"
            out.append({
                "kind": "usso", "uid": u["user_id"],
                "name": u.get("nickname", ""), "nickname": u.get("nickname", ""),
                "email": u.get("email", ""),
                "role": "admin" if is_admin else "user",
                "status": f.get("status", "active"),
                "created_at": u.get("first_login", ""), "last_login": u.get("last_login", ""),
            })
        self._json(200, {"users": out, "self": {"kind": admin["kind"], "uid": admin["uid"]}})

    @oc_api
    def _api_admin_characters(self):
        admin = self._require_admin()
        if not admin:
            return
        self._json(200, {"characters": get_admin_characters()})

    @oc_api
    def _api_my_broken_characters(self):
        ident = self._require_ident()
        if not ident:
            return
        chars = character_store().list(ident)
        out = [{"code": c.get("code", ""), "data": c.get("data") or {}, "_oc_version": c.get("_oc_version")} for c in chars if not (c.get("html") or c.get("html_ref"))]
        self._json(200, {"characters": out})

    # ---------- 官方角色（直查世界观库） ----------
    def _api_official_characters(self, qs):
        q = (qs.get("q", [""])[0] or "").strip()
        try:
            min_c = int(qs.get("min", ["0"])[0] or 0)
            max_c = int(qs.get("max", ["8"])[0] or 8)
            limit = int(qs.get("limit", ["30"])[0] or 30)
            page = int(qs.get("page", ["1"])[0] or 1)
        except (TypeError, ValueError):
            self._json(400, {"error": "分页参数无效"})
            return
        min_c = max(0, min(min_c, 8))
        max_c = max(0, min(max_c, 8))
        limit = max(1, min(limit, 60))
        page = max(page, 1)
        if page > 100000:
            self._json(400, {"error": "分页超出范围"})
            return
        offset = (page - 1) * limit
        dup = (qs.get("dup", ["0"])[0] or "0") == "1"
        dup_clause = "AND name IN (SELECT name FROM characters GROUP BY name HAVING COUNT(*)>1) " if dup else ""
        ckey = ("list", q, min_c, max_c, limit, page, dup)
        cached = _wv_get(ckey)
        if cached is not None:
            self._json(200, cached); return
        conn = wv()
        rows = conn.execute(
            "SELECT * FROM v_character_gallery WHERE id NOT IN (SELECT id FROM characters WHERE merged_to IS NOT NULL) AND id NOT IN (SELECT id FROM characters WHERE category='同人角色') AND completeness BETWEEN ? AND ? "
            + ("AND (name LIKE ? OR aliases LIKE ?) " if q else "") + dup_clause
            + "ORDER BY "
            + "CASE WHEN type LIKE '%主角%' THEN 0 "
            + "WHEN type LIKE '%核心%' THEN 1 "
            + "WHEN type LIKE '%重要%' OR type LIKE '%主要%' THEN 2 ELSE 3 END, "
            + "CASE WHEN thumb_path IS NOT NULL AND thumb_path != '' THEN 0 ELSE 1 END, "
            + "name, id LIMIT ? OFFSET ?",
            [min_c, max_c] + ([f"%{q}%", f"%{q}%"] if q else []) + [limit, offset]
        ).fetchall()
        total = conn.execute(
            "SELECT COUNT(*) FROM v_character_gallery WHERE id NOT IN (SELECT id FROM characters WHERE merged_to IS NOT NULL) AND id NOT IN (SELECT id FROM characters WHERE category='同人角色') AND completeness BETWEEN ? AND ? "
            + ("AND (name LIKE ? OR aliases LIKE ?)" if q else "") + (" " + dup_clause.strip() if dup else ""),
            [min_c, max_c] + ([f"%{q}%", f"%{q}%"] if q else [])
        ).fetchone()[0]
        conn.close()
        chars = [dict(r) for r in rows]
        fix = _worldview_connection(); fix.row_factory = sqlite3.Row
        for c in chars:
            tp = c.get("thumb_path")
            sp = _safe_image_path(tp) if tp else None
            if sp and (_is_remote_image(sp) or os.path.isfile(sp)):
                c["thumb_id"] = None
                continue
            row = None
            for r in fix.execute("SELECT id, image_path FROM character_images WHERE character_id=? ORDER BY COALESCE(sort_order,id), id", (c["id"],)):
                p = _safe_image_path(r["image_path"])
                if p and (_is_remote_image(p) or os.path.isfile(p)):
                    row = r; break
            if row:
                c["thumb_path"] = row["image_path"]; c["thumb_id"] = row["id"]
            else:
                c["thumb_path"] = None; c["thumb_id"] = None
        fix.close()
        for c in chars:
            c["volume"] = "official_main"
        out = {"total": total, "volume": "official_main", "characters": chars}
        _wv_set(ckey, out)
        self._json(200, out)

    def _api_official_character(self, qs):
        cid = qs.get("id", [None])[0]
        if not cid:
            self._json(400, {"error": "缺少 id"}); return
        cached = _wv_get(("char", cid))
        if cached is not None:
            self._json(200, cached); return
        conn = wv()
        ch = conn.execute("SELECT * FROM characters WHERE id=?", (cid,)).fetchone()
        if not ch:
            conn.close()
            self._json(404, {"error": "角色不存在"}); return
        if ch["merged_to"]:
            target = conn.execute("SELECT name FROM characters WHERE id=?", (ch["merged_to"],)).fetchone()
            conn.close()
            self._json(404, {"error": "角色不存在", "merged_to": ch["merged_to"], "merged_to_name": target[0] if target else None}); return
        abilities = [dict(r) for r in conn.execute("SELECT ability,description FROM character_abilities_ext WHERE character_id=? ORDER BY id", (cid,))]
        relations = [dict(r) for r in conn.execute("SELECT related_name,relation_type,relation_desc FROM character_relations_ext WHERE character_id=? ORDER BY id", (cid,))]
        images = [dict(r) for r in conn.execute("SELECT id,image_path,image_type,description FROM character_images WHERE character_id=? ORDER BY COALESCE(sort_order,id), id", (cid,))]
        events = [dict(r) for r in conn.execute("SELECT event FROM character_events WHERE character_id=? ORDER BY id", (cid,))]
        conn.close()
        out = {"volume": "official_main", "character": dict(ch), "abilities": abilities, "relations": relations, "images": images, "events": events}
        _wv_set(("char", cid), out)
        self._json(200, out)

    def _api_official_stickers(self):
        cached = _wv_get(("stickers",))
        if cached is not None:
            rows = cached["stickers"]
        else:
            conn = wv()
            ensure_sticker_table(conn)
            rows = [dict(r) for r in conn.execute(
                "SELECT ci.id, ci.character_id, COALESCE(c.name,'站友投稿') AS character_name, ci.description, ci.image_path, "
                "su.kind AS upload_kind, su.uid AS upload_uid, su.nickname AS uploader "
                "FROM character_images ci "
                "LEFT JOIN characters c ON c.id=ci.character_id "
                "LEFT JOIN sticker_uploads su ON su.image_id=ci.id "
                "WHERE ci.image_type='sticker' AND (c.id IS NULL OR c.merged_to IS NULL OR c.merged_to='') "
                "ORDER BY (c.id IS NULL), c.name, COALESCE(ci.sort_order, ci.id), ci.id"
            ).fetchall()]
            conn.close()
            out = {"stickers": rows}
            _wv_set(("stickers",), out)
        ident = self._require_ident_optional()
        stickers = []
        for row in rows:
            mine = bool(ident and row.get("upload_kind") == ident["kind"] and str(row.get("upload_uid")) == str(ident["uid"]))
            stickers.append({
                "id": row["id"],
                "character_id": row["character_id"],
                "character_name": row["character_name"],
                "description": row["description"],
                "image_path": row["image_path"],
                "uploader": row.get("uploader") or "",
                "mine": mine,
            })
        self._json(200, {"stickers": stickers})

    # ---------- 图片分发：公开接口只发派生版本，原图仅站长 ----------
    def _original_allowed(self):
        """Same definition of "admin" as the main site's gallery: a verified hx_sso account that is a site owner."""
        return is_site_owner(hx_sso.read_cookie(self.headers), DATA_ROOT)

    def _send_derived_image(self, path, thumb, cors, max_age, head=False):
        data, ct = _preview_bytes(path, thumb=thumb)
        if data is None:
            self.send_error(404); return
        self.send_response(200)
        if cors:
            self._assets_cors()
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", f"public, max-age={max_age}")
        self.end_headers()
        if not head:
            self.wfile.write(data)

    def _send_public_image(self, endpoint, qs, cors=False, max_age=604800):
        try:
            path = _lookup_image(endpoint, qs)
        except _NoImage as error:
            self.send_error(error.status); return
        self._send_derived_image(path, _first(qs, "t") in ("1", "true"), cors, max_age)

    def _api_upload_preview(self, qs, head=False):
        try:
            path = _lookup_image("/api/uploads/preview", qs)
        except _NoImage:
            self.send_error(404); return
        self._send_derived_image(path, _first(qs, "t") in ("1", "true"), False, 86400, head)

    def _api_image_preview(self, qs, head=False):
        try:
            source = _lookup_image("/api/image-preview", qs)
        except _NoImage:
            self.send_error(404); return
        self._send_derived_image(source, _first(qs, "t") in ("1", "true"), False, 86400, head)

    def _api_original_image(self, qs, head=False):
        """The only route that returns a source file. Owner session required; never cacheable."""
        def refuse(code, message):
            body = b"" if head else json.dumps({"error": message}, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if body:
                self.wfile.write(body)
        fetch_site = (self.headers.get("Sec-Fetch-Site") or "").lower()
        origin = self.headers.get("Origin") or self.headers.get("Referer") or ""
        if fetch_site == "cross-site" or not request_origin_allowed(self):
            return refuse(403, "原图请求来源不被允许")
        if not self._original_allowed():
            return refuse(403, "原图仅限站长登录后查看")
        src = urllib.parse.urlsplit(_first(qs, "src") or "")
        if src.scheme or src.netloc or not src.path.startswith("/"):
            return refuse(400, "图片地址无效")
        src_qs = urllib.parse.parse_qs(src.query)
        if src.path.startswith("/assets/uploads/"):
            name = urllib.parse.unquote(src.path[len("/assets/uploads/"):])
            target = os.path.join(UPLOAD_DIR, name)
            if not UPLOAD_NAME_RE.fullmatch(name) or not os.path.isfile(target):
                return refuse(404, "原图暂不可用")
        elif src.path in IMAGE_ENDPOINTS:
            try:
                target = _lookup_image(src.path, src_qs)
            except _NoImage as error:
                return refuse(error.status, "原图暂不可用")
        else:
            return refuse(404, "原图暂不可用")
        if _is_remote_image(target):
            self.send_response(302)
            self.send_header("Location", target)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if isinstance(target, bytes):
            data = target
            try:
                from PIL import Image
                with Image.open(BytesIO(data)) as im:
                    content_type = IMAGE_CONTENT_TYPES.get("." + (im.format or "").lower(), "application/octet-stream")
            except Exception:
                return refuse(404, "原图暂不可用")
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "private, no-store")
            self.send_header("Vary", "Cookie")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            if not head:
                self.wfile.write(data)
            return
        self.send_response(200)
        self.send_header("Content-Type", IMAGE_CONTENT_TYPES.get(os.path.splitext(target)[1].lower(), "application/octet-stream"))
        self.send_header("Content-Length", str(os.path.getsize(target)))
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("Vary", "Cookie")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if not head:
            with open(target, "rb") as stream:
                shutil.copyfileobj(stream, self.wfile)

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/original-image":
            return self._api_original_image(urllib.parse.parse_qs(parsed.query), head=True)
        if parsed.path == "/api/image-preview":
            return self._api_image_preview(urllib.parse.parse_qs(parsed.query), head=True)
        if parsed.path == "/api/uploads/preview":
            return self._api_upload_preview(urllib.parse.parse_qs(parsed.query), head=True)
        super().do_HEAD()

    def _api_official_graph(self):
        cached = _wv_get(("graph",))
        if cached is not None:
            self._json(200, cached); return
        import re as _re
        conn = wv()
        chars = [dict(r) for r in conn.execute("SELECT id, name, type, species, category, deity, avatar_id FROM characters WHERE merged_to IS NULL")]
        rels = [dict(r) for r in conn.execute(
            "SELECT character_id, related_name, relation_type FROM character_relations_ext WHERE related_name IS NOT NULL")]
        # 头像备选：avatar_id 无效时取角色第一张可用图片
        img_fallback = {}
        try:
            for r in conn.execute("""SELECT character_id, id FROM character_images
                                      WHERE character_id IN (SELECT id FROM characters WHERE merged_to IS NULL)
                                      ORDER BY COALESCE(sort_order,id), id"""):
                img_fallback.setdefault(r["character_id"], r["id"])
        except Exception:
            pass
        conn.close()
        name2id = {}
        for c in chars:
            if c["name"]:
                name2id.setdefault(c["name"].strip(), c["id"])
        nodes = []
        for c in chars:
            aid = str(c.get("avatar_id") or "").strip()
            if aid.isdigit() and int(aid) > 0:
                avatar = f"/api/official/img-id?id={aid}&t=1"
            else:
                fid = img_fallback.get(c["id"])
                avatar = (f"/api/official/img-id?id={fid}&t=1" if fid
                          else f"/api/official/img?cid={c['id']}&n=0&t=1")
            nodes.append({"id": c["id"], "name": c["name"], "type": c["type"] or "", "species": c["species"] or "", "category": c["category"] or "", "deity": c["deity"] or "", "avatar": avatar})
        edges = []
        seen = set()
        for r in rels:
            src = r["character_id"]
            clean = _re.sub(r"\[\d+\]", "", r["related_name"] or "").strip()
            tgt = name2id.get(clean)
            if tgt is None or tgt == src:
                continue
            key = (src, tgt)
            if key in seen:
                continue
            seen.add(key)
            edges.append({"source": src, "target": tgt, "label": r["relation_type"] or "关系"})
        out = {"nodes": nodes, "edges": edges}
        _wv_set(("graph",), out)
        self._json(200, out)

    def _api_official_avatar_set(self):
        ident = self._require_edit()
        if not ident:
            return
        body = self._read_json()
        if body is None:
            return
        cid = body.get("character_id")
        img_id = body.get("image_id")
        if not cid or not img_id:
            self._json(400, {"error": "缺少角色 / 图片 ID"}); return
        w = _worldview_connection()
        row = w.execute("SELECT character_id FROM character_images WHERE id=?", (img_id,)).fetchone()
        if not row or str(row[0]) != str(cid):
            w.close(); self._json(400, {"error": "该图片不属于此角色"}); return
        w.execute("UPDATE characters SET avatar_id=? WHERE id=?", (img_id, cid))
        w.commit(); w.close()
        # 使图谱缓存失效
        with _WV_CACHE_LOCK:
            _WV_CACHE["data"].pop(("graph",), None)
        self._json(200, {"ok": True})

    def _api_official_img(self, qs):
        self._send_public_image("/api/official/img", qs)

    def _assets_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")

    def _api_assets_manifest(self):
        """素材库清单：角色 → 头像/立绘列表 + 设计资源入口（供各小游戏与素材库页使用）"""
        cached = _wv_get(("assets-manifest",))
        if cached is None:
            conn = wv()
            chars = conn.execute(
                "SELECT id, name, aliases, category FROM characters WHERE merged_to IS NULL ORDER BY id").fetchall()
            img_map = {}
            for r in conn.execute("SELECT id, character_id, image_type, description FROM character_images ORDER BY COALESCE(sort_order,id), id"):
                img_map.setdefault(r["character_id"], []).append(
                    {"id": r["id"], "type": r["image_type"] or "", "desc": r["description"] or ""})
            conn.close()
            characters = []
            for c in chars:
                lst = img_map.get(c["id"], [])
                if not lst:
                    continue
                characters.append({
                    "id": c["id"], "name": c["name"], "aliases": c["aliases"] or "",
                    "category": c["category"] or "",
                    "avatar": f"/api/assets/avatar?cid={c['id']}&t=1",
                    "full": f"/api/assets/avatar?cid={c['id']}",
                    "images": lst,
                })
            cached = {
                "base": site_url("huiguan", host=request_host(self)),
                "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "characters": characters,
                "design": {
                    "css": "/design-system/design-system.css",
                    "ancientColors": "/design-system/ancient-colors.js",
                    "frameDeco": "/design-system/assets/frame_deco.png",
                    "logoText": "/design-system/assets/logo_text.png",
                    "font": "/haibao/FZSSJW.TTF",
                },
            }
            _wv_set(("assets-manifest",), cached)
        self._json(200, cached)

    def _api_assets_avatar(self, qs):
        """角色代表图：?cid=N 或 ?name=角色名（支持别名），&t=1 返回缩略图；其余为站点预览版"""
        self._send_public_image("/api/assets/avatar", qs, cors=True, max_age=2592000)

    def _api_assets_image(self, qs):
        """按 character_images.id 取图：?id=N，&t=1 返回缩略图；其余为站点预览版"""
        self._send_public_image("/api/assets/image", qs, cors=True, max_age=2592000)

    def _api_assets_shared(self, qs):
        """共用素材库（不依赖角色）：?id=N 取图(&t=1 缩略)；无 id 时按类别返回清单"""
        iid = qs.get("id", [None])[0]
        thumb = (qs.get("t", ["0"])[0] in ("1", "true"))
        conn = wv()
        try:
            if iid:
                conn.close()
                self._send_public_image("/api/assets/shared", qs, cors=True, max_age=2592000)
                return
            cat = qs.get("category", [None])[0]
            sql = "SELECT id, category, name, source, tags, file_size FROM shared_assets"
            args = ()
            if cat:
                sql += " WHERE category=?"
                args = (cat,)
            sql += " ORDER BY category, id"
            groups = {}
            for r in conn.execute(sql, args):
                groups.setdefault(r["category"], []).append({
                    "id": r["id"], "name": r["name"], "source": r["source"] or "",
                    "tags": r["tags"] or "", "size": r["file_size"] or 0,
                    "url": "/api/assets/shared?id=%d" % r["id"],
                    "thumb": "/api/assets/shared?id=%d&t=1" % r["id"],
                })
            self._json(200, {"base": site_url("huiguan", host=request_host(self)), "categories": groups})
        finally:
            conn.close()

    def _api_admin_update(self):
        admin = self._require_admin()
        if not admin:
            return
        body = self._read_json()
        if body is None:
            return
        kind, uid = body.get("kind"), str(body.get("uid", ""))
        patch = body.get("set", {})
        if kind not in ("local", "usso") or not uid:
            self._json(400, {"error": "参数错误"})
            return
        if kind == admin["kind"] and uid == admin["uid"] and ("role" in patch or "status" in patch):
            self._json(400, {"error": "不能修改自己的角色或状态"})
            return

        status = patch.get("status")
        role = patch.get("role")
        if role == "user":
            role = "executor"
        if status not in (None, "active", "banned") or role not in (None, "executor", "elder", "admin"):
            self._json(400, {"error": "非法的状态/角色值"})
            return

        with DB_LOCK:
            conn = db()
            if kind == "local":
                row = conn.execute("SELECT uid FROM local_users WHERE uid=?", (uid,)).fetchone()
                if not row:
                    conn.close()
                    self._json(404, {"error": "用户不存在"})
                    return
                if status:
                    conn.execute("UPDATE local_users SET status=? WHERE uid=?", (status, uid))
                if role:
                    conn.execute("UPDATE local_users SET role=? WHERE uid=?", (role, uid))
            else:
                row = conn.execute("SELECT user_id FROM users WHERE user_id=?", (uid,)).fetchone()
                if not row:
                    conn.close()
                    self._json(404, {"error": "用户不存在"})
                    return
                if status:
                    conn.execute("""INSERT INTO user_flags (kind, uid, status) VALUES ('usso', ?, ?)
                                    ON CONFLICT(kind, uid) DO UPDATE SET status=excluded.status""", (uid, status))
                if role:
                    conn.execute("""INSERT INTO user_flags (kind, uid, role) VALUES ('usso', ?, ?)
                                    ON CONFLICT(kind, uid) DO UPDATE SET role=excluded.role""", (uid, role))
            conn.commit()
            conn.close()
        destroy_user_sessions(kind, uid) if status == "banned" else None
        self._json(200, {"ok": True})

    @oc_api
    def _api_admin_delete(self):
        admin = self._require_admin()
        if not admin:
            return
        body = self._read_json()
        if body is None:
            return
        kind, uid = body.get("kind"), str(body.get("uid", ""))
        if kind not in ("local", "usso") or not uid:
            self._json(400, {"error": "参数错误"})
            return
        if kind == admin["kind"] and uid == admin["uid"]:
            self._json(400, {"error": "不能删除自己"})
            return

        with DB_LOCK, character_store().transaction(write=True) as session:
            conn = session.conn
            if kind == "local":
                conn.execute("DELETE FROM local_users WHERE uid=?", (uid,))
            else:
                conn.execute("DELETE FROM users WHERE user_id=?", (uid,))
                conn.execute("DELETE FROM user_flags WHERE kind='usso' AND uid=?", (uid,))
            conn.execute("DELETE FROM sessions_db WHERE kind=? AND uid=?", (kind, uid))
            session.delete_owner({"kind": kind, "uid": uid})
        self._json(200, {"ok": True})

    # ---------- 改名（昵称唯一 + 3 天一次） ----------
    RENAME_COOLDOWN_DAYS = 3

    def _api_rename(self):
        ident = self._require_ident()
        if not ident:
            return
        body = self._read_json() or {}
        newname = (body.get("nickname") or "").strip()
        if not newname:
            self._json(400, {"error": "昵称不能为空"})
            return
        if len(newname) > 24:
            self._json(400, {"error": "昵称最长 24 个字符"})
            return
        if newname.isdigit():
            self._json(400, {"error": "昵称不可为纯数字"})
            return
        if is_official_title_name(newname):
            self._json(400, {"error": OFFICIAL_NAME_ERROR})
            return

        kind, uid = ident["kind"], ident["uid"]
        with DB_LOCK:
            conn = db()
            # 昵称唯一（跨 local + usso，排除自己）
            if kind == "local":
                dup = conn.execute("SELECT 1 FROM local_users WHERE nickname=? AND uid<>? LIMIT 1", (newname, uid)).fetchone() \
                    or conn.execute("SELECT 1 FROM users WHERE nickname=? LIMIT 1", (newname,)).fetchone()
            else:
                dup = conn.execute("SELECT 1 FROM users WHERE nickname=? AND user_id<>? LIMIT 1", (newname, uid)).fetchone() \
                    or conn.execute("SELECT 1 FROM local_users WHERE nickname=? LIMIT 1", (newname,)).fetchone()
            if dup:
                conn.close()
                self._json(400, {"error": "该昵称已被使用，请换一个"})
                return
            # 3 天冷却
            if kind == "local":
                row = conn.execute("SELECT last_rename FROM local_users WHERE uid=?", (uid,)).fetchone()
            else:
                row = conn.execute("SELECT last_rename FROM users WHERE user_id=?", (uid,)).fetchone()
            last = (row["last_rename"] or "") if row else ""
            if last:
                try:
                    last_dt = datetime.fromisoformat(last)
                    delta = datetime.now(timezone.utc).astimezone() - last_dt
                    if delta.total_seconds() < self.RENAME_COOLDOWN_DAYS * 86400:
                        remain = self.RENAME_COOLDOWN_DAYS - delta.days
                        conn.close()
                        self._json(400, {"error": f"每 3 天只能改一次昵称，还需约 {remain} 天"})
                        return
                except Exception:
                    pass
            now = now_iso()
            if kind == "local":
                conn.execute("UPDATE local_users SET nickname=?, last_rename=? WHERE uid=?", (newname, now, uid))
            else:
                conn.execute("UPDATE users SET nickname=?, last_rename=? WHERE user_id=?", (newname, now, uid))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True, "nickname": newname})

    # ---------- 长老申请与审批 ----------
    def _api_elder_apply(self):
        ident = self._require_ident()
        if not ident:
            return
        if ident["role"] in ("elder", "admin"):
            self._json(400, {"error": "你已是长老/管理员，无需申请"})
            return
        body = self._read_json() or {}
        message = (body.get("message") or "").strip()[:300]
        with DB_LOCK:
            conn = db()
            exist = conn.execute(
                "SELECT 1 FROM elder_requests WHERE kind=? AND uid=? AND status='pending' LIMIT 1",
                (ident["kind"], ident["uid"])).fetchone()
            if exist:
                conn.close()
                self._json(400, {"error": "已有待审核的申请，请耐心等待"})
                return
            conn.execute(
                "INSERT INTO elder_requests (kind, uid, name, message, status, created_at) VALUES (?,?,?,?, 'pending', ?)",
                (ident["kind"], ident["uid"], ident["nickname"], message, now_iso()))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True})

    def _api_admin_elder_requests(self):
        admin = self._require_admin()
        if not admin:
            return
        conn = db()
        rows = [dict(r) for r in conn.execute(
            "SELECT id, kind, uid, name, message, created_at FROM elder_requests "
            "WHERE status='pending' ORDER BY id")]
        conn.close()
        self._json(200, {"requests": rows})

    def _api_admin_elder_decide(self):
        admin = self._require_admin()
        if not admin:
            return
        body = self._read_json()
        if body is None:
            return
        rid = body.get("id")
        approve = bool(body.get("approve"))
        with DB_LOCK:
            conn = db()
            row = conn.execute("SELECT * FROM elder_requests WHERE id=? AND status='pending'", (rid,)).fetchone()
            if not row:
                conn.close()
                self._json(404, {"error": "申请不存在或已处理"})
                return
            if approve:
                if row["kind"] == "local":
                    conn.execute("UPDATE local_users SET role='elder' WHERE uid=?", (row["uid"],))
                else:
                    conn.execute("""INSERT INTO user_flags (kind, uid, role) VALUES ('usso', ?, 'elder')
                                    ON CONFLICT(kind, uid) DO UPDATE SET role=excluded.role""", (row["uid"],))
            conn.execute("UPDATE elder_requests SET status=? WHERE id=?",
                         ("approved" if approve else "rejected", rid))
            conn.commit()
            conn.close()
        destroy_user_sessions(row["kind"], row["uid"]) if approve else None
        self._json(200, {"ok": True})

    # ---------- 编辑码 / 荣誉头衔 ----------
    def _set_user_cols(self, ident, **cols):
        """给 local_users / user_flags 写若干列（USSO 用户走 upsert）。列名由代码给定，不接受外部输入。"""
        names = list(cols)
        vals = [cols[n] for n in names]
        with DB_LOCK:
            conn = db()
            if ident["kind"] == "local":
                conn.execute("UPDATE local_users SET " + ",".join(f"{n}=?" for n in names) + " WHERE uid=?",
                             vals + [ident["uid"]])
            else:
                conn.execute(
                    "INSERT INTO user_flags (kind, uid, " + ",".join(names) + ") VALUES ('usso',?," + ",".join("?" * len(names)) + ") "
                    "ON CONFLICT(kind, uid) DO UPDATE SET " + ",".join(f"{n}=excluded.{n}" for n in names),
                    [ident["uid"]] + vals)
            conn.commit()
            conn.close()

    def _get_honor(self, ident):
        with DB_LOCK:
            conn = db()
            if ident["kind"] == "local":
                row = conn.execute("SELECT honor_kind, honor_alias FROM local_users WHERE uid=?", (ident["uid"],)).fetchone()
            else:
                row = conn.execute("SELECT honor_kind, honor_alias FROM user_flags WHERE kind='usso' AND uid=?", (ident["uid"],)).fetchone()
            pend = conn.execute("SELECT 1 FROM honor_requests WHERE kind=? AND uid=? AND status='pending' LIMIT 1",
                                (ident["kind"], ident["uid"])).fetchone()
            conn.close()
        return {"honor_kind": (row["honor_kind"] if row else "") or "",
                "honor_alias": (row["honor_alias"] if row else "") or "",
                "honor_pending": bool(pend)}

    def _api_editor_code(self):
        ident = self._require_ident()
        if not ident:
            return
        body = self._read_json() or {}
        code = str(body.get("code") or "").strip()
        ukey, ikey = f"edcode:u:{ident['kind']}:{ident['uid']}", f"edcode:ip:{self._client_ip()}"
        if rate_blocked(ukey, 6, 600) or rate_blocked(ikey, 12, 600):
            self._json(429, {"error": "尝试次数有点多啦，请十分钟后再试～"}); return
        if self._get_edit_role(ident) in ("scribe", "admin"):
            self._json(200, {"ok": True, "already": True, "group_qq": GROUP_QQ,
                             "msg": "你已经是编辑啦，无需再输入编辑码。"}); return
        if not EDITOR_CODE or not hmac.compare_digest(code.encode("utf-8"), EDITOR_CODE.encode("utf-8")):
            rate_add(ukey); rate_add(ikey)
            self._json(400, {"error": "编辑码不太对哦，请再核对一下～"}); return
        self._set_user_cols(ident, edit_role="scribe")
        self._json(200, {"ok": True, "group_qq": GROUP_QQ, "msg": "验证成功，你已成为编辑！"})

    def _api_honor_claim(self):
        ident = self._require_ident()
        if not ident:
            return
        if ident["role"] in ("elder", "admin"):
            self._json(400, {"error": "你已是长老/管理员，无需再选择荣誉头衔"}); return
        body = self._read_json() or {}
        honor = body.get("honor")
        if honor not in ("elder_honor", "yaowang"):
            self._json(400, {"error": "参数错误"}); return
        cur = self._get_honor(ident)
        if cur["honor_pending"]:
            self._json(409, {"error": "你已有一份待审核的妖王申请，请耐心等待"}); return
        if honor == "elder_honor":
            self._set_user_cols(ident, honor_kind="elder_honor", honor_alias="", honor_reason="")
            self._json(200, {"ok": True, "status": "approved", "honor": honor, "remind_group": True,
                             "group_qq": GROUP_QQ, "msg": "已成为荣誉长老"}); return
        reason = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(body.get("reason") or "")).strip()[:300]
        alias = re.sub(r"[\x00-\x1f<>\"'&]", "", str(body.get("alias") or "")).strip()[:8]
        if not reason:
            self._json(400, {"error": "请写下你为什么是妖王～"}); return
        if len(reason) > YAOWANG_AUTO_MIN_CHARS:
            self._set_user_cols(ident, honor_kind="yaowang", honor_alias=alias, honor_reason=reason)
            self._json(200, {"ok": True, "status": "approved", "honor": honor, "alias": alias, "remind_group": True,
                             "group_qq": GROUP_QQ, "msg": "妖王加冕成功"}); return
        with DB_LOCK:
            conn = db()
            conn.execute("INSERT INTO honor_requests (kind, uid, name, honor_kind, alias, reason, status, created_at) "
                         "VALUES (?,?,?,?,?,?, 'pending', ?)",
                         (ident["kind"], ident["uid"], ident["nickname"], "yaowang", alias, reason, now_iso()))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True, "status": "pending", "honor": honor, "remind_group": False,
                         "msg": "自述不足 50 字，已提交馆长审核"})

    def _api_admin_honor_requests(self):
        if not self._require_admin():
            return
        conn = db()
        rows = [dict(r) for r in conn.execute(
            "SELECT id, kind, uid, name, honor_kind, alias, reason, created_at FROM honor_requests "
            "WHERE status='pending' ORDER BY id")]
        conn.close()
        self._json(200, {"requests": rows})

    def _api_admin_honor_decide(self):
        if not self._require_admin():
            return
        body = self._read_json()
        if body is None:
            return
        approve = bool(body.get("approve"))
        with DB_LOCK:
            conn = db()
            row = conn.execute("SELECT * FROM honor_requests WHERE id=? AND status='pending'", (body.get("id"),)).fetchone()
            conn.close()
        if not row:
            self._json(404, {"error": "申请不存在或已处理"}); return
        if approve:
            self._set_user_cols({"kind": row["kind"], "uid": row["uid"]}, honor_kind=row["honor_kind"],
                                honor_alias=row["alias"] or "", honor_reason=row["reason"] or "")
        with DB_LOCK:
            conn = db()
            conn.execute("UPDATE honor_requests SET status=? WHERE id=?", ("approved" if approve else "rejected", row["id"]))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True})

    # ---------- 官方角色同人图廊 ----------
    FANART_MAX_PER_USER_CHAR = 20

    def _can_moderate(self, ident):
        return bool(ident) and self._get_edit_role(ident) in ("scribe", "admin")

    def _fanart_item(self, r, ident, moderator):
        mine = bool(ident) and r["user_kind"] == ident["kind"] and r["user_uid"] == str(ident["uid"])
        return {"id": r["id"], "volume": "official_fanart", "image_url": r["image_url"], "caption": r["caption"] or "",
                "user_name": r["user_name"] or "匿名", "created_at": r["created_at"],
                "likes": r["likes"], "liked": bool(r["liked"]), "up": r["up"], "down": r["down"],
                "my_vote": r["my_vote"] or 0, "score": r["score"],
                "comments": r["comments"], "sub_comments": r["sub_comments"],
                "mine": mine, "can_delete": mine or moderator}

    def _api_fanart_list(self, qs):
        try:
            cid = int((qs.get("cid") or ["0"])[0])
            limit = max(1, min(30, int((qs.get("limit") or ["12"])[0])))
            offset = max(0, int((qs.get("offset") or ["0"])[0]))
        except ValueError:
            self._json(400, {"error": "参数错误"}); return
        # 默认最新在前（主册角色页）；sort=popular 时按 点赞+喜欢-踩×2、同分新上传在前（副册）
        order = "score DESC, f.id DESC" if (qs.get("sort") or [""])[0] == "popular" else "f.id DESC"
        ident = self._require_ident_optional()
        k, u = (ident["kind"], str(ident["uid"])) if ident else ("", "")
        moderator = self._can_moderate(ident)
        conn = db()
        total = conn.execute("SELECT COUNT(*) c FROM official_fanart WHERE character_id=?", (cid,)).fetchone()["c"]
        rows = conn.execute(f"""
            SELECT f.*,
              (SELECT COUNT(*) FROM official_fanart_likes l WHERE l.fanart_id=f.id) AS likes,
              (SELECT COUNT(*) FROM official_fanart_votes v WHERE v.fanart_id=f.id AND v.vote=1) AS up,
              (SELECT COUNT(*) FROM official_fanart_votes v WHERE v.fanart_id=f.id AND v.vote=-1) AS down,
              {fanart_score_sql("f")} AS score,
              (SELECT COUNT(*) FROM official_fanart_comments c WHERE c.fanart_id=f.id) AS comments,
              (SELECT COUNT(*) FROM official_fanart_sub_comments c WHERE c.fanart_id=f.id) AS sub_comments,
              (SELECT COUNT(*) FROM official_fanart_likes l WHERE l.fanart_id=f.id AND l.user_kind=? AND l.user_uid=?) AS liked,
              (SELECT vote FROM official_fanart_votes v WHERE v.fanart_id=f.id AND v.user_kind=? AND v.user_uid=?) AS my_vote
            FROM official_fanart f WHERE f.character_id=? ORDER BY {order} LIMIT ? OFFSET ?""",
            (k, u, k, u, cid, limit, offset)).fetchall()
        conn.close()
        self._json(200, {"total": total, "items": [self._fanart_item(r, ident, moderator) for r in rows]})

    def _api_fanart_summary(self, qs):
        """副册角色格：每个官方角色的同人图张数 + 封面（得分最高、同分最新的一张）。"""
        try:
            cids = [int(x) for x in (qs.get("cids") or [""])[0].split(",") if x.strip()][:60]
        except ValueError:
            self._json(400, {"error": "参数错误"}); return
        out = {}
        if cids:
            marks = ",".join("?" * len(cids))
            conn = db()
            for r in conn.execute(f"""
                SELECT character_id, COUNT(*) AS n,
                  (SELECT f2.image_url FROM official_fanart f2 WHERE f2.character_id=f.character_id
                   ORDER BY {fanart_score_sql("f2")} DESC, f2.id DESC LIMIT 1) AS cover
                FROM official_fanart f WHERE character_id IN ({marks}) GROUP BY character_id""", cids):
                out[str(r["character_id"])] = {"count": r["n"], "cover": r["cover"]}
            conn.close()
        self._json(200, {"summary": out})

    def _api_fanart_upload(self):
        body = self._read_image_form(gif_limit=IMAGE_LIMIT)  # 同人图（含动图）统一 ≤8MB
        if body is None:
            return
        ident = self._require_ident()
        if not ident:
            return
        image = body.pop("_image_file", None)
        try:
            cid = int(body.get("character_id"))
        except (TypeError, ValueError):
            cid = 0
        if not image or cid <= 0:
            self._json(400, {"error": "缺少图片或角色参数"}); return
        rkey = f"fanart:{ident['kind']}:{ident['uid']}"
        if rate_blocked(rkey, 10, 3600):
            self._json(429, {"error": "一小时内最多投稿 10 张图，稍后再来吧～"}); return
        vconn = wv()
        ch = vconn.execute("SELECT id FROM characters WHERE id=? AND (merged_to IS NULL OR merged_to='')", (cid,)).fetchone()
        vconn.close()
        if not ch:
            self._json(400, {"error": "角色不存在或已合并"}); return
        caption = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(body.get("caption") or "")).strip()[:100]
        with DB_LOCK:
            conn = db()
            n = conn.execute("SELECT COUNT(*) c FROM official_fanart WHERE character_id=? AND user_kind=? AND user_uid=?",
                             (cid, ident["kind"], str(ident["uid"]))).fetchone()["c"]
            if n >= self.FANART_MAX_PER_USER_CHAR:
                conn.close()
                self._json(400, {"error": f"同一角色最多投稿 {self.FANART_MAX_PER_USER_CHAR} 张图"}); return
            url = store_image(*image)
            cur = conn.execute("INSERT INTO official_fanart (character_id, user_kind, user_uid, user_name, image_url, caption, created_at) "
                               "VALUES (?,?,?,?,?,?,?)",
                               (cid, ident["kind"], str(ident["uid"]), ident.get("nickname") or ident.get("username") or "", url, caption, now_iso()))
            fid = cur.lastrowid
            conn.commit()
            conn.close()
        rate_add(rkey)
        self._json(200, {"ok": True, "id": fid, "image_url": url})

    def _api_fanart_delete(self):
        ident = self._require_ident()
        if not ident:
            return
        body = self._read_json() or {}
        moderator = self._can_moderate(ident)  # 内部会取 DB_LOCK（非可重入），必须在持锁前算好
        with DB_LOCK:
            conn = db()
            row = conn.execute("SELECT * FROM official_fanart WHERE id=?", (body.get("id"),)).fetchone()
            if not row:
                conn.close(); self._json(404, {"error": "图片不存在"}); return
            mine = row["user_kind"] == ident["kind"] and row["user_uid"] == str(ident["uid"])
            if not (mine or moderator):
                conn.close(); self._json(403, {"error": "只能删除自己的投稿"}); return
            for table in (*FANART_COMMENT_TABLES.values(), "official_fanart_likes", "official_fanart_votes"):
                conn.execute(f"DELETE FROM {table} WHERE fanart_id=?", (row["id"],))
            conn.execute("DELETE FROM official_fanart WHERE id=?", (row["id"],))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True})

    def _api_fanart_like(self):
        ident = self._require_ident()
        if not ident:
            return
        rkey = f"react:{ident['kind']}:{ident['uid']}"
        if rate_blocked(rkey, 60, 60):
            self._json(429, {"error": "操作太快了，歇一会儿再点吧"}); return
        rate_add(rkey)
        body = self._read_json() or {}
        k, u = ident["kind"], str(ident["uid"])
        with DB_LOCK:
            conn = db()
            row = conn.execute("SELECT id FROM official_fanart WHERE id=?", (body.get("id"),)).fetchone()
            if not row:
                conn.close(); self._json(404, {"error": "图片不存在"}); return
            fid = row["id"]
            had = conn.execute("SELECT 1 FROM official_fanart_likes WHERE fanart_id=? AND user_kind=? AND user_uid=?", (fid, k, u)).fetchone()
            if had:
                conn.execute("DELETE FROM official_fanart_likes WHERE fanart_id=? AND user_kind=? AND user_uid=?", (fid, k, u))
            else:
                conn.execute("INSERT INTO official_fanart_likes (fanart_id, user_kind, user_uid, created_at) VALUES (?,?,?,?)", (fid, k, u, now_iso()))
            conn.commit()
            likes = conn.execute("SELECT COUNT(*) c FROM official_fanart_likes WHERE fanart_id=?", (fid,)).fetchone()["c"]
            conn.close()
        self._json(200, {"ok": True, "liked": not had, "likes": likes})

    @staticmethod
    def _fanart_state(conn, fid, k, u):
        likes = conn.execute("SELECT COUNT(*) c FROM official_fanart_likes WHERE fanart_id=?", (fid,)).fetchone()["c"]
        up = conn.execute("SELECT COUNT(*) c FROM official_fanart_votes WHERE fanart_id=? AND vote=1", (fid,)).fetchone()["c"]
        down = conn.execute("SELECT COUNT(*) c FROM official_fanart_votes WHERE fanart_id=? AND vote=-1", (fid,)).fetchone()["c"]
        liked = conn.execute("SELECT 1 FROM official_fanart_likes WHERE fanart_id=? AND user_kind=? AND user_uid=?", (fid, k, u)).fetchone()
        mine = conn.execute("SELECT vote FROM official_fanart_votes WHERE fanart_id=? AND user_kind=? AND user_uid=?", (fid, k, u)).fetchone()
        return {"id": fid, "likes": likes, "liked": bool(liked), "up": up, "down": down,
                "my_vote": mine["vote"] if mine else 0, "score": likes + up - 2 * down}

    def _api_fanart_react(self):
        """喜欢（每张图可各点一次，可取消）与 点赞 / 踩（可取消 / 互换）。"""
        ident = self._require_ident()
        if not ident:
            return
        rkey = f"react:{ident['kind']}:{ident['uid']}"
        if rate_blocked(rkey, 60, 60):
            self._json(429, {"error": "操作太快了，歇一会儿再点吧"}); return
        rate_add(rkey)
        body = self._read_json() or {}
        rtype = body.get("type")
        if rtype not in ("fav", "up", "down"):
            self._json(400, {"error": "参数错误"}); return
        k, u = ident["kind"], str(ident["uid"])
        with DB_LOCK:
            conn = db()
            row = conn.execute("SELECT id FROM official_fanart WHERE id=?", (body.get("id"),)).fetchone()
            if not row:
                conn.close(); self._json(404, {"error": "图片不存在"}); return
            fid = row["id"]
            if rtype == "fav":
                if conn.execute("SELECT 1 FROM official_fanart_likes WHERE fanart_id=? AND user_kind=? AND user_uid=?", (fid, k, u)).fetchone():
                    conn.execute("DELETE FROM official_fanart_likes WHERE fanart_id=? AND user_kind=? AND user_uid=?", (fid, k, u))
                else:
                    conn.execute("INSERT INTO official_fanart_likes (fanart_id, user_kind, user_uid, created_at) VALUES (?,?,?,?)", (fid, k, u, now_iso()))
            else:
                vote = 1 if rtype == "up" else -1
                ex = conn.execute("SELECT vote FROM official_fanart_votes WHERE fanart_id=? AND user_kind=? AND user_uid=?", (fid, k, u)).fetchone()
                if ex and ex["vote"] == vote:
                    conn.execute("DELETE FROM official_fanart_votes WHERE fanart_id=? AND user_kind=? AND user_uid=?", (fid, k, u))
                else:
                    conn.execute("INSERT INTO official_fanart_votes (fanart_id, user_kind, user_uid, vote, created_at) VALUES (?,?,?,?,?) "
                                 "ON CONFLICT(fanart_id, user_kind, user_uid) DO UPDATE SET vote=excluded.vote, created_at=excluded.created_at",
                                 (fid, k, u, vote, now_iso()))
            conn.commit()
            state = self._fanart_state(conn, fid, k, u)
            conn.close()
        self._json(200, {"ok": True, "state": state})

    def _fanart_thread(self, value):
        """评论语境：main（主册角色页，默认）/ sub（副册）。未知值返回 None。"""
        return FANART_COMMENT_TABLES.get(value or "main")

    def _api_fanart_comments(self, qs):
        try:
            fid = int((qs.get("id") or ["0"])[0])
        except ValueError:
            self._json(400, {"error": "参数错误"}); return
        table = self._fanart_thread((qs.get("thread") or ["main"])[0])
        if not table:
            self._json(400, {"error": "参数错误"}); return
        ident = self._require_ident_optional()
        moderator = self._can_moderate(ident)
        conn = db()
        rows = conn.execute(f"SELECT * FROM {table} WHERE fanart_id=? ORDER BY id DESC LIMIT 100", (fid,)).fetchall()
        conn.close()
        out = []
        for r in rows:
            mine = bool(ident) and r["user_kind"] == ident["kind"] and r["user_uid"] == str(ident["uid"])
            out.append({"id": r["id"], "user_name": r["user_name"] or "匿名", "content": r["content"],
                        "created_at": r["created_at"], "mine": mine, "can_delete": mine or moderator})
        self._json(200, {"comments": out})

    def _api_fanart_comment(self):
        ident = self._require_ident()
        if not ident:
            return
        body = self._read_json() or {}
        content = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(body.get("content") or "")).strip()
        if not content or len(content) > 300:
            self._json(400, {"error": "评论需为 1–300 字"}); return
        table = self._fanart_thread(body.get("thread"))
        if not table:
            self._json(400, {"error": "参数错误"}); return
        rkey = f"fcmt:{ident['kind']}:{ident['uid']}"
        if rate_blocked(rkey, 15, 600):
            self._json(429, {"error": "评论太频繁啦，稍后再来～"}); return
        with DB_LOCK:
            conn = db()
            row = conn.execute("SELECT id FROM official_fanart WHERE id=?", (body.get("id"),)).fetchone()
            if not row:
                conn.close(); self._json(404, {"error": "图片不存在"}); return
            cur = conn.execute(f"INSERT INTO {table} (fanart_id, user_kind, user_uid, user_name, content, created_at) VALUES (?,?,?,?,?,?)",
                               (row["id"], ident["kind"], str(ident["uid"]), ident.get("nickname") or ident.get("username") or "", content, now_iso()))
            cid_new = cur.lastrowid
            count = conn.execute(f"SELECT COUNT(*) c FROM {table} WHERE fanart_id=?", (row["id"],)).fetchone()["c"]
            conn.commit()
            conn.close()
        rate_add(rkey)
        self._json(200, {"ok": True, "id": cid_new, "count": count})

    def _api_fanart_comment_delete(self):
        ident = self._require_ident()
        if not ident:
            return
        body = self._read_json() or {}
        table = self._fanart_thread(body.get("thread"))
        if not table:
            self._json(400, {"error": "参数错误"}); return
        moderator = self._can_moderate(ident)  # 同上：先算再持锁
        with DB_LOCK:
            conn = db()
            row = conn.execute(f"SELECT * FROM {table} WHERE id=?", (body.get("id"),)).fetchone()
            if not row:
                conn.close(); self._json(404, {"error": "评论不存在"}); return
            mine = row["user_kind"] == ident["kind"] and row["user_uid"] == str(ident["uid"])
            if not (mine or moderator):
                conn.close(); self._json(403, {"error": "只能删除自己的评论"}); return
            conn.execute(f"DELETE FROM {table} WHERE id=?", (row["id"],))
            count = conn.execute(f"SELECT COUNT(*) c FROM {table} WHERE fanart_id=?", (row["fanart_id"],)).fetchone()["c"]
            conn.commit()
            conn.close()
        self._json(200, {"ok": True, "count": count})

    # ---------- 维基编辑系统 ----------
    def _get_edit_role(self, ident):
        """返回 edit_role: 'none' / 'scribe'(编辑) / 'admin'。管理员/长老默认有编辑权。"""
        if ident.get("is_admin"):
            return "admin"
        if ident.get("role") == "elder":
            return "scribe"
        with DB_LOCK:
            conn = db()
            if ident["kind"] == "local":
                row = conn.execute("SELECT edit_role FROM local_users WHERE uid=?", (ident["uid"],)).fetchone()
                er = (row["edit_role"] if row else "none")
            else:
                row = conn.execute("SELECT edit_role FROM user_flags WHERE kind='usso' AND uid=?", (ident["uid"],)).fetchone()
                er = (row["edit_role"] if row else "none")
            conn.close()
        return er or "none"

    def _get_exempts(self, ident):
        """返回豁免权限 {exempt_age, exempt_skill}（0/1）"""
        with DB_LOCK:
            conn = db()
            if ident["kind"] == "local":
                row = conn.execute("SELECT exempt_age, exempt_skill FROM local_users WHERE uid=?", (ident["uid"],)).fetchone()
            else:
                row = conn.execute("SELECT exempt_age, exempt_skill FROM user_flags WHERE kind='usso' AND uid=?", (ident["uid"],)).fetchone()
            conn.close()
        if not row:
            return {"exempt_age": 0, "exempt_skill": 0}
        return {"exempt_age": row["exempt_age"] or 0, "exempt_skill": row["exempt_skill"] or 0}

    # ---------- 账户等级：account_progress（积分按 0.1 记账；第 n 级累计 n(n+1)/2 分） ----------
    def _level_fields(self, ident):
        conn = account_progress.open_db(DATA_ROOT)
        try:
            info = account_progress.level_info(account_progress.get_points_x10(conn, ident["kind"], ident["uid"]))
        finally:
            conn.close()
        return {"points": info["points"], "level": info["level"],
                "level_floor": info["level_floor"], "next_level_at": info["next_level_at"]}

    def _api_submit_supplement(self):
        ident = self._require_ident()
        if not ident:
            return
        body = self._read_json()
        if body is None:
            return
        cid = body.get("character_id")
        field = (body.get("field_name") or "").strip()
        new_val = (body.get("new_value") or "").strip()
        if not cid or not field or not new_val:
            self._json(400, {"error": "缺少角色 ID / 字段名 / 新值"}); return
        # 安全校验字段名（白名单 + 只允许字母数字下划线）
        import re as _re_sup
        if not _re_sup.match(r'^[a-z_]+$', field):
            self._json(400, {"error": "字段名无效"}); return
        _SUPPLEMENT_FIELDS = {'personality','appearance','affiliation','age','story_summary','abilities_summary','master','height','eye_color','hair_color','residence','birthday','notes','aliases','species','gender','original_form','voice_actor','type'}
        if field not in _SUPPLEMENT_FIELDS:
            self._json(400, {"error": "该字段不可补充"}); return
        # 读旧值
        wconn = wv()
        ch = wconn.execute("SELECT name, {} FROM characters WHERE id=?".format(field), (cid,)).fetchone()
        wconn.close()
        if not ch:
            self._json(404, {"error": "角色不存在或字段名无效"}); return
        with DB_LOCK:
            conn = db()
            conn.execute("INSERT INTO supplements (character_id, character_name, user_kind, user_uid, user_name, field_name, old_value, new_value, contribution_type, status, message) VALUES (?,?,?,?,?,?,?,?, 'field_edit','pending', ?)",
                (cid, ch["name"], ident["kind"], ident["uid"], ident.get("nickname") or ident.get("username") or "",
                 field, ch[field] if ch[field] else "", new_val, body.get("message", "")))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True, "msg": "补充已提交，等待审核"})

    def _api_scribe_edit(self):
        ident = self._require_ident()
        if not ident:
            return
        er = self._get_edit_role(ident)
        if er not in ("scribe", "admin"):
            self._json(403, {"error": "需要文书权限"}); return
        body = self._read_json()
        if body is None:
            return
        cid = body.get("character_id")
        field = (body.get("field_name") or "").strip()
        new_val = (body.get("new_value") or "").strip()
        if not cid or not field or not new_val:
            self._json(400, {"error": "缺少角色 ID / 字段名 / 新值"}); return
        # 安全校验字段名（只允许字母数字下划线）
        import re
        if not re.match(r'^[a-z_]+$', field):
            self._json(400, {"error": "字段名无效"}); return
        ALLOWED = {'personality','appearance','affiliation','age','story_summary','abilities_summary','master','height','eye_color','hair_color','residence','birthday','notes','aliases','species','gender','original_form','voice_actor','type'}
        if field not in ALLOWED and field not in ('abilities','relations'):
            self._json(400, {"error": "该字段不可编辑"}); return
        # 能力列表：改写 character_abilities_ext
        if field == 'abilities':
            w2 = _worldview_connection(); w2.row_factory = sqlite3.Row
            cname = w2.execute("SELECT name FROM characters WHERE id=?", (cid,)).fetchone()
            if not cname:
                w2.close(); self._json(404, {"error": "角色不存在"}); return
            old_abilities = '；'.join(r['ability'] for r in w2.execute("SELECT ability FROM character_abilities_ext WHERE character_id=? ORDER BY id", (cid,)))
            w2.execute("DELETE FROM character_abilities_ext WHERE character_id=?", (cid,))
            for a in re.split(r'[、；;，,\n]+', new_val):
                a = a.strip()
                if a:
                    w2.execute("INSERT INTO character_abilities_ext (character_id, ability, description, source_page) VALUES (?,?,?,?)", (cid, a, '', 'wiki'))
            w2.commit(); w2.close()
            uname = ident.get("nickname") or ident.get("username") or ""
            with DB_LOCK:
                conn = db()
                conn.execute("INSERT INTO field_history (character_id, character_name, field_name, old_value, new_value, edited_by_kind, edited_by_uid, edited_by_name, edit_type) VALUES (?,?,?,?,?,?,?,?, 'direct')",
                    (cid, cname['name'], 'abilities', old_abilities, new_val, ident["kind"], ident["uid"], uname))
                conn.commit(); conn.close()
            self._json(200, {"ok": True, "msg": "能力已更新并记录版本历史"})
            return
        # 人物关系：改写 character_relations_ext（每行一条：关系类型：对象：描述）
        if field == 'relations':
            w2 = _worldview_connection(); w2.row_factory = sqlite3.Row
            cname = w2.execute("SELECT name FROM characters WHERE id=?", (cid,)).fetchone()
            if not cname:
                w2.close(); self._json(404, {"error": "角色不存在"}); return
            old_rel = '；'.join(f"{r['relation_type']}·{r['related_name']}" for r in w2.execute("SELECT relation_type, related_name FROM character_relations_ext WHERE character_id=? ORDER BY id", (cid,)))
            w2.execute("DELETE FROM character_relations_ext WHERE character_id=?", (cid,))
            for line in re.split(r'[\n;；]+', new_val):
                line = line.strip()
                if not line: continue
                parts = re.split(r'[:：]', line, 2)
                rtype = parts[0].strip() if len(parts) > 0 else ''
                rname = parts[1].strip() if len(parts) > 1 else ''
                rdesc = parts[2].strip() if len(parts) > 2 else ''
                if rname:
                    w2.execute("INSERT INTO character_relations_ext (character_id, related_name, relation_type, relation_desc, source_page) VALUES (?,?,?,?,?)", (cid, rname, rtype, rdesc, 'wiki'))
            w2.commit(); w2.close()
            uname = ident.get("nickname") or ident.get("username") or ""
            with DB_LOCK:
                conn = db()
                conn.execute("INSERT INTO field_history (character_id, character_name, field_name, old_value, new_value, edited_by_kind, edited_by_uid, edited_by_name, edit_type) VALUES (?,?,?,?,?,?,?,?, 'direct')",
                    (cid, cname['name'], 'relations', old_rel, new_val, ident["kind"], ident["uid"], uname))
                conn.commit(); conn.close()
            self._json(200, {"ok": True, "msg": "人物关系已更新并记录版本历史"})
            return
        wconn = wv()
        ch = wconn.execute("SELECT name, {} FROM characters WHERE id=?".format(field), (cid,)).fetchone()
        if not ch:
            wconn.close(); self._json(404, {"error": "角色不存在"}); return
        old_val = ch[field] if ch[field] else ""
        # 写回库
        wconn.execute("UPDATE characters SET {}=? WHERE id=?".format(field), (new_val, cid))
        wconn.commit()
        wconn.close()
        # 存版本历史
        uname = ident.get("nickname") or ident.get("username") or ""
        with DB_LOCK:
            conn = db()
            conn.execute("INSERT INTO field_history (character_id, character_name, field_name, old_value, new_value, edited_by_kind, edited_by_uid, edited_by_name, edit_type) VALUES (?,?,?,?,?,?,?,?, 'direct')",
                (cid, ch["name"], field, old_val, new_val, ident["kind"], ident["uid"], uname))
            conn.execute("INSERT INTO contributions (character_id, user_kind, user_uid, user_name, contribution_type, field_name) VALUES (?,?,?,?, 'field_edit', ?)",
                (cid, ident["kind"], ident["uid"], uname, field))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True, "msg": "已直接修改并记录版本历史"})

    def _api_official_merge(self):
        ident = self._require_ident()
        if not ident:
            return
        er = self._get_edit_role(ident)
        if er not in ("scribe", "admin"):
            self._json(403, {"error": "需要编辑权限"}); return
        body = self._read_json()
        if body is None:
            return
        keep_id = body.get("keep_id")
        remove_id = body.get("remove_id")
        if not keep_id or not remove_id or str(keep_id) == str(remove_id):
            self._json(400, {"error": "请选择两个不同的角色"}); return
        wconn = wv()
        cols = [r[1] for r in wconn.execute("PRAGMA table_info(characters)")]
        keep = wconn.execute("SELECT * FROM characters WHERE id=?", (keep_id,)).fetchone()
        rem = wconn.execute("SELECT * FROM characters WHERE id=?", (remove_id,)).fetchone()
        if not keep or not rem:
            wconn.close(); self._json(404, {"error": "角色不存在"}); return
        try:
            # 补全空字段
            upd = {c: rem[c] for c in cols if c not in ("id", "name", "aliases") and (not keep[c]) and rem[c]}
            # 别名吸收：被合并角色的名字与别名并入保留角色
            keep_al = (keep["aliases"] or "").strip()
            al_parts = [x.strip() for x in keep_al.replace("、", ",").replace("，", ",").split(",") if x.strip()]
            for nm in [rem["name"]] + [x.strip() for x in (rem["aliases"] or "").replace("、", ",").replace("，", ",").split(",") if x.strip()]:
                if nm and nm != keep["name"] and nm not in al_parts:
                    al_parts.append(nm)
            if al_parts != ([x for x in keep_al.replace("、", ",").replace("，", ",").split(",") if x.strip()] if keep_al else []):
                upd["aliases"] = "、".join(al_parts)
            if upd:
                wconn.execute("UPDATE characters SET " + ",".join(f"{k}=?" for k in upd) + " WHERE id=?",
                              list(upd.values()) + [keep_id])
            # 图片去重后迁移
            keep_paths = {r[0] for r in wconn.execute("SELECT image_path FROM character_images WHERE character_id=?", (keep_id,))}
            wconn.execute("DELETE FROM character_images WHERE character_id=? AND image_path IN (%s)" % ",".join("?" * len(keep_paths)) if keep_paths else "DELETE FROM character_images WHERE 0",
                          list(keep_paths) if keep_paths else [])
            wconn.execute("DELETE FROM character_images WHERE character_id=? AND image_path IN (SELECT image_path FROM characters_x_images_never)", ()) if False else None
            for tbl in ("character_abilities_ext", "character_relations_ext", "character_images", "character_events"):
                wconn.execute(f"UPDATE {tbl} SET character_id=? WHERE character_id=?", (keep_id, remove_id))
            wconn.execute("UPDATE character_relations_ext SET related_character_id=? WHERE related_character_id=?", (keep_id, remove_id))
            # 反应(收藏/赞踩)迁移，先删同用户冲突行
            for tbl in ("char_favorites", "char_votes"):
                wconn.execute(f"DELETE FROM {tbl} WHERE character_id=? AND (user_kind,user_uid) IN (SELECT user_kind,user_uid FROM {tbl} WHERE character_id=?)", (remove_id, keep_id))
                wconn.execute(f"UPDATE {tbl} SET character_id=? WHERE character_id=?", (keep_id, remove_id))
            # 删除被合并角色
            wconn.execute("DELETE FROM characters WHERE id=?", (remove_id,))
            wconn.commit()
        except Exception as ex:
            wconn.rollback()
            wconn.close()
            self._json(500, {"error": "合并失败：" + str(ex)}); return
        wconn.close()
        uname = ident.get("nickname") or ident.get("username") or ""
        with DB_LOCK:
            conn = db()
            conn.execute("INSERT INTO field_history (character_id, character_name, field_name, old_value, new_value, edited_by_kind, edited_by_uid, edited_by_name, edit_type) VALUES (?,?,?,?,?,?,?,?, 'direct')",
                (keep_id, keep["name"], "_merge", rem["name"], f"合并角色「{rem['name']}」(id={remove_id})，补全{len(upd)}个字段", ident["kind"], ident["uid"], uname))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True, "msg": f"已把「{rem['name']}」合并进「{keep['name']}」，补全 {len(upd)} 个字段"})

    def _api_scribe_apply(self):
        ident = self._require_ident()
        if not ident:
            return
        body = self._read_json()
        if body is None:
            return
        msg = (body.get("message") or "").strip()
        with DB_LOCK:
            conn = db()
            existing = conn.execute("SELECT id FROM executor_requests WHERE user_kind=? AND user_uid=? AND status='pending'", (ident["kind"], ident["uid"])).fetchone()
            if existing:
                conn.close(); self._json(409, {"error": "你已有一份待审申请"}); return
            conn.execute("INSERT INTO executor_requests (user_kind, user_uid, user_name, message) VALUES (?,?,?,?)",
                (ident["kind"], ident["uid"], ident.get("nickname") or ident.get("username") or "", msg))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True, "msg": "文书申请已提交"})

    def _require_edit(self):
        ident = self._require_ident()
        if not ident:
            return None
        if self._get_edit_role(ident) not in ("scribe", "admin"):
            self._json(403, {"error": "需要编辑（文书）或管理员权限"}); return None
        return ident

    def _api_official_image_add(self):
        body = self._read_image_form()
        if body is None:
            return
        ident = self._require_edit()
        if not ident:
            return
        cid = body.get("character_id")
        filename = (body.get("filename") or "").strip()
        data = body.get("data") or ""
        image_file = body.pop("_image_file", None)
        itype = (body.get("image_type") or "wiki").strip()[:32] or "wiki"
        if not cid or not (data or image_file):
            self._json(400, {"error": "缺少角色 ID 或图片数据"}); return
        # 解析 base64
        try:
            if image_file:
                raw, mime = image_file
            else:
                header, b64 = data.split(",", 1)
                raw, mime = validate_image(base64.b64decode(b64, validate=True), header.split(":")[1].split(";")[0].strip().lower())
            ext = _DATAURI_EXT[mime]
        except Exception:
            self._json(400, {"error": "图片数据无效"}); return
        if mime == "image/gif" and len(raw) > 5 * 1024 * 1024:
            self._json(400, {"error": "动图需≤5MB"}); return
        if mime != "image/gif" and len(raw) > 8 * 1024 * 1024:
            self._json(400, {"error": "图片过大（≤8MB）"}); return
        import re as _re, time as _time
        safe = _re.sub(r"[^A-Za-z0-9_\-.一-鿿]", "_", os.path.splitext(filename)[0])[:40] or "img"
        name = f"char{cid}_{int(_time.time())}_{safe}{ext}"
        path = os.path.join(WV_IMG_DIR, name)
        try:
            with open(path, "wb") as f:
                f.write(raw)
        except Exception:
            self._json(500, {"error": "保存图片失败"}); return
        # 写入 character_images（世界观库可写）
        w = _worldview_connection()
        cur = w.execute("INSERT INTO character_images (character_id, image_path, image_type, description, created_at) VALUES (?,?,?,?,datetime('now'))",
                        (cid, path, itype, filename))
        new_id = cur.lastrowid
        w.commit(); w.close()
        # 清除相关缓存，确保画廊等页面不再返回旧数据
        with _WV_CACHE_LOCK:
            _WV_CACHE["data"].pop(("char", str(cid)), None)
            _WV_CACHE["data"].pop(("graph",), None)
            _WV_CACHE["data"].pop(("stickers",), None)
            keys_to_del = [k for k in _WV_CACHE["data"] if isinstance(k, tuple) and len(k) > 0 and k[0] == "list"]
            for k in keys_to_del:
                del _WV_CACHE["data"][k]
        self._json(200, {"ok": True, "msg": "图片已添加", "image_id": new_id})

    def _api_official_sticker_upload(self):
        body = self._read_image_form()
        if body is None:
            return
        ident = self._require_ident()
        if not ident:
            return
        cid_raw = body.get("character_id")
        filename = (body.get("filename") or "").strip()
        desc = (body.get("description") or "").strip() or filename
        data = body.get("data") or ""
        image_file = body.pop("_image_file", None)
        if not (data or image_file):
            self._json(400, {"error": "缺少图片数据"}); return
        # character_id：传空 = 站友投稿（character_images.character_id NOT NULL，用哨兵 0 表示无归属）
        cid = 0
        if cid_raw not in (None, "", 0, "0"):
            try:
                cid = int(cid_raw)
            except (TypeError, ValueError):
                self._json(400, {"error": "角色参数无效"}); return
            vconn = wv()
            ch = vconn.execute("SELECT id FROM characters WHERE id=? AND (merged_to IS NULL OR merged_to='')", (cid,)).fetchone()
            vconn.close()
            if not ch:
                self._json(400, {"error": "角色不存在或已合并"}); return
        # 解析 base64
        try:
            if image_file:
                raw, mime = image_file
            else:
                header, b64 = data.split(",", 1)
                raw, mime = validate_image(base64.b64decode(b64, validate=True), header.split(":")[1].split(";")[0].strip().lower())
            ext = _DATAURI_EXT[mime]
        except Exception:
            self._json(400, {"error": "图片数据无效"}); return
        if mime == "image/gif" and len(raw) > 5 * 1024 * 1024:
            self._json(400, {"error": "动图需≤5MB"}); return
        if mime != "image/gif" and len(raw) > 8 * 1024 * 1024:
            self._json(400, {"error": "图片过大（≤8MB）"}); return
        import re as _re, time as _time
        safe = _re.sub(r"[^A-Za-z0-9_\-.一-鿿]", "_", os.path.splitext(filename)[0])[:40] or "img"
        name = f"stk_{int(_time.time())}_{safe}{ext}"
        path = os.path.join(WV_IMG_DIR, name)
        try:
            with open(path, "wb") as f:
                f.write(raw)
        except Exception:
            self._json(500, {"error": "保存图片失败"}); return
        # 写入 character_images（image_type='sticker'）与 sticker_uploads 旁路表
        w = _worldview_connection()
        w.execute("CREATE TABLE IF NOT EXISTS sticker_uploads (id INTEGER PRIMARY KEY AUTOINCREMENT, image_id INTEGER NOT NULL UNIQUE, kind TEXT NOT NULL, uid TEXT NOT NULL, nickname TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime')))")
        cur = w.execute("INSERT INTO character_images (character_id, image_path, image_type, description, created_at) VALUES (?,?,?,?,datetime('now'))",
                        (cid, path, "sticker", desc[:200]))
        new_id = cur.lastrowid
        w.execute("INSERT INTO sticker_uploads (image_id, kind, uid, nickname) VALUES (?,?,?,?)",
                  (new_id, ident["kind"], ident["uid"], (ident.get("nickname") or "")))
        w.commit(); w.close()
        # 清除相关缓存，确保画廊等页面不再返回旧数据
        with _WV_CACHE_LOCK:
            _WV_CACHE["data"].pop(("stickers",), None)
            _WV_CACHE["data"].pop(("graph",), None)
            if cid:
                _WV_CACHE["data"].pop(("char", str(cid)), None)
            keys_to_del = [k for k in _WV_CACHE["data"] if isinstance(k, tuple) and len(k) > 0 and k[0] == "list"]
            for k in keys_to_del:
                del _WV_CACHE["data"][k]
        self._json(200, {"ok": True, "msg": "表情包已上传", "image_id": new_id})

    def _api_official_image_delete(self):
        ident = self._require_edit()
        if not ident:
            return
        body = self._read_json()
        if body is None:
            return
        img_id = body.get("image_id")
        cid = body.get("character_id")
        other = bool(body.get("other_character"))
        reason = (body.get("reason") or "").strip()
        if not img_id:
            self._json(400, {"error": "缺少图片 ID"}); return
        w = _worldview_connection()
        w.execute("CREATE TABLE IF NOT EXISTS unclassified_images (id INTEGER PRIMARY KEY AUTOINCREMENT, image_path TEXT, from_character_id INTEGER, reason TEXT, created_at TIMESTAMP)")
        ensure_sticker_table(w)
        if other:
            row = w.execute("SELECT image_path FROM character_images WHERE id=? AND character_id=?", (img_id, cid)).fetchone()
            if row:
                w.execute("INSERT INTO unclassified_images (image_path, from_character_id, reason, created_at) VALUES (?,?,?,datetime('now'))",
                          (row[0], cid, reason))
        w.execute("DELETE FROM character_images WHERE id=? AND character_id=?", (img_id, cid))
        w.execute("DELETE FROM sticker_uploads WHERE image_id=?", (img_id,))
        w.commit(); w.close()
        # 清除相关缓存，确保 gallery 等页面不再显示已删图片
        with _WV_CACHE_LOCK:
            _WV_CACHE["data"].pop(("char", str(cid)), None)
            _WV_CACHE["data"].pop(("graph",), None)
            _WV_CACHE["data"].pop(("stickers",), None)
            keys_to_del = [k for k in _WV_CACHE["data"] if isinstance(k, tuple) and len(k) > 0 and k[0] == "list"]
            for k in keys_to_del:
                del _WV_CACHE["data"][k]
        self._json(200, {"ok": True, "msg": "已移入未分类" if other else "图片已删除"})

    def _api_official_unclassified(self):
        w = _worldview_connection(); w.row_factory = sqlite3.Row
        try:
            rows = [dict(r) for r in w.execute("SELECT id, reason FROM unclassified_images ORDER BY id DESC")]
        except Exception:
            rows = []
        w.close()
        self._json(200, {"images": rows})

    def _api_official_unclassified_img(self, qs):
        self._send_public_image("/api/official/unclassified-img", qs)

    def _api_official_img_id(self, qs):
        self._send_public_image("/api/official/img-id", qs)

    def _api_official_image_reorder(self):
        ident = self._require_edit()
        if not ident:
            return
        body = self._read_json()
        if body is None:
            return
        cid = body.get("character_id")
        ordered = body.get("ordered_ids") or []
        if not cid or not ordered:
            self._json(400, {"error": "缺少参数"}); return
        w = _worldview_connection()
        for i, iid in enumerate(ordered):
            w.execute("UPDATE character_images SET sort_order=? WHERE id=? AND character_id=?", (i, iid, cid))
        w.commit(); w.close()
        # 清除相关缓存，确保画廊 / 表情包页顺序不再使用旧缓存
        with _WV_CACHE_LOCK:
            _WV_CACHE["data"].pop(("char", str(cid)), None)
            _WV_CACHE["data"].pop(("stickers",), None)
            keys_to_del = [k for k in _WV_CACHE["data"] if isinstance(k, tuple) and len(k) > 0 and k[0] == "list"]
            for k in keys_to_del:
                del _WV_CACHE["data"][k]
        self._json(200, {"ok": True})

    def _api_official_image_type(self):
        ident = self._require_edit()
        if not ident:
            return
        body = self._read_json()
        if body is None:
            return
        img_id = body.get("image_id")
        itype = (body.get("image_type") or "").strip()
        if not img_id:
            self._json(400, {"error": "缺少图片 ID"}); return
        if not itype:
            self._json(400, {"error": "缺少图片分类"}); return
        if len(itype) > 32:
            self._json(400, {"error": "分类名过长"}); return
        w = _worldview_connection()
        row = w.execute("SELECT character_id FROM character_images WHERE id=?", (img_id,)).fetchone()
        if not row:
            w.close()
            self._json(404, {"error": "图片不存在"}); return
        cid = row[0]
        w.execute("UPDATE character_images SET image_type=? WHERE id=?", (itype, img_id))
        w.commit(); w.close()
        # 清除相关缓存，确保画廊 / 表情包页不再使用旧分类数据
        with _WV_CACHE_LOCK:
            _WV_CACHE["data"].pop(("char", str(cid)), None)
            _WV_CACHE["data"].pop(("graph",), None)
            _WV_CACHE["data"].pop(("stickers",), None)
            keys_to_del = [k for k in _WV_CACHE["data"] if isinstance(k, tuple) and len(k) > 0 and k[0] == "list"]
            for k in keys_to_del:
                del _WV_CACHE["data"][k]
        self._json(200, {"ok": True, "msg": "分类已更新"})

    def _api_group_confirm(self):
        ident = self._require_ident()
        if not ident:
            return
        body = self._read_json() or {}
        gname = (body.get("group_nickname") or "").strip()
        if not gname:
            self._json(400, {"error": "请填写群昵称"}); return
        with DB_LOCK:
            conn = db()
            if ident["kind"] == "local":
                conn.execute("UPDATE local_users SET group_confirmed=1, group_nickname=? WHERE uid=?", (gname, ident["uid"]))
            else:
                conn.execute("""INSERT INTO user_flags (kind, uid, group_confirmed, group_nickname) VALUES ('usso',?,1,?)
                                ON CONFLICT(kind, uid) DO UPDATE SET group_confirmed=1, group_nickname=excluded.group_nickname""",
                             (ident["uid"], gname))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True})

    def _ensure_reaction_tables(self, w):
        w.execute("CREATE TABLE IF NOT EXISTS char_favorites (id INTEGER PRIMARY KEY AUTOINCREMENT, user_kind TEXT, user_uid TEXT, character_id INTEGER, created_at INTEGER, UNIQUE(user_kind, user_uid))")
        w.execute("CREATE TABLE IF NOT EXISTS char_votes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_kind TEXT, user_uid TEXT, character_id INTEGER, vote INTEGER, created_at INTEGER, UNIQUE(user_kind, user_uid, character_id))")

    def _api_official_reactions(self):
        w = _worldview_connection(); w.row_factory = sqlite3.Row
        self._ensure_reaction_tables(w)
        fav = {r['character_id']: r['c'] for r in w.execute("SELECT character_id, COUNT(*) c FROM char_favorites GROUP BY character_id")}
        up = {r['character_id']: r['c'] for r in w.execute("SELECT character_id, COUNT(*) c FROM char_votes WHERE vote=1 GROUP BY character_id")}
        down = {r['character_id']: r['c'] for r in w.execute("SELECT character_id, COUNT(*) c FROM char_votes WHERE vote=-1 GROUP BY character_id")}
        my = {"fav": None, "votes": {}}
        ident = self._require_ident_optional()
        if ident:
            f = w.execute("SELECT character_id FROM char_favorites WHERE user_kind=? AND user_uid=?", (ident["kind"], ident["uid"])).fetchone()
            if f: my["fav"] = f['character_id']
            for r in w.execute("SELECT character_id, vote FROM char_votes WHERE user_kind=? AND user_uid=?", (ident["kind"], ident["uid"])):
                my["votes"][str(r['character_id'])] = r['vote']
        w.close()
        self._json(200, {"fav": fav, "up": up, "down": down, "my": my})

    def _reaction_state(self, w, fav_t, vote_t, cid, ident, multi_fav=False):
        """单角色的最新计数 + 当前用户状态，前端据此就地更新，无需重拉全表。"""
        fav = w.execute(f"SELECT COUNT(*) c FROM {fav_t} WHERE character_id=?", (cid,)).fetchone()["c"]
        up = w.execute(f"SELECT COUNT(*) c FROM {vote_t} WHERE character_id=? AND vote=1", (cid,)).fetchone()["c"]
        down = w.execute(f"SELECT COUNT(*) c FROM {vote_t} WHERE character_id=? AND vote=-1", (cid,)).fetchone()["c"]
        myfav = w.execute(
            f"SELECT 1 FROM {fav_t} WHERE user_kind=? AND user_uid=? AND character_id=?" if multi_fav
            else f"SELECT character_id FROM {fav_t} WHERE user_kind=? AND user_uid=?",
            (ident["kind"], ident["uid"], cid) if multi_fav else (ident["kind"], ident["uid"])
        ).fetchone()
        myvote = w.execute(f"SELECT vote FROM {vote_t} WHERE user_kind=? AND user_uid=? AND character_id=?",
                           (ident["kind"], ident["uid"], cid)).fetchone()
        return {"cid": cid, "fav": fav, "up": up, "down": down,
                "my_fav": bool(myfav and (multi_fav or myfav["character_id"] == cid)),
                "my_vote": myvote["vote"] if myvote else 0}

    def _do_react(self, w, fav_t, vote_t, ident, allow_multiple_favorites=False):
        """喜欢（每人仅 1 个，可转移/取消）与赞踩（可取消/互换）的统一实现。"""
        body = self._read_json() or {}
        try:
            cid = int(body.get("character_id"))
        except (TypeError, ValueError):
            cid = 0
        rtype = body.get("type")
        if cid <= 0 or rtype not in ("fav", "up", "down"):
            w.close(); self._json(400, {"error": "参数错误"}); return
        now = int(time.time())
        k, u = ident["kind"], ident["uid"]
        prev_fav = None
        if rtype == "fav":
            if allow_multiple_favorites:
                row = w.execute(f"SELECT 1 FROM {fav_t} WHERE user_kind=? AND user_uid=? AND character_id=?", (k, u, cid)).fetchone()
                if row:
                    w.execute(f"DELETE FROM {fav_t} WHERE user_kind=? AND user_uid=? AND character_id=?", (k, u, cid))
                    msg = "已取消喜欢"
                else:
                    w.execute(f"INSERT INTO {fav_t} (user_kind, user_uid, character_id, created_at) VALUES (?,?,?,?)", (k, u, cid, now))
                    msg = "已喜欢该角色"
            else:
                row = w.execute(f"SELECT character_id FROM {fav_t} WHERE user_kind=? AND user_uid=?", (k, u)).fetchone()
                if row and row["character_id"] == cid:
                    w.execute(f"DELETE FROM {fav_t} WHERE user_kind=? AND user_uid=?", (k, u))
                    msg = "已取消喜欢"
                elif row:
                    prev_fav = row["character_id"]
                    w.execute(f"UPDATE {fav_t} SET character_id=?, created_at=? WHERE user_kind=? AND user_uid=?", (cid, now, k, u))
                    msg = "已转为喜欢该角色"
                else:
                    w.execute(f"INSERT INTO {fav_t} (user_kind, user_uid, character_id, created_at) VALUES (?,?,?,?)", (k, u, cid, now))
                    msg = "已喜欢该角色"
        else:
            vote = 1 if rtype == "up" else -1
            name = "点赞" if vote == 1 else "踩"
            ex = w.execute(f"SELECT vote FROM {vote_t} WHERE user_kind=? AND user_uid=? AND character_id=?", (k, u, cid)).fetchone()
            if ex and ex["vote"] == vote:
                w.execute(f"DELETE FROM {vote_t} WHERE user_kind=? AND user_uid=? AND character_id=?", (k, u, cid))
                msg = "已取消" + name
            elif ex:
                w.execute(f"UPDATE {vote_t} SET vote=?, created_at=? WHERE user_kind=? AND user_uid=? AND character_id=?", (vote, now, k, u, cid))
                msg = "已改为" + name
            else:
                w.execute(f"INSERT INTO {vote_t} (user_kind, user_uid, character_id, vote, created_at) VALUES (?,?,?,?,?)", (k, u, cid, vote, now))
                msg = "已" + name
        w.commit()
        state = self._reaction_state(w, fav_t, vote_t, cid, ident, allow_multiple_favorites)
        prev_state = self._reaction_state(w, fav_t, vote_t, prev_fav, ident) if prev_fav else None
        w.close()
        self._json(200, {"ok": True, "msg": msg, "state": state, "prev_state": prev_state})

    def _api_official_react(self):
        ident = self._require_ident()
        if not ident:
            return
        if rate_blocked(f"react:{ident['kind']}:{ident['uid']}", 60, 60):
            self._json(429, {"error": "操作太快了，歇一会儿再点吧"}); return
        rate_add(f"react:{ident['kind']}:{ident['uid']}")
        w = _worldview_connection(); w.row_factory = sqlite3.Row
        self._ensure_reaction_tables(w)
        self._do_react(w, "char_favorites", "char_votes", ident)

    def _api_admin_supplements(self):
        admin = self._require_admin()
        if not admin:
            return
        with DB_LOCK:
            conn = db()
            rows = conn.execute("SELECT * FROM supplements WHERE status='pending' ORDER BY submitted_at DESC").fetchall()
            conn.close()
        self._json(200, {"supplements": [dict(r) for r in rows]})

    def _api_admin_supplement_decide(self):
        admin = self._require_admin()
        if not admin:
            return
        body = self._read_json()
        if body is None:
            return
        sid = body.get("id")
        approve = bool(body.get("approve"))
        with DB_LOCK:
            conn = db()
            row = conn.execute("SELECT * FROM supplements WHERE id=? AND status='pending'", (sid,)).fetchone()
            if not row:
                conn.close(); self._json(404, {"error": "补充不存在或已处理"}); return
            if approve:
                field = row["field_name"]
                import re
                if not re.match(r'^[a-z_]+$', field):
                    conn.close(); self._json(400, {"error": "字段名无效"}); return
                # 写回世界观库
                wconn = wv()
                wconn.execute("UPDATE characters SET {}=? WHERE id=?".format(field), (row["new_value"], row["character_id"]))
                wconn.commit()
                wconn.close()
                # 存版本历史
                conn.execute("INSERT INTO field_history (character_id, character_name, field_name, old_value, new_value, edited_by_kind, edited_by_uid, edited_by_name, edit_type, supplement_id) VALUES (?,?,?,?,?,?,?,?, 'approved', ?)",
                    (row["character_id"], row["character_name"], field, row["old_value"], row["new_value"],
                     row["user_kind"], row["user_uid"], row["user_name"], sid))
                # 存贡献
                conn.execute("INSERT INTO contributions (character_id, user_kind, user_uid, user_name, contribution_type, field_name) VALUES (?,?,?,?, 'field_edit', ?)",
                    (row["character_id"], row["user_kind"], row["user_uid"], row["user_name"], field))
            conn.execute("UPDATE supplements SET status=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?",
                ("approved" if approve else "rejected", admin["uid"], sid))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True, "approved": approve})

    # ---------- 豁免申请（突破年龄 / 突破技能选择） ----------
    def _api_exempt_apply(self):
        ident = self._require_ident()
        if not ident:
            return
        body = self._read_json()
        if body is None:
            return
        typ = (body.get("type") or "").strip()
        if typ not in ("age", "skill"):
            self._json(400, {"error": "申请类型无效"}); return
        msg = (body.get("message") or "").strip()[:300]
        with DB_LOCK:
            conn = db()
            exist = conn.execute("SELECT id FROM exempt_requests WHERE type=? AND user_kind=? AND user_uid=? AND status='pending'",
                                 (typ, ident["kind"], ident["uid"])).fetchone()
            if exist:
                conn.close(); self._json(409, {"error": "你已有一份待审的同类申请"}); return
            conn.execute("INSERT INTO exempt_requests (type, user_kind, user_uid, user_name, message) VALUES (?,?,?,?,?)",
                         (typ, ident["kind"], ident["uid"], ident.get("nickname") or ident.get("username") or "", msg))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True, "msg": "豁免申请已提交，等待审批"})

    def _api_admin_exempt_requests(self):
        admin = self._require_admin()
        if not admin:
            return
        conn = db()
        rows = [dict(r) for r in conn.execute("SELECT * FROM exempt_requests WHERE status='pending' ORDER BY created_at DESC")]
        conn.close()
        self._json(200, {"requests": rows})

    def _api_admin_exempt_decide(self):
        admin = self._require_admin()
        if not admin:
            return
        body = self._read_json()
        if body is None:
            return
        rid = body.get("id")
        approve = bool(body.get("approve"))
        with DB_LOCK:
            conn = db()
            row = conn.execute("SELECT * FROM exempt_requests WHERE id=? AND status='pending'", (rid,)).fetchone()
            if not row:
                conn.close(); self._json(404, {"error": "申请不存在或已处理"}); return
            if approve:
                col = "exempt_age" if row["type"] == "age" else "exempt_skill"
                if row["user_kind"] == "local":
                    conn.execute(f"UPDATE local_users SET {col}=1 WHERE uid=?", (row["user_uid"],))
                else:
                    conn.execute(f"""INSERT INTO user_flags (kind, uid, {col}) VALUES ('usso', ?, 1)
                                     ON CONFLICT(kind, uid) DO UPDATE SET {col}=1""", (row["user_uid"],))
            conn.execute("UPDATE exempt_requests SET status=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?",
                         ("approved" if approve else "rejected", admin["uid"], rid))
            conn.commit()
            conn.close()
        destroy_user_sessions(row["user_kind"], row["user_uid"]) if approve else None
        self._json(200, {"ok": True, "approved": approve})

    @oc_api
    def _api_admin_delete_character(self):
        admin = self._require_admin()
        if not admin:
            return
        body = self._read_json()
        if body is None:
            return
        key = (body.get("key") or "").strip()
        code = (body.get("code") or "").strip()
        if not key or not code:
            self._json(400, {"error": "缺少 owner / code"}); return
        target = oc_store.parse_owner(key)
        with character_store().transaction(write=True) as session:
            removed = session.delete(target, code, body.get("version"))
            session.conn.execute("UPDATE fan_characters SET is_public=0 WHERE user_kind=? AND user_uid=? AND code=?", (*oc_store.owner(target), code))
        self._json(200, {"ok": True, "removed": removed})

    def _api_admin_scribe_requests(self):
        admin = self._require_admin()
        if not admin:
            return
        with DB_LOCK:
            conn = db()
            rows = conn.execute("SELECT * FROM executor_requests WHERE status='pending' ORDER BY created_at DESC").fetchall()
            conn.close()
        self._json(200, {"requests": [dict(r) for r in rows]})

    def _api_admin_scribe_decide(self):
        admin = self._require_admin()
        if not admin:
            return
        body = self._read_json()
        if body is None:
            return
        rid = body.get("id")
        approve = bool(body.get("approve"))
        with DB_LOCK:
            conn = db()
            row = conn.execute("SELECT * FROM executor_requests WHERE id=? AND status='pending'", (rid,)).fetchone()
            if not row:
                conn.close(); self._json(404, {"error": "申请不存在或已处理"}); return
            if approve:
                if row["user_kind"] == "local":
                    conn.execute("UPDATE local_users SET edit_role='scribe' WHERE uid=?", (row["user_uid"],))
                else:
                    conn.execute("""INSERT INTO user_flags (kind, uid, edit_role) VALUES ('usso', ?, 'scribe')
                                    ON CONFLICT(kind, uid) DO UPDATE SET edit_role=excluded.edit_role""", (row["user_uid"],))
            conn.execute("UPDATE executor_requests SET status=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?",
                ("approved" if approve else "rejected", admin["uid"], rid))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True, "approved": approve})

    # ---------- 成员管理（长老管执行者/文书，管理员管全部） ----------
    def _member_scope(self, ident):
        if ident.get("is_admin"):
            return "all"
        if ident.get("role") == "elder":
            return "lower"
        return None

    def _api_member_users(self):
        ident = self._require_ident()
        if not ident:
            return
        scope = self._member_scope(ident)
        if not scope:
            self._json(403, {"error": "需要长老或管理员权限"}); return
        with DB_LOCK:
            conn = db()
            locals_ = [dict(r) for r in conn.execute(
                "SELECT uid, username, nickname, role, edit_role, status, created_at, last_login FROM local_users ORDER BY uid")]
            usso = [dict(r) for r in conn.execute(
                "SELECT user_id, nickname, email, picture, first_login FROM users ORDER BY first_login")]
            flags = {(r["kind"], r["uid"]): dict(r) for r in conn.execute("SELECT * FROM user_flags")}
            conn.close()
        out = []
        for u in locals_:
            role = u.get("role") or "executor"
            if role == "user": role = "executor"
            out.append({"kind": "local", "uid": str(u["uid"]), "name": u["username"],
                        "nickname": u.get("nickname") or "", "role": role,
                        "edit_role": u.get("edit_role") or "none", "status": u.get("status") or "active",
                        "last_login": u.get("last_login") or ""})
        for u in usso:
            f = flags.get(("usso", u["user_id"]), {})
            is_admin = u["user_id"] in ADMIN_USSO_IDS or f.get("role") == "admin"
            role = "admin" if is_admin else (f.get("role") or "executor")
            if role == "user": role = "executor"
            out.append({"kind": "usso", "uid": u["user_id"], "name": u.get("nickname") or "",
                        "nickname": u.get("nickname") or "", "role": role,
                        "edit_role": f.get("edit_role") or "none", "status": f.get("status") or "active",
                        "last_login": u.get("first_login") or ""})
        if scope == "lower":
            out = [u for u in out if u["role"] not in ("elder", "admin")]
        # 聚合每位用户的自定义配色与配色海报（供 member 管理）
        with DB_LOCK:
            conn = db()
            cs_rows = [dict(r) for r in conn.execute(
                "SELECT id, user_kind, user_uid, name, primary_name, accent_name, primary_color, accent_color, created_at FROM color_schemes WHERE user_uid != '' ORDER BY id DESC")]
            po_rows = [dict(r) for r in conn.execute(
                "SELECT id, user_kind, user_uid, title, char_code, char_name, primary_name, accent_name, primary_color, accent_color, img_ref, is_public, updated_at FROM posters ORDER BY id DESC")]
            conn.close()
        cs_map, po_map = {}, {}
        for r in cs_rows:
            cs_map.setdefault(f"{r['user_kind']}:{r['user_uid']}", []).append(r)
        for r in po_rows:
            po_map.setdefault(f"{r['user_kind']}:{r['user_uid']}", []).append(r)
        for u in out:
            mk = f"{u['kind']}:{u['uid']}"
            u["schemes"] = cs_map.get(mk, [])
            u["posters"] = po_map.get(mk, [])
        self._json(200, {"scope": scope, "users": out,
                         "self": {"kind": ident["kind"], "uid": ident["uid"], "role": ident.get("role")}})

    def _api_member_user_update(self):
        ident = self._require_ident()
        if not ident:
            return
        scope = self._member_scope(ident)
        if not scope:
            self._json(403, {"error": "需要长老或管理员权限"}); return
        body = self._read_json()
        if body is None:
            return
        kind, uid = body.get("kind"), str(body.get("uid", ""))
        patch = body.get("set", {})
        if kind not in ("local", "usso") or not uid:
            self._json(400, {"error": "参数错误"}); return
        # 读取目标当前角色
        with DB_LOCK:
            conn = db()
            if kind == "local":
                t = conn.execute("SELECT role FROM local_users WHERE uid=?", (uid,)).fetchone()
                t_role = (t["role"] if t else "executor") or "executor"
            else:
                f = conn.execute("SELECT role FROM user_flags WHERE kind='usso' AND uid=?", (uid,)).fetchone()
                is_admin = uid in ADMIN_USSO_IDS or (f and f["role"] == "admin")
                t_role = "admin" if is_admin else ((f["role"] if f else "executor") or "executor")
            conn.close()
        if t_role == "user": t_role = "executor"
        # 长老不能管长老/管理员
        if scope == "lower" and t_role in ("elder", "admin"):
            self._json(403, {"error": "长老无权管理长老/管理员"}); return
        # 不能改自己
        if kind == ident["kind"] and uid == str(ident["uid"]):
            self._json(400, {"error": "不能修改自己"}); return
        status = patch.get("status")
        edit_role = patch.get("edit_role")
        role = patch.get("role")
        if status not in (None, "active", "banned"):
            self._json(400, {"error": "非法状态"}); return
        if edit_role not in (None, "none", "scribe"):
            self._json(400, {"error": "非法文书等级"}); return
        if role not in (None, "executor"):
            # 只有管理员能设 elder/admin；长老只能设 executor
            if not (scope == "all" and role in ("executor", "elder", "admin")):
                self._json(403, {"error": "无权设置该角色"}); return
        with DB_LOCK:
            conn = db()
            if kind == "local":
                if status: conn.execute("UPDATE local_users SET status=? WHERE uid=?", (status, uid))
                if role: conn.execute("UPDATE local_users SET role=? WHERE uid=?", (role, uid))
                if edit_role: conn.execute("UPDATE local_users SET edit_role=? WHERE uid=?", (edit_role, uid))
            else:
                if status or edit_role or role:
                    conn.execute("""INSERT INTO user_flags (kind, uid, status, edit_role) VALUES ('usso',?,?,?,?)
                                    ON CONFLICT(kind,uid) DO UPDATE SET
                                      status=COALESCE(?, status), edit_role=COALESCE(?, edit_role)""",
                                 (uid, status or "active", edit_role or "none", status, edit_role))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True})

    # ---------- 自定义配色海报 ----------
    def _api_images_upload(self):
        body = self._read_image_form()
        if body is None:
            return
        if not self._require_ident():
            return
        image = body.pop("_image_file", None)
        if not image:
            self._json(400, {"error": "缺少图片文件"}); return
        # The editor uploads this path and then saves it as durable character data.
        self._json(200, {"ok": True, "url": store_image(*image)}, sanitize_images=False)

    def _poster_row_out(self, r):
        d = dict(r)
        d["is_public"] = bool(d.get("is_public"))
        return d

    def _api_posters_my(self):
        ident = self._require_ident()
        if not ident:
            return
        conn = db()
        rows = [dict(r) for r in conn.execute(
            "SELECT * FROM posters WHERE user_kind=? AND user_uid=? ORDER BY id DESC",
            (ident["kind"], str(ident["uid"]))
        ).fetchall()]
        codes = [f"poster-{r['id']}" for r in rows]
        fan_map = {}
        if codes:
            qm = ",".join("?" * len(codes))
            for r in conn.execute(
                f"SELECT code, id, is_public FROM fan_characters WHERE type='配色海报' AND code IN ({qm})",
                codes
            ).fetchall():
                fan_map[r["code"]] = r
        conn.close()
        for r in rows:
            r["is_public"] = bool(r.get("is_public"))
            f = fan_map.get(f"poster-{r['id']}")
            r["fan_id"] = f["id"] if f else None
            r["fan_public"] = bool(f["is_public"]) if f else False
        self._json(200, {"posters": rows})

    def _api_poster_get(self, qs):
        code = (qs.get("code", [""])[0] or "").strip()
        if not code:
            self._json(400, {"error": "缺少 code 参数"}); return
        conn = db()
        row = conn.execute("SELECT * FROM posters WHERE char_code=?", (code,)).fetchone()
        conn.close()
        if not row:
            self._json(404, {"error": "海报不存在"}); return
        d = dict(row)
        ident = self._require_ident_optional()
        if not d["is_public"] and not (ident and ident["kind"] == d["user_kind"] and str(ident["uid"]) == str(d["user_uid"])):
            self._json(403, {"error": "该海报未公开"}); return
        d["is_public"] = bool(d["is_public"])
        self._json(200, {"poster": d})

    @oc_api
    def _api_posters_save(self):
        body = self._read_image_form()
        if body is None:
            return
        ident = self._require_ident()
        if not ident:
            return
        if any(value is not None and not isinstance(value, str) for value in (body.get(key) for key in ("title", "char_code", "char_name", "primary_name", "accent_name", "primary_color", "accent_color"))):
            self._json(400, {"error": "海报文字及颜色格式错误"}); return
        title = (body.get("title") or "").strip()
        if not title or len(title) > 60:
            self._json(400, {"error": "海报标题需为 1-60 个字符"}); return
        char_code = (body.get("char_code") or "").strip()
        char_name = (body.get("char_name") or "").strip()
        primary_name = (body.get("primary_name") or "").strip()
        accent_name = (body.get("accent_name") or "").strip()
        primary = (body.get("primary_color") or "").strip().lower()
        accent = (body.get("accent_color") or "").strip().lower()
        for v in (primary, accent):
            if not re.fullmatch(r"#[0-9a-f]{6}", v):
                self._json(400, {"error": "颜色格式需为 #RRGGBB"}); return
        state = body.get("state")
        if state is not None and not isinstance(state, dict):
            self._json(400, {"error": "state 格式错误"}); return
        if state and state.get("charImg") and not re.fullmatch(r"/assets/uploads/[a-f0-9]+\.(?:png|jpg|webp|gif)", str(state["charImg"])):
            self._json(400, {"error": "角色图片需先作为文件上传"}); return
        if state:
            state.update(colorA=primary, colorB=accent)
        state_json = json.dumps(state, ensure_ascii=False) if state else ""
        image_file = body.pop("_image_file", None)
        if image_file:
            if image_file[1] != "image/png":
                self._json(400, {"error": "海报需为 PNG 图片"}); return
            img_ref = store_image(*image_file)
        else:
            # Cached older clients may still submit a bounded data URL.
            img = body.get("image") or ""
            try:
                head, encoded = img.split(",", 1)
                raw, mime = validate_image(base64.b64decode(encoded, validate=True), head[5:].split(";")[0])
                if mime != "image/png":
                    raise ValueError("海报需为 PNG 图片")
                img_ref = store_image(raw, mime)
            except (ValueError, TypeError):
                self._json(400, {"error": "海报图片无效或超过8MB"}); return
        user_name = ident.get("nickname") or ident.get("username") or ""
        updated_character = None
        with DB_LOCK, character_store().transaction(write=True) as session:
            character = session.get(ident, char_code) if char_code else None
            if char_code and character is None:
                self._json(400, {"error": "绑定的人设不存在或不属于你"}); return
            conn = session.conn
            conn.execute("""INSERT INTO posters
                (user_kind,user_uid,user_name,title,char_code,char_name,primary_name,accent_name,
                 primary_color,accent_color,state_json,img_ref,is_public,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (ident["kind"], str(ident["uid"]), user_name, title, char_code, char_name,
                 primary_name, accent_name, primary, accent, state_json, img_ref, 0, now_iso(), now_iso()))
            pid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            if character is not None:
                character["data"].update(colorPrimary=primary, colorAccent=accent, colorIndex=-1)
                updated_character, _ = session.save(ident, character, body.get("character_version"))
                sync_fan_characters(conn, ident, char_code, character["data"])
        self._json(200, {"ok": True, "id": pid, "character": updated_character})

    def _api_posters_delete(self):
        ident = self._require_ident()
        if not ident:
            return
        body = self._read_json()
        if body is None:
            return
        pid = body.get("id")
        if not pid:
            self._json(400, {"error": "缺少 id"}); return
        with DB_LOCK:
            conn = db()
            row = conn.execute("SELECT * FROM posters WHERE id=?", (pid,)).fetchone()
            if not row:
                conn.close(); self._json(404, {"error": "海报不存在"}); return
            if row["user_kind"] != ident["kind"] or str(row["user_uid"]) != str(ident["uid"]):
                conn.close(); self._json(403, {"error": "只能删除自己的海报"}); return
            conn.execute("DELETE FROM posters WHERE id=?", (pid,))
            conn.execute("DELETE FROM fan_characters WHERE type='配色海报' AND code=?", (f"poster-{pid}",))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True})

    def _api_posters_publish(self):
        """把配色海报共享到同人画廊，与绑定的本人人设对应（多人设不混淆）"""
        ident = self._require_ident()
        if not ident:
            return
        body = self._read_json()
        if body is None:
            return
        pid = body.get("id")
        is_public = bool(body.get("is_public"))
        if not pid:
            self._json(400, {"error": "缺少 id"}); return
        with DB_LOCK:
            conn = db()
            row = conn.execute("SELECT * FROM posters WHERE id=?", (pid,)).fetchone()
            if not row:
                conn.close(); self._json(404, {"error": "海报不存在"}); return
            if row["user_kind"] != ident["kind"] or str(row["user_uid"]) != str(ident["uid"]):
                conn.close(); self._json(403, {"error": "只能操作自己的海报"}); return
            poster_code = f"poster-{pid}"
            gallery_name = (row["title"] or "配色海报") + (f"｜{row['char_name']}" if row["char_name"] else "")
            story = ("配色：" + "×".join(x for x in (row["primary_name"], row["accent_name"]) if x)
                     + f"（{row['primary_color']} / {row['accent_color']}）") if (row["primary_name"] or row["accent_name"]) else ""
            fan = conn.execute(
                "SELECT id FROM fan_characters WHERE type='配色海报' AND user_kind=? AND user_uid=? AND code=?",
                (ident["kind"], str(ident["uid"]), poster_code)
            ).fetchone()
            if is_public:
                if fan:
                    conn.execute(
                        "UPDATE fan_characters SET name=?, story=?, image_data=?, is_public=1, updated_at=? WHERE id=?",
                        (gallery_name[:80], story, row["img_ref"], now_iso(), fan["id"])
                    )
                else:
                    conn.execute(
                        """INSERT INTO fan_characters
                           (user_kind, user_uid, user_name, name, type, story, image_data, is_public, code, created_at, updated_at)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                        (ident["kind"], str(ident["uid"]),
                         ident.get("nickname") or ident.get("username") or "",
                         gallery_name[:80], "配色海报", story, row["img_ref"], 1, poster_code,
                         now_iso(), now_iso())
                    )
            else:
                if fan:
                    conn.execute("UPDATE fan_characters SET is_public=0, updated_at=? WHERE id=?",
                                 (now_iso(), fan["id"]))
            conn.execute("UPDATE posters SET is_public=?, updated_at=? WHERE id=?",
                         (1 if is_public else 0, now_iso(), pid))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True, "is_public": is_public})

    def _api_admin_posters(self):
        ident = self._require_ident()
        if not ident:
            return
        if not ident.get("is_admin"):
            self._json(403, {"error": "需要管理员权限"}); return
        conn = db()
        rows = [dict(r) for r in conn.execute("SELECT * FROM posters ORDER BY id DESC").fetchall()]
        conn.close()
        for r in rows:
            r["is_public"] = bool(r.get("is_public"))
        self._json(200, {"posters": rows})

    def _api_admin_poster_delete(self):
        ident = self._require_ident()
        if not ident:
            return
        if not ident.get("is_admin"):
            self._json(403, {"error": "需要管理员权限"}); return
        body = self._read_json()
        if body is None:
            return
        pid = body.get("id")
        if not pid:
            self._json(400, {"error": "缺少 id"}); return
        with DB_LOCK:
            conn = db()
            row = conn.execute("SELECT id FROM posters WHERE id=?", (pid,)).fetchone()
            if not row:
                conn.close(); self._json(404, {"error": "海报不存在"}); return
            conn.execute("DELETE FROM posters WHERE id=?", (pid,))
            conn.execute("DELETE FROM fan_characters WHERE type='配色海报' AND code=?", (f"poster-{pid}",))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True})

    # ---------- 同人角色 API ----------
    def _api_fan_list(self, qs):
        try:
            page = int(qs.get("page", ["1"])[0] or 1)
            limit = int(qs.get("limit", ["12"])[0] or 12)
        except (TypeError, ValueError):
            self._json(400, {"error": "分页参数无效"})
            return
        page = max(page, 1)
        if page > 100000:
            self._json(400, {"error": "分页超出范围"})
            return
        limit = max(1, min(limit, 60))
        q = (qs.get("q", [""])[0] or "").strip()
        ft = (qs.get("type", [""])[0] or "").strip()
        offset = (page - 1) * limit
        # 只回传「是否本人」，不下发所有者 id（Stage 1.7）
        viewer = self._require_ident_optional()
        conn = db()
        where = ["is_public=1"]
        params = []
        if q:
            where.append("name LIKE ?")
            params.append(f"%{q}%")
        if ft:
            where.append("type=?")
            params.append(ft)
        wc = " AND ".join(where)
        self._ensure_fan_reaction_tables(conn)
        rows = conn.execute(
            f"""SELECT id, '' AS user_kind, '' AS user_uid, user_name, name, type, species, gender, faction, ability, appearance, story, image_data, is_public, code, created_at, updated_at,
                      (user_kind=? AND user_uid=?) AS is_mine,
                      (SELECT COUNT(*) FROM fan_char_favorites fav WHERE fav.character_id=fan_characters.id)
                      + (SELECT COUNT(*) FROM fan_char_votes vote WHERE vote.character_id=fan_characters.id AND vote.vote=1)
                      - 2 * (SELECT COUNT(*) FROM fan_char_votes vote WHERE vote.character_id=fan_characters.id AND vote.vote=-1) AS reaction_score
               FROM fan_characters WHERE {wc}
               ORDER BY reaction_score DESC, created_at DESC, id DESC LIMIT ? OFFSET ?""",
            [viewer["kind"] if viewer else "", viewer["uid"] if viewer else ""] + params + [limit, offset]
        ).fetchall()
        total = conn.execute(
            f"SELECT COUNT(*) FROM fan_characters WHERE {wc}", params
        ).fetchone()[0]
        conn.close()
        chars = [dict(r, is_mine=bool(viewer and r["is_mine"])) for r in rows]
        self._json(200, {"characters": chars, "total": total, "page": page, "limit": limit})

    def _api_fan_my(self):
        ident = self._require_ident()
        if not ident:
            return
        conn = db()
        rows = conn.execute(
            "SELECT * FROM fan_characters WHERE user_kind=? AND user_uid=? ORDER BY created_at DESC",
            (ident["kind"], ident["uid"])
        ).fetchall()
        conn.close()
        self._json(200, {"characters": [dict(r) for r in rows]})

    def _api_fan_submit(self):
        ident = self._require_ident()
        if not ident:
            return
        body = self._read_json()
        if body is None:
            return
        name = (body.get("name") or "").strip()
        if not name:
            self._json(400, {"error": "角色名不能为空"}); return
        if len(name) > 50:
            self._json(400, {"error": "角色名过长（≤50字）"}); return
        try:
            image_data = _persist_preview_reference((body.get("image_data") or "").strip())
        except ValueError as error:
            self._json(400, {"error": str(error)}); return
        conn = db()
        conn.execute(
            """INSERT INTO fan_characters
               (user_kind, user_uid, user_name, name, type, species, gender, faction,
                ability, appearance, story, image_data, is_public, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (ident["kind"], ident["uid"],
             ident.get("nickname") or ident.get("username") or "",
             name,
             (body.get("type") or "").strip(),
             (body.get("species") or "").strip(),
             (body.get("gender") or "").strip(),
             (body.get("faction") or "").strip(),
             (body.get("ability") or "").strip(),
             (body.get("appearance") or "").strip(),
             (body.get("story") or "").strip(),
             image_data,
             1 if body.get("is_public", True) else 0,
             now_iso(), now_iso())
        )
        fid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.commit()
        conn.close()
        self._json(200, {"ok": True, "id": fid})

    def _api_fan_toggle(self):
        ident = self._require_ident()
        if not ident:
            return
        body = self._read_json()
        if body is None:
            return
        fid = body.get("id")
        is_public = 1 if body.get("is_public") else 0
        if not fid:
            self._json(400, {"error": "缺少 id"}); return
        conn = db()
        row = conn.execute("SELECT * FROM fan_characters WHERE id=?", (fid,)).fetchone()
        if not row:
            conn.close(); self._json(404, {"error": "角色不存在"}); return
        if row["user_kind"] != ident["kind"] or row["user_uid"] != ident["uid"]:
            conn.close(); self._json(403, {"error": "只能操作自己的角色"}); return
        conn.execute("UPDATE fan_characters SET is_public=?, updated_at=? WHERE id=?",
                     (is_public, now_iso(), fid))
        conn.commit()
        conn.close()
        self._json(200, {"ok": True, "is_public": is_public})

    @oc_api
    def _api_fan_check_suggest(self):
        """检查用户是否有人设登记但尚未公开到同人画廊"""
        ident = self._require_ident()
        if not ident:
            return
        # 检查 characters.json 中是否有该用户的角色
        chars = character_store().list(ident)
        if not chars:
            self._json(200, {"suggest": False, "reason": "no_characters"})
            return
        # 检查 fan_characters 表中是否有记录
        conn = db()
        count = conn.execute(
            "SELECT COUNT(*) FROM fan_characters WHERE user_kind=? AND user_uid=?",
            (ident["kind"], ident["uid"])
        ).fetchone()[0]
        conn.close()
        if count > 0:
            self._json(200, {"suggest": False, "reason": "already_submitted"})
        else:
            self._json(200, {"suggest": True, "character_count": len(chars)})

    def _api_fan_publish(self):
        """从已登记人设中批量公开到同人画廊"""
        try:
            ident = self._require_ident()
            if not ident:
                return
            body = self._read_json()
            if body is None:
                return
            codes = body.get("character_codes") or []
            if not codes:
                self._json(400, {"error": "请选择要公开的角色"}); return
            with character_store().transaction(write=True) as session:
                chars = session.list(ident)
                conn = session.conn
                published = 0
                skipped = 0
                for c in chars:
                    cd = c.get("data") or c
                    code = cd.get("code")
                    if code not in codes:
                        continue
                    fields = fan_fields(cd)
                    if not fields["name"]:
                        continue
                    # 同一角色只保留一条画廊记录：先按编号找，旧记录（无编号）再按名字找
                    existing = conn.execute(
                        "SELECT id, is_public FROM fan_characters WHERE user_kind=? AND user_uid=? AND code=? AND COALESCE(type,'')!='配色海报' ORDER BY id LIMIT 1",
                        (ident["kind"], ident["uid"], code)
                    ).fetchone() or conn.execute(
                        "SELECT id, is_public FROM fan_characters WHERE user_kind=? AND user_uid=? AND name=? AND COALESCE(code,'')='' ORDER BY id LIMIT 1",
                        (ident["kind"], ident["uid"], fields["name"])
                    ).fetchone()
                    if existing:
                        # 已公开：跳过；曾公开后取消：重新公开。两种情况都顺带刷新为最新资料
                        sets = ", ".join(f"{col}=?" for col in FAN_SYNC_COLUMNS)
                        conn.execute(
                            f"UPDATE fan_characters SET {sets}, code=?, is_public=1, updated_at=? WHERE id=?",
                            [fields[col] for col in FAN_SYNC_COLUMNS] + [to_str(code), now_iso(), existing["id"]]
                        )
                        if existing["is_public"]:
                            skipped += 1
                        else:
                            published += 1
                        continue
                    conn.execute(
                        """INSERT INTO fan_characters
                           (user_kind, user_uid, user_name, name, type, species, gender, faction,
                            ability, appearance, story, image_data, is_public, code, created_at, updated_at)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (ident["kind"], ident["uid"],
                         ident.get("nickname") or ident.get("username") or "",
                         *[fields[col] for col in FAN_SYNC_COLUMNS],
                         1,  # is_public
                         to_str(code),
                         now_iso(), now_iso())
                    )
                    published += 1
            self._json(200, {"ok": True, "published": published, "skipped": skipped})
        except oc_store.OCError as error:
            self._json(error.status, {"error": error.code})
        except Exception:
            self._json(500, {"error": "发布失败"})

    def _ensure_fan_reaction_tables(self, w):
        w.execute("CREATE TABLE IF NOT EXISTS fan_char_favorites (id INTEGER PRIMARY KEY AUTOINCREMENT, user_kind TEXT, user_uid TEXT, character_id INTEGER, created_at INTEGER, UNIQUE(user_kind, user_uid, character_id))")
        w.execute("CREATE TABLE IF NOT EXISTS fan_char_votes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_kind TEXT, user_uid TEXT, character_id INTEGER, vote INTEGER, created_at INTEGER, UNIQUE(user_kind, user_uid, character_id))")
        unique_indexes = w.execute("PRAGMA index_list(fan_char_favorites)").fetchall()
        for index in unique_indexes:
            if not index["unique"]:
                continue
            columns = [row["name"] for row in w.execute(f"PRAGMA index_info('{index['name']}')")]
            if columns == ["user_kind", "user_uid"]:
                w.execute("CREATE TABLE fan_char_favorites_new (id INTEGER PRIMARY KEY AUTOINCREMENT, user_kind TEXT, user_uid TEXT, character_id INTEGER, created_at INTEGER, UNIQUE(user_kind, user_uid, character_id))")
                w.execute("INSERT INTO fan_char_favorites_new SELECT id, user_kind, user_uid, character_id, created_at FROM fan_char_favorites")
                w.execute("DROP TABLE fan_char_favorites")
                w.execute("ALTER TABLE fan_char_favorites_new RENAME TO fan_char_favorites")
                w.commit()
                break

    def _api_fan_reactions(self):
        w = db(); w.row_factory = sqlite3.Row
        self._ensure_fan_reaction_tables(w)
        fav = {r['character_id']: r['c'] for r in w.execute("SELECT character_id, COUNT(*) c FROM fan_char_favorites GROUP BY character_id")}
        up = {r['character_id']: r['c'] for r in w.execute("SELECT character_id, COUNT(*) c FROM fan_char_votes WHERE vote=1 GROUP BY character_id")}
        down = {r['character_id']: r['c'] for r in w.execute("SELECT character_id, COUNT(*) c FROM fan_char_votes WHERE vote=-1 GROUP BY character_id")}
        my = {"fav": None, "favs": [], "multiple_fav": False, "votes": {}}
        ident = self._require_ident_optional()
        if ident:
            favs = [r["character_id"] for r in w.execute("SELECT character_id FROM fan_char_favorites WHERE user_kind=? AND user_uid=?", (ident["kind"], ident["uid"]))]
            my["fav"] = favs[0] if favs else None
            my["favs"] = favs
            my["multiple_fav"] = bool(ident.get("is_admin"))
            for r in w.execute("SELECT character_id, vote FROM fan_char_votes WHERE user_kind=? AND user_uid=?", (ident["kind"], ident["uid"])):
                my["votes"][str(r['character_id'])] = r['vote']
        w.close()
        self._json(200, {"fav": fav, "up": up, "down": down, "my": my})

    def _api_fan_react(self):
        ident = self._require_ident()
        if not ident:
            return
        if rate_blocked(f"react:{ident['kind']}:{ident['uid']}", 60, 60):
            self._json(429, {"error": "操作太快了，歇一会儿再点吧"}); return
        rate_add(f"react:{ident['kind']}:{ident['uid']}")
        w = db()
        self._ensure_fan_reaction_tables(w)
        self._do_react(w, "fan_char_favorites", "fan_char_votes", ident, allow_multiple_favorites=bool(ident.get("is_admin")))

    # ---------- 辅助 ----------
    def _oauth_callback(self):
        host = request_host(self)
        # Only the disposable mock fixture overrides this constant with a loopback URL.
        if host in ("localhost", "127.0.0.1", "::1") and not COOKIE_SECURE:
            return CALLBACK_URL
        return oauth_callback("huiguan", host)

    def _get_session(self):
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        m = cookie.get("session")
        sid = m.value if m else ""
        return sid if sid and read_session(sid, request_root(self)) else ""

    def _client_ip(self):
        return self.headers.get("CF-Connecting-IP") or self.client_address[0]

    def _turnstile_passed(self, body, action):
        """Answer the request and return False unless its Turnstile token verifies (no-op when not configured)."""
        ok, reason = turnstile.verify(self, body.get("turnstile"), action, self._client_ip())
        if not ok:
            if reason == "unavailable":
                self._json(503, {"error": "人机验证服务暂时不可用，请稍后再试", "turnstile": True})
            else:
                self._json(403, {"error": "人机验证未通过，请重试", "turnstile": True})
        return ok

    def _session_cookie(self, sid):
        secure = "; Secure" if COOKIE_SECURE else ""
        return f"session={sid}; Path=/{cookie_domain(self)}; Max-Age={SESSION_DAYS * 86400}; HttpOnly; SameSite=Lax{secure}"

    def _session_clear_cookie(self):
        secure = "; Secure" if COOKIE_SECURE else ""
        return f"session=; Path=/{cookie_domain(self)}; Max-Age=0; HttpOnly; SameSite=Lax{secure}"

    def _sso_cookie(self, uid, kind, name):
        color = None
        try:
            conn = db()
            if kind == "local":
                row = conn.execute("SELECT theme_primary, theme_accent FROM local_users WHERE uid=?", (uid,)).fetchone()
            else:
                row = conn.execute("SELECT theme_primary, theme_accent FROM users WHERE user_id=?", (uid,)).fetchone()
            conn.close()
            if row:
                p = (row["theme_primary"] or "").strip().lower()
                a = (row["theme_accent"] or "").strip().lower()
                if p and a:
                    color = {"p": p, "a": a}
        except Exception:
            color = None
        token = hx_sso.make_token(uid, kind, name, color, root_domain=request_root(self))
        secure = "; Secure" if COOKIE_SECURE else ""
        return f"{hx_sso.COOKIE_NAME}={token}; Path=/{cookie_domain(self)}; Max-Age={hx_sso.MAX_AGE}; HttpOnly; SameSite=Lax{secure}"

    def _sso_clear_cookie(self):
        secure = "; Secure" if COOKIE_SECURE else ""
        return f"{hx_sso.COOKIE_NAME}=; Path=/{cookie_domain(self)}; Max-Age=0; HttpOnly; SameSite=Lax{secure}"

    def _read_image_form(self, gif_limit=GIF_LIMIT):
        content_type = self.headers.get("Content-Type", "")
        if not content_type.lower().startswith("multipart/form-data"):
            return self._read_json()
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > UPLOAD_REQUEST_LIMIT:
                self._json(413, {"error": "上传过大，图片需≤8MB"}); return None
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError("上传内容不完整")
            message = BytesParser(policy=policy.default).parsebytes(b"Content-Type: " + content_type.encode("ascii") + b"\r\nMIME-Version: 1.0\r\n\r\n" + raw)
            if not message.is_multipart():
                raise ValueError("上传格式无效")
            fields = {}
            for part in message.iter_parts():
                name = part.get_param("name", header="content-disposition")
                if part.is_multipart() or name not in ("metadata", "image") or name in fields:
                    raise ValueError("上传字段无效")
                fields[name] = part
            if "metadata" not in fields or "image" not in fields:
                raise ValueError("缺少图片或编辑信息")
            metadata = fields["metadata"].get_payload(decode=True)
            if len(metadata) > UPLOAD_METADATA_LIMIT:
                raise ValueError("编辑信息过大（≤256KB）")
            body = json.loads(metadata.decode("utf-8"))
            if not isinstance(body, dict):
                raise ValueError("编辑信息格式错误")
            for key in ("filename", "description", "image_type", "data"):
                if key in body and not isinstance(body[key], str):
                    raise ValueError("上传文字字段格式错误")
            body["_image_file"] = validate_image(fields["image"].get_payload(decode=True), fields["image"].get_content_type(), gif_limit)
            return body
        except (ValueError, TypeError, UnicodeError):
            self._json(400, {"error": "图片或上传格式无效，图片≤8MB / 动图≤5MB"})
            return None

    def _read_json(self, max_bytes=8 * 1024 * 1024):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length < 0:
                raise ValueError("invalid Content-Length")
            if length > max_bytes:
                self._json(413, {"error": "请求内容过大"})
                return None
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(body, dict):
                raise ValueError("JSON body must be an object")
            return body
        except Exception:
            self._json(400, {"error": "请求数据格式错误"})
            return None

    def _static_allowed(self, path):
        return _base_static_allowed(path)

    def _json(self, status, data, cookie=None, *, sanitize_images=True):
        if sanitize_images:
            data = _sanitize_json_image_sources(data)
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        accept = (self.headers.get("Accept-Encoding") or "")
        use_gzip = "gzip" in accept and len(body) > 1024
        if use_gzip:
            body = gzip.compress(body, 6)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        if status >= 400:
            # A rejected upload may still have unread bytes; never parse them as another request.
            self.close_connection = True
            self.send_header("Connection", "close")
        for k, v in self._cors_headers():
            self.send_header(k, v)
        if use_gzip:
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
        self.send_header("Content-Length", str(len(body)))
        if cookie:
            for c in (cookie if isinstance(cookie, (list, tuple)) else [cookie]):
                self.send_header("Set-Cookie", c)
        self.end_headers()
        self.wfile.write(body)

    def _cors_headers(self):
        return cors_headers(self)

    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in self._cors_headers():
            self.send_header(k, v)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, fmt, *args):
        print(f"[huiguan-8089] {args[0]}", flush=True)


if __name__ == "__main__":
    init_user_db()
    if not CLIENT_ID:
        print("未配置 CLIENT_ID，请编辑 server_huiguan.py 填入 sso.umrc.cn 的 Client ID 和密钥")
    print(f"huiguan 服务启动: http://localhost:{PORT}")
    http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
