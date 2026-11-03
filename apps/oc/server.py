"""
oc人设 — 纯静态站点 + 跨站 SSO 读取
基于 base_static 公共模块，自带静态防护 + 安全头 + 错误静默 + 缓存。
启动: python server.py
"""

import http.server
import json
import os
import sys

PORT = 8090
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "services", "platform"))
import hx_sso
from base_static import BaseStaticHandler


class Handler(BaseStaticHandler):
    protocol_version = "HTTP/1.1"
    _static_dir = STATIC_DIR

    def _is_api_path(self):
        return self.path.split("?")[0] == "/api/sso-user"

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/sso-user":
            u = hx_sso.read_cookie(self.headers)
            body = json.dumps(
                {"logged_in": True, "name": u.get("name"), "uid": u.get("uid"), "kind": u.get("kind")} if u else {"logged_in": False},
                ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        print(f"[oc-8090] {args[0]}", flush=True)


if __name__ == "__main__":
    from listen_address import listen_host
    host = listen_host()
    print(f"oc人设服务启动: http://{host}:{PORT}")
    http.server.ThreadingHTTPServer((host, PORT), Handler).serve_forever()