"""未知 POST 携带请求体时，不能污染同一 keep-alive 连接上的下一个请求。"""

import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request
from pathlib import Path

HUIGUAN = Path(__file__).resolve().parents[1]
LAUNCH = r'''
import sys, http.server
sys.path.insert(0, sys.argv[1])
sys.path.insert(0, str(__import__("pathlib").Path(sys.argv[1]).parents[1] / "services" / "platform"))
from storage_paths import initialize_storage; initialize_storage(); import server_huiguan as s
s.init_user_db()
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), s.Handler).serve_forever()
'''


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def read_response(sock):
    """读取一个完整响应，返回 (状态码, 响应头, 响应体)。"""
    data = b""
    while b"\r\n\r\n" not in data:
        data += sock.recv(4096)
    head, _, body = data.partition(b"\r\n\r\n")
    lines = head.split(b"\r\n")
    headers = dict(line.split(b": ", 1) for line in lines[1:])
    while len(body) < int(headers.get(b"Content-Length", b"0")):
        body += sock.recv(4096)
    return int(lines[0].split()[1]), headers, body


class UnknownPostBodyKeepAliveTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = tempfile.TemporaryDirectory()
        (Path(cls.root.name) / "apps" / "huiguan").mkdir(parents=True)
        cls.port = free_port()
        env = dict(os.environ, IRIDESCENTLY_STORAGE_ROOT=cls.root.name,
                   IRIDESCENTLY_ENVIRONMENT="test", HX_SSO_SECRET="test-only-secret")
        for key in ("DATA", "ASSETS", "CACHE", "RELEASE", "BACKUP", "PROJECT"):
            env.pop(f"IRIDESCENTLY_{key}_ROOT", None)
        cls.proc = subprocess.Popen([sys.executable, "-c", LAUNCH, str(HUIGUAN), str(cls.port)], env=env,
                                    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        for _ in range(100):
            if cls.proc.poll() is not None:
                break  # 进程已退出，不再空等
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{cls.port}/api/fan/list", timeout=1).close()
                return
            except OSError:
                time.sleep(0.1)
        cls._raise_startup_failure()

    @classmethod
    def _raise_startup_failure(cls):
        """启动失败时把捕获的 stderr 作为失败原因抛出。"""
        if cls.proc.poll() is None:
            cls.proc.terminate()
        try:
            _, stderr = cls.proc.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            cls.proc.kill()
            _, stderr = cls.proc.communicate()
        detail = (stderr or b"").decode("utf-8", "replace").strip()
        raise RuntimeError(f"服务启动失败（端口 {cls.port}）：{detail or '无 stderr 输出'}")

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        try:
            cls.proc.wait(10)
        except subprocess.TimeoutExpired:
            cls.proc.kill()
            cls.proc.wait()
        cls.proc.communicate(timeout=5)
        cls.root.cleanup()

    def test_unknown_post_does_not_leak_body_into_next_request(self):
        payload = b'{"unexpected":"body"}'
        with socket.create_connection(("127.0.0.1", self.port), timeout=5) as sock:
            sock.sendall(b"POST /api/no-such-endpoint HTTP/1.1\r\nHost: 127.0.0.1\r\n"
                         b"Content-Type: application/json\r\n"
                         b"Content-Length: " + str(len(payload)).encode() + b"\r\n\r\n" + payload)
            status, headers, _ = read_response(sock)
            self.assertEqual(status, 404)
            self.assertEqual(headers.get(b"Connection", b"").lower(), b"close")
            self.assertEqual(sock.recv(4096), b"")  # 连接已关闭，残留 body 不可能再成为请求行


if __name__ == "__main__":
    unittest.main()
