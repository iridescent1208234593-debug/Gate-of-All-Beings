# 西木会馆跨站 SSO 共享模块（huiguan 发 cookie，其他站点读取验证）
import hmac, hashlib, base64, json, time, os

HX_SSO_SECRET = os.environ.get('HX_SSO_SECRET', '')

def _secret_bytes():
    if not HX_SSO_SECRET:
        raise RuntimeError('HX_SSO_SECRET must be configured')
    return HX_SSO_SECRET.encode()
COOKIE_NAME = "hx_sso"
COOKIE_DOMAIN = ".iridescently.xyz"
MAX_AGE = 7 * 24 * 3600  # 7 天


def _b64(b):
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _ub64(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def make_token(uid, kind, name, color=None):
    payload = {"uid": str(uid), "kind": kind, "name": name, "exp": int(time.time()) + MAX_AGE}
    if color:
        payload["color"] = color
    body = _b64(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
    sig = hmac.new(_secret_bytes(), body.encode(), hashlib.sha256).hexdigest()
    return body + "." + sig


def verify_token(token):
    try:
        body, sig = token.split(".", 1)
        expect = hmac.new(_secret_bytes(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expect, sig):
            return None
        p = json.loads(_ub64(body))
        if p.get("exp", 0) < time.time():
            return None
        return p
    except Exception:
        return None


def read_cookie(headers):
    """从请求头解析 hx_sso cookie，返回验证后的 payload 或 None"""
    raw = headers.get("Cookie", "")
    for part in raw.split(";"):
        part = part.strip()
        if part.startswith(COOKIE_NAME + "="):
            return verify_token(part[len(COOKIE_NAME) + 1:])
    return None
