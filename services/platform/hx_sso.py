# 西木会馆跨站 SSO 共享模块（huiguan 发 cookie，其他站点读取验证）
import hmac, hashlib, base64, json, time, os
from pathlib import Path
from site_domains import SITE_DOMAIN, domain_root, normalize_host, request_root, PRODUCTION_HOSTS, DEVELOPMENT_HOSTS
from storage_paths import secrets_dir

HX_SSO_SECRET = os.environ.get('HX_SSO_SECRET', '')
if not HX_SSO_SECRET:
    # 本地启动器不自动加载 dotenv；所有 Python 站点共享同一个私密配置。
    try:
        for line in (secrets_dir() / 'server.env').read_text(encoding='utf-8').splitlines():
            key, separator, value = line.strip().partition('=')
            if separator and key == 'HX_SSO_SECRET':
                HX_SSO_SECRET = value.strip().strip('\"\'')
                break
    except FileNotFoundError:
        pass

def _secret_bytes():
    if not HX_SSO_SECRET:
        raise RuntimeError('HX_SSO_SECRET must be configured')
    return HX_SSO_SECRET.encode()
COOKIE_NAME = "hx_sso"
COOKIE_DOMAIN = "." + SITE_DOMAIN
MAX_AGE = 7 * 24 * 3600  # 7 天


def _b64(b):
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _ub64(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def make_token(uid, kind, name, color=None, root_domain=None):
    audience = root_domain or SITE_DOMAIN
    if domain_root(audience) != audience:
        raise ValueError("SSO audience must be an approved root")
    payload = {"uid": str(uid), "kind": kind, "name": name, "aud": audience, "exp": int(time.time()) + MAX_AGE}
    if color:
        payload["color"] = color
    body = _b64(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
    sig = hmac.new(_secret_bytes(), body.encode(), hashlib.sha256).hexdigest()
    return body + "." + sig


def verify_token(token, root_domain=None):
    try:
        body, sig = token.split(".", 1)
        expect = hmac.new(_secret_bytes(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expect, sig):
            return None
        p = json.loads(_ub64(body))
        expected = root_domain or SITE_DOMAIN
        # Existing cookies remain usable only on the original root during rollout.
        if p.get("aud", "iridescently.xyz") != expected or domain_root(expected) != expected:
            return None
        if p.get("exp", 0) < time.time():
            return None
        return p
    except Exception:
        return None


def read_cookie(headers):
    """从请求头解析 hx_sso cookie，返回验证后的 payload 或 None"""
    host = normalize_host(headers.get("Host", ""), allow_any_port=True)
    if host in DEVELOPMENT_HOSTS:
        forwarded = normalize_host(headers.get("X-Forwarded-Host", ""))
        host = forwarded if forwarded in PRODUCTION_HOSTS else host
    root = domain_root(host)
    if not root and host not in DEVELOPMENT_HOSTS and headers.get("Host"):
        return None
    raw = headers.get("Cookie", "")
    for part in raw.split(";"):
        part = part.strip()
        if part.startswith(COOKIE_NAME + "="):
            return verify_token(part[len(COOKIE_NAME) + 1:], root or SITE_DOMAIN)
    return None
