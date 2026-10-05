#!/usr/bin/env python3
"""妖灵会馆 - 人设登记 & 展示页服务器 (port 8089)"""
import http.server
import json
import os
import sys
import urllib.parse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHAR_DIR = os.path.join(BASE_DIR, 'characters')
os.makedirs(CHAR_DIR, exist_ok=True)

class HuiguanHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/save-character':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body)
                code = data.get('code', 'unknown').strip()
                html_content = data.get('html', '')
                if not code or not html_content:
                    self._json_resp(400, {'error': 'code and html required'})
                    return
                safe_name = "".join(c for c in code if c.isalnum() or c in '._-')
                if not safe_name:
                    safe_name = 'unknown'
                filepath = os.path.join(CHAR_DIR, f'{safe_name}.html')
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(html_content)
                self._json_resp(200, {'ok': True, 'path': filepath, 'url': f'/characters/{safe_name}.html'})
            except json.JSONDecodeError:
                self._json_resp(400, {'error': 'invalid json'})
        else:
            self._json_resp(404, {'error': 'not found'})

    def _json_resp(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, fmt, *args):
        print(f"[8089] {args[0]}", flush=True)

if __name__ == '__main__':
    PORT = 8089
    server = http.server.HTTPServer(('0.0.0.0', PORT), HuiguanHandler)
    print(f"妖灵会馆服务器已启动: http://localhost:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已关闭", flush=True)
